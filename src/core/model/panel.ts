import { z } from "zod"
import { flatten, polygonArea } from "./polygon"

/**
 * Totes les mides són en mil·límetres (number).
 *
 * Sistema de coordenades local d'una peça (convenció u/v del taller):
 *  - x (u): sobre el costat LLARG (0..length). `length >= width` sempre.
 *  - y (v): sobre el costat curt (0..width).
 *  - `grain` diu si la veta va al llarg de x, de y o no importa.
 *  - z: gruix (0..thickness). La cara A (mecanitzada, "cara vista cap amunt")
 *    és a z = thickness; la cara B a z = 0.
 *  - Origen: cantonada inferior esquerra vista des de la cara A.
 */

export const PanelRoleSchema = z.enum([
  "side",
  "bottom",
  "top",
  "back",
  "shelf",
  "door",
  /** Divisor vertical entre zones. */
  "divider",
  /** Prestatge fix / travesser (divisió horitzontal). */
  "fixedShelf",
  /** Frontal de sòcol. */
  "plinth",
  "drawerFront",
  "drawerSide",
  "drawerBack",
  "drawerBottom",
  /** Porta abatible. */
  "flap",
  /** Front de reixeta CNC. */
  "grille",
  /** Trapa petita d'una reixeta. */
  "hatch",
  /** Front fix. */
  "panel",
  /** Taulell (peça correguda sobre els baixos). */
  "worktop",
  /** Llistó interior d'una paret buida (entre les dues pells). */
  "spacer",
  /** Tira frontal que tapa el davant d'una paret buida. */
  "facing",
  /** Peça lliure (flat-pack, encaixos). */
  "part",
])
export type PanelRole = z.infer<typeof PanelRoleSchema>

/** Costats d'una peça en coordenades locals. */
export const EdgeSideSchema = z.enum(["left", "right", "bottom", "top"])
export type EdgeSide = z.infer<typeof EdgeSideSchema>
export const EDGE_SIDES: readonly EdgeSide[] = ["left", "right", "bottom", "top"]

/** Numeració del taller: 1 = dalt · 2 = dreta · 3 = baix · 4 = esquerra. */
export const EDGE_NUMBER: Record<EdgeSide, 1 | 2 | 3 | 4> = {
  top: 1,
  right: 2,
  bottom: 3,
  left: 4,
}

export const GrainSchema = z.enum(["x", "y", "none"])
export type Grain = z.infer<typeof GrainSchema>

export const HoleFaceSchema = z.enum(["A", "B", "edge"])
export type HoleFace = z.infer<typeof HoleFaceSchema>

export const HoleSchema = z.object({
  /** Centre del forat en coordenades locals. Per a `face: "edge"`, punt sobre el contorn. */
  x: z.number(),
  y: z.number(),
  diameter: z.number().positive(),
  depth: z.number().positive(),
  face: HoleFaceSchema,
  /** Només per a forats horitzontals (`face: "edge"`): en quin costat es perfora. */
  edge: EdgeSideSchema.optional(),
  /** Etiqueta lliure per depurar/agrupar: "system32", "dowel", "hinge"... */
  tag: z.string().optional(),
})
export type Hole = z.infer<typeof HoleSchema>

/** Ranura rectangular fresada a una cara (per exemple la del fons). */
export const GrooveSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  depth: z.number().positive(),
  face: z.enum(["A", "B"]),
  tag: z.string().optional(),
})
export type Groove = z.infer<typeof GrooveSchema>

/**
 * Tall passant (travessa tot el gruix): ranures de reixeta, passacables, obertura d'una
 * trapa. Al DXF va a la capa CUT_THROUGH; al taller, com a pocket amb depth = gruix.
 */
/** Punt de contorn amb bulge opcional ([x, y] o [x, y, bulge]). */
export const BPtSchema = z.union([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number(), z.number()])])

const Vec2Schema = z.tuple([z.number(), z.number()])
/** Node d'un perfil de Bézier (`PNode`): punt, manegadors relatius, bulge i tipus. */
export const ProfileNodeSchema = z.object({
  x: z.number(),
  y: z.number(),
  in: Vec2Schema.optional(),
  out: Vec2Schema.optional(),
  b: z.number().optional(),
  t: z.enum(["corner", "smooth", "symmetric"]).optional(),
})

export const CutoutSchema = z.discriminatedUnion("kind", [
  /** Ranura amb els extrems arrodonits (radi = min(w, h) / 2). x, y = cantonada inferior esquerra. */
  z.object({ kind: z.literal("slot"), x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), tag: z.string().optional() }),
  z.object({ kind: z.literal("circle"), x: z.number(), y: z.number(), diameter: z.number().positive(), tag: z.string().optional() }),
  z.object({ kind: z.literal("rect"), x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), tag: z.string().optional() }),
  /**
   * Contorn qualsevol (antihorari), en coordenades locals de la peça. Cada punt pot portar el
   * bulge del costat que en surt (arc, com al DXF).
   */
  z.object({ kind: z.literal("polygon"), points: z.array(BPtSchema).min(3), tag: z.string().optional() }),
])
export type Cutout = z.infer<typeof CutoutSchema>

export function cutoutArea(c: Cutout): number {
  if (c.kind === "circle") return (Math.PI * c.diameter * c.diameter) / 4
  if (c.kind === "rect") return c.w * c.h
  if (c.kind === "polygon") return polygonArea(flatten(c.points))
  const r = Math.min(c.w, c.h) / 2
  return c.w * c.h - (4 - Math.PI) * r * r
}

const Vec3Schema = z.tuple([z.number(), z.number(), z.number()])
export type Vec3 = z.infer<typeof Vec3Schema>

/**
 * Col·locació de la peça dins del moble. Base ortonormal dextrogira:
 * punt_moble = origin + x·xAxis + y·yAxis + z·zAxis.
 * Coordenades del moble: X amplada (esquerra→dreta), Y alçada (amunt), Z fondària
 * (Z = 0 al darrere, creix cap al davant).
 */
export const PlacementSchema = z.object({
  origin: Vec3Schema,
  xAxis: Vec3Schema,
  yAxis: Vec3Schema,
  zAxis: Vec3Schema,
  /** Direcció cap on s'aparta la peça en vista explosionada. */
  explodeDir: Vec3Schema,
})
export type Placement = z.infer<typeof PlacementSchema>

export const EdgeBandingSchema = z.object({
  left: z.boolean(),
  right: z.boolean(),
  bottom: z.boolean(),
  top: z.boolean(),
})
export type EdgeBanding = z.infer<typeof EdgeBandingSchema>

export const PanelSchema = z.object({
  id: z.string(),
  /** Nom amb el vocabulari del taller (el reconeix `pieceRole` de taller-cnc-nest): "lat e". */
  name: z.string(),
  /** Nom llegible per a la UI: "Lateral esquerre". */
  label: z.string(),
  role: PanelRoleSchema,
  length: z.number().positive(),
  width: z.number().positive(),
  thickness: z.number().positive(),
  material: z.string(),
  grain: GrainSchema,
  edges: EdgeBandingSchema,
  holes: z.array(HoleSchema),
  grooves: z.array(GrooveSchema),
  /** Talls passants. Opcional: la majoria de peces no en tenen. */
  cutouts: z.array(CutoutSchema).optional(),
  /**
   * Contorn de la peça si no és un rectangle (p. ex. un tauler de taula oval): punts amb
   * bulge, en coordenades locals dins de llarg × ample. Sense: el rectangle.
   */
  outline: z.array(BPtSchema).min(3).optional(),
  /**
   * Talls en 3D que no es poden fer com a forat passant a la CNC (un tub que travessa un bloc
   * de pedra pel cantell, un tall que no arriba de cara a cara): prismes en coordenades locals
   * de la peça, secció (`points`, en un pla) estirada pel vector `dir`. Només el 3D els resta
   * (booleà); el nesting, el DXF i el STEP no.
   */
  solidCuts: z.array(z.object({ points: z.array(Vec3Schema).min(3), dir: Vec3Schema })).optional(),
  /** Conjunt que s'encola abans de muntar el moble (p. ex. «Lateral esquerre (paret buida)»). */
  assembly: z.string().optional(),
  /** Cantells tallats a 45° (unió a inglet); la cara llarga és la de fora del moble. */
  mitres: z.array(EdgeSideSchema).optional(),
  /** Número de mòdul (1..n) dins de la composició, per a les refs del taller. */
  module: z.number().int().positive().optional(),
  placement: PlacementSchema,
})
export type Panel = z.infer<typeof PanelSchema>

export const NO_EDGES: EdgeBanding = {
  left: false,
  right: false,
  bottom: false,
  top: false,
}

export function edgeCount(edges: EdgeBanding): number {
  return EDGE_SIDES.filter((s) => edges[s]).length
}
