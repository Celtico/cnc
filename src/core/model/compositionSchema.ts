import { z } from "zod"
import { MeshCageSchema } from "./meshShape"
import { ImageReliefSchema } from "./imageRelief"
import { BPtSchema, ProfileNodeSchema } from "./panel"
import { flatten, profileToOutline, toNodes, type BPt } from "./polygon"
import { CameraPoseSchema } from "./camera"
import { VIEW_FLAGS } from "./viewFlags"
import { FreePartSchema, JoinerySchema } from "./freePart"
import { HardwarePlacementSchema } from "./hardware"
import { ModuleSchema, PlinthSidesSchema } from "./moduleSchema"
import { FloorSupportSchema } from "./supportSchema"

/** Model de composició (vegeu `moduleSchema.ts`): objectes, peces corregudes, models 3D, illes i la composició. */

const mm = z.number().finite()

/** Objecte fantasma: no genera peces, serveix per comprovar que tot hi cap. */
export const RefObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Grup (com les peces i els models; per decisió de l'usuari, 2026-10-16). Opcional. */
  group: z.string().optional(),
  ...VIEW_FLAGS,
  w: mm.positive(),
  h: mm.positive(),
  d: mm.positive(),
  /** Posició de la cantonada baix-esquerra-darrere en coordenades de la composició. */
  x: mm,
  y: mm,
  z: mm,
  /**
   * Obstacle (per defecte): no toca la fusta, avisa si xoca amb el moble. Talla: fa un
   * forat passant a cada peça que travessa (tubs, endolls, passacables…).
   */
  effect: z.enum(["obstacle", "cut"]).optional(),
  /**
   * Caixa (per defecte), cilindre, perfil 2D extrudit, **forma lliure** (`mesh`: la caixa de control suavitzada, l'editor de
   * malla) o **relleu d'una imatge** (`image`), dins de la caixa w × h × d.
   */
  shape: z.enum(["box", "cylinder", "profile", "mesh", "image"]).optional(),
  /** Forma lliure (`shape: "mesh"`): la caixa de control, de 0 a 1 dins de la caixa (`MeshCageSchema`). */
  mesh: MeshCageSchema.optional(),
  /** Relleu d'una imatge en blanc i negre (`shape: "image"`): els grisos són l'alçada dins de la caixa (`ImageReliefSchema`). */
  image: ImageReliefSchema.optional(),
  /**
   * Perfil (forma «profile»): contorn de la secció en mm, amb la cantonada mínima a (0, 0).
   * Coordenades (u, v) del pla perpendicular a la direcció: z → (x, y), y → (x, z), x → (z, y).
   */
  profile: z.array(z.union([ProfileNodeSchema, BPtSchema])).min(3).optional(),
  /**
   * Direcció: eix del cilindre i, als objectes que tallen, la direcció del tall (només foraden
   * les peces perpendiculars). z cap a la paret (per defecte), y vertical, x de costat.
   */
  axis: z.enum(["x", "y", "z"]).optional(),
  /**
   * Material (nom de Preferències): l'objecte es veu sòlid amb aquest material i surt a la Presentació i al
   * render (p. ex. una tele, un radiador). Sense, és un fantasma translúcid que no surt al render.
   */
  material: z.string().optional(),
  /**
   * Objecte que talla sense travessar: radi del fons (mm). La peça hi fa un buidat amb el fons arrodonit, com una pica (la
   * paret recta i un quart de cercle fins al fons; per decisió de l'usuari, 2026-10-17). Sense: de fons pla.
   */
  round: mm.positive().optional(),
  /** Enganxat al terra: y = 0 sempre; al 3D només es mou pel terra. */
  onFloor: z.boolean().optional(),
  /** Enganxat a la paret: z = 0 sempre (tocant la paret); al 3D només es mou per la paret. */
  onWall: z.boolean().optional(),
})
export type RefObject = z.infer<typeof RefObjectSchema>

/** Aplica els enganxaments (terra: y = 0; paret: z = 0). */
export function anchorRef<T extends RefObject>(o: T): T {
  if (!o.onFloor && !o.onWall) return o
  return { ...o, ...(o.onFloor ? { y: 0 } : {}), ...(o.onWall ? { z: 0 } : {}) }
}

/** Índex de cada eix (0 = x, 1 = y, 2 = z). */
export const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const

/** Eixos (u, v) del pla de la secció per a cada direcció, com a índexs 0 = x, 1 = y, 2 = z. */
export const SECTION_AXES = { z: [0, 1], y: [0, 2], x: [2, 1] } as const

/**
 * Secció d'un objecte en el pla perpendicular a la seva direcció, en coordenades de la
 * composició: `u`, `v` = índexs dels eixos del pla, `a` = eix de la direcció (i el seu
 * interval), i el contorn (polígon, o cercle si és un cilindre).
 */
export function refSection(o: RefObject): {
  a: 0 | 1 | 2
  u: 0 | 1 | 2
  v: 0 | 1 | 2
  range: [number, number]
  circle?: { cu: number; cv: number; r: number }
  /** Contorn en polígon (arcs aproximats), per als xocs. */
  poly: [number, number][]
  /** Contorn exacte amb arcs (bulge), només als perfils: és el que es talla. */
  outline?: BPt[]
} {
  const axis = o.axis ?? "z"
  const a = AXIS_INDEX[axis]
  const [u, v] = SECTION_AXES[axis]
  const min = [o.x, o.y, o.z]
  const size = [o.w, o.h, o.d]
  const range: [number, number] = [min[a]!, min[a]! + size[a]!]
  const u0 = min[u]!, v0 = min[v]!, su = size[u]!, sv = size[v]!
  if (o.shape === "cylinder") {
    const r = Math.min(su, sv) / 2
    const cu = u0 + su / 2, cv = v0 + sv / 2
    const poly = Array.from({ length: 32 }, (_, i) => [cu + r * Math.cos((i / 32) * Math.PI * 2), cv + r * Math.sin((i / 32) * Math.PI * 2)] as [number, number])
    return { a, u, v, range, circle: { cu, cv, r }, poly }
  }
  if (o.shape === "profile" && o.profile && o.profile.length >= 3) {
    const outline = profileToOutline(toNodes(o.profile).map((p) => ({ ...p, x: u0 + p.x, y: v0 + p.y })))
    return { a, u, v, range, poly: flatten(outline), outline }
  }
  return { a, u, v, range, poly: [[u0, v0], [u0 + su, v0], [u0 + su, v0 + sv], [u0, v0 + sv]] }
}

/** Forat d'encastar al taulell (placa, pica o a mida), centrat al mòdul de sota. */
export const WorktopCutoutSchema = z.object({
  id: z.string(),
  kind: z.enum(["hob", "sink", "custom"]),
  /** Mòdul de sota: el forat es centra en la seva amplada. */
  module: z.string(),
  w: mm.positive(),
  d: mm.positive(),
  /** Desplaçament del centre respecte al centre del mòdul (+ a la dreta). */
  dx: mm,
  /** Distància del cantell de davant del taulell al forat; buit = centrat en fondària. */
  front: mm.min(0).optional(),
})
type WorktopCutout = z.infer<typeof WorktopCutoutSchema>

/**
 * Peces corregudes que van d'un mòdul a un altre (de la fila): el taulell de sobre dels
 * baixos i el sòcol de davant de les potes, d'una sola peça «de punta a punta».
 */
export const RunSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("worktop"),
    from: z.string(),
    to: z.string(),
    material: z.string(),
    thickness: mm.positive(),
    /** Voladís per davant dels fronts (mm). */
    overhangFront: mm.min(0),
    overhangLeft: mm.min(0),
    overhangRight: mm.min(0),
    cutouts: z.array(WorktopCutoutSchema),
    /** Apagat: es conserva però no es fa (`migrateRuns`). */
    off: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("plinth"),
    from: z.string(),
    to: z.string(),
    material: z.string(),
    thickness: mm.positive(),
    /** Retranqueig respecte a la cara dels fronts (mm). */
    setback: mm.min(0),
    /** Apagat: es conserva però no es fa (`migrateRuns`). */
    off: z.boolean().optional(),
    /**
     * Retorns als extrems vistos de la fila (`left`, `right`, de la cara dels fronts fins a la paret, a `sideSetback` del
     * lateral), les cantonades i el sòcol d'alumini (`hardware`): les mateixes opcions que el sòcol de la base «Potes»
     * (`PlinthSidesSchema`; aquí sense darrere: la fila va contra la paret). Sense UI, com la resta de peces corregudes.
     */
    ...PlinthSidesSchema.omit({ back: true }).shape,
  }),
])
export type Run = z.infer<typeof RunSchema>
export type WorktopRun = Extract<Run, { kind: "worktop" }>
export type PlinthRun = Extract<Run, { kind: "plinth" }>

/** Mides estàndard d'encastar (mm): vitro de 60 i pica d'una cubeta. */
export const CUTOUT_PRESETS: Record<WorktopCutout["kind"], { w: number; d: number; label: string }> = {
  hob: { w: 560, d: 490, label: "Placa (vitro / inducció)" },
  sink: { w: 740, d: 440, label: "Pica" },
  custom: { w: 400, d: 300, label: "A mida" },
}

/**
 * Tipus de moble: es tria en crear-lo («Nou moble»: Moble · Cuina · Armari · Taula) i no es canvia després. Només
 * decideix què s'afegeix amb «Afegir mòdul» (Taula), l'etiqueta de la targeta i, `objecte`, que no es fabrica.
 * `lliure` (el Flat-pack d'abans: només peces, sense mòduls fets) ja no es crea; els que hi ha continuen igual.
 * Opcional: els antics es dedueixen (`compositionKind`).
 */
export const CompositionKindSchema = z.enum(["moble", "cuina", "armari", "taula", "lliure", "objecte"])
export type CompositionKind = z.infer<typeof CompositionKindSchema>

/**
 * Model 3D (malla de debò, `.glb`: plantes, decoració…) dins d'un objecte o moble: només es veu (visor, ambients,
 * miniatures, render), no es fabrica. `src` és l'id d'un model de l'app (`MODEL_ASSETS`). Es col·loca com una peça
 * lliure: la cantonada (x, y, z) i la caixa que ocupa (w, h, d, mm); el model s'hi escala. `rot`: gir al voltant del
 * vertical (graus).
 */
export const ModelObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  ...VIEW_FLAGS,
  /** Grup (nom), el mateix que el de les peces lliures: un grup pot tenir peces i models (es mouen junts). */
  group: z.string().optional(),
  /**
   * Material de Preferències per a tot el model, en lloc de les textures del fitxer (per decisió de l'usuari, 2026-10-14).
   * Sense, «Com el fitxer».
   */
  material: z.string().optional(),
  src: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  d: z.number().positive(),
  rot: z.number().default(0),
})
export type ModelObject = z.infer<typeof ModelObjectSchema>

/**
 * **Illa** (per decisió de l'usuari, 2026-10-13: «fiquem les opcions que diuen els professionals»): dos mòduls d'esquena,
 * com es fan les illes de cuina (dues files de mòduls cargolades, fronts enrasats). El de darrere (`back`) es gira 180° i
 * es posa sol, enganxat al darrere del de davant (`front`), amb la mateixa X i a `gap` mm (pas de cables); la seva
 * posició pròpia no es llegeix. `left`/`right`: **panells de remat** d'una sola peça que cobreixen les dues files de dalt
 * a baix (`thickness`, `material`; sense: 19 mm i el material dels fronts del de davant). Tots dos «Lliure al terra».
 * Construcció a `core/build/islands.ts`.
 */
export const IslandSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  gap: mm.min(0).default(0),
  left: z.boolean().default(true),
  right: z.boolean().default(true),
  thickness: z.number().positive().max(60).optional(),
  material: z.string().optional(),
})
export type Island = z.infer<typeof IslandSchema>

export const CompositionSchema = z.object({
  kind: CompositionKindSchema.optional(),
  modules: z.array(ModuleSchema),
  references: z.array(RefObjectSchema),
  /**
   * Suport de tots els mòduls de terra i el sòcol de cada tram (`supportSchema.ts`, `floorSupport.ts`). Sense (els mobles
   * d'abans), es dedueix dels mòduls en obrir-los (`withSupport`).
   */
  support: FloorSupportSchema.optional(),
  /** Taulells i sòcols correguts. Opcional (els mobles antics no en tenen). Els sòcols passen al suport (`withSupport`). */
  runs: z.array(RunSchema).optional(),
  /** Peces lliures (flat-pack, encaixos). Opcional. */
  parts: z.array(FreePartSchema).optional(),
  /** Models 3D (`.glb`) que només es veuen. Opcional. */
  models: z.array(ModelObjectSchema).optional(),
  /** Encaixos de les peces lliures (joc, fresa, pestanyes). Sense: `DEFAULT_JOINERY`. */
  joinery: JoinerySchema.optional(),
  /**
   * Acabats de l'escena on es presenta (mode Presentació i miniatura): material del terra i de la paret, com
   * els dels ambients. Sense (o buit), els de Preferències › Visor 3D. `rightWallX`: on és la paret dreta (mm des de
   * l'esquerra) quan hi ha mòduls d'esquena a ella; la fixa `withRightWall` perquè no es mogui quan es mouen els altres.
   */
  scene: z.object({ floor: z.string().optional(), wall: z.string().optional(), leftWall: z.boolean().optional(), rightWall: z.boolean().optional(), rightWallX: z.number().min(0).optional() }).optional(),
  /** Última càmera del visor 3D (es desa sense marcar el moble com a modificat). Opcional. */
  camera: CameraPoseSchema,
  /**
   * Ferratges col·locats a mà en una peça (generador de mecanitzats, `hardwareOps.ts`): una còpia de cada item. Cadascun
   * es llegeix sencer o es treu (`repairAtomically`): mai mig ferratge. Un `.moble` que en porta és v3.
   */
  hardwarePlacements: z.array(HardwarePlacementSchema).optional(),
  /** Illes: mòduls d'esquena amb panells de remat (`IslandSchema`). Opcional. */
  islands: z.array(IslandSchema).optional(),
  /**
   * Avisos que l'usuari ha acceptat («Ho faig a mà»: un penjador amb escaire a la columna…), per la seva clau
   * (`warningKey`): surten com a informació i no compten. Per decisió de l'usuari, 2026-10-17.
   */
  acceptedWarnings: z.array(z.string()).optional(),
})
export type Composition = z.infer<typeof CompositionSchema>
