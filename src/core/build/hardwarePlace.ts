import {
  damagedImportMessage,
  evalExpr,
  ExprError,
  repeatOffsets,
  type PlacePos,
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
import { edgeAt, panelBox, r, toLocal } from "./geometry"

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

interface PlacementWarning {
  code: "hardware"
  message: string
  panelId?: string
  moduleId?: string
  partId?: string
}

const AXIS_INDEX: Record<WorldAxis, number> = { x: 0, y: 1, z: 2 }
const EPS = 0.01

/** Eix del moble més proper a un vector (la normal d'una peça). */
function axisOf(v: Vec3): WorldAxis {
  const a = v.map(Math.abs)
  return a[0]! >= a[1]! && a[0]! >= a[2]! ? "x" : a[1]! >= a[2]! ? "y" : "z"
}

/** El marc d'una peça per al generador: eixos P i Q del moble al seu pla, la caixa i el pas al sistema local. */
interface PartFrame {
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
  const box = panelBox(panel)
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
interface OpResult {
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
function targetPanelId(t: PlacementTarget): string | null {
  if (t.freePart) return `part:${t.freePart}`
  if (t.module && t.panel) return `${t.module}:${t.panel}`
  return null
}

const AXIS_OF_PQ = (f: PartFrame, k: "p" | "q") => AXIS_INDEX[k === "p" ? f.p : f.q]

/** La mida de la peça al llarg de P o Q (al moble). */
export function frameSpan(f: PartFrame, k: "p" | "q"): [number, number] {
  const i = AXIS_OF_PQ(f, k)
  return [f.box.min[i]!, f.box.max[i]!]
}

/** Variables de les fórmules d'una posició: L, A, G (llarg, ample i gruix de la peça) i M (la mida al llarg de l'eix). */
function placeVars(panel: Panel, along: number): Record<string, number> {
  return { L: panel.length, A: panel.width, G: panel.thickness, M: along }
}

/**
 * Coordenada del moble d'una posició paramètrica (`PlacePos`) a la peça: l'ancoratge (inici, final, mig o %) i el
 * desplaçament (`at`, o la fórmula `expr` amb L · A · G · M). `{ error }` si la fórmula no es pot avaluar.
 */
export function placeAt(f: PartFrame, k: "p" | "q", pos: PlacePos): number | { error: string } {
  const [lo, hi] = frameSpan(f, k)
  const len = hi - lo
  let off = pos.at
  if (pos.expr) {
    try {
      off = evalExpr(pos.expr, placeVars(f.panel, len))
    } catch (e) {
      return { error: `fórmula «${pos.expr}»: ${e instanceof ExprError ? e.message : String(e)}` }
    }
  }
  if (pos.from === "max") return hi - off
  if (pos.from === "center") return (lo + hi) / 2 + off
  if (pos.from === "ratio") return lo + ((pos.pct ?? 0) / 100) * len + off
  return lo + off
}

/**
 * Les posicions del punt de referència (una per repetició) al moble, (P, Q): la posició paramètrica de cada eix i la
 * repetició (quantitat fixa o per regla segons la mida de la peça al llarg de l'eix, i com es reparteixen). Es calcula
 * a cada construcció amb la caixa de la peça d'ara: si el moble canvia de mida, el ferratge la segueix.
 */
export function refPoints(pl: Pick<HardwarePlacement, "p" | "q" | "repeat">, f: PartFrame): [number, number][] | { error: string } {
  const p0 = placeAt(f, "p", pl.p)
  if (typeof p0 !== "number") return p0
  const q0 = placeAt(f, "q", pl.q)
  if (typeof q0 !== "number") return q0
  const rep = pl.repeat
  if (!rep) return [[p0, q0]]
  const [lo, hi] = frameSpan(f, rep.axis)
  const base = (rep.axis === "p" ? p0 : q0) - lo
  return repeatOffsets(rep, hi - lo, base).map((o) => (rep.axis === "p" ? [lo + o, q0] : [p0, lo + o]))
}

/** Una operació reflectida al llarg de P (el mirall esquerra/dreta a una peça de costat a costat). */
export function mirrorOpP(op: GenOp): GenOp {
  const p: Pos = op.p.from === "min" ? { from: "max", at: op.p.at } : op.p.from === "max" ? { from: "min", at: op.p.at } : { ...op.p, at: -op.p.at }
  const edge = op.edge === "pmin" ? "pmax" : op.edge === "pmax" ? "pmin" : op.edge
  return { ...op, p, ...(edge ? { edge } : {}), ...(op.points ? { points: op.points.map(([a, b]) => [-a, b] as [number, number]) } : {}) }
}

/** L'id de la peça de l'altre costat (esquerra ↔ dreta) d'un mòdul, o `null`. */
function otherSideId(id: string): string | null {
  if (/left/.test(id)) return id.replace(/left/g, "right")
  if (/right/.test(id)) return id.replace(/right/g, "left")
  return null
}

interface PlacementResult {
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
    const find = (id: string | null) => (id ? panels.find((p) => p.id === id) : undefined)
    // Les peces: totes han de ser-hi (de CNC).
    const frames: { t: PlacementTarget; f: PartFrame }[] = []
    let missing: string | null = null
    for (const t of pl.targets) {
      const id = targetPanelId(t)
      const panel = find(id)
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
    // Cada peça amb les seves posicions (paramètriques: amb la mida d'ara) i, amb el mirall, la còpia simètrica.
    interface Job {
      t: PlacementTarget
      f: PartFrame
      refs: [number, number][]
      ops: GenOp[]
      /** La peça principal (o la seva còpia del mirall): hi va el 3D del ferratge. */
      main: boolean
    }
    const jobs: Job[] = []
    let posError: { msg: string; panel: Panel } | null = null
    for (const [i, { t, f }] of frames.entries()) {
      const refs = refPoints(pl, f)
      if ("error" in refs) {
        posError = { msg: refs.error, panel: f.panel }
        break
      }
      const mine = ops.filter((o) => o.part === t.part)
      jobs.push({ t, f, refs, ops: mine, main: i === 0 })
      if (!pl.mirror) continue
      if (f.p === "x") {
        // De costat a costat (porta, tapa, base, prestatge, fons): a la mateixa peça, reflectit respecte del seu mig.
        const [lo, hi] = frameSpan(f, "p")
        jobs.push({ t, f, refs: refs.map(([rp, rq]) => [lo + hi - rp, rq] as [number, number]), ops: mine.map(mirrorOpP), main: i === 0 })
        continue
      }
      // De cara a X (lateral, divisor, lateral de calaix): la peça de l'altre costat, a la mateixa posició.
      const other = t.module && t.panel ? otherSideId(t.panel) : null
      const panel = other ? find(`${t.module}:${other}`) : undefined
      if (!panel) {
        posError = { msg: "el mirall esquerra/dreta no troba la peça de l'altre costat", panel: f.panel }
        break
      }
      const fo = partFrame(panel)
      const ro = refPoints(pl, fo)
      if ("error" in ro) {
        posError = { msg: ro.error, panel }
        break
      }
      jobs.push({ t: { ...t, panel: other! }, f: fo, refs: ro, ops: mine, main: i === 0 })
    }
    const mainFrame = frames[0]!.f
    if (posError) {
      warn(`${name} a ${posError.panel.label}: ${posError.msg}; no es fa cap mecanitzat del ferratge.`, posError.panel.id)
      continue
    }
    // El 3D del ferratge (el GLB de l'importat o un volum fet de les operacions), a cada peça principal (i la del mirall).
    const mainJobs = jobs.filter((j) => j.main)
    const fittingsOf = (j: Job, res: OpResult[][]) => fittingsFor(item, j.f, j.refs, j.ops, res, pl.turn ?? 0).map((x) => ({ ...x, placement: pl.id }))
    const visualOnly = () => {
      for (const j of mainJobs) addFittings(j.f.panel, fittingsOf(j, []))
    }
    if (!ops.length) {
      warn(item.engine === "model" ? `${name} és «només 3D»: no fa cap forat (afegeix-hi els mecanitzats a Preferències › Ferratges).` : `${name} no té mecanitzats: no fa cap forat.`, mainFrame.panel.id)
      visualOnly()
      continue
    }
    // Sense cap forat, però el model es veu (per trobar-lo i triar-lo al 3D): només visual, mai es fabrica.
    if (isPendingImport(item)) {
      warn(`${name} és importat i encara no està confirmat: no fa cap forat. Revisa'l i confirma'l a Preferències › Ferratges.`, mainFrame.panel.id)
      visualOnly()
      continue
    }
    const problems = machiningProblems(ops)
    if (problems.length) {
      warn(`${name} té un mecanitzat que no es pot fer (${problems[0]!.message.replace(/\.$/, "")}): no fa cap forat.`, mainFrame.panel.id)
      visualOnly()
      continue
    }
    // Tot o res: primer es calcula tot i, si alguna operació no cap, no es fa res.
    const done: { panel: Panel; res: OpResult }[] = []
    const perJob = new Map<Job, OpResult[][]>()
    let error: { msg: string; panel: Panel } | null = null
    outer: for (const j of jobs) {
      const per: OpResult[][] = j.refs.map(() => [])
      perJob.set(j, per)
      for (const [k, [rp, rq]] of j.refs.entries()) {
        for (const op of j.ops) {
          const res = applyGenOp(op, j.f, rp, rq)
          if ("error" in res) {
            error = { msg: res.error, panel: j.f.panel }
            break outer
          }
          done.push({ panel: j.f.panel, res })
          per[k]!.push(res)
        }
      }
    }
    if (error) {
      warn(`${name} a ${error.panel.label}: ${error.msg}; no es fa cap mecanitzat del ferratge.`, error.panel.id)
      visualOnly()
      continue
    }
    // Sense repetits (el mirall d'un ferratge centrat cau a sobre de l'original): un mateix mecanitzat, un cop.
    const seen = new Set<string>()
    const fresh = <T>(panel: Panel, list: T[]) => list.filter((x) => {
      const key = `${panel.id}|${JSON.stringify(x)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    for (const { panel: p, res } of done) {
      const holes = fresh(p, res.holes)
      const grooves = fresh(p, res.grooves)
      const cutouts = fresh(p, res.cutouts)
      if (holes.length) p.holes = [...p.holes, ...holes]
      if (grooves.length) p.grooves = [...p.grooves, ...grooves]
      if (cutouts.length) p.cutouts = [...(p.cutouts ?? []), ...cutouts]
    }
    for (const j of mainJobs) addFittings(j.f.panel, fittingsOf(j, perJob.get(j) ?? []))
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
