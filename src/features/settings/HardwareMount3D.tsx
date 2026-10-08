import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { NeutralToneMapping, Vector3, type WebGLRenderer } from "three"
import { mountCamera, type HardwareMount } from "../../core/build/hardwareMount"
import { shelfPins } from "../../core/build/hardwareSolids"
import type { MaterialPref, Panel } from "../../core/model"
import { MovingPanel, PanelMesh } from "../../components/viewer/CabinetViewer"
import { LOW_MEMORY } from "../../components/viewer/deviceLimits"
import { PanelFittings } from "../../components/viewer/Hardware"
import { releaseModelGpu } from "../../components/viewer/models3d"
import { movingGroups, transformAt } from "../../components/viewer/opening"
import { StudioEnvironment, TextureRefresh } from "../../components/viewer/SceneHelpers"

const S = 0.001

/**
 * El ferratge muntat en 3D (Preferències › Ferratges, «3D»): les peces del mòdul d'exemple (`hardwareMount`, fetes pel
 * motor) amb el mateix `PanelMesh` que el visor del moble —materials, forats i ferratges (el GLB importat o el dibuix 3D
 * dels de sèrie, `builtinSolids`)—, la **fusta translúcida** (`seeThrough`: el ferratge és el protagonista; les peces
 * que són el ferratge, `HardwareMount.solid`, opaques), centrades al punt que mira la càmera (`mountCamera`: enquadra el ferratge amb els seus forats i un
 * marge de peça, `HardwareMount.region`). La porta (o l'abatible) s'obre amb `open` (0–1) com al visor.
 * Un «només 3D», el model sol enquadrat a la seva caixa (`modelCamera`: un perfil llarg i prim, mirat al llarg perquè se'n
 * vegi la secció). **Sense cap cota** (per decisió de l'usuari: «a les vistes les mides de tot, i al 3D cap mida»; les
 * mides són als plànols 2D de l'editor). Un sol `Canvas` que pinta a demanda; es
 * munta amb l'editor obert (`React.lazy`) i, en tancar-lo, allibera els models.
 */
export default function HardwareMount3D({ mount, materials, open }: { mount: HardwareMount; materials: MaterialPref[]; open: number }) {
  useEffect(() => () => releaseModelGpu(), [])
  const mb = mount.model?.bbox
  const span = mb ? Math.max(mb.max[0] - mb.min[0], mb.max[1] - mb.min[1], mb.max[2] - mb.min[2]) * S : 0
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
      <MountScene mount={mount} materials={materials} open={open} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} target={[0, 0, 0]} minDistance={0.02} maxDistance={Math.max(2, span * 4)} />
    </Canvas>
  )
}

/** Les peces (o el model sol) centrades al punt que mira la càmera i la càmera (`mountCamera` amb l'aspecte del visor). */
function MountScene({ mount, materials, open }: { mount: HardwareMount; materials: MaterialPref[]; open: number }) {
  const groups = useMemo(() => movingGroups(mount.panels), [mount.panels])
  const groupOf = useMemo(() => new Map(groups.flatMap((g) => g.panelIds.map((id) => [id, g] as const))), [groups])
  const size = useThree((s) => s.size)
  // L'aspecte del visor (arrodonit: redimensionar una mica no torna a posar la càmera).
  const aspect = size.height > 0 ? Math.round((size.width / size.height) * 10) / 10 : 1.6
  // Només 3D: el model tal qual (una «peça» buida que només porta el model, `PanelFittings`).
  const model = mount.model
  const modelPanel = useMemo<Panel | null>(
    () =>
      model
        ? { id: "model", name: "model", label: "Model", role: "part", length: 0, width: 0, thickness: 0, material: "", grain: "none", edges: { left: false, right: false, top: false, bottom: false }, holes: [], grooves: [], placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 1] }, fittings: [{ ...(model.asset ? { asset: model.asset } : {}), x: 0, y: 0, face: "A", v: [0, 1], ...(model.bbox ? { bbox: model.bbox } : {}) }] }
        : null,
    [model],
  )
  // Centrat al punt que mira la càmera (el forat principal o el model), la mateixa vista que la miniatura.
  const cam = useMemo(() => mountCamera(mount, aspect), [mount, aspect])
  const center: [number, number, number] = [-cam.target[0] * S, -cam.target[1] * S, -cam.target[2] * S]
  const tags = mount.proposedTags.length ? mount.proposedTags : undefined
  // Fusta translúcida i el ferratge opac (el protagonista); els suports de prestatge als forats de sota el prestatge.
  const solid = useMemo(() => new Set(mount.solid), [mount.solid])
  const pins = useMemo(() => shelfPins(mount.panels), [mount.panels])
  return (
    <>
      <group position={center}>
        {modelPanel && <PanelFittings panel={modelPanel} />}
        {mount.panels.map((p) => {
          const g = groupOf.get(p.id)
          return (
            <MovingPanel key={p.id} transform={g ? transformAt(g.motion, open) : null}>
              <PanelMesh panel={p} exploded={false} showHoles edges materialMode="role" materials={materials} hardware pins={pins.get(p.id)} seeThrough={!solid.has(p.id)} proposedTags={tags} />
            </MovingPanel>
          )
        })}
      </group>
      <Framing dir={cam.dir} dist={cam.dist * S} />
    </>
  )
}

/** Càmera de «Com va muntat» (`mountCamera`): es torna a posar quan canvia el ferratge (no quan s'obre la porta). */
function Framing({ dir, dist }: { dir: [number, number, number]; dist: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null
  const invalidate = useThree((s) => s.invalidate)
  const [dx, dy, dz] = dir
  useEffect(() => {
    camera.position.set(dx * dist, dy * dist, dz * dist)
    camera.lookAt(0, 0, 0)
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
    invalidate()
  }, [dx, dy, dz, dist, camera, controls, invalidate])
  return null
}
