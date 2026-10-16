import type { Camera, OrthographicCamera, PerspectiveCamera, Vector3 } from "three"

/** L'imant del 3D en píxels de pantalla: igual de fort de prop que de lluny (per decisió de l'usuari, 2026-10-16: «gairebé no es nota»). */
const SNAP_PX = 14
/** Com a mínim (mm): de molt a prop, encara s'enganxa. */
const SNAP_MIN_MM = 25

/**
 * La distància (mm) a la qual una aresta s'enganxa a una altra en arrossegar al 3D: `SNAP_PX` píxels de la pantalla al
 * punt `at` (unitats de l'escena, metres) amb la càmera d'ara; `S`, mm → unitats.
 */
export function snapToleranceMm(camera: Camera, heightPx: number, at: Vector3, S: number): number {
  let unitsPerPx: number
  if ((camera as OrthographicCamera).isOrthographicCamera) {
    const o = camera as OrthographicCamera
    unitsPerPx = (o.top - o.bottom) / o.zoom / Math.max(1, heightPx)
  } else {
    const p = camera as PerspectiveCamera
    const dist = p.position.distanceTo(at)
    unitsPerPx = (2 * dist * Math.tan(((p.fov ?? 50) * Math.PI) / 360)) / Math.max(1, heightPx)
  }
  return Math.max(SNAP_MIN_MM, (SNAP_PX * unitsPerPx) / S)
}
