import type { Hole, Panel, PanelFitting, Vec3 } from "../../model"
import { toWorld } from "../geometry"
import type { Box } from "./types"

/** Caixes al mòdul (de les peces, dels ferratges i dels forats) i l'entrada de cada forat. */

export const emptyBox = (): Box => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] })
export const boxHas = (b: Box) => Number.isFinite(b.min[0]) && Number.isFinite(b.max[0])
export function addPoint(b: Box, p: Vec3, r = 0): void {
  for (const k of [0, 1, 2] as const) {
    b.min[k] = Math.min(b.min[k], p[k] - r)
    b.max[k] = Math.max(b.max[k], p[k] + r)
  }
}
export function addBox(b: Box, o: Box): void {
  addPoint(b, o.min)
  addPoint(b, o.max)
}
/** Distància d'un punt a una caixa (0 si és a dins). */
export function boxDistance(b: Box, p: Vec3): number {
  let d = 0
  for (const k of [0, 1, 2] as const) {
    const e = Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])
    d += e * e
  }
  return Math.sqrt(d)
}

/** Distància entre dues caixes (0 si es toquen o s'encavalquen). */
export function boxGap(a: Box, b: Box): number {
  let d = 0
  for (const k of [0, 1, 2] as const) {
    const e = Math.max(a.min[k] - b.max[k], 0, b.min[k] - a.max[k])
    d += e * e
  }
  return Math.sqrt(d)
}

/** Una caixa en coordenades locals de la peça, al mòdul. */
export function localBox(p: Panel, b: Box): Box {
  const cs: Vec3[] = []
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) cs.push(toWorld(p, [x, y, z]))
  return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
}
export const boxOf = (p: Panel): Box => localBox(p, { min: [0, 0, 0], max: [p.length, p.width, p.thickness] })

/** Caixa d'un ferratge al marc (u, v, n) de la peça, al mòdul. */
export function fittingBox(p: Panel, f: Pick<PanelFitting, "x" | "y" | "face" | "v">, bb: Box): Box {
  const nz = f.face === "A" ? 1 : -1
  const V: Vec3 = [f.v[0], f.v[1], 0]
  const N: Vec3 = [0, 0, nz]
  const U: Vec3 = [V[1] * N[2] - V[2] * N[1], V[2] * N[0] - V[0] * N[2], V[0] * N[1] - V[1] * N[0]]
  const o: Vec3 = [f.x, f.y, f.face === "A" ? p.thickness : 0]
  const cs: Vec3[] = []
  for (const u of [bb.min[0], bb.max[0]])
    for (const v of [bb.min[1], bb.max[1]])
      for (const n of [bb.min[2], bb.max[2]]) cs.push(toWorld(p, [o[0] + u * U[0] + v * V[0] + n * N[0], o[1] + u * U[1] + v * V[1] + n * N[1], o[2] + u * U[2] + v * V[2] + n * N[2]]))
  return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
}

/** Volum simplificat d'una frontissa de l'app al pla del muntatge (`mountPlan`; el 3D és el de `builtinSolids`). */
export const BUILTIN_HINGE = (d: number) => ({ min: [-10, -Math.max(20, d) / 2, 0] as Vec3, max: [10, Math.max(20, d) / 2, 13] as Vec3 })

/**
 * El tirador de barra de l'app a un front (el mateix criteri que `handleMeshes` del visor: entre els dos talls `handle`,
 * 28 mm fora de la cara de fora), en coordenades locals de la peça. Cap si el front porta un tirador importat o és push.
 */
export function builtinHandleBox(p: Panel): Box | null {
  if ((p.role !== "door" && p.role !== "drawerFront" && p.role !== "flap") || p.push) return null
  if ((p.fittings ?? []).some((f) => f.kind === "handle")) return null
  const hh = (p.cutouts ?? []).flatMap((c) => (c.kind === "circle" && c.tag === "handle" ? [{ x: c.x, y: c.y }] : []))
  const [a, b] = hh
  if (hh.length !== 2 || !a || !b) return null
  const T = p.thickness
  const inner = p.holes.find((h) => h.tag === "hinge")?.face === "B" ? 0 : T
  const outZ = inner === T ? 0 : T
  const dir = inner === T ? -1 : 1
  const vertical = Math.abs(a.y - b.y) > Math.abs(a.x - b.x)
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2
  const half = (Math.hypot(a.x - b.x, a.y - b.y) + 40) / 2
  const z0 = outZ
  const z1 = outZ + dir * 34
  return { min: [cx - (vertical ? 6 : half), cy - (vertical ? half : 6), Math.min(z0, z1)], max: [cx + (vertical ? 6 : half), cy + (vertical ? half : 6), Math.max(z0, z1)] }
}

/** Centre de l'entrada d'un forat (coordenades locals) i la normal de la cara on entra (locals). */
export function holeEntry(p: Panel, h: Pick<Hole, "x" | "y" | "face" | "edge">): { at: Vec3; normal: Vec3 } {
  const T = p.thickness
  if (h.face === "A") return { at: [h.x, h.y, T], normal: [0, 0, 1] }
  if (h.face === "B") return { at: [h.x, h.y, 0], normal: [0, 0, -1] }
  switch (h.edge) {
    case "left":
      return { at: [0, h.y, T / 2], normal: [-1, 0, 0] }
    case "right":
      return { at: [p.length, h.y, T / 2], normal: [1, 0, 0] }
    case "bottom":
      return { at: [h.x, 0, T / 2], normal: [0, -1, 0] }
    default:
      return { at: [h.x, p.width, T / 2], normal: [0, 1, 0] }
  }
}

/** Una direcció local de la peça al mòdul (sense l'origen). */
export function worldDir(p: Panel, d: Vec3): Vec3 {
  const { xAxis: a, yAxis: b, zAxis: c } = p.placement
  return [d[0] * a[0] + d[1] * b[0] + d[2] * c[0], d[0] * a[1] + d[1] * b[1] + d[2] * c[1], d[0] * a[2] + d[1] * b[2] + d[2] * c[2]]
}

/** Forats d'una peça amb els talls rodons (tiradors) com a forats passants de cara A. */
export function mountHoles(p: Panel): Hole[] {
  const cut = (p.cutouts ?? []).flatMap((c) => (c.kind === "circle" ? [{ x: c.x, y: c.y, diameter: c.diameter, depth: p.thickness, face: "A" as const, ...(c.tag ? { tag: c.tag } : {}) }] : []))
  return [...p.holes, ...cut]
}
