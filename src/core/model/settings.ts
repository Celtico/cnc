import { z } from "zod"
import { DEFAULT_CABINET } from "./cabinet"
import { DEFAULT_HARDWARE, HardwareSchema, type Module } from "./composition"
import { PHOTO_MATERIALS } from "./textureSets"
import { rescalePhotoTiles, resolveMaterialAlias, upgradeToPhoto } from "./photoUpgrade"

/**
 * Preferències de l'usuari: tot el que depèn de casa seva i del taller (referències de
 * foto, materials, taulers, ferratges, jocs, etiquetes) i que el codi només porta com a
 * valors inicials. Es guarden a Dexie amb versió per poder-les migrar.
 *
 * Canviar una preferència no modifica els mobles ja fets: només els mòduls nous (que en
 * prenen ferratges, jocs i materials) i les pantalles que llegeixen les llistes.
 */

const mm = z.number().finite()

export const SETTINGS_VERSION = 8

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
})
export type MaterialPref = z.infer<typeof MaterialPrefSchema>
export type MaterialCategory = NonNullable<MaterialPref["category"]>

export const MATERIAL_CATEGORIES: { id: MaterialCategory; label: string; hint: string }[] = [
  { id: "board", label: "Taulers", hint: "Es tallen a la CNC: cossos, fronts, taulells." },
  { id: "back", label: "Fons", hint: "Taulers prims per als fons." },
  { id: "hard", label: "Metall, pedra i vidre", hint: "No es tallen a la CNC: surten a «Elements sense nesting»." },
  { id: "sim", label: "Simulació", hint: "Només es veuen: teixits, parquet, rajola, pintura… per als ambients i els blocs." },
]

/** Categoria d'un material: la triada o, als antics, deduïda dels interruptors. */
export function materialCategory(m: Pick<MaterialPref, "category" | "forBacks" | "cnc">): MaterialCategory {
  return m.category ?? (m.forBacks ? "back" : m.cnc === false ? "hard" : "board")
}

/** Canvia la categoria d'un material mantenint coherents `forBacks` i `cnc`. */
export function withCategory(m: MaterialPref, category: MaterialCategory): MaterialPref {
  const { forBacks: _f, cnc: _c, category: _k, ...rest } = m
  return { ...rest, category, ...(category === "back" ? { forBacks: true } : {}), ...(category === "hard" || category === "sim" ? { cnc: false } : {}) }
}

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
  sim("sim-pine", "Pi", { kind: "fabric", color: "#2f4a30" }, false, { translucent: 0.3 }),
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
  sim("sim-lampshade", "Pantalla de lli", { kind: "fabric", color: "#f1eadc" }, false, { glow: 4, translucent: 0.5 }),
  sim("sim-bulb", "Bombeta", { kind: "color", color: "#fff6e6", roughness: 0.3 }, false, { glow: 30 }),
]

/** Valors inicials: els de sempre amb l'acabat de foto on n'hi ha (v7) i la resta de fotos, sense duplicats. */
export const BUILTIN_MATERIALS: MaterialPref[] = upgradeToPhoto([
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
  ...NON_CNC_MATERIALS,
  ...SIM_MATERIALS,
  ...PHOTO_MATERIALS,
])

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
  // Una versió anterior es desa ja migrada (les migracions són idempotents: tornar-les a fer no canvia res).
  if (version < SETTINGS_VERSION) migrated = true
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

  const stored = list("references", RefPresetSchema, BUILTIN_REFERENCES, "Objectes de referència")
  const kept = stored.filter((r) => !isRetired(r))
  if (kept.length !== stored.length) migrated = true
  const references = withBuiltins(kept, BUILTIN_REFERENCES)
  const materialsRaw = list("materials", MaterialPrefSchema, BUILTIN_MATERIALS, "Materials")
  // v2: materials que no són de CNC (ferro, inox, pedra, vidre), per a les peces lliures.
  // v3: materials de simulació (teixits, parquet, rajola, pintura) per als ambients.
  const missing = (list: MaterialPref[], from: MaterialPref[]) => list.filter((m) => !from.some((x) => x.id === m.id || x.name === m.name))
  const v2 = materialsRaw.length && version < 2 ? [...materialsRaw, ...missing(NON_CNC_MATERIALS, materialsRaw)] : materialsRaw
  const v4 = v2.length ? (version < 6 ? [...v2, ...missing(SIM_MATERIALS, v2)] : v2) : BUILTIN_MATERIALS
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
  const materials = version < 8 && v7m !== BUILTIN_MATERIALS ? rescalePhotoTiles(v7m) : v7m
  const boards = section("boards", BoardsPrefSchema, DEFAULT_SETTINGS.boards, "Taulers")
  const defaults = section("defaults", SettingsSchema.shape.defaults, DEFAULT_SETTINGS.defaults, "Materials per defecte")
  const v7 = version < 7
  const settings: Settings = {
    version: SETTINGS_VERSION,
    references,
    materials,
    boards: v7 ? { ...boards, sheets: boards.sheets.map((x) => ({ ...x, material: resolveMaterialAlias(x.material) })) } : boards,
    hardware: section("hardware", HardwareSchema, DEFAULT_SETTINGS.hardware, "Ferratges"),
    gaps: section("gaps", GapsPrefSchema, DEFAULT_SETTINGS.gaps, "Jocs"),
    label: section("label", LabelPrefSchema, DEFAULT_SETTINGS.label, "Etiqueta"),
    display: section("display", DisplayPrefSchema, DEFAULT_SETTINGS.display, "Visualització"),
    defaults: v7 ? { ...defaults, material: resolveMaterialAlias(defaults.material), backMaterial: resolveMaterialAlias(defaults.backMaterial) } : defaults,
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
