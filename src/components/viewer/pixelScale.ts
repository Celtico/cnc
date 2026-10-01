import { useFrame } from "@react-three/fiber"
import { useMemo } from "react"
import { Vector3, type Group } from "three"

export type Axis = "x" | "y" | "z"

/** Escala un grup perquè 1 unitat sigui `px` píxels a la pantalla (nanses, gizmos i botons 3D). */
export function usePixelScale(ref: React.RefObject<Group | null>, px: number) {
  const tmp = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    const g = ref.current
    if (!g) return
    const k =
      "isOrthographicCamera" in camera && camera.isOrthographicCamera
        ? px / (camera as { zoom: number }).zoom
        : (px * 2 * camera.position.distanceTo(g.getWorldPosition(tmp)) * Math.tan((((camera as { fov?: number }).fov ?? 38) * Math.PI) / 360)) / Math.max(1, size.height)
    g.scale.setScalar(k)
  })
}
