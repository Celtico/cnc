import { Vector3, type Object3D } from "three"
import type { Vec3 } from "../../../core/model"
import { S } from "./constants"

/**
 * El pas entre els mm del moble (origen a la cantonada, com el model) i l'escena (metres, centrada en amplada i fondària).
 * Un sol lloc perquè el terra, el làser i l'arrossegar de cares facin servir el mateix.
 */
export const toScene = (p: readonly number[], width: number, depth: number) => new Vector3((p[0]! - width / 2) * S, p[1]! * S, (p[2]! - depth / 2) * S)
export const toMm = (w: { x: number; y: number; z: number }, width: number, depth: number): Vec3 => [w.x / S + width / 2, w.y / S, w.z / S + depth / 2]

const shown = (o: Object3D | null): boolean => !o || (o.visible && shown(o.parent))

/** Les peces visibles de l'escena (les malles amb `userData.panel`): el que es pot tocar amb el ratolí o el làser. */
export function pieceMeshes(scene: Object3D): Object3D[] {
  const pieces: Object3D[] = []
  scene.traverse((o) => void (typeof o.userData.panel === "string" && shown(o) && pieces.push(o)))
  return pieces
}
