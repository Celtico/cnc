import { ambientFileName, ambientToJson, buildAmbientFile, missingAmbientMaterials, missingAmbientReferences, parseAmbientData, type AmbientFile } from "../../core/file/ambientFile"
import { missingMaterialsWarning, uniqueName, type MobleFile } from "../../core/file/mobleFile"
import { linkedProjectIds, parseAmbient, remapMobleItems, type Settings } from "../../core/model"
import { createAmbient, db, keepProject } from "../../db/db"
import { readRenderPrefs, writeRenderPrefs } from "../../components/viewer/render/renderPrefs"
import { addMissingReferences, createProjectFromMoble, projectToMoble, restoreUserModels, shareOrDownload, UNREADABLE_COMPOSITION } from "./mobleIo"

/** Clau de la configuració del Render d'un ambient (la mateixa que `AmbientEditor`, `saveKey`). */
const renderKey = (ambientId: number) => `ambient:${ambientId}`

interface AmbientToFile {
  file: AmbientFile
  /** Avisos per al diàleg: elements que no van al fitxer (moble esborrat o il·legible). */
  notes: string[]
  /** Algun moble de l'ambient té foto (per a l'interruptor «Incloure les fotos dels mobles»). */
  hasPhotos: boolean
  /** Els mobles que hi van (per treure'ls d'esborrany en desar-lo). */
  projectIds: number[]
}

/**
 * Construeix el `.ambient` d'un ambient desat: l'ambient, la configuració del Render i un `.moble` de cada moble i objecte
 * enllaçat (`projectToMoble`, amb la foto si es demana). Un moble esborrat o amb la composició il·legible no hi va (els
 * seus elements tampoc) i es diu a `notes`.
 */
export async function ambientToFile(ambientId: number, settings: Settings, includePhotos: boolean): Promise<AmbientToFile> {
  const row = await db.ambients.get(ambientId)
  if (!row) throw new Error("Aquest ambient ja no existeix.")
  const ambient = parseAmbient(row.data)
  const furniture = new Map<number, MobleFile>()
  let missing = 0
  const unreadable: string[] = []
  let hasPhotos = false
  for (const id of linkedProjectIds(ambient)) {
    const p = await db.projects.get(id)
    if (!p) {
      missing++
      continue
    }
    if (p.photo) hasPhotos = true
    try {
      furniture.set(id, await projectToMoble(p, settings, includePhotos))
    } catch (e) {
      if (e instanceof Error && e.message === UNREADABLE_COMPOSITION) unreadable.push(p.name)
      else throw e
    }
  }
  const { file } = buildAmbientFile({ name: row.name, ambient, furniture, render: (readRenderPrefs(renderKey(ambientId)) as Record<string, unknown> | null) ?? undefined })
  const notes: string[] = []
  if (missing) notes.push(missing === 1 ? "Un moble de l'ambient ja no existeix: no va al fitxer." : `${missing} mobles de l'ambient ja no existeixen: no van al fitxer.`)
  if (unreadable.length) notes.push(`No es pot llegir la composició de ${unreadable.map((n) => `«${n}»`).join(", ")}: no va al fitxer.`)
  return { file, notes, hasPhotos, projectIds: [...furniture.keys()] }
}

export function ambientBlob(file: AmbientFile): Blob {
  return new Blob([ambientToJson(file)], { type: "application/json" })
}

export async function saveAmbientAsFile(ambientId: number, settings: Settings, includePhotos: boolean): Promise<{ filename: string; bytes: number; how: "shared" | "downloaded" }> {
  const { file, projectIds } = await ambientToFile(ambientId, settings, includePhotos)
  const blob = ambientBlob(file)
  const filename = ambientFileName(file.ambient.name)
  const how = await shareOrDownload(blob, filename)
  // Com el `.moble`: el que s'ha desat com a fitxer ja no és un esborrany.
  for (const id of projectIds) await keepProject(id)
  return { filename, bytes: blob.size, how }
}

type OpenAmbientResult = { ok: true; ambientId: number; name: string; warnings: string[] } | { ok: false; error: string }

/**
 * Obre un `.ambient` (ja llegit): **sempre** crea un ambient nou i còpies noves dels seus mobles i objectes (ids nous,
 * enllaçats a l'ambient nou, no esborranys), tot al grup amb el nom de l'ambient (com «Duplicar (per a un client)»: no
 * es barreja amb el d'altres clients ni en canvia cap que ja tinguis). Els models 3D es tornen a crear amb el mateix id,
 * les referències que falten s'afegeixen i s'avisa dels materials que no tens, com el `.moble`. La configuració del
 * Render va a l'ambient nou.
 */
export async function openAmbientData(raw: unknown, settings: Settings, saveSettings: (s: Settings) => Promise<void>): Promise<OpenAmbientResult> {
  const res = parseAmbientData(raw)
  if (!res.ok) return res
  const { file } = res
  const warnings = [...res.warnings]
  const badModels = await restoreUserModels(file.models ?? [])
  if (badModels) warnings.push(badModels)

  const name = uniqueName(file.ambient.name.trim() || "Ambient", (await db.ambients.toArray()).map((a) => a.name))
  const folder = name
  const names = (await db.projects.toArray()).map((p) => p.name)
  const map = new Map<number, number>()
  for (const f of file.furniture) {
    const created = await createProjectFromMoble(f.moble, names, folder)
    names.push(created.name)
    map.set(f.key, created.projectId)
    warnings.push(...created.warnings)
  }
  const ambientId = await createAmbient(name, remapMobleItems(file.ambient.data, map))
  await db.ambients.update(ambientId, { folder })
  if (file.render) writeRenderPrefs(renderKey(ambientId), file.render)

  const refs = await addMissingReferences(missingAmbientReferences(file, settings.references), settings, saveSettings)
  if (refs) warnings.push(refs)
  const noMaterials = missingMaterialsWarning(missingAmbientMaterials(file, settings.materials))
  if (noMaterials) warnings.push(noMaterials)
  return { ok: true, ambientId, name, warnings }
}
