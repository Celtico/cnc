import { z } from "zod"
import { DEFAULT_CABINET } from "./cabinet"
import { DEFAULT_HARDWARE, HardwareSchema, type Module } from "./composition"

/**
 * Preferències de l'usuari: tot el que depèn de casa seva i del taller (referències de
 * foto, materials, taulers, ferratges, jocs, etiquetes) i que el codi només porta com a
 * valors inicials. Es guarden a Dexie amb versió per poder-les migrar.
 *
 * Canviar una preferència no modifica els mobles ja fets: només els mòduls nous (que en
 * prenen ferratges, jocs i materials) i les pantalles que llegeixen les llistes.
 */

const mm = z.number().finite()

export const SETTINGS_VERSION = 1

// --- Objectes de referència (foto i editor) ------------------------------------------

export const RefPresetSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Cal un nom"),
  /** Cara del davant: amplada × alçada (per calibrar la foto). */
  w: mm.min(1, "Amplada entre 1 i 10.000 mm").max(10000, "Amplada entre 1 i 10.000 mm"),
  h: mm.min(1, "Alçada entre 1 i 10.000 mm").max(10000, "Alçada entre 1 i 10.000 mm"),
  /** Fondària (opcional per a referències planes: A4, rajola). Sense fondària no pot ser fantasma 3D. */
  d: mm.min(1).max(10000).optional(),
  plane: z.enum(["wall", "floor"]),
  /** Distància de la cara del davant a la paret (mm). */
  wallOffset: mm.min(0).max(5000),
  /** Valor inicial del codi: es pot amagar, no esborrar. */
  builtin: z.boolean().optional(),
  hidden: z.boolean().optional(),
})
export type RefPreset = z.infer<typeof RefPresetSchema>

// --- Materials ---------------------------------------------------------------------

export const FinishSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("color"), color: z.string() }),
  z.object({ kind: z.literal("lacquer"), color: z.string() }),
  z.object({ kind: z.literal("wood"), species: z.enum(["oak", "walnut", "ash"]) }),
])
export type Finish = z.infer<typeof FinishSchema>

export const MaterialPrefSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Cal un nom"),
  thicknesses: z.array(mm.min(3, "Gruix entre 3 i 60 mm").max(60, "Gruix entre 3 i 60 mm")).min(1, "Cal almenys un gruix"),
  hasGrain: z.boolean(),
  finish: FinishSchema,
  /** Cantell per defecte (nom lliure: "PVC blanc 1 mm", "Xapa de roure"). */
  edge: z.string(),
  /** Apte per a fons (DM 10, contraxapat...). */
  forBacks: z.boolean().optional(),
})
export type MaterialPref = z.infer<typeof MaterialPrefSchema>

// --- Taulers i nesting ---------------------------------------------------------------

export const SheetPrefSchema = z.object({
  /** Material al qual s'aplica; buit = tots els altres. */
  material: z.string(),
  w: mm.min(300).max(6000),
  h: mm.min(300).max(6000),
})
export type SheetPref = z.infer<typeof SheetPrefSchema>

export const BoardsPrefSchema = z.object({
  sheets: z.array(SheetPrefSchema).min(1),
  kerf: mm.min(0).max(30),
  margin: mm.min(0).max(100),
  /** Permetre girar les peces 90° encara que tinguin veta. */
  ignoreGrain: z.boolean(),
})
export type BoardsPref = z.infer<typeof BoardsPrefSchema>

// --- Jocs, etiquetes, visualització ---------------------------------------------------

export const GapsPrefSchema = z.object({
  outerGap: mm.min(0).max(10),
  betweenGap: mm.min(0).max(10),
  shelfClearance: mm.min(0).max(5),
  shelfSetback: mm.min(0).max(100),
  backClearance: mm.min(0).max(4),
  backSetback: mm.min(0).max(60),
  grooveDepth: mm.min(3).max(15),
})
export type GapsPref = z.infer<typeof GapsPrefSchema>

export const LabelPrefSchema = z.object({ w: mm.min(10).max(300), h: mm.min(10).max(300) })

export const DisplayPrefSchema = z.object({ unit: z.enum(["mm", "cm"]) })

export const SettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  references: z.array(RefPresetSchema),
  materials: z.array(MaterialPrefSchema).min(1),
  boards: BoardsPrefSchema,
  hardware: HardwareSchema,
  gaps: GapsPrefSchema,
  label: LabelPrefSchema,
  display: DisplayPrefSchema,
  /** Materials per defecte dels mòduls nous (id de `materials`). */
  defaults: z.object({ material: z.string(), thickness: mm, backMaterial: z.string(), backThickness: mm }),
})
export type Settings = z.infer<typeof SettingsSchema>

// --- Valors inicials ---------------------------------------------------------------

const ref = (id: string, name: string, w: number, h: number, extra: Partial<RefPreset> = {}): RefPreset => ({
  id,
  name,
  w,
  h,
  plane: "wall",
  wallOffset: 0,
  builtin: true,
  ...extra,
})

export const BUILTIN_REFERENCES: RefPreset[] = [
  ref("a4-v", "Full A4 vertical", 210, 297),
  ref("a4-h", "Full A4 horitzontal", 297, 210),
  ref("tile-300", "Rajola 300 × 300", 300, 300),
  ref("tile-600", "Rajola 600 × 600", 600, 600),
  ref("tile-600-300", "Rajola 600 × 300", 600, 300),
  ref("door-800", "Porta 800 × 2030", 800, 2030),
  ref("door-700", "Porta 700 × 2030", 700, 2030),
  ref("tv-sony-55-screen", "TV Sony KD-55XD8505 (pantalla)", 1231, 717, { d: 44, wallOffset: 200 }),
  ref("tv-sony-55-stand", "TV Sony KD-55XD8505 (amb peu)", 1231, 770, { d: 263, wallOffset: 0 }),
]

export const BUILTIN_MATERIALS: MaterialPref[] = [
  { id: "mel-white", name: "Melamina blanca", thicknesses: [10, 16, 19], hasGrain: false, finish: { kind: "color", color: "#f2f0eb" }, edge: "PVC blanc 1 mm" },
  { id: "mel-grey", name: "Melamina gris", thicknesses: [16, 19], hasGrain: false, finish: { kind: "color", color: "#9a9a96" }, edge: "PVC gris 1 mm" },
  { id: "mel-black", name: "Melamina negra", thicknesses: [16, 19], hasGrain: false, finish: { kind: "color", color: "#2b2b2b" }, edge: "PVC negre 1 mm" },
  { id: "mel-oak", name: "Melamina roure", thicknesses: [16, 19], hasGrain: true, finish: { kind: "wood", species: "oak" }, edge: "PVC roure 1 mm" },
  { id: "mdf-lacquer", name: "MDF lacat", thicknesses: [16, 19, 22, 30], hasGrain: false, finish: { kind: "lacquer", color: "#e9e6df" }, edge: "Lacat (sense cantell)" },
  { id: "oak", name: "Roure massís / xapat", thicknesses: [19, 30], hasGrain: true, finish: { kind: "wood", species: "oak" }, edge: "Xapa de roure" },
  { id: "walnut", name: "Noguera xapada", thicknesses: [19], hasGrain: true, finish: { kind: "wood", species: "walnut" }, edge: "Xapa de noguera" },
  { id: "ash", name: "Freixe xapat", thicknesses: [19], hasGrain: true, finish: { kind: "wood", species: "ash" }, edge: "Xapa de freixe" },
  { id: "mdf-back", name: "DM (fons)", thicknesses: [10, 12], hasGrain: false, finish: { kind: "color", color: "#c9b79a" }, edge: "", forBacks: true },
  { id: "plywood-back", name: "Contraxapat (fons)", thicknesses: [10, 12, 15], hasGrain: true, finish: { kind: "wood", species: "ash" }, edge: "", forBacks: true },
]

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  references: BUILTIN_REFERENCES,
  materials: BUILTIN_MATERIALS,
  boards: {
    sheets: [{ material: "", w: 2800, h: 2070 }],
    kerf: 6,
    margin: 10,
    ignoreGrain: false,
  },
  hardware: DEFAULT_HARDWARE,
  gaps: {
    outerGap: DEFAULT_CABINET.doorGap,
    betweenGap: DEFAULT_CABINET.doorGapBetween,
    shelfClearance: DEFAULT_CABINET.shelfClearance,
    shelfSetback: DEFAULT_CABINET.shelfSetback,
    backClearance: DEFAULT_CABINET.backClearance,
    backSetback: DEFAULT_CABINET.backSetback,
    grooveDepth: DEFAULT_CABINET.grooveDepth,
  },
  label: { w: 99, h: 68 },
  display: { unit: "mm" },
  defaults: { material: "Melamina blanca", thickness: 19, backMaterial: "DM (fons)", backThickness: 10 },
}

// --- Migració i importació ------------------------------------------------------------

export interface SettingsParse {
  settings: Settings
  /** Problemes trobats (en català). Buit si tot era vàlid. */
  problems: string[]
  migrated: boolean
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Llegeix unes preferències guardades (o importades): completa el que falti amb els
 * valors inicials, migra versions anteriors i descarta entrades invàlides dient-ho.
 * Mai llança: si tot és inservible, retorna els valors inicials.
 */
export function parseSettings(raw: unknown): SettingsParse {
  const problems: string[] = []
  if (!isRecord(raw)) {
    return { settings: DEFAULT_SETTINGS, problems: ["El fitxer no conté cap objecte de preferències."], migrated: false }
  }
  let migrated = false
  let obj: Record<string, unknown> = { ...raw }
  const version = typeof obj.version === "number" ? obj.version : 0
  if (version < 1) {
    // v0: sense `version`; les referències podien portar `wall` en lloc de `wallOffset`.
    migrated = true
    const refs = Array.isArray(obj.references)
      ? obj.references.map((r) => (isRecord(r) && "wall" in r && !("wallOffset" in r) ? { ...r, wallOffset: r.wall } : r))
      : undefined
    obj = { ...obj, ...(refs ? { references: refs } : {}), version: 1 }
  }
  if (version > SETTINGS_VERSION) problems.push(`Preferències d'una versió més nova (${version}); s'ha llegit el que s'ha pogut.`)

  const section = <T>(key: string, schema: z.ZodType<T>, fallback: T, label: string): T => {
    if (!(key in obj)) return fallback
    const res = schema.safeParse(obj[key])
    if (res.success) return res.data
    problems.push(`${label}: ${res.error.issues[0]?.message ?? "valor invàlid"}; es mantenen els valors inicials.`)
    return fallback
  }
  const list = <T extends { id: string }>(key: string, schema: z.ZodType<T>, fallback: T[], label: string): T[] => {
    if (!Array.isArray(obj[key])) return fallback
    const out: T[] = []
    for (const item of obj[key] as unknown[]) {
      const res = schema.safeParse(item)
      if (res.success) out.push(res.data)
      else problems.push(`${label}: s'ha descartat una entrada (${res.error.issues[0]?.message ?? "invàlida"}).`)
    }
    return out
  }

  const references = withBuiltins(list("references", RefPresetSchema, BUILTIN_REFERENCES, "Objectes de referència"), BUILTIN_REFERENCES)
  const materialsRaw = list("materials", MaterialPrefSchema, BUILTIN_MATERIALS, "Materials")
  const materials = materialsRaw.length ? materialsRaw : BUILTIN_MATERIALS
  const settings: Settings = {
    version: SETTINGS_VERSION,
    references,
    materials,
    boards: section("boards", BoardsPrefSchema, DEFAULT_SETTINGS.boards, "Taulers"),
    hardware: section("hardware", HardwareSchema, DEFAULT_SETTINGS.hardware, "Ferratges"),
    gaps: section("gaps", GapsPrefSchema, DEFAULT_SETTINGS.gaps, "Jocs"),
    label: section("label", LabelPrefSchema, DEFAULT_SETTINGS.label, "Etiqueta"),
    display: section("display", DisplayPrefSchema, DEFAULT_SETTINGS.display, "Visualització"),
    defaults: section("defaults", SettingsSchema.shape.defaults, DEFAULT_SETTINGS.defaults, "Materials per defecte"),
  }
  return { settings, problems, migrated: migrated || problems.length > 0 }
}

/** Els valors inicials sempre hi són (amagats o no): si falten, s'afegeixen al final. */
function withBuiltins(refs: RefPreset[], builtins: RefPreset[]): RefPreset[] {
  const ids = new Set(refs.map((r) => r.id))
  return [...refs, ...builtins.filter((b) => !ids.has(b.id))]
}

/** Text JSON per exportar (còpia o passar-les a un altre dispositiu). */
export function settingsToJson(s: Settings): string {
  return JSON.stringify(s, null, 2)
}

/** Importa un JSON: mai llança. */
export function settingsFromJson(text: string): SettingsParse {
  try {
    return parseSettings(JSON.parse(text))
  } catch {
    return { settings: DEFAULT_SETTINGS, problems: ["El fitxer no és un JSON vàlid."], migrated: false }
  }
}

// --- Aplicació a mòduls nous -----------------------------------------------------------

/** Referències visibles (no amagades). */
export function visibleReferences(s: Settings): RefPreset[] {
  return s.references.filter((r) => !r.hidden)
}

/** Un objecte només pot ser fantasma 3D si té fondària. */
export function canBeGhost(r: RefPreset): boolean {
  return typeof r.d === "number" && r.d > 0
}

export function materialByName(s: Settings, name: string): MaterialPref | undefined {
  return s.materials.find((m) => m.name === name)
}

/** Un mòdul nou pren ferratges, jocs i materials de les preferències; els existents no canvien. */
export function applySettingsToModule(s: Settings, m: Module): Module {
  return {
    ...m,
    carcass: {
      ...m.carcass,
      material: s.defaults.material,
      thickness: s.defaults.thickness,
      backMaterial: s.defaults.backMaterial,
      backThickness: s.defaults.backThickness,
      shelfClearance: s.gaps.shelfClearance,
      shelfSetback: s.gaps.shelfSetback,
      backClearance: s.gaps.backClearance,
      backSetback: s.gaps.backSetback,
      grooveDepth: s.gaps.grooveDepth,
    },
    fronts: { ...m.fronts, outerGap: s.gaps.outerGap, betweenGap: s.gaps.betweenGap },
    hardware: structuredClone(s.hardware),
  }
}

/** Mida de tauler per a un material (la primera regla que coincideix; buit = totes). */
export function sheetFor(s: Settings, material: string): { w: number; h: number } {
  const hit = s.boards.sheets.find((x) => x.material === material) ?? s.boards.sheets.find((x) => x.material === "")
  return hit ? { w: hit.w, h: hit.h } : { w: 2800, h: 2070 }
}
