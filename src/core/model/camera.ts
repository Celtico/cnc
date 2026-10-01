import { z } from "zod"

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
