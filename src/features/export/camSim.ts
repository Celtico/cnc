import { approachSegment, camDraw, type CamOp, type Pt } from "../../core/export/xcsPreview"
import type { CamSheetView } from "./camDrawing"
import { resetHeightfield, stampSegment, tintPolygon, type Heightfield, type P3 } from "./camHeightfield"

/**
 * Simulació 3D de la Vista CAM: el programa (.xcs llegit) com una llista de moviments de la punta de l'eina en el temps,
 * en l'ordre del fitxer. Aproximat, només per veure-ho: velocitats fixes (el .xcs no en porta: les posa el Maestro),
 * el centre de l'eina de `camDraw` i, a les caixeres, un buidat en zig-zag inventat. Només el pla `Top`; les operacions
 * de cantell es compten (`side`). Pur.
 */

/** Velocitats (mm/s): tall 10 m/min, baixada 3 m/min, ràpids 40 m/min. */
export const SIM_FEED = { cut: 10_000 / 60, plunge: 3_000 / 60, rapid: 40_000 / 60 }
/** Ø de l'eina quan no se sap (la màquina no la té). */
export const DEFAULT_TOOL_D = 10
/** Alçades sobre el tauler: entre operacions i on comença a baixar a velocitat de tall. */
const SAFE = 30
const CLEAR = 5

export interface SimMove {
  kind: "rapid" | "cut"
  a: P3
  b: P3
  t0: number
  t1: number
  /** Índex a `SimProgram.ops`. */
  op: number
  r: number
  /** Fresa esfèrica (relleus 3D): deixa la forma de la bola. */
  ball?: boolean
  /** D'un recorregut 3D explícit (relleus): talla sense vora. */
  relief?: boolean
}

export interface SimOp {
  /** Número de l'operació al fitxer. */
  n: number
  t0: number
  t1: number
  r: number
  /** Es veu al 3D (pla `Top` i amb geometria). */
  shown: boolean
}

export interface SimProgram {
  L: number
  W: number
  T: number
  moves: SimMove[]
  ops: SimOp[]
  total: number
  /** Peces que queden soltes: quan acaba el seu contorn passant per fora (en ordre de temps). */
  finished: { ref: string; t: number; outline: Pt[] }[]
  /** Operacions que no es veuen al 3D (cantells, sense geometria). */
  side: number
  /** On és l'eina abans de començar (sobre l'origen). */
  home: P3
}

/** Zig-zag que buida un polígon (el centre de l'eina) amb passades a `step` mm, i el contorn al final. Trams separats = aixecar. */
export function pocketStrokes(poly: Pt[], step: number): Pt[][] {
  if (poly.length < 3 || step <= 0) return poly.length ? [poly] : []
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of poly) {
    y0 = Math.min(y0, p[1])
    y1 = Math.max(y1, p[1])
  }
  const lines = Math.max(1, Math.ceil((y1 - y0) / step))
  const strokes: Pt[][] = []
  let cur: Pt[] | null = null
  let flip = false
  for (let k = 0; k <= lines; k++) {
    const y = Math.min(y1 - 1e-6, Math.max(y0 + 1e-6, y0 + ((y1 - y0) * k) / lines))
    const xs: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!
      const q = poly[(i + 1) % poly.length]!
      if (p[1] <= y !== q[1] <= y) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]))
    }
    xs.sort((a, b) => a - b)
    const spans: [number, number][] = []
    for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i]!, xs[i + 1]!])
    if (spans.length !== 1) {
      // Més d'un tros (polígon còncau): cada tros a part, aixecant.
      cur = null
      for (const [a, b] of spans) strokes.push([[a, y], [b, y]])
      continue
    }
    const [a, b] = spans[0]!
    const seg: Pt[] = flip ? [[b, y], [a, y]] : [[a, y], [b, y]]
    flip = !flip
    // Es continua sense aixecar si el pas d'una fila a l'altra és dins del polígon.
    const last = cur?.[cur.length - 1]
    // (El pas va per la vora: es mira un punt una mica cap a dins, cap al mig de la fila nova.)
    const mx = (last?.[0] ?? 0) / 2 + seg[0]![0] / 2
    const my = (last?.[1] ?? 0) / 2 + seg[0]![1] / 2
    if (cur && last && inside(poly, [mx + ((a + b) / 2 - mx) * 0.02, my])) cur.push(...seg)
    else {
      cur = seg
      strokes.push(cur)
    }
  }
  strokes.push([...poly, poly[0]!])
  return strokes
}

function inside(poly: Pt[], p: Pt): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c
  }
  return c
}

const feedOf = (kind: SimMove["kind"], a: P3, b: P3) => (kind === "rapid" ? SIM_FEED.rapid : Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9 ? SIM_FEED.plunge : SIM_FEED.cut)

/** Fondàries de cada passada: amb `maxPass`, a trossos iguals fins a la fondària. */
function levels(op: CamOp): number[] {
  if (!op.maxPass || op.depth <= op.maxPass + 1e-6) return [op.depth]
  const n = Math.ceil(op.depth / op.maxPass - 1e-6)
  return Array.from({ length: n }, (_, k) => (op.depth * (k + 1)) / n)
}

/** El programa d'un tauler com a moviments en el temps. */
export function buildSimProgram(view: CamSheetView): SimProgram {
  const p = view.preview
  const L = p.workpiece?.L ?? 1000
  const W = p.workpiece?.W ?? 1000
  const T = p.workpiece?.T ?? 19
  const home: P3 = [0, 0, T + SAFE]
  const moves: SimMove[] = []
  const ops: SimOp[] = []
  const finished = new Map<string, { ref: string; t: number; outline: Pt[] }>()
  let side = 0
  let t = 0
  let pos: P3 = home
  let opIdx = 0
  let r = 0
  let ball = false
  let relief = false
  const push = (kind: SimMove["kind"], b: P3) => {
    const len = Math.hypot(b[0] - pos[0], b[1] - pos[1], b[2] - pos[2])
    if (len < 1e-9) return
    const dt = len / feedOf(kind, pos, b)
    moves.push({ kind, a: pos, b, t0: t, t1: t + dt, op: opIdx, r, ...(ball ? { ball } : {}), ...(relief ? { relief } : {}) })
    t += dt
    pos = b
  }
  /** Aixeca, va en ràpid sobre el punt i baixa en ràpid fins a tocar. */
  const goTo = (q: Pt) => {
    if (pos[2] < T + SAFE && Math.hypot(q[0] - pos[0], q[1] - pos[1]) > 1e-6) push("rapid", [pos[0], pos[1], T + SAFE])
    push("rapid", [q[0], q[1], Math.max(pos[2], T + CLEAR)])
    push("rapid", [q[0], q[1], T + CLEAR])
  }
  const retract = () => push("rapid", [pos[0], pos[1], T + SAFE])

  for (const o of p.ops) {
    opIdx = ops.length
    const t0 = t
    const z = (depth: number) => T - depth
    let shown = o.plane === "Top"
    if (shown && o.kind === "drill") {
      r = (o.diameter ?? 0) / 2
      goTo([o.x ?? 0, o.y ?? 0])
      push("cut", [o.x ?? 0, o.y ?? 0, z(o.depth)])
      retract()
    } else if (shown) {
      const width = view.widths.get(o.n)
      const d = width ? view.draws.get(o.n) : camDraw(o, DEFAULT_TOOL_D)
      r = (width ?? DEFAULT_TOOL_D) / 2
      ball = !!o.ball
      if (!d || !d.centre.length) shown = false
      else if (d.centre3) {
        // Recorregut 3D explícit: cada punt a la seva Z (sobre la cara, en ràpid).
        const q0 = d.centre3[0]!
        relief = true
        goTo([q0[0], q0[1]])
        for (const q of d.centre3) push(q[2] >= 0 && pos[2] >= T ? "rapid" : "cut", [q[0], q[1], T + q[2]])
        retract()
      } else {
        const centre = d.centre
        const strokes = d.fill ? pocketStrokes(centre, r * 1.2) : [d.closed && centre.length > 2 ? [...centre, centre[0]!] : centre]
        const ramp = o.approach?.k ? approachSegment(centre, o.approach.k * r) : null
        let reverse = false
        for (const depth of levels(o)) {
          for (const s0 of strokes) {
            // Fresats oberts en diverses passades: d'anada i tornada (`CreateBidirectionalMillingStrategy`).
            const s = reverse && !d.closed && !d.fill ? [...s0].reverse() : s0
            const first = s[0]!
            const atStart = Math.hypot(pos[0] - first[0], pos[1] - first[1]) < 1e-6 && pos[2] <= T
            if (atStart) push("cut", [first[0], first[1], z(depth)])
            else if (ramp && !d.fill) {
              goTo(ramp[0])
              push("cut", [ramp[0][0], ramp[0][1], T])
              push("cut", [first[0], first[1], z(depth)])
            } else {
              goTo(first)
              push("cut", [first[0], first[1], z(depth)])
            }
            for (const q of s.slice(1)) push("cut", [q[0], q[1], z(depth)])
            if (d.fill) retract()
          }
          reverse = !reverse
        }
        retract()
        if (o.ref && o.kind === "contour" && o.side === "outside" && o.depth >= T - 1e-6) finished.set(o.ref, { ref: o.ref, t, outline: view.outlines.get(o.ref) ?? d.outline })
      }
    }
    ball = false
    relief = false
    if (!shown) side++
    ops.push({ n: o.n, t0, t1: t, r, shown })
  }
  return { L, W, T, moves, ops, total: t, finished: [...finished.values()].sort((a, b) => a.t - b.t), side, home }
}

/** Primer moviment que acaba després de `t` (o `moves.length`). */
function moveAt(prog: SimProgram, t: number): number {
  let lo = 0
  let hi = prog.moves.length
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (prog.moves[m]!.t1 <= t) lo = m + 1
    else hi = m
  }
  return lo
}

const lerp = (m: SimMove, t: number): P3 => {
  const s = m.t1 > m.t0 ? Math.min(1, Math.max(0, (t - m.t0) / (m.t1 - m.t0))) : 1
  return [m.a[0] + (m.b[0] - m.a[0]) * s, m.a[1] + (m.b[1] - m.a[1]) * s, m.a[2] + (m.b[2] - m.a[2]) * s]
}

/** On és la punta de l'eina al temps `t`, i el radi de l'eina que hi ha. */
export function toolAt(prog: SimProgram, t: number): { p: P3; r: number } {
  if (!prog.moves.length || t <= 0) return { p: prog.home, r: prog.moves[0]?.r ?? 0 }
  const k = moveAt(prog, t)
  const m = prog.moves[Math.min(k, prog.moves.length - 1)]!
  return { p: lerp(m, t), r: m.r }
}

/** Operació (índex a `ops`) que es fa al temps `t`: la que el conté o, entre dues, la que ve. −1 al final. */
export function opAt(prog: SimProgram, t: number): number {
  const i = prog.ops.findIndex((o) => o.shown && o.t1 > t)
  return i
}

/** Inici de l'operació següent o anterior (amb `dir`) a `t`: per als botons ⏮ ⏭. */
export function stepOp(prog: SimProgram, t: number, dir: 1 | -1): number {
  const shown = prog.ops.filter((o) => o.shown && o.t1 > o.t0)
  if (dir > 0) return shown.find((o) => o.t0 > t + 1e-6)?.t0 ?? prog.total
  // Enrere: l'inici de l'actual si ja fa una estona que ha començat; si no, el de l'anterior.
  const cur = [...shown].reverse().find((o) => o.t0 <= t + 1e-6)
  if (!cur) return 0
  if (t - cur.t0 > Math.min(0.5, (cur.t1 - cur.t0) / 4)) return cur.t0
  return [...shown].reverse().find((o) => o.t0 < cur.t0 - 1e-6)?.t0 ?? 0
}

/** Fins on s'ha tallat el mapa d'alçades. */
export interface SimCursor {
  t: number
  fin: number
}

/**
 * Porta el mapa d'alçades al temps `t`: endavant, només el que s'ha tallat des de l'última vegada; enrere, de zero.
 * Retorna si s'ha hagut de refer tot.
 */
export function advanceSim(hf: Heightfield, prog: SimProgram, cur: SimCursor, t: number): boolean {
  let rebuilt = false
  if (t < cur.t - 1e-9) {
    resetHeightfield(hf)
    cur.t = 0
    cur.fin = 0
    rebuilt = true
  }
  if (t > cur.t) {
    for (let k = moveAt(prog, cur.t); k < prog.moves.length; k++) {
      const m = prog.moves[k]!
      if (m.t0 >= t) break
      if (m.kind !== "cut") continue
      stampSegment(hf, lerp(m, Math.max(cur.t, m.t0)), lerp(m, Math.min(t, m.t1)), m.r, m.ball, m.relief)
    }
  }
  while (cur.fin < prog.finished.length && prog.finished[cur.fin]!.t <= t) tintPolygon(hf, prog.finished[cur.fin++]!.outline)
  cur.t = Math.max(cur.t, t)
  return rebuilt
}
