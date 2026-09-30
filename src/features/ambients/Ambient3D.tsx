import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useRef, type ComponentRef } from "react"
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, NeutralToneMapping, PerspectiveCamera, PlaneGeometry, Vector3, type Object3D } from "three"
import { exportablePanel } from "../../components/viewer/CabinetViewer"
import { buildScene } from "../../components/viewer/exportGlb"
import { SceneAccess, StudioEnvironment } from "../../components/viewer/SceneHelpers"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { surfaceMaterial } from "../../components/viewer/surfaceMaterial"
import { rad, wallLength, wallOpenings, wallSegments, type Ambient, type MaterialPref, type Opening } from "../../core/model"
import type { ItemGeometry } from "./ambientData"
import { ambientBox, eyePose } from "./planGeom"

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
  eyeSignal = 0,
  selectedIds = [],
  onSelect,
  dollhouse = true,
  shadows = true,
}: {
  /** Parets de davant transparents (casa de nines) i ombres. */
  dollhouse?: boolean
  shadows?: boolean
  /** Elements seleccionats (els mateixos que al plànol) i clic per seleccionar-ne un. */
  selectedIds?: string[]
  onSelect?: (id: string | null) => void
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  materials: MaterialPref[]
  /** Per al render per CPU (el mateix `RenderDialog` de l'editor). */
  onSceneAccess?: (get: SceneGetter) => void
  /** Canvia per tornar a encuadrar la càmera. */
  fitSignal?: number
  /** Canvia per entrar a l'habitació (càmera d'interior a l'alçada dels ulls). */
  eyeSignal?: number
}) {
  const box = ambientBox(ambient, geos) ?? { x0: 0, y0: 0, x1: 5000, y1: 4000 }
  const cx = (box.x0 + box.x1) / 2000, cz = (box.y0 + box.y1) / 2000
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 1000
  return (
    <Canvas
      shadows={shadows ? "soft" : false}
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
      <Room ambient={ambient} geos={geos} materials={materials} box={box} selectedIds={selectedIds} onSelect={onSelect} dollhouse={dollhouse} />
      {/* Com al visor de l'editor: esmorteïment, botó dret o dos dits per desplaçar, roda per apropar. */}
      <Controls target={[cx, 0.9, cz]} home={[cx + span * 0.5, span * 1.1 + 2, cz + span * 1.4 + 2]} fitSignal={fitSignal} eye={eyePose(ambient)} eyeSignal={eyeSignal} maxDistance={span * 4 + 10} />
      {onSceneAccess && <SceneAccess onAccess={onSceneAccess} />}
    </Canvas>
  )
}

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

function Controls({ target, home, fitSignal, eye, eyeSignal, maxDistance }: { target: [number, number, number]; home: [number, number, number]; fitSignal: number; eye: ReturnType<typeof eyePose>; eyeSignal: number; maxDistance: number }) {
  const ref = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const pose = (pos: [number, number, number], tgt: [number, number, number], fov: number) => {
    camera.position.set(...pos)
    camera.fov = fov
    camera.updateProjectionMatrix()
    ref.current?.target.set(...tgt)
    ref.current?.update()
  }
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    pose(home, target, 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal])
  // Interior: angular (com les fotos de revista) i des de dins; orbitar hi gira al voltant del punt mirat.
  useEffect(() => {
    if (eyeSignal && eye) pose(eye.pos, eye.target, 55)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eyeSignal])
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

/**
 * Finestra, porta o vidriera dins del forat de la paret (grup de la paret: x al llarg, y amunt,
 * z pel gruix): marc de perfils, travessers i vidre (o la fulla de fusta de la porta).
 */
function addOpening(wg: Group, o: Opening & { u0: number; u1: number }, thickness: number, materials: MaterialPref[]) {
  const W = o.u1 - o.u0
  const f = o.kind === "glazing" ? 40 : 55
  const fd = Math.min(thickness, o.kind === "glazing" ? 60 : 70)
  const frameMat = surfaceMaterial(materials, o.frame ?? (o.kind === "door" ? "Roure massís / xapat" : "Alumini negre"), 200, 200)
  const box = (x0: number, x1: number, y0: number, y1: number, d: number, mat: MeshStandardMaterial, z = 0) => {
    const m = new Mesh(new BoxGeometry((x1 - x0) / 1000, (y1 - y0) / 1000, d / 1000), mat)
    m.position.set((x0 + x1) / 2000, (y0 + y1) / 2000, z / 1000)
    m.castShadow = true
    m.receiveShadow = true
    m.userData.room = "wall"
    wg.add(m)
  }
  const y0 = o.sill, y1 = o.sill + o.h
  // Marc
  box(o.u0, o.u0 + f, y0, y1, fd, frameMat)
  box(o.u1 - f, o.u1, y0, y1, fd, frameMat)
  box(o.u0 + f, o.u1 - f, y1 - f, y1, fd, frameMat)
  if (o.kind !== "door" || o.sill > 0) box(o.u0 + f, o.u1 - f, y0, y0 + f, fd, frameMat)
  // Ampit de pedra a les finestres.
  if (o.kind === "window" && o.sill > 0) box(o.u0 - 40, o.u1 + 40, y0 - 30, y0, thickness + 60, surfaceMaterial(materials, "Pedra calcària", W, 100))
  if (o.kind === "door") {
    box(o.u0 + f, o.u1 - f, y0, y1 - f, 40, surfaceMaterial(materials, o.frame ?? "Roure massís / xapat", W, o.h))
    return
  }
  const panes = o.panes ?? Math.max(1, Math.round(W / (o.kind === "glazing" ? 1200 : 900)))
  for (let i = 1; i < panes; i++) {
    const x = o.u0 + (W * i) / panes
    box(x - f / 2, x + f / 2, y0 + f, y1 - f, fd, frameMat)
  }
  const glass = new MeshStandardMaterial({ color: "#dbe7e8", roughness: 0.03, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false })
  glass.userData.glass = true
  glass.userData.baseOpacity = 0.18
  const m = new Mesh(new BoxGeometry((W - 2 * f) / 1000, (o.h - 2 * f) / 1000, 0.008), glass)
  m.position.set((o.u0 + o.u1) / 2000, (y0 + y1) / 2000, 0)
  m.userData.room = "wall"
  // Per al render: la llum del cel entra per aquí (portal).
  m.userData.portal = true
  wg.add(m)
}

/** Parets que tanquen una habitació (cada extrem compartit) i altes: les terrasses i els patis no tenen sostre. */
function closedRoom(walls: Ambient["walls"]): boolean {
  if (walls.length < 3 || walls.some((w) => w.height < 2000)) return false
  const key = (p: readonly number[]) => `${Math.round(p[0]!)},${Math.round(p[1]!)}`
  const n = new Map<string, number>()
  for (const w of walls) for (const p of [w.a, w.b]) n.set(key(p), (n.get(key(p)) ?? 0) + 1)
  return [...n.values()].every((c) => c >= 2)
}

function Room({
  ambient,
  geos,
  materials,
  box,
  selectedIds,
  onSelect,
  dollhouse,
}: {
  dollhouse: boolean
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  materials: MaterialPref[]
  box: { x0: number; y0: number; x1: number; y1: number }
  selectedIds: string[]
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
      const wg = new Group()
      wg.position.set(w.a[0] / 1000, 0, w.a[1] / 1000)
      wg.rotation.y = -Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0])
      const matName = w.material ?? ambient.wallMaterial ?? "Pintura blanca"
      // Trossos massissos (la paret sencera o el que queda al voltant de finestres i portes).
      for (const sg of wallSegments(w)) {
        const len = sg.u1 - sg.u0, hh = sg.v1 - sg.v0
        if (len < 1 || hh < 1) continue
        const mesh = new Mesh(new BoxGeometry(len / 1000, hh / 1000, w.thickness / 1000), surfaceMaterial(materials, matName, len, hh))
        mesh.position.set((sg.u0 + sg.u1) / 2000, (sg.v0 + sg.v1) / 2000, 0)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.room = "wall"
        wg.add(mesh)
      }
      for (const o of wallOpenings(w)) addOpening(wg, o, w.thickness, materials)
      // Normal cap a fora de l'habitació (per fer-la transparent si tapa la vista).
      const nx = -(w.b[1] - w.a[1]) / L, nz = (w.b[0] - w.a[0]) / L
      const mx = (w.a[0] + w.b[0]) / 2 - (box.x0 + box.x1) / 2, mz = (w.a[1] + w.b[1]) / 2 - (box.y0 + box.y1) / 2
      const out = nx * mx + nz * mz >= 0 ? 1 : -1
      wg.userData.normal = new Vector3(nx * out, 0, nz * out)
      wg.userData.center = new Vector3((w.a[0] + w.b[0]) / 2000, w.height / 2000, (w.a[1] + w.b[1]) / 2000)
      g.add(wg)
    }
    return g
  }, [ambient.walls, ambient.wallMaterial, materials, box.x0, box.x1, box.y0, box.y1])

  // Sostre de les habitacions tancades: només quan la càmera és a dins (al visor i al render; des de
  // dalt no es veu). Al render tanca la llum: entra per les finestres, com a les fotos.
  const ceiling = useMemo(() => {
    if (!closedRoom(ambient.walls)) return null
    const xs = ambient.walls.flatMap((w) => [w.a[0], w.b[0]]), ys = ambient.walls.flatMap((w) => [w.a[1], w.b[1]])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const H = Math.min(...ambient.walls.map((w) => w.height))
    const mesh = new Mesh(new BoxGeometry((x1 - x0) / 1000, 0.05, (y1 - y0) / 1000), new MeshStandardMaterial({ color: "#f4f2ee", roughness: 0.9 }))
    mesh.position.set((x0 + x1) / 2000, H / 1000 + 0.025, (y0 + y1) / 2000)
    mesh.visible = false
    mesh.userData.renderOnly = "ceiling"
    return mesh
  }, [ambient.walls])
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.userData.daylight = true
  }, [scene])

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
      {ceiling && <primitive object={ceiling} />}
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
      {selectedIds.map((id) => (
        <Selected key={id} ambient={ambient} geos={geos} id={id} />
      ))}
    </>
  )
}
