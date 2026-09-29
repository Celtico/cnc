import { z } from "zod"
import { DEFAULT_CABINET, type CabinetParams } from "./cabinet"
import { BPtSchema, ProfileNodeSchema } from "./panel"
import { flatten, profileToOutline, toNodes, type BPt } from "./polygon"
import { FreePartSchema, JoinerySchema, type FreePart } from "./freePart"

/**
 * Model de composició: mòduls d'esquerra a dreta, cadascun amb una carcassa i un
 * arbre de zones (divisions i continguts). Totes les mides en mm.
 */

const mm = z.number().finite()
const sizeOrAuto = z.union([mm.positive(), z.literal("auto")])

// --- Ferratges i mecanitzats per defecte ------------------------------------------

export const HardwareSchema = z.object({
  hinge: z.object({ cupDiameter: mm.positive(), cupDepth: mm.positive(), cupOffset: mm.positive() }),
  system32: z.object({ edgeOffset: mm.positive(), pitch: mm.positive(), diameter: mm.positive(), depth: mm.positive() }),
  dowel: z.object({ diameter: mm.positive(), faceDepth: mm.positive(), edgeDepth: mm.positive(), endOffset: mm.positive() }),
  drawer: z.object({
    /** Llargades de guia disponibles (mm). */
    slideLengths: z.array(mm.positive()).min(1),
    /** Joc lateral per costat entre caixa i lateral del moble (guia de boles: 12,5). */
    sideClearance: mm.min(0),
    /** Gruix dels laterals i el darrere de la caixa. */
    boxThickness: mm.positive(),
    /** Gruix del fons de la caixa (en ranura). */
    bottomThickness: mm.positive(),
    /** Alçada del front menys alçada de la caixa. */
    boxDrop: mm.min(0),
    /** Distància del fons del calaix a la vora inferior de la caixa (ranura). */
    bottomOffset: mm.min(0),
    /** Joc de la caixa amb el fons del moble. */
    backClearance: mm.min(0),
  }),
  magnet: z.object({ diameter: mm.positive(), depth: mm.positive(), cornerOffset: mm.positive() }),
})
export type Hardware = z.infer<typeof HardwareSchema>

export const DEFAULT_HARDWARE: Hardware = {
  hinge: DEFAULT_CABINET.hinge,
  system32: DEFAULT_CABINET.system32,
  dowel: DEFAULT_CABINET.dowel,
  drawer: {
    slideLengths: [250, 300, 350, 400, 450, 500, 550],
    sideClearance: 12.5,
    boxThickness: 16,
    bottomThickness: 10,
    boxDrop: 30,
    bottomOffset: 12,
    backClearance: 10,
  },
  magnet: { diameter: 10, depth: 5, cornerOffset: 60 },
}

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
  back: z.enum(["groove", "screwed", "none"]),
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
  grooveDepth: mm.min(3).max(15),
  backClearance: mm.min(0).max(4),
  shelfSetback: mm.min(0).max(100),
  shelfClearance: mm.min(0).max(5),
})
export type Carcass = z.infer<typeof CarcassSchema>

// --- Fronts i zones ----------------------------------------------------------------

export const FrontSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("door"), mode: z.enum(["single", "double"]), hinge: z.enum(["left", "right"]) }),
  z.object({ kind: z.literal("drawers"), n: z.number().int().min(1).max(10), heights: z.array(sizeOrAuto) }),
  z.object({ kind: z.literal("flap"), dir: z.enum(["down", "up"]) }),
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
export type CarcassExtras = z.infer<typeof CarcassExtrasSchema>

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
  }),
  hardware: HardwareSchema,
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
 * Tipus de moble: decideix quines opcions de conjunt surten (taulell i sòcol a la cuina…) i
 * què s'afegeix amb «Afegir mòdul». Opcional: els antics es dedueixen (`compositionKind`).
 */
export const CompositionKindSchema = z.enum(["moble", "cuina", "armari", "taula", "lliure"])
export type CompositionKind = z.infer<typeof CompositionKindSchema>

export const CompositionSchema = z.object({
  kind: CompositionKindSchema.optional(),
  modules: z.array(ModuleSchema),
  references: z.array(RefObjectSchema),
  /** Taulells i sòcols correguts. Opcional (els mobles antics no en tenen). */
  runs: z.array(RunSchema).optional(),
  /** Peces lliures (flat-pack, encaixos). Opcional. */
  parts: z.array(FreePartSchema).optional(),
  /** Encaixos de les peces lliures (joc, fresa, pestanyes). Sense: `DEFAULT_JOINERY`. */
  joinery: JoinerySchema.optional(),
})
export type Composition = z.infer<typeof CompositionSchema>

// --- Utilitats ---------------------------------------------------------------------

let counter = 0
export function newId(prefix = "z"): string {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}

export function isLeaf(zone: Zone): boolean {
  return !zone.split
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
export function normalizeComposition(comp: Composition): Composition {
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

/** X d'inici de cada mòdul dins de la composició. */
export function moduleOrigins(comp: Composition): number[] {
  return modulePlacements(comp).map((p) => p.x)
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
    hardware: {
      ...DEFAULT_HARDWARE,
      hinge: p.hinge,
      system32: p.system32,
      dowel: p.dowel,
    },
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
  if (!parts.some((p) => p.module) || compositionKind(comp) === "lliure") return parts
  const origins = moduleOrigins3(comp)
  return parts.map((p) => {
    const o = p.module ? origins.get(p.module) : undefined
    return o ? { ...p, x: p.x + o[0], y: p.y + o[1], z: p.z + o[2] } : p
  })
}

/** Desplaçament que cal sumar a una peça per passar-la a coordenades de la composició. */
export function partOffset(comp: Composition, p: FreePart): [number, number, number] {
  if (!p.module || compositionKind(comp) === "lliure") return [0, 0, 0]
  return moduleOrigins3(comp).get(p.module) ?? [0, 0, 0]
}
