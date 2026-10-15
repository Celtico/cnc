import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react"
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, NeutralToneMapping, PerspectiveCamera, Plane, PlaneGeometry, Vector3, type Object3D } from "three"
import { BoxFrame } from "../../components/viewer/BoxFrame"
import { MoveGizmo } from "../../components/viewer/MoveGizmo"
import { useViewerCursor } from "../../components/viewer/cursor"
import type { Axis } from "../../components/viewer/pixelScale"
import { exportablePanel } from "../../components/viewer/exportablePanel"
import { buildScene } from "../../components/viewer/exportGlb"
import { onModelsLoaded, releaseModelGpu } from "../../components/viewer/models3d"
import { SceneAccess, StudioEnvironment, TextureRefresh } from "../../components/viewer/SceneHelpers"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { surfaceMaterial } from "../../components/viewer/surfaceMaterial"
import { disposeTree } from "../../components/viewer/textures"
import { expandWalls, footprintBox, rad, roofBox, sameCameraPose, snapToWalls, wallLength, wallOpenings, wallSegments, type Ambient, type CameraPose, type MaterialPref, type Opening } from "../../core/model"
import type { ItemGeometry } from "./ambientData"
import { ambientBox, eyePose, snapGrid } from "./planGeom"
import { curvedWallPieces } from "./curvedWall"
import { roofGroup } from "./roof3d"
import { genericLegsGroup } from "../../components/viewer/genericLegs"
import { useLatest } from "../../lib/useLatest"

/**
 * Vista 3D de l'ambient (m): terra i parets amb els materials de simulació i cada moble o bloc
 * amb les seves peces de debò i les textures del visor, al seu lloc i girat.
 */
/** Terra de fora per defecte (`Ambient.outsideFloorMaterial`). */
const OUTSIDE_FLOOR = "Gespa"

export function Ambient3D({
  ambient,
  geos,
  materials,
  onSceneAccess,
  fitSignal = 0,
  eyeSignal = 0,
  selectedIds = [],
  onSelect,
  onPick,
  onChange,
  snap = true,
  dollhouse = true,
  shadows = true,
  ceiling: showCeiling = true,
  roof: showRoof = true,
  onPoseChange,
  initialCamera,
  onCameraChange,
  cameraLocked = false,
  cameraGoto,
}: {
  /** Càmera desada: en obrir el 3D s'hi torna en lloc d'enquadrar (només es llegeix en muntar-se). */
  initialCamera?: CameraPose
  /** Càmera bloquejada: el ratolí i els dits no la mouen (per no perdre l'enquadrament del render); els botons sí. */
  cameraLocked?: boolean
  /** Anar a una càmera (canvia `n` cada vegada): «Càmera d'abans». */
  cameraGoto?: { pose: CameraPose; n: number }
  /** La càmera s'ha quedat quieta (1 s després de moure-la, d'«Enquadrar» o d'«Interior»): per desar-la. */
  onCameraChange?: (camera: CameraPose) => void
  /** La càmera és a la posició d'«Enquadrar» (`home`) o d'«Interior» (`eye`), o l'usuari l'ha moguda (`null`): els
      botons d'Opcions de vista surten marcats. */
  onPoseChange?: (pose: "home" | "eye" | null) => void
  /** Sostre a les habitacions tancades (es veu quan la càmera és a dins). */
  ceiling?: boolean
  /** La teulada (`Ambient.roof`), si n'hi ha. */
  roof?: boolean
  /** Parets de davant transparents (casa de nines) i ombres. */
  dollhouse?: boolean
  shadows?: boolean
  /** Elements seleccionats (els mateixos que al plànol) i clic per seleccionar-ne un. */
  selectedIds?: string[]
  onSelect?: (id: string | null) => void
  /**
   * Moure elements amb les fletxes del gizmo (X i Z pel terra, Y en alçada; el cos no s'arrossega): `onPick` tria l'element tocat
   * (o el seu grup, com Figma); `onChange` rep l'ambient (commit en deixar-lo anar).
   */
  onPick?: (id: string) => string[]
  onChange?: (a: Ambient, commit: boolean) => void
  /** Imant a les parets (el de les opcions de vista; Alt: sense). */
  snap?: boolean
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  materials: MaterialPref[]
  /** Per al render per CPU (el mateix `RenderDialog` de l'editor). */
  onSceneAccess?: (get: SceneGetter) => void
  /** Canvia per tornar a enquadrar la càmera. */
  fitSignal?: number
  /** Canvia per entrar a l'habitació (càmera d'interior a l'alçada dels ulls). */
  eyeSignal?: number
}) {
  const box = ambientBox(ambient, geos) ?? { x0: 0, y0: 0, x1: 5000, y1: 4000 }
  const cx = (box.x0 + box.x1) / 2000, cz = (box.y0 + box.y1) / 2000
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 1000
  // En tancar el 3D, els models compartits (memòria de `models3d`) s'alliberen de la GPU: si no, guardarien el
  // renderitzador mort a través dels seus escoltadors.
  useEffect(() => () => releaseModelGpu(), [])
  return (
    // Només pinta quan alguna cosa canvia (controls, elements, textures que arriben): a l'iPhone, un 3D quiet no gasta.
    <Canvas
      frameloop="demand"
      // PCF amb el radi de sempre (el «soft» de three ja ho és; PCFSoftShadowMap s'ha retirat i avisava).
      shadows={shadows ? "percentage" : false}
      dpr={[1, 2]}
      camera={{ fov: 40, position: [cx + span * 0.5, span * 1.1 + 2, cz + span * 1.4 + 2], near: 0.05, far: 500 }}
      gl={{ preserveDrawingBuffer: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
      }}
      style={{ touchAction: "none" }}
      onPointerMissed={(e) => e.button === 0 && onSelect?.(null)}
    >
      {/* Sense fons: el visor és transparent i es veu el color de l'app (fosc o clar segons el tema). El render per
          CPU fa servir el clar de sempre (`renderBackground`), així no canvia. */}
      <StudioEnvironment intensity={0.55} />
      <TextureRefresh />
      <hemisphereLight args={["#ffffff", "#b9ad9c", 0.35]} />
      <directionalLight position={[cx + 4, 7, cz + 3]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} shadow-bias={-0.0004} />
      <Room ambient={ambient} geos={geos} materials={materials} box={box} selectedIds={selectedIds} onSelect={onSelect} onPick={onPick} onChange={onChange} snap={snap} dollhouse={dollhouse} showCeiling={showCeiling} showRoof={showRoof} cameraLocked={cameraLocked} />
      {/* Com al visor de l'editor: esmorteïment, botó dret o dos dits per desplaçar, roda per apropar. */}
      <Controls target={[cx, 0.9, cz]} home={[cx + span * 0.5, span * 1.1 + 2, cz + span * 1.4 + 2]} fitSignal={fitSignal} eye={eyePose(ambient)} eyeSignal={eyeSignal} maxDistance={span * 4 + 10} onPoseChange={onPoseChange} initialCamera={initialCamera} onCameraChange={onCameraChange} locked={cameraLocked} goto={cameraGoto} />
      {onSceneAccess && <SceneAccess onAccess={onSceneAccess} />}
    </Canvas>
  )
}

/** Fons del render dels ambients (el clar de sempre; el visor és transparent). */
const RENDER_BG = "#e9e6e1"

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

function Controls({ target, home, fitSignal, eye, eyeSignal, maxDistance, onPoseChange, initialCamera, onCameraChange, locked, goto }: { target: [number, number, number]; home: [number, number, number]; fitSignal: number; eye: ReturnType<typeof eyePose>; eyeSignal: number; maxDistance: number; onPoseChange?: (pose: "home" | "eye" | null) => void; initialCamera?: CameraPose; onCameraChange?: (camera: CameraPose) => void; locked: boolean; goto?: { pose: CameraPose; n: number } }) {
  const ref = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  const pose = (pos: [number, number, number], tgt: [number, number, number], fov: number) => {
    camera.position.set(...pos)
    camera.fov = fov
    camera.updateProjectionMatrix()
    ref.current?.target.set(...tgt)
    ref.current?.update()
    invalidate()
  }
  // Desar la càmera 1 s després que es quedi quieta (l'esmorteïment encara la mou una mica en deixar-la anar).
  const reportRef = useLatest(onCameraChange)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Botó marcat ara (es desa amb la càmera).
  const mark = useRef<"home" | "eye" | null>(null)
  const setMark = (m: "home" | "eye" | null) => {
    mark.current = m
    onPoseChange?.(m)
  }
  // Lectura pendent: en desmuntar el 3D o amagar la pàgina es fa de seguida (si no, es perdria).
  const pending = useRef<(() => void) | null>(null)
  const scheduleReport = () => {
    clearTimeout(timer.current)
    // El punt mirat és un Vector3 que els controls actualitzen: es guarda ara (en desmuntar, la ref ja és buida).
    const t = ref.current?.target
    const run = () => {
      clearTimeout(timer.current)
      pending.current = null
      const tt = t ?? ref.current?.target
      if (!tt) return
      const r = (v: number) => Math.round(v * 10000) / 10000
      const c: CameraPose = { position: [r(camera.position.x), r(camera.position.y), r(camera.position.z)], target: [r(tt.x), r(tt.y), r(tt.z)], fov: camera.fov }
      if (mark.current) c.pose = mark.current
      if ([...c.position, ...c.target].every(Number.isFinite)) reportRef.current?.(c)
    }
    pending.current = run
    timer.current = setTimeout(run, 1000)
  }
  useEffect(() => {
    const flush = () => pending.current?.()
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [])
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      // El punt on es mira només es posa en obrir (i amb «Enquadrar»): si seguís la caixa de l'ambient,
      // moure un element cap a fora mouria la càmera.
      first.current = false
      // Càmera desada: es torna on es va deixar (marcada si és la d'«Enquadrar» o la d'«Interior»).
      if (initialCamera) {
        const fov = initialCamera.fov ?? 40
        pose(initialCamera.position, initialCamera.target, fov)
        // Marcada només si és la mateixa d'ara (si l'habitació ha canviat, ja no ho és). L'alçada de l'«Interior»
        // no compta: OrbitControls l'aixeca una mica (angle màxim).
        const [px, , pz] = initialCamera.position
        const isHome = sameCameraPose(initialCamera, { position: home, target, fov: 40 })
        const isEye = initialCamera.pose === "eye" && !!eye && sameCameraPose({ ...initialCamera, position: [px, eye.pos[1], pz] }, { position: eye.pos, target: eye.target, fov: 55 })
        setMark(isHome ? "home" : isEye ? "eye" : null)
        return
      }
      ref.current?.target.set(...target)
      ref.current?.update()
      invalidate()
      setMark("home")
      return
    }
    pose(home, target, 40)
    setMark("home")
    scheduleReport()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- s'enquadra en obrir i amb «Enquadrar», no amb cada canvi de l'ambient
  }, [fitSignal])
  // Interior: angular (com les fotos de revista) i des de dins; orbitar hi gira al voltant del punt mirat.
  useEffect(() => {
    if (eyeSignal && eye) {
      pose(eye.pos, eye.target, 55)
      setMark("eye")
      scheduleReport()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- es va a l'«Interior» només quan es demana
  }, [eyeSignal])
  // «Càmera d'abans»: hi torna (i es desa com la d'ara).
  useEffect(() => {
    if (!goto) return
    pose(goto.pose.position, goto.pose.target, goto.pose.fov ?? 40)
    setMark(goto.pose.pose ?? null)
    scheduleReport()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- es va a la vista desada només quan arriba una petició nova (`goto`)
  }, [goto?.n])
  // Orbitar, desplaçar o fer zoom (l'usuari) treu la marca dels botons.
  return (
    <OrbitControls
      ref={ref}
      enabled={!locked}
      onStart={() => {
        setMark(null)
        clearTimeout(timer.current)
      }}
      onEnd={scheduleReport}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minDistance={0.3}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  )
}


/** Contorn de l'element seleccionat (`strong`) o del que és sota el ratolí, com a l'editor. */
function ItemFrame({ ambient, geos, id, strong }: { ambient: Ambient; geos: Map<string, ItemGeometry | null>; id: string | null; strong?: boolean }) {
  const it = id ? ambient.items.find((i) => i.id === id) : undefined
  const g = it ? geos.get(it.id) : undefined
  if (!it || !g) return null
  const w = g.w / 1000 + 0.02, h = g.max[1] / 1000 + 0.02, d = g.d / 1000 + 0.02
  return (
    <group position={[it.x / 1000, (it.elevation ?? 0) / 1000 + h / 2 - 0.01, it.y / 1000]} rotation={[0, -rad(it.rot), 0]}>
      <BoxFrame w={w} h={h} d={d} strong={strong} />
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
  onPick,
  onChange,
  snap,
  cameraLocked,
  dollhouse,
  showCeiling,
  showRoof,
}: {
  onPick?: (id: string) => string[]
  onChange?: (a: Ambient, commit: boolean) => void
  snap: boolean
  cameraLocked: boolean
  dollhouse: boolean
  showCeiling: boolean
  showRoof: boolean
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  materials: MaterialPref[]
  box: { x0: number; y0: number; x1: number; y1: number }
  selectedIds: string[]
  onSelect?: (id: string | null) => void
}) {
  // Terra: la caixa de tot amb un marge, arrodonida al metre (arrossegar un element no el refà a cada pas).
  const fx0 = Math.floor((box.x0 - 600) / 1000) * 1000, fx1 = Math.ceil((box.x1 + 600) / 1000) * 1000
  const fy0 = Math.floor((box.y0 - 600) / 1000) * 1000, fy1 = Math.ceil((box.y1 + 600) / 1000) * 1000
  // Les parets només depenen de les parets (el centre de l'habitació per saber cap on és «fora»).
  const wx = ambient.walls.flatMap((w) => [w.a[0], w.b[0]]), wy = ambient.walls.flatMap((w) => [w.a[1], w.b[1]])
  // Amb una o dues parets soltes, el centre de tot (amb els elements) diu millor on és l'habitació.
  const closed = ambient.walls.length >= 3
  const rcx = closed ? (Math.min(...wx) + Math.max(...wx)) / 2 : (box.x0 + box.x1) / 2
  const rcy = closed ? (Math.min(...wy) + Math.max(...wy)) / 2 : (box.y0 + box.y1) / 2
  // Habitació tancada amb coses fora (arbres davant d'una finestra): el terra de dins, fins a l'eix de les parets (on
  // hi ha el vidre de les finestres: el parquet no surt a fora; sota la paret no es veu),
  // i fora el «Terra de fora» (`outsideFloorMaterial`, gespa si no se n'ha triat), una mica més avall.
  const rx0 = closed ? Math.min(...wx) : fx0, rx1 = closed ? Math.max(...wx) : fx1
  const ry0 = closed ? Math.min(...wy) : fy0, ry1 = closed ? Math.max(...wy) : fy1
  // «Fora»: algun element que surt més de 300 mm de les parets (no un que hi és arrambat).
  const outside = closed && ambient.items.some((it) => {
    const g = geos.get(it.id)
    if (!g) return false
    const b = footprintBox(it.x, it.y, g.w, g.d, it.rot)
    return b.x0 < rx0 - 300 || b.x1 > rx1 + 300 || b.y0 < ry0 - 300 || b.y1 > ry1 + 300
  })
  const floor = useMemo(() => {
    const [x0, x1, y0, y1] = outside ? [rx0, rx1, ry0, ry1] : [fx0, fx1, fy0, fy1]
    const w = x1 - x0, d = y1 - y0
    const mesh = new Mesh(new PlaneGeometry(w / 1000, d / 1000), surfaceMaterial(materials, ambient.floorMaterial ?? "Parquet de roure", w, d))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set((x0 + x1) / 2000, 0, (y0 + y1) / 2000)
    mesh.receiveShadow = true
    mesh.userData.room = "floor"
    if (!outside) return mesh
    const g = new Group()
    const gw = fx1 - fx0 + 4000, gd = fy1 - fy0 + 4000
    const lawn = new Mesh(new PlaneGeometry(gw / 1000, gd / 1000), surfaceMaterial(materials, ambient.outsideFloorMaterial ?? OUTSIDE_FLOOR, gw, gd))
    lawn.rotation.x = -Math.PI / 2
    lawn.position.set((fx0 + fx1) / 2000, -0.004, (fy0 + fy1) / 2000)
    lawn.receiveShadow = true
    lawn.userData.room = "floor"
    g.add(mesh, lawn)
    return g
  }, [fx0, fx1, fy0, fy1, rx0, rx1, ry0, ry1, outside, materials, ambient.floorMaterial, ambient.outsideFloorMaterial])
  useEffect(() => () => disposeTree(floor), [floor])

  const walls = useMemo(() => {
    const g = new Group()
    for (const w of ambient.walls) {
      // Corba: una làmina llisa que segueix la Bézier (`curvedWallPieces`), en trossos per a la casa de nines.
      if (w.curve) {
        for (const piece of curvedWallPieces(w, w.material ?? ambient.wallMaterial ?? "Pintura blanca", materials, [rcx, rcy])) g.add(piece)
        continue
      }
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
      const mx = (w.a[0] + w.b[0]) / 2 - rcx, mz = (w.a[1] + w.b[1]) / 2 - rcy
      const out = nx * mx + nz * mz >= 0 ? 1 : -1
      wg.userData.normal = new Vector3(nx * out, 0, nz * out)
      wg.userData.center = new Vector3((w.a[0] + w.b[0]) / 2000, w.height / 2000, (w.a[1] + w.b[1]) / 2000)
      g.add(wg)
    }
    return g
  }, [ambient.walls, ambient.wallMaterial, materials, rcx, rcy])

  // Sostre de les habitacions tancades: només quan la càmera és a dins (al visor i al render; des de
  // dalt no es veu). Al render tanca la llum: entra per les finestres, com a les fotos.
  // La teulada (el sostre de dins es queda, amb el seu material, just sota la teulada).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- només les parts de l'ambient que canvien la teulada
  const roof = useMemo(() => (showRoof ? roofGroup(ambient, materials) : null), [showRoof, ambient.roof, ambient.walls, ambient.wallMaterial, materials])
  useEffect(() => () => (roof ? disposeTree(roof) : undefined), [roof])
  const ceiling = useMemo(() => {
    if (!showCeiling || !closedRoom(ambient.walls)) return null
    const xs = ambient.walls.flatMap((w) => [w.a[0], w.b[0]]), ys = ambient.walls.flatMap((w) => [w.a[1], w.b[1]])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const H = Math.min(...ambient.walls.map((w) => w.height))
    const mesh = new Mesh(new BoxGeometry((x1 - x0) / 1000, 0.05, (y1 - y0) / 1000), surfaceMaterial(materials, ambient.ceilingMaterial ?? "Pintura blanca", x1 - x0, y1 - y0))
    // Amb teulada, el sostre queda just sota la paret més baixa (la cara de sota de la teulada plana és a l'alçada de les
    // parets: sense, es trepitjarien); sense, just a sobre, com sempre.
    const under = showRoof && !!ambient.roof
    mesh.position.set((x0 + x1) / 2000, H / 1000 + (under ? -0.026 : 0.025), (y0 + y1) / 2000)
    // Al visor la llum ve de dalt i la cara de sota quedaria fosca: una mica de llum pròpia (el
    // render per CPU no la fa servir, hi arriba la de les finestres).
    const mat = mesh.material as MeshStandardMaterial
    mat.emissive.copy(mat.color)
    mat.emissiveMap = mat.map
    mat.emissiveIntensity = 0.55
    mesh.visible = false
    mesh.userData.renderOnly = "ceiling"
    return mesh
  }, [ambient.walls, ambient.ceilingMaterial, ambient.roof, materials, showCeiling, showRoof])
  useEffect(() => () => disposeTree(walls), [walls])
  useEffect(() => () => (ceiling ? disposeTree(ceiling) : undefined), [ceiling])
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.userData.daylight = true
    scene.userData.renderBackground = new Color(RENDER_BG)
  }, [scene])
  // Com s'obre el Render d'aquest ambient (escenes del catàleg): el diàleg ho llegeix en obrir-se.
  useEffect(() => {
    scene.userData.renderPreset = ambient.render
  }, [scene, ambient.render])

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

  // Mobles i blocs: la seva escena (m) centrada a la petjada, al seu lloc i girada. Les peces d'un element
  // només es refan si en canvia la geometria o els materials: moure'l (arrossegar-lo) només en canvia la
  // posició. Les que ja no hi són s'alliberen (memòria gràfica: a l'iPhone compta).
  const built = useRef(new Map<string, { geo: ItemGeometry; materials: MaterialPref[]; ver: number; obj: Group }>())
  // Models 3D (plantes…): es carreguen a part; quan n'arriba un, es refan els elements que en porten.
  const [modelsVer, setModelsVer] = useState(0)
  useEffect(() => onModelsLoaded(() => setModelsVer((v) => v + 1)), [])
  const scenes = useMemo(() => {
    const prev = built.current
    const next = new Map<string, { geo: ItemGeometry; materials: MaterialPref[]; ver: number; obj: Group }>()
    const out: { id: string; obj: Group }[] = []
    for (const it of ambient.items) {
      const g = geos.get(it.id)
      if (!g) continue
      let entry = prev.get(it.id)
      const ver = g.build.models.length ? modelsVer : 0
      if (!entry || entry.geo !== g || entry.materials !== materials || entry.ver !== ver) {
        const inner = buildScene([...g.build.panels, ...g.build.extras], it.id, { materials, make: exportablePanel, hardware: true }, g.build.models)
        const legs = genericLegsGroup(g.comp, g.build)
        if (legs) inner.add(legs)
        inner.position.set(-(g.min[0] + g.max[0]) / 2000, 0, -(g.min[2] + g.max[2]) / 2000)
        shadowsOn(inner)
        const outer = new Group()
        outer.add(inner)
        entry = { geo: g, materials, ver, obj: outer }
      }
      entry.obj.position.set(it.x / 1000, (it.elevation ?? 0) / 1000, it.y / 1000)
      entry.obj.rotation.y = -rad(it.rot)
      next.set(it.id, entry)
      out.push({ id: it.id, obj: entry.obj })
    }
    for (const [id, e] of prev) if (next.get(id)?.obj !== e.obj) disposeTree(e.obj)
    built.current = next
    return out
  }, [ambient.items, geos, materials, modelsVer])
  useEffect(() => () => {
    for (const e of built.current.values()) disposeTree(e.obj)
    built.current = new Map()
  }, [])
  // Moure un element només en canvia la posició (el mateix objecte): cal demanar el fotograma.
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [scenes, dollhouse, invalidate])

  // Moure amb el gizmo: cada fletxa en la seva direcció (X o Z del plànol, i la verda en alçada, «Del terra») sobre un pla que conté l'eix i mira a la
  // càmera; la resta, com al plànol (quadrícula, imant a les parets per a un sol element, Alt sense imant, un sol pas
  // de desfer en deixar-lo anar).
  const { camera, controls } = useThree()
  const [hoverId, setHoverId] = useState<string | null>(null)
  // Mà sobre els elements que es poden triar (es neteja sola en desmuntar-se).
  const cursor = useViewerCursor()
  const sel = useMemo(() => ambient.items.filter((it) => selectedIds.includes(it.id) && geos.get(it.id)), [ambient.items, selectedIds, geos])
  // Al centre de la selecció (també en alçada: un moble penjat el porta a la seva altura).
  const gizmoAt = useMemo((): [number, number, number] | null => {
    if (!sel.length) return null
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = 0, bot = Infinity
    for (const it of sel) {
      const g = geos.get(it.id)!
      const c = Math.abs(Math.cos(rad(it.rot))), sn = Math.abs(Math.sin(rad(it.rot)))
      const hw = (g.w * c + g.d * sn) / 2, hd = (g.w * sn + g.d * c) / 2
      x0 = Math.min(x0, it.x - hw); x1 = Math.max(x1, it.x + hw)
      z0 = Math.min(z0, it.y - hd); z1 = Math.max(z1, it.y + hd)
      top = Math.max(top, (it.elevation ?? 0) + g.max[1])
      bot = Math.min(bot, it.elevation ?? 0)
    }
    return [(x0 + x1) / 2000, (bot + top) / 2000, (z0 + z1) / 2000]
  }, [sel, geos])
  const drag = useRef<{ axis: Axis; plane: Plane; start: Vector3; from: Map<string, readonly [number, number, number]>; moved: boolean; last: Ambient; sx: number; sy: number } | null>(null)
  /** Planta (rectangle del plànol, mm) d'un element girat. */
  const footprint = (it: Ambient["items"][number]) => {
    const g = geos.get(it.id)
    if (!g) return null
    const c = Math.abs(Math.cos(rad(it.rot))), sn = Math.abs(Math.sin(rad(it.rot)))
    const hw = (g.w * c + g.d * sn) / 2, hd = (g.w * sn + g.d * c) / 2
    return { x0: it.x - hw, x1: it.x + hw, y0: it.y - hd, y1: it.y + hd, h: g.max[1] }
  }
  const [activeAxis, setActiveAxis] = useState<Axis | null>(null)
  const orbit = controls as unknown as { enabled: boolean } | null
  const startAxis = (a: Axis, e: ThreeEvent<PointerEvent>) => {
    if (!onChange || e.button !== 0) return
    e.stopPropagation()
    const dir = a === "x" ? new Vector3(1, 0, 0) : a === "y" ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)
    const toCam = camera.getWorldDirection(new Vector3()).negate()
    const n = dir.clone().cross(toCam).cross(dir)
    if (n.lengthSq() < 1e-6) return
    drag.current = {
      axis: a,
      plane: new Plane().setFromNormalAndCoplanarPoint(n.normalize(), e.point),
      start: e.point.clone(),
      from: new Map(sel.map((it) => [it.id, [it.x, it.y, it.elevation ?? 0] as const])),
      moved: false,
      last: ambient,
      sx: e.clientX,
      sy: e.clientY,
    }
    ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    if (orbit) orbit.enabled = false
    setActiveAxis(a)
  }
  const moveAxis = (e: ThreeEvent<PointerEvent>) => {
    const st = drag.current
    if (!st || !onChange) return
    e.stopPropagation()
    st.moved = st.moved || Math.hypot(e.clientX - st.sx, e.clientY - st.sy) > 3
    if (!st.moved) return
    const p = e.ray.intersectPlane(st.plane, new Vector3())
    if (!p) return
    if (st.axis === "y") {
      // Alçada («Del terra»): mai sota el terra; amb l'imant, a sobre d'un altre element que tingui a sota (una taula,
      // un moble) o al terra, si hi és a prop.
      let oe = snapGrid((p.y - st.start.y) * 1000)
      if (st.from.size === 1 && snap && !e.altKey) {
        const [id, f] = [...st.from][0]!
        const me = ambient.items.find((x) => x.id === id)
        const fp = me && footprint(me)
        if (fp) {
          const tops = [0]
          for (const o of ambient.items) {
            if (o.id === id) continue
            const q = footprint(o)
            if (q && q.x0 < fp.x1 && q.x1 > fp.x0 && q.y0 < fp.y1 && q.y1 > fp.y0) tops.push((o.elevation ?? 0) + q.h)
          }
          const want = f[2] + oe
          const near = tops.reduce((b, t) => (Math.abs(t - want) < Math.abs(b - want) ? t : b), Infinity)
          if (Math.abs(near - want) <= 60) oe = Math.round(near - f[2])
        }
      }
      st.last = { ...ambient, items: ambient.items.map((it) => {
        const f = st.from.get(it.id)
        return f ? { ...it, elevation: Math.max(0, f[2] + oe) } : it
      }) }
      onChange(st.last, false)
      return
    }
    let ox = st.axis === "x" ? snapGrid((p.x - st.start.x) * 1000) : 0
    let oy = st.axis === "z" ? snapGrid((p.z - st.start.z) * 1000) : 0
    if (st.from.size === 1 && snap && !e.altKey) {
      const [id, f] = [...st.from][0]!
      const it = ambient.items.find((x) => x.id === id)
      const geo = geos.get(id)
      if (it && geo) {
        const sn = snapToWalls(f[0] + ox, f[1] + oy, geo.w, geo.d, it.rot, expandWalls(ambient.walls), 60)
        // Només en la direcció de la fletxa: l'altra no es mou.
        if (st.axis === "x") ox = Math.round(sn.x - f[0])
        else oy = Math.round(sn.y - f[1])
      }
    }
    st.last = { ...ambient, items: ambient.items.map((it) => {
      const f = st.from.get(it.id)
      return f ? { ...it, x: f[0] + ox, y: f[1] + oy } : it
    }) }
    onChange(st.last, false)
  }
  const endAxis = (e: ThreeEvent<PointerEvent>) => {
    const st = drag.current
    if (!st) return
    drag.current = null
    ;(e.target as Element | null)?.releasePointerCapture?.(e.pointerId)
    if (orbit) orbit.enabled = !cameraLocked
    setActiveAxis(null)
    if (st.moved && onChange) onChange(st.last, true)
  }

  return (
    <>
      <primitive object={floor} />
      <primitive object={walls} />
      {ceiling && <primitive object={ceiling} />}
      {roof && <primitive object={roof} />}
      {scenes.map((s) => (
        <primitive
          key={s.id}
          object={s.obj}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            cursor.hover(onPick || onSelect ? "pointer" : null)
            if (e.pointerType === "mouse") setHoverId(s.id)
          }}
          onPointerOut={() => {
            cursor.hover(null)
            setHoverId((h) => (h === s.id ? null : h))
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            // Un clic (no un arrossegament de la càmera) selecciona l'element (o el seu grup), com a l'editor.
            if (e.delta > 4) return
            e.stopPropagation()
            if (onPick) onPick(s.id)
            else onSelect?.(s.id)
          }}
        />
      ))}
      {selectedIds.map((id) => (
        <ItemFrame key={id} ambient={ambient} geos={geos} id={id} strong />
      ))}
      {hoverId && !selectedIds.includes(hoverId) && !activeAxis && <ItemFrame ambient={ambient} geos={geos} id={hoverId} />}
      {gizmoAt && onChange && (
        <group position={gizmoAt}>
          <MoveGizmo axes={["x", "y", "z"]} active={activeAxis} onStart={startAxis} onMove={moveAxis} onEnd={endAxis} />
        </group>
      )}
    </>
  )
}

