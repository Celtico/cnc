import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber"
import { useEffect, useRef } from "react"
import type { OrbitControlsImpl } from "../../components/viewer/orbitControls"
import { Color, NeutralToneMapping, type PerspectiveCamera } from "three"
import { BoxFrame } from "../../components/viewer/BoxFrame"
import { MoveGizmo } from "../../components/viewer/MoveGizmo"
import { usePanModifierCursor, useViewerCursor } from "../../components/viewer/cursor"
import { releaseModelGpu } from "../../components/viewer/models3d"
import { SceneAccess, StudioEnvironment, TextureRefresh } from "../../components/viewer/SceneHelpers"
import { hoverKey, hoverTarget, useHoverLink } from "../../components/hoverLink"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { rad, sameCameraPose, type Ambient, type CameraPose, type MaterialPref } from "../../core/model"
import type { ItemGeometry } from "./ambientData"
import { ambientBox, eyePose } from "./planGeom"
import { useLatest } from "../../lib/useLatest"
import { useDollhouse } from "./room3d/useDollhouse"
import { useGizmoDrag } from "./room3d/useGizmoDrag"
import { useItemScenes } from "./room3d/useItemScenes"
import { useRoomShell } from "./room3d/useRoomShell"

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
  // Element sota el ratolí, aquí o a la seva fila de l'arbre (`useHoverLink`; es llegeix fora del Canvas).
  const link = useHoverLink()
  const hovered = hoverTarget(link.hover)
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
      <Room ambient={ambient} geos={geos} materials={materials} box={box} selectedIds={selectedIds} hoverId={hovered?.kind === "item" ? hovered.id : null} onHover={(id, on) => (on ? link.enter(hoverKey("item", id)) : link.leave(hoverKey("item", id)))} onSelect={onSelect} onPick={onPick} onChange={onChange} snap={snap} dollhouse={dollhouse} showCeiling={showCeiling} showRoof={showRoof} cameraLocked={cameraLocked} />
      {/* Com al visor de l'editor: esmorteïment, botó dret o dos dits per desplaçar, roda per apropar. */}
      <Controls target={[cx, 0.9, cz]} home={[cx + span * 0.5, span * 1.1 + 2, cz + span * 1.4 + 2]} fitSignal={fitSignal} eye={eyePose(ambient)} eyeSignal={eyeSignal} maxDistance={span * 4 + 10} onPoseChange={onPoseChange} initialCamera={initialCamera} onCameraChange={onCameraChange} locked={cameraLocked} goto={cameraGoto} />
      {onSceneAccess && <SceneAccess onAccess={onSceneAccess} />}
    </Canvas>
  )
}

/** Fons del render dels ambients (el clar de sempre; el visor és transparent). */
const RENDER_BG = "#e9e6e1"


function Controls({ target, home, fitSignal, eye, eyeSignal, maxDistance, onPoseChange, initialCamera, onCameraChange, locked, goto }: { target: [number, number, number]; home: [number, number, number]; fitSignal: number; eye: ReturnType<typeof eyePose>; eyeSignal: number; maxDistance: number; onPoseChange?: (pose: "home" | "eye" | null) => void; initialCamera?: CameraPose; onCameraChange?: (camera: CameraPose) => void; locked: boolean; goto?: { pose: CameraPose; n: number } }) {
  const ref = useRef<OrbitControlsImpl>(null)
  usePanModifierCursor()
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

function Room({
  ambient,
  geos,
  materials,
  box,
  selectedIds,
  hoverId,
  onHover,
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
  hoverId: string | null
  onHover: (id: string, on: boolean) => void
  onSelect?: (id: string | null) => void
}) {
  const { floor, walls, roof, ceiling } = useRoomShell({ ambient, geos, materials, box, showCeiling, showRoof })
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.userData.daylight = true
    scene.userData.renderBackground = new Color(RENDER_BG)
  }, [scene])
  // Com s'obre el Render d'aquest ambient (escenes del catàleg): el diàleg ho llegeix en obrir-se.
  useEffect(() => {
    scene.userData.renderPreset = ambient.render
  }, [scene, ambient.render])

  useDollhouse({ ambient, walls, roof, ceiling, dollhouse })
  const scenes = useItemScenes({ items: ambient.items, geos, materials })
  // Moure un element només en canvia la posició (el mateix objecte): cal demanar el fotograma.
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [scenes, dollhouse, invalidate])

  // Mà sobre els elements que es poden triar (es neteja sola en desmuntar-se).
  const cursor = useViewerCursor()
  const { gizmoAt, activeAxis, startAxis, moveAxis, endAxis } = useGizmoDrag({ ambient, geos, selectedIds, onChange, snap, cameraLocked })

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
            if (e.pointerType === "mouse") onHover(s.id, true)
          }}
          onPointerOut={() => {
            cursor.hover(null)
            onHover(s.id, false)
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
