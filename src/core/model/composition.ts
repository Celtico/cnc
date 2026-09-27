import { z } from "zod"
import { DEFAULT_CABINET, type CabinetParams } from "./cabinet"

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
  backMaterial: z.string(),
  backThickness: mm.min(3).max(20),
  base: BaseSchema,
  back: z.enum(["groove", "screwed", "none"]),
  top: TopSchema,
  sides: z.object({ left: z.boolean(), right: z.boolean() }),
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
  shelves?: { n: number; adjustable: boolean }
  front?: Front
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
    shelves: z.object({ n: z.number().int().min(0).max(20), adjustable: z.boolean() }).optional(),
    front: FrontSchema.optional(),
  }),
)

/** Mecanitzats extra de la carcassa que no depenen de cap zona. */
export const CarcassExtrasSchema = z.object({
  /** Passacables Ø (mm) al fons o a la tapa, en coordenades del mòdul (x des de l'esquerra, y des de baix o des del darrere). */
  cableHoles: z.array(
    z.object({ panel: z.enum(["back", "top", "bottom"]), x: mm, y: mm, diameter: mm.positive() }),
  ),
})
export type CarcassExtras = z.infer<typeof CarcassExtrasSchema>

export const ModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Separació respecte al mòdul anterior (o a l'origen si és el primer). */
  gapBefore: mm.min(0),
  carcass: CarcassSchema,
  root: ZoneSchema,
  fronts: z.object({ outerGap: mm.min(0).max(10), betweenGap: mm.min(0).max(10) }),
  hardware: HardwareSchema,
  extras: CarcassExtrasSchema,
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
})
export type RefObject = z.infer<typeof RefObjectSchema>

export const CompositionSchema = z.object({
  modules: z.array(ModuleSchema),
  references: z.array(RefObjectSchema),
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

/** X d'inici de cada mòdul dins de la composició. */
export function moduleOrigins(comp: Composition): number[] {
  const xs: number[] = []
  let x = 0
  for (const m of comp.modules) {
    x += m.gapBefore
    xs.push(x)
    x += m.carcass.width
  }
  return xs
}

export function compositionWidth(comp: Composition): number {
  const xs = moduleOrigins(comp)
  const last = comp.modules.at(-1)
  return last ? xs.at(-1)! + last.carcass.width : 0
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
export function defaultModule(id: string, name: string, overrides: Partial<Carcass> = {}): Module {
  const m = cabinetToModule({ ...DEFAULT_CABINET, doors: 0, shelves: 1 }, id, name)
  return { ...m, carcass: { ...m.carcass, ...overrides } }
}
