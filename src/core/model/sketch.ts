import { z } from "zod"
import { PART_AXES, type FreePart, type PartOrient } from "./freePart"
import type { Vec3 } from "./panel"

/**
 * **Croquis** (els de l'Esbós del Taulell): un contorn tancat dibuixat sobre una cara (rectangle, polilínia o cercle). No és
 * una peça: l'Extrusió en fa una peça lliure amb aquest contorn i el gruix triat. El pla és d'escaire, com les peces: `a`
 * és l'eix de la normal, `level` on és el pla (mm de la composició) i `dir` cap a on surt la peça (+1 o -1). Els punts, en
 * els dos eixos del pla de la peça que en sortiria (`PART_AXES` de l'orientació: u, v).
 */
export const SketchSchema = z.object({
  id: z.string(),
  name: z.string(),
  a: z.number().int().min(0).max(2),
  level: z.number(),
  dir: z.union([z.literal(1), z.literal(-1)]),
  pts: z.array(z.tuple([z.number(), z.number()])).min(3),
  rect: z.boolean().optional(),
})
export type Sketch = z.infer<typeof SketchSchema>

/** L'orientació de la peça pel seu eix del gruix (com `ORIENT_OF_AXIS`; aquí per no fer un cicle d'imports). */
const ORIENT_OF_AXIS: PartOrient[] = ["side", "flat", "front"]

/** Els eixos (u, v) del pla d'un croquis, els de la peça que en surt. */
export function sketchAxes(a: number): { u: number; v: number } {
  const ax = PART_AXES[ORIENT_OF_AXIS[a]!]
  return { u: ax.u, v: ax.v }
}

/** Un punt (mm de la composició) en coordenades del pla del croquis. */
export function toPlane(a: number, p: Vec3): [number, number] {
  const { u, v } = sketchAxes(a)
  return [Math.round(p[u]! * 10) / 10, Math.round(p[v]! * 10) / 10]
}

/** Un punt del pla, en mm de la composició. */
export function fromPlane(a: number, level: number, q: [number, number]): Vec3 {
  const { u, v } = sketchAxes(a)
  const out: Vec3 = [0, 0, 0]
  out[a] = level
  out[u] = q[0]
  out[v] = q[1]
  return out
}

/** Els punts d'un rectangle (de dues cantonades) i d'un cercle (centre i diàmetre; 48 costats, com el Taulell). */
export function rectPts(p1: [number, number], p2: [number, number]): [number, number][] {
  const [u0, u1] = [Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])]
  const [v0, v1] = [Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])]
  return [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ]
}
export function circlePts(c: [number, number], d: number): [number, number][] {
  return Array.from({ length: 48 }, (_, k) => {
    const t = (k / 48) * Math.PI * 2
    return [Math.round((c[0] + (Math.cos(t) * d) / 2) * 10) / 10, Math.round((c[1] + (Math.sin(t) * d) / 2) * 10) / 10] as [number, number]
  })
}

/** L'Extrusió: la peça lliure amb el contorn del croquis i el gruix `T`, cap a fora de la cara on s'ha dibuixat. */
export function extrudeSketch(s: Sketch, T: number, base: Pick<FreePart, "id" | "name" | "material">): FreePart {
  const orient = ORIENT_OF_AXIS[s.a]!
  const { u, v } = sketchAxes(s.a)
  const us = s.pts.map((q) => q[0])
  const vs = s.pts.map((q) => q[1])
  const u0 = Math.min(...us)
  const v0 = Math.min(...vs)
  const pos: Vec3 = [0, 0, 0]
  pos[u] = u0
  pos[v] = v0
  pos[s.a] = s.dir > 0 ? s.level : s.level - T
  return {
    ...base,
    orient,
    w: Math.max(1, Math.max(...us) - u0),
    h: Math.max(1, Math.max(...vs) - v0),
    thickness: T,
    x: pos[0],
    y: pos[1],
    z: pos[2],
    // Estirada, la v de la peça va del davant cap al fons (z màxima a 0, `freeParts`): el contorn es gira en v.
    ...(s.rect ? {} : { shape: s.pts.map(([x, y]) => ({ x: x - u0, y: orient === "flat" ? Math.max(...vs) - y : y - v0 })) }),
  }
}
