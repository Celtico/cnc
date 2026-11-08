import type { Composition, Hole, Panel, Vec3 } from "../../core/model"
import { pieceLocalId } from "./modelingPieces"

/** El que comparteixen les eines de cara del Modelatge: passar del món a la peça i tornar, mides i caixes. */

export const r1 = (v: number) => Math.round(v * 10) / 10
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/** El mòdul d'una peça construïda (o undefined si és una peça lliure). */
export function moduleOf(comp: Composition, p: Panel) {
  return p.id.startsWith("part:") || !p.module ? undefined : comp.modules[p.module - 1]
}

/** El punt a les coordenades de la peça (llarg, ample) i la cara (A: la del gruix cap a +z de la peça). */
export function local(p: Panel, pt: Vec3, n: Vec3): { u: number; v: number; face: "A" | "B" | "edge" } {
  const { origin, xAxis, yAxis, zAxis } = p.placement
  const d = sub(pt, origin)
  const nz = dot(n, zAxis)
  return { u: dot(d, xAxis), v: dot(d, yAxis), face: nz > 0.5 ? "A" : nz < -0.5 ? "B" : "edge" }
}

export function uniqueName(comp: Composition, base: string): string {
  const used = new Set((comp.parts ?? []).map((q) => q.name))
  let k = 1
  while (used.has(`${base} ${k}`)) k++
  return `${base} ${k}`
}

/** Una mida en mm a la catalana (149,5). */
export const fmtMm = (v: number) => String(r1(v)).replace(".", ",")

/** La caixa (al món) d'un tros de la peça en coordenades locals (mm: x llarg, y ample, z gruix): la vista prèvia. */
function localBox(p: Panel, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): { min: Vec3; max: Vec3 } {
  const { origin, xAxis, yAxis, zAxis } = p.placement
  const at = (x: number, y: number, z: number) => [0, 1, 2].map((k) => origin[k]! + xAxis[k]! * x + yAxis[k]! * y + zAxis[k]! * z)
  const a = at(x0, y0, z0), b = at(x1, y1, z1)
  return { min: [0, 1, 2].map((k) => Math.min(a[k]!, b[k]!)) as Vec3, max: [0, 1, 2].map((k) => Math.max(a[k]!, b[k]!)) as Vec3 }
}

/** El tros que es buidarà, de la cara (`A` a dalt, z = gruix) cap endins, sortint 0,5 mm perquè es vegi. */
export const cutBox = (p: Panel, face: "A" | "B", x0: number, y0: number, x1: number, y1: number, depth: number) =>
  face === "A" ? localBox(p, x0, y0, p.thickness - depth, x1, y1, p.thickness + 0.5) : localBox(p, x0, y0, -0.5, x1, y1, depth)

/** Afegeix forats a mà a la peça d'un mòdul (`Module.pieceEdits`). */
export function addHoles(comp: Composition, p: Panel, holes: Hole[]): Composition | null {
  const m = moduleOf(comp, p)
  if (!m) return null
  const id = pieceLocalId(m.id, p.id)
  const cur = m.pieceEdits?.[id] ?? {}
  return { ...comp, modules: comp.modules.map((x) => (x.id !== m.id ? x : { ...x, pieceEdits: { ...x.pieceEdits, [id]: { ...cur, holes: [...(cur.holes ?? []), ...holes] } } })) }
}

export const add3 = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
/** Un punt (mm de la composició) en coordenades de la peça: llarg, ample i gruix. */
export function toLocal(p: Panel, w: Vec3): [number, number, number] {
  const d = sub(w, p.placement.origin)
  return [dot(d, p.placement.xAxis), dot(d, p.placement.yAxis), dot(d, p.placement.zAxis)]
}
export function fromLocal(p: Panel, u: number, v: number, t: number): Vec3 {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  return [0, 1, 2].map((k) => o[k]! + x[k]! * u + y[k]! * v + z[k]! * t) as Vec3
}

/** On talla el raig (des de `o`, cap a `d`) la caixa, o null. */
export function rayBox(o: Vec3, d: Vec3, b: { min: Vec3; max: Vec3 }): number | null {
  let t0 = -Infinity
  let t1 = Infinity
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]!) < 1e-9) {
      if (o[k]! < b.min[k]! || o[k]! > b.max[k]!) return null
      continue
    }
    const a = (b.min[k]! - o[k]!) / d[k]!
    const c = (b.max[k]! - o[k]!) / d[k]!
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
  }
  return t1 >= t0 && t1 > 0 ? Math.max(0, t0) : null
}
