/**
 * Poly Haven (polyhaven.com, CC0): reconèixer un fitxer baixat (`<id>_<res>.blend`, `<id>_<res>.gltf`…) i planificar què
 * cal baixar de la seva API (CORS obert) per tenir el mateix model en glTF. Pur: sense xarxa. La baixada és a
 * `features/composition/polyHavenApi.ts`.
 *
 * API: `https://api.polyhaven.com/files/<id>` → `{ <format>: { <res>: { <format>: { url, size, include: { <camí>: { url,
 * size } } } } } }`; `https://api.polyhaven.com/info/<id>` → nom, tipus (0 HDRI, 1 textura, 2 model), mides…
 */

export const POLYHAVEN_API = "https://api.polyhaven.com"

/** Resolució màxima que es baixa (les textures es redueixen a 1024 px igualment). */
const MAX_FETCH_RES = "2k"

export interface PolyHavenRef {
  id: string
  /** `1k`, `2k`, `4k`… */
  res: string
}

/**
 * Id i resolució d'un fitxer de Poly Haven pel nom: `potted_plant_04_1k.blend`, `potted_plant_04_1k.gltf`,
 * `rough_plaster_brick_04_2k.blend.zip`, `potted_plant_04_1k_gltf.zip`. `null` si el nom no ho sembla.
 */
export function parsePolyHavenName(path: string): PolyHavenRef | null {
  const base = (path.split(/[\\/]/).pop() ?? path).toLowerCase()
  const m = /^([a-z0-9]+(?:_[a-z0-9]+)*?)_(\d+k)(?:[._-](?:blend|gltf|glb|fbx|usd[acz]?|mtlx|zip))*$/.exec(base)
  if (!m) return null
  return { id: m[1]!, res: m[2]! }
}

/** Primer fitxer del conjunt amb nom de Poly Haven: el model, si no qualsevol (el `.zip` mateix va l'últim). */
export function polyHavenRefOf(paths: string[], fallbackName?: string): PolyHavenRef | null {
  const models = paths.filter((p) => /\.(blend|gltf|glb|fbx|usd[acz]?)$/i.test(p))
  for (const p of [...models, ...(fallbackName ? [fallbackName] : [])]) {
    const r = parsePolyHavenName(p)
    if (r) return r
  }
  return null
}

/** Nom per a la UI a partir de l'id (`potted_plant_04` → «Potted plant 04»); la de l'API és millor si es pot llegir. */
export function polyHavenTitle(id: string): string {
  const s = id.replace(/_/g, " ").trim()
  return s ? s[0]!.toUpperCase() + s.slice(1) : id
}

const resValue = (r: string) => {
  const m = /^(\d+)k$/i.exec(r)
  return m ? Number(m[1]) : Number.NaN
}

/**
 * Resolució a baixar: la més gran que n'hi hagi fins a la demanada i `max` (la mateixa, si hi és i no passa de `max`);
 * si no n'hi ha cap de tan petita, la més petita. `null` si no n'hi ha cap.
 */
export function pickResolution(wanted: string, available: string[], max = MAX_FETCH_RES): string | null {
  const ok = available.filter((r) => Number.isFinite(resValue(r))).sort((a, b) => resValue(a) - resValue(b))
  if (!ok.length) return null
  const w = resValue(wanted)
  const target = Math.min(resValue(max), Number.isFinite(w) ? w : Infinity)
  const under = ok.filter((r) => resValue(r) <= target)
  return under.length ? under[under.length - 1]! : ok[0]!
}

export interface RemoteFile {
  /** Camí relatiu al model (el que diu la URI del `.gltf`). */
  path: string
  url: string
  /** Bytes (si l'API ho diu). */
  size: number
}

export interface DownloadPlan {
  res: string
  /** El `.gltf`. */
  main: RemoteFile
  /** El que cal baixar (el `.bin` i les textures que no hi ha al zip). */
  fetch: RemoteFile[]
  /** Textures que ja hi són al zip de l'usuari: camí del glTF → fitxer local (pot ser un EXR: es descodifica). */
  reuse: { path: string; local: string }[]
  /** Bytes que es baixaran. */
  bytes: number
}

interface ApiFile {
  url: string
  size?: number
  include?: Record<string, ApiFile>
}

const isApiFile = (v: unknown): v is ApiFile => !!v && typeof v === "object" && typeof (v as ApiFile).url === "string"

const stemOf = (p: string) => (p.split(/[\\/]/).pop() ?? p).replace(/\.[^.]+$/, "").toLowerCase()

/**
 * Què cal baixar per tenir el model en `format` (glTF) a la resolució `res` (o la més propera, `pickResolution`).
 * Les textures que ja hi són al zip (mateix nom sense l'extensió: el `diff.jpg` o el `nor_gl.exr` d'un zip «Blend») no
 * es tornen a baixar. `files` és la resposta de `/files/<id>` tal com ve (es valida). `null` si no hi ha aquest format.
 */
export function planPolyHavenDownload(files: unknown, res: string, local: string[], format = "gltf"): DownloadPlan | null {
  if (!files || typeof files !== "object") return null
  const byRes = (files as Record<string, unknown>)[format]
  if (!byRes || typeof byRes !== "object") return null
  const chosen = pickResolution(res, Object.keys(byRes))
  if (!chosen) return null
  const entry = (byRes as Record<string, Record<string, unknown>>)[chosen]?.[format]
  if (!isApiFile(entry)) return null
  const name = entry.url.split("/").pop() ?? `model.${format}`
  const main: RemoteFile = { path: decodeURIComponent(name), url: entry.url, size: entry.size ?? 0 }
  const fetch: RemoteFile[] = []
  const reuse: { path: string; local: string }[] = []
  const usable = local.filter((p) => /\.(jpe?g|png|webp|exr)$/i.test(p))
  for (const [path, inc] of Object.entries(entry.include ?? {})) {
    if (!isApiFile(inc)) continue
    const stem = stemOf(path)
    const isImage = /\.(jpe?g|png|webp)$/i.test(path)
    // Primer el mateix fitxer; si no, el mateix nom en EXR (els zips «Blend» porten el normal i la rugositat en EXR).
    const same = isImage ? (usable.find((p) => stemOf(p) === stem && /\.(jpe?g|png|webp)$/i.test(p)) ?? usable.find((p) => stemOf(p) === stem)) : undefined
    if (same) reuse.push({ path, local: same })
    else fetch.push({ path, url: inc.url, size: inc.size ?? 0 })
  }
  return { res: chosen, main, fetch, reuse, bytes: main.size + fetch.reduce((a, f) => a + f.size, 0) }
}

export interface PolyHavenInfo {
  name: string
  /** 0 HDRI · 1 textura · 2 model. */
  type?: number
  /** Textures: mida real d'una repetició (mm, ample × alt); models: la caixa (mm). */
  dimensions?: number[]
}

/** Llegeix la resposta de `/info/<id>` (només el que es fa servir; `null` si no té nom). */
export function parsePolyHavenInfo(v: unknown): PolyHavenInfo | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  if (typeof o.name !== "string" || !o.name.trim()) return null
  const dims = Array.isArray(o.dimensions) && o.dimensions.every((d) => typeof d === "number" && Number.isFinite(d) && d > 0) ? (o.dimensions as number[]) : undefined
  return { name: o.name.trim(), ...(typeof o.type === "number" ? { type: o.type } : {}), ...(dims ? { dimensions: dims } : {}) }
}

/**
 * Mida real d'una repetició (mm) per a un material fet amb un joc de textures: la de Poly Haven (textures: `dimensions`,
 * arrodonida a 10 mm); d'un model, la caixa més gran (les textures cobreixen el model); si no, `fallback`. Entre 50 i
 * 5000 mm (els límits de l'acabat de foto).
 */
export function textureTileMm(info: PolyHavenInfo | null, fallback = 1000): number {
  const d = info?.dimensions
  if (!d?.length) return fallback
  const v = info?.type === 1 ? d[0]! : Math.max(...d)
  return Math.min(5000, Math.max(50, Math.round(v / 10) * 10))
}
