import {
  buildMobleFile,
  missingMaterials,
  missingMaterialsWarning,
  missingReferences,
  mobleFileName,
  mobleToJson,
  parseMobleData,
  uniqueName,
  usedUserModelIds,
  type FileModel,
  type FilePhoto,
  type MobleFile,
} from "../../core/file/mobleFile"
import { DEFAULT_CABINET, newId, type RefPreset, type Settings } from "../../core/model"
import { readComposition } from "../../db/compositionStore"
import { addPhoto, createProject, db, keepProject, safeNestOptions, updateProjectPhoto, type Photo, type Project } from "../../db/db"
import { ensureUserModel, getUserModel } from "../../db/userModels"
import { downloadBlob } from "../../lib/download"

/** Blob → base64 (sense prefix). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}

export function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Missatge quan la composició desada no es pot llegir (no s'exporta la caixa per defecte en lloc seu). */
export const UNREADABLE_COMPOSITION = "La composició desada d'aquest moble no es pot llegir: no es desa el fitxer (sortiria una caixa per defecte)."

/**
 * Construeix el fitxer `.moble` d'un projecte (amb la foto si es demana i n'hi ha). Llança (`UNREADABLE_COMPOSITION`) si
 * la composició desada és il·legible (`readComposition(…).unreadable`): el fitxer seria la caixa per defecte.
 */
export async function projectToMoble(project: Project, settings: Settings, includePhoto: boolean): Promise<MobleFile> {
  const read = readComposition(project)
  if (read.unreadable) throw new Error(UNREADABLE_COMPOSITION)
  const composition = read.composition
  let photo: FilePhoto | undefined
  let calibration: MobleFile["project"]["photo"]
  if (project.photo) {
    const { photoId: _id, origin, measures, floorLine, ...cal } = project.photo
    const pt = (p: readonly [number, number]): [number, number] => [p[0], p[1]]
    calibration = {
      ...cal,
      points: cal.points.map(pt),
      offset: pt(cal.offset),
      ...(origin ? { origin: pt(origin) } : {}),
      ...(measures ? { measures: measures.map((m) => ({ ...m, points: m.points.map(pt) })) } : {}),
      ...(floorLine ? { floorLine: [pt(floorLine[0]), pt(floorLine[1])] as [[number, number], [number, number]] } : {}),
    }
    if (includePhoto) {
      const p = await db.photos.get(project.photo.photoId)
      if (p) photo = { mime: p.blob.type || "image/jpeg", width: p.width, height: p.height, exifFocal35: p.exifFocal35, data: await blobToBase64(p.blob) }
    }
  }
  // Els models 3D de l'usuari van a dins (si no, en un altre aparell no es veurien).
  const models: FileModel[] = []
  for (const id of usedUserModelIds(composition)) {
    const m = await getUserModel(id)
    if (m) models.push({ id: m.id, name: m.name, size: [...m.size], mime: m.blob.type || "model/gltf-binary", data: await blobToBase64(m.blob) })
  }
  return buildMobleFile({
    name: project.name,
    models,
    composition,
    nesting: project.nesting ? safeNestOptions(project.nesting) : undefined,
    calibration,
    references: settings.references,
    photo,
  })
}

export function mobleBlob(file: MobleFile): Blob {
  return new Blob([mobleToJson(file)], { type: "application/json" })
}

/** A l'iPhone (PWA) obre el full de compartir si accepta fitxers; si no, descàrrega normal. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return "shared"
    } catch (e) {
      // Cancel·lat per l'usuari: no cal descarregar.
      if (e instanceof DOMException && e.name === "AbortError") return "shared"
    }
  }
  downloadBlob(blob, filename)
  return "downloaded"
}

export async function saveProjectAsFile(project: Project, settings: Settings, includePhoto: boolean): Promise<{ filename: string; bytes: number; how: "shared" | "downloaded" }> {
  const file = await projectToMoble(project, settings, includePhoto)
  const blob = mobleBlob(file)
  const filename = mobleFileName(project.name)
  const how = await shareOrDownload(blob, filename)
  await keepProject(project.id)
  return { filename, bytes: blob.size, how }
}

type OpenResult = { ok: true; projectId: number; name: string; warnings: string[] } | { ok: false; error: string }

/**
 * Torna a crear els models 3D de l'usuari d'un fitxer amb el mateix id (si ja hi són, es fan servir els que hi ha). Torna
 * l'avís si algun està malmès. `.moble` i `.ambient`.
 */
export async function restoreUserModels(models: readonly FileModel[]): Promise<string | undefined> {
  let bad = false
  for (const m of models) {
    try {
      const added = await ensureUserModel({ id: m.id, name: m.name, size: m.size, blob: base64ToBlob(m.data, m.mime || "model/gltf-binary"), createdAt: Date.now() })
      // Si el visor ja tenia aquest id a la memòria cau com a «no hi és», l'oblida (sense three.js carregat no n'hi ha cap).
      if (added) void import("../../components/viewer/models3d").then((x) => x.forgetModel(m.id))
    } catch {
      bad = true
    }
  }
  return bad ? "Algun model 3D del fitxer està malmès; no es veurà." : undefined
}

/**
 * Crea un moble nou amb el contingut d'un `.moble` (composició, nesting i, si n'hi ha, la foto amb el calibratge): el
 * nom, únic entre `existing`; `folder`, el grup. Els models i les referències van a part. `.moble` i `.ambient`.
 */
export async function createProjectFromMoble(file: MobleFile, existing: readonly string[], folder?: string): Promise<{ projectId: number; name: string; warnings: string[] }> {
  const warnings: string[] = []
  const name = uniqueName(file.project.name.trim() || "Moble", existing)
  const projectId = await createProject(name, DEFAULT_CABINET, {
    composition: file.project.composition,
    ...(file.project.nesting ? { nesting: file.project.nesting } : {}),
    ...(folder ? { folder } : {}),
  })
  if (file.photo && file.project.photo) {
    try {
      const blob = base64ToBlob(file.photo.data, file.photo.mime)
      const photo: Omit<Photo, "id"> = { projectId, blob, width: file.photo.width, height: file.photo.height, exifFocal35: file.photo.exifFocal35, createdAt: Date.now() }
      const photoId = await addPhoto(photo)
      await updateProjectPhoto(projectId, { photoId, ...file.project.photo })
    } catch {
      warnings.push(`La foto de «${name}» està malmesa; s'ha obert sense foto.`)
    }
  }
  return { projectId, name, warnings }
}

/** Afegeix a les preferències les referències que falten i torna l'avís (o res). `.moble` i `.ambient`. */
export async function addMissingReferences(missing: readonly RefPreset[], settings: Settings, saveSettings: (s: Settings) => Promise<void>): Promise<string | undefined> {
  if (!missing.length) return undefined
  await saveSettings({ ...settings, references: [...missing.map((r) => ({ ...r, id: newId("ref") })), ...settings.references] })
  return `${missing.length === 1 ? "S'ha afegit una referència" : `S'han afegit ${missing.length} referències`} a les preferències: ${missing.map((r) => r.name).join(", ")}.`
}

/** `openMobleFile` amb el JSON ja llegit (`openAnyFile`). */
export async function openMobleData(raw: unknown, settings: Settings, saveSettings: (s: Settings) => Promise<void>): Promise<OpenResult> {
  const res = parseMobleData(raw)
  if (!res.ok) return res
  const { file } = res
  const warnings = [...res.warnings]
  const badModels = await restoreUserModels(file.models ?? [])
  if (badModels) warnings.push(badModels)
  const existing = (await db.projects.toArray()).map((p) => p.name)
  const created = await createProjectFromMoble(file, existing)
  warnings.push(...created.warnings)
  const refs = await addMissingReferences(missingReferences(file, settings.references), settings, saveSettings)
  if (refs) warnings.push(refs)
  const noMaterials = missingMaterialsWarning(missingMaterials(file.project.composition, settings.materials))
  if (noMaterials) warnings.push(noMaterials)
  return { ok: true, projectId: created.projectId, name: created.name, warnings }
}
