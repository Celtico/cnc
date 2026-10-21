import { bounds, bulgeOf, ccw, ccwB, flatten, meshWorldTriangles, movePocket, reliefWorldTriangles, pocketBounds, pointInPolygon, rasterDepth, polygonArea, polygonTouchesRect, refSection, signedArea, type BPt, type Composition, type Cutout, type Panel, type RefObject, type Vec3 } from "../model"
import { buildModule } from "./buildModule"
import { normalizePanel } from "./buildCabinet"
import { toLocal } from "./geometry"
import { modulePlacements, refOnPanel } from "../model"
import { pc } from "./polygonClip"
import type { BuildWarning } from "./buildModule"

type Box = { min: Vec3; max: Vec3 }
const num = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")

/** Eix normal d'una peça (0 = x, 1 = y, 2 = z): el del gruix. */
function normalIndex(p: Panel): 0 | 1 | 2 {
  const z = p.placement.zAxis
  const a = [Math.abs(z[0]), Math.abs(z[1]), Math.abs(z[2])]
  return a[0]! >= a[1]! && a[0]! >= a[2]! ? 0 : a[1]! >= a[2]! ? 1 : 2
}

/** L'objecte i la caixa de la peça es toquen (amb la secció real: rodona o de perfil). */
export function refTouchesBox(o: RefObject, b: Box, tol = 0.5): boolean {
  const sec = refSection(o)
  if (sec.range[1] <= b.min[sec.a]! + tol || b.max[sec.a]! <= sec.range[0] + tol) return false
  const { u, v } = sec
  if (sec.circle) {
    const { cu, cv, r } = sec.circle
    const du = Math.max(b.min[u]! - cu, 0, cu - b.max[u]!)
    const dv = Math.max(b.min[v]! - cv, 0, cv - b.max[v]!)
    return du * du + dv * dv < (r - tol) * (r - tol)
  }
  return polygonTouchesRect(sec.poly, b.min[u]!, b.min[v]!, b.max[u]!, b.max[v]!, tol)
}

interface RefCutProblem {
  refId: string
  panel: Panel
  message: string
  options?: BuildWarning["options"]
  /** El tall se l'ha menjada sencera (la peça es queda com era: qui crida decideix què en fa). */
  eaten?: boolean
}

/** Què es pot fer amb un tall que la CNC no fa (un buidat amb forma, un tall de costat). */
const noCncOptions = (o: RefObject): NonNullable<BuildWarning["options"]> => [
  { text: "Fer que travessi la peça de cara a cara: queda com un forat o un tall passant, que la CNC sí fa.", where: o.id.startsWith("part:") ? "partPosition" : "refPosition" },
  { text: "Deixar-lo així i fer-lo a mà, o amb un programa de CAM 3D a partir del STEP (que ja porta la forma)." },
]

/**
 * Objectes que tallen: a cada peça que travessen en la seva direcció (`axis`, per defecte cap
 * a la paret) hi fan un forat passant amb la seva secció: cercle (cilindre), rectangle (caixa)
 * o polígon (perfil). Si arribaria a la vora de la peça (seria un rebaix del contorn) no es
 * fa i es retorna com a problema. Modifica les peces (afegeix `cutouts`).
 */
export function applyRefCuts(panels: Panel[], refs: RefObject[], boxOf: (p: Panel) => Box, isExtra?: (p: Panel) => boolean, added?: Panel[], hits?: Set<string>): RefCutProblem[] {
  const problems: RefCutProblem[] = []
  const r1 = (v: number) => Math.round(v * 10) / 10
  const firstNew = added?.length ?? 0
  for (const o of refs) {
    if (o.effect !== "cut") continue
    const sec = refSection(o)
    for (const p of panels) {
      const b = boxOf(p)
      // Forma lliure (l'editor de malla): el que se'n pot fresar des de la cara per on entra, en qualsevol peça que toqui.
      if (o.shape === "mesh" || o.shape === "image") {
        if (!(o.shape === "mesh" ? o.mesh : o.image) || !refTouchesBox(o, b)) continue
        hits?.add(o.id)
        const msg = meshCut(o, p)
        if (msg && !(isExtra?.(p) ?? false)) problems.push({ refId: o.id, panel: p, message: msg })
        continue
      }
      // Només talla les peces que travessa en la seva direcció (un tub cap a la paret forada
      // el fons, no el cantell dels prestatges; un desguàs vertical, la base i els prestatges).
      if (normalIndex(p) !== sec.a) {
        // De costat: les peces lliures que tallen, sempre (booleà si cal). Els objectes de referència (una columna de
        // la casa), només si la travessen de cara a cara amb secció recta (el fons i els laterals d'un moble al voltant
        // d'una columna quadrada): un tub cap a la paret no forada el cantell dels prestatges.
        if (!refTouchesBox(o, b)) continue
        hits?.add(o.id)
        const isPart = o.id.startsWith("part:")
        const side = sidewaysCut(o, sec, p, b, isExtra?.(p) ?? false, !isPart, added)
        if (side) problems.push({ refId: o.id, panel: p, message: side, ...(side.includes("pel cantell") ? { options: noCncOptions(o) } : {}), ...(side.includes(EATEN) ? { eaten: true } : {}) })
        continue
      }
      if (!refTouchesBox(o, b)) continue
      hits?.add(o.id)
      // No travessa tot el gruix (per decisió de l'usuari, 2026-10-17: «que no foradi si no traspassa»): un buidat de la
      // seva fondària des de la cara per on entra, no un forat passant.
      const n0 = b.min[sec.a]!, n1 = b.max[sec.a]!
      const lo = Math.max(sec.range[0], n0), hi = Math.min(sec.range[1], n1)
      if (hi - lo < 0.5) continue
      if (lo > n0 + 0.5 || hi < n1 - 0.5) {
        const blind = blindCut(o, sec, p, lo, hi, n0, n1, isExtra?.(p) ?? false)
        if (blind) problems.push({ refId: o.id, panel: p, message: blind, options: noCncOptions(o) })
        continue
      }
      const mid = (b.min[sec.a]! + b.max[sec.a]!) / 2
      const local = (pu: number, pv: number): [number, number] => {
        const q: [number, number, number] = [0, 0, 0]
        q[sec.u] = pu
        q[sec.v] = pv
        q[sec.a] = mid
        const l = toLocal(p, q)
        return [l[0], l[1]]
      }
      let cut: Cutout
      let pts: [number, number][]
      if (sec.circle) {
        const c = local(sec.circle.cu, sec.circle.cv)
        const r = sec.circle.r
        cut = { kind: "circle", x: c[0], y: c[1], diameter: r1(2 * r), tag: "ref" }
        pts = [[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]]
      } else {
        pts = sec.poly.map(([pu, pv]) => local(pu, pv))
        if (sec.outline) {
          // Contorn exacte (amb arcs) a les coordenades de la peça. Si el pas (u, v) → peça
          // fa de mirall, els arcs giren al revés.
          const mirror = Math.sign(signedArea(pts)) !== Math.sign(signedArea(sec.poly))
          const outline = sec.outline.map((q): BPt => {
            const [x, y] = local(q[0], q[1])
            const b = bulgeOf(q) * (mirror ? -1 : 1)
            return b ? [r1(x), r1(y), b] : [r1(x), r1(y)]
          })
          cut = { kind: "polygon", points: ccwB(outline), tag: "ref" }
        } else {
          const bb = bounds(pts)
          cut = { kind: "rect", x: bb.x0, y: bb.y0, w: r1(bb.x1 - bb.x0), h: r1(bb.y1 - bb.y0), tag: "ref" }
        }
      }
      const bb = bounds(pts)
      if (bb.x0 < 1 || bb.y0 < 1 || bb.x1 > p.length - 1 || bb.y1 > p.width - 1) {
        // Arriba a la vora (una columna a la cantonada): la peça es retalla amb la forma de l'objecte (per decisió de
        // l'usuari, 2026-10-14: «el moble s'ha d'adaptar a la columna»). Un cercle va com a polígon fi.
        const ring: [number, number][] = sec.circle
          ? Array.from({ length: 64 }, (_, i) => {
              const t = (i / 64) * 2 * Math.PI
              const c = local(sec.circle!.cu, sec.circle!.cv)
              return [c[0] + sec.circle!.r * Math.cos(t), c[1] + sec.circle!.r * Math.sin(t)] as [number, number]
            })
          : sec.outline
            ? flatten(cut.kind === "polygon" ? cut.points : [])
            : [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]]
        const msg = notch(p, ring, added)
        if (msg) problems.push({ refId: o.id, panel: p, message: `«${o.name}» ${msg}`, eaten: true })
        continue
      }
      p.cutouts = [...(p.cutouts ?? []), cut]
    }
  }
  // Un tros nou amb el nom d'una peça que ja hi era (un llistó que ja s'havia partit en «-2»): el número següent lliure.
  if (added) {
    const taken = new Set(panels.map((p) => p.id))
    for (const q of added.slice(firstNew)) {
      if (taken.has(q.id)) {
        const stem = q.id.replace(/-\d+$/, "")
        let k = 2
        while (taken.has(`${stem}-${k}`)) k++
        q.id = `${stem}-${k}`
      }
      taken.add(q.id)
    }
  }
  return problems
}

/**
 * Els passacables dels mòduls (versió anterior) passen a ser objectes que tallen: un cilindre
 * (o una caixa, si era rectangular) al mateix lloc, que travessa només aquella peça.
 */
export function migrateCableHoles(comp: Composition, boxOf: (p: Panel) => Box): Composition {
  if (!comp.modules.some((m) => m.extras.cableHoles.length)) return comp
  const places = modulePlacements(comp)
  const refs: RefObject[] = [...comp.references]
  const modules = comp.modules.map((m, i) => {
    if (!m.extras.cableHoles.length) return m
    const at = places[i]!
    const { panels } = buildModule({ ...m, extras: { ...m.extras, cableHoles: [] } })
    m.extras.cableHoles.forEach((h0, k) => {
      // Els que seguien un objecte (només durant un dia) es queden on era l'objecte.
      const follow = h0.ref ? comp.references.find((r) => r.id === h0.ref) : undefined
      const h = follow ? { ...h0, ...refOnPanel(follow, h0.panel, at), w: h0.w, h: h0.h } : h0
      const target =
        h.panel === "left" ? panels.find((p) => p.id === "side-left")
        : h.panel === "right" ? panels.find((p) => p.id === "side-right")
        : panels.find((p) => p.role === h.panel)
      if (!target) return
      const b0 = boxOf(target)
      const b: Box = { min: [b0.min[0] + at.x, b0.min[1] + at.y, b0.min[2]], max: [b0.max[0] + at.x, b0.max[1] + at.y, b0.max[2]] }
      // Centre del forat (coordenades de la composició) i eix normal de la peça.
      const c: [number, number, number] =
        h.panel === "back" ? [at.x + h.x, at.y + h.y, 0]
        : h.panel === "top" || h.panel === "bottom" ? [at.x + h.x, 0, h.y]
        : [0, at.y + h.y, h.x]
      const n = h.panel === "back" ? 2 : h.panel === "top" || h.panel === "bottom" ? 1 : 0
      const rect = h.shape === "rect"
      // Mida en cada eix: [u, v] del passacables en les dues direccions del pla.
      const su = rect ? (h.w ?? h.diameter) : h.diameter
      const sv = rect ? (h.h ?? h.diameter) : h.diameter
      const size: [number, number, number] = [0, 0, 0]
      const axes: [number, number] = n === 2 ? [0, 1] : n === 1 ? [0, 2] : [2, 1]
      size[axes[0]] = su
      size[axes[1]] = sv
      size[n] = b.max[n]! - b.min[n]! + 2
      const lo: [number, number, number] = [c[0] - size[0] / 2, c[1] - size[1] / 2, c[2] - size[2] / 2]
      lo[n] = b.min[n]! - 1
      refs.push({
        id: `${m.id}-cable${k + 1}`,
        name: rect ? `Passacables ${su} × ${sv}` : `Passacables Ø${h.diameter}`,
        w: size[0],
        h: size[1],
        d: size[2],
        x: Math.round(lo[0] * 10) / 10,
        y: Math.round(lo[1] * 10) / 10,
        z: Math.round(lo[2] * 10) / 10,
        effect: "cut",
        // La direcció sempre (també els rectangulars: sense, anaven en z i no tallaven la tapa ni els laterals).
        axis: (["x", "y", "z"] as const)[n],
        ...(rect ? {} : { shape: "cylinder" as const }),
      })
    })
    return { ...m, extras: { ...m.extras, cableHoles: [] } }
  })
  return { ...comp, modules, references: refs }
}

type Section = ReturnType<typeof refSection>

/** Intervals (en e) on el polígon talla la recta n = `at`; `ni` = índex de n al punt (0 o 1). */
function slice(poly: [number, number][], ni: 0 | 1, at: number): [number, number][] {
  const ei = ni === 0 ? 1 : 0
  const xs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!
    if ((p[ni] <= at) === (q[ni] <= at)) continue
    const t = (at - p[ni]) / (q[ni] - p[ni])
    xs.push(p[ei] + t * (q[ei] - p[ei]))
  }
  xs.sort((a, b) => a - b)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i]!, xs[i + 1]!])
  return out
}

function intersectIntervals(a: [number, number][], b: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const [a0, a1] of a) for (const [b0, b1] of b) {
    const lo = Math.max(a0, b0), hi = Math.min(a1, b1)
    if (hi - lo > 0.01) out.push([lo, hi])
  }
  return out
}
const total = (iv: [number, number][]) => iv.reduce((s, [a, b]) => s + b - a, 0)

/**
 * Objecte que talla i travessa la peça de costat (la seva direcció és al pla de la peça):
 *  - Si la travessa de cara a cara amb una secció recta (una caixa, una barra quadrada), el
 *    tall és un rectangle al pla de la peça: forat o, a les peces lliures, osca del contorn.
 *  - Si no (un tub que passa pel cantell d'un bloc, un tall que no arriba d'una cara a l'altra),
 *    és un booleà en 3D: es resta al 3D (`solidCuts`) i, si la peça és de CNC, s'avisa que no es
 *    mecanitza. Retorna el missatge d'avís, si n'hi ha.
 */
function sidewaysCut(o: RefObject, sec: Section, p: Panel, b: Box, extra: boolean, exactOnly = false, added?: Panel[]): string | undefined {
  const n = normalIndex(p)
  const ni: 0 | 1 = n === sec.u ? 0 : 1
  const e = ni === 0 ? sec.v : sec.u
  const n0 = b.min[n]!, n1 = b.max[n]!
  const a0 = Math.max(sec.range[0], b.min[sec.a]!), a1 = Math.min(sec.range[1], b.max[sec.a]!)
  if (a1 - a0 < 0.5) return
  // Llesques a les dues cares, al mig i a cada vèrtex de la secció que cau dins del gruix.
  const levels = [n0 + 0.01, (n0 + n1) / 2, n1 - 0.01, ...sec.poly.map((q) => q[ni]).filter((t) => t > n0 && t < n1)]
  const slices = levels.map((t) => slice(sec.poly, ni, t))
  const full = slices.reduce(intersectIntervals)
  const eRange: [number, number] = [b.min[e]!, b.max[e]!]
  const clip = (iv: [number, number][]) => intersectIntervals(iv, [eRange])
  const exact = full.length > 0 && slices.every((sl) => Math.abs(total(clip(sl)) - total(clip(full))) < 0.5)
  if (exact) {
    const rects = clip(full).map(([e0, e1]) => {
      const corner = (av: number, ev: number) => {
        const q: [number, number, number] = [0, 0, 0]
        q[sec.a] = av
        q[e] = ev
        q[n] = (n0 + n1) / 2
        const l = toLocal(p, q)
        return [l[0], l[1]] as [number, number]
      }
      const pts = [corner(a0, e0), corner(a1, e0), corner(a1, e1), corner(a0, e1)]
      return bounds(pts)
    })
    for (const bb of rects) {
      const r1 = (v: number) => Math.round(v * 10) / 10
      if (bb.x0 >= 1 && bb.y0 >= 1 && bb.x1 <= p.length - 1 && bb.y1 <= p.width - 1) {
        p.cutouts = [...(p.cutouts ?? []), { kind: "rect", x: r1(bb.x0), y: r1(bb.y0), w: r1(bb.x1 - bb.x0), h: r1(bb.y1 - bb.y0), tag: "ref" }]
        continue
      }
      // Arriba a la vora: osca del contorn (també a les peces dels mòduls: el moble s'adapta a la columna).
      const msg = notch(p, [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]], added)
      if (msg) return `«${o.name}» ${msg}`
    }
    return
  }
  // Un objecte de referència de costat sense secció recta (un tub rodó pel fons): no es fa res (com abans).
  if (exactOnly) return
  // Booleà en 3D: el prisma de l'objecte en coordenades de la peça.
  const start = sec.poly.map(([pu, pv]) => {
    const q: [number, number, number] = [0, 0, 0]
    q[sec.u] = pu
    q[sec.v] = pv
    q[sec.a] = sec.range[0]
    return toLocal(p, q)
  })
  const q0: [number, number, number] = [0, 0, 0]
  const q1: [number, number, number] = [0, 0, 0]
  q1[sec.a] = sec.range[1] - sec.range[0]
  const l0 = toLocal(p, q0), l1 = toLocal(p, q1)
  p.solidCuts = [...(p.solidCuts ?? []), { points: start, dir: [l1[0] - l0[0], l1[1] - l0[1], l1[2] - l0[2]] }]
  if (extra) return
  return `«${o.name}» travessa ${p.label} pel cantell (no de cara a cara): es veu al 3D, però a la CNC no es pot fer com a forat passant (seria un forat de cantell o un buidat).`
}

/**
 * Un objecte que entra per una cara i no la travessa (per decisió de l'usuari, 2026-10-17: «que no foradi si no
 * traspassa»; «buidats de qualsevol forma vagin al programa de la CNC»): un **forat** de la seva fondària si és un cilindre
 * fins a Ø35 de fons pla, una **ranura** si és una caixa recta, i si no un **buidat** (`Panel.pockets`) amb el contorn de
 * l'objecte (perfil, cercle gros) i, amb `round`, el fons arrodonit (una pica). Un de fons pla que surt per la vora queda
 * retallat a la peça (un rebaix obert). El que no entra per cap cara (tot dins del gruix) o el d'un fons arrodonit que surt
 * per la vora es veu al 3D (`solidCuts`) i s'avisa: la CNC no el fa.
 */
function blindCut(o: RefObject, sec: Section, p: Panel, lo: number, hi: number, n0: number, n1: number, extra: boolean): string | undefined {
  const r1 = (v: number) => Math.round(v * 10) / 10
  const depth = r1(hi - lo)
  const fromMax = hi >= n1 - 0.5
  const fromMin = lo <= n0 + 0.5
  const round = o.round && o.round > 0 ? o.round : undefined
  const at = (pu: number, pv: number, av: number): Vec3 => {
    const q: [number, number, number] = [0, 0, 0]
    q[sec.u] = pu
    q[sec.v] = pv
    q[sec.a] = av
    return toLocal(p, q)
  }
  if (fromMax || fromMin) {
    const surface = fromMax ? n1 : n0
    const faceZ = at(0, 0, surface)[2]
    const face: "A" | "B" = Math.abs(faceZ - p.thickness) < 0.5 ? "A" : "B"
    const pts = sec.poly.map(([pu, pv]) => at(pu, pv, surface))
    const bb = bounds(pts.map((q) => [q[0], q[1]] as [number, number]))
    const inside = bb.x0 >= 1 && bb.y0 >= 1 && bb.x1 <= p.length - 1 && bb.y1 <= p.width - 1
    if (inside && !round && sec.circle && 2 * sec.circle.r <= 35 + 0.01) {
      const c = at(sec.circle.cu, sec.circle.cv, surface)
      p.holes = [...p.holes, { x: r1(c[0]), y: r1(c[1]), diameter: r1(2 * sec.circle.r), depth, face, tag: "ref" }]
      return
    }
    if (inside && !round && !sec.outline && sec.poly.length === 4 && isAxisRect(pts)) {
      p.grooves = [...p.grooves, { x: r1(bb.x0), y: r1(bb.y0), w: r1(bb.x1 - bb.x0), h: r1(bb.y1 - bb.y0), depth, face, tag: "ref" }]
      return
    }
    // El contorn a la cara, en coordenades de la peça (amb arcs).
    let outline: BPt[]
    if (sec.circle) {
      const c = at(sec.circle.cu, sec.circle.cv, surface)
      const r = sec.circle.r
      // Quatre quarts d'arc (bulge = tan(22,5°)).
      const q = Math.tan(Math.PI / 8)
      outline = [[r1(c[0] + r), r1(c[1]), q], [r1(c[0]), r1(c[1] + r), q], [r1(c[0] - r), r1(c[1]), q], [r1(c[0]), r1(c[1] - r), q]]
    } else if (sec.outline) {
      const loc = pts.map((q) => [q[0], q[1]] as [number, number])
      const mirror = Math.sign(signedArea(loc)) !== Math.sign(signedArea(sec.poly))
      outline = sec.outline.map((q): BPt => {
        const l = at(q[0], q[1], surface)
        const b = bulgeOf(q) * (mirror ? -1 : 1)
        return b ? [r1(l[0]), r1(l[1]), b] : [r1(l[0]), r1(l[1])]
      })
    } else outline = pts.map((q) => [r1(q[0]), r1(q[1])] as BPt)
    outline = ccwB(outline)
    if (!inside && !round) {
      // Rebaix obert: el contorn retallat a la peça.
      const clipped = pc.intersection([flatten(outline)], [[[0, 0], [p.length, 0], [p.length, p.width], [0, p.width]]])
      const ring = clipped.length === 1 && clipped[0]!.length === 1 ? clipped[0]![0]!.slice(0, -1) : null
      if (ring && ring.length >= 3 && polygonArea(ring as [number, number][]) > 1) outline = ccwB(ring.map(([x, y]) => [r1(x), r1(y)] as BPt))
      else outline = []
    }
    if (flatten(outline).length >= 3 && (inside || !round)) {
      p.pockets = [...(p.pockets ?? []), { points: outline, depth, face, ...(round ? { round } : {}), tag: "ref" }]
      return
    }
  }
  const start = sec.poly.map(([pu, pv]) => at(pu, pv, lo))
  const a0 = at(0, 0, lo), a1 = at(0, 0, hi)
  p.solidCuts = [...(p.solidCuts ?? []), { points: start, dir: [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]] }]
  if (extra) return
  return `«${o.name}» entra ${num(depth)} mm a ${p.label} sense travessar-la: es veu al 3D, però a la CNC aquest buidat (${fromMax || fromMin ? "amb el fons arrodonit fins al cantell" : "dins del gruix"}) no es fa.`
}

/**
 * Una forma lliure que entra en una peça: el **relleu** que se'n pot fresar des de la cara per on entra (per decisió de
 * l'usuari, 2026-10-17: «fer el tall a una peça de fusta en comptes de fer talls amb diferents peces»). Els triangles de la
 * forma passen a coordenades de la peça i es rasteritzen (`rasterDepth`): cada punt es buida fins al punt més baix de la
 * forma (el que quedaria amagat sota una part que sobresurt, també: la fresa ve de dalt). Un buidat amb mapa
 * (`Pocket.map`). Retorna un avís si no es pot fer.
 */
function meshCut(o: RefObject, p: Panel): string | undefined {
  // Rasteritzar la forma és el més lent de reconstruir el moble (una imatge fa mig milió de triangles): la mateixa forma
  // al mateix lloc de la mateixa peça es treu de la memòria.
  const key = JSON.stringify([o.shape, o.x, o.y, o.z, o.w, o.h, o.d, o.mesh ?? null, o.image ?? null, o.name, p.label, p.length, p.width, p.thickness, p.placement])
  let hit = MESH_CUTS.get(key)
  if (!hit) {
    hit = meshCutUncached(o, p)
    MESH_CUTS.set(key, hit)
    if (MESH_CUTS.size > 32) MESH_CUTS.delete(MESH_CUTS.keys().next().value!)
  }
  if (hit.pocket) p.pockets = [...(p.pockets ?? []), hit.pocket]
  return hit.msg
}

/** Els últims relleus calculats (el buidat i l'avís). */
const MESH_CUTS = new Map<string, { pocket?: NonNullable<Panel["pockets"]>[number]; msg?: string }>()

function meshCutUncached(o: RefObject, p: Panel): { pocket?: NonNullable<Panel["pockets"]>[number]; msg?: string } {
  const world = o.shape === "image" ? reliefWorldTriangles(o) : meshWorldTriangles(o)
  const tris = world.map((t) => t.map((q) => toLocal(p, q)) as [Vec3, Vec3, Vec3])
  let zmin = Infinity, zmax = -Infinity
  for (const t of tris) for (const q of t) {
    zmin = Math.min(zmin, q[2])
    zmax = Math.max(zmax, q[2])
  }
  // Un relleu d'imatge és tot el que hi ha per sobre de la superfície dins de la caixa: arriba fins a dalt de la caixa.
  if (o.shape === "image") {
    for (const x of [o.x, o.x + o.w]) for (const z of [o.z, o.z + o.d]) zmax = Math.max(zmax, toLocal(p, [x, o.y + o.h, z])[2])
  }
  const T = p.thickness
  const face: "A" | "B" | null = zmax >= T - 0.5 && zmin < T - 0.05 ? "A" : zmin <= 0.5 && zmax > 0.05 ? "B" : null
  if (!face) return { msg: zmax > 0 && zmin < T ? `«${o.name}» queda dins del gruix de ${p.label} sense sortir per cap cara: no es pot fresar.` : undefined }
  const area = p.length * p.width
  // Una imatge porta detall fi: graella d'1 mm (si no passa de 400.000 punts).
  const step = Math.max(o.shape === "image" ? 1 : 2, Math.sqrt(area / (o.shape === "image" ? 400_000 : 150_000)))
  const map = rasterDepth(tris, face, T, step, { x0: 0, y0: 0, x1: p.length, y1: p.width })
  if (!map) return {}
  const x1 = map.x0 + (map.nx - 1) * step, y1 = map.y0 + (map.ny - 1) * step
  const depth = map.d.reduce((a, v) => (v > a ? v : a), 0)
  const pocket = { points: [[map.x0, map.y0], [x1, map.y0], [x1, y1], [map.x0, y1]] as [number, number][], depth, face, map: { ...map, step }, tag: "ref" as const }
  return { pocket, msg: depth >= T - 0.05 ? `«${o.name}» travessa ${p.label} en algun punt: a la CNC el buidat es deixa a la pell mínima.` : undefined }
}

/** Els quatre punts fan un rectangle alineat amb la peça (una ranura). */
function isAxisRect(pts: Vec3[]): boolean {
  return pts.every((q, i) => {
    const n = pts[(i + 1) % pts.length]!
    return Math.abs(q[0] - n[0]) < 0.01 || Math.abs(q[1] - n[1]) < 0.01
  })
}

/** El punt és sobre el contorn del polígon (a 0,05 mm d'algun costat). */
function onPolygon([x, y]: [number, number], poly: [number, number][]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]!, [bx, by] = poly[(i + 1) % poly.length]!
    const dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
    if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < 0.05) return true
  }
  return false
}

/** Els cantells d'una peça retallada a `bb`: el costat nou (el del tall, contra la columna) no es canteja. */
function cutEdges(p: Panel, bb: { x0: number; y0: number; x1: number; y1: number }): Panel["edges"] {
  return {
    left: p.edges.left && bb.x0 < 0.01,
    right: p.edges.right && bb.x1 > p.length - 0.01,
    bottom: p.edges.bottom && bb.y0 < 0.01,
    top: p.edges.top && bb.y1 > p.width - 0.01,
  }
}

/** La peça retallada al rectangle `bb` (coordenades locals): contorn, mecanitzats i origen des de la seva cantonada. */
function trimTo(p: Panel, bb: { x0: number; y0: number; x1: number; y1: number }): void {
  if (bb.x0 < 0.01 && bb.y0 < 0.01 && Math.abs(bb.x1 - p.length) < 0.01 && Math.abs(bb.y1 - p.width) < 0.01) return
  p.edges = cutEdges(p, bb)
  const q = (v: number) => Math.round(v * 100) / 100
  const sh = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: q(o.x - bb.x0), y: q(o.y - bb.y0) })
  const { origin: o, xAxis, yAxis } = p.placement
  p.placement = { ...p.placement, origin: [o[0] + bb.x0 * xAxis[0] + bb.y0 * yAxis[0], o[1] + bb.x0 * xAxis[1] + bb.y0 * yAxis[1], o[2] + bb.x0 * xAxis[2] + bb.y0 * yAxis[2]] }
  p.length = q(bb.x1 - bb.x0)
  p.width = q(bb.y1 - bb.y0)
  if (p.outline) p.outline = p.outline.map((v) => (v.length === 3 ? ([q(v[0] - bb.x0), q(v[1] - bb.y0), v[2]] as [number, number, number]) : ([q(v[0] - bb.x0), q(v[1] - bb.y0)] as [number, number])))
  p.holes = p.holes.map(sh)
  p.grooves = p.grooves.map(sh)
  if (p.pockets) p.pockets = p.pockets.map((k) => movePocket(k, -bb.x0, -bb.y0))
  if (p.rawSides) p.rawSides = p.rawSides.map(([x0, y0, x1, y1]) => [q(x0 - bb.x0), q(y0 - bb.y0), q(x1 - bb.x0), q(y1 - bb.y0)])
  if (p.cutouts) p.cutouts = p.cutouts.map((c) => (c.kind === "polygon" ? { ...c, points: c.points.map((v) => (v.length === 3 ? ([q(v[0] - bb.x0), q(v[1] - bb.y0), v[2]] as [number, number, number]) : ([q(v[0] - bb.x0), q(v[1] - bb.y0)] as [number, number]))) } : sh(c)))
}

/**
 * Resta un polígon (coordenades locals) del contorn de la peça. Si la parteix (una columna al mig del fons), cada tros
 * és una peça (`extra`, retallada a la seva mida i amb els seus forats i ranures). Retorna un avís si se la menja.
 */
const EATEN = "es menja tota la peça"

function notch(p: Panel, cutter: [number, number][], extra?: Panel[]): string | undefined {
  const base: [number, number][] = p.outline ? flatten(p.outline) : [[0, 0], [p.length, 0], [p.length, p.width], [0, p.width]]
  const res = pc.difference([base], [cutter])
  if (!res.length) return `${EATEN} ${p.label}.`
  const area = (poly: (typeof res)[number]) => polygonArea(poly[0] as [number, number][])
  const sorted = [...res].sort((a, b) => area(b) - area(a))
  const ringOf = (poly: (typeof res)[number]) => {
    const ring = (poly[0] as [number, number][]).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as [number, number])
    const last = ring[ring.length - 1]!
    if (ring.length > 1 && last[0] === ring[0]![0] && last[1] === ring[0]![1]) ring.pop()
    return ccw(ring)
  }
  const rings = sorted.map(ringOf)
  const original: Panel = { ...p, holes: [...p.holes], grooves: [...p.grooves] }
  // Res surt de la peça: els forats que queien a la part que s'ha tret (o hi toquen) fora; les ranures, retallades
  // (els trossos que queden rectangles) o fora. Amb trossos, cada forat va amb el tros on cau.
  const gone = (x: number, y: number) => pointInPolygon([x, y], cutter)
  const keepHoles = (holes: Panel["holes"], ring: [number, number][]) =>
    holes.filter((h) => {
      if (h.face === "edge") {
        if (gone(h.x, h.y)) return false
        // Un punt del cantell, un mil·límetre cap a dins de la peça.
        const ix = h.x + Math.sign(p.length / 2 - h.x) * (h.x <= 0.5 || h.x >= p.length - 0.5 ? 1 : 0)
        const iy = h.y + Math.sign(p.width / 2 - h.y) * (h.y <= 0.5 || h.y >= p.width - 0.5 ? 1 : 0)
        return rings.length === 1 || pointInPolygon([ix, iy], ring)
      }
      if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => gone(h.x + dx! * h.diameter / 2, h.y + dy! * h.diameter / 2))) return false
      return rings.length === 1 || pointInPolygon([h.x, h.y], ring)
    })
  const keepGrooves = (grooves: Panel["grooves"], ring: [number, number][]) =>
    grooves.flatMap((g) => {
      const rect: [number, number][] = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.h], [g.x, g.y + g.h]]
      const left = rings.length === 1 ? pc.difference([rect], [cutter]) : pc.intersection([rect], [ring])
      // Cada tros que queda (una ranura llarga que la columna parteix en dos), si és un rectangle.
      return left.flatMap((poly) => {
        if (poly.length !== 1) return []
        const pts = (poly[0] as [number, number][]).slice(0, -1)
        const bb = bounds(pts)
        const a = (bb.x1 - bb.x0) * (bb.y1 - bb.y0)
        return pts.length === 4 && Math.abs(a - polygonArea(pts)) < 0.5 ? [{ ...g, x: bb.x0, y: bb.y0, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 }] : []
      })
    })
  // Els trams nous (sobre la vora del tall, no sobre el contorn d'abans): sense cantell al 3D.
  const onBase = (a: [number, number], b: [number, number]) => onPolygon(a, base) && onPolygon(b, base) && onPolygon([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], base)
  const cutSides = (ring: [number, number][]) =>
    ring.flatMap((a, i) => {
      const b = ring[(i + 1) % ring.length]!
      return onBase(a, b) ? [] : [[a[0], a[1], b[0], b[1]] as [number, number, number, number]]
    })
  p.rawSides = [...(p.rawSides ?? []), ...cutSides(rings[0]!)]
  p.outline = rings[0]!
  p.holes = keepHoles(original.holes, rings[0]!)
  p.grooves = keepGrooves(original.grooves, rings[0]!)
  // Els buidats, amb el tros on cau el seu centre.
  const pocketIn = (ring: [number, number][]) => (original.pockets ?? []).filter((k) => {
    const b = pocketBounds(k)
    return pointInPolygon([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], ring)
  })
  if (original.pockets) p.pockets = pocketIn(rings[0]!)
  for (const h of sorted[0]!.slice(1)) p.cutouts = [...(p.cutouts ?? []), { kind: "polygon", points: ccw((h as [number, number][]).slice(0, -1)), tag: "ref" }]
  // Si el que queda ocupa menys que la peça (la columna se n'ha menjat una franja sencera), la peça es fa a la seva mida.
  if (sorted.length === 1) {
    trimTo(p, bounds(rings[0]!))
    return undefined
  }
  if (!extra) return `parteix ${p.label} en ${res.length} trossos (al 3D i al nesting només queda el més gran).`
  // Partida: el tros gran també es retalla a la seva mida (si no, el nesting reservaria tota la peça d'abans).
  trimTo(p, bounds(rings[0]!))
  // Els altres trossos: peces noves, a la seva mida (el contorn i els mecanitzats, des de la seva cantonada).
  sorted.slice(1).forEach((poly, i) => {
    const ring = rings[i + 1]!
    const bb = bounds(ring)
    const sh = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: Math.round((o.x - bb.x0) * 100) / 100, y: Math.round((o.y - bb.y0) * 100) / 100 })
    // Des de la peça d'abans (el tros gran ja s'ha retallat a la seva mida, amb un altre origen).
    const { origin: o, xAxis, yAxis } = original.placement
    // Un nom que no tingui cap altre tros (una peça partida per dues columnes ja té el seu «-2»).
    let k = i + 2
    while (extra.some((x) => x.id === `${p.id}-${k}`)) k++
    const piece: Panel = {
      ...original,
      id: `${p.id}-${k}`,
      label: `${p.label} (${k})`,
      length: Math.round((bb.x1 - bb.x0) * 100) / 100,
      width: Math.round((bb.y1 - bb.y0) * 100) / 100,
      edges: cutEdges(original, bb),
      rawSides: cutSides(ring).map(([x0, y0, x1, y1]) => [x0 - bb.x0, y0 - bb.y0, x1 - bb.x0, y1 - bb.y0] as [number, number, number, number]),
      outline: ring.map(([x, y]) => [Math.round((x - bb.x0) * 100) / 100, Math.round((y - bb.y0) * 100) / 100] as [number, number]),
      holes: keepHoles(original.holes, ring).map(sh),
      grooves: keepGrooves(original.grooves, ring).map(sh),
      ...(original.pockets ? { pockets: pocketIn(ring).map((k) => movePocket(k, -bb.x0, -bb.y0)) } : {}),
      placement: { ...p.placement, origin: [o[0] + bb.x0 * xAxis[0] + bb.y0 * yAxis[0], o[1] + bb.x0 * xAxis[1] + bb.y0 * yAxis[1], o[2] + bb.x0 * xAxis[2] + bb.y0 * yAxis[2]] },
    }
    delete piece.cutouts
    for (const h of poly.slice(1)) piece.cutouts = [...(piece.cutouts ?? []), { kind: "polygon", points: ccw((h as [number, number][]).slice(0, -1).map(([x, y]) => [x - bb.x0, y - bb.y0] as [number, number])), tag: "ref" }]
    extra.push(normalizePanel(piece))
  })
  return undefined
}
