import {
  buildMobleFile,
  missingReferences,
  mobleFileName,
  mobleToJson,
  parseMobleFile,
  uniqueName,
  type FilePhoto,
  type MobleFile,
} from "../../core/file/mobleFile"
import { DEFAULT_CABINET, newId, type Settings } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import { addPhoto, createProject, db, safeNestOptions, updateProjectPhoto, type Photo, type Project } from "../../db/db"
import { downloadBlob } from "../download"

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

/** Construeix el fitxer `.moble` d'un projecte (amb la foto si es demana i n'hi ha). */
export async function projectToMoble(project: Project, settings: Settings, includePhoto: boolean): Promise<MobleFile> {
  const composition = compositionOf(project)
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
  return buildMobleFile({
    name: project.name,
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
  return { filename, bytes: blob.size, how }
}

export type OpenResult = { ok: true; projectId: number; name: string; warnings: string[] } | { ok: false; error: string }

/**
 * Obre un `.moble`: sempre crea un moble nou (mai en sobreescriu cap), amb la foto si
 * n'hi ha, i afegeix a les preferències les referències que faltin.
 */
export async function openMobleFile(text: string, settings: Settings, saveSettings: (s: Settings) => Promise<void>): Promise<OpenResult> {
  const res = parseMobleFile(text)
  if (!res.ok) return res
  const { file } = res
  const warnings = [...res.warnings]

  const existing = (await db.projects.toArray()).map((p) => p.name)
  const name = uniqueName(file.project.name.trim() || "Moble", existing)
  const projectId = await createProject(name, DEFAULT_CABINET, {
    composition: file.project.composition,
    ...(file.project.nesting ? { nesting: file.project.nesting } : {}),
  })

  if (file.photo && file.project.photo) {
    try {
      const blob = base64ToBlob(file.photo.data, file.photo.mime)
      const photo: Omit<Photo, "id"> = { projectId, blob, width: file.photo.width, height: file.photo.height, exifFocal35: file.photo.exifFocal35, createdAt: Date.now() }
      const photoId = await addPhoto(photo)
      await updateProjectPhoto(projectId, { photoId, ...file.project.photo })
    } catch {
      warnings.push("La foto del fitxer està malmesa; s'ha obert sense foto.")
    }
  }

  const missing = missingReferences(file, settings.references)
  if (missing.length) {
    await saveSettings({ ...settings, references: [...missing.map((r) => ({ ...r, id: newId("ref") })), ...settings.references] })
    warnings.push(`${missing.length === 1 ? "S'ha afegit una referència" : `S'han afegit ${missing.length} referències`} a les preferències: ${missing.map((r) => r.name).join(", ")}.`)
  }
  return { ok: true, projectId, name, warnings }
}
