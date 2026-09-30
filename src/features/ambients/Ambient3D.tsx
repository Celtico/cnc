import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useRef, type ComponentRef } from "react"
import { BoxGeometry, Group, Mesh, NeutralToneMapping, PlaneGeometry, Vector3, type MeshStandardMaterial, type Object3D } from "three"
import { exportablePanel } from "../../components/viewer/CabinetViewer"
import { buildScene } from "../../components/viewer/exportGlb"
import { SceneAccess, StudioEnvironment } from "../../components/viewer/SceneHelpers"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { surfaceMaterial } from "../../components/viewer/surfaceMaterial"
import { rad, wallLength, type Ambient, type MaterialPref } from "../../core/model"
import type { ItemGeometry } from "./ambientData"
import { ambientBox } from "./planGeom"

/**
 * Vista 3D de l'ambient (m): terra i parets amb els materials de simulació i cada moble o bloc
 * amb les seves peces de debò i les textures del visor, al seu lloc i girat.
 */
export function Ambient3D({
  ambient,
  geos,
  materials,
  onSceneAccess,
  fitSignal = 0,
  selectedId = null,
  onSelect,
}: {
  /** Element seleccionat (el mateix que al plànol) i clic per seleccionar-ne un. */
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  materials: MaterialPref[]
  /** Per al render per CPU (el mateix `RenderDialog` de l'editor). */
  onSceneAccess?: (get: SceneGetter) => void
  /** Canvia per tornar a encuadrar la càmera. */
  fitSignal?: number
}) {
  const box = ambientBox(ambient, geos) ?? { x0: 0, y0: 0, x1: 5000, y1: 4000 }
  const cx = (box.x0 + box.x1) / 2000, cz = (box.y0 + box.y1) / 2000
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 1000
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 40, position: [cx + span * 0.5, span * 1.1 + 2, cz + span * 1.4 + 2], near: 0.05, far: 500 }}
      gl={{ preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
      }}
      style={{ touchAction: "none" }}
      onPointerMissed={(e) => e.button === 0 && onSelect?.(null)}
    >
      <color attach="background" args={["#e9e6e1"]} />
      <StudioEnvironment intensity={0.55} />
      <hemisphereLight args={["#ffffff", "#b9ad9c", 0.35]} />
      <directionalLight position={[cx + 4, 7, cz + 3]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} shadow-bias={-0.0004} />
      <Room ambient={ambient} geos={geos} materials={materials} box={box} selectedId={selectedId} onSelect={onSelect} />
      {/* Com al visor de l'editor: esmorteïment, botó dret o dos dits per desplaçar, roda per apropar. */}
      <Controls target={[cx, 0.9, cz]} home={[cx + span * 0.5, span * 1.1 + 2, cz + span * 1.4 + 2]} fitSignal={fitSignal} maxDistance={span * 4 + 10} />
      {onSceneAccess && <SceneAccess onAccess={onSceneAccess} />}
    </Canvas>
  )
}

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

function Controls({ target, home, fitSignal, maxDistance }: { target: [number, number, number]; home: [number, number, number]; fitSignal: number; maxDistance: number }) {
  const ref = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    camera.position.set(...home)
    ref.current?.target.set(...target)
    ref.current?.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal])
  return <OrbitControls ref={ref} makeDefault enableDamping dampingFactor={0.12} minDistance={0.3} maxDistance={maxDistance} maxPolarAngle={Math.PI / 2 - 0.02} target={target} />
}

/** Caixa taronja de l'element seleccionat (com el contorn de selecció del visor de l'editor). */
function Selected({ ambient, geos, id }: { ambient: Ambient; geos: Map<string, ItemGeometry | null>; id: string | null }) {
  const it = id ? ambient.items.find((i) => i.id === id) : undefined
  const g = it ? geos.get(it.id) : undefined
  if (!it || !g) return null
  const w = g.w / 1000 + 0.02, h = g.max[1] / 1000 + 0.02, d = g.d / 1000 + 0.02
  return (
    <group position={[it.x / 1000, (it.elevation ?? 0) / 1000 + h / 2 - 0.01, it.y / 1000]} rotation={[0, -rad(it.rot), 0]}>
      <lineSegments raycast={() => null}>
        <edgesGeometry args={[new BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color="#d97706" depthTest={false} transparent opacity={0.95} />
      </lineSegments>
    </group>
  )
}



const shadowsOn = (o: Object3D) =>
  o.traverse((c) => {
    if ((c as Mesh).isMesh) {
      c.castShadow = true
      c.receiveShadow = true
    }
  })

function Room({
  ambient,
  geos,
  materials,
  box,
  selectedId,
  onSelect,
}: {
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  materials: MaterialPref[]
  box: { x0: number; y0: number; x1: number; y1: number }
  selectedId: string | null
  onSelect?: (id: string | null) => void
}) {
  // Terra: la caixa de tot amb un marge.
  const floor = useMemo(() => {
    const m = 600
    const w = box.x1 - box.x0 + 2 * m, d = box.y1 - box.y0 + 2 * m
    const mesh = new Mesh(new PlaneGeometry(w / 1000, d / 1000), surfaceMaterial(materials, ambient.floorMaterial ?? "Parquet de roure", w, d))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set((box.x0 + box.x1) / 2000, 0, (box.y0 + box.y1) / 2000)
    mesh.receiveShadow = true
    mesh.userData.room = "floor"
    return mesh
  }, [box.x0, box.x1, box.y0, box.y1, materials, ambient.floorMaterial])

  const walls = useMemo(() => {
    const g = new Group()
    for (const w of ambient.walls) {
      const L = wallLength(w)
      if (L < 1) continue
      // Una mica més llarga (mig gruix per banda) perquè les cantonades tanquin.
      const len = L + w.thickness
      const mesh = new Mesh(new BoxGeometry(len / 1000, w.height / 1000, w.thickness / 1000), surfaceMaterial(materials, ambient.wallMaterial ?? "Pintura blanca", len, w.height))
      mesh.position.set((w.a[0] + w.b[0]) / 2000, w.height / 2000, (w.a[1] + w.b[1]) / 2000)
      mesh.rotation.y = -Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0])
      mesh.castShadow = true
      mesh.receiveShadow = true
      // Normal cap a fora de l'habitació (per fer-la transparent si tapa la vista).
      const nx = -(w.b[1] - w.a[1]) / L, nz = (w.b[0] - w.a[0]) / L
      const mx = (w.a[0] + w.b[0]) / 2 - (box.x0 + box.x1) / 2, mz = (w.a[1] + w.b[1]) / 2 - (box.y0 + box.y1) / 2
      const out = nx * mx + nz * mz >= 0 ? 1 : -1
      mesh.userData.normal = new Vector3(nx * out, 0, nz * out)
      mesh.userData.room = "wall"
      g.add(mesh)
    }
    return g
  }, [ambient.walls, ambient.wallMaterial, materials, box.x0, box.x1, box.y0, box.y1])

  // Com una casa de nines: les parets entre la càmera i l'habitació es fan gairebé transparents.
  const tmp = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => {
    for (const m of walls.children as Mesh[]) {
      const n = m.userData.normal as Vector3 | undefined
      if (!n) continue
      const facing = tmp.copy(camera.position).sub(m.position).dot(n) > 0
      const mat = m.material as MeshStandardMaterial
      const target = facing ? 0.12 : 1
      if (mat.opacity !== target) {
        mat.transparent = target < 1
        mat.opacity = target
        mat.depthWrite = target === 1
        m.castShadow = target === 1
        mat.needsUpdate = true
      }
    }
  })

  // Mobles i blocs: la seva escena (m) centrada a la petjada, al seu lloc i girada.
  const scenes = useMemo(
    () =>
      ambient.items.flatMap((it) => {
        const g = geos.get(it.id)
        if (!g) return []
        const inner = buildScene([...g.build.panels, ...g.build.extras], it.id, { materials, make: exportablePanel })
        inner.position.set(-(g.min[0] + g.max[0]) / 2000, 0, -(g.min[2] + g.max[2]) / 2000)
        shadowsOn(inner)
        const outer = new Group()
        outer.add(inner)
        outer.position.set(it.x / 1000, (it.elevation ?? 0) / 1000, it.y / 1000)
        outer.rotation.y = -rad(it.rot)
        return [{ id: it.id, obj: outer }]
      }),
    [ambient.items, geos, materials],
  )

  return (
    <>
      <primitive object={floor} />
      <primitive object={walls} />
      {scenes.map((s) => (
        <primitive
          key={s.id}
          object={s.obj}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            // Un clic (no un arrossegament de la càmera) selecciona l'element, com a l'editor.
            if (e.delta > 4) return
            e.stopPropagation()
            onSelect?.(s.id)
          }}
        />
      ))}
      <Selected ambient={ambient} geos={geos} id={selectedId} />
    </>
  )
}
