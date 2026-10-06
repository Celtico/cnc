import {
  damagedImportMessage,
  flatten,
  isDamagedImport,
  isPendingImport,
  machiningProblems,
  partKindOf,
  planeAxes,
  pointInPolygon,
  signedArea,
  axisRect,
  type Cutout,
  type GenOp,
  type Groove,
  type HardwarePlacement,
  type Hole,
  type Panel,
  type PanelFitting,
  type PlacementTarget,
  type Pos,
  type Pt,
  type Vec3,
  type WorldAxis,
} from "../model"
import { edgeAt, r, toLocal } from "./geometry"

/**
 * Ferratges **col·locats a mà** (`Composition.hardwarePlacements`, millores v1 F4): les operacions del generador de
 * l'item (`HardwareItem.machining`) per a cada peça triada, al punt de referència i a cada repetició, passades a `Hole`,
 * `Groove` i `Cutout` de la peça (els exports no canvien). Pur.
 *
 * Seguretat (com els importats): **tot o res** per ferratge col·locat (si una operació no cap sencera a la peça —fora del
 * contorn, més fonda que el gruix—, cap de les seves operacions a cap peça, i avís `hardware`); un importat sense
 * confirmar, malmès, un «només 3D» sense operacions o un item amb una operació dolenta, cap forat i avís. Les operacions
 * d'un grup de l'item que no té peça triada no es fan (els grups «mirall» només si es trien expressament).
 */

export interface PlacementWarning {
  code: "hardware"
  message: string
  panelId?: string
  moduleId?: string
  partId?: string
}

const AXIS_INDEX: Record<WorldAxis, number> = { x: 0, y: 1, z: 2 }
const EPS = 0.01

/** Caixa d'una peça al moble. */
function boxOf(p: Panel): { min: Vec3; max: Vec3 } {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const cx of [0, p.length])
    for (const cy of [0, p.width])
      for (const cz of [0, p.thickness])
        for (let i = 0; i < 3; i++) {
          const v = o[i]! + cx * x[i]! + cy * y[i]! + cz * z[i]!
          min[i] = Math.min(min[i]!, v)
          max[i] = Math.max(max[i]!, v)
        }
  return { min, max }
}

/** Eix del moble més proper a un vector (la normal d'una peça). */
function axisOf(v: Vec3): WorldAxis {
  const a = v.map(Math.abs)
  return a[0]! >= a[1]! && a[0]! >= a[2]! ? "x" : a[1]! >= a[2]! ? "y" : "z"
}

/** El marc d'una peça per al generador: eixos P i Q del moble al seu pla, la caixa i el pas al sistema local. */
export interface PartFrame {
  panel: Panel
  n: WorldAxis
  p: WorldAxis
  q: WorldAxis
  box: { min: Vec3; max: Vec3 }
  /** (P, Q) del moble → (x, y) locals de la peça. */
  local: (pw: number, qw: number) => Pt
  /** Coordenada del moble al llarg de P o Q d'una posició (des d'un cantell, del mig o de la referència `ref`). */
  at: (axis: "p" | "q", pos: Pos, ref: number) => number
}

export function partFrame(panel: Panel): PartFrame {
  const n = axisOf(panel.placement.zAxis)
  const [p, q] = planeAxes(n)
  const box = boxOf(panel)
  const ip = AXIS_INDEX[p], iq = AXIS_INDEX[q], iN = AXIS_INDEX[n]
  const mid = (box.min[iN]! + box.max[iN]!) / 2
  const local = (pw: number, qw: number): Pt => {
    const w: [number, number, number] = [0, 0, 0]
    w[ip] = pw
    w[iq] = qw
    w[iN] = mid
    const l = toLocal(panel, w)
    return [l[0], l[1]]
  }
  const at = (axis: "p" | "q", pos: Pos, ref: number) => {
    const i = axis === "p" ? ip : iq
    const lo = box.min[i]!, hi = box.max[i]!
    return pos.from === "ref" ? ref + pos.at : pos.from === "min" ? lo + pos.at : pos.from === "max" ? hi - pos.at : (lo + hi) / 2 + pos.at
  }
  return { panel, n, p, q, box, local, at }
}

/** Els mecanitzats que fa una operació a la peça (coordenades locals), o per què no hi cap. */
export interface OpResult {
  holes: Hole[]
  grooves: Groove[]
  cutouts: Cutout[]
  /** Extensió de l'operació al marc del moble (P, Q), per al volum del 3D. */
  span: [number, number, number, number]
}

const TAG = "fitting"

/** Rectangle local a partir de dos punts (P, Q) del moble. */
function localRect(f: PartFrame, p0: number, q0: number, p1: number, q1: number): { x: number; y: number; w: number; h: number } {
  const [ax, ay] = f.local(p0, q0)
  const [bx, by] = f.local(p1, q1)
  const x = Math.min(ax, bx), y = Math.min(ay, by)
  return { x: r(x), y: r(y), w: r(Math.abs(bx - ax)), h: r(Math.abs(by - ay)) }
}

/** El punt local és dins de la peça (rectangle i contorn), amb un marge `m` al rectangle. */
function inside(panel: Panel, outline: Pt[] | null, [x, y]: Pt, m = 0): boolean {
  if (x < m - EPS || y < m - EPS || x > panel.length - m + EPS || y > panel.width - m + EPS) return false
  return !outline || pointInPolygon([x, y], outline) || onOutline(outline, [x, y])
}
function onOutline(poly: Pt[], [x, y]: Pt): boolean {
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]!
    const [bx, by] = poly[(i + 1) % poly.length]!
    const len = Math.hypot(bx - ax, by - ay)
    if (len < 1e-9) continue
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len)))
    if (Math.hypot(ax + t * (bx - ax) - x, ay + t * (by - ay) - y) < 0.05) return true
  }
  return false
}

/**
 * Una operació a la peça amb el punt de referència a (`refP`, `refQ`) del moble. `Error` (amb el perquè) si no hi cap
 * sencera: fora de la peça, més fonda que el gruix o un forat de cantell que no és sobre el cantell.
 */
export function applyGenOp(op: GenOp, f: PartFrame, refP: number, refQ: number): OpResult | { error: string } {
  const panel = f.panel
  const T = panel.thickness
  const outline = panel.outline ? flatten(panel.outline) : null
  const cp = f.at("p", op.p, refP)
  const cq = f.at("q", op.q, refQ)
  const out: OpResult = { holes: [], grooves: [], cutouts: [], span: [cp, cq, cp, cq] }
  const n = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")
  if (!op.through && op.face !== "edge" && op.depth >= T - EPS) return { error: `fondària de ${n(op.depth)} mm en una peça de ${n(T)} mm (fes-la passant)` }
  const face = op.face === "B" ? "B" : "A"
  if (op.kind === "drill" && op.face === "edge") {
    const d = op.d ?? 0
    if (d >= T - EPS) return { error: `forat de cantell de Ø${n(d)} en una peça de ${n(T)} mm` }
    if (outline) return { error: "forat de cantell en una peça amb forma" }
    const ip = AXIS_INDEX[f.p], iq = AXIS_INDEX[f.q]
    const pw = op.edge === "pmin" ? f.box.min[ip]! : op.edge === "pmax" ? f.box.max[ip]! : cp
    const qw = op.edge === "qmin" ? f.box.min[iq]! : op.edge === "qmax" ? f.box.max[iq]! : cq
    const [x, y] = f.local(pw, qw)
    const edge = edgeAt(panel, [x, y, T / 2])
    if (!edge) return { error: "el forat de cantell no és sobre el cantell" }
    const along = edge === "left" || edge === "right" ? y : x
    const span = edge === "left" || edge === "right" ? panel.width : panel.length
    const into = edge === "left" || edge === "right" ? panel.length : panel.width
    if (along < d / 2 - EPS || along > span - d / 2 + EPS) return { error: "el forat de cantell surt de la peça" }
    if (op.depth >= into - EPS) return { error: `forat de cantell de ${n(op.depth)} mm de fondària` }
    out.holes.push({ x: r(x), y: r(y), diameter: d, depth: op.depth, face: "edge", edge, tag: TAG })
    out.span = [pw, qw, pw, qw]
    return out
  }
  if (op.kind === "drill") {
    const d = op.d ?? 0
    const [x, y] = f.local(cp, cq)
    if (!inside(panel, outline, [x, y], d / 2)) return { error: `forat Ø${n(d)} fora de la peça` }
    if (outline) for (let k = 0; k < 8; k++) if (!inside(panel, outline, [x + (d / 2) * Math.cos((k * Math.PI) / 4), y + (d / 2) * Math.sin((k * Math.PI) / 4)])) return { error: `forat Ø${n(d)} fora del contorn` }
    if (op.through) out.cutouts.push({ kind: "circle", x: r(x), y: r(y), diameter: d, tag: TAG })
    else out.holes.push({ x: r(x), y: r(y), diameter: d, depth: op.depth, face, tag: TAG })
    out.span = [cp - d / 2, cq - d / 2, cp + d / 2, cq + d / 2]
    return out
  }
  // Rectangles: ranura, caixera i contorn rectangular cec.
  let rect: [number, number, number, number] | null = null
  let poly: [number, number][] | null = null
  if (op.kind === "groove") {
    const w = op.w ?? 0
    const ia = AXIS_INDEX[op.along === "q" ? f.q : f.p]
    const [a0, a1] = op.full ? [f.box.min[ia]!, f.box.max[ia]!] : [(op.along === "q" ? cq : cp) - (op.len ?? 0) / 2, (op.along === "q" ? cq : cp) + (op.len ?? 0) / 2]
    rect = op.along === "q" ? [cp - w / 2, a0, cp + w / 2, a1] : [a0, cq - w / 2, a1, cq + w / 2]
  } else if (op.kind === "pocket") {
    const w = op.w ?? 0, h = op.h ?? 0
    rect = [cp - w / 2, cq - h / 2, cp + w / 2, cq + h / 2]
  } else {
    const pts = (op.points ?? []).map(([dp, dq]) => [cp + dp, cq + dq] as [number, number])
    const ar = op.through ? null : axisRect(pts)
    if (ar) rect = ar
    else poly = pts
  }
  if (rect) {
    const [p0, q0, p1, q1] = rect
    const lr = localRect(f, p0, q0, p1, q1)
    const corners: Pt[] = [[lr.x, lr.y], [lr.x + lr.w, lr.y], [lr.x + lr.w, lr.y + lr.h], [lr.x, lr.y + lr.h]]
    if (!(lr.w > 0 && lr.h > 0)) return { error: "mida zero" }
    if (corners.some((c) => !inside(panel, outline, c))) return { error: `${op.kind === "groove" ? "ranura" : op.kind === "pocket" ? "caixera" : "contorn"} fora de la peça` }
    if (op.through) out.cutouts.push({ kind: "rect", ...lr, tag: TAG })
    else out.grooves.push({ ...lr, depth: op.depth, face, tag: TAG })
    out.span = [p0, q0, p1, q1]
    return out
  }
  const local = poly!.map(([pw, qw]) => f.local(pw, qw))
  if (local.some((c) => !inside(panel, outline, c))) return { error: "contorn fora de la peça" }
  const ccw = signedArea(local) < 0 ? [...local].reverse() : local
  out.cutouts.push({ kind: "polygon", points: ccw.map(([x, y]) => [r(x), r(y)] as [number, number]), tag: TAG })
  const ps = poly!.map((c) => c[0]), qs = poly!.map((c) => c[1])
  out.span = [Math.min(...ps), Math.min(...qs), Math.max(...ps), Math.max(...qs)]
  return out
}

/** On és la peça d'un objectiu a la llista de peces del moble: id de la peça al moble. */
export function targetPanelId(t: PlacementTarget): string | null {
  if (t.freePart) return `part:${t.freePart}`
  if (t.module && t.panel) return `${t.module}:${t.panel}`
  return null
}

/** Les posicions del punt de referència (una per repetició) al moble, (P, Q). */
function refPoints(pl: HardwarePlacement, f: PartFrame): [number, number][] {
  const p0 = f.at("p", pl.p.from === "ref" ? { from: "min", at: pl.p.at } : pl.p, 0)
  const q0 = f.at("q", pl.q.from === "ref" ? { from: "min", at: pl.q.at } : pl.q, 0)
  const count = pl.repeat?.count ?? 1
  const step = pl.repeat?.spacing ?? 0
  return Array.from({ length: count }, (_, k) => (pl.repeat?.axis === "q" ? [p0, q0 + k * step] : [p0 + k * step, q0]))
}

export interface PlacementResult {
  warnings: PlacementWarning[]
  /** Quants ferratges col·locats s'han fet sencers. */
  applied: number
}

/**
 * Aplica els ferratges col·locats a les peces del moble (`panels`, ja amb els ids del moble; es canvien in situ amb
 * llistes noves, sense tocar les dels mòduls). `extras` = les peces que no són de CNC (per dir-ho a l'avís).
 */
export function applyHardwarePlacements(placements: readonly HardwarePlacement[] | undefined, panels: Panel[], extras: readonly Panel[] = []): PlacementResult {
  const warnings: PlacementWarning[] = []
  let applied = 0
  for (const pl of placements ?? []) {
    const item = pl.item
    const name = `«${item.name}»`
    const main = pl.targets[0]!
    const owner = { ...(main.module ? { moduleId: main.module } : {}), ...(main.freePart ? { partId: main.freePart } : {}) }
    const warn = (message: string, panelId?: string) => warnings.push({ code: "hardware", message, ...owner, ...(panelId ? { panelId } : {}) })
    if (isDamagedImport(item)) {
      warn(damagedImportMessage(item))
      continue
    }
    const ops = item.machining ?? []
    // Les peces: totes han de ser-hi (de CNC).
    const frames: { t: PlacementTarget; f: PartFrame }[] = []
    let missing: string | null = null
    for (const t of pl.targets) {
      const id = targetPanelId(t)
      const panel = id ? panels.find((p) => p.id === id) : undefined
      if (!panel) {
        const extra = id ? extras.find((p) => p.id === id) : undefined
        missing = extra ? `${extra.label} no és de CNC` : `la peça (${partKindOf(t.part).label.toLowerCase()}) ja no hi és`
        break
      }
      frames.push({ t, f: partFrame(panel) })
    }
    if (missing) {
      warn(`${name}: ${missing}; no es fa cap mecanitzat del ferratge.`)
      continue
    }
    const mainFrame = frames[0]!.f
    const mainOps = ops.filter((o) => o.part === main.part)
    const refsMain = refPoints(pl, mainFrame)
    // El 3D del ferratge (el GLB de l'importat o un volum fet de les operacions), a la peça principal.
    const fittings = (mainRes: OpResult[][]): PanelFitting[] => fittingsFor(item, mainFrame, refsMain, mainOps, mainRes, pl.turn ?? 0)
    if (!ops.length) {
      warn(item.engine === "model" ? `${name} és «només 3D»: no fa cap forat (afegeix-hi els mecanitzats a Preferències › Ferratges).` : `${name} no té mecanitzats: no fa cap forat.`, mainFrame.panel.id)
      addFittings(mainFrame.panel, fittings([]))
      continue
    }
    if (isPendingImport(item)) {
      warn(`${name} és importat i encara no està confirmat: no fa cap forat. Revisa'l i confirma'l a Preferències › Ferratges.`, mainFrame.panel.id)
      continue
    }
    const problems = machiningProblems(ops)
    if (problems.length) {
      warn(`${name} té un mecanitzat que no es pot fer (${problems[0]!.message.replace(/\.$/, "")}): no fa cap forat.`, mainFrame.panel.id)
      continue
    }
    // Tot o res: primer es calcula tot i, si alguna operació no cap, no es fa res.
    const done: { f: PartFrame; res: OpResult }[] = []
    const perRef: OpResult[][] = refsMain.map(() => [])
    let error: { msg: string; panel: Panel } | null = null
    outer: for (const { t, f } of frames) {
      const refs = f === mainFrame ? refsMain : refPoints(pl, f)
      for (const [k, [rp, rq]] of refs.entries()) {
        for (const op of ops.filter((o) => o.part === t.part)) {
          const res = applyGenOp(op, f, rp, rq)
          if ("error" in res) {
            error = { msg: res.error, panel: f.panel }
            break outer
          }
          done.push({ f, res })
          if (f === mainFrame) perRef[k]!.push(res)
        }
      }
    }
    if (error) {
      warn(`${name} a ${error.panel.label}: ${error.msg}; no es fa cap mecanitzat del ferratge.`, error.panel.id)
      continue
    }
    for (const { f, res } of done) {
      const p = f.panel
      if (res.holes.length) p.holes = [...p.holes, ...res.holes]
      if (res.grooves.length) p.grooves = [...p.grooves, ...res.grooves]
      if (res.cutouts.length) p.cutouts = [...(p.cutouts ?? []), ...res.cutouts]
    }
    addFittings(mainFrame.panel, fittings(perRef))
    applied++
  }
  return { warnings, applied }
}

function addFittings(p: Panel, list: PanelFitting[]): void {
  if (list.length) p.fittings = [...(p.fittings ?? []), ...list]
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a: WorldAxis): Vec3 => (a === "x" ? [1, 0, 0] : a === "y" ? [0, 1, 0] : [0, 0, 1])
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * El 3D del ferratge a cada repetició: al punt de referència, a la cara de la primera operació, amb l'eix v del
 * ferratge al llarg de Q (girat `turn` graus; u = v × n, n fora de la cara). El model importat (GLB) i la seva caixa; sense, un volum fet de
 * l'extensió de les operacions (3 mm de gruix sobre la cara).
 */
function fittingsFor(item: HardwarePlacement["item"], f: PartFrame, refs: [number, number][], ops: GenOp[], res: OpResult[][], turn: number): PanelFitting[] {
  const face: "A" | "B" = ops.find((o) => o.face !== "edge")?.face === "B" ? "B" : "A"
  const z = f.panel.placement.zAxis
  const nW: Vec3 = face === "A" ? z : [-z[0], -z[1], -z[2]]
  // L'eix v del model: Q, girat `turn` graus al voltant de la normal de la cara (un quart de volta = n × v).
  let qW = unit(f.q)
  for (let k = 0; k < Math.round(turn / 90) % 4; k++) qW = cross(nW, qW)
  const uW = cross(qW, nW)
  const vLocal: [number, number] = [r(dot(qW, f.panel.placement.xAxis)), r(dot(qW, f.panel.placement.yAxis))]
  const asset = item.imported?.asset
  return refs.flatMap(([rp, rq], k) => {
    let bbox = item.imported?.bbox
    if (!bbox && !asset) {
      const spans = (res[k] ?? []).map((x) => x.span)
      if (!spans.length) return []
      // Extensió de les operacions al marc del ferratge (u, v) des de la referència.
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
      for (const [p0, q0, p1, q1] of spans)
        for (const [pp, qq] of [[p0, q0], [p1, q0], [p1, q1], [p0, q1]] as const) {
          const off: Vec3 = [0, 0, 0]
          off[AXIS_INDEX[f.p]] = pp - rp
          off[AXIS_INDEX[f.q]] = qq - rq
          const u = dot(off, uW), v = dot(off, qW)
          u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v)
        }
      if (!(u1 - u0 > 0.5 || v1 - v0 > 0.5)) return []
      bbox = { min: [r(u0), r(v0), 0], max: [r(Math.max(u1, u0 + 1)), r(Math.max(v1, v0 + 1)), 3] }
    }
    const [x, y] = f.local(rp, rq)
    return [{ kind: "item" as const, ...(asset ? { asset } : {}), x: r(x), y: r(y), face, v: vLocal, ...(bbox ? { bbox } : {}) }]
  })
}
