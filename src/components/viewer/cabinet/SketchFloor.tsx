import { useContext } from "react"
import type { ThreeEvent } from "@react-three/fiber"
import type { Panel } from "../../../core/model"
import { FloorPickContext, useFaceHover, useFacePick, type FaceHit } from "../facePick"
import { toMm } from "./sceneSpace"

/** El terra com a «peça» per a les eines de croquis: només en té el punt i la normal (cap amunt). */
const FLOOR = { id: "floor", label: "Terra" } as Panel

/**
 * Rectangle, Polilínia i Cercle també dibuixen a terra (com al Taulell): un pla invisible a l'altura 0 que rep el clic
 * i el ratolí on no hi ha cap peça a sota. `width`/`depth`: per passar del centre de l'escena als mm del moble.
 */
export function SketchFloor({ width, depth }: { width: number; depth: number }) {
  const on = useContext(FloorPickContext)
  const [pick, hover] = [useFacePick(), useFaceHover()]
  if (!on || !pick) return null
  const hit = (e: ThreeEvent<PointerEvent | MouseEvent>): FaceHit | null =>
    // Només on la primera cosa sota el ratolí no és una peça (el terra de l'habitació i la graella no compten).
    e.intersections.find((i) => i.object === e.object || typeof i.object.userData.panel === "string")?.object !== e.object ? null : { panel: FLOOR, point: toMm(e.point, width, depth), normal: [0, 1, 0] }
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        const h = hit(e)
        if (!h) return
        e.stopPropagation()
        pick(h)
      }}
      onPointerMove={(e) => hover?.(hit(e))}
      onPointerOut={() => hover?.(null)}
    >
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}
