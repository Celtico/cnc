import { useFrame } from "@react-three/fiber"
import { useMemo } from "react"
import { Vector3, type BoxGeometry, type Group, type Mesh, type MeshStandardMaterial } from "three"
import { roofBox, type Ambient } from "../../../core/model"

/** Casa de nines a cada fotograma: el sostre només des de dins, i la teulada i les parets que tapen, gairebé transparents. */
export function useDollhouse({ ambient, walls, roof, ceiling, dollhouse }: { ambient: Ambient; walls: Group; roof: Group | null; ceiling: Mesh | null; dollhouse: boolean }) {
  // Com una casa de nines: les parets entre la càmera i l'habitació es fan gairebé transparents.
  const tmp = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => {
    // El sostre es veu quan la càmera és a dins de l'habitació (vista d'interior).
    if (ceiling) {
      const b = ceiling.geometry as BoxGeometry
      const { width, depth } = b.parameters
      const p = ceiling.position
      ceiling.visible = camera.position.y < p.y - 0.05 && Math.abs(camera.position.x - p.x) < width / 2 && Math.abs(camera.position.z - p.z) < depth / 2
    }
    // La teulada, a la casa de nines: des de fora es fa gairebé transparent (es veu l'interior); des de dins, sòlida.
    if (roof) {
      const rb = roofBox(ambient)
      const inside = !!rb && camera.position.x * 1000 > rb.x0 && camera.position.x * 1000 < rb.x1 && camera.position.z * 1000 > rb.y0 && camera.position.z * 1000 < rb.y1 && camera.position.y * 1000 < rb.base
      roof.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        const mat = m.material as MeshStandardMaterial
        const base = (mat.userData.baseOpacity as number | undefined) ?? 1
        const target = dollhouse && !inside ? Math.min(base, 0.12) : base
        if (mat.opacity !== target) {
          mat.transparent = target < 1
          mat.opacity = target
          mat.depthWrite = target === 1
          m.castShadow = target === 1
          mat.needsUpdate = true
        }
      })
    }
    for (const wg of walls.children) {
      const n = wg.userData.normal as Vector3 | undefined
      const c = wg.userData.center as Vector3 | undefined
      if (!n || !c) continue
      const facing = dollhouse && tmp.copy(camera.position).sub(c).dot(n) > 0
      wg.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        const mat = m.material as MeshStandardMaterial
        const base = (mat.userData.baseOpacity as number | undefined) ?? 1
        const target = facing ? Math.min(base, 0.12) : base
        if (mat.opacity !== target) {
          mat.transparent = target < 1
          mat.opacity = target
          mat.depthWrite = target === 1
          m.castShadow = target === 1
          mat.needsUpdate = true
        }
      })
    }
  })
}
