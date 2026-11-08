import { panelAabb, type Composition, type Hole, type Panel, type Vec3 } from "../../core/model"
import { addHoles, local, type FaceToolOpts, type FaceToolResult } from "./faceTools"
import type { FaceHit } from "../../components/viewer/facePick"

/** Les eines d'unió del Modelatge (com les del Taulell): clavilles, cargols i Cabineo, amb la vista prèvia de les barres. */

const r1 = (v: number) => Math.round(v * 10) / 10
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

export const add3 = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
/** Un punt (mm de la composició) en coordenades de la peça: llarg, ample i gruix. */
function toLocal(p: Panel, w: Vec3): [number, number, number] {
  const d = sub(w, p.placement.origin)
  return [dot(d, p.placement.xAxis), dot(d, p.placement.yAxis), dot(d, p.placement.zAxis)]
}
export function fromLocal(p: Panel, u: number, v: number, t: number): Vec3 {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  return [0, 1, 2].map((k) => o[k]! + x[k]! * u + y[k]! * v + z[k]! * t) as Vec3
}
/** La peça (que no és `skip`) on cau el punt, si n'hi ha. */
function panelAt(panels: Panel[], w: Vec3, skip: string): Panel | undefined {
  return panels.find((q) => {
    if (q.id === skip || q.role === "hardware") return false
    const b = panelAabb(q)
    return [0, 1, 2].every((k) => b.min[k]! - 0.6 <= w[k]! && b.max[k]! + 0.6 >= w[k]!)
  })
}
/** Repartits a la junta [lo, hi]: amb marge als extrems i un pas màxim; com a mínim dos (un si no hi caben). */
function spread(lo: number, hi: number, margin: number, pitch: number): number[] {
  const span = hi - lo - 2 * margin
  if (span < 1) return hi - lo >= 1 ? [(lo + hi) / 2] : []
  const n = Math.max(2, Math.ceil(span / Math.max(20, pitch) - 1e-6) + 1)
  return Array.from({ length: n }, (_, k) => r1(lo + margin + (span * k) / (n - 1)))
}
/** La cara (A o B) d'una peça que mira cap a `n`. */
const faceTo = (p: Panel, n: Vec3): "A" | "B" => (dot(n, p.placement.zAxis) > 0 ? "A" : "B")
/** Un forat al cantell d'una peça al punt local (u, v): el cantell més proper. */
function edgeHole(p: Panel, u: number, v: number, d: number, depth: number): Hole {
  const ds: [Panel["edges"] extends Record<infer K, unknown> ? K : never, number][] = [
    ["left", Math.abs(u)],
    ["right", Math.abs(p.length - u)],
    ["bottom", Math.abs(v)],
    ["top", Math.abs(p.width - v)],
  ]
  const [edge] = ds.reduce((x, y) => (y[1] < x[1] ? y : x))
  const x = edge === "left" ? 0 : edge === "right" ? p.length : r1(u)
  const y = edge === "bottom" ? 0 : edge === "top" ? p.width : r1(v)
  return { x, y, diameter: d, depth, face: "edge", edge }
}
/** Afegeix els forats a cada peça (només les dels mobles); null si alguna és una peça lliure. */
function addAll(comp: Composition, list: [Panel, Hole[]][]): Composition | null {
  let c: Composition | null = comp
  for (const [p, hs] of list) if (c && hs.length) c = addHoles(c, p, hs)
  return c
}

/** Clavilles i cargols (port de `scrPlan` / `dowPlan` del Taulell): repartits a la junta, centrats al cantell de la peça de darrere. */
export function jointTool(tool: "dowel" | "screw", o: FaceToolOpts, comp: Composition, panels: Panel[], hit: FaceHit): FaceToolResult {
  const { panel: P, point: pt, normal: n } = hit
  const l = local(P, pt, n)
  if (l.face === "edge") return { message: "Clica la cara del tauler, no el cantell.", error: true }
  const nW: Vec3 = l.face === "A" ? P.placement.zAxis : (P.placement.zAxis.map((v) => -v) as Vec3)
  const T = P.thickness
  const R = panelAt(panels, add3(pt, nW, -(T + 1)), P.id)
  if (!R) return { message: tool === "dowel" ? "Clica la cara de fora d'un tauler que toqui el cantell d'una altra peça." : "Darrere d'aquesta cara no hi ha cap peça.", error: true }
  const tR = R.placement.zAxis
  const edgeOn = Math.abs(dot(tR, nW)) < 0.5
  if (tool === "dowel" && !edgeOn) return { message: "Clica la cara de fora d'un tauler que toqui el cantell d'una altra peça.", error: true }
  // El punt, al mig del gruix de la peça de darrere; la junta va en la tercera direcció.
  const rc = fromLocal(R, R.length / 2, R.width / 2, R.thickness / 2)
  const c = edgeOn ? add3(pt, tR, dot(sub(rc, pt), tR)) : pt
  const L: Vec3 = edgeOn ? [nW[1]! * tR[2]! - nW[2]! * tR[1]!, nW[2]! * tR[0]! - nW[0]! * tR[2]!, nW[0]! * tR[1]! - nW[1]! * tR[0]!] : P.placement.xAxis
  const pb = panelAabb(P)
  const rb = panelAabb(R)
  const proj = (b: { min: Vec3; max: Vec3 }) => {
    const vs = [0, 1, 2].map((k) => (L[k]! >= 0 ? [b.min[k]!, b.max[k]!] : [b.max[k]!, b.min[k]!]))
    return [vs.reduce((s, v, k) => s + v[0]! * L[k]!, 0), vs.reduce((s, v, k) => s + v[1]! * L[k]!, 0)]
  }
  const [p0, p1] = proj(pb)
  const [q0, q1] = proj(rb)
  const lo = Math.max(p0!, q0!)
  const hi = Math.min(p1!, q1!)
  const at = dot(c, L)
  const dist = tool === "dowel" ? o.dowDist : o.scrDist
  const ss = edgeOn && dist ? spread(lo, hi, tool === "dowel" ? o.dowMargin : o.scrMargin, tool === "dowel" ? o.dowPitch : o.scrPitch) : [at]
  if (!ss.length) return { message: "La junta és massa curta.", error: true }
  const pts = ss.map((s) => add3(c, L, s - at))
  if (tool === "screw") {
    const holes = pts.map((w) => {
      const [u, v] = toLocal(P, w)
      return { x: r1(u), y: r1(v), diameter: o.scrHole, depth: T, face: l.face as "A" | "B" }
    })
    const ghost = pts.map((w) => rod(w, nW, 2, -o.scrL + 2, o.scrD))
    const next = addAll(comp, [[P, holes]])
    if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true, ghost }
    const warn = o.scrL <= T ? ` · el cargol (${o.scrL}) no passa del gruix (${r1(T)})` : ""
    return { comp: next, ghost, message: `${holes.length} × Cargol ${o.scrD} × ${o.scrL} a ${P.label} → ${R.label}${warn}` }
  }
  const f = Math.min(o.dowF, r1(T - 4))
  const inner = faceTo(P, nW.map((v) => -v) as Vec3)
  const ph = pts.map((w) => {
    const [u, v] = toLocal(P, w)
    return { x: r1(u), y: r1(v), diameter: o.dowD, depth: f, face: inner }
  })
  const rh = pts.map((w) => {
    const [u, v] = toLocal(R, add3(w, nW, -T))
    return edgeHole(R, u, v, o.dowD, o.dowE)
  })
  const ghost = pts.map((w) => rod(add3(w, nW, -T), nW, f, -o.dowE, o.dowD))
  const next = addAll(comp, [
    [P, ph],
    [R, rh],
  ])
  if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true, ghost }
  return { comp: next, ghost, message: `${ph.length} × Clavilla ${o.dowM.replace("x", "×")} · ${P.label} → ${R.label}${f < o.dowF ? ` · fondària a la cara reduïda a ${f}` : ""}` }
}

/** Cabineo (port de `cabiPlan` del Taulell): tres buidats Ø15 encavalcats a la cara, a tocar del cantell, i el cargol a l'altra peça. */
export function cabineoTool(o: FaceToolOpts, comp: Composition, panels: Panel[], hit: FaceHit): FaceToolResult {
  const { panel: P, point: pt, normal: n } = hit
  const l = local(P, pt, n)
  if (l.face === "edge") return { message: "Clica la cara del tauler que porta el connector (no el cantell).", error: true }
  const T = P.thickness
  const ds: [string, number][] = [
    ["left", l.u],
    ["right", P.length - l.u],
    ["bottom", l.v],
    ["top", P.width - l.v],
  ]
  const [edge] = ds.reduce((x, y) => (y[1] < x[1] ? y : x))
  const alongU = edge === "bottom" || edge === "top"
  const eC = edge === "left" ? 0 : edge === "right" ? P.length : edge === "bottom" ? 0 : P.width
  const inward = edge === "left" || edge === "bottom" ? 1 : -1
  const at = (along: number, from: number, t: number) => (alongU ? fromLocal(P, along, eC + inward * from, t) : fromLocal(P, eC + inward * from, along, t))
  const probe = add3(at(alongU ? l.u : l.v, 0, T / 2), sub(at(alongU ? l.u : l.v, -1, T / 2), at(alongU ? l.u : l.v, 0, T / 2)))
  const Q = panelAt(panels, probe, P.id)
  if (!Q) return { message: "Aquest cantell no toca cap altra peça. Clica a prop del cantell que s'uneix (per exemple, la base a tocar del lateral).", error: true }
  // La junta: on es toquen les dues peces al llarg del cantell.
  const qs = [0, Q.length].flatMap((a) => [0, Q.width].flatMap((b) => [0, Q.thickness].map((c) => toLocal(P, fromLocal(Q, a, b, c))[alongU ? 0 : 1])))
  const len = alongU ? P.length : P.width
  const lo = Math.max(0, Math.min(...qs))
  const hi = Math.min(len, Math.max(...qs))
  const m = o.cabiMargin
  if (hi - lo < 2 * m - 1) return { message: `La junta fa ${r1(hi - lo)} mm: massa curta per al Cabineo amb ${m} mm de marge.`, error: true }
  const us = spread(lo, hi, m, o.cabiPitch)
  const face = l.face
  const top = face === "A"
  const pockets: Hole[] = us.flatMap((u) =>
    [0, 1, 2].map((k) => {
      const c = o.cabiFirst + k * o.cabiStep
      const [x, y] = alongU ? [u, eC + inward * c] : [eC + inward * c, u]
      return { x: r1(x), y: r1(y), diameter: o.cabiD, depth: o.cabiDepth, face }
    }),
  )
  const out = sub(at(0, -1, 0), at(0, 0, 0))
  const qFace = faceTo(Q, out.map((v) => -v) as Vec3)
  const screws: Hole[] = us.map((u) => {
    const [x, y] = toLocal(Q, at(u, 0, top ? T - o.cabiAxis : o.cabiAxis))
    return { x: r1(x), y: r1(y), diameter: o.cabiSd, depth: o.cabiM === "12" ? 12 : 8, face: qFace }
  })
  const ghost = [
    ...pockets.map((h) => rod(fromLocal(P, h.x, h.y, top ? T : 0), top ? P.placement.zAxis : (P.placement.zAxis.map((v) => -v) as Vec3), 0, -o.cabiDepth, o.cabiD)),
    ...us.map((u) => rod(at(u, 0, top ? T - o.cabiAxis : o.cabiAxis), out, 0, o.cabiM === "12" ? 12 : 8, o.cabiSd)),
  ]
  const next = addAll(comp, [
    [P, pockets],
    [Q, screws],
  ])
  if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true, ghost }
  return { comp: next, ghost, message: `${us.length} × Cabineo ${o.cabiM}: ${P.label} amb ${Q.label}` }
}


/** La caixa d'una barra de diàmetre `d` al llarg de `n` (de `a` a `b` mm des de `c`), per a la vista prèvia. */
export function rod(c: Vec3, n: Vec3, a: number, b: number, d: number): { min: Vec3; max: Vec3 } {
  const p = add3(c, n, a)
  const q = add3(c, n, b)
  const min = [0, 1, 2].map((k) => Math.min(p[k]!, q[k]!) - (Math.abs(n[k]!) > 0.5 ? 0 : d / 2)) as Vec3
  const max = [0, 1, 2].map((k) => Math.max(p[k]!, q[k]!) + (Math.abs(n[k]!) > 0.5 ? 0 : d / 2)) as Vec3
  return { min, max }
}
