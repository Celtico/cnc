import { DEFAULT_CABINET } from "./cabinet"
import { DEFAULT_HARDWARE_DEFAULTS, DEFAULT_HARDWARE_LIBRARY } from "./hardware"
import { DEFAULT_KIT_PILOT } from "./hardwareKit"
import { PHOTO_MATERIALS } from "./textureSets"
import { CORIAN_CATALOG, CORIAN_THICKNESSES } from "./corianColors"
import { upgradeToPhoto } from "./photoUpgrade"
import { defaultMachineRules } from "./machine"
import { SETTINGS_VERSION, type AssistantPref, type Finish, type MaterialPref, type RefPreset, type Settings } from "./settingsSchema"

/** Joc de l'ample de la ranura del fons per defecte (v33; per decisió de l'usuari, 2026-10-14: «per defecte 0,8»). */
export const DEFAULT_GROOVE_CLEARANCE = 0.8

const DEFAULT_ASSISTANT_MODEL: AssistantPref["model"] = "claude-sonnet-5-5"

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
export function isRetired(r: RefPreset): boolean {
  return (!!r.builtin && RETIRED_REFERENCES.has(r.id)) || /^TV Sony KD-55XD8505/.test(r.name)
}

/** Materials que no es tallen a la CNC (peces lliures sense nesting). Afegits a la v2. */
export const NON_CNC_MATERIALS: MaterialPref[] = [
  { id: "iron-black", name: "Ferro negre", thicknesses: [3, 5, 10, 20, 40], hasGrain: false, finish: { kind: "metal", color: "#3b3b3d" }, edge: "", cnc: false },
  { id: "steel-inox", name: "Acer inox", thicknesses: [3, 5, 10, 20, 40], hasGrain: false, finish: { kind: "metal", color: "#c3c7cb" }, edge: "", cnc: false },
  { id: "stone", name: "Pedra", thicknesses: [20, 30], hasGrain: false, finish: { kind: "color", color: "#d9d4ca" }, edge: "", cnc: false },
  { id: "glass", name: "Vidre", thicknesses: [4, 5, 6, 8, 10], hasGrain: false, finish: { kind: "glass", color: "#cfe6e3" }, edge: "", cnc: false },
]

/**
 * Superfície sòlida tipus Corian (resina acrílica amb càrrega mineral; per decisió de l'usuari, 2026-10-17): es mecanitza
 * a la CNC com la fusta (fresa, sense veta), es fan taulells, sobres, lavabos i mobles, i es veu com una pedra mat. És
 * massís (el cantell és el mateix material, polit: no es canteja). Les planxes són de 6, 12 i 19 mm; 38 i 57 són dues o
 * tres de 19 encolades (el bloc d'un lavabo massís, on es fresa la pica). Afegits a la v50 (els blocs, a la v51).
 */
export const CORIAN_MATERIALS: MaterialPref[] = [
  { id: "corian-white", name: "Corian blanc", thicknesses: [...CORIAN_THICKNESSES], hasGrain: false, finish: { kind: "stone", color: "#f1efea", vein: "#e2ded6", veins: 0, size: 600, seed: 7, style: "granite", grain: 0.08, polish: 0.35 }, edge: "", solid: true, category: "corian" },
  { id: "corian-sand", name: "Corian sorra", thicknesses: [...CORIAN_THICKNESSES], hasGrain: false, finish: { kind: "stone", color: "#ddd3c3", vein: "#c4b8a4", veins: 0, size: 600, seed: 13, style: "granite", grain: 0.06, polish: 0.35 }, edge: "", solid: true, category: "corian" },
  { id: "corian-grey", name: "Corian gris pedra", thicknesses: [...CORIAN_THICKNESSES], hasGrain: false, finish: { kind: "stone", color: "#9d9b97", vein: "#85837e", veins: 0, size: 600, seed: 19, style: "granite", grain: 0.08, polish: 0.35 }, edge: "", solid: true, category: "corian" },
]

/** Els acabats dels Corian a la v50 (massa gra): la v51 els canvia si no s'han tocat (i hi afegeix els blocs de 38 i 57). */
export const CORIAN_V50_FINISH: Record<string, Finish> = {
  "corian-white": { kind: "stone", color: "#f1efea", vein: "#e2ded6", veins: 0, size: 600, seed: 7, style: "granite", grain: 0.08, polish: 0.35 },
  "corian-sand": { kind: "stone", color: "#ddd3c3", vein: "#a99a84", veins: 0, size: 600, seed: 13, style: "granite", grain: 0.35, polish: 0.35 },
  "corian-grey": { kind: "stone", color: "#9d9b97", vein: "#6f6c67", veins: 0, size: 600, seed: 19, style: "granite", grain: 0.4, polish: 0.35 },
}

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
export const OLD_LAWN_FINISH: MaterialPref["finish"] = { kind: "fabric", color: "#5b7337" }

/**
 * Revestiment de paret de roure de fil (veta recta, sense les flames de la xapa de foto), com les parets de fusta de les
 * fotos de catàleg, i la gespa de fora. Afegits a la v17.
 */
export const CLADDING_MATERIALS: MaterialPref[] = [
  // Fora de les habitacions amb arbres davant de les finestres (terra de fora, `Ambient3D`). Foto de gespa (v18).
  { id: "sim-lawn", name: "Gespa", thicknesses: [10], hasGrain: false, finish: LAWN_FINISH, edge: "", cnc: false, category: "sim" },
  { id: "sim-oak-cladding-rift", name: "Revestiment de roure de fil", thicknesses: [10], hasGrain: true, finish: { kind: "wood", species: "oak", gen: { base: "#b48e62", dark: "#8c6a44", lines: 60, wobble: 0.025, bands: 30, contrast: 0.4, figure: 0, pores: 2400, grain: 10, tileMm: 1200, seed: 131 } }, edge: "", cnc: false, category: "sim" },
]
/**
 * Roure massís de debò (per decisió de l'usuari, 2026-10-21: els llistons «al 4 cantos que si no es veu malament o
 * crear una fusta massissa?»): no es canteja i al 3D el cantell és la mateixa fusta. El fan servir els mobles de la
 * galeria Llistons. Afegit a la v52.
 */
const OAK_PHOTO: MaterialPref["finish"] = { kind: "image", src: "textures/oak_veneer_01/diff.jpg", normalMap: "textures/oak_veneer_01/nor.jpg", roughMap: "textures/oak_veneer_01/rough.jpg", tileMm: 600, seamless: true, grain: "y", color: "#a17e57" }
export const SOLID_WOOD_MATERIALS: MaterialPref[] = [
  { id: "oak-solid", name: "Roure massís", thicknesses: [16, 19, 30, 40], hasGrain: true, finish: OAK_PHOTO, edge: "", solid: true },
]
/** v17: les pantalles de lli feien massa llum (surtien blanques del tot al render del vespre). */
export const LAMPSHADE_GLOW = 2.2

/** Alumini dels marcs de vitrina Häfele (plata anoditzat, el de les referències .902 / .922). Afegit a la v36. */
export const FRAME_MATERIALS: MaterialPref[] = [
  { id: "sim-frame-silver", name: "Alumini anoditzat plata", thicknesses: [10], hasGrain: false, finish: { kind: "metal", color: "#c9ccd0" }, edge: "", cnc: false, category: "sim" },
]

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
 * El cos dels electrodomèstics al 3D (v47; `applianceBodyMaterial`): el vidre negre dels forns, els microones i les
 * plaques. L'inox i el blanc ja hi eren (v3). Lacat negre brillant i no vidre: el vidre de l'app és translúcid.
 */
export const APPLIANCE_MATERIALS: MaterialPref[] = [sim("sim-appliance-black", "Electrodomèstic negre", { kind: "lacquer", color: "#0f1012", roughness: 0.12 })]

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
  ...FRAME_MATERIALS,
  ...APPLIANCE_MATERIALS,
  ...GLOSS_MATERIALS,
  ...RIFT_MATERIALS,
  ...CORIAN_MATERIALS,
  ...CORIAN_CATALOG,
  ...CLADDING_MATERIALS,
  ...SOLID_WOOD_MATERIALS,
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
    grooveClearance: DEFAULT_GROOVE_CLEARANCE,
    innerClearance: DEFAULT_INNER_CLEARANCE,
  },
  label: { w: 99, h: 68 },
  display: { unit: "mm" },
  defaults: { material: "Melamina blanca", thickness: 19, backMaterial: "DM (fons)", backThickness: 10 },
  machines: [],
  machiningRules: defaultMachineRules(),
  assistant: { model: DEFAULT_ASSISTANT_MODEL },
}
