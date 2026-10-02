/**
 * Jocs de textures PBR de l'usuari (com els de Poly Haven o ambientCG): quin mapa és cada fitxer pel nom i les
 * operacions de píxels que cal fer en carregar-los (invertir el verd d'un normal DirectX, rugositat en grisos).
 * Pur: sense DOM ni three. La lectura i la reducció de les imatges són a `features/settings/textureImport.ts`.
 */

/** Mapa d'un joc: color (difús/albedo), relleu (normal) o brillantor (rugositat). */
export type PbrSlot = "color" | "normal" | "rough"

export interface PbrFileClass {
  slot: PbrSlot
  /** Normal en convenció DirectX (`_dx`): cal invertir el verd. `undefined` = el nom no ho diu. */
  directX?: boolean
  /** Canal d'on surt la rugositat: `g` als empaquetats ARM/ORM (oclusió · rugositat · metall). */
  channel?: "g"
}

/** Extensions que el navegador sap llegir com a imatge (EXR, TIFF i PSD no). */
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif|bmp)$/i

/** Paraules del nom → mapa. `null` = mapa conegut que no es fa servir (relleu de desplaçament, oclusió, metall…). */
const KEYWORDS: Record<string, PbrFileClass | null> = {
  diff: { slot: "color" },
  diffuse: { slot: "color" },
  albedo: { slot: "color" },
  alb: { slot: "color" },
  basecolor: { slot: "color" },
  color: { slot: "color" },
  colour: { slot: "color" },
  col: { slot: "color" },
  nor: { slot: "normal" },
  norm: { slot: "normal" },
  normal: { slot: "normal" },
  nrm: { slot: "normal" },
  normalgl: { slot: "normal", directX: false },
  norgl: { slot: "normal", directX: false },
  normaldx: { slot: "normal", directX: true },
  nordx: { slot: "normal", directX: true },
  rough: { slot: "rough" },
  roughness: { slot: "rough" },
  rgh: { slot: "rough" },
  arm: { slot: "rough", channel: "g" },
  orm: { slot: "rough", channel: "g" },
  disp: null,
  displacement: null,
  height: null,
  bump: null,
  ao: null,
  ambientocclusion: null,
  occlusion: null,
  metal: null,
  metallic: null,
  metalness: null,
  spec: null,
  specular: null,
  gloss: null,
  glossiness: null,
  opacity: null,
  alpha: null,
  mask: null,
  emission: null,
  emissive: null,
  preview: null,
  thumb: null,
  thumbnail: null,
}

/** Nom del fitxer sense carpetes ni extensió, partit en paraules (també a les majúscules: `NormalGL` → normal, gl). */
export function fileTokens(path: string): string[] {
  const base = path.split(/[\\/]/).pop() ?? path
  const stem = base.replace(/\.[^.]+$/, "")
  return stem
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** El navegador el pot llegir com a imatge. */
export const isImageFile = (path: string): boolean => IMAGE_EXT.test(path)
export const isZipFile = (path: string): boolean => /\.zip$/i.test(path)

/**
 * Quin mapa és un fitxer pel nom. Mana l'**última** paraula que és un mapa (el nom del material va al davant:
 * `rough_plaster_diff_1k` és el color, `metal_plate_rough` la rugositat). També dues paraules juntes (`base color`,
 * `ambient occlusion`). `_gl` / `_dx` diuen la convenció del normal. `null`: no és una imatge o no és cap mapa que es
 * faci servir.
 */
export function classifyTextureFile(path: string): PbrFileClass | null {
  if (!isImageFile(path)) return null
  const tokens = fileTokens(path)
  let found: PbrFileClass | null | undefined
  for (let i = 0; i < tokens.length; i++) {
    const pair = i > 0 ? tokens[i - 1]! + tokens[i]! : ""
    if (pair && pair in KEYWORDS) found = KEYWORDS[pair]
    else if (tokens[i]! in KEYWORDS) found = KEYWORDS[tokens[i]!]
  }
  if (!found) return null
  if (found.slot === "normal" && found.directX === undefined) {
    if (tokens.includes("dx") || tokens.includes("directx")) return { ...found, directX: true }
    if (tokens.includes("gl") || tokens.includes("opengl")) return { ...found, directX: false }
  }
  return { ...found }
}

export interface PbrPlanItem extends PbrFileClass {
  path: string
}

export interface PbrPlan {
  color?: PbrPlanItem
  normal?: PbrPlanItem
  rough?: PbrPlanItem
  /** Fitxers que no es fan servir (altres mapes, repetits, no imatges). */
  ignored: string[]
}

/** Puntuació per triar entre dos fitxers del mateix mapa: normal OpenGL abans que DirectX, rugositat pròpia abans que ARM. */
function preference(c: PbrPlanItem): number {
  if (c.slot === "normal") return c.directX ? 0 : 1
  if (c.slot === "rough") return c.channel ? 0 : 1
  return 0
}

/** Reparteix els fitxers d'un joc (noms o camins) entre color, relleu i brillantor. */
export function planTextureSet(paths: string[]): PbrPlan {
  const plan: PbrPlan = { ignored: [] }
  for (const path of paths) {
    const c = classifyTextureFile(path)
    if (!c) {
      plan.ignored.push(path)
      continue
    }
    const item: PbrPlanItem = { ...c, path }
    const had = plan[c.slot]
    if (!had || preference(item) > preference(had)) {
      if (had) plan.ignored.push(had.path)
      plan[c.slot] = item
    } else plan.ignored.push(path)
  }
  return plan
}

/** Inverteix el canal verd (RGBA, al lloc): normal DirectX ↔ OpenGL. */
export function flipGreen(data: Uint8ClampedArray | Uint8Array): void {
  for (let i = 1; i < data.length; i += 4) data[i] = 255 - data[i]!
}

/**
 * Rugositat en grisos (RGBA, al lloc): `g` copia el verd (ARM/ORM); `luma` fa la mitjana de R, G i B (una imatge en
 * grisos es queda igual). L'alfa queda opac.
 */
export function toGrayscale(data: Uint8ClampedArray | Uint8Array, channel: "luma" | "g" = "luma"): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = channel === "g" ? data[i + 1]! : Math.round((data[i]! + data[i + 1]! + data[i + 2]!) / 3)
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = 255
  }
}

/** Color mitjà (RGBA) en `#rrggbb` (per al STEP i les mostres). */
export function averageColor(data: Uint8ClampedArray | Uint8Array): string {
  let r = 0
  let g = 0
  let b = 0
  const n = Math.floor(data.length / 4)
  if (!n) return "#808080"
  for (let i = 0; i < n * 4; i += 4) {
    r += data[i]!
    g += data[i + 1]!
    b += data[i + 2]!
  }
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0")
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** Mida reduïda perquè el costat llarg no passi de `max` (mai s'amplia). */
export function fitSize(w: number, h: number, max = 1024): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}
