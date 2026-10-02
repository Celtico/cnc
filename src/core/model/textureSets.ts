import type { MaterialPref } from "./settings"

/**
 * Jocs de textures PBR de l'app (fotos de Poly Haven, CC0, 1K) a `public/textures/<id>/`:
 *
 * - `diff.jpg`: color (sRGB), feta per repetir (seamless).
 * - `nor.jpg`: normals en espai tangent, **convenció OpenGL** (verd = +v, amunt de la imatge).
 * - `rough.jpg`: rugositat en grisos (0 mirall, 1 mat; es multiplica per la del material).
 *
 * Dades pures (sense three): les fan servir les preferències (`PHOTO_MATERIALS`, migració v6) i el
 * visor (`components/viewer/textureSets.ts`). Per afegir-ne un: copia els fitxers i posa'n una
 * entrada aquí; la migració l'afegeix als materials de l'usuari si no hi és.
 */
export interface TextureSet {
  /** Carpeta a `public/textures/`. */
  id: string
  /** Nom del material (únic). */
  label: string
  /** Mida real d'una repetició (mm, d'esquerra a dreta de la foto). */
  tileMm: number
  /** Alçada ÷ amplada de la foto (sense, quadrada). */
  aspect?: number
  /** Direcció de la veta a la foto (`x` horitzontal, `y` vertical) o cap. */
  grain: "x" | "y" | "none"
  /** Ús: tauler de CNC (xapa), pedra (no CNC) o simulació (terres, parets, teixits). */
  use: "board" | "hard" | "sim"
  /** Color mitjà (STEP, mostres). */
  color: string
  /** Cantell per defecte (taulers). */
  edge?: string
  /** Multiplicador de la rugositat del mapa. */
  roughness?: number
  /** Translucidesa al render (teixits fins). */
  translucent?: number
  credit: string
}

const PH = "Poly Haven (CC0)"

export const TEXTURE_SETS: TextureSet[] = [
  // Xapes (taulers de la CNC): la veta ~1,1 m per repetició.
  { id: "oak_veneer_01", label: "Roure (foto)", tileMm: 1100, grain: "y", use: "board", color: "#a17e57", edge: "Xapa de roure", credit: PH },
  { id: "walnut_veneer_02", label: "Noguera (foto)", tileMm: 1200, grain: "x", use: "board", color: "#a98971", edge: "Xapa de noguera", credit: PH },
  { id: "smoked_walnut_veneer", label: "Noguera fumada (foto)", tileMm: 1200, grain: "x", use: "board", color: "#ba997d", edge: "Xapa de noguera", credit: PH },
  { id: "dark_wood", label: "Fusta fosca (foto)", tileMm: 1000, grain: "x", use: "board", color: "#5c2a17", edge: "Xapa de fusta fosca", credit: PH },
  // Terres de fusta (lames de ~190 mm).
  { id: "wood_floor", label: "Parquet de roure (foto)", tileMm: 1600, grain: "y", use: "sim", color: "#7f5f42", credit: PH },
  { id: "laminate_floor_02", label: "Parquet clar (foto)", tileMm: 1600, grain: "x", use: "sim", color: "#9b8063", credit: PH },
  { id: "wooden_floor_02", label: "Parquet rústic (foto)", tileMm: 1500, grain: "x", use: "sim", color: "#b78861", credit: PH },
  // Parets i terres continus.
  { id: "plastered_wall_05", label: "Estuc antracita (foto)", tileMm: 2000, grain: "none", use: "sim", color: "#45484c", credit: PH },
  { id: "gravel_concrete_03", label: "Microciment (foto)", tileMm: 2000, grain: "none", use: "sim", color: "#595952", credit: PH },
  { id: "concrete", label: "Formigó encofrat (foto)", tileMm: 2000, grain: "none", use: "sim", color: "#716959", credit: PH },
  { id: "concrete_layers_02", label: "Formigó de taulons (foto)", tileMm: 2000, grain: "none", use: "sim", color: "#7d7a74", credit: PH },
  { id: "concrete_floor_01", label: "Terratzo (foto)", tileMm: 1000, grain: "none", use: "sim", color: "#766b58", credit: PH },
  { id: "rubber_tiles", label: "Rajola de goma negra (foto)", tileMm: 2000, grain: "none", use: "sim", color: "#1f2024", credit: PH },
  // Pedra.
  { id: "marble_01", label: "Pedra calcària (foto)", tileMm: 2000, grain: "none", use: "hard", color: "#b19c79", credit: PH },
  { id: "grey_cartago_03", label: "Pedra Cartago (foto)", tileMm: 1500, grain: "none", use: "hard", color: "#5e5a53", credit: PH },
  { id: "granite_tile_04", label: "Rajola de pedra (foto)", tileMm: 1600, grain: "none", use: "sim", color: "#706455", credit: PH },
  { id: "medieval_blocks_03", label: "Carreus de pedra (foto)", tileMm: 2000, grain: "none", use: "sim", color: "#766957", credit: PH },
  { id: "stone_wall_05", label: "Mur de pedra (foto)", tileMm: 1800, grain: "none", use: "sim", color: "#4e463a", credit: PH },
  { id: "volcanic_herringbone_01", label: "Pedra volcànica en espiga (foto)", tileMm: 1500, grain: "none", use: "sim", color: "#4b4641", credit: PH },
  // Teixits.
  { id: "hessian_230", label: "Jute (foto)", tileMm: 400, aspect: 1018 / 1024, grain: "none", use: "sim", color: "#8c7859", translucent: 0.35, credit: PH },
  { id: "poly_wool_herringbone", label: "Llana espiga (foto)", tileMm: 450, aspect: 1046 / 1024, grain: "none", use: "sim", color: "#787570", credit: PH },
  { id: "denim_fabric_05", label: "Teixit vaquer (foto)", tileMm: 400, aspect: 1030 / 1024, grain: "none", use: "sim", color: "#666464", credit: PH },
]

/** Fitxer d'un mapa d'un joc (camí relatiu a l'arrel de l'app). */
export const textureSetFile = (id: string, map: "diff" | "nor" | "rough") => `textures/${id}/${map}.jpg`

/** El joc com a material de les preferències (acabat «image» amb els mapes PBR). */
export function textureSetMaterial(t: TextureSet): MaterialPref {
  const finish: MaterialPref["finish"] = {
    kind: "image",
    src: textureSetFile(t.id, "diff"),
    normalMap: textureSetFile(t.id, "nor"),
    roughMap: textureSetFile(t.id, "rough"),
    tileMm: t.tileMm,
    ...(t.aspect ? { aspect: t.aspect } : {}),
    seamless: true,
    ...(t.grain === "y" ? { grain: "y" as const } : {}),
    ...(t.roughness ? { roughness: t.roughness } : {}),
    color: t.color,
  }
  const base = { id: `photo-${t.id}`, name: t.label, finish, ...(t.translucent ? { translucent: t.translucent } : {}) }
  if (t.use === "board") return { ...base, thicknesses: [16, 19, 30], hasGrain: true, edge: t.edge ?? "", category: "board" }
  if (t.use === "hard") return { ...base, thicknesses: [10, 20, 30], hasGrain: false, edge: "", cnc: false, category: "hard" }
  return { ...base, thicknesses: [10], hasGrain: t.grain !== "none", edge: "", cnc: false, category: "sim" }
}

/** Materials de foto (valors inicials, v6). */
export const PHOTO_MATERIALS: MaterialPref[] = TEXTURE_SETS.map(textureSetMaterial)
