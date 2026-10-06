import { z } from "zod"
import { DEFAULT_CABINET, type CabinetParams } from "./cabinet"
import { BPtSchema, ProfileNodeSchema } from "./panel"
import { flatten, profileToOutline, sampleProfile, toNodes, type BPt } from "./polygon"
import { CameraPoseSchema } from "./camera"
import { aliasMaterialRefs } from "./photoUpgrade"
import { FreePartSchema, JoinerySchema, PART_AXES as PART_AXES_C, tidyPart, type FreePart } from "./freePart"
import { DEFAULT_LEGACY_HARDWARE, HardwareItemSchema, HardwareKitSchema, isLegacyHardware, kitFromLegacy, migrateModuleHardware, type HardwareKit } from "./hardware"

/**
 * Model de composició: mòduls d'esquerra a dreta, cadascun amb una carcassa i un
 * arbre de zones (divisions i continguts). Totes les mides en mm.
 */

const mm = z.number().finite()
const sizeOrAuto = z.union([mm.positive(), z.literal("auto")])

// --- Ferratges per defecte ---------------------------------------------------------

/**
 * Ferratges del mòdul: una còpia dels items de la biblioteca (`HardwareKit`, `core/model/hardware.ts`). Els mòduls desats
 * abans de la v19 hi porten els números d'abans: es converteixen en llegir-los (`migrateModuleHardware`), amb els mateixos
 * números (res no canvia de lloc).
 */
export const ModuleHardwareSchema = z.preprocess(migrateModuleHardware, HardwareKitSchema)

// --- Carcassa ----------------------------------------------------------------------

export const BaseSchema = z.discriminatedUnion("kind", [
  /** Base a terra (com el mòdul de caixa actual). */
  z.object({ kind: z.literal("none") }),
  /** Sòcol: laterals fins a terra, base aixecada i frontal de sòcol retranquejat. */
  z.object({ kind: z.literal("plinth"), height: mm.positive(), setback: mm.min(0) }),
  /** Potes: cap peça; el mòdul s'aixeca al 3D. */
  z.object({ kind: z.literal("legs"), height: mm.positive() }),
  /** Sense base: laterals fins a terra i el buit obert (cobreradiador). */
  z.object({ kind: z.literal("open") }),
  /** Penjat a la paret: cap peça de base; `height` = alçada de la base del mòdul des del terra. */
  z.object({ kind: z.literal("wall"), height: mm.min(0) }),
])
export type Base = z.infer<typeof BaseSchema>

export const GrillePatternSchema = z.object({
  kind: z.enum(["slotsV", "slotsH", "holes"]),
  slotWidth: mm.positive(),
  slotGap: mm.positive(),
  margin: mm.min(0),
  holeDiameter: mm.positive(),
  holePitch: mm.positive(),
})
export type GrillePattern = z.infer<typeof GrillePatternSchema>

export const DEFAULT_GRILLE: GrillePattern = {
  kind: "slotsV",
  slotWidth: 8,
  slotGap: 8,
  margin: 60,
  holeDiameter: 10,
  holePitch: 16,
}

export const TopSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("full") }),
  /** Tapa escurçada que deixa una ranura d'aire al darrere. */
  z.object({ kind: z.literal("ventSlot"), gap: mm.positive() }),
  z.object({ kind: z.literal("grille"), pattern: GrillePatternSchema }),
  z.object({ kind: z.literal("none") }),
])
export type Top = z.infer<typeof TopSchema>

export const CarcassSchema = z.object({
  width: mm.min(100).max(3000),
  height: mm.min(100).max(2800),
  depth: mm.min(100).max(1200),
  material: z.string(),
  thickness: mm.min(8).max(40),
  /** Material de portes, fronts de calaix, abatibles, reixetes i fronts fixos. Buit = el del cos. */
  frontMaterial: z.string().optional(),
  backMaterial: z.string(),
  backThickness: mm.min(3).max(40),
  base: BaseSchema,
  /**
   * Fons: en ranura, cargolat per darrere, encastat (entre laterals, tapa i base, amb espigues:
   * pot ser del mateix tauler que el cos) o sense.
   */
  back: z.enum(["groove", "screwed", "inset", "none"]),
  top: TopSchema,
  sides: z.object({ left: z.boolean(), right: z.boolean() }),
  /**
   * Unió de la tapa amb els laterals. Normal (per defecte): la tapa entre laterals, amb
   * espigues. Inglet: tapa i laterals tallats a 45° a la cantonada (no es veu cap cantell),
   * encolats amb lamel·les o Clamex.
   */
  joint: z.enum(["butt", "mitre"]).optional(),
  /**
   * Parets buides: laterals, base i tapa (sencera) fetes com una caixa de dues pells amb
   * llistons a dins i una tira al davant, amb aquest gruix aparent (mm). L'interior (portes,
   * calaixos, prestatges) va igual, contra la pell de dins.
   */
  hollow: z.object({ thickness: mm.min(20).max(300) }).optional(),
  /**
   * Tauler de taula: la tapa va per sobre dels laterals (que fan de potes), sobresurt
   * `overhang` mm per tot el voltant i pot tenir forma (`shape`: perfil de Bézier en mm,
   * s'escala a la mida del tauler). Només amb la tapa sencera.
   */
  tableTop: z.object({ overhang: mm.min(0).max(1000), shape: z.array(ProfileNodeSchema).min(3).optional() }).optional(),
  // Fusteria
  backSetback: mm.min(0).max(60),
  /** Fons encastat: distància del cantell posterior dels laterals al fons (0 = enrasat). */
  backInsetSetback: mm.min(0).max(60).optional(),
  grooveDepth: mm.min(3).max(15),
  backClearance: mm.min(0).max(4),
  shelfSetback: mm.min(0).max(100),
  shelfClearance: mm.min(0).max(5),
})
export type Carcass = z.infer<typeof CarcassSchema>

// --- Fronts i zones ----------------------------------------------------------------

export const FrontSchema = z.discriminatedUnion("kind", [
  /** `glass`: porta de vidre amb marc de perfil d'alumini (vitrina): no és de CNC (`glassDoor`). */
  // `hardware`: el ferratge triat per a aquest front (còpia d'un item de la biblioteca: frontissa, guia o braç); sense, el
  // del mòdul (`Module.hardware`).
  z.object({ kind: z.literal("door"), mode: z.enum(["single", "double"]), hinge: z.enum(["left", "right"]), glass: z.boolean().optional(), hardware: HardwareItemSchema.optional() }),
  z.object({ kind: z.literal("drawers"), n: z.number().int().min(1).max(10), heights: z.array(sizeOrAuto), hardware: HardwareItemSchema.optional() }),
  z.object({ kind: z.literal("flap"), dir: z.enum(["down", "up"]), hardware: HardwareItemSchema.optional() }),
  z.object({
    kind: z.literal("grille"),
    pattern: GrillePatternSchema,
    mount: z.enum(["removable", "hinged"]),
    hinge: z.enum(["left", "right"]),
    /** Trapa petita, en coordenades de la zona (des de baix-esquerra de la llum). */
    hatch: z.object({ x: mm, y: mm, w: mm.positive(), h: mm.positive() }).optional(),
  }),
  z.object({ kind: z.literal("panel") }),
])
export type Front = z.infer<typeof FrontSchema>

export interface Zone {
  id: string
  split?: { dir: "v" | "h"; sizes: (number | "auto")[]; children: Zone[] }
  shelves?: { n: number; adjustable: boolean; thickness?: number; flush?: boolean }
  front?: Front
  /** Barra de penjar (tub d'inox Ø25 a 50 mm del sostre del compartiment). */
  rail?: boolean
  /** Llum LED: perfil amb tira LED sota el sostre del compartiment i sota cada prestatge (render i llista; no és de CNC). */
  led?: boolean
}

export const ZoneSchema: z.ZodType<Zone> = z.lazy(() =>
  z.object({
    id: z.string(),
    split: z
      .object({
        dir: z.enum(["v", "h"]),
        sizes: z.array(sizeOrAuto),
        children: z.array(ZoneSchema).min(2),
      })
      .optional(),
    shelves: z
      .object({
        n: z.number().int().min(0).max(20),
        adjustable: z.boolean(),
        /**
         * Prestatges gruixuts (buits): gruix aparent en mm. Dues pells, llistons i una tira al
         * davant, com les parets buides. Sense: del gruix del tauler.
         */
        thickness: mm.min(20).max(200).optional(),
        /** A ras del davant de la caixa (a sang), sense retranqueig: per als compartiments oberts. */
        flush: z.boolean().optional(),
      })
      .optional(),
    front: FrontSchema.optional(),
    rail: z.boolean().optional(),
    led: z.boolean().optional(),
  }),
)

/**
 * Passacables: forat passant al centre (x, y) d'una peça de la carcassa, en coordenades
 * del mòdul segons la peça: fons → x des de l'esquerra, y des de baix; tapa i base → x des
 * de l'esquerra, y des del darrere; laterals → x des del darrere, y des de baix.
 * Rodó (Ø) o rectangular (w × h: w en la direcció de x). Amb `ref`, el centre segueix
 * l'objecte de referència (x i y es recalculen en construir la composició).
 */
export const CableHoleSchema = z.object({
  panel: z.enum(["back", "top", "bottom", "left", "right"]),
  x: mm,
  y: mm,
  diameter: mm.positive(),
  shape: z.enum(["circle", "rect"]).optional(),
  w: mm.positive().optional(),
  h: mm.positive().optional(),
  ref: z.string().optional(),
})
export type CableHole = z.infer<typeof CableHoleSchema>

/**
 * Centre (i mida de l'objecte, per a «mida de l'objecte») d'un objecte de referència
 * projectat sobre una peça de la carcassa, en les coordenades del passacables.
 * `at` = cantonada baix-esquerra-darrere del mòdul a la composició.
 */
export function refOnPanel(r: RefObject, panel: CableHole["panel"], at: { x: number; y: number }): { x: number; y: number; w: number; h: number } {
  const cx = r.x + r.w / 2 - at.x
  const cy = r.y + r.h / 2 - at.y
  const cz = r.z + r.d / 2
  if (panel === "back") return { x: cx, y: cy, w: r.w, h: r.h }
  if (panel === "top" || panel === "bottom") return { x: cx, y: cz, w: r.w, h: r.d }
  return { x: cz, y: cy, w: r.d, h: r.h }
}

/** Mecanitzats extra de la carcassa que no depenen de cap zona. */
export const CarcassExtrasSchema = z.object({
  /** Passacables (forats passants) a les peces de la carcassa. */
  cableHoles: z.array(CableHoleSchema),
})

export const ModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Separació respecte al mòdul anterior de la seva fila (o a l'origen si és el primer). */
  gapBefore: mm.min(0),
  /**
   * Només a terra. Sense: «A la paret» (arrambat, el darrere tocant la paret). Amb valor:
   * «Al terra», lliure: a aquesta distància de la paret (mm) i es mou pel terra.
   */
  wallGap: mm.min(0).optional(),
  /**
   * Només «Al terra» (lliure): posició X pròpia (mm des de l'origen). No segueix la fila ni
   * n'empeny els altres: així es pot posar una illa davant de la cuina. Sense: segueix la fila.
   */
  x: mm.optional(),
  carcass: CarcassSchema,
  root: ZoneSchema,
  fronts: z.object({
    outerGap: mm.min(0).max(10),
    betweenGap: mm.min(0).max(10),
    /**
     * Com van els fronts respecte a la caixa. Recobrents (per defecte): per davant, tapant els
     * cantells dels laterals. Encastats: dins de la llum, a nivell amb el davant de la caixa.
     */
    style: z.enum(["overlay", "inset"]).optional(),
    /** Tiradors: barra (per defecte, dos forats Ø5) o cap (obertura per pressió: cal un ferratge push). */
    handles: z.enum(["bar", "none"]).optional(),
  }),
  hardware: ModuleHardwareSchema,
  extras: CarcassExtrasSchema,
  /**
   * OBSOLET: ancoratge a un altre mòdul (versions anteriors). Ja no es crea: en carregar
   * es converteix a les dues files amb `normalizeComposition`.
   */
  anchor: z
    .object({
      module: z.string(),
      dx: mm,
      /** On es col·loca respecte a l'altre: a sobre (per defecte), a la dreta o a l'esquerra. */
      at: z.enum(["top", "right", "left"]).optional(),
    })
    .optional(),
})
export type Module = z.infer<typeof ModuleSchema>

/** Objecte fantasma: no genera peces, serveix per comprovar que tot hi cap. */
export const RefObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
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
  /** Caixa (per defecte), cilindre o perfil 2D extrudit, dins de la caixa w × h × d. */
  shape: z.enum(["box", "cylinder", "profile"]).optional(),
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
export type WorktopCutout = z.infer<typeof WorktopCutoutSchema>

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

export const CompositionSchema = z.object({
  kind: CompositionKindSchema.optional(),
  modules: z.array(ModuleSchema),
  references: z.array(RefObjectSchema),
  /** Taulells i sòcols correguts. Opcional (els mobles antics no en tenen). */
  runs: z.array(RunSchema).optional(),
  /** Peces lliures (flat-pack, encaixos). Opcional. */
  parts: z.array(FreePartSchema).optional(),
  /** Models 3D (`.glb`) que només es veuen. Opcional. */
  models: z.array(ModelObjectSchema).optional(),
  /** Encaixos de les peces lliures (joc, fresa, pestanyes). Sense: `DEFAULT_JOINERY`. */
  joinery: JoinerySchema.optional(),
  /**
   * Acabats de l'escena on es presenta (mode Presentació i miniatura): material del terra i de la paret, com
   * els dels ambients. Sense (o buit), els de Preferències › Visor 3D.
   */
  scene: z.object({ floor: z.string().optional(), wall: z.string().optional() }).optional(),
  /** Última càmera del visor 3D (es desa sense marcar el moble com a modificat). Opcional. */
  camera: CameraPoseSchema,
})
export type Composition = z.infer<typeof CompositionSchema>

// --- Utilitats ---------------------------------------------------------------------

let counter = 0
export function newId(prefix = "z"): string {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}

/** Recorre l'arbre de zones (pre-ordre). */
export function walkZones(zone: Zone, fn: (z: Zone, parent: Zone | null) => void, parent: Zone | null = null): void {
  fn(zone, parent)
  zone.split?.children.forEach((c) => walkZones(c, fn, zone))
}

export function findZone(root: Zone, id: string): Zone | undefined {
  let found: Zone | undefined
  walkZones(root, (z) => {
    if (z.id === id) found = z
  })
  return found
}

/** Alçada de la base del mòdul sobre el terra (potes o penjat a la paret), sense comptar ancoratges. */
export function moduleElevation(c: { base: Base }): number {
  return c.base.kind === "legs" || c.base.kind === "wall" ? c.base.height : 0
}

/** Cantonada baix-esquerra-darrere de cada mòdul dins de la composició (mm). */
export interface ModulePlacement {
  x: number
  y: number
  /** Separació de la paret (mòduls «Al terra»); 0 o absent: arrambat. */
  z?: number
}

/** On va un mòdul: arrambat a la paret, penjat, o al terra lliure. */
export type ModuleMount = "wall" | "hung" | "floor"
/** Mòdul al terra lliure amb posició X pròpia (fora de la fila). */
export const freeX = (m: Module): boolean => m.x !== undefined && m.carcass.base.kind !== "wall" && m.wallGap !== undefined

export const mountOf = (m: Module): ModuleMount => (m.carcass.base.kind === "wall" ? "hung" : m.wallGap !== undefined ? "floor" : "wall")

/** Fila d'un mòdul: a terra (baixos) o penjat a la paret (alts). */
export type ModuleRow = "floor" | "wall"
export const rowOf = (m: Module): ModuleRow => (m.carcass.base.kind === "wall" ? "wall" : "floor")

/**
 * Posició de cada mòdul. Hi ha dues files, cadascuna d'esquerra a dreta en l'ordre de la
 * composició (el mateix de l'arbre): la de terra i la dels penjats a la paret. Cada mòdul
 * va al costat de l'anterior de la seva fila, amb la seva separació; y = potes o alçada
 * del penjat.
 */
export function modulePlacements(comp: Composition): ModulePlacement[] {
  const cursor: Record<ModuleRow, number> = { floor: 0, wall: 0 }
  return comp.modules.map((m) => {
    const row = rowOf(m)
    // Al terra amb X pròpia (illa): fora de la fila, no mou el cursor.
    if (freeX(m)) return { x: m.x!, y: moduleElevation(m.carcass), ...(m.wallGap ? { z: m.wallGap } : {}) }
    const x = cursor[row] + m.gapBefore
    cursor[row] = x + m.carcass.width
    return { x, y: moduleElevation(m.carcass), ...(row === "floor" && m.wallGap ? { z: m.wallGap } : {}) }
  })
}

/** Posicions amb els ancoratges antics (`anchor`), només per migrar mobles guardats. */
function legacyPlacements(comp: Composition): ModulePlacement[] {
  const n = comp.modules.length
  const anchored = (m: Module) => !!m.anchor && m.anchor.module !== m.id && comp.modules.some((t) => t.id === m.anchor!.module)
  const out: (ModulePlacement | undefined)[] = new Array(n)
  let x = 0
  comp.modules.forEach((m, i) => {
    if (anchored(m)) return
    x += m.gapBefore
    out[i] = { x, y: moduleElevation(m.carcass) }
    x += m.carcass.width
  })
  for (let pass = 0; pass < n; pass++) {
    comp.modules.forEach((m, i) => {
      if (out[i] || !m.anchor) return
      const ti = comp.modules.findIndex((t) => t.id === m.anchor!.module)
      const t = out[ti]
      if (!t) return
      const target = comp.modules[ti]!
      const at = m.anchor.at ?? "top"
      const wall = m.carcass.base.kind === "wall" ? m.carcass.base.height : null
      if (at === "top") out[i] = { x: t.x + m.anchor.dx, y: wall ?? t.y + target.carcass.height + moduleElevation(m.carcass) }
      else out[i] = { x: at === "right" ? t.x + target.carcass.width + m.anchor.dx : t.x - m.carcass.width - m.anchor.dx, y: wall ?? t.y }
    })
  }
  return out.map((p, i) => p ?? { x: 0, y: moduleElevation(comp.modules[i]!.carcass) })
}

/**
 * Converteix els mòduls ancorats (versions anteriors) a les dues files: els que eren a
 * sobre d'un altre passen a penjats a l'alçada on eren; l'ordre de cada fila es refà
 * d'esquerra a dreta i les separacions es recalculen perquè tot quedi on era.
 */
export function normalizeComposition(raw: Composition): Composition {
  // Noms de material antics («… (foto)», v6 de les preferències): els vigents.
  const input = aliasMaterialRefs(raw)
  // Peces lliures amb decimals llargs (objectes fets abans d'arrodonir): al mm.
  const tidy = input.parts?.map(tidyPart)
  const tidied = tidy && tidy.some((p, i) => p !== input.parts![i]) ? { ...input, parts: tidy } : input
  // Flat-pack com a opció de les peces i taulell i sòcol a qualsevol moble (millores v1).
  const runs = migrateRuns(migrateFlatPack(tidied))
  // Ferratges d'abans (v19): els números del mòdul passen a una còpia dels items (els mateixos números).
  const comp = runs.modules.some((m) => isLegacyHardware(m.hardware))
    ? { ...runs, modules: runs.modules.map((m) => (isLegacyHardware(m.hardware) ? { ...m, hardware: migrateModuleHardware(m.hardware) as HardwareKit } : m)) }
    : runs
  if (!comp.modules.some((m) => m.anchor)) return comp
  const ps = legacyPlacements(comp)
  const items = comp.modules.map((m, i) => {
    const { anchor: _a, ...rest } = m
    void _a
    const y = ps[i]!.y
    const mod: Module = m.anchor && m.carcass.base.kind !== "wall" && y > 0 ? { ...rest, carcass: { ...rest.carcass, base: { kind: "wall", height: y } } } : rest
    return { mod, x: ps[i]!.x }
  })
  const modules: Module[] = []
  for (const row of ["floor", "wall"] as const) {
    let right = 0
    for (const it of items.filter((t) => rowOf(t.mod) === row).sort((a, b) => a.x - b.x)) {
      modules.push({ ...it.mod, gapBefore: Math.max(0, Math.round(it.x - right)) })
      right = Math.max(right, it.x + it.mod.carcass.width)
    }
  }
  return { ...comp, modules }
}

/** Amplada total: fins a la dreta del mòdul que arriba més lluny. */
export function compositionWidth(comp: Composition): number {
  const ps = modulePlacements(comp)
  return comp.modules.reduce((w, m, i) => Math.max(w, ps[i]!.x + m.carcass.width), 0)
}

/** Alçada total: fins a dalt del mòdul més alt (tenint en compte potes, penjats i apilats). */
export function compositionHeight(comp: Composition): number {
  const ps = modulePlacements(comp)
  return comp.modules.reduce((h, m, i) => Math.max(h, ps[i]!.y + m.carcass.height), 0)
}

// --- Migració del mòdul de caixa (CabinetParams) ----------------------------------

/** Converteix els paràmetres del mòdul de caixa (Fase 1) en un mòdul de composició equivalent. */
export function cabinetToModule(p: CabinetParams, id = "m1", name = "Mòdul"): Module {
  const front: Front | undefined =
    p.doors === 0 ? undefined : { kind: "door", mode: p.doors === 2 ? "double" : "single", hinge: "left" }
  return {
    id,
    name,
    gapBefore: 0,
    carcass: {
      width: p.width,
      height: p.height,
      depth: p.depth,
      material: p.material,
      thickness: p.panelThickness,
      backMaterial: p.backMaterial,
      backThickness: p.backThickness,
      base: { kind: "none" },
      back: p.backType,
      top: { kind: "full" },
      sides: { left: true, right: true },
      backSetback: p.backSetback,
      grooveDepth: p.grooveDepth,
      backClearance: p.backClearance,
      shelfSetback: p.shelfSetback,
      shelfClearance: p.shelfClearance,
    },
    root: {
      id: `${id}-root`,
      shelves: { n: p.shelves, adjustable: true },
      ...(front ? { front } : {}),
    },
    fronts: { outerGap: p.doorGap, betweenGap: p.doorGapBetween },
    hardware: kitFromLegacy({ ...DEFAULT_LEGACY_HARDWARE, hinge: p.hinge, system32: p.system32, dowel: p.dowel }),
    extras: { cableHoles: [] },
  }
}

export function cabinetToComposition(p: CabinetParams, name = "Mòdul"): Composition {
  return { modules: [cabinetToModule(p, "m1", name)], references: [] }
}

/** Mòdul nou amb valors per defecte (caixa buida amb prestatges regulables). */
/** Tipus d'una composició: el triat o, als antics, cuina si té taulell/sòcol corregut. */
export function compositionKind(c: Composition): CompositionKind {
  return c.kind ?? (c.runs?.length ? "cuina" : "moble")
}

/**
 * Només peces lliures (sense mòduls): el Flat-pack (amb encaixos, es fabrica) i l'**Objecte**
 * (sofà, làmpada, planta… per als ambients: peces amb forma, booleanes i textures, que només es
 * veuen i no es fabriquen).
 */
export const partsOnlyKind = (k: CompositionKind) => k === "lliure" || k === "objecte"

/**
 * La peça fa encaixos (Flat-pack, «Encaixos» de la peça): el camp `joinery` i, si encara no s'ha migrat, el del tipus
 * Flat-pack d'abans (`lliure`: totes menys les `joints: false`). Mai als objectes, que no es fabriquen.
 */
export function partJoinery(comp: Composition, p: FreePart): boolean {
  const kind = compositionKind(comp)
  if (kind === "objecte") return false
  return p.joinery ?? (kind === "lliure" && p.joints !== false)
}

/**
 * Migració en llegir (millores v1): el Flat-pack deixa de ser un tipus de moble i passa a ser una opció de cada peça
 * lliure (`joinery`, expressa). Al tipus `lliure`, cada peça porta el valor que tenia (`partJoinery`: el resultat
 * és el mateix); a la resta no se'n posa cap (no fan encaixos, com abans). El camp vell `joints` es treu. Idempotent:
 * si no hi ha res a fer, torna la mateixa composició.
 */
export function migrateFlatPack(comp: Composition): Composition {
  const parts = comp.parts
  if (!parts?.length) return comp
  const lliure = compositionKind(comp) === "lliure"
  if (!parts.some((p) => p.joints !== undefined || (lliure && p.joinery === undefined))) return comp
  return {
    ...comp,
    parts: parts.map((p) => {
      const { joints: _j, ...rest } = p
      void _j
      return lliure && p.joinery === undefined ? { ...rest, joinery: partJoinery(comp, p) } : rest
    }),
  }
}

/**
 * Migració en llegir (millores v1): el taulell i el sòcol correguts es poden posar a qualsevol moble (abans, només a
 * la Cuina; en canviar de tipus es guardaven sense fer-se). Els d'un moble que **no** és cuina queden apagats
 * (`off: true`): es veuen a «Taulell i sòcol» i es poden tornar a encendre, però no es fan (la fabricació no canvia).
 * Només els que encara no porten `off` (els nous en porten `off: false`). Idempotent.
 */
export function migrateRuns(comp: Composition): Composition {
  const runs = comp.runs
  if (!runs?.length || compositionKind(comp) === "cuina" || !runs.some((r) => r.off === undefined)) return comp
  return { ...comp, runs: runs.map((r) => (r.off === undefined ? { ...r, off: true } : r)) }
}

/** Taulells i sòcols que es fan: els que no estan apagats, a qualsevol moble amb mòduls fets. */
export function activeRuns(comp: Composition): Run[] {
  if (partsOnlyKind(compositionKind(comp))) return []
  return (migrateRuns(comp).runs ?? []).filter((r) => !r.off)
}

/**
 * Taula o consola de panells: tauler a dalt i dos laterals que fan de potes, sense base
 * ni fons, amb les cantonades a inglet (com un bloc massís).
 */
export function tableModule(id: string, name: string, overrides: Partial<Carcass> = {}): Module {
  const m = defaultModule(id, name, { width: 1400, height: 760, depth: 400, base: { kind: "open" }, back: "none", joint: "mitre", ...overrides })
  return { ...m, root: { id: newId() } }
}

export function defaultModule(id: string, name: string, overrides: Partial<Carcass> = {}): Module {
  const m = cabinetToModule({ ...DEFAULT_CABINET, doors: 0, shelves: 1 }, id, name)
  return { ...m, carcass: { ...m.carcass, ...overrides } }
}

// --- «Res amagat compta» -------------------------------------------------------------

/**
 * Cantonades (Normals / A inglet) es poden triar: hi ha algun lateral, les parets no són buides (amb parets buides
 * són sempre a inglet) i hi ha una tapa o una base a baix de tot dels laterals per unir-hi (amb sòcol la base queda
 * entre els laterals). És la mateixa condició que fa sortir el control a l'inspector: si no surt, `joint` no compta.
 */
export function jointApplies(c: Pick<Carcass, "sides" | "hollow" | "top" | "base">): boolean {
  if (!(c.sides.left || c.sides.right) || c.hollow) return false
  return c.top.kind !== "none" || (c.base.kind !== "open" && c.base.kind !== "plinth")
}

/**
 * El mòdul tal com el veu l'usuari: cada camp que la UI amaga perquè la seva opció és apagada es posa a un valor fix
 * (o es treu). Els camps amagats es **conserven** a la composició (tornar a encendre l'opció recupera els valors
 * d'abans), però `buildModule` construeix sempre a partir d'aquest mòdul: dos mòduls que es veuen iguals a l'inspector
 * fan les mateixes peces i els mateixos avisos, vingui d'on vingui l'estat (regla «res amagat compta»,
 * `build/hiddenState.test.ts`). Si una opció nova amaga camps, s'han d'afegir aquí.
 */
export function visibleModule(m: Module): Module {
  const c = m.carcass
  const carcass: Carcass = { ...c }
  // Fons: sense fons, ni material ni gruix (els fons dels calaixos agafen el del cos); la ranura (posició i joc) només
  // compta en ranura i la retirada només encastat.
  if (c.back === "none") {
    carcass.backMaterial = c.material
    carcass.backThickness = c.thickness
  }
  if (c.back !== "groove") {
    carcass.backSetback = DEFAULT_CABINET.backSetback
    carcass.backClearance = DEFAULT_CABINET.backClearance
  }
  if (c.back !== "inset") delete carcass.backInsetSetback
  // Cantonades: només si el control surt (`jointApplies`); «Normals» és l'absència.
  if (c.joint !== "mitre" || !jointApplies(c)) delete carcass.joint
  // Tauler de taula: només amb la tapa sencera.
  if (c.top.kind !== "full") delete carcass.tableTop
  const fronts = { ...m.fronts }
  if (fronts.style === "overlay") delete fronts.style
  if (fronts.handles === "bar") delete fronts.handles
  return { ...m, carcass, fronts, root: visibleZone(m.root) }
}

/** Un compartiment tal com es veu (vegeu `visibleModule`). */
function visibleZone(z: Zone): Zone {
  const out: Zone = { ...z }
  if (z.split) {
    // Un compartiment dividit no té prestatges ni barra (l'inspector no els ensenya).
    delete out.shelves
    delete out.rail
    delete out.led
    out.split = { ...z.split, children: z.split.children.map(visibleZone) }
  } else {
    // Sense prestatges (0): gruix i «a ras» no compten; «Regulables» sí (les fileres System 32 per posar-n'hi després),
    // i sense `shelves` és com no regulables.
    if (z.shelves && z.shelves.n <= 0) {
      if (z.shelves.adjustable) out.shelves = { n: 0, adjustable: true }
      else delete out.shelves
    } else if (z.shelves) {
      const s = { ...z.shelves }
      if (!s.flush) delete s.flush
      if (!s.thickness) delete s.thickness
      out.shelves = s
    }
    if (!z.rail) delete out.rail
    if (!z.led) delete out.led
  }
  const f = z.front
  if (f?.kind === "drawers") {
    // Els calaixos ocupen el compartiment: la secció Prestatges (prestatges, barra i llum) no surt.
    delete out.shelves
    delete out.rail
    delete out.led
    const heights = f.heights.slice(0, f.n)
    while (heights.length < f.n) heights.push("auto")
    out.front = { ...f, heights }
  } else if (f?.kind === "door") {
    const door = { ...f }
    if (!door.glass) delete door.glass
    // Porta de vidre: frontisses del perfil, cap cassoleta (la frontissa triada no compta).
    else delete door.hardware
    if (door.mode === "double") door.hinge = "left"
    out.front = door
  }
  else if (f?.kind === "grille") {
    // Patró: de ranures (amplada i separació) o de forats (Ø i pas); el de l'altre tipus no surt. Amb imants, sense frontisses.
    const p = f.pattern
    const pattern = p.kind === "holes" ? { ...p, slotWidth: DEFAULT_GRILLE.slotWidth, slotGap: DEFAULT_GRILLE.slotGap } : { ...p, holeDiameter: DEFAULT_GRILLE.holeDiameter, holePitch: DEFAULT_GRILLE.holePitch }
    out.front = { ...f, pattern, ...(f.mount === "removable" ? { hinge: "left" as const } : {}) }
  }
  return out
}

/** Origen (mm) de cada mòdul a la composició, per id. */
export function moduleOrigins3(comp: Composition): Map<string, [number, number, number]> {
  const ps = modulePlacements(comp)
  return new Map(comp.modules.map((m, i) => [m.id, [ps[i]!.x, ps[i]!.y, ps[i]!.z ?? 0] as [number, number, number]]))
}

/**
 * Peces lliures amb coordenades de la composició: les enganxades a un mòdul se sumen a la
 * seva posició. Al Flat-pack (sense mòduls fets) o si el mòdul ja no hi és, van soles.
 */
export function resolveParts(comp: Composition): FreePart[] {
  const parts = comp.parts ?? []
  if (!parts.some((p) => p.module) || partsOnlyKind(compositionKind(comp))) return parts
  const origins = moduleOrigins3(comp)
  return parts.map((p) => {
    const o = p.module ? origins.get(p.module) : undefined
    return o ? { ...p, x: p.x + o[0], y: p.y + o[1], z: p.z + o[2] } : p
  })
}

/** Desplaçament que cal sumar a una peça per passar-la a coordenades de la composició. */
export function partOffset(comp: Composition, p: FreePart): [number, number, number] {
  if (!p.module || partsOnlyKind(compositionKind(comp))) return [0, 0, 0]
  return moduleOrigins3(comp).get(p.module) ?? [0, 0, 0]
}

/**
 * Peces lliures en mode «Talla», com a objectes que tallen (perfil = la seva forma o el
 * rectangle; direcció = el gruix). Id `part:<id>`.
 */
export function partCutters(comp: Composition): RefObject[] {
  return resolveParts(comp)
    .filter((p) => p.effect === "cut")
    .map((p) => {
      const ax = PART_AXES_C[p.orient]
      const size = [0, 0, 0]
      size[ax.n] = p.thickness
      size[ax.u] = p.w
      size[ax.v] = p.h
      // Secció (u, v) de l'objecte: estirada, la v del perfil va cap al fons (z creixent) i la
      // de la peça cap al davant: es gira.
      const flip = p.orient === "flat"
      const nodes = toNodes(p.shape ?? [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
      const ys = nodes.map((n) => n.y)
      const y0 = Math.min(...ys), y1 = Math.max(...ys)
      const profile = flip
        ? nodes.map((n) => ({ ...n, y: y0 + y1 - n.y, ...(n.in ? { in: [n.in[0], -n.in[1]] as [number, number] } : {}), ...(n.out ? { out: [n.out[0], -n.out[1]] as [number, number] } : {}) }))
        : nodes
      return {
        id: `part:${p.id}`,
        name: p.name,
        x: p.x,
        y: p.y,
        z: p.z,
        w: size[0]!,
        h: size[1]!,
        d: size[2]!,
        effect: "cut" as const,
        shape: "profile" as const,
        axis: (["x", "y", "z"] as const)[ax.n],
        profile: scaleProfile(profile, p.shape ? size[ax.u]! : size[ax.u]!, size[ax.v]!),
      }
    })
}

/** Escala un perfil perquè ocupi exactament w × h (cantonada mínima a 0, 0). */
function scaleProfile(nodes: ReturnType<typeof toNodes>, w: number, h: number): ReturnType<typeof toNodes> {
  // Extensió real de la corba (com `shapeOutline`), no només dels nodes.
  const pts = sampleProfile(nodes, 64)
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const sx = w / Math.max(1e-6, Math.max(...xs) - x0)
  const sy = h / Math.max(1e-6, Math.max(...ys) - y0)
  return nodes.map((n) => ({
    ...n,
    x: (n.x - x0) * sx,
    y: (n.y - y0) * sy,
    ...(n.in ? { in: [n.in[0] * sx, n.in[1] * sy] as [number, number] } : {}),
    ...(n.out ? { out: [n.out[0] * sx, n.out[1] * sy] as [number, number] } : {}),
  }))
}
