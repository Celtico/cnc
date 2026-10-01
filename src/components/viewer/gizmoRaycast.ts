import { Mesh, type Intersection, type Raycaster } from "three"

/**
 * Raycast de les nanses del gizmo: com el d'una malla normal, però el tocat es posa a distància 0. r3f reparteix els
 * esdeveniments per distància, així la fletxa passa per davant de les peces i objectes que hi ha entre la càmera i
 * ella (es dibuixa per sobre de tot i s'ha de poder agafar igual, també si l'objecte és dins d'un moble).
 */
export function frontRaycast(this: Mesh, raycaster: Raycaster, hits: Intersection[]) {
  const n = hits.length
  Mesh.prototype.raycast.call(this, raycaster, hits)
  for (let i = n; i < hits.length; i++) hits[i]!.distance = 0
}

/** Malla que no es pot tocar (la part visible del gizmo: només compta la nansa invisible). */
export const noRaycast = () => {}
