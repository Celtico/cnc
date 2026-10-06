import { Line, OrbitControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { CanvasTexture, NeutralToneMapping, SRGBColorSpace, SpriteMaterial, Vector2, Vector3, type WebGLRenderer } from "three"
import { mountCamera, type HardwareMount } from "../../core/build/hardwareMount"
import type { MaterialPref, Panel, Vec3 } from "../../core/model"
import { MovingPanel, PanelMesh } from "../../components/viewer/CabinetViewer"
import { LOW_MEMORY } from "../../components/viewer/deviceLimits"
import { PanelFittings } from "../../components/viewer/Hardware"
import { releaseModelGpu } from "../../components/viewer/models3d"
import { movingGroups, transformAt } from "../../components/viewer/opening"
import { StudioEnvironment, TextureRefresh } from "../../components/viewer/SceneHelpers"

const S = 0.001

/**
 * El ferratge muntat en 3D (Preferències › Ferratges, «3D»): les peces del mòdul d'exemple (`hardwareMount`, fetes pel
 * motor) amb el mateix `PanelMesh` que el visor del moble —materials, forats i ferratges (el GLB importat o el volum de
 * la frontissa de l'app)—, centrades al forat principal. La porta (o l'abatible) s'obre amb `open` (0–1) com al visor.
 * Un «només 3D», el model sol enquadrat a la seva caixa (`modelCamera`: un perfil llarg i prim, mirat al llarg perquè se'n
 * vegi la secció) i amb les **cotes** de la caixa (amplada × alçada × fondària). Un sol `Canvas` que pinta a demanda; es
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

/** Les peces (o el model sol) centrades al punt que mira la càmera, la càmera (`mountCamera` amb l'aspecte del visor) i les cotes. */
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
  return (
    <>
      <group position={center}>
        {modelPanel && <PanelFittings panel={modelPanel} />}
        {model?.bbox && <BoxDims box={model.bbox} dir={cam.dir} />}
        {mount.panels.map((p) => {
          const g = groupOf.get(p.id)
          return (
            <MovingPanel key={p.id} transform={g ? transformAt(g.motion, open) : null}>
              <PanelMesh panel={p} exploded={false} showHoles edges materialMode="role" materials={materials} hardware proposedTags={tags} />
            </MovingPanel>
          )
        })}
      </group>
      <Framing dir={cam.dir} dist={cam.dist * S} />
    </>
  )
}

const DIM_COLOR = "#b5651d"
const fmtMm = (v: number) => `${String(Math.round(v * 10) / 10).replace(".", ",")} mm`

/**
 * Cotes de la caixa d'un «només 3D»: les tres arestes que surten del vèrtex del costat de la càmera (amplada X, alçada Y,
 * fondària Z), per sobre de tot, amb la mida en mm al mig de cadascuna; la resta de la caixa, fina. `dir` = cap a la càmera.
 */
function BoxDims({ box, dir }: { box: { min: Vec3; max: Vec3 }; dir: Vec3 }) {
  const { min, max } = box
  // El vèrtex del costat de la càmera i, per a cada eix, l'aresta que en surt.
  const c: Vec3 = [dir[0] >= 0 ? max[0] : min[0], dir[1] >= 0 ? max[1] : min[1], dir[2] >= 0 ? max[2] : min[2]]
  const p = (v: Vec3) => new Vector3(v[0] * S, v[1] * S, v[2] * S)
  const edges = [0, 1, 2].map((i) => {
    const a: Vec3 = [...c]
    const b: Vec3 = [...c]
    a[i] = min[i]!
    b[i] = max[i]!
    return { i, a, b, len: max[i]! - min[i]! }
  })
  const all: [Vec3, Vec3][] = []
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) all.push([[x, y, min[2]], [x, y, max[2]]])
  for (const x of [min[0], max[0]]) for (const z of [min[2], max[2]]) all.push([[x, min[1], z], [x, max[1], z]])
  for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) all.push([[min[0], y, z], [max[0], y, z]])
  // Etiquetes apartades de l'aresta en direccions diferents (les mides curtes no s'encavalquen): l'ancoratge de cada una.
  const anchor: [number, number][] = [
    [0.5, 1.25],
    [-0.15, 0.5],
    [0.5, -0.25],
  ]
  return (
    <group renderOrder={12}>
      {all.map(([a, b], k) => (
        <Line key={k} points={[p(a), p(b)]} color={DIM_COLOR} lineWidth={0.75} transparent opacity={0.35} depthTest={false} renderOrder={12} />
      ))}
      {edges.map((e) => (
        <group key={e.i}>
          <Line points={[p(e.a), p(e.b)]} color={DIM_COLOR} lineWidth={2} depthTest={false} renderOrder={13} />
          <DimLabel text={fmtMm(e.len)} at={p([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2, (e.a[2] + e.b[2]) / 2])} anchor={anchor[e.i]!} />
        </group>
      ))}
    </group>
  )
}

/**
 * Una etiqueta de cota: un sprite amb el text pintat en un canvas, de mida constant a la pantalla (`sizeAttenuation`
 * fals) i per sobre de tot. No és un `Html` de drei (amb React 19 fallaven en desmuntar-se, vegeu el visor).
 */
function DimLabel({ text, at, anchor }: { text: string; at: Vector3; anchor: [number, number] }) {
  const height = useThree((s) => s.size.height)
  const invalidate = useThree((s) => s.invalidate)
  const { material, aspect } = useMemo(() => {
    const px = 2 * 13
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const font = `600 ${px}px system-ui, sans-serif`
    ctx.font = font
    const w = Math.ceil(ctx.measureText(text).width) + px * 0.8
    const h = Math.ceil(px * 1.45)
    canvas.width = w
    canvas.height = h
    ctx.fillStyle = DIM_COLOR
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, h * 0.25)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = font
    ctx.textBaseline = "middle"
    ctx.fillText(text, px * 0.4, h / 2 + 1)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return { material: new SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }), aspect: w / h }
  }, [text])
  useEffect(() => {
    invalidate()
    return () => {
      material.map?.dispose()
      material.dispose()
    }
  }, [material, invalidate])
  // 19 px d'alt a la pantalla: amb `sizeAttenuation` fals, 1 = l'alçada de la vista × 2·tan(fov/2).
  const k = (19 / Math.max(1, height)) * 2 * Math.tan((32 * Math.PI) / 360)
  return <sprite position={at} material={material} scale={[k * aspect, k, 1]} center={new Vector2(...anchor)} renderOrder={14} />
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
