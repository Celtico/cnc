import { THUMB_VERSION } from "../../components/viewer/thumbVersion"
import { cameraSignature, resolveTemplateRef, thumbIsStale, type AmbientTemplate, type MaterialPref } from "../../core/model"
import { db, type AmbientRow } from "../../db/db"
import { enqueueThumb } from "../projects/projectThumbs"
import { materialsPrint, templatePrint, readThumb, writeThumb } from "../projects/thumbStore"

/**
 * Miniatures 3D dels ambients (Historial, Projectes i Catàleg), fetes fora de pantalla com les dels mobles:
 * terra, parets (sense les de davant, com la casa de nines) i els mobles i objectes de debò, vist de dalt i
 * de davant. El dibuix (three.js) és a `ambientRender.ts`, que es carrega en fer-ne la primera. Les dels ambients
 * de l'usuari es desen (`AmbientRow.thumb`); les del catàleg, a la Cache Storage (`thumbStore`).
 */
const renderer = () => import("./ambientRender")

const cameraOf = (r: AmbientRow): unknown => (r.data && typeof r.data === "object" ? (r.data as { camera?: unknown }).camera : undefined)

export function needsAmbientThumb(r: AmbientRow): boolean {
  return thumbIsStale(r, r.updatedAt, THUMB_VERSION, cameraOf(r))
}

/** Miniatura d'un ambient de l'usuari (es desa a la fila; es refà si l'ambient ha canviat). */
export function requestAmbientThumb(r: AmbientRow, materials: MaterialPref[]): () => void {
  if (!needsAmbientThumb(r)) return () => {}
  return enqueueThumb(`a:${r.id}`, async () => {
    const fresh = await db.ambients.get(r.id)
    if (!fresh || !needsAmbientThumb(fresh)) return
    const pose = cameraOf(fresh)
    const url = await (await renderer()).renderUserAmbient(fresh, materials)
    // Sense tocar `updatedAt`.
    if (url) await db.ambients.update(r.id, { thumb: url, thumbAt: fresh.updatedAt, thumbV: THUMB_VERSION, thumbCam: cameraSignature(pose) })
  })
}

const catalogThumbs = new Map<string, string>()
/** Empremta d'una escena del catàleg: l'escena, les plantilles que hi surten i els materials. */
const sceneSigs = new WeakMap<AmbientTemplate, string>()
function catalogSig(t: AmbientTemplate, materials: readonly MaterialPref[]): string {
  let s = sceneSigs.get(t)
  if (!s) {
    const refs = [...new Set(t.items.map((i) => i.ref))].map((ref) => {
      const tpl = resolveTemplateRef(ref)
      return tpl ? [ref, tpl.kind, tpl.make()] : [ref]
    })
    s = templatePrint([t, refs])
    sceneSigs.set(t, s)
  }
  return `${THUMB_VERSION}-${s}-${materialsPrint(materials)}`
}
export function catalogThumb(t: AmbientTemplate, materials: readonly MaterialPref[]): string | undefined {
  return catalogThumbs.get(`${t.id}|${catalogSig(t, materials)}`)
}

/**
 * Miniatura d'una escena del catàleg, amb els mobles i objectes de les seves plantilles (en memòria i desada entre
 * sessions, `thumbStore`). La mateixa escena pot sortir a dues seccions: totes les targetes reben la imatge.
 */
const catalogListeners = new Map<string, Set<(url: string) => void>>()
export function requestCatalogThumb(t: AmbientTemplate, materials: MaterialPref[], onDone: (url: string) => void): () => void {
  const sig = catalogSig(t, materials)
  const mem = `${t.id}|${sig}`
  const hit = catalogThumbs.get(mem)
  if (hit) {
    onDone(hit)
    return () => {}
  }
  const listeners = catalogListeners.get(mem) ?? new Set<(url: string) => void>()
  catalogListeners.set(mem, listeners)
  listeners.add(onDone)
  const finish = (url: string) => {
    catalogThumbs.set(mem, url)
    for (const f of catalogListeners.get(mem) ?? []) f(url)
    catalogListeners.delete(mem)
  }
  let release: (() => void) | undefined
  let cancelled = false
  void readThumb("escena", t.id, sig).then((saved) => {
    if (cancelled) return
    if (saved) return finish(saved)
    release = queueCatalog(t, materials, sig, mem, finish)
  })
  return () => {
    cancelled = true
    listeners.delete(onDone)
    release?.()
  }
}

function queueCatalog(t: AmbientTemplate, materials: MaterialPref[], sig: string, mem: string, finish: (url: string) => void): () => void {
  return enqueueThumb(`c:${mem}`, async () => {
    const url = await (await renderer()).renderCatalogScene(t, materials)
    if (url) {
      finish(url)
      void writeThumb("escena", t.id, sig, url)
    } else catalogListeners.delete(mem)
  })
}
