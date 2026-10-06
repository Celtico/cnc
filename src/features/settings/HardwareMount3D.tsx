import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { NeutralToneMapping, Vector3, type WebGLRenderer } from "three"
import type { HardwareMount } from "../../core/build/hardwareMount"
import type { MaterialPref } from "../../core/model"
import { MovingPanel, PanelMesh } from "../../components/viewer/CabinetViewer"
import { LOW_MEMORY } from "../../components/viewer/deviceLimits"
import { releaseModelGpu } from "../../components/viewer/models3d"
import { movingGroups, transformAt } from "../../components/viewer/opening"
import { StudioEnvironment, TextureRefresh } from "../../components/viewer/SceneHelpers"

const S = 0.001

/**
 * El ferratge muntat en 3D (Preferències › Ferratges, «3D»): les peces del mòdul d'exemple (`hardwareMount`, fetes pel
 * motor) amb el mateix `PanelMesh` que el visor del moble —materials, forats i ferratges (el GLB importat o el volum de
 * la frontissa de l'app)—, centrades al forat principal. La porta (o l'abatible) s'obre amb `open` (0–1) com al visor.
 * Un sol `Canvas` que pinta a demanda; es munta amb l'editor obert (`React.lazy`) i, en tancar-lo, allibera els models.
 */
export default function HardwareMount3D({ mount, materials, open }: { mount: HardwareMount; materials: MaterialPref[]; open: number }) {
  useEffect(() => () => releaseModelGpu(), [])
  const groups = useMemo(() => movingGroups(mount.panels), [mount.panels])
  const groupOf = useMemo(() => new Map(groups.flatMap((g) => g.panelIds.map((id) => [id, g] as const))), [groups])
  const f = mount.focus
  const center: [number, number, number] = f ? [-f.at[0] * S, -f.at[1] * S, -f.at[2] * S] : [0, 0, 0]
  const tags = mount.proposedTags.length ? mount.proposedTags : undefined
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, LOW_MEMORY ? 1.5 : 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      camera={{ fov: 32, near: 0.005, far: 10, position: [0.3, 0.2, -0.3] }}
      resize={{ offsetSize: true }}
      style={{ touchAction: "none" }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
        if (import.meta.env.DEV) (window as unknown as { __hardwareMount?: WebGLRenderer }).__hardwareMount = gl
      }}
    >
      <StudioEnvironment intensity={0.6} />
      <TextureRefresh />
      <hemisphereLight args={["#ffffff", "#8a7a60", 0.3]} />
      <directionalLight position={[1.5, 3, 2]} intensity={1.6} />
      <directionalLight position={[-2, 1.5, -2]} intensity={0.8} />
      <group position={center}>
        {mount.panels.map((p) => {
          const g = groupOf.get(p.id)
          return (
            <MovingPanel key={p.id} transform={g ? transformAt(g.motion, open) : null}>
              <PanelMesh panel={p} exploded={false} showHoles edges materialMode="role" materials={materials} hardware proposedTags={tags} />
            </MovingPanel>
          )
        })}
      </group>
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} target={[0, 0, 0]} minDistance={0.05} maxDistance={2} />
      <Framing mount={mount} />
    </Canvas>
  )
}

/**
 * Càmera al forat principal: mirant la cara on entra (des de dins del moble a les frontisses, on es veuen la cassoleta i
 * la placa), una mica de costat i de dalt. Es torna a posar quan canvia el ferratge (no quan s'obre la porta).
 */
function Framing({ mount }: { mount: HardwareMount }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null
  const invalidate = useThree((s) => s.invalidate)
  const n = mount.focus?.normal
  const nx = n?.[0] ?? 0
  const ny = n?.[1] ?? 0
  const nz = n?.[2] ?? 1
  const hinge = !!mount.hinge
  useEffect(() => {
    const dir = new Vector3(nx, ny, nz)
    // De costat i de dalt: a les frontisses, cap a dins del moble (+X, lluny del lateral), si no, cap a la dreta.
    const side = new Vector3(hinge ? 0.75 : 0.6, hinge ? 0.85 : 0.6, Math.abs(nz) > 0.7 ? 0 : 0.5)
    side.addScaledVector(dir, -side.dot(dir))
    dir.add(side).normalize()
    const dist = hinge ? 0.42 : 0.48
    camera.position.copy(dir.multiplyScalar(dist))
    camera.lookAt(0, 0, 0)
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
    invalidate()
  }, [nx, ny, nz, hinge, camera, controls, invalidate])
  return null
}
