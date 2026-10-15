import { parsePolyHavenInfo, POLYHAVEN_API, type PolyHavenInfo, type RemoteFile } from "../../core/assets"

/**
 * API de Poly Haven (CORS obert): `/files/<id>`, `/info/<id>` i els fitxers de `dl.polyhaven.org`. No passen pel service
 * worker (no es precachegen ni es guarden): sense connexió fallen amb `OfflineError` i qui crida ho explica.
 */

export class OfflineError extends Error {
  constructor() {
    super("Sense connexió a internet.")
    this.name = "OfflineError"
  }
}

export const isOffline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false

async function get(url: string, timeoutMs: number): Promise<Response> {
  if (isOffline()) throw new OfflineError()
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" })
    if (!r.ok) throw new Error(`Poly Haven ha respost ${r.status}.`)
    return r
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Poly Haven")) throw e
    // Un `TypeError` de `fetch` és xarxa (sense connexió, DNS, CORS…).
    if (isOffline() || e instanceof TypeError) throw new OfflineError()
    throw new Error("Poly Haven no respon (temps esgotat).")
  } finally {
    clearTimeout(t)
  }
}

/** `/files/<id>` tal com ve (`planPolyHavenDownload` el valida). */
export async function fetchPolyHavenFiles(id: string): Promise<unknown> {
  return (await get(`${POLYHAVEN_API}/files/${encodeURIComponent(id)}`, 15000)).json()
}

/** `/info/<id>` (nom, tipus, mides); `null` si no es pot llegir (sense connexió, no existeix…): mai llança. */
export async function fetchPolyHavenInfo(id: string): Promise<PolyHavenInfo | null> {
  try {
    return parsePolyHavenInfo(await (await get(`${POLYHAVEN_API}/info/${encodeURIComponent(id)}`, 8000)).json())
  } catch {
    return null
  }
}

/**
 * Baixa els fitxers (un rere l'altre) i diu el progrés en bytes (`total` = el que diu l'API). Torna camí → fitxer.
 */
export async function downloadPolyHaven(files: RemoteFile[], onProgress: (done: number, total: number) => void): Promise<Map<string, Blob>> {
  const total = files.reduce((a, f) => a + f.size, 0)
  let done = 0
  const out = new Map<string, Blob>()
  for (const f of files) {
    const r = await get(f.url, 120000)
    const reader = r.body?.getReader()
    if (!reader) {
      const b = await r.blob()
      done += b.size
      onProgress(done, total)
      out.set(f.path, b)
      continue
    }
    const chunks: Uint8Array<ArrayBuffer>[] = []
    for (;;) {
      const { done: end, value } = await reader.read()
      if (end) break
      chunks.push(value as Uint8Array<ArrayBuffer>)
      done += value.byteLength
      onProgress(done, Math.max(total, done))
    }
    out.set(f.path, new Blob(chunks))
  }
  return out
}
