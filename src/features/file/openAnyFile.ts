import { fileKind } from "../../core/file/ambientFile"
import type { Settings } from "../../core/model"
import { db } from "../../db/db"
import { isObject } from "../objects/isObject"
import { openAmbientData } from "./ambientIo"
import { openMobleData } from "./mobleIo"

/** Què s'ha obert: un moble (o objecte) o un ambient. */
export type OpenedFile =
  | { ok: true; kind: "moble" | "objecte"; projectId: number; name: string; warnings: string[] }
  | { ok: true; kind: "ambient"; ambientId: number; name: string; warnings: string[] }
  | { ok: false; error: string }

/**
 * Obre qualsevol fitxer de l'app pel seu `format` (`.moble` o `.ambient`), triat a qualsevol «Obrir fitxer» (Mobles,
 * Objectes, Ambients) o amb doble clic (`useLaunchFiles`): s'obre sempre com el que és, i la pàgina diu on ha anat a
 * parar si no és seu (`openedNote`).
 */
export async function openAnyFile(text: string, settings: Settings, saveSettings: (s: Settings) => Promise<void>): Promise<OpenedFile> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "Aquest fitxer no és un moble ni un ambient (no és un JSON vàlid)." }
  }
  const kind = fileKind(raw)
  if (kind === "ambient") {
    const res = await openAmbientData(raw, settings, saveSettings)
    return res.ok ? { ...res, kind: "ambient" } : res
  }
  if (kind !== "moble") return { ok: false, error: "Aquest fitxer no és un moble ni un ambient de l'app." }
  const res = await openMobleData(raw, settings, saveSettings)
  if (!res.ok) return res
  const p = await db.projects.get(res.projectId)
  return { ...res, kind: p && isObject(p) ? "objecte" : "moble" }
}

/** On ha anat a parar un fitxer obert des d'una pàgina que no és la seva (o res si és el que toca). */
export function openedNote(opened: Exclude<OpenedFile, { ok: false }>, page: "moble" | "objecte" | "ambient"): string | undefined {
  if (opened.kind === page) return undefined
  return opened.kind === "ambient" ? "És un ambient: s'ha obert a Ambients." : opened.kind === "objecte" ? "És un objecte: s'ha obert a Objectes." : "És un moble: s'ha obert a Mobles."
}

/** Obre l'ambient (l'escolta `App`: `mobles:open-ambient`), des d'una pàgina que no és la d'Ambients. */
export function showAmbient(id: number): void {
  window.dispatchEvent(new CustomEvent("mobles:open-ambient", { detail: id }))
}
