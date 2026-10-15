import { z } from "zod"
import { VIEW_FLAGS } from "./viewFlags"
import { CameraPoseSchema, parseCameraPose } from "./camera"
import { repairValue } from "./repair"
import { aliasMaterialRefs } from "./photoUpgrade"

/**
 * Ambients: el plànol d'una casa (parets dibuixades i, a sota, la imatge d'un plànol escalada)
 * amb mobles col·locats a dins. Els mobles són **els mateixos** de la llista (enllaç per id):
 * a l'ambient només se'n toquen les mides generals i la posició. També hi ha **blocs** (sofà,
 * llit, nevera…): formes senzilles amb material de simulació per veure si tot hi cap.
 *
 * Coordenades del plànol en mm: x cap a la dreta, y cap avall (a la pantalla). Al 3D, X = x,
 * Z = y i Y amunt. Els elements es col·loquen pel **centre** de la seva petjada i giren al
 * voltant del centre (graus, en sentit horari vist des de dalt). Sense girar, el darrere del
 * moble mira cap a y petites (amunt a la pantalla) i el davant cap a y grans.
 */

const mm = z.number().finite()
const Pt = z.tuple([mm, mm])
export type PlanPt = z.infer<typeof Pt>

/**
 * Obertura d'una paret: finestra (amb ampit), porta (fins a terra) o vidriera (de terra a sostre,
 * perfils prims). `at` = centre des de l'extrem `a` de la paret; `sill` = alçada de l'ampit.
 */
export const OpeningSchema = z.object({
  kind: z.enum(["window", "door", "glazing"]),
  at: mm,
  w: mm.positive(),
  h: mm.positive(),
  sill: mm.min(0),
  /** Travessers verticals (fulles) del vidre. */
  panes: z.number().int().min(1).max(12).optional(),
  /** Material dels perfils (nom de preferències); sense, alumini negre. */
  frame: z.string().optional(),
})
export type Opening = z.infer<typeof OpeningSchema>

export const WallSchema = z.object({
  id: z.string(),
  ...VIEW_FLAGS,
  /** Eix de la paret (de a a b); el gruix es reparteix a banda i banda. */
  a: Pt,
  b: Pt,
  thickness: mm.positive(),
  height: mm.positive(),
  /** Material propi (sense, el de les parets de l'ambient). */
  material: z.string().optional(),
  openings: z.array(OpeningSchema).optional(),
  /**
   * Paret corba (per decisió de l'usuari, 2026-10-14; la ploma, clic i arrossegar, com Figma): Bézier cúbica de `a` a `b`
   * amb els dos punts de control (mm del plànol). Sense, recta. Una paret corba no porta obertures.
   */
  curve: z.object({ c1: Pt, c2: Pt }).optional(),
  /** Grup (nom), el mateix espai de noms que els dels elements: un grup pot tenir parets, mobles i objectes. */
  group: z.string().optional(),
})
export type Wall = z.infer<typeof WallSchema>

export const BlockShapeSchema = z.enum(["box", "sofa", "bed", "table"])

const Placement = {
  x: mm,
  y: mm,
  rot: mm,
  elevation: mm.min(0).optional(),
  /** Grup (nom): els elements del mateix grup es mouen, giren, dupliquen i esborren junts. */
  group: z.string().optional(),
  ...VIEW_FLAGS,
}

export const AmbientItemSchema = z.discriminatedUnion("kind", [
  /** Un moble de la llista (enllaç): es dibuixa amb les peces de debò. */
  z.object({ id: z.string(), kind: z.literal("moble"), projectId: z.number().int(), ...Placement }),
  /** Bloc senzill (no es fabrica): forma, mides i material de simulació. */
  z.object({
    id: z.string(),
    kind: z.literal("block"),
    name: z.string(),
    shape: BlockShapeSchema,
    w: mm.positive(),
    h: mm.positive(),
    d: mm.positive(),
    material: z.string(),
    /** Segon material (matalàs del llit, coixins del sofà). */
    material2: z.string().optional(),
    ...Placement,
  }),
])
export type AmbientItem = z.infer<typeof AmbientItemSchema>
export type BlockItem = Extract<AmbientItem, { kind: "block" }>

const PlanImageSchema = z.object({
  src: z.string().startsWith("data:image/"),
  /** Píxels de la imatge (per escalar-la). */
  pxW: z.number().positive(),
  pxH: z.number().positive(),
  /** Escala (mm per píxel), de la calibració de dos punts. */
  mmPerPx: z.number().positive(),
  /** Cantonada de dalt a l'esquerra de la imatge al plànol (mm). */
  x: mm,
  y: mm,
  opacity: z.number().min(0).max(1),
  locked: z.boolean().optional(),
})

/**
 * Com s'obre el Render d'aquest ambient (les escenes del catàleg el porten): ambient de llum i objectiu. Tolerant: un de
 * dolent es descarta.
 */
export const AmbientRenderSchema = z
  .object({
    mood: z.enum(["day", "dusk", "night"]).optional(),
    focal: z.number().min(10).max(200).optional(),
  })
  .optional()
  .catch(undefined)
export type AmbientRender = z.infer<typeof AmbientRenderSchema>

/** Claraboia (finestra a la teulada): el centre i la mida al plànol, mm. */
export const SkylightSchema = z.object({ x: mm, y: mm, w: mm.positive(), d: mm.positive() })
export type Skylight = z.infer<typeof SkylightSchema>

/**
 * Teulada de l'ambient (per decisió de l'usuari, 2026-10-14): plana, a una aigua o a dues aigües (la «V» de casa), sobre
 * la caixa de les parets amb el voladís, a l'alçada de la paret més alta (o `height`). `ridge` = la direcció del carener
 * (X o Y del plànol): l'aigua baixa cap als dos costats de l'altre eix (a una aigua, puja cap al final de l'altre eix).
 */
export const RoofSchema = z.object({
  kind: z.enum(["flat", "shed", "gable"]),
  pitch: z.number().min(0).max(70).default(30),
  ridge: z.enum(["x", "y"]).default("x"),
  overhang: mm.min(0).max(3000).default(300),
  thickness: mm.min(20).max(1000).default(200),
  height: mm.positive().optional(),
  material: z.string().optional(),
  skylights: z.array(SkylightSchema).optional(),
})
export type Roof = z.infer<typeof RoofSchema>

export const AmbientSchema = z.object({
  walls: z.array(WallSchema),
  items: z.array(AmbientItemSchema),
  plan: PlanImageSchema.optional(),
  /** Materials de simulació del terra i de les parets (nom de preferències). */
  floorMaterial: z.string().optional(),
  wallMaterial: z.string().optional(),
  /** Terra de fora (una habitació tancada amb coses fora, com arbres davant d'una finestra; sense, «Gespa»). */
  outsideFloorMaterial: z.string().optional(),
  /** Material del sostre (sense, pintura blanca). */
  ceilingMaterial: z.string().optional(),
  /** Última càmera del 3D (es desa sense tocar la data ni el desfer). Opcional. */
  camera: CameraPoseSchema,
  /** Com s'obre el Render (`AmbientRenderSchema`). Opcional. */
  render: AmbientRenderSchema,
  /** Teulada (`RoofSchema`). Sense, cap. */
  roof: RoofSchema.optional(),
})
export type Ambient = z.infer<typeof AmbientSchema>

export const EMPTY_AMBIENT: Ambient = { walls: [], items: [], floorMaterial: "Parquet de roure", wallMaterial: "Pintura blanca" }

/** Llegeix un ambient desat: el que no sigui vàlid es descarta (mai llança). */
export function parseAmbient(raw: unknown): Ambient {
  // Noms de material antics («… (foto)»): els vigents.
  return aliasMaterialRefs(parseAmbientData(raw))
}

function parseAmbientData(raw: unknown): Ambient {
  const r = AmbientSchema.safeParse(raw)
  if (r.success) return r.data
  const o = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>
  const list = <T>(v: unknown, s: z.ZodType<T>): T[] => (Array.isArray(v) ? v.flatMap((x) => { const p = s.safeParse(x); return p.success ? [p.data] : [] }) : [])
  const plan = PlanImageSchema.safeParse(o.plan)
  return {
    ...EMPTY_AMBIENT,
    // Paret a paret i, dins de cada una, obertura a obertura: una finestra dolenta (o un material propi dolent) no
    // treu tota la paret.
    walls: Array.isArray(o.walls) ? (repairValue(z.array(WallSchema), o.walls, [], () => {}) ?? []) : [],
    items: list(o.items, AmbientItemSchema),
    ...(plan.success ? { plan: plan.data } : {}),
    ...(typeof o.floorMaterial === "string" ? { floorMaterial: o.floorMaterial } : {}),
    ...(typeof o.wallMaterial === "string" ? { wallMaterial: o.wallMaterial } : {}),
    ...(typeof o.ceilingMaterial === "string" ? { ceilingMaterial: o.ceilingMaterial } : {}),
    ...(typeof o.outsideFloorMaterial === "string" ? { outsideFloorMaterial: o.outsideFloorMaterial } : {}),
    ...(parseCameraPose(o.camera) ? { camera: parseCameraPose(o.camera) } : {}),
    ...(AmbientRenderSchema.parse(o.render) ? { render: AmbientRenderSchema.parse(o.render) } : {}),
    ...(RoofSchema.safeParse(o.roof).success ? { roof: RoofSchema.parse(o.roof) } : {}),
  }
}
