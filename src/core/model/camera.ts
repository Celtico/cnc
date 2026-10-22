import { z } from "zod"
import { roundTo } from "../../lib/format"

const Vec3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])

/**
 * Càmera 3D desada amb el document (moble o ambient), en metres de l'escena del visor: posició, punt mirat
 * (`target` d'OrbitControls) i obertura (`fov`, graus). En obrir-lo es torna on es va deixar.
 */
const CameraPoseShape = z.object({
  position: Vec3Schema,
  target: Vec3Schema,
  fov: z.number().finite().min(1).max(179).optional(),
  /** Ambients: era la càmera d'«Enquadrar» (`home`) o d'«Interior» (`eye`), per marcar-ne el botó en tornar-hi. */
  pose: z.enum(["home", "eye"]).optional(),
})
export type CameraPose = z.infer<typeof CameraPoseShape>

/** Opcional i tolerant: una càmera no vàlida (NaN, mal formada) es descarta sense invalidar el document. */
export const CameraPoseSchema = CameraPoseShape.optional().catch(undefined)

/** Llegeix una càmera desada; `undefined` si no n'hi ha o no és vàlida. */
export function parseCameraPose(raw: unknown): CameraPose | undefined {
  const r = CameraPoseShape.safeParse(raw)
  return r.success ? r.data : undefined
}

/** Mateixa càmera (amb una tolerància, en metres i graus). */
export function sameCameraPose(a: CameraPose, b: CameraPose, eps = 0.005): boolean {
  const near = (p: readonly number[], q: readonly number[]) => p.every((v, i) => Math.abs(v - q[i]!) < eps)
  return near(a.position, b.position) && near(a.target, b.target) && Math.abs((a.fov ?? 0) - (b.fov ?? 0)) < 0.5
}

/**
 * Signatura curta d'una càmera (arrodonida a mm i a dècimes de grau) per saber si la miniatura que se'n va fer
 * encara la retrata: desar la càmera no toca `updatedAt`. Sense càmera (o no vàlida), `undefined`.
 */
export function cameraSignature(raw: unknown): string | undefined {
  const c = parseCameraPose(raw)
  if (!c) return undefined
  const r = (v: number) => roundTo(v, 3)
  return JSON.stringify([c.position.map(r), c.target.map(r), c.fov === undefined ? null : roundTo(c.fov, 1)])
}

/** Camps de miniatura desats amb el document (`Project`, `AmbientRow`). */
interface ThumbStamp {
  thumb?: string
  /** L'`updatedAt` que retrata. */
  thumbAt?: number
  /** `THUMB_VERSION` amb què es va fer. */
  thumbV?: number
  /** `cameraSignature` de la càmera amb què es va fer (sense càmera, no hi és). */
  thumbCam?: string
  /** L'escena de Preferències › Visor 3D (terra, paret) amb què es va fer (`presentationScenePrint`). */
  thumbStudio?: string
}

/**
 * Cal refer la miniatura: no n'hi ha, el document ha canviat, la manera de fer-les, la càmera desada o, si es dona
 * `studio`, l'escena de Preferències on es fan.
 */
export function thumbIsStale(t: ThumbStamp, updatedAt: number, version: number, camera: unknown, studio?: string): boolean {
  return !t.thumb || t.thumbAt !== updatedAt || t.thumbV !== version || t.thumbCam !== cameraSignature(camera) || (studio !== undefined && t.thumbStudio !== studio)
}
