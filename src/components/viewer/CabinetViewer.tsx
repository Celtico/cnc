import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { QUALITY, type RenderQuality } from "./renderQuality"
import { PresentationRoom } from "./PresentationRoom"
import { ModuleLegs, PanelHardware } from "./Hardware"
import type { SceneGetter } from "./render/RenderDialog"
import { SceneAccess, StudioEnvironment } from "./SceneHelpers"
import { LIGHT_SPEC, usePresentationScene } from "./presentationScene"
import { Billboard, ContactShadows, Edges, Grid, Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei"
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react"
import { BoxGeometry, NeutralToneMapping, DoubleSide, type BufferGeometry, ExtrudeGeometry, Group, Matrix4, MeshStandardMaterial, Plane, Shape, Vector3, type Object3D, type Texture } from "three"

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>
import { AXIS_INDEX, SECTION_AXES, flatten, partSize, partsBox, sampleProfile, toNodes, type FreePart, type Hole, type MaterialPref, type Panel, type RefObject } from "../../core/model"
import { useColorModeValue } from "../ui/color-mode"
import { movingGroups, transformAt, type MovingGroup } from "./opening"
import { ROLE_COLOR } from "./roleColors"
import { isShaped, mitreGeometry, shapedGeometry } from "./cutoutGeometry"
import { RAW_EDGE_COLOR, TILE_MM, patternTexture, photoTexture, resolveEdgeFinish, resolveFinish, woodTexture, type FinishSpec } from "./textures"

/** Color de selecció (el mateix taronja que els botons + del 3D). */
const SELECT_COLOR = "#b57a37"

/** Escala mm → m per a l'escena. */
const S = 0.001
/** Fletxa de cada direcció a l'etiqueta d'arrossegar un objecte (com les icones de Posició). */
const AXIS_ARROW = { x: "↔", y: "↕", z: "⤢" } as const
/** Separació en vista explosionada (mm). */
const EXPLODE_MM = 160


export type ViewName = "3d" | "front" | "back" | "left" | "right" | "top"
export const VIEW_LABELS: Record<ViewName, string> = { "3d": "3D", front: "Davant", back: "Darrere", left: "Esquerra", right: "Dreta", top: "Dalt" }

/** Mòdul de la composició, per ressaltar-lo, seleccionar-lo i afegir-ne al costat. */
export interface ViewerModule {
  id: string
  /** Número de mòdul (1..n), el mateix que `Panel.module`. */
  index: number
  /** Cantonada baix-esquerra-darrere en mm (coordenades de la composició). */
  x: number
  y: number
  width: number
  height: number
  depth: number
  /** Penjat a la paret: també es pot moure amunt i avall. */
  wall?: boolean
  /** Separació de la paret en mm (mòduls «Al terra»). */
  z?: number
  /** «Al terra» lliure: es mou pel terra (de costat i endavant/enrere). */
  free?: boolean
  /** Potes regulables: alçada (mm) i fondària de la caixa, per dibuixar-les. */
  legs?: { height: number; depth: number }
}

/** Llum d'un compartiment (mm, coordenades de la composició), per acotar-la a la vista de davant. */
export interface ZoneLight {
  /** Mòdul al qual pertany (`ViewerModule.index`). */
  module?: number
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface CabinetViewerProps {
  panels: Panel[]
  /** Mides exteriors del moble (o de tota la composició) en mm, per centrar la càmera. */
  size: { width: number; height: number; depth: number }
  exploded: boolean
  showHoles?: boolean
  /** Mòduls de la composició: el seleccionat es ressalta i té botons + als costats. */
  modules?: ViewerModule[]
  selectedModuleId?: string | null
  /** Clic a una peça d'un mòdul; `at` = punt tocat en mm de la composició. */
  onSelectModule?: (id: string, at?: [number, number, number]) => void
  onAddModule?: (side: "left" | "right") => void
  /** Objectes fantasma (translúcids). */
  ghosts?: RefObject[]
  /** Vista: 3D en perspectiva o ortogràfica estàndard. */
  view?: ViewName
  /** Obertura de portes i calaixos, 0..1. */
  opening?: number
  /** Si hi és, només s'obren aquests grups (ids de `movingGroups`). */
  openOnly?: Set<string> | null
  /** Pintar per material (amb veta) o per tipus de peça. */
  materialMode?: "material" | "role"
  /** Materials de les preferències, per resoldre els acabats. */
  materials?: MaterialPref[]
  /** Llums dels compartiments, acotades a la vista de davant. */
  lights?: ZoneLight[]
  /** Rep la funció de captura (PNG a 2×, fons net). */
  onCapture?: (capture: () => Promise<Blob>) => void
  /** Qualitat del render (resolució i ombres). */
  quality?: RenderQuality
  /** Rep una funció que dona l'escena i la càmera actuals (per al render per CPU). */
  onSceneAccess?: (get: SceneGetter) => void
  /** Ferratges visuals (frontisses, tiradors, potes). */
  hardware?: boolean
  /** Objecte de referència seleccionat i clic sobre un objecte al 3D. */
  selectedRefId?: string | null
  onSelectRef?: (id: string) => void
  /** Arrossegar el mòdul seleccionat (o tot el moble, `all`) amb la nansa: desplaçament en mm. */
  onMoveModule?: (id: string, dx: number, dy: number, all: boolean, dz: number) => void
  /** Arrossegar l'objecte seleccionat al 3D: posició nova (mm) en deixar-lo anar. */
  onMoveRef?: (id: string, pos: { x: number; y: number; z: number }) => void
  /** Peces lliures: clic a la peça la selecciona; la seleccionada porta el gizmo per moure-la. */
  parts?: FreePart[]
  selectedPartId?: string | null
  onSelectPart?: (id: string) => void
  onMovePart?: (id: string, pos: { x: number; y: number; z: number }) => void
  /** Grup de peces lliures seleccionat: caixa del grup amb el gizmo; es mou tot junt (delta en mm). */
  selectedGroup?: string | null
  onMoveGroup?: (group: string, dx: number, dy: number, dz: number) => void
  /** Objectes que xoquen amb alguna peça: es pinten de vermell. */
  collidingRefIds?: Set<string>
  /** Compartiment seleccionat (mm, coordenades de la composició): contorn taronja. */
  highlightZone?: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; veil?: boolean } | null
  /** Clic a l'espai buit (sense arrossegar): treure la selecció. */
  onDeselect?: () => void
  /** Canviar-lo torna a encuadrar la càmera (la resta de canvis no la mouen). */
  fitKey?: number
  /** Avisa si la càmera és a l'encuadrament automàtic (true) o l'usuari l'ha moguda / el moble ha canviat de mida (false). */
  onFramedChange?: (framed: boolean) => void
}

export function CabinetViewer({
  panels,
  size,
  exploded,
  showHoles = true,
  modules,
  selectedModuleId,
  onSelectModule,
  onAddModule,
  ghosts,
  view = "3d",
  opening = 0,
  openOnly = null,
  materialMode = "material",
  materials = [],
  lights = [],
  onCapture,
  quality = "fast",
  hardware = true,
  onSceneAccess,
  onDeselect,
  selectedRefId,
  onSelectRef,
  onMoveRef,
  onMoveModule,
  parts,
  selectedPartId,
  onSelectPart,
  onMovePart,
  selectedGroup,
  onMoveGroup,
  collidingRefIds,
  highlightZone,
  fitKey = 0,
  onFramedChange,
}: CabinetViewerProps) {
  // Per distingir un clic a l'espai buit d'un gir de càmera (arrossegar).
  const downAt = useRef<[number, number] | null>(null)
  const q = QUALITY[quality]
  const [scene] = usePresentationScene()
  const light = LIGHT_SPEC[scene.light]
  const bg = useColorModeValue("#f4f1ea", "#1b1a17")
  const gridCell = useColorModeValue("#d8d2c4", "#33302a")
  const gridSection = useColorModeValue("#b9b1a0", "#4a463d")
  const dimColor = useColorModeValue("#3b2f1f", "#e8dcc6")
  const selected = modules?.find((m) => m.id === selectedModuleId)
  const selectedIndex = selected?.index
  const moduleIdOf = (p: Panel): string | undefined => modules?.find((m) => m.index === p.module)?.id
  const groups = useMemo(() => movingGroups(panels), [panels])
  const groupOf = useMemo(() => {
    const m = new Map<string, MovingGroup>()
    for (const g of groups) for (const id of g.panelIds) m.set(id, g)
    return m
  }, [groups])
  const gridRef = useRef<Object3D>(null)
  // Mòdul (o moble sencer) que s'està arrossegant amb la nansa: desplaçament en viu.
  const [moduleDrag, setModuleDrag] = useState<{ index: number; dx: number; dy: number; dz: number; all: boolean } | null>(null)
  // Arestes on s'enganxen els objectes en arrossegar-los: mòduls, altres objectes, terra i paret.
  const snapTargets = useMemo((): SnapTargets => {
    const t: SnapTargets = { x: [0, size.width], y: [0, size.height], z: [0, size.depth] }
    for (const m of modules ?? []) {
      t.x.push(m.x, m.x + m.width)
      t.y.push(m.y, m.y + m.height)
      t.z.push(m.depth)
    }
    return t
  }, [modules, size.width, size.height, size.depth])
  const ortho = view !== "3d"
  // Caixa de cada peça lliure com a «objecte» (per reutilitzar l'arrossegament i el gizmo).
  const partBoxes = useMemo((): RefObject[] => (parts ?? []).map((p) => {
    const s = partSize(p)
    return { id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, w: s[0], h: s[1], d: s[2] }
  }), [parts])
  const selectedPartBox = partBoxes.find((b) => b.id === selectedPartId)
  const groupBox = useMemo((): RefObject | null => {
    const members = (parts ?? []).filter((p) => p.group && p.group === selectedGroup)
    if (!members.length) return null
    const b = partsBox(members)
    return { id: `group:${selectedGroup}`, name: selectedGroup!, x: b.min[0], y: b.min[1], z: b.min[2], w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], d: b.max[2] - b.min[2] }
  }, [parts, selectedGroup])

  return (
    // Canviar la qualitat recrea el renderitzador: les ombres no es poden activar en calent.
    <Canvas
      key={quality}
      shadows={q.shadows ? "soft" : false}
      dpr={q.dpr}
      style={{ touchAction: "none" }}
      gl={{ preserveDrawingBuffer: true, alpha: true }}
      // Com model-viewer: to «neutral» (colors fidels, sense cremar els blancs).
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
      }}
      onPointerDown={(e) => {
        downAt.current = [e.clientX, e.clientY]
      }}
      onPointerMissed={(e) => {
        const d = downAt.current
        if (onDeselect && d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 5) onDeselect()
      }}
    >
      {/* Les vistes ortogràfiques són plànols: sempre fons de dibuix, també a Presentació. */}
      <color attach="background" args={[q.guides || ortho ? bg : scene.wall]} />
      {/* Llum d'entorn (IBL) d'un estudi procedural, com model-viewer: reflexos i ombrejat suau. */}
      <StudioEnvironment intensity={q.guides ? 0.6 : 0.5} />
      <hemisphereLight intensity={(q.guides ? 0.55 : light.ambient) * 0.45} groundColor="#8a7a60" />
      {!q.guides && !ortho && <PresentationRoom backZ={-size.depth * S * 0.5} scene={scene} />}
      {/* bias i normalBias eviten les ratlles (shadow acne) de les cares que s'ombregen a si mateixes. */}
      <directionalLight
        key={q.shadowMap}
        position={[2.5, 4, 3]}
        color={q.guides ? "#ffffff" : light.key}
        intensity={q.guides ? 1.4 : light.keyIntensity}
        castShadow={q.shadows}
        shadow-mapSize={q.shadowMap}
        shadow-bias={-0.0004}
        shadow-normalBias={0.015}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />

      <group position={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}>
        {panels.map((p) => {
          const g = groupOf.get(p.id)
          const active = !!g && (!openOnly || openOnly.has(g.id))
          const t = active ? opening : 0
          const tr = g ? transformAt(g.motion, t) : null
          const shifted = moduleDrag && (moduleDrag.all || p.module === moduleDrag.index)
          return (
            <group key={p.id} position={shifted ? [moduleDrag.dx * S, moduleDrag.dy * S, moduleDrag.dz * S] : [0, 0, 0]}>
            <MovingPanel transform={tr}>
              <PanelMesh
                panel={p}
                exploded={exploded}
                showHoles={showHoles}
                dimmed={q.guides && selectedIndex !== undefined && p.module === selectedIndex}
                edges={q.guides}
                materialMode={materialMode}
                materials={materials}
                hardware={hardware}
                onClick={p.id.startsWith("part:") ? (onSelectPart ? () => onSelectPart(p.id.slice(5)) : undefined) : onSelectModule ? (pt) => {
                  const id = moduleIdOf(p)
                  // Punt clicat en mm de la composició (el grup està centrat a l'escena).
                  if (id) onSelectModule(id, [pt.x / S + size.width / 2, pt.y / S, pt.z / S + size.depth / 2])
                } : undefined}
              />
            </MovingPanel>
            </group>
          )
        })}
        {/* Els que tallen només es veuen seleccionats: el 3D queda net i es veu el forat. */}
        {ghosts?.filter((g) => g.effect !== "cut" || g.id === selectedRefId).map((g) => (
          <RefGhost
            key={g.id}
            g={g}
            selected={g.id === selectedRefId}
            hit={collidingRefIds?.has(g.id) ?? false}
            guides={q.guides}
            view={view}
            offset={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}
            targets={snapTargets}
            others={ghosts}
            onSelect={onSelectRef}
            onMove={onMoveRef}
          />
        ))}
        {/* Peça lliura seleccionada: caixa taronja amb el gizmo (com un objecte). */}
        {selectedPartBox && (
          <RefGhost
            key={`part-${selectedPartBox.id}`}
            g={selectedPartBox}
            selected
            hit={false}
            guides={q.guides}
            view={view}
            offset={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}
            targets={snapTargets}
            others={[...partBoxes, ...(ghosts ?? [])]}
            onSelect={onSelectPart}
            onMove={onMovePart}
            outline
          />
        )}
        {groupBox && (
          <RefGhost
            key={groupBox.id}
            g={groupBox}
            selected
            hit={false}
            guides={q.guides}
            view={view}
            offset={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}
            targets={snapTargets}
            others={[...partBoxes.filter((b) => !(parts ?? []).some((p) => p.id === b.id && p.group === selectedGroup)), ...(ghosts ?? [])]}
            onMove={onMoveGroup ? (_, pos) => onMoveGroup(selectedGroup!, pos.x - groupBox.x, pos.y - groupBox.y, pos.z - groupBox.z) : undefined}
            outline
          />
        )}
        {hardware && modules?.map((m) => m.legs && !(moduleDrag && (moduleDrag.all || moduleDrag.index === m.index)) && <ModuleLegs key={`legs-${m.id}`} x={m.x} z={m.z ?? 0} width={m.width} depth={m.legs.depth} height={m.legs.height} />)}
        {highlightZone && <ZoneHighlight box={highlightZone} />}
        {selectedIndex !== undefined && q.guides && <CableMarks panels={panels.filter((p) => p.module === selectedIndex)} />}
        {selected && onMoveModule && view !== "top" && (
          <MoveHandle
            m={selected}
            others={[...(modules ?? []).filter((o) => o.id !== selected.id).flatMap((o) => [o.x, o.x + o.width]), ...(ghosts ?? []).flatMap((g) => [g.x, g.x + g.w])]}
            onDrag={setModuleDrag}
            onDrop={(dx, dy, dz, all) => {
              setModuleDrag(null)
              if (dx || dy || dz) onMoveModule(selected.id, dx, dy, all, dz)
            }}
          />
        )}
        {selected && onAddModule && !ortho && q.guides && (
          <>
            <AddButton x={selected.x - 120} y={selected.y + selected.height / 2} z={(selected.z ?? 0) + selected.depth / 2} side="left" onClick={() => onAddModule("left")} />
            <AddButton x={selected.x + selected.width + 120} y={selected.y + selected.height / 2} z={(selected.z ?? 0) + selected.depth / 2} side="right" onClick={() => onAddModule("right")} />
          </>
        )}
        {ortho && (
          <Dimensions
            view={view}
            size={size}
            modules={modules ?? []}
            lights={selectedIndex === undefined ? [] : lights.filter((l) => l.module === undefined || l.module === selectedIndex)}
            color={dimColor}
            labelBg={bg}
          />
        )}
      </group>

      <group ref={gridRef} visible={q.guides}>
        <Grid position={[0, -0.001, 0]} args={[10, 10]} cellSize={0.1} sectionSize={0.5} cellColor={gridCell} sectionColor={gridSection} fadeDistance={6} infiniteGrid />
      </group>
      {q.contactResolution > 0 && (
        <ContactShadows
          key={q.contactResolution}
          position={[0, 0.0005, 0]}
          opacity={0.35}
          scale={Math.max(size.width, size.depth) * S * 2.2}
          blur={q.contactBlur}
          far={size.height * S + 0.5}
          resolution={q.contactResolution}
        />
      )}
      <CameraRig size={size} view={view} fitKey={fitKey} onFramedChange={onFramedChange} />
      {onCapture && <Capture onCapture={onCapture} gridRef={gridRef} />}
      {onSceneAccess && <SceneAccess onAccess={onSceneAccess} />}
    </Canvas>
  )
}

/** Aplica el moviment d'obertura (gir sobre el pivot o desplaçament) a una peça. */
function MovingPanel({ transform, children }: { transform: ReturnType<typeof transformAt> | null; children: React.ReactNode }) {
  const outer = useRef<Group>(null)
  const target = useRef(transform)
  useEffect(() => {
    target.current = transform
  }, [transform])
  useFrame((_, dt) => {
    const g = outer.current
    if (!g) return
    const tr = target.current
    const k = Math.min(1, dt * 8)
    const rx = tr?.rotation[0] ?? 0
    const ry = tr?.rotation[1] ?? 0
    g.rotation.x += (rx - g.rotation.x) * k
    g.rotation.y += (ry - g.rotation.y) * k
    const tx = (tr?.translation[0] ?? 0) * S
    const ty = (tr?.translation[1] ?? 0) * S
    const tz = (tr?.translation[2] ?? 0) * S
    const px = (tr?.pivot[0] ?? 0) * S + tx
    const py = (tr?.pivot[1] ?? 0) * S + ty
    const pz = (tr?.pivot[2] ?? 0) * S + tz
    g.position.x += (px - g.position.x) * k
    g.position.y += (py - g.position.y) * k
    g.position.z += (pz - g.position.z) * k
  })
  const pivot = transform?.pivot ?? [0, 0, 0]
  return (
    <group ref={outer} position={[pivot[0] * S, pivot[1] * S, pivot[2] * S]}>
      <group position={[-pivot[0] * S, -pivot[1] * S, -pivot[2] * S]}>{children}</group>
    </group>
  )
}

const VIEW_DIR: Record<ViewName, [number, number, number]> = {
  "3d": [0.72, 0.45, 0.95],
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0.0001],
}

/**
 * Enquadra el moble sencer: perspectiva 3/4 a la vista 3D, càmera ortogràfica a les
 * vistes estàndard (zoom perquè hi càpiga tot), amb transició suau.
 */
/**
 * Càmera: s'encuadra en muntar-se, en canviar de vista, en redimensionar el visor i quan
 * canvia `fitKey`. Editar el moble (mides, mòduls, objectes) no la mou: es queda on l'has deixat.
 */
function CameraRig({ size, view, fitKey, onFramedChange }: { size: CabinetViewerProps["size"]; view: ViewName; fitKey: number; onFramedChange?: (framed: boolean) => void }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size: viewport } = useThree()
  const w = size.width * S
  const h = size.height * S
  const d = size.depth * S
  const targetY = h * 0.5
  const aspect = viewport.width / Math.max(viewport.height, 1)
  const goal = useRef<{ pos: Vector3; zoom: number } | null>(null)
  const ortho = view !== "3d"
  // Encuadrat = la càmera és on l'ha deixat l'últim encuadrament i el moble té la mateixa mida.
  const fittedSize = useRef("")
  const framedRef = useRef(true)
  const setFramed = (v: boolean) => {
    if (framedRef.current === v) return
    framedRef.current = v
    onFramedChange?.(v)
  }
  useEffect(() => {
    if (fittedSize.current && fittedSize.current !== `${size.width}x${size.height}x${size.depth}`) setFramed(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, size.depth])

  useEffect(() => {
    const radius = 0.5 * Math.sqrt(w * w + h * h + d * d)
    const dir = VIEW_DIR[view]
    const len = Math.hypot(dir[0], dir[1], dir[2])
    let dist: number
    let zoom = 1
    if ("fov" in camera && !ortho) {
      const vHalf = ((camera.fov as number) * Math.PI) / 360
      const hHalf = Math.atan(Math.tan(vHalf) * aspect)
      dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.08
    } else {
      dist = radius * 4 + 1
      // Extensió visible segons la vista, amb marge per a les cotes.
      const [ew, eh] = view === "top" ? [w, d] : view === "left" || view === "right" ? [d, h] : [w, h]
      // Marge per a les cotes (fins a 2 línies a cada costat) i per a les barres del visor
      // (pestanyes a dalt i vistes a baix, ~56 px cadascuna), perquè no tapin cap cota.
      zoom = Math.min((viewport.width - 40) / (ew + 0.5), (viewport.height - 120) / (eh + 0.5))
    }
    const pos = new Vector3((dir[0] / len) * dist, targetY + (dir[1] / len) * dist, (dir[2] / len) * dist)
    goal.current = { pos, zoom }
    fittedSize.current = `${size.width}x${size.height}x${size.depth}`
    setFramed(true)
    controls.current?.target.set(0, targetY, 0)
    controls.current?.update()
    // Les mides es llegeixen però no disparen el reencuadrament.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, view, ortho, viewport.width, viewport.height, fitKey])

  useFrame((_, dt) => {
    const g = goal.current
    if (!g) return
    const k = Math.min(1, dt * 6)
    camera.position.lerp(g.pos, k)
    if ("isOrthographicCamera" in camera && camera.isOrthographicCamera) {
      camera.zoom += (g.zoom - camera.zoom) * k
      camera.updateProjectionMatrix()
    }
    controls.current?.update()
    if (camera.position.distanceTo(g.pos) < 0.002 && (!("isOrthographicCamera" in camera) || Math.abs(camera.zoom - g.zoom) < 0.5)) goal.current = null
  })

  return (
    <>
      {ortho ? <OrthographicCamera makeDefault near={-50} far={100} position={[0, targetY, 5]} zoom={80} /> : <PerspectiveCamera makeDefault fov={38} near={0.01} far={100} position={[1.4, 1.1, 1.9]} />}
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={0.3} maxDistance={12} maxPolarAngle={Math.PI * 0.55} enableRotate={!ortho} onStart={() => {
          goal.current = null
          setFramed(false)
        }} />
    </>
  )
}

/**
 * Captura la vista actual en PNG, tal com es veu: mateix fons, llum, to i antialiàsing
 * (es renderitza al mateix canvas a resolució alta), sense la graella i amb les cotes.
 */
function Capture({ onCapture, gridRef }: { onCapture: (fn: () => Promise<Blob>) => void; gridRef: React.RefObject<Object3D | null> }) {
  const { gl, scene, camera, size } = useThree()
  useEffect(() => {
    onCapture(async () => {
      const ratio = Math.max(2, gl.getPixelRatio())
      const prevRatio = gl.getPixelRatio()
      const grid = gridRef.current
      const gridVisible = grid?.visible ?? true
      if (grid) grid.visible = false
      gl.setPixelRatio(ratio)
      gl.setSize(size.width, size.height, false)
      gl.render(scene, camera)
      // Còpia síncrona abans que el bucle de r3f torni a pintar a la resolució normal.
      const canvas = document.createElement("canvas")
      canvas.width = gl.domElement.width
      canvas.height = gl.domElement.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(gl.domElement, 0, 0)
      gl.setPixelRatio(prevRatio)
      gl.setSize(size.width, size.height, false)
      if (grid) grid.visible = gridVisible
      gl.render(scene, camera)
      drawLabels(ctx, gl.domElement, canvas.width / size.width)
      return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No s'ha pogut generar el PNG"))), "image/png"))
    })
  }, [onCapture, gl, scene, camera, size, gridRef])
  return null
}

/** Pinta al PNG les etiquetes HTML de les cotes (són DOM, no surten al WebGL). */
function drawLabels(ctx: CanvasRenderingContext2D, glCanvas: HTMLCanvasElement, k: number) {
  const host = glCanvas.parentElement?.parentElement
  if (!host) return
  const origin = glCanvas.getBoundingClientRect()
  for (const el of host.querySelectorAll<HTMLElement>("[data-dim-label]")) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.right < origin.left || r.left > origin.right || r.bottom < origin.top || r.top > origin.bottom) continue
    const cs = getComputedStyle(el)
    const x = (r.left - origin.left) * k
    const y = (r.top - origin.top) * k
    const w = r.width * k
    const h = r.height * k
    ctx.fillStyle = cs.backgroundColor
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 4 * k)
    ctx.fill()
    ctx.fillStyle = cs.color
    ctx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(el.textContent ?? "", x + w / 2, y + h / 2)
  }
}

/**
 * Perfil 2D extrudit en la direcció de l'objecte, centrat a la seva caixa (metres). El perfil
 * és en (u, v) del pla de la secció (`SECTION_AXES`); l'extrusió va per l'eix de la direcció.
 */
function profileGeometry(g: RefObject): ExtrudeGeometry {
  const axis = g.axis ?? "z"
  const [u, v] = SECTION_AXES[axis]
  const a = AXIS_INDEX[axis]
  const size = [g.w, g.h, g.d]
  const su = size[u]!, sv = size[v]!, len = size[a]!
  const shape = new Shape()
  const pts = sampleProfile(toNodes(g.profile!))
  shape.moveTo((pts[0]![0] - su / 2) * S, (pts[0]![1] - sv / 2) * S)
  for (const [pu, pv] of pts.slice(1)) shape.lineTo((pu - su / 2) * S, (pv - sv / 2) * S)
  shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: len * S, bevelEnabled: false })
  geo.translate(0, 0, (-len / 2) * S)
  const e = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]
  geo.applyMatrix4(new Matrix4().makeBasis(e[u]!, e[v]!, e[a]!))
  geo.computeVertexNormals()
  return geo
}

interface SnapTargets {
  x: number[]
  y: number[]
  z: number[]
}

/** Distància (mm) a la qual una aresta de l'objecte s'enganxa a una aresta de referència. */
const SNAP_MM = 15

/** Posició (mm, arrodonida a 1) i si s'ha enganxat: prova les dues arestes de l'objecte. */
function snapAxis(pos: number, size: number, targets: number[], free: boolean): { v: number; snapped: boolean } {
  if (free) return { v: Math.round(pos), snapped: false }
  let best: number | null = null
  for (const t of targets) {
    for (const edge of [pos, pos + size]) {
      const delta = t - edge
      if (Math.abs(delta) <= SNAP_MM && (best === null || Math.abs(delta) < Math.abs(best))) best = delta
    }
  }
  return best === null ? { v: Math.round(pos), snapped: false } : { v: Math.round(pos + best), snapped: true }
}

type Axis = "x" | "y" | "z"

/**
 * Objecte de referència (translúcid). Seleccionat, s'arrossega: per defecte en el pla de la
 * paret (X i Y); amb Maj o a la vista de dalt, pel terra (X i Z); a les vistes laterals, Z i
 * Y. S'enganxa a les arestes dels mòduls i dels altres objectes (Alt: sense imant).
 */
function RefGhost({
  g,
  selected,
  hit,
  guides,
  view,
  offset,
  targets,
  others,
  onSelect,
  onMove,
  outline = false,
}: {
  /** Només el contorn (peça lliure: la peça de debò ja es veu a sota). */
  outline?: boolean
  g: RefObject
  selected: boolean
  hit: boolean
  guides: boolean
  view: ViewName
  offset: [number, number, number]
  targets: SnapTargets
  /** Tots els objectes: les arestes dels altres també enganxen. */
  others: RefObject[]
  onSelect?: (id: string) => void
  onMove?: (id: string, pos: { x: number; y: number; z: number }) => void
}) {
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null
  const [drag, setDrag] = useState<{ x: number; y: number; z: number; axes: Axis[]; snapped: Axis[] } | null>(null)
  const latest = useRef(drag)
  latest.current = drag
  const state = useRef<{ plane: Plane; grab: Vector3; axes: Axis[]; start: [number, number]; moved: boolean } | null>(null)
  const snap = useMemo((): SnapTargets => {
    const t = { x: [...targets.x], y: [...targets.y], z: [...targets.z] }
    for (const o of others) {
      if (o.id === g.id) continue
      t.x.push(o.x, o.x + o.w)
      t.y.push(o.y, o.y + o.h)
      t.z.push(o.z, o.z + o.d)
    }
    return t
  }, [targets, others, g.id])
  const pos = drag ?? g
  // Obstacle en blau; objecte que talla en violeta; seleccionat en taronja; amb problema en vermell.
  const tint = hit ? "#dc2626" : selected ? SELECT_COLOR : g.effect === "cut" ? "#7c3aed" : "#3b82f6"
  const draggable = selected && !!onMove
  const cyl = g.shape === "cylinder"
  const profileGeo = useMemo(() => (g.shape === "profile" && g.profile && g.profile.length >= 3 ? profileGeometry(g) : null), [g])
  useEffect(() => () => profileGeo?.dispose(), [profileGeo])
  const axis = g.axis ?? "z"
  const len = axis === "x" ? g.w : axis === "y" ? g.h : g.d
  const radius = (axis === "x" ? Math.min(g.h, g.d) : axis === "y" ? Math.min(g.w, g.d) : Math.min(g.w, g.h)) / 2
  const rotation: [number, number, number] = axis === "z" ? [Math.PI / 2, 0, 0] : axis === "x" ? [0, 0, Math.PI / 2] : [0, 0, 0]

  const end = (e: ThreeEvent<PointerEvent>) => {
    const st = state.current
    if (!st) return
    state.current = null
    if (controls) controls.enabled = true
    ;(e.target as Element | null)?.releasePointerCapture?.(e.pointerId)
    const d = latest.current
    if (st.moved && d && onMove) onMove(g.id, { x: d.x, y: d.y, z: d.z })
    setDrag(null)
  }

  const moveEvt = (e: ThreeEvent<PointerEvent>) => {
        const st = state.current
        if (!st) return
        e.stopPropagation()
        if (!st.moved && Math.hypot(e.clientX - st.start[0], e.clientY - st.start[1]) < 3) return
        st.moved = true
        const at = e.ray.intersectPlane(st.plane, new Vector3())
        if (!at) return
        at.sub(st.grab)
        const raw = { x: (at.x - offset[0]) / S, y: (at.y - offset[1]) / S, z: (at.z - offset[2]) / S }
        const next = { x: g.x, y: g.y, z: g.z, axes: st.axes, snapped: [] as Axis[] }
        for (const a of st.axes) {
          const size = a === "x" ? g.w : a === "y" ? g.h : g.d
          const r = snapAxis(raw[a], size, snap[a], e.altKey)
          next[a] = r.v
          if (r.snapped) next.snapped.push(a)
        }
        // No es pot enfonsar al terra.
        next.y = Math.max(0, next.y)
        setDrag(next)
  }
  // Fletxes de moviment (com el gizmo de Blender o Fusion): cada una mou només en la seva
  // direcció. Pla que conté l'eix i mira cap a la càmera.
  const camera = useThree((st) => st.camera)
  const startAxis = (a: Axis, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const dir = a === "x" ? new Vector3(1, 0, 0) : a === "y" ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)
    const toCam = camera.getWorldDirection(new Vector3()).negate()
    const n = dir.clone().cross(toCam).cross(dir)
    if (n.lengthSq() < 1e-6) return
    const corner = new Vector3(g.x * S + offset[0], g.y * S + offset[1], g.z * S + offset[2])
    state.current = { plane: new Plane().setFromNormalAndCoplanarPoint(n.normalize(), e.point), grab: e.point.clone().sub(corner), axes: [a], start: [e.clientX, e.clientY], moved: false }
    ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
  }
  // Direccions que es poden moure (els enganxaments en fixen alguna) i visibles des d'aquesta vista.
  const gizmoAxes = (["x", "y", "z"] as Axis[]).filter(
    (a) => !(a === "y" && g.onFloor) && !(a === "z" && g.onWall) && !(a === "z" && (view === "front" || view === "back")) && !(a === "y" && view === "top") && !(a === "x" && (view === "left" || view === "right")),
  )

  return (
    <group position={[(pos.x + g.w / 2) * S, (pos.y + g.h / 2) * S, (pos.z + g.d / 2) * S]}>
    <mesh
      rotation={cyl ? rotation : [0, 0, 0]}
      renderOrder={g.effect === "cut" ? 8 : 0}
      onClick={onSelect ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onSelect(g.id)
      } : undefined}
      onPointerOver={onSelect ? (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        document.body.style.cursor = draggable ? "move" : "pointer"
      } : undefined}
      onPointerOut={onSelect ? () => {
        if (!state.current) document.body.style.cursor = ""
      } : undefined}
      onPointerDown={draggable ? (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        // Enganxat al terra: llisca pel terra. A la paret: es mou pel pla de la paret.
        const floor = !g.onWall && (g.onFloor || view === "top" || e.shiftKey)
        const side = !g.onWall && !g.onFloor && (view === "left" || view === "right")
        const normal = floor ? new Vector3(0, 1, 0) : side ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
        const fixed: Axis[] = [...(g.onFloor ? (["y"] as Axis[]) : []), ...(g.onWall ? (["z"] as Axis[]) : [])]
        const corner = new Vector3(g.x * S + offset[0], g.y * S + offset[1], g.z * S + offset[2])
        state.current = {
          plane: new Plane().setFromNormalAndCoplanarPoint(normal, e.point),
          grab: e.point.clone().sub(corner),
          axes: (floor ? (["x", "z"] as Axis[]) : side ? (["z", "y"] as Axis[]) : (["x", "y"] as Axis[])).filter((a) => !fixed.includes(a)),
          start: [e.clientX, e.clientY],
          moved: false,
        }
        ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
        if (controls) controls.enabled = false
      } : undefined}
      onPointerMove={draggable ? moveEvt : undefined}
      onPointerUp={draggable ? end : undefined}
      onPointerCancel={draggable ? end : undefined}
    >
      {profileGeo ? <primitive object={profileGeo} attach="geometry" /> : cyl ? <cylinderGeometry args={[radius * S, radius * S, len * S, 40]} /> : <boxGeometry args={[g.w * S, g.h * S, g.d * S]} />}
      {/* Els que tallen solen quedar dins del fons o darrere de les portes: es veuen a través. */}
      <meshStandardMaterial side={DoubleSide} color={tint} transparent opacity={outline ? 0.08 : selected || hit ? 0.38 : g.effect === "cut" ? 0.45 : 0.22} depthWrite={false} depthTest={g.effect !== "cut"} />
      {(guides || selected || hit || g.effect === "cut") && <Edges color={selected ? SELECT_COLOR : tint} threshold={cyl ? 30 : 1} depthTest={g.effect !== "cut"} renderOrder={g.effect === "cut" ? 9 : 0} />}
    </mesh>
      {draggable && <MoveGizmo axes={gizmoAxes} active={drag?.axes.length === 1 ? drag.axes[0]! : null} onStart={startAxis} onMove={moveEvt} onEnd={end} />}
      {drag && (
        <Html position={[0, (g.h / 2) * S, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
          <span
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: "#fff",
              background: SELECT_COLOR,
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              display: "block",
              transform: "translateY(-18px)",
            }}
          >
            {drag.axes.map((a) => `${AXIS_ARROW[a]} ${drag[a]}${drag.snapped.includes(a) ? " ⟂" : ""}`).join(" · ")}
          </span>
        </Html>
      )}
    </group>
  )
}

type P3 = [number, number, number]
interface DimSpec {
  a: P3
  b: P3
  label: string
  /** Punts de l'objecte d'on surten les línies de referència cap a `a` i `b`. */
  from?: [P3, P3]
  /** Cota interior (llum d'un compartiment): etiqueta fosca sobre el material. */
  inner?: boolean
}

/**
 * Cotes de les vistes ortogràfiques, com en un plànol de fusteria:
 *  - exteriors (fora del moble): cadena d'amplades de cada mòdul i total a sota, alçada
 *    total a la dreta; línies de referència i marques a 45° als extrems;
 *  - interiors: llums (amplada × alçada) dels compartiments del mòdul seleccionat, en creu
 *    dins de cada compartiment. Les massa petites per llegir-se s'ometen.
 * Les etiquetes porten fons: es llegeixen sobre qualsevol material i en tots dos temes.
 */
function Dimensions({ view, size, modules, lights, color, labelBg }: { view: ViewName; size: CabinetViewerProps["size"]; modules: ViewerModule[]; lights: ZoneLight[]; color: string; labelBg: string }) {
  // Píxels per mm a la pantalla (zoom de la càmera ortogràfica), per ometre les cotes que
  // no s'hi poden llegir. Es refresca quan el zoom canvia més d'un 8 %.
  const { camera } = useThree()
  const [pxPerMm, setPxPerMm] = useState(() => camera.zoom * S)
  useFrame(() => {
    const v = camera.zoom * S
    if (Math.abs(v - pxPerMm) / pxPerMm > 0.08) setPxPerMm(v)
  })
  const W = size.width
  const H = size.height
  const D = size.depth
  const near = 80 // primera línia de cota
  const far = 170 // segona línia (totals)
  const dims: DimSpec[] = []
  const normal: P3 = VIEW_DIR[view]
  if (view === "front" || view === "back") {
    const z = view === "front" ? D + 1 : -1
    const chain = modules.length > 1
    if (chain)
      for (const m of modules)
        dims.push({ a: [m.x, -near, z], b: [m.x + m.width, -near, z], label: round(m.width), from: [[m.x, 0, z], [m.x + m.width, 0, z]] })
    const yw = chain ? -far : -near
    dims.push({ a: [0, yw, z], b: [W, yw, z], label: round(W), from: [[0, 0, z], [W, 0, z]] })
    dims.push({ a: [W + near, 0, z], b: [W + near, H, z], label: round(H), from: [[W, 0, z], [W, H, z]] })
    if (view === "front")
      for (const l of lights) {
        const cw = l.x1 - l.x0
        const ch = l.y1 - l.y0
        const cx = (l.x0 + l.x1) / 2
        const cy = (l.y0 + l.y1) / 2
        // Mínim en píxels: l'etiqueta ha de cabre al llarg de la cota i el compartiment ha
        // de tenir prou gruix per no tapar-ne els veïns.
        const pw = cw * pxPerMm
        const ph = ch * pxPerMm
        if (pw >= 48 && ph >= 22) dims.push({ a: [l.x0, cy, z + 1], b: [l.x1, cy, z + 1], label: round(cw), inner: true })
        if (ph >= 48 && pw >= 36) dims.push({ a: [cx, l.y0, z + 1], b: [cx, l.y1, z + 1], label: round(ch), inner: true })
      }
  } else if (view === "left" || view === "right") {
    const x = view === "left" ? -1 : W + 1
    dims.push({ a: [x, -near, 0], b: [x, -near, D], label: round(D), from: [[x, 0, 0], [x, 0, D]] })
    const zh = view === "left" ? D + near : -near
    const zf = view === "left" ? D : 0
    dims.push({ a: [x, 0, zh], b: [x, H, zh], label: round(H), from: [[x, 0, zf], [x, H, zf]] })
  } else if (view === "top") {
    dims.push({ a: [0, H + 1, D + near], b: [W, H + 1, D + near], label: round(W), from: [[0, H + 1, D], [W, H + 1, D]] })
    dims.push({ a: [W + near, H + 1, 0], b: [W + near, H + 1, D], label: round(D), from: [[W, H + 1, 0], [W, H + 1, D]] })
  }
  return (
    <>
      {dims.map((dm, i) => (
        <Dim key={i} spec={dm} normal={normal} color={color} labelBg={labelBg} />
      ))}
    </>
  )
}

const round = (v: number): string => String(Math.round(v))

const v3 = (p: P3) => new Vector3(p[0] * S, p[1] * S, p[2] * S)

function Dim({ spec, normal, color, labelBg }: { spec: DimSpec; normal: P3; color: string; labelBg: string }) {
  const pa = v3(spec.a)
  const pb = v3(spec.b)
  const mid = pa.clone().add(pb).multiplyScalar(0.5)
  const dir = pb.clone().sub(pa).normalize()
  // Marca a 45° (convenció de fusteria/arquitectura): diagonal entre la cota i la perpendicular.
  const perp = new Vector3(...normal).normalize().cross(dir)
  const tick = dir.clone().add(perp).normalize().multiplyScalar((spec.inner ? 22 : 35) * S)
  const lineColor = spec.inner ? "#ffffff" : color
  const ext = spec.from?.map((f, i) => {
    const end = i === 0 ? pa : pb
    const start = v3(f)
    // la línia de referència deixa un petit buit a l'objecte i passa una mica la cota
    const d = end.clone().sub(start)
    const len = d.length()
    if (len < 1e-6) return null
    d.normalize()
    return [start.clone().addScaledVector(d, 15 * S), end.clone().addScaledVector(d, 25 * S)] as [Vector3, Vector3]
  })
  return (
    <group>
      {spec.inner && <Line points={[pa, pb]} color="#000000" lineWidth={3} transparent opacity={0.35} />}
      <Line points={[pa, pb]} color={lineColor} lineWidth={1.2} />
      <Line points={[pa.clone().sub(tick), pa.clone().add(tick)]} color={lineColor} lineWidth={1.6} />
      <Line points={[pb.clone().sub(tick), pb.clone().add(tick)]} color={lineColor} lineWidth={1.6} />
      {ext?.map((e, i) => e && <Line key={i} points={e} color={color} lineWidth={0.8} transparent opacity={0.7} />)}
      <Html position={mid} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <span
          data-dim-label
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: spec.inner ? 11 : 12,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: spec.inner ? "#ffffff" : color,
            background: spec.inner ? "rgba(20, 16, 12, 0.72)" : labelBg,
            padding: "1px 5px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            lineHeight: "16px",
            display: "block",
          }}
        >
          {spec.label}
        </span>
      </Html>
    </group>
  )
}

/**
 * Contorn del compartiment seleccionat: arestes taronges que es veuen a través de les
 * portes (sense prova de profunditat) i un vel molt suau a dins.
 */
/**
 * Passacables del mòdul seleccionat: contorn taronja que es veu a través de les portes i
 * dels laterals (sense prova de profunditat), perquè sovint són al fons, amagats.
 */
function CableMarks({ panels }: { panels: Panel[] }) {
  const loops = useMemo(() => {
    const out: Vector3[][] = []
    for (const p of panels) {
      const { origin: o, xAxis: xa, yAxis: ya, zAxis: za } = p.placement
      const z = p.thickness / 2
      const world = (x: number, y: number) =>
        new Vector3((o[0] + x * xa[0] + y * ya[0] + z * za[0]) * S, (o[1] + x * xa[1] + y * ya[1] + z * za[1]) * S, (o[2] + x * xa[2] + y * ya[2] + z * za[2]) * S)
      for (const c of p.cutouts ?? []) {
        if (c.tag !== "cable" && c.tag !== "ref") continue
        if (c.kind === "circle") {
          const r = c.diameter / 2
          out.push(Array.from({ length: 33 }, (_, i) => world(c.x + r * Math.cos((i / 32) * Math.PI * 2), c.y + r * Math.sin((i / 32) * Math.PI * 2))))
        } else if (c.kind === "polygon") {
          const f = flatten(c.points)
          out.push([...f, f[0]!].map(([x, y]) => world(x, y)))
        } else {
          out.push([world(c.x, c.y), world(c.x + c.w, c.y), world(c.x + c.w, c.y + c.h), world(c.x, c.y + c.h), world(c.x, c.y)])
        }
      }
    }
    return out
  }, [panels])
  return (
    <>
      {loops.map((pts, i) => (
        <Line key={i} points={pts} color={SELECT_COLOR} lineWidth={3} depthTest={false} renderOrder={10} />
      ))}
    </>
  )
}

function ZoneHighlight({ box: b }: { box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; veil?: boolean } }) {
  const inset = b.veil === false ? -2 : 3
  const x0 = (b.x0 + inset) * S
  const x1 = (b.x1 - inset) * S
  const y0 = (b.y0 + inset) * S
  const y1 = (b.y1 - inset) * S
  const z0 = b.z0 * S
  const z1 = b.z1 * S
  const c = (x: number, y: number, z: number) => new Vector3(x, y, z)
  const front = [c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1), c(x0, y0, z1)]
  const back = [c(x0, y0, z0), c(x1, y0, z0), c(x1, y1, z0), c(x0, y1, z0), c(x0, y0, z0)]
  const sides: [Vector3, Vector3][] = [
    [c(x0, y0, z0), c(x0, y0, z1)],
    [c(x1, y0, z0), c(x1, y0, z1)],
    [c(x1, y1, z0), c(x1, y1, z1)],
    [c(x0, y1, z0), c(x0, y1, z1)],
  ]
  return (
    <group renderOrder={10}>
      {b.veil !== false && (
      <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} renderOrder={10}>
        <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
        <meshBasicMaterial color={SELECT_COLOR} transparent opacity={0.22} depthWrite={false} depthTest={false} />
      </mesh>
      )}
      <Line points={front} color={SELECT_COLOR} lineWidth={4} depthTest={false} renderOrder={11} />
      <Line points={back} color={SELECT_COLOR} lineWidth={1.5} depthTest={false} transparent opacity={0.6} renderOrder={11} />
      {sides.map((pts, i) => (
        <Line key={i} points={pts} color={SELECT_COLOR} lineWidth={1.5} depthTest={false} transparent opacity={0.6} renderOrder={11} />
      ))}
    </group>
  )
}

/** Botó + ancorat a un punt del 3D, per afegir un mòdul a un costat del seleccionat. */
/** Escala un grup perquè 1 unitat sigui `px` píxels a la pantalla (nanses i botons 3D). */
const AXIS_COLOR: Record<Axis, string> = { x: "#e5484d", y: "#30a46c", z: "#0090ff" }

/**
 * Gizmo de moviment d'un objecte: una fletxa per direcció (vermella de costat, verda amunt,
 * blava endavant), de mida constant a la pantalla i sempre per sobre de tot.
 */
function MoveGizmo({
  axes,
  active,
  onStart,
  onMove,
  onEnd,
}: {
  axes: Axis[]
  active: Axis | null
  onStart: (a: Axis, e: ThreeEvent<PointerEvent>) => void
  onMove: (e: ThreeEvent<PointerEvent>) => void
  onEnd: (e: ThreeEvent<PointerEvent>) => void
}) {
  const scaler = useRef<Group>(null)
  usePixelScale(scaler, 16)
  const [hover, setHover] = useState<Axis | null>(null)
  const rot: Record<Axis, [number, number, number]> = { x: [0, 0, -Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] }
  return (
    <group ref={scaler}>
      {axes.map((a) => {
        const on = hover === a || active === a
        const mat = <meshBasicMaterial color={AXIS_COLOR[a]} transparent opacity={active && active !== a ? 0.25 : on ? 1 : 0.85} depthTest={false} depthWrite={false} />
        return (
          <group
            key={a}
            rotation={rot[a]}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(a)
              document.body.style.cursor = "grab"
            }}
            onPointerOut={() => {
              setHover(null)
              if (!active) document.body.style.cursor = ""
            }}
            onPointerDown={(e) => onStart(a, e)}
            onPointerMove={onMove}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
          >
            {/* Tija i punta; un cilindre invisible més gruixut per agafar-la fàcilment. */}
            <mesh position={[0, 2, 0]} renderOrder={30}>
              <cylinderGeometry args={[on ? 0.14 : 0.1, on ? 0.14 : 0.1, 3, 10]} />
              {mat}
            </mesh>
            <mesh position={[0, 3.9, 0]} renderOrder={30}>
              <coneGeometry args={[on ? 0.5 : 0.4, 1.1, 16]} />
              {mat}
            </mesh>
            <mesh position={[0, 2.5, 0]} visible={false}>
              <cylinderGeometry args={[0.6, 0.6, 4.2, 8]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function usePixelScale(ref: React.RefObject<Group | null>, px: number) {
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

function AddButton({ x, y, z, side, onClick }: { x: number; y: number; z: number; side: "left" | "right"; onClick: () => void }) {
  // Botó 3D (no Html): mida constant a la pantalla, sempre per sobre del moble.
  const scaler = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  usePixelScale(scaler, 15)
  const white = <meshBasicMaterial color="white" depthTest={false} depthWrite={false} transparent />
  return (
    <group position={[x * S, y * S, z * S]}>
      <Billboard>
        <group ref={scaler}>
          <mesh
            renderOrder={20}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(true)
              document.body.style.cursor = "pointer"
            }}
            onPointerOut={() => {
              setHover(false)
              document.body.style.cursor = ""
            }}
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            name={side === "left" ? "Afegir mòdul a l'esquerra" : "Afegir mòdul a la dreta"}
          >
            <circleGeometry args={[1, 40]} />
            <meshBasicMaterial color={hover ? "#98602c" : "#b57a37"} depthTest={false} depthWrite={false} transparent />
          </mesh>
          <mesh position={[0, 0, 0.01]} renderOrder={21}>
            <planeGeometry args={[1, 0.14]} />
            {white}
          </mesh>
          <mesh position={[0, 0, 0.01]} renderOrder={21}>
            <planeGeometry args={[0.14, 1]} />
            {white}
          </mesh>
        </group>
      </Billboard>
    </group>
  )
}

/**
 * Nansa per moure el mòdul seleccionat (o, amb Maj, tot el moble) arrossegant-la: al llarg de
 * la fila i, si és penjat, amunt i avall. S'enganxa a les vores dels altres mòduls i dels
 * objectes (Alt: lliure).
 */
function MoveHandle({
  m,
  others,
  onDrag,
  onDrop,
}: {
  m: ViewerModule
  others: number[]
  onDrag: (d: { index: number; dx: number; dy: number; dz: number; all: boolean } | null) => void
  onDrop: (dx: number, dy: number, dz: number, all: boolean) => void
}) {
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null
  const start = useRef<{ p: Vector3; plane: Plane; all: boolean } | null>(null)
  const latest = useRef<{ dx: number; dy: number; dz: number; all: boolean } | null>(null)
  const [live, setLive] = useState<{ dx: number; dy: number; dz: number; all: boolean } | null>(null)
  const [hover, setHover] = useState(false)
  const pos: [number, number, number] = [(m.x + m.width / 2) * S, (m.y + m.height) * S + 0.08, ((m.z ?? 0) + m.depth) * S]
  // Mida constant a la pantalla (uns 30 px), s'allunyi o s'acosti la càmera.
  const scaler = useRef<Group>(null)
  usePixelScale(scaler, 14)

  const compute = (e: ThreeEvent<PointerEvent>) => {
    const s0 = start.current
    const p = s0 && e.ray.intersectPlane(s0.plane, new Vector3())
    if (!s0 || !p) return null
    let dx = (p.x - s0.p.x) / S
    const dy = m.wall && !s0.all ? Math.round((p.y - s0.p.y) / S) : 0
    // «Al terra»: endavant i enrere, sense passar la paret.
    const dz = m.free && !s0.all ? Math.max(-(m.z ?? 0), Math.round((p.z - s0.p.z) / S)) : 0
    if (!e.altKey) {
      let best: number | null = null
      for (const t of others) for (const edge of [m.x + dx, m.x + m.width + dx]) {
        const d = t - edge
        if (Math.abs(d) <= 15 && (best === null || Math.abs(d) < Math.abs(best))) best = d
      }
      if (best !== null) dx += best
    }
    return { dx: Math.round(dx), dy, dz, all: s0.all }
  }
  const end = (e: ThreeEvent<PointerEvent>) => {
    if (!start.current) return
    start.current = null
    ;(e.target as Element | null)?.releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    const d = latest.current
    latest.current = null
    setLive(null)
    onDrop(d?.dx ?? 0, d?.dy ?? 0, d?.dz ?? 0, d?.all ?? false)
  }
  const sign = (v: number) => `${v > 0 ? "+" : ""}${v}`
  const label = live ? (live.all ? `Tot el moble ${sign(live.dx)} mm` : `${sign(live.dx)} mm${live.dy ? ` · ${sign(live.dy)} mm` : ""}${live.dz ? ` · paret ${(m.z ?? 0) + live.dz} mm` : ""}`) : null

  return (
    <group position={[pos[0] + (live?.dx ?? 0) * S, pos[1] + (live?.dy ?? 0) * S, pos[2] + (live?.dz ?? 0) * S]}>
      <Billboard>
        <group ref={scaler}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            document.body.style.cursor = "grab"
          }}
          onPointerOut={() => {
            setHover(false)
            if (!start.current) document.body.style.cursor = ""
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
            // «Al terra»: arrossega sobre un pla horitzontal (pel terra); la resta, pel pla de la paret.
            const plane = new Plane().setFromNormalAndCoplanarPoint(m.free && !e.shiftKey ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1), e.point)
            start.current = { p: e.point.clone(), plane, all: e.shiftKey }
            if (controls) controls.enabled = false
            document.body.style.cursor = "grabbing"
          }}
          onPointerMove={(e) => {
            if (!start.current) return
            e.stopPropagation()
            const d = compute(e)
            if (!d) return
            latest.current = d
            setLive(d)
            onDrag({ index: m.index, ...d })
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onClick={(e) => e.stopPropagation()}
          renderOrder={20}
        >
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial color={hover || live ? "#98602c" : "#b57a37"} depthTest={false} depthWrite={false} transparent />
        </mesh>
        {/* Fletxes blanques ←→ (i ↑↓ als penjats): barres i triangles plans. */}
        {(m.wall || m.free ? [0, Math.PI / 2] : [0]).map((rot) => (
          <group key={rot} rotation={[0, 0, rot]}>
            <mesh position={[0, 0, 0.01]} renderOrder={21}>
              <planeGeometry args={[0.9, 0.13]} />
              <meshBasicMaterial color="white" depthTest={false} depthWrite={false} transparent />
            </mesh>
            <mesh position={[0.5, 0, 0.01]} renderOrder={21}>
              <circleGeometry args={[0.26, 3]} />
              <meshBasicMaterial color="white" depthTest={false} depthWrite={false} transparent />
            </mesh>
            <mesh position={[-0.5, 0, 0.01]} rotation={[0, 0, Math.PI]} renderOrder={21}>
              <circleGeometry args={[0.26, 3]} />
              <meshBasicMaterial color="white" depthTest={false} depthWrite={false} transparent />
            </mesh>
          </group>
        ))}
        </group>
      </Billboard>
      {label && (
        <Html position={[0, 0.05, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff", background: "#b57a37", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", display: "block" }}>{label}</span>
        </Html>
      )}
    </group>
  )
}

/**
 * Textura clonada amb repetició segons la mida real de la cara i la veta girada si cal.
 * `tileMm` = amplada real d'una repetició (la veta hi va d'esquerra a dreta) i `aspect` =
 * alçada ÷ amplada de la imatge. Girada (veta en v), l'horitzontal de la imatge cobreix la v de
 * la cara (three escala després de girar), per això es creuen les repeticions.
 */
function faceTexture(base: Texture, uMm: number, vMm: number, rotate: boolean, tileMm = TILE_MM, aspect = 1): Texture {
  const t = base.clone()
  t.needsUpdate = true
  t.center.set(0.5, 0.5)
  t.rotation = rotate ? Math.PI / 2 : 0
  const tw = tileMm, th = tileMm * aspect
  if (rotate) t.repeat.set(vMm / tw, uMm / th)
  else t.repeat.set(uMm / tw, vMm / th)
  return t
}

function makeMaterial(finish: FinishSpec, uMm: number, vMm: number, rotate: boolean, opts: { transparent: boolean; opacity: number }): MeshStandardMaterial {
  if (finish.kind === "wood") {
    return new MeshStandardMaterial({ map: faceTexture(woodTexture(finish.species), uMm, vMm, rotate), roughness: 0.7, metalness: 0, ...opts })
  }
  // Foto real del tauler: la mateixa escala que al tauler de debò (tileMm = amplada de la foto).
  if (finish.kind === "image") {
    return new MeshStandardMaterial({ map: faceTexture(photoTexture(finish.src, finish.seamless), uMm, vMm, rotate, finish.tileMm, finish.aspect), roughness: 0.7, metalness: 0, ...opts })
  }
  if (finish.kind === "pattern") {
    return new MeshStandardMaterial({ map: faceTexture(patternTexture(finish.pattern, finish.color, finish.grout), uMm, vMm, false, finish.tileMm), roughness: finish.roughness, metalness: 0, ...opts })
  }
  // Vidre: translúcid sempre (també sense vel).
  const glass = finish.opacity !== undefined && finish.opacity < 1
  const mat = new MeshStandardMaterial({ color: finish.color, roughness: finish.roughness, metalness: finish.metalness ?? 0, ...opts, ...(glass ? { transparent: true, opacity: Math.min(opts.opacity, finish.opacity!), depthWrite: false } : {}) })
  // El render per CPU distingeix el vidre dels fantasmes (tots dos transparents).
  if (glass) mat.userData.glass = true
  return mat
}

/**
 * Els 6 materials d'una peça (ordre de BoxGeometry: +x, −x, +y, −y, +z, −z; z = gruix).
 * Cares grans amb l'acabat del material i la veta en la direcció de la peça; cantells
 * folrats amb el material del cantell; cantells sense folrar, tauler vist.
 */
function panelMaterials(p: Panel, mode: "material" | "role", materials: MaterialPref[], dimmed: boolean): MeshStandardMaterial[] {
  const opts = { transparent: dimmed, opacity: dimmed ? 0.45 : 1 }
  if (mode === "role") {
    const m = new MeshStandardMaterial({ color: ROLE_COLOR[p.role], roughness: 0.85, metalness: 0, ...opts })
    return [m, m, m, m, m, m]
  }
  const finish = resolveFinish(materials, p.material)
  const edgeFinish = resolveEdgeFinish(materials, p.material)
  const L = p.length
  const W = p.width
  const T = p.thickness
  const grainY = p.grain === "y"
  // Cares grans: u al llarg de x local (BoxGeometry), veta en x llevat que la peça la tingui en y.
  const big = () => makeMaterial(finish, L, W, grainY, opts)
  // Materials massissos (ferro, pedra, vidre, teixits de simulació): el cantell és el mateix material.
  const solid = materials.find((m) => m.name === p.material)?.cnc === false
  const raw = () => (solid ? makeMaterial(finish, L, T, false, opts) : new MeshStandardMaterial({ color: RAW_EDGE_COLOR, roughness: 0.95, metalness: 0, ...opts }))
  // +x / −x: cara T × W (u = gruix, v = amplada): la veta ha d'anar en v.
  const edgeX = (banded: boolean) => (banded ? makeMaterial(edgeFinish, T, W, true, opts) : raw())
  // +y / −y: cara L × T (u = llargada): la veta va en u.
  const edgeY = (banded: boolean) => (banded ? makeMaterial(edgeFinish, L, T, false, opts) : raw())
  return [edgeX(p.edges.right), edgeX(p.edges.left), edgeY(p.edges.top), edgeY(p.edges.bottom), big(), big()]
}

export function PanelMesh({
  panel,
  exploded,
  showHoles,
  dimmed = false,
  materialMode,
  materials,
  onClick,
  edges = true,
  hardware = false,
}: {
  /** Ferratges visuals de la peça (frontisses i tirador als fronts). */
  hardware?: boolean
  panel: Panel
  exploded: boolean
  showHoles: boolean
  /** Perfil de les arestes (no en mode presentació). */
  edges?: boolean
  /** Peça del mòdul seleccionat: translúcida, per veure'n l'interior. */
  dimmed?: boolean
  materialMode: "material" | "role"
  materials: MaterialPref[]
  /** Clic a la peça, amb el punt tocat (coordenades del món, m). */
  onClick?: (point: Vector3) => void
}) {
  const group = useRef<Group>(null)
  const amount = useRef(exploded ? 1 : 0)

  const { matrix, explode } = useMemo(() => {
    const { origin, xAxis, yAxis, zAxis, explodeDir } = panel.placement
    const m = new Matrix4().makeBasis(new Vector3(...xAxis), new Vector3(...yAxis), new Vector3(...zAxis))
    m.setPosition(origin[0] * S, origin[1] * S, origin[2] * S)
    return { matrix: m, explode: new Vector3(...explodeDir).multiplyScalar(EXPLODE_MM * S) }
  }, [panel.placement])

  const mats = useMemo(() => panelMaterials(panel, materialMode, materials, dimmed), [panel, materialMode, materials, dimmed])
  // Peces amb talls passants (reixetes, taulell amb pica i vitro, passacables): geometria
  // extruïda amb els forats de debò, perquè es vegi a través.
  // Peces a inglet (sense talls): secció en trapezi, perquè la cantonada es vegi a 45°.
  // Els forats dels tiradors no es buiden al 3D (els tapa el tirador): així una peça a inglet
  // amb tirador continua sent un prisma a 45°.
  const vis = useMemo(() => visualPanel(panel), [panel])
  const cut = useMemo(() => (isShaped(vis) ? shapedGeometry(vis) : vis.mitres?.length ? mitreGeometry(vis) : null), [vis])
  const cutMats = useMemo(() => {
    if (!cut) return null
    const m = cutoutMaterials(panel, materialMode, materials, dimmed)
    // A la geometria d'inglet els grups van al revés: [0] puntes (cantell), [1] cares.
    return isShaped(vis) ? m : [m[1]!, m[0]!]
  }, [cut, panel, materialMode, materials, dimmed])
  useEffect(
    () => () => {
      cut?.dispose()
      for (const m of cutMats ?? []) {
        m.map?.dispose()
        m.dispose()
      }
    },
    [cut, cutMats],
  )
  useEffect(
    () => () => {
      for (const m of new Set(mats)) {
        m.map?.dispose()
        m.dispose()
      }
    },
    [mats],
  )

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const target = exploded ? 1 : 0
    amount.current += (target - amount.current) * Math.min(1, dt * 7)
    if (Math.abs(target - amount.current) < 0.002) amount.current = target
    g.position.copy(explode).multiplyScalar(amount.current)
  })

  const L = panel.length * S
  const W = panel.width * S
  const T = panel.thickness * S

  return (
    <group ref={group}>
      <group matrix={matrix} matrixAutoUpdate={false}>
        <mesh
          position={cut ? [0, 0, 0] : [L / 2, W / 2, T / 2]}
          castShadow
          receiveShadow
          material={cut && cutMats ? cutMats : mats}
          geometry={cut ?? undefined}
          onClick={onClick ? (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onClick(e.point)
          } : undefined}
        >
          {!cut && <boxGeometry args={[L, W, T]} />}
          {edges && <Edges color={dimmed ? "#a08a6a" : "#6b5a3e"} threshold={15} />}
        </mesh>
        {showHoles && panel.holes.map((h, i) => <HoleMark key={i} hole={h} thickness={T} />)}
        {hardware && <PanelHardware panel={panel} />}
        {panel.grooves.map((g, i) => (
          <mesh key={`g${i}`} position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, g.face === "A" ? T - (g.depth * S) / 2 + 0.0002 : (g.depth * S) / 2 - 0.0002]}>
            <boxGeometry args={[g.w * S, g.h * S, g.depth * S]} />
            <meshStandardMaterial color="#8a7150" roughness={1} />
          </mesh>
        ))}

      </group>
    </group>
  )
}

const HOLE_COLOR = "#3b2f1f"
const EPS = 0.0004

/** Marca d'un tall passant: forma fosca a la cara A (passacables, ranures de reixeta, trapa). */

/** Materials per a la geometria extruïda: [0] cares (A/B), [1] cantells i parets dels forats. UV en metres. */
function cutoutMaterials(p: Panel, mode: "material" | "role", materials: MaterialPref[], dimmed: boolean): MeshStandardMaterial[] {
  const opts = { transparent: dimmed, opacity: dimmed ? 0.45 : 1 }
  if (mode === "role") {
    const m = new MeshStandardMaterial({ color: ROLE_COLOR[p.role], roughness: 0.85, metalness: 0, ...opts })
    return [m, m]
  }
  // UV en metres: 1000 mm per unitat de textura.
  const face = makeMaterial(resolveFinish(materials, p.material), 1000, 1000, p.grain === "y", opts)
  const edge = makeMaterial(resolveEdgeFinish(materials, p.material), 1000, 1000, false, opts)
  return [face, edge]
}

function HoleMark({ hole, thickness }: { hole: Hole; thickness: number }) {
  const r = (hole.diameter / 2) * S
  const x = hole.x * S
  const y = hole.y * S

  if (hole.face === "A") {
    return (
      <mesh position={[x, y, thickness + EPS]}>
        <circleGeometry args={[r, 20]} />
        <meshBasicMaterial color={HOLE_COLOR} />
      </mesh>
    )
  }
  if (hole.face === "B") {
    return (
      <mesh position={[x, y, -EPS]} rotation={[Math.PI, 0, 0]}>
        <circleGeometry args={[r, 20]} />
        <meshBasicMaterial color={HOLE_COLOR} />
      </mesh>
    )
  }
  // Forat de cantell: disc perpendicular al cantell, al mig del gruix.
  const z = thickness / 2
  switch (hole.edge) {
    case "left":
      return (
        <mesh position={[x - EPS, y, z]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[r, 20]} />
          <meshBasicMaterial color={HOLE_COLOR} />
        </mesh>
      )
    case "right":
      return (
        <mesh position={[x + EPS, y, z]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[r, 20]} />
          <meshBasicMaterial color={HOLE_COLOR} />
        </mesh>
      )
    case "bottom":
      return (
        <mesh position={[x, y - EPS, z]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 20]} />
          <meshBasicMaterial color={HOLE_COLOR} />
        </mesh>
      )
    case "top":
      return (
        <mesh position={[x, y + EPS, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 20]} />
          <meshBasicMaterial color={HOLE_COLOR} />
        </mesh>
      )
    default:
      return null
  }
}


/**
 * Geometria i materials reals d'una peça (els mateixos del visor, amb textures i veta) per
 * exportar-la (GLB / USDZ de «Veure a casa»). Coordenades en m, origen a la cantonada.
 */
export function exportablePanel(full: Panel, materials: MaterialPref[]): { geometry: BufferGeometry; material: MeshStandardMaterial[] } {
  const panel = visualPanel(full)
  if (isShaped(panel)) return { geometry: shapedGeometry(panel), material: cutoutMaterials(panel, "material", materials, false) }
  if (panel.mitres?.length) {
    const m = cutoutMaterials(panel, "material", materials, false)
    return { geometry: mitreGeometry(panel), material: [m[1]!, m[0]!] }
  }
  const g = new BoxGeometry(panel.length * S, panel.width * S, panel.thickness * S)
  g.translate((panel.length * S) / 2, (panel.width * S) / 2, (panel.thickness * S) / 2)
  return { geometry: g, material: panelMaterials(panel, "material", materials, false) }
}

/** La peça per dibuixar-la: sense els forats dels tiradors (el tirador els tapa). */
export function visualPanel(p: Panel): Panel {
  if (!p.cutouts?.some((c) => c.tag === "handle")) return p
  const cutouts = p.cutouts.filter((c) => c.tag !== "handle")
  const { cutouts: _c, ...rest } = p
  void _c
  return cutouts.length ? { ...rest, cutouts } : rest
}

/** Dona accés a l'escena, la càmera i la mida del visor (per al render per CPU). */
