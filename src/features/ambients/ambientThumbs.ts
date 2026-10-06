import { THUMB_VERSION } from "../../components/viewer/thumbVersion"
import { cameraSignature, resolveTemplateRef, thumbIsStale, type AmbientTemplate, type MaterialPref } from "../../core/model"
import { db, type AmbientRow } from "../../db/db"
import { enqueueThumb, requestStoredThumb, storedThumb } from "../projects/projectThumbs"
import { materialsPrint, templatePrint } from "../projects/thumbStore"

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
  return storedThumb("escena", t.id, catalogSig(t, materials))
}

/**
 * Miniatura d'una escena del catàleg, amb els mobles i objectes de les seves plantilles (en memòria i desada entre
 * sessions, `requestStoredThumb`). La mateixa escena pot sortir a dues seccions: totes les targetes reben la imatge.
 */
export function requestCatalogThumb(t: AmbientTemplate, materials: MaterialPref[], onDone: (url: string) => void): () => void {
  return requestStoredThumb("escena", t.id, catalogSig(t, materials), async () => (await renderer()).renderCatalogScene(t, materials), onDone)
}
