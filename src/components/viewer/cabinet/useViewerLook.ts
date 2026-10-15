import { useMemo } from "react"
import { useColorModeValue } from "../../ui/color-mode"
import { LIGHT_SPEC, usePresentationScene } from "../presentationScene"
import type { CabinetViewerProps } from "./types"

/** Escena de Presentació (terra, paret, llum) i colors del fons i de la graella segons el tema. */
export function useViewerLook(sceneFinish: CabinetViewerProps["sceneFinish"]) {
  const [prefScene] = usePresentationScene()
  // Els acabats propis del moble (terra i paret) passen per davant dels de Preferències.
  const ownFloor = sceneFinish?.floor, ownWall = sceneFinish?.wall
  const scene = useMemo(() => ({ ...prefScene, ...(ownFloor ? { floorMaterial: ownFloor } : {}), ...(ownWall ? { wallMaterial: ownWall } : {}) }), [prefScene, ownFloor, ownWall])
  const light = LIGHT_SPEC[scene.light]
  const bg = useColorModeValue("#f4f1ea", "#1b1a17")
  const gridCell = useColorModeValue("#d8d2c4", "#33302a")
  const gridSection = useColorModeValue("#b9b1a0", "#4a463d")
  return { scene, light, bg, gridCell, gridSection }
}
