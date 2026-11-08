import { useContext, useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { Raycaster, Vector3 } from "three"
import { RayCastContext } from "../facePick"
import { S } from "./constants"
import { mmPerPx } from "../snapTolerance"
import { pieceMeshes, toScene } from "./sceneSpace"

/**
 * El raig del làser contra les peces tal com es veuen (com el del Taulell): toca el fons d'una ranura, l'interior d'un
 * forat o el cantell d'una peça, no la seva capsa. `width`/`depth`: per passar dels mm del moble a l'escena.
 */
export function RayCaster({ width, depth }: { width: number; depth: number }) {
  const ref = useContext(RayCastContext)
  const getThree = useThree((s) => s.get)
  useEffect(() => {
    if (!ref) return
    const world = (p: readonly number[]) => toScene(p, width, depth)
    const cast = (from: readonly number[], dir: readonly number[]) => {
      const { scene } = getThree()
      const o = world(from)
      const rc = new Raycaster(o, new Vector3(dir[0], dir[1], dir[2]).normalize(), 0.1 * S, 100)
      // Només les peces (les línies, les etiquetes i el terra no compten, i les Line2 no es deixen travessar sense càmera).
      const hit = rc.intersectObjects(pieceMeshes(scene), false)[0]
      return hit ? { t: hit.distance / S, panel: hit.object.userData.panel as string } : null
    }
    ref.current = {
      cast,
      mmPerPx: (at) => {
        const { camera, size } = getThree()
        return mmPerPx(camera, size.height, world(at), S)
      },
    }
    return () => {
      ref.current = null
    }
  }, [ref, getThree, width, depth])
  return null
}
