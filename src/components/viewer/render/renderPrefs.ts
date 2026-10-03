/**
 * Configuració del Render desada per document (per decisió de l'usuari: «cada cop que entro l'he de tornar a posar»):
 * `localStorage` `mobles:render:<clau>` (p. ex. `ambient:12`, `moble:7`). Només es fa servir el que té el mateix tipus que
 * el valor per defecte (una clau vella o dolenta no trenca res).
 */
export interface SavedRender {
  opts?: Record<string, unknown>
  look?: Record<string, unknown>
  mood?: string
  res?: string
  limit?: number
  room?: string
  format?: string
  sky?: string
}

const storageKey = (k: string) => `mobles:render:${k}`

export function readRenderPrefs(key: string | undefined): SavedRender | null {
  if (!key) return null
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(key)) ?? "null") as unknown
    return v && typeof v === "object" && !Array.isArray(v) ? (v as SavedRender) : null
  } catch {
    return null
  }
}

export function writeRenderPrefs(key: string | undefined, prefs: SavedRender): void {
  if (!key) return
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(prefs))
  } catch {
    // Sense emmagatzematge: res.
  }
}

/** `base` amb els valors desats que tenen el mateix tipus (els altres es queden com a `base`). */
export function mergeSaved<T extends object>(base: T, saved: Record<string, unknown> | undefined): T {
  if (!saved) return base
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(saved)) {
    const b = (base as Record<string, unknown>)[k]
    if (b === undefined ? typeof v === "number" || typeof v === "string" || typeof v === "boolean" : typeof v === typeof b && (typeof v !== "number" || Number.isFinite(v))) out[k] = v
  }
  return out as T
}
