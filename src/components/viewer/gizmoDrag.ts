import { Plane, Vector3, type Camera } from "three"

/**
 * El pla on s'arrossega una fletxa del gizmo: conté l'eix i mira tant com pot a la càmera (el punt de sota el ratolí s'hi
 * projecta). La bola del mig (`free`), el pla de `freeNormal` (sense: el de la pantalla). `null` si l'eix mira just a la
 * càmera (no hi ha pla per arrossegar-lo).
 */
export function axisDragPlane(handle: "x" | "y" | "z" | "free", camera: Camera, point: Vector3, freeNormal?: Vector3): Plane | null {
  const toCam = camera.getWorldDirection(new Vector3()).negate()
  let n: Vector3
  if (handle === "free") n = freeNormal ? freeNormal.clone() : toCam
  else {
    const dir = handle === "x" ? new Vector3(1, 0, 0) : handle === "y" ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)
    n = dir.clone().cross(toCam).cross(dir)
  }
  if (n.lengthSq() < 1e-6) return null
  return new Plane().setFromNormalAndCoplanarPoint(n.normalize(), point)
}
