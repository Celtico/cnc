import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useState } from "react"
import { Box3, Vector3, type Object3D } from "three"
import { LOW_MEMORY } from "../../components/viewer/deviceLimits"
import { loadModel } from "../../components/viewer/models3d"
import { StudioEnvironment } from "../../components/viewer/SceneHelpers"

const S = 0.001

/**
 * Vista 3D d'un ferratge importat (Preferències › Ferratges): el GLB fet en importar (al marc del ferratge: u al llarg
 * del cantell, v cap a dins, n fora de la cara, en metres) sobre un tros de la peça on va (porta o lateral, translúcid,
 * de 19 mm), per veure de quin costat queda el cantell. Es carrega quan s'obre l'editor (`React.lazy`) i pinta a demanda.
 */
export default function HardwareModelPreview({ asset, edge, plate }: { asset: string; edge: number; plate?: boolean }) {
  return (
    <Canvas frameloop="demand" dpr={[1, LOW_MEMORY ? 1.5 : 2]} gl={{ alpha: true, antialias: true }} camera={{ fov: 30, near: 0.005, far: 5, position: [0.14, 0.12, 0.16], up: [0, 0, 1] }} resize={{ offsetSize: true }} style={{ touchAction: "none" }}>
      <StudioEnvironment intensity={0.7} />
      <hemisphereLight args={["#ffffff", "#8a7a60", 0.4]} />
      <directionalLight position={[1, -1, 2]} intensity={2} />
      <directionalLight position={[-1, 1, 1]} intensity={0.6} />
      <Model asset={asset} />
      {/* Tros de peça: de la vora (v = −edge, el cantell de la frontissa o el davant del lateral) cap a dins, 19 de gruix sota la cara. */}
      <mesh position={[0, (100 - edge) * S / 2, -9.5 * S]}>
        <boxGeometry args={[140 * S, (100 + edge) * S, 19 * S]} />
        <meshStandardMaterial color={plate ? "#d9c7a5" : "#e4d3b0"} transparent opacity={0.45} roughness={0.8} />
      </mesh>
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} target={[0, 0.01, 0]} />
    </Canvas>
  )
}

function Model({ asset }: { asset: string }) {
  const invalidate = useThree((s) => s.invalidate)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null
  const [root, setRoot] = useState<Object3D | null>(null)
  useEffect(() => {
    let live = true
    void loadModel(asset).then((l) => {
      if (!live || !l) return
      setRoot(l.root.clone(true))
    })
    return () => {
      live = false
    }
  }, [asset])
  // Enquadra el model (i el tros de peça) en carregar-lo.
  const box = useMemo(() => (root ? new Box3().setFromObject(root) : null), [root])
  useEffect(() => {
    if (!box) return
    const c = box.getCenter(new Vector3())
    const r = Math.max(0.06, box.getSize(new Vector3()).length())
    camera.position.set(c.x + r * 1.1, c.y - r * 0.9, c.z + r * 0.9)
    camera.lookAt(c)
    if (controls) {
      controls.target.copy(c)
      controls.update()
    }
    invalidate()
  }, [box, camera, controls, invalidate])
  return root ? <primitive object={root} /> : null
}
