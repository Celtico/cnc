import { useContext, useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { Raycaster, Vector3, type Object3D } from "three"
import { RayCastContext } from "../facePick"
import { S } from "./constants"

const shown = (o: Object3D | null): boolean => !o || (o.visible && shown(o.parent))

/**
 * El raig del làser contra les peces tal com es veuen (com el del Taulell): toca el fons d'una ranura, l'interior d'un
 * forat o el cantell d'una peça, no la seva capsa. `width`/`depth`: per passar dels mm del moble a l'escena.
 */
export function RayCaster({ width, depth }: { width: number; depth: number }) {
  const ref = useContext(RayCastContext)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (!ref) return
    ref.current = (from, dir) => {
      const o = new Vector3((from[0] - width / 2) * S, from[1] * S, (from[2] - depth / 2) * S)
      const rc = new Raycaster(o, new Vector3(...dir).normalize(), 0.1 * S, 100)
      // Només les peces (les línies, les etiquetes i el terra no compten, i les Line2 no es deixen travessar sense càmera).
      const pieces: Object3D[] = []
      scene.traverse((o) => void (typeof o.userData.panel === "string" && shown(o) && pieces.push(o)))
      const hit = rc.intersectObjects(pieces, false)[0]
      return hit ? { t: hit.distance / S, panel: hit.object.userData.panel as string } : null
    }
    return () => {
      ref.current = null
    }
  }, [ref, scene, width, depth])
  return null
}
