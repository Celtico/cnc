import type { Vec3 } from "../../model"
import type { Pt2 } from "../region2d"

/** Vectors 3D, cares (planes i cilíndriques) i marcs 2D de les cares, en coordenades locals de la peça. */

export type V3 = Vec3
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2])
export const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1))
export const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]]
export const X: V3 = [1, 0, 0]
export const Y: V3 = [0, 1, 0]
export const Z: V3 = [0, 0, 1]

/** Rotació de `v` al voltant de l'eix unitari `k` (Rodrigues). */
export function rotate(v: V3, k: V3, angle: number): V3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)))
}

interface Arc {
  center: V3
  /** L'arc va del punt actual al següent en sentit antihorari al voltant d'aquest eix. */
  axis: V3
}
export interface LoopPt {
  p: V3
  arc?: Arc
}
export type Loop = LoopPt[]

export interface PlaneFace {
  kind: "plane"
  loc: V3
  normal: V3
  loops: Loop[]
}
export interface CylFace {
  kind: "cyl"
  loc: V3
  axis: V3
  ref: V3
  radius: number
  loop: Loop
  /** El material és a dins del cilindre (arc que entra al forat): la cara mira enfora. */
  outward?: boolean
}
export type Face = PlaneFace | CylFace

/** Marc 2D d'una cara plana amb normal axial: a × b = n. */
export interface Frame {
  o: V3
  a: V3
  b: V3
  n: V3
}

export function frameFor(n: V3, o: V3): Frame {
  if (n[2] > 0.5) return { o, a: X, b: Y, n }
  if (n[2] < -0.5) return { o, a: Y, b: X, n }
  if (n[0] < -0.5) return { o, a: Z, b: Y, n }
  if (n[0] > 0.5) return { o, a: Y, b: Z, n }
  if (n[1] < -0.5) return { o, a: X, b: Z, n }
  return { o, a: Z, b: X, n }
}

export const to3D = (f: Frame, q: Pt2): V3 => add(add(f.o, mul(f.a, q[0])), mul(f.b, q[1]))
export const to2D = (f: Frame, p: V3): Pt2 => [dot(sub(p, f.o), f.a), dot(sub(p, f.o), f.b)]

/** Cara plana rectangular (bucle antihorari respecte a la normal). */
export function rectFace(n: V3, o: V3, a0: number, a1: number, b0: number, b1: number): PlaneFace {
  const f = frameFor(n, o)
  const ring: Pt2[] = [
    [a0, b0],
    [a1, b0],
    [a1, b1],
    [a0, b1],
  ]
  return { kind: "plane", loc: to3D(f, [a0, b0]), normal: n, loops: [ring.map((q) => ({ p: to3D(f, q) }))] }
}

/** Normal de Newell d'un polígon 3D (no normalitzada): segueix el sentit del recorregut. */
export function newell(ring: V3[]): V3 {
  const n: V3 = [0, 0, 0]
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    n[0] += (a[1] - b[1]) * (a[2] + b[2])
    n[1] += (a[2] - b[2]) * (a[0] + b[0])
    n[2] += (a[0] - b[0]) * (a[1] + b[1])
  }
  return n
}
