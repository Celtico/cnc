/**
 * Models 3D de l'usuari (Objectes › Models 3D): quin fitxer és el model d'un conjunt (un `.zip`, una carpeta o diversos
 * fitxers) i com es troben els fitxers que referencia (el `.bin` i les textures d'un `.gltf`). Pur: sense DOM ni three.
 * La càrrega (GLTFLoader, FBXLoader) és a `features/composition/modelImport.ts`.
 */

/**
 * Format del model pel nom: `glb`/`gltf`/`fbx` es poden llegir al navegador; `blend` i `usd` no (Blender i USD no tenen
 * lector aquí: un de Poly Haven es baixa en glTF); `other` són formats 3D coneguts que no es llegeixen.
 */
export type ModelFormat = "glb" | "gltf" | "fbx" | "blend" | "usd" | "other"

const FORMATS: [RegExp, ModelFormat][] = [
  [/\.glb$/i, "glb"],
  [/\.gltf$/i, "gltf"],
  [/\.fbx$/i, "fbx"],
  [/\.blend$/i, "blend"],
  [/\.usd[acz]?$/i, "usd"],
  [/\.(obj|stl|dae|3ds|skp|max|c4d|ma|mb|ply|3dm)$/i, "other"],
]

/** Format d'un fitxer de model (o `null` si no és un model: textures, `.bin`, llicències…). */
export function modelFormatOf(path: string): ModelFormat | null {
  for (const [re, f] of FORMATS) if (re.test(path)) return f
  return null
}

/** Ordre de preferència quan n'hi ha més d'un (un zip de Poly Haven en porta un sol, però una carpeta pot portar-ne més). */
const RANK: Record<ModelFormat, number> = { glb: 0, gltf: 1, fbx: 2, blend: 3, usd: 4, other: 5 }

/** Fitxers que no compten (metadades del Finder, ocults). */
export const isJunkPath = (path: string): boolean => /(^|\/)(__MACOSX\/|\.)/.test(path)

interface MainModel {
  path: string
  format: ModelFormat
}

/**
 * El model d'un conjunt de fitxers: el del format més fàcil de llegir (glb › gltf › fbx › blend › usd › altres) i, entre
 * els del mateix format, el menys enfonsat a les carpetes. `null` si no n'hi ha cap.
 */
export function pickMainModel(paths: string[]): MainModel | null {
  let best: MainModel | null = null
  const depth = (p: string) => p.split("/").length
  for (const path of paths) {
    if (isJunkPath(path)) continue
    const format = modelFormatOf(path)
    if (!format) continue
    if (!best || RANK[format] < RANK[best.format] || (RANK[format] === RANK[best.format] && depth(path) < depth(best.path))) best = { path, format }
  }
  return best
}

/** Carpeta d'un camí (`a/b/c.gltf` → `a/b/`; sense carpeta, buit). */
export const dirOf = (path: string): string => {
  const i = path.lastIndexOf("/")
  return i < 0 ? "" : path.slice(0, i + 1)
}

/** Nom sense carpetes. */
export const baseNameOf = (path: string): string => path.split(/[\\/]/).pop() ?? path

/**
 * Camí d'una URI relativa d'un glTF/FBX respecte de la carpeta del model: barres de Windows, `%20`, `./` i `../`.
 * `null` si és una URL absoluta o de dades (no és un fitxer del conjunt).
 */
export function resolveUri(baseDir: string, uri: string): string | null {
  if (/^(data:|blob:|[a-z][a-z0-9+.-]*:\/\/)/i.test(uri)) return null
  let u = uri.replace(/\\/g, "/")
  try {
    u = decodeURIComponent(u)
  } catch {
    // Una URI amb un % solt es fa servir tal com és.
  }
  // Un camí absolut (`C:/…` o `/…`) d'un exportador: només en val el nom.
  if (/^([a-z]:)?\//i.test(u)) u = baseNameOf(u)
  const parts = (baseDir + u).split("/")
  const out: string[] = []
  for (const p of parts) {
    if (p === "" || p === ".") continue
    if (p === "..") out.pop()
    else out.push(p)
  }
  return out.join("/")
}

/**
 * Busca un fitxer del conjunt: el camí exacte, després sense majúscules i, si no, pel nom (si només n'hi ha un amb
 * aquell nom: Blender i els FBX sovint porten la carpeta de qui els va fer).
 */
export function findFile(paths: readonly string[], wanted: string): string | null {
  if (paths.includes(wanted)) return wanted
  const low = wanted.toLowerCase()
  const ci = paths.find((p) => p.toLowerCase() === low)
  if (ci) return ci
  const name = baseNameOf(low)
  const byName = paths.filter((p) => baseNameOf(p).toLowerCase() === name)
  return byName.length === 1 ? byName[0]! : null
}

/** Nom del model per a la llista: el del fitxer sense extensió ni la resolució de Poly Haven (`_1k`). */
export function modelDisplayName(path: string): string {
  const stem = baseNameOf(path).replace(/\.[^.]+$/, "")
  return stem.replace(/_\d+k$/i, "").trim() || "Model"
}
