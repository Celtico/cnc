import { parseClip, type EditClip } from "../../core/model"

/** Porta-retalls de l'editor (mòdul, objecte, compartiment, peça o model 3D). */
export type Clip = EditClip
const CLIP_KEY = "mobles:clipboard"
let memClip: Clip | null = null
export function writeClip(c: Clip) {
  memClip = structuredClone(c)
  try {
    localStorage.setItem(CLIP_KEY, JSON.stringify(c))
  } catch {
    /* només en memòria */
  }
}
export function readClip(): Clip | null {
  try {
    // Pot venir d'una altra versió de l'app o estar malmès: es valida amb els esquemes (`parseClip`).
    const raw = localStorage.getItem(CLIP_KEY)
    if (raw) return parseClip(JSON.parse(raw))
  } catch {
    /* només en memòria */
  }
  return memClip
}
