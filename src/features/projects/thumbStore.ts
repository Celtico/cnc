/**
 * Miniatures de plantilles (catàleg de mobles, objectes, escenes del catàleg d'ambients) desades entre sessions a
 * la Cache Storage del navegador: no són dades de l'usuari (no van a la base de dades ni a la còpia), però fer-les
 * de nou a cada obertura costa. La clau porta la versió de la miniatura i una empremta de tot el que la pinta
 * (la plantilla i els materials de Preferències): si res canvia, es refà; la vella s'esborra en desar la nova.
 * Sense Cache Storage (context no segur), no es desa res i tot funciona igual (en memòria).
 */

const CACHE = "mobles-thumbs-v1"

/** FNV-1a de 32 bits en hexadecimal: prou per distingir versions d'una mateixa plantilla. */
export function fingerprint(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

/**
 * Empremta d'una plantilla: les plantilles fan ids nous cada cop (`newId`, amb l'hora), així que abans es numeren
 * en ordre (també on s'hi fa referència); si no, cada sessió tindria una empremta diferent i no es trobaria mai.
 */
export function templatePrint(value: unknown): string {
  const ids = new Map<string, string>()
  const collect = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(collect)
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (k === "id" && typeof x === "string" && !ids.has(x)) ids.set(x, `#${ids.size}`)
        collect(x)
      }
  }
  collect(value)
  return fingerprint(JSON.stringify(value, (_k, v: unknown) => (typeof v === "string" ? (ids.get(v) ?? v) : v)))
}

/** L'empremta dels materials, una vegada per llista (la llista canvia d'objecte quan es toca Preferències). */
const materialPrints = new WeakMap<object, string>()
export function materialsPrint(materials: readonly object[]): string {
  let p = materialPrints.get(materials)
  if (!p) {
    p = fingerprint(JSON.stringify(materials))
    materialPrints.set(materials, p)
  }
  return p
}

const prefixOf = (kind: string, id: string) => `/__thumbs__/${kind}/${encodeURIComponent(id)}/`
const urlOf = (kind: string, id: string, sig: string) => `${location.origin}${prefixOf(kind, id)}${sig}`

const open = async (): Promise<Cache | null> => {
  try {
    return typeof caches === "undefined" ? null : await caches.open(CACHE)
  } catch {
    return null
  }
}

/** La miniatura desada (una data URL) o `undefined`. */
export async function readThumb(kind: string, id: string, sig: string): Promise<string | undefined> {
  const c = await open()
  if (!c) return undefined
  try {
    const r = await c.match(urlOf(kind, id, sig))
    return r ? await r.text() : undefined
  } catch {
    return undefined
  }
}

/** Desa la miniatura i esborra les velles de la mateixa plantilla (una altra versió o altres materials). */
export async function writeThumb(kind: string, id: string, sig: string, dataUrl: string): Promise<void> {
  const c = await open()
  if (!c) return
  try {
    const url = urlOf(kind, id, sig)
    await c.put(url, new Response(dataUrl, { headers: { "content-type": "text/plain" } }))
    const prefix = location.origin + prefixOf(kind, id)
    for (const req of await c.keys()) if (req.url.startsWith(prefix) && req.url !== url) await c.delete(req)
  } catch {
    /* sense espai o sense permís: es queda en memòria */
  }
}
