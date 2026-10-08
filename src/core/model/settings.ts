import { z } from "zod"
import { DEFAULT_CABINET } from "./cabinet"
import { type Module } from "./composition"
import { migrateImportedNames } from "../import/hettichNames"
import { DEFAULT_HARDWARE_DEFAULTS, DEFAULT_HARDWARE_KITS, DEFAULT_HARDWARE_LIBRARY, DEFAULT_LEGACY_HARDWARE, HardwareDefaultsSchema, HardwareItemSchema, LegacyHardwareSchema, fixHardwareDefaults, kitFrom, kitPilotFromLibrary, libraryFromLegacy, setKitPilot } from "./hardware"
import { DEFAULT_KIT_PILOT, KitPilotSchema } from "./hardwareKit"
import { PHOTO_MATERIALS } from "./textureSets"
import { deepEqual, MATERIAL_MERGES, rescalePhotoTiles, resolveMaterialAlias, restorePhotoThicknesses, upgradeToPhoto } from "./photoUpgrade"
import { defaultMachine, defaultMachineRules, MachineRulesSchema, MachineSchema, migrateMachine, repairMachine, withWorkshopRules, type Machine, type MachineRules } from "./machine"
import { repairValue } from "./repair"

/**
 * Preferències de l'usuari: tot el que depèn de casa seva i del taller (referències de
 * foto, materials, taulers, ferratges, jocs, etiquetes) i que el codi només porta com a
 * valors inicials. Es guarden a Dexie amb versió per poder-les migrar.
 *
 * Canviar una preferència no modifica els mobles ja fets: només els mòduls nous (que en
 * prenen ferratges, jocs i materials) i les pantalles que llegeixen les llistes.
 */

const mm = z.number().finite()

/**
 * Versió de les preferències. v20: ferratges importats d'un fabricant (`HardwareItem.imported`, `plate`, motor
 * `plate`): additiu, cap item d'abans no canvia (una v19 es llegeix igual; una app v19 no pot desar sobre una v20).
 * v21: tiradors, potes i «només 3D» importats (motors `leg` i `model`, categories `table` i `door-system`): additiu; una
 * app v20 no les pot desar (perdria els items que no sap llegir).
 * v22: generador de mecanitzats dels ferratges (`HardwareItem.machining`, `hardwareOps.ts`): additiu, res a migrar; una
 * app v21 no les pot desar (trauria les operacions en silenci).
 * v23: jocs paramètrics de calaix de doble paret (`HardwareItem.kit`, motor `drawerKit`, categoria `drawer-system`,
 * `hardwareKit.ts`): additiu; els jocs inicials (DTC MAGIC-PRO) s'afegeixen a la biblioteca si no hi són (per id). Una
 * app v22 no les pot desar (perdria els jocs).
 * v24: els jocs inicials (`builtin`, id dels de l'app) reben les dades del joc d'ara (`kit`: guia telescòpica de dos
 * cossos, acabats dels laterals); el nom i la prebroca (`params`) de l'usuari es queden. Les còpies dels mobles no es
 * toquen.
 * v25: folgança de les peces de dins (`gaps.innerClearance`, 1 mm): additiu; les preferències d'abans la reben amb el
 * valor inicial (si ja n'hi ha una, es queda). Els mobles desats no canvien (sense el camp, 0).
 */
export const SETTINGS_VERSION = 25

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

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
/** Imatge d'un acabat: data URL o un fitxer de l'app a `public/textures/`. */
const imageSrc = z.string().refine((s) => s.startsWith("data:image/") || /^textures\/[\w.-]+\/[\w.-]+\.(jpe?g|png|webp)$/.test(s), "Imatge invàlida")

/**
 * Paràmetres del generador de fusta (textura procedural): colors, veta, catedrals, porus i la mida
 * real d'una repetició. Sense, els de l'espècie (`WOOD_PRESETS`).
 */
export const WoodGenSchema = z.object({
  /** Color de fons i de la veta. */
  base: hex,
  dark: hex,
  /** Densitat de la veta (vetes per repetició). */
  lines: z.number().min(2).max(80),
  /** Ondulació de les fibres (0 recta, 0,25 molt ondulada). */
  wobble: z.number().min(0).max(0.25),
  /** Franges amples de to clar/fosc. */
  bands: z.number().int().min(0).max(60),
  /** Contrast de les fibres (0 suau, 1 marcat). */
  contrast: z.number().min(0).max(1),
  /** Vetes «de catedral» (arcs). */
  figure: z.number().int().min(0).max(8),
  /** Porus (traços curts). */
  pores: z.number().int().min(0).max(5000),
  /** Gra fi (soroll). */
  grain: z.number().min(0).max(30),
  /** Mida real d'una repetició (mm). */
  tileMm: z.number().min(200).max(4000),
  /** Llavor: cada número fa una variació diferent amb els mateixos paràmetres. */
  seed: z.number().int().min(1),
})
export type WoodGen = z.infer<typeof WoodGenSchema>

/** Paràmetres inicials de cada espècie (punt de partida del generador). */
export const WOOD_PRESETS: Record<"oak" | "walnut" | "ash", WoodGen> = {
  oak: { base: "#d6b684", dark: "#a88354", lines: 26, wobble: 0.06, bands: 26, contrast: 0.5, figure: 2, pores: 2200, grain: 8, tileMm: 600, seed: 101 },
  walnut: { base: "#6e4e34", dark: "#422a1a", lines: 22, wobble: 0.05, bands: 26, contrast: 0.5, figure: 2, pores: 1400, grain: 8, tileMm: 600, seed: 202 },
  ash: { base: "#e4d6b8", dark: "#baa47e", lines: 18, wobble: 0.09, bands: 26, contrast: 0.5, figure: 3, pores: 2200, grain: 8, tileMm: 600, seed: 303 },
}

export const FinishSchema = z.discriminatedUnion("kind", [
  /** Color llis o lacat; `roughness` (0 mirall, 1 mat) per al brillant. */
  z.object({ kind: z.literal("color"), color: z.string(), roughness: z.number().min(0).max(1).optional() }),
  z.object({ kind: z.literal("lacquer"), color: z.string(), roughness: z.number().min(0).max(1).optional() }),
  /** Fusta procedural: l'espècie és el punt de partida; `gen`, els paràmetres del generador. */
  z.object({ kind: z.literal("wood"), species: z.enum(["oak", "walnut", "ash"]), gen: WoodGenSchema.optional() }),
  /** Pedra o marbre procedural: color, vetes i mida real. */
  z.object({
    kind: z.literal("stone"),
    color: z.string(),
    vein: z.string(),
    veins: z.number().min(0).max(1),
    size: mm.min(100).max(4000),
    seed: z.number().int().min(1),
    /** Tipus: marbre (vetes), granit (gra de tres colors), travertí (franges i porus) o formigó (núvols i porus). */
    style: z.enum(["marble", "granite", "travertine", "concrete"]).optional(),
    /** Gra o porus (0–1). */
    grain: z.number().min(0).max(1).optional(),
    /** Polit (0 mat, 1 brillant). */
    polish: z.number().min(0).max(1).optional(),
  }),
  /** Metall (ferro, inox, llautó): brillant i reflectant. */
  z.object({
    kind: z.literal("metal"),
    color: z.string(),
    /** Acabat: polit (mirall), raspallat (ratlles fines) o martellejat (cops). */
    surface: z.enum(["polished", "brushed", "hammered"]).optional(),
    /** Rugositat (0 mirall, 1 mat) i intensitat del raspallat o dels cops. */
    roughness: z.number().min(0).max(1).optional(),
    strength: z.number().min(0).max(1).optional(),
  }),
  /** Vidre: translúcid. */
  z.object({
    kind: z.literal("glass"),
    color: z.string(),
    /** Opacitat (0 invisible, 1 opac) i glaçat (0 transparent, 1 mat). */
    opacity: z.number().min(0.05).max(0.95).optional(),
    frost: z.number().min(0).max(1).optional(),
  }),
  /** Teixit (sofàs, cortines, catifes): trama procedural del color. Materials de simulació. */
  z.object({
    kind: z.literal("fabric"),
    color: z.string(),
    /** Fils per repetició (trama més fina o més grossa), irregularitat dels fils i mida real (mm). */
    threads: z.number().int().min(8).max(240).optional(),
    slub: z.number().min(0).max(1).optional(),
    tileMm: mm.min(20).max(2000).optional(),
  }),
  /** Rajola: peces quadrades de `size` mm amb junta. Materials de simulació (terres, parets). */
  z.object({
    kind: z.literal("tiles"),
    color: z.string(),
    grout: z.string(),
    size: mm.min(20).max(1500),
    /** Gruix de la junta (mm), variació de to entre peces i col·locació (quadrícula o trencajunts). */
    joint: mm.min(0).max(30).optional(),
    variation: z.number().min(0).max(0.4).optional(),
    layout: z.enum(["grid", "brick"]).optional(),
  }),
  /**
   * Foto real del tauler (textura): imatge reduïda en data URL i l'amplada real que hi surt
   * (mm), perquè la veta tingui la mida de debò al 3D.
   */
  z.object({
    kind: z.literal("image"),
    /** Data URL (foto pròpia) o fitxer de l'app (`textures/<id>/diff.jpg`, jocs de `textureSets.ts`). */
    src: imageSrc,
    /** Mapes PBR opcionals (mateix format): normal (convenció OpenGL) i rugositat (canal G). */
    normalMap: imageSrc.optional(),
    roughMap: imageSrc.optional(),
    /**
     * El normal de l'usuari venia en convenció DirectX: se n'ha invertit el verd en carregar-lo (el desat ja és
     * OpenGL). Només recorda l'interruptor «Invertir el verd».
     */
    normalDx: z.boolean().optional(),
    /** Amplada de tauler de debò que mostra la foto (mm, d'esquerra a dreta). */
    tileMm: mm.min(50).max(5000),
    /** Alçada ÷ amplada de la foto: l'alçada real és tileMm × aspect (sense, quadrada). */
    aspect: z.number().positive().optional(),
    /** Textura feta per repetir (seamless): es repeteix normal; si no, en mirall (sense costures). */
    seamless: z.boolean().optional(),
    /** Direcció de la veta a la foto: `y` = vertical (es gira perquè vagi com la de la peça); sense, horitzontal. */
    grain: z.enum(["x", "y"]).optional(),
    /** Multiplicador del mapa de rugositat (o rugositat, sense mapa). */
    roughness: z.number().min(0).max(2).optional(),
    /** Color mitjà de la foto (STEP, mostres). */
    color: z.string().optional(),
  }),
])
export type Finish = z.infer<typeof FinishSchema>

export const MaterialPrefSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Cal un nom"),
  thicknesses: z.array(mm.min(3, "Gruix entre 3 i 60 mm").max(60, "Gruix entre 3 i 60 mm")).min(1, "Cal almenys un gruix"),
  hasGrain: z.boolean(),
  finish: FinishSchema,
  /**
   * Acabats d'abans per tipus (`kind` → acabat): en canviar l'Acabat es guarda el que hi havia i, si es torna
   * a aquell tipus, es recupera (p. ex. la foto amb els mapes de relleu). Només aspecte, no fabricació.
   */
  previousFinishes: z.record(z.string(), FinishSchema).optional(),
  /** Cantell per defecte (nom lliure: "PVC blanc 1 mm", "Xapa de roure"). */
  edge: z.string(),
  /** Apte per a fons (DM 10, contraxapat...). */
  forBacks: z.boolean().optional(),
  /**
   * false: no es talla a la CNC (ferro, pedra, vidre…). Les peces lliures d'aquest material
   * no van al nesting: surten a «Elements sense nesting».
   */
  cnc: z.boolean().optional(),
  /**
   * Categoria (Preferències › Materials i selectors). Sense: es dedueix (`materialCategory`).
   * `sim` = de simulació: només es veu (blocs i parets dels ambients, coixins…), no es fabrica.
   */
  category: z.enum(["board", "back", "hard", "sim"]).optional(),
  /**
   * Render: llum que emet (radiància, ~1 paper blanc al sol tènue; pantalla de làmpada ≈ 4,
   * bombeta ≈ 30). Al visor es veu encès. v5.
   */
  glow: z.number().min(0).max(200).optional(),
  /** Render: translucidesa (0–1), llum difusa que passa a l'altra cara (fulles, cortines, pantalles). v5. */
  translucent: z.number().min(0).max(1).optional(),
  /** Render: vernís (0–1), un reflex nítid a sobre (lacat brillant, marbre polit). Sense, el de l'app (`materialCoat`). */
  coat: z.number().min(0).max(1).optional(),
  /** Render: vellut (0–1), la tela s'aclareix a les vores. Sense, el de l'app (`materialSheen`). */
  sheen: z.number().min(0).max(1).optional(),
})
export type MaterialPref = z.infer<typeof MaterialPrefSchema>

/**
 * Clau per comparar noms de material (únics a Preferències): sense majúscules ni espais repetits o als extrems
 * («Melamina  blanca » = «melamina blanca»).
 */
export function materialNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ca")
}

/** Llista de materials amb noms únics (`materialNameKey`): el Zod de les preferències la rebutja si no. */
const MaterialListSchema = z.array(MaterialPrefSchema).min(1).superRefine((list, ctx) => {
  const seen = new Set<string>()
  list.forEach((m, i) => {
    const k = materialNameKey(m.name)
    if (seen.has(k)) ctx.addIssue({ code: "custom", path: [i, "name"], message: `Nom repetit: «${m.name.trim()}»` })
    seen.add(k)
  })
})
/**
 * Categories: Taulers · Fons · Simulació. «Metall, pedra i vidre» (`hard`, a l'esquema per als desats antics) és
 * Simulació (per decisió de l'usuari: és el mateix, no es tallen a la CNC).
 */
export type MaterialCategory = "board" | "back" | "sim"

export const MATERIAL_CATEGORIES: { id: MaterialCategory; label: string; hint: string }[] = [
  { id: "board", label: "Taulers", hint: "Es tallen a la CNC: cossos, fronts, taulells." },
  { id: "back", label: "Fons", hint: "Taulers prims per als fons." },
  { id: "sim", label: "Simulació", hint: "No es tallen a la CNC, només es veuen: metall, pedra, vidre, teixits, parquet, pintura… per als ambients i els objectes. Una peça lliure d'aquests materials surt a «Elements sense nesting»." },
]

/** Categoria d'un material: la triada o, als antics, deduïda dels interruptors (`hard` antic = Simulació). */
export function materialCategory(m: Pick<MaterialPref, "category" | "forBacks" | "cnc">): MaterialCategory {
  const c = m.category ?? (m.forBacks ? "back" : m.cnc === false ? "sim" : "board")
  return c === "hard" ? "sim" : c
}

/** Canvia la categoria d'un material mantenint coherents `forBacks` i `cnc`. */
export function withCategory(m: MaterialPref, category: MaterialCategory): MaterialPref {
  const { forBacks: _f, cnc: _c, category: _k, ...rest } = m
  return { ...rest, category, ...(category === "back" ? { forBacks: true } : {}), ...(category === "sim" ? { cnc: false } : {}) }
}

// --- Taulers i nesting ---------------------------------------------------------------

export const SheetPrefSchema = z.object({
  /** Material al qual s'aplica; buit = tots els altres. */
  material: z.string(),
  w: mm.min(300).max(6000),
  h: mm.min(300).max(6000),
})

export const BoardsPrefSchema = z.object({
  sheets: z.array(SheetPrefSchema).min(1),
  kerf: mm.min(0).max(30),
  margin: mm.min(0).max(100),
  /** Permetre girar les peces 90° encara que tinguin veta. */
  ignoreGrain: z.boolean(),
})

// --- Jocs, etiquetes, visualització ---------------------------------------------------

export const GapsPrefSchema = z.object({
  outerGap: mm.min(0).max(10),
  betweenGap: mm.min(0).max(10),
  shelfClearance: mm.min(0).max(5),
  shelfSetback: mm.min(0).max(100),
  backClearance: mm.min(0).max(4),
  backSetback: mm.min(0).max(60),
  grooveDepth: mm.min(3).max(15),
  /**
   * Peces de dins (v25): divisors i prestatges fixos d'un mòdul dividit (de qualsevol nivell), tants mm menys de llarg
   * (la meitat a cada cap). Es copia a cada mòdul nou (`Carcass.innerClearance`).
   */
  innerClearance: mm.min(0).max(3),
})

export const LabelPrefSchema = z.object({ w: mm.min(10).max(300), h: mm.min(10).max(300) })

export const DisplayPrefSchema = z.object({ unit: z.enum(["mm", "cm"]) })

export const SettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  references: z.array(RefPresetSchema),
  materials: MaterialListSchema,
  boards: BoardsPrefSchema,
  /**
   * Biblioteca de ferratges (v19): frontisses, guies, espigues… com a dades (`core/model/hardware.ts`). Abans eren uns
   * números (`hardware`); la migració en fa els items inicials amb aquells números.
   */
  hardwareLibrary: z.array(HardwareItemSchema),
  /** Quin item de la biblioteca fa servir cada lloc als mòduls nous (`HARDWARE_SLOTS`). */
  hardwareDefaults: HardwareDefaultsSchema,
  /** Regla del taller «prebroca dels cargols» dels jocs (una sola font; els jocs de la biblioteca i les còpies la segueixen). */
  kitPilot: KitPilotSchema,
  gaps: GapsPrefSchema,
  label: LabelPrefSchema,
  display: DisplayPrefSchema,
  /** Materials per defecte dels mòduls nous (noms de `materials`: es canvien amb el nom, `renameMaterialInSettings`). */
  defaults: z.object({ material: z.string(), thickness: mm, backMaterial: z.string(), backThickness: mm }),
  /** Màquines CNC importades de Maestro (v10). */
  machines: z.array(MachineSchema),
  /**
   * Regles de mecanitzat del taller (v11): les mateixes per a totes les màquines (per decisió de l'usuari: «en un taller
   * les regles són les mateixes per a les dues CNC»). Les eines van pel nom a la màquina que exporta (`findRuleTool`).
   * Abans eren per màquina (`Machine.rules`): la migració agafa les de la màquina per defecte.
   */
  machiningRules: MachineRulesSchema,
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
  ref("tv-55", "Tele 55″", 1230, 710, { d: 60, wallOffset: 30 }),
  ref("radiator-800", "Radiador 800 × 600", 800, 600, { d: 100, wallOffset: 40 }),
  ref("socket", "Endoll 80 × 80", 80, 80),
]

/** Valors inicials antics (teles de les proves del principi) que ja no hi són: es treuen de les preferències desades. */
const RETIRED_REFERENCES = new Set(["tv-sony-55-screen", "tv-sony-55-stand", "tv-43", "tv-50", "tv-65", "tv-75", "tv-55-stand"])
/** Les teles Sony de les proves (també les còpies que se'n van desar com a pròpies) i els valors inicials retirats. */
function isRetired(r: RefPreset): boolean {
  return (!!r.builtin && RETIRED_REFERENCES.has(r.id)) || /^TV Sony KD-55XD8505/.test(r.name)
}

/** Materials que no es tallen a la CNC (peces lliures sense nesting). Afegits a la v2. */
export const NON_CNC_MATERIALS: MaterialPref[] = [
  { id: "iron-black", name: "Ferro negre", thicknesses: [3, 5, 10, 20, 40], hasGrain: false, finish: { kind: "metal", color: "#3b3b3d" }, edge: "", cnc: false },
  { id: "steel-inox", name: "Acer inox", thicknesses: [3, 5, 10, 20, 40], hasGrain: false, finish: { kind: "metal", color: "#c3c7cb" }, edge: "", cnc: false },
  { id: "stone", name: "Pedra", thicknesses: [20, 30], hasGrain: false, finish: { kind: "color", color: "#d9d4ca" }, edge: "", cnc: false },
  { id: "glass", name: "Vidre", thicknesses: [4, 5, 6, 8, 10], hasGrain: false, finish: { kind: "glass", color: "#cfe6e3" }, edge: "", cnc: false },
]

/** Lacats brillants (vernís): com els mobles de catàleg de lacat negre. Afegits a la v15. */
export const GLOSS_MATERIALS: MaterialPref[] = [
  { id: "mdf-lacquer-gloss-black", name: "Lacat negre brillant", thicknesses: [16, 19, 22], hasGrain: false, finish: { kind: "lacquer", color: "#161616", roughness: 0.3 }, edge: "Lacat (sense cantell)", category: "board", coat: 1 },
  { id: "mdf-lacquer-gloss-white", name: "Lacat blanc brillant", thicknesses: [16, 19, 22], hasGrain: false, finish: { kind: "lacquer", color: "#efede8", roughness: 0.3 }, edge: "Lacat (sense cantell)", category: "board", coat: 1 },
]

/**
 * Fusta de fil (tall radial: veta fina i recta, sense arcs), com els mobles de les fotos de catàleg; el tall de sempre
 * (arcs de «catedral») queda com a «Roure» / «Noguera»; el vidre ambre i la ceràmica sorra de la decoració, i els marbres blanc i negre polits.
 * Afegits a la v16.
 */
export const RIFT_MATERIALS: MaterialPref[] = [
  { id: "oak-rift", name: "Roure de fil", thicknesses: [16, 19, 30], hasGrain: true, finish: { kind: "wood", species: "oak", gen: { base: "#cfae7f", dark: "#a8865a", lines: 64, wobble: 0.02, bands: 34, contrast: 0.35, figure: 0, pores: 2600, grain: 10, tileMm: 600, seed: 111 } }, edge: "Xapa de roure", category: "board" },
  { id: "walnut-rift", name: "Noguera de fil", thicknesses: [16, 19, 30], hasGrain: true, finish: { kind: "wood", species: "walnut", gen: { base: "#6a4a31", dark: "#43291a", lines: 56, wobble: 0.02, bands: 30, contrast: 0.4, figure: 0, pores: 1600, grain: 10, tileMm: 600, seed: 212 } }, edge: "Xapa de noguera", category: "board" },
  // Per a la decoració (ampolles, gerros).
  { id: "sim-glass-amber", name: "Vidre ambre", thicknesses: [4], hasGrain: false, finish: { kind: "glass", color: "#b8722e", opacity: 0.55 }, edge: "", cnc: false, category: "sim" },
  { id: "sim-ceramic-sand", name: "Ceràmica sorra", thicknesses: [10], hasGrain: false, finish: { kind: "lacquer", color: "#cdb89a", roughness: 0.6 }, edge: "", cnc: false, category: "sim" },
  // Marbres polits (vernís pel «Polit»): taulells i sobres del showroom.
  { id: "sim-marble-white", name: "Marbre blanc", thicknesses: [20, 30], hasGrain: false, finish: { kind: "stone", color: "#eeebe6", vein: "#9a968f", veins: 0.55, size: 1400, seed: 21, style: "marble", polish: 0.85 }, edge: "", cnc: false, category: "sim" },
  { id: "sim-marble-black", name: "Marbre negre", thicknesses: [20, 30], hasGrain: false, finish: { kind: "stone", color: "#1e1e20", vein: "#d8d4cc", veins: 0.45, size: 1400, seed: 33, style: "marble", polish: 0.9 }, edge: "", cnc: false, category: "sim" },
]

/**
 * Gespa de foto (v18): feta amb Blender amb les mates d'herba de Poly Haven (grass_medium_01, CC0) vistes de dalt
 * (`public/textures/grass_lawn/`, 2 × 2 m, es repeteix sense junta). Abans (v17) era una tela verda.
 */
export const LAWN_FINISH: MaterialPref["finish"] = {
  kind: "image",
  src: "textures/grass_lawn/diff.jpg",
  normalMap: "textures/grass_lawn/nor.jpg",
  roughMap: "textures/grass_lawn/rough.jpg",
  tileMm: 2000,
  seamless: true,
  color: "#474f27",
}
const OLD_LAWN_FINISH: MaterialPref["finish"] = { kind: "fabric", color: "#5b7337" }

/**
 * Revestiment de paret de roure de fil (veta recta, sense les flames de la xapa de foto), com les parets de fusta de les
 * fotos de catàleg, i la gespa de fora. Afegits a la v17.
 */
export const CLADDING_MATERIALS: MaterialPref[] = [
  // Fora de les habitacions amb arbres davant de les finestres (terra de fora, `Ambient3D`). Foto de gespa (v18).
  { id: "sim-lawn", name: "Gespa", thicknesses: [10], hasGrain: false, finish: LAWN_FINISH, edge: "", cnc: false, category: "sim" },
  { id: "sim-oak-cladding-rift", name: "Revestiment de roure de fil", thicknesses: [10], hasGrain: true, finish: { kind: "wood", species: "oak", gen: { base: "#b48e62", dark: "#8c6a44", lines: 60, wobble: 0.025, bands: 30, contrast: 0.4, figure: 0, pores: 2400, grain: 10, tileMm: 1200, seed: 131 } }, edge: "", cnc: false, category: "sim" },
]
/** v17: les pantalles de lli feien massa llum (surtien blanques del tot al render del vespre). */
export const LAMPSHADE_GLOW = 2.2

/** Llum LED dels mobles (`Zone.led`): fa llum al render (càlida). Afegit a la v14. */
export const LED_MATERIALS: MaterialPref[] = [
  { id: "led-strip", name: "Tira LED", thicknesses: [8], hasGrain: false, finish: { kind: "color", color: "#ffe2b8", roughness: 0.4 }, edge: "", cnc: false, category: "sim", glow: 60 },
]

/** Materials de simulació: només per veure (ambients, blocs, coixins). Afegits a la v3. */
const sim = (id: string, name: string, finish: Finish, hasGrain = false, fx: Pick<MaterialPref, "glow" | "translucent"> = {}): MaterialPref => ({ id, name, thicknesses: [10], hasGrain, finish, edge: "", cnc: false, category: "sim", ...fx })
export const SIM_MATERIALS: MaterialPref[] = [
  sim("sim-fabric-grey", "Teixit gris", { kind: "fabric", color: "#8e8e8a" }),
  sim("sim-fabric-beige", "Teixit beix", { kind: "fabric", color: "#cbbca2" }),
  sim("sim-fabric-blue", "Teixit blau", { kind: "fabric", color: "#44597a" }),
  sim("sim-velvet-green", "Vellut verd", { kind: "fabric", color: "#4d6a4b" }),
  sim("sim-linen-white", "Lli blanc", { kind: "fabric", color: "#ece6da" }, false, { translucent: 0.3 }),
  sim("sim-rug-beige", "Catifa beix", { kind: "fabric", color: "#d6c7ac" }),
  sim("sim-leather", "Cuir conyac", { kind: "color", color: "#8a5634" }),
  sim("sim-parquet-oak", "Parquet de roure", { kind: "wood", species: "oak" }, true),
  sim("sim-parquet-walnut", "Parquet de noguera", { kind: "wood", species: "walnut" }, true),
  sim("sim-tile-white", "Rajola blanca 600", { kind: "tiles", color: "#efece6", grout: "#cfcac0", size: 600 }),
  sim("sim-tile-grey", "Rajola gris 600", { kind: "tiles", color: "#a9a7a2", grout: "#8d8b86", size: 600 }),
  sim("sim-tile-terracotta", "Rajola de fang 300", { kind: "tiles", color: "#b86e4b", grout: "#d8c7b3", size: 300 }),
  sim("sim-microcement", "Microciment gris", { kind: "color", color: "#a7a39b" }),
  sim("sim-concrete", "Formigó", { kind: "color", color: "#9c9a95" }),
  sim("sim-paint-white", "Pintura blanca", { kind: "color", color: "#f3f1ec" }),
  sim("sim-paint-sage", "Pintura verd sàlvia", { kind: "color", color: "#b5c0aa" }),
  sim("sim-paint-terracotta", "Pintura terracota", { kind: "color", color: "#c98a6b" }),
  sim("sim-steel-appliance", "Electrodomèstic inox", { kind: "metal", color: "#c8ccd0" }),
  sim("sim-appliance-white", "Electrodomèstic blanc", { kind: "lacquer", color: "#f4f4f2" }),
  // v4: materials de les escenes de revista (estucs, pedres, teixits, plantes, cortines…).
  sim("sim-stucco-greige", "Estuc greige", { kind: "color", color: "#b9ad9d" }),
  sim("sim-stucco-grey", "Estuc gris clar", { kind: "color", color: "#cdcac4" }),
  sim("sim-concrete-light", "Formigó clar", { kind: "color", color: "#bdb9b1" }),
  sim("sim-travertine", "Travertí", { kind: "tiles", color: "#d8cbb5", grout: "#cbbda6", size: 600 }),
  sim("sim-limestone", "Pedra calcària", { kind: "tiles", color: "#d9d2c4", grout: "#c9c1b2", size: 800 }),
  sim("sim-porcelain-black", "Porcellànic negre", { kind: "tiles", color: "#232325", grout: "#1a1a1b", size: 1200 }),
  sim("sim-stone-wall", "Pedra de paret", { kind: "tiles", color: "#b9a888", grout: "#8f8068", size: 350 }),
  sim("sim-paint-black", "Pintura negra", { kind: "color", color: "#2a2a2a" }),
  sim("sim-paint-pink", "Pintura rosa pàl·lid", { kind: "color", color: "#dcc6bd" }),
  sim("sim-paint-dark-green", "Pintura verd fosc", { kind: "color", color: "#34413a" }),
  sim("sim-oak-cladding", "Revestiment de roure", { kind: "wood", species: "oak" }, true),
  sim("sim-washed-wood", "Fusta rentada", { kind: "wood", species: "ash" }, true),
  sim("sim-velvet-olive", "Vellut verd oliva", { kind: "fabric", color: "#5d6446" }),
  sim("sim-fabric-navy", "Teixit blau marí", { kind: "fabric", color: "#1f2a44" }),
  sim("sim-fabric-sand", "Teixit sorra", { kind: "fabric", color: "#cfc2ad" }),
  sim("sim-fabric-red", "Teixit vermell", { kind: "fabric", color: "#8b2a2a" }),
  sim("sim-fabric-ochre", "Teixit ocre", { kind: "fabric", color: "#b58a45" }),
  sim("sim-boucle", "Bouclé blanc", { kind: "fabric", color: "#ebe5da" }),
  sim("sim-tulle", "Tul blanc", { kind: "fabric", color: "#f5f2ec" }, false, { translucent: 0.6 }),
  sim("sim-leather-green", "Cuir verd", { kind: "color", color: "#5d7466" }),
  sim("sim-leather-black", "Cuir negre", { kind: "color", color: "#262422" }),
  sim("sim-jute", "Jute", { kind: "fabric", color: "#b8a58a" }),
  sim("sim-kilim", "Catifa kilim", { kind: "tiles", color: "#a8564a", grout: "#caa27f", size: 250 }),
  sim("sim-rug-grey", "Catifa gris", { kind: "fabric", color: "#9d9a94" }),
  sim("sim-leaves", "Fulles", { kind: "fabric", color: "#3e5a38" }, false, { translucent: 0.4 }),
  sim("sim-leaves-light", "Fulles clares", { kind: "fabric", color: "#6b8a4e" }, false, { translucent: 0.4 }),
  // v12: «Pi» → «Fulles de pi» (es confonia amb la fusta de pi de la biblioteca).
  sim("sim-pine", "Fulles de pi", { kind: "fabric", color: "#2f4a30" }, false, { translucent: 0.3 }),
  sim("sim-bark", "Escorça", { kind: "color", color: "#6d5a47" }),
  sim("sim-soil", "Terra de test", { kind: "color", color: "#4a3a2c" }),
  sim("sim-ceramic-white", "Ceràmica blanca", { kind: "lacquer", color: "#eeebe4" }),
  sim("sim-ceramic-black", "Ceràmica negra", { kind: "lacquer", color: "#2b2a28" }),
  sim("sim-brass", "Llautó", { kind: "metal", color: "#b8954a" }),
  sim("sim-frame-black", "Alumini negre", { kind: "metal", color: "#2a2b2d" }),
  sim("sim-canvas-art", "Llenç abstracte", { kind: "tiles", color: "#d9cbb4", grout: "#9a6b4b", size: 400 }),
  sim("sim-canvas-dark", "Llenç fosc", { kind: "fabric", color: "#3b3631" }),
  sim("sim-screen", "Pantalla negra", { kind: "lacquer", color: "#111214" }),
  sim("sim-mirror", "Mirall", { kind: "metal", color: "#e4e8e8" }),
  sim("sim-book", "Llibres", { kind: "tiles", color: "#a49781", grout: "#5b4a3a", size: 60 }),
  // v5: llums dels objectes (el render en fa llum: «Llums enceses»).
  sim("sim-lampshade", "Pantalla de lli", { kind: "fabric", color: "#f1eadc" }, false, { glow: LAMPSHADE_GLOW, translucent: 0.5 }),
  sim("sim-bulb", "Bombeta", { kind: "color", color: "#fff6e6", roughness: 0.3 }, false, { glow: 30 }),
]

/**
 * Versió de les preferències que va portar cada material de simulació (v3 els primers, v4 els de les escenes de
 * revista, v5 els llums): la migració només afegeix els d'una versió posterior a la desada.
 */
export const SIM_MATERIALS_SINCE: Record<string, 3 | 4 | 5> = Object.fromEntries(
  SIM_MATERIALS.map((m, i) => {
    const v4 = SIM_MATERIALS.findIndex((x) => x.id === "sim-stucco-greige")
    const v5 = SIM_MATERIALS.findIndex((x) => x.id === "sim-lampshade")
    return [m.id, i >= v5 ? 5 : i >= v4 ? 4 : 3]
  }),
)

/**
 * Materials que les plantilles fan servir i que no hi eren (v9): el material i el fons de `DEFAULT_CABINET` i els
 * MDF lacats de colors (els colors que abans en deduïa el visor pel nom). La migració només afegeix els que falten.
 */
const lacquered = (id: string, name: string, color: string): MaterialPref => ({ id, name, thicknesses: [16, 19, 30], hasGrain: false, finish: { kind: "lacquer", color }, edge: "Lacat (sense cantell)" })
export const TEMPLATE_MATERIALS: MaterialPref[] = [
  lacquered("mdf-lacquer-greige", "MDF lacat greige", "#c8bfb2"),
  lacquered("mdf-lacquer-anthracite", "MDF lacat antracita", "#3d3f42"),
  lacquered("mdf-lacquer-olive", "MDF lacat verd oliva", "#6f7550"),
  lacquered("mdf-lacquer-terracotta", "MDF lacat terracota", "#b8664a"),
  lacquered("mdf-lacquer-navy", "MDF lacat blau fosc", "#2c3a52"),
  lacquered("mdf-lacquer-black", "MDF lacat negre", "#2b2b2b"),
  lacquered("mdf-lacquer-light-grey", "MDF lacat gris clar", "#cbcac6"),
  lacquered("mdf-lacquer-dark-green", "MDF lacat verd fosc", "#2f3b36"),
]

/**
 * «Melamina 19» i «DM 10» (v9, els de `DEFAULT_CABINET`) eren iguals que «Melamina blanca» i «DM (fons)»: la v12 els
 * treu (`mergeDuplicateMaterials`) si no s'han tocat i les plantilles ja fan servir els de sempre.
 */
export const RETIRED_TEMPLATE_MATERIALS: MaterialPref[] = [
  { id: "mel-19", name: "Melamina 19", thicknesses: [16, 19], hasGrain: false, finish: { kind: "color", color: "#f2f0eb" }, edge: "PVC blanc 1 mm" },
  { id: "dm-10", name: "DM 10", thicknesses: [10], hasGrain: false, finish: { kind: "color", color: "#c9b79a" }, edge: "", forBacks: true },
]

/** Valors inicials: els de sempre amb l'acabat de foto on n'hi ha (v7) i la resta de fotos, sense duplicats. */
export const BUILTIN_MATERIALS: MaterialPref[] = upgradeToPhoto([
  { id: "mel-white", name: "Melamina blanca", thicknesses: [10, 16, 19, 30], hasGrain: false, finish: { kind: "color", color: "#f2f0eb" }, edge: "PVC blanc 1 mm" },
  { id: "mel-grey", name: "Melamina gris", thicknesses: [16, 19, 30], hasGrain: false, finish: { kind: "color", color: "#9a9a96" }, edge: "PVC gris 1 mm" },
  { id: "mel-black", name: "Melamina negra", thicknesses: [16, 19], hasGrain: false, finish: { kind: "color", color: "#2b2b2b" }, edge: "PVC negre 1 mm" },
  { id: "mel-oak", name: "Melamina roure", thicknesses: [16, 19, 30], hasGrain: true, finish: { kind: "wood", species: "oak" }, edge: "PVC roure 1 mm" },
  { id: "mdf-lacquer", name: "MDF lacat", thicknesses: [16, 19, 22, 30], hasGrain: false, finish: { kind: "lacquer", color: "#e9e6df" }, edge: "Lacat (sense cantell)" },
  { id: "oak", name: "Roure massís / xapat", thicknesses: [19, 30, 40], hasGrain: true, finish: { kind: "wood", species: "oak" }, edge: "Xapa de roure" },
  { id: "walnut", name: "Noguera xapada", thicknesses: [19], hasGrain: true, finish: { kind: "wood", species: "walnut" }, edge: "Xapa de noguera" },
  { id: "ash", name: "Freixe xapat", thicknesses: [16, 19, 30], hasGrain: true, finish: { kind: "wood", species: "ash" }, edge: "Xapa de freixe" },
  { id: "mdf-back", name: "DM (fons)", thicknesses: [10, 12], hasGrain: false, finish: { kind: "color", color: "#c9b79a" }, edge: "", forBacks: true },
  { id: "plywood-back", name: "Contraxapat (fons)", thicknesses: [10, 12, 15], hasGrain: true, finish: { kind: "wood", species: "ash" }, edge: "", forBacks: true },
  ...TEMPLATE_MATERIALS,
  ...NON_CNC_MATERIALS,
  ...SIM_MATERIALS,
  ...LED_MATERIALS,
  ...GLOSS_MATERIALS,
  ...RIFT_MATERIALS,
  ...CLADDING_MATERIALS,
  ...PHOTO_MATERIALS,
])

/** Folgança inicial de les peces de dins (mm): divisors i prestatges fixos d'un mòdul dividit. */
export const DEFAULT_INNER_CLEARANCE = 1

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
  hardwareLibrary: DEFAULT_HARDWARE_LIBRARY,
  hardwareDefaults: DEFAULT_HARDWARE_DEFAULTS,
  kitPilot: DEFAULT_KIT_PILOT,
  gaps: {
    outerGap: DEFAULT_CABINET.doorGap,
    betweenGap: DEFAULT_CABINET.doorGapBetween,
    shelfClearance: DEFAULT_CABINET.shelfClearance,
    shelfSetback: DEFAULT_CABINET.shelfSetback,
    backClearance: DEFAULT_CABINET.backClearance,
    backSetback: DEFAULT_CABINET.backSetback,
    grooveDepth: DEFAULT_CABINET.grooveDepth,
    innerClearance: DEFAULT_INNER_CLEARANCE,
  },
  label: { w: 99, h: 68 },
  display: { unit: "mm" },
  defaults: { material: "Melamina blanca", thickness: 19, backMaterial: "DM (fons)", backThickness: 10 },
  machines: [],
  machiningRules: defaultMachineRules(),
}

// --- Migració i importació ------------------------------------------------------------

export interface SettingsParse {
  settings: Settings
  /** Problemes trobats (en català). Buit si tot era vàlid. */
  problems: string[]
  migrated: boolean
  /**
   * Noms de material canviats per la migració (v12, `mergeDuplicateMaterials`): `loadSettings` els segueix als mobles
   * i ambients desats (`renameMaterialEverywhere`). Buit si no n'hi ha.
   */
  renames?: [string, string][]
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
  // Una versió anterior es desa ja migrada. Cada pas depèn només de la versió desada, que mai baixa (`saveSettings`
  // desa la més alta): un fitxer ja migrat no torna a afegir els materials que l'usuari ha esborrat.
  if (version < SETTINGS_VERSION) migrated = true
  if (version > SETTINGS_VERSION) problems.push(`Preferències d'una versió més nova (${version}); s'ha llegit el que s'ha pogut.`)
  // v25: la folgança de les peces de dins, amb el valor inicial (additiu: si ja n'hi ha una, es queda).
  if (version < 25 && isRecord(obj.gaps) && !("innerClearance" in obj.gaps)) obj = { ...obj, gaps: { ...obj.gaps, innerClearance: DEFAULT_INNER_CLEARANCE } }

  // Camp a camp (`repairValue`): un valor dolent només torna aquell valor a l'inicial (un tauler o una llargada de
  // guia dolents només es treuen), no tota la secció.
  const section = <T>(key: string, schema: z.ZodType<T>, fallback: T, label: string): T => {
    if (!(key in obj)) return fallback
    const res = schema.safeParse(obj[key])
    if (res.success) return res.data
    const fixed: string[] = []
    const out = repairValue(schema, obj[key], fallback, (path, what) => fixed.push(`${path || "tot"} ${what}`))
    problems.push(`${label}: ${fixed.join("; ") || "valor invàlid"}; la resta es manté.`)
    return out ?? fallback
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

  const stored = list("references", RefPresetSchema, BUILTIN_REFERENCES, "Objectes de referència")
  const kept = stored.filter((r) => !isRetired(r))
  if (kept.length !== stored.length) migrated = true
  const references = withBuiltins(kept, BUILTIN_REFERENCES)
  const materialsRaw = list("materials", MaterialPrefSchema, BUILTIN_MATERIALS, "Materials")
  // v2: materials que no són de CNC (ferro, inox, pedra, vidre), per a les peces lliures.
  // v3: materials de simulació (teixits, parquet, rajola, pintura) per als ambients.
  const missing = (list: MaterialPref[], from: MaterialPref[]) => list.filter((m) => !from.some((x) => x.id === m.id || x.name === m.name))
  const v2 = materialsRaw.length && version < 2 ? [...materialsRaw, ...missing(NON_CNC_MATERIALS, materialsRaw)] : materialsRaw
  // Cada grup només s'afegeix a qui encara no l'havia rebut (versió desada anterior a la que el va portar): així els
  // que l'usuari ha esborrat no tornen.
  const sims = (v: number) => SIM_MATERIALS.filter((m) => SIM_MATERIALS_SINCE[m.id] === v)
  const v4 = v2.length ? [...v2, ...missing([...(version < 3 ? sims(3) : []), ...(version < 4 ? sims(4) : []), ...(version < 5 ? sims(5) : [])], v2)] : BUILTIN_MATERIALS
  // v5: llum i translucidesa dels materials de simulació de sempre (si no se n'hi ha posat).
  const v5 = version < 5 ? v4.map((m) => {
    const b = SIM_MATERIALS.find((x) => x.id === m.id)
    return b && (b.glow !== undefined || b.translucent !== undefined) && m.glow === undefined && m.translucent === undefined ? { ...m, ...(b.glow !== undefined ? { glow: b.glow } : {}), ...(b.translucent !== undefined ? { translucent: b.translucent } : {}) } : m
  }) : v4
  // v6: materials de foto amb mapes PBR (Poly Haven), només els que falten.
  const v6 = version < 6 && v5 !== BUILTIN_MATERIALS ? [...v5, ...missing(PHOTO_MATERIALS, v5)] : v5
  // v7: els de sempre amb l'acabat de foto; els «(foto)» repetits fora i la resta sense «(foto)» (idempotent).
  const v7m = version < 7 && v6 !== BUILTIN_MATERIALS ? upgradeToPhoto(v6) : v6
  // v8: mida real de les xapes de foto (roure 1100 → 600, noguera…), només si encara tenen la d'abans.
  const v8m = version < 8 && v7m !== BUILTIN_MATERIALS ? rescalePhotoTiles(v7m) : v7m
  // v9: gruixos perduts a la v7 (xapes de foto) i materials de les plantilles que faltaven (mai se'n sobreescriu cap).
  const v9m = version < 9 && v8m !== BUILTIN_MATERIALS ? [...restorePhotoThicknesses(v8m), ...missing(TEMPLATE_MATERIALS, v8m)] : v8m
  // v12: duplicats fora («Melamina 19», «DM 10», «Pi»); els noms canviats es segueixen a tot arreu (`renames`).
  const v12 = version < 12 && v9m !== BUILTIN_MATERIALS ? mergeDuplicateMaterials(v9m) : { materials: v9m, renames: [] }
  // v13: gruixos que les plantilles del catàleg fan servir i els materials inicials no tenien (només s'afegeixen).
  const v13m = version < 13 && v12.materials !== BUILTIN_MATERIALS ? addCatalogThicknesses(v12.materials) : v12.materials
  // v14: «Tira LED» (llum dels mobles), si no hi és.
  const v14m = version < 14 && v13m !== BUILTIN_MATERIALS ? [...v13m, ...missing(LED_MATERIALS, v13m)] : v13m
  // v15: lacats brillants (vernís), si no hi són.
  const v15m = version < 15 && v14m !== BUILTIN_MATERIALS ? [...v14m, ...missing(GLOSS_MATERIALS, v14m)] : v14m
  // v16: fusta de fil (roure i noguera), si no hi són.
  const v16m = version < 16 && v15m !== BUILTIN_MATERIALS ? [...v15m, ...missing(RIFT_MATERIALS, v15m)] : v15m
  // v17: revestiment de roure de fil, i la llum de les pantalles de lli (només si encara tenen la d'abans, 4).
  const v17m = version < 17 && v16m !== BUILTIN_MATERIALS
    ? [...v16m.map((m) => (m.id === "sim-lampshade" && m.glow === 4 ? { ...m, glow: LAMPSHADE_GLOW } : m)), ...missing(CLADDING_MATERIALS, v16m)]
    : v16m
  // v18: la «Gespa» de foto, si encara tenia la tela de la v17.
  const v18m = version < 18 && v17m !== BUILTIN_MATERIALS ? v17m.map((m) => (m.id === "sim-lawn" && deepEqual(m.finish, OLD_LAWN_FINISH) ? { ...m, finish: LAWN_FINISH } : m)) : v17m
  // Noms únics (sempre): un de repetit passa a «X 2» amb un avís (abans no es comprovava).
  const unique = dedupeMaterialNames(v18m)
  problems.push(...unique.problems)
  const materials = unique.materials
  const renamed = (n: string) => v12.renames.find(([from]) => from === n)?.[1] ?? n
  const boards = section("boards", BoardsPrefSchema, DEFAULT_SETTINGS.boards, "Taulers")
  const defaults = section("defaults", SettingsSchema.shape.defaults, DEFAULT_SETTINGS.defaults, "Materials (per defecte als mòduls nous)")
  const v7 = version < 7
  const machines = oneDefault(machinesOf(obj.machines, problems, () => (migrated = true)))
  // v11: regles del taller. Si les preferències no en porten (anteriors a la v11), les de les màquines (`rulesFromMachines`).
  const machiningRules = "machiningRules" in obj
    ? section("machiningRules", MachineRulesSchema, defaultMachineRules(), "Regles de mecanitzat")
    : (rulesFromMachines(machines) ?? defaultMachineRules())
  if (machines.some((m) => m.rules !== undefined)) migrated = true
  // v19: biblioteca de ferratges. Sense (anteriors a la v19), els items inicials amb els números d'abans (`hardware`):
  // cap forat no canvia de lloc. Un item dolent només treu aquell item; cada lloc apunta a un item que hi és.
  const hardwareRaw = "hardwareLibrary" in obj
    ? list("hardwareLibrary", HardwareItemSchema, DEFAULT_HARDWARE_LIBRARY, "Ferratges")
    : libraryFromLegacy(section("hardware", LegacyHardwareSchema, DEFAULT_LEGACY_HARDWARE, "Ferratges"))
  // Els importats amb el nom que posava l'app abans (carpeta de l'usuari i del ZIP al nom) passen al d'ara.
  const named = migrateImportedNames(hardwareRaw)
  if (named.changed) migrated = true
  // v23: els jocs de calaix inicials, si no hi són (per id; un d'esborrat a propòsit torna un sol cop, com els materials).
  const withKits = version < 23 ? [...named.library, ...DEFAULT_HARDWARE_KITS.filter((k) => !named.library.some((x) => x.id === k.id)).map((k) => structuredClone(k))] : named.library
  if (withKits !== named.library && withKits.length !== named.library.length) migrated = true
  // v24: els jocs inicials reben les dades del joc d'ara (formes 3D, acabats); nom i prebroca de l'usuari es queden.
  const freshKits = version < 24
    ? withKits.map((x) => {
        const fresh = x.builtin && x.engine === "drawerKit" ? DEFAULT_HARDWARE_KITS.find((k) => k.id === x.id) : undefined
        return fresh?.kit ? { ...x, kit: structuredClone(fresh.kit) } : x
      })
    : withKits
  if (freshKits.some((x, i) => x !== withKits[i])) migrated = true
  const hardware = fixHardwareDefaults(freshKits, section("hardwareDefaults", HardwareDefaultsSchema.partial(), DEFAULT_HARDWARE_DEFAULTS, "Ferratges (per defecte)"))
  if (hardware.changed) migrated = true
  // Prebroca dels cargols, una sola font: la regla desada o, a les preferències d'abans, la del primer joc de la
  // biblioteca (el que es feia servir); els jocs de la biblioteca en copien els números.
  const pilotRule = (() => {
    const pilot = "kitPilot" in obj ? section("kitPilot", KitPilotSchema, kitPilotFromLibrary(hardware.library), "Ferratges (prebroca)") : kitPilotFromLibrary(hardware.library)
    if (!("kitPilot" in obj)) migrated = true
    const library = setKitPilot(hardware.library, pilot)
    return { pilot, library: library.some((x, i) => x !== hardware.library[i]) ? library : hardware.library }
  })()
  // Àlies segons els materials d'aquestes preferències (un «X (foto)» que encara hi és no es toca).
  const names = new Set(materials.map((m) => m.name))
  const alias = (n: string) => resolveMaterialAlias(n, names)
  const settings: Settings = {
    version: SETTINGS_VERSION,
    references,
    materials,
    boards: v7 || v12.renames.length ? { ...boards, sheets: boards.sheets.map((x) => ({ ...x, material: renamed(v7 ? alias(x.material) : x.material) })) } : boards,
    hardwareLibrary: pilotRule.library,
    hardwareDefaults: hardware.defaults,
    kitPilot: pilotRule.pilot,
    gaps: section("gaps", GapsPrefSchema, DEFAULT_SETTINGS.gaps, "Folgances per defecte"),
    label: section("label", LabelPrefSchema, DEFAULT_SETTINGS.label, "Etiquetes"),
    display: section("display", DisplayPrefSchema, DEFAULT_SETTINGS.display, "Visualització"),
    defaults: v7 || v12.renames.length ? { ...defaults, material: renamed(v7 ? alias(defaults.material) : defaults.material), backMaterial: renamed(v7 ? alias(defaults.backMaterial) : defaults.backMaterial) } : defaults,
    // v10: màquines CNC (additiu: abans no n'hi havia). Si n'hi ha més d'una per defecte, només la primera.
    // Una eina invàlida només treu aquella eina, no tota la màquina (`repairMachine`).
    // v11: les regles ja no són de la màquina (`machiningRules`); les `rules` desades es treuen.
    machines: machines.map(stripRules),
    machiningRules,
  }
  return { settings, problems, migrated: migrated || problems.length > 0, renames: v12.renames }
}

/** Un material sense l'`id` (per comparar-lo amb un valor inicial). */
const withoutId = ({ id: _id, ...rest }: MaterialPref) => rest

/**
 * v12: duplicats fora. «Melamina 19» → «Melamina blanca» i «DM 10» → «DM (fons)» (només si encara són els inicials de
 * la v9 i el de sempre hi és; els gruixos passen al de sempre) i «Pi» (fulles, `sim-pine`) → «Fulles de pi» (si el nom
 * és lliure). Torna els canvis de nom (`from → to`) perquè les preferències (per defecte, taulers) i els mobles i
 * ambients desats els segueixin. Idempotent.
 */
/** Gruixos que fan servir les plantilles del catàleg (v13): s'afegeixen als materials inicials que no els tenien. */
export const CATALOG_THICKNESSES: Record<string, number[]> = { "mel-white": [30], "mel-grey": [30], "mel-oak": [30], oak: [40], ash: [16, 30] }
export function addCatalogThicknesses(list: MaterialPref[]): MaterialPref[] {
  return list.map((m) => {
    const add = (CATALOG_THICKNESSES[m.id] ?? []).filter((t) => !m.thicknesses.includes(t))
    return add.length ? { ...m, thicknesses: [...m.thicknesses, ...add].sort((a, b) => a - b) } : m
  })
}

export function mergeDuplicateMaterials(list: MaterialPref[]): { materials: MaterialPref[]; renames: [string, string][] } {
  let out = list
  const renames: [string, string][] = []
  const has = (name: string) => out.some((m) => m.name === name)
  for (const retired of RETIRED_TEMPLATE_MATERIALS) {
    const target = MATERIAL_MERGES[retired.name]!
    const dup = out.find((m) => m.name === retired.name)
    const owner = out.find((m) => m.name === target)
    if (!dup || !owner || !deepEqual(withoutId(dup), withoutId(retired))) continue
    const thicknesses = [...new Set([...owner.thicknesses, ...dup.thicknesses])].sort((a, b) => a - b)
    out = out.filter((m) => m !== dup).map((m) => (m === owner && thicknesses.length !== m.thicknesses.length ? { ...m, thicknesses } : m))
    renames.push([retired.name, target])
  }
  // Només si «Pi» és les fulles (sim-pine) i cap altre material es diu «Pi» (p. ex. la fusta de pi de la biblioteca): si
  // no, es reanomenarien també els mobles de fusta de pi.
  const pine = out.find((m) => m.id === "sim-pine" && m.name === "Pi")
  const otherPi = out.some((m) => m !== pine && m.name.trim().toLowerCase() === "pi")
  if (pine && !otherPi && !has(MATERIAL_MERGES.Pi!)) {
    out = out.map((m) => (m === pine ? { ...m, name: MATERIAL_MERGES.Pi! } : m))
    renames.push(["Pi", MATERIAL_MERGES.Pi!])
  }
  return { materials: out, renames }
}

/**
 * Noms repetits (`materialNameKey`: majúscules i espais a part) en unes preferències desades: el segon es diu «X 2»
 * (el tercer «X 3»…). Les dades es conserven; els mobles continuen apuntant al primer.
 */
export function dedupeMaterialNames(list: MaterialPref[]): { materials: MaterialPref[]; problems: string[] } {
  const keys = new Set<string>()
  const problems: string[] = []
  const all = new Set(list.map((m) => materialNameKey(m.name)))
  const materials = list.map((m) => {
    const k = materialNameKey(m.name)
    if (!keys.has(k)) {
      keys.add(k)
      return m
    }
    let n = 2
    while (all.has(materialNameKey(`${m.name.trim()} ${n}`))) n++
    const name = `${m.name.trim()} ${n}`
    all.add(materialNameKey(name))
    keys.add(materialNameKey(name))
    problems.push(`Materials: «${m.name.trim()}» estava repetit; l'altre ara es diu «${name}».`)
    return { ...m, name }
  })
  return { materials: problems.length ? materials : list, problems }
}

const stripRules = (m: Machine): Machine => {
  if (m.rules === undefined) return m
  const { rules: _rules, ...rest } = m
  return rest
}

/**
 * v11: regles del taller d'unes preferències que encara les tenien per màquina: les de la màquina per defecte (o, si no
 * en té, les de la primera que en tingui; si cap, les inicials). Les màquines ja han passat per `migrateMachine`
 * (llindars provisionals d'abans migrats). `undefined` si cap màquina en porta.
 */
export function rulesFromMachines(machines: readonly Machine[]): MachineRules | undefined {
  return defaultMachine(machines)?.rules ?? machines.find((m) => m.rules)?.rules
}

function machinesOf(raw: unknown, problems: string[], onMigrated: () => void): Machine[] {
  if (!Array.isArray(raw)) return []
  const out: Machine[] = []
  for (const item of raw) {
    const r = repairMachine(item)
    const name = isRecord(item) && typeof item.name === "string" ? item.name : "?"
    // Els valors provisionals d'abans es migren un sol cop (`rulesVersion`); si canvia alguna cosa, es desa (així una
    // tria posterior de l'usuari es queda).
    if (r.machine) {
      const m = migrateMachine(r.machine)
      if (m !== r.machine) onMigrated()
      out.push(m)
    }
    else problems.push(`Màquines CNC: s'ha descartat la màquina ${name} (${r.problems.at(-1) ?? "invàlida"}).`)
    if (r.machine && r.problems.length) problems.push(`Màquines CNC (${name}): ${r.problems.join("; ")}.`)
  }
  return out
}

function oneDefault(ms: Machine[]): Machine[] {
  let seen = false
  return ms.map((m) => {
    if (!m.isDefault) return m
    if (seen) return { ...m, isDefault: false }
    seen = true
    return m
  })
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

/**
 * Importa un JSON de preferències **sobre les actuals**: només se substitueixen les seccions que porta el fitxer
 * (un fitxer sense `machines`, p. ex. d'abans de la v10, no esborra les màquines). Mai llança.
 */
export function importSettingsJson(current: Settings, text: string): SettingsParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { settings: current, problems: ["El fitxer no és un JSON vàlid."], migrated: false }
  }
  const res = parseSettings(raw)
  if (!isRecord(raw)) return { ...res, settings: current }
  const merged: Settings = { ...current }
  for (const key of Object.keys(current) as (keyof Settings)[]) {
    if (key !== "version" && key in raw) (merged as Record<string, unknown>)[key] = res.settings[key]
  }
  // Un fitxer d'abans de la v19 porta els ferratges com a números (`hardware`): la biblioteca que en surt.
  if (!("hardwareLibrary" in raw) && "hardware" in raw) {
    merged.hardwareLibrary = res.settings.hardwareLibrary
    merged.hardwareDefaults = res.settings.hardwareDefaults
  }
  // Els per defecte de ferratges es comproven contra la biblioteca que queda (no la inicial, com a `parseSettings`): un
  // fitxer només amb `hardwareDefaults` pot apuntar a un item teu, i un només amb `hardwareLibrary` pot deixar-ne d'orfes.
  const wantDefaults = "hardwareDefaults" in raw
    ? { ...merged.hardwareDefaults, ...repairValue(HardwareDefaultsSchema.partial(), raw.hardwareDefaults, {}, () => {}) }
    : merged.hardwareDefaults
  const hw = fixHardwareDefaults(merged.hardwareLibrary, wantDefaults)
  if (hw.changed) merged.hardwareLibrary = hw.library
  merged.hardwareDefaults = hw.defaults
  // Un fitxer d'abans de la v11 porta les regles a les màquines: es fan servir (`rulesFromMachines`).
  if (!("machiningRules" in raw) && Array.isArray(raw.machines) && raw.machines.some((m) => isRecord(m) && m.rules !== undefined)) {
    merged.machiningRules = res.settings.machiningRules
  }
  return { ...res, settings: merged }
}

/**
 * La màquina de l'export (la per defecte, `defaultMachine`) amb les regles del taller a `rules` (`withWorkshopRules`): la
 * forma que llegeixen els exports (`toMaestroNestXcs`, `cncNestOptions`, `nestPlan`). Mateix objecte per a les mateixes
 * preferències (memòria per objecte), així es pot posar a les dependències d'un `useMemo`.
 */
export function machineWithRules(s: Pick<Settings, "machines" | "machiningRules">): Machine | undefined {
  const hit = workshopMachineCache.get(s)
  if (hit && hit.machines === s.machines && hit.rules === s.machiningRules) return hit.machine
  const m = defaultMachine(s.machines)
  const machine = m ? withWorkshopRules(m, s.machiningRules) : undefined
  workshopMachineCache.set(s, { machines: s.machines, rules: s.machiningRules, machine })
  return machine
}
const workshopMachineCache = new WeakMap<object, { machines: readonly Machine[]; rules: MachineRules; machine: Machine | undefined }>()

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
      innerClearance: s.gaps.innerClearance,
    },
    fronts: { ...m.fronts, outerGap: s.gaps.outerGap, betweenGap: s.gaps.betweenGap },
    hardware: kitFrom(s.hardwareLibrary, s.hardwareDefaults),
  }
}

/** Mida de tauler per a un material (la primera regla que coincideix; buit = totes). */
export function sheetFor(s: Settings, material: string): { w: number; h: number } {
  const hit = s.boards.sheets.find((x) => x.material === material) ?? s.boards.sheets.find((x) => x.material === "")
  return hit ? { w: hit.w, h: hit.h } : { w: 2800, h: 2070 }
}
