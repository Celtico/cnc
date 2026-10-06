import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { QUALITY, type RenderQuality } from "./renderQuality"
import { PresentationRoom } from "./PresentationRoom"
import { ModuleLegs, PanelHardware } from "./Hardware"
import type { SceneGetter } from "./render/RenderDialog"
import { SceneAccess, StudioEnvironment, TextureRefresh } from "./SceneHelpers"
import { surfaceMaterial } from "./surfaceMaterial"
import { profileGeometry } from "./refGeometry"
import { LIGHT_SPEC, usePresentationScene } from "./presentationScene"
import { Billboard, Edges, Grid, Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei"
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from "react"
import { ContactShadow } from "./ContactShadow"
import { BoxFrame } from "./BoxFrame"
import { MoveGizmo } from "./MoveGizmo"
import { useViewerCursor } from "./cursor"
import { usePixelScale, type Axis } from "./pixelScale"
import { CircleGeometry, NeutralToneMapping, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, Plane, Vector3 } from "three"
import { type ViewName } from "./viewNames"
export type { ViewName } from "./viewNames"

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>
import { flatten, modelFootprint, partSize, partsBox, type CameraPose, type FreePart, type Hole, type MaterialPref, type ModelObject, type Panel, type RefObject } from "../../core/model"
import { modelInstance, onModelsLoaded, releaseModelGpu } from "./models3d"
import { useColorModeValue } from "../ui/color-mode"
import { movingGroups, transformAt, type MovingGroup } from "./opening"
import { isShaped, mitreGeometry, shapedGeometry } from "./cutoutGeometry"
import { cutoutMaterials, panelMaterials, panelVisualKey, visualPanel } from "./exportablePanel"
import { disposeMaterial } from "./textures"

/** Color de selecció (el mateix taronja que els botons + del 3D). */
const SELECT_COLOR = "#b57a37"

/** Escala mm → m per a l'escena. */
const S = 0.001
/** Fletxa de cada direcció a l'etiqueta d'arrossegar un objecte (com les icones de Posició). */
const AXIS_ARROW = { x: "↔", y: "↕", z: "⤢" } as const
/** Separació en vista explosionada (mm). */
const EXPLODE_MM = 160



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
  /** Acabats propis de l'escena de Presentació (`Composition.scene`): terra i paret. */
  sceneFinish?: { floor?: string; wall?: string }
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
  /** Models 3D (`.glb`): clic per seleccionar-los; el seleccionat porta el gizmo per moure'l. */
  models?: ModelObject[]
  selectedModelId?: string | null
  onSelectModel?: (id: string) => void
  onMoveModel?: (id: string, pos: { x: number; y: number; z: number }) => void
  /** Objectes que xoquen amb alguna peça: es pinten de vermell. */
  collidingRefIds?: Set<string>
  /** Compartiment seleccionat (mm, coordenades de la composició): contorn taronja. */
  highlightZone?: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; veil?: boolean } | null
  /** Clic a l'espai buit (sense arrossegar): treure la selecció. */
  onDeselect?: () => void
  /** Canviar-lo torna a enquadrar la càmera (la resta de canvis no la mouen). */
  fitKey?: number
  /** Avisa si la càmera és a l'enquadrament automàtic (true) o l'usuari l'ha moguda / el moble ha canviat de mida (false). */
  onFramedChange?: (framed: boolean) => void
  /** Càmera desada (vista 3D): en muntar-se s'hi torna en lloc d'enquadrar. Només es llegeix en muntar-se. */
  initialCamera?: CameraPose
  /** La càmera de la vista 3D s'ha quedat quieta (1 s després de moure-la o d'enquadrar): per desar-la. */
  onCameraChange?: (camera: CameraPose) => void
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
  models,
  selectedModelId,
  onSelectModel,
  onMoveModel,
  collidingRefIds,
  highlightZone,
  fitKey = 0,
  onFramedChange,
  initialCamera,
  onCameraChange,
  sceneFinish,
}: CabinetViewerProps) {
  // Per distingir un clic a l'espai buit d'un gir de càmera (arrossegar).
  const downAt = useRef<[number, number] | null>(null)
  const q = QUALITY[quality]
  const [prefScene] = usePresentationScene()
  // Els acabats propis del moble (terra i paret) passen per davant dels de Preferències.
  const ownFloor = sceneFinish?.floor, ownWall = sceneFinish?.wall
  const scene = useMemo(() => ({ ...prefScene, ...(ownFloor ? { floorMaterial: ownFloor } : {}), ...(ownWall ? { wallMaterial: ownWall } : {}) }), [prefScene, ownFloor, ownWall])
  const light = LIGHT_SPEC[scene.light]
  const bg = useColorModeValue("#f4f1ea", "#1b1a17")
  const gridCell = useColorModeValue("#d8d2c4", "#33302a")
  const gridSection = useColorModeValue("#b9b1a0", "#4a463d")
  const dimColor = useColorModeValue("#3b2f1f", "#e8dcc6")
  const selected = modules?.find((m) => m.id === selectedModuleId)
  const selectedIndex = selected?.index
  const groups = useMemo(() => movingGroups(panels), [panels])
  const groupOf = useMemo(() => {
    const m = new Map<string, MovingGroup>()
    for (const g of groups) for (const id of g.panelIds) m.set(id, g)
    return m
  }, [groups])
  const gridRef = useRef<Object3D>(null)
  // Mòdul (o moble sencer) que s'està arrossegant amb la nansa: desplaçament en viu.
  // Mòdul sota el ratolí: contorn suau, perquè es vegi què se seleccionarà en clicar.
  const [hoverModule, setHoverModule] = useState<number | null>(null)
  const [moduleDrag, setModuleDrag] = useState<{ index: number; dx: number; dy: number; dz: number; all: boolean } | null>(null)
  // Signatura visual i col·locació de cada peça (es calculen un cop per construcció, no a cada render): `PanelMesh`
  // només es torna a dibuixar si canvien, així passar per sobre, arrossegar o editar un altre mòdul no refà les
  // geometries, els materials ni les textures de totes les peces.
  const holesDrawn = showHoles || hardware
  const panelKeys = useMemo(() => {
    const m = new Map<string, { sig: string; place: string }>()
    // `place` porta també el mòdul: el clic i el ressaltat el llegeixen de la peça (no és visual, però no pot quedar vell).
    for (const p of panels) m.set(p.id, { sig: panelVisualKey(p, holesDrawn), place: `${p.module ?? ""}|${JSON.stringify(p.placement)}` })
    return m
  }, [panels, holesDrawn])
  // Callbacks estables per a totes les peces (la peça arriba com a dada): el que fan llegeix les props d'ara.
  const live = useRef({ onSelectModule, onSelectPart, modules, size })
  useEffect(() => {
    live.current = { onSelectModule, onSelectPart, modules, size }
  })
  const onPanelHover = useCallback((p: Panel, on: boolean) => {
    setHoverModule((h) => (on ? (p.module ?? null) : h === p.module ? null : h))
  }, [])
  const onPanelClick = useCallback((p: Panel, pt: Vector3) => {
    const l = live.current
    if (p.id.startsWith("part:")) return l.onSelectPart?.(p.id.slice(5))
    const id = l.modules?.find((m) => m.index === p.module)?.id
    // Punt clicat en mm de la composició (el grup està centrat a l'escena).
    if (id) l.onSelectModule?.(id, [pt.x / S + l.size.width / 2, pt.y / S, pt.z / S + l.size.depth / 2])
  }, [])
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
  // Caixa de cada model 3D, amb el gir (per al contorn, el gizmo i l'imant dels altres).
  const modelBoxes = useMemo((): RefObject[] => (models ?? []).map((m) => {
    const f = modelFootprint(m)
    return { id: m.id, name: m.name, x: f.x, y: m.y, z: f.z, w: f.w, h: m.h, d: f.d }
  }), [models])
  const selectedModelBox = modelBoxes.find((b) => b.id === selectedModelId)
  const selectedModel = models?.find((m) => m.id === selectedModelId)
  // De la caixa girada a la cantonada del model (el gizmo mou la caixa).
  const toModelPos = (pos: { x: number; y: number; z: number }) => (selectedModel && selectedModelBox ? { x: pos.x - selectedModelBox.x + selectedModel.x, y: pos.y, z: pos.z - selectedModelBox.z + selectedModel.z } : pos)
  // Els models comparteixen geometria i materials (memòria de `models3d`): en tancar el visor (o recrear el
  // renderitzador en canviar la qualitat) s'alliberen de la GPU; si no, el renderitzador mort quedaria viu a través
  // dels seus escoltadors.
  useEffect(() => () => releaseModelGpu(), [quality])
  // Model que s'arrossega amb el gizmo: es mou en viu (posició en mm).
  const [modelDrag, setModelDrag] = useState<{ id: string; x: number; y: number; z: number } | null>(null)
  const groupBox = useMemo((): RefObject | null => {
    const members = (parts ?? []).filter((p) => p.group && p.group === selectedGroup)
    if (!members.length) return null
    const b = partsBox(members)
    return { id: `group:${selectedGroup}`, name: selectedGroup!, x: b.min[0], y: b.min[1], z: b.min[2], w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], d: b.max[2] - b.min[2] }
  }, [parts, selectedGroup])

  return (
    // Canviar la qualitat recrea el renderitzador: les ombres no es poden activar en calent.
    // Només pinta quan alguna cosa canvia (`frameloop="demand"`): els controls, les animacions (obrir, explosionar,
    // enquadrar) i les textures que arriben demanen el fotograma (`invalidate`). A l'iPhone, un visor quiet no gasta.
    <Canvas
      key={quality}
      frameloop="demand"
      // PCF amb el radi de sempre (el «soft» de three ja ho és; PCFSoftShadowMap s'ha retirat i avisava).
      shadows={q.shadows ? "percentage" : false}
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
      {/* Mà sobre les peces d'un mòdul que es pot triar. */}
      <HoverCursor active={hoverModule !== null} />
      {/* Les vistes ortogràfiques són plànols: sempre fons de dibuix, també a Presentació. */}
      <color attach="background" args={[q.guides || ortho ? bg : scene.wall]} />
      {/* Llum d'entorn (IBL) d'un estudi procedural, com model-viewer: reflexos i ombrejat suau. És l'única
          de l'escena: abans l'habitació de Presentació en posava una altra i, segons quina s'aplicava l'última
          (en clicar al 3D es tornava a aplicar la de l'habitació), tot el visor canviava de to. */}
      <StudioEnvironment intensity={q.guides ? 0.6 : 0.5 * light.env} />
      <TextureRefresh />
      <hemisphereLight intensity={(q.guides ? 0.55 : light.ambient) * 0.45} groundColor="#8a7a60" />
      {!q.guides && !ortho && <PresentationRoom backZ={-size.depth * S * 0.5} scene={scene} materials={materials} />}
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
          const isPart = p.id.startsWith("part:")
          const k = panelKeys.get(p.id)
          return (
            <group key={p.id} position={shifted ? [moduleDrag.dx * S, moduleDrag.dy * S, moduleDrag.dz * S] : ZERO3}>
            <MovingPanel transform={tr}>
              <PanelMesh
                panel={p}
                sig={k?.sig}
                place={k?.place}
                exploded={exploded}
                showHoles={showHoles}
                // Mòdul triat: sòlid amb el contorn taronja. Translúcid només amb un compartiment triat (per veure'l a dins).
                dimmed={q.guides && !!highlightZone && highlightZone.veil !== false && selectedIndex !== undefined && p.module === selectedIndex}
                edges={q.guides}
                materialMode={materialMode}
                materials={materials}
                hardware={hardware}
                onHover={onSelectModule && !isPart ? onPanelHover : undefined}
                onClick={(isPart ? onSelectPart : onSelectModule) ? onPanelClick : undefined}
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
            materials={materials}
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
        {models?.map((m) => {
          const live = modelDrag?.id === m.id ? modelDrag : null
          return <ModelMesh key={m.id} m={m} selected={m.id === selectedModelId} shift={live ? [(live.x - m.x) * S, (live.y - m.y) * S, (live.z - m.z) * S] : undefined} onSelect={onSelectModel} />
        })}
        {/* Model seleccionat: contorn taronja amb el gizmo (com una peça lliure). */}
        {selectedModelBox && (
          <RefGhost
            key={`model-${selectedModelBox.id}`}
            g={selectedModelBox}
            selected
            hit={false}
            guides={q.guides}
            view={view}
            offset={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}
            targets={snapTargets}
            others={[...modelBoxes, ...partBoxes, ...(ghosts ?? [])]}
            onSelect={onSelectModel}
            onMove={onMoveModel ? (id, pos) => onMoveModel(id, toModelPos(pos)) : undefined}
            onDrag={(pos) => setModelDrag(pos && { id: selectedModelBox.id, ...toModelPos(pos) })}
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
        {(() => {
          const hm = hoverModule !== null && hoverModule !== selectedIndex && !moduleDrag ? modules?.find((m) => m.index === hoverModule) : undefined
          return hm ? (
            <group position={[(hm.x + hm.width / 2) * S, (hm.y + hm.height / 2) * S, ((hm.z ?? 0) + hm.depth / 2) * S]}>
              <BoxFrame w={(hm.width + 6) * S} h={(hm.height + 6) * S} d={(hm.depth + 6) * S} />
            </group>
          ) : null
        })()}
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
            {/* A l'aresta de davant de cada costat, a mitja alçada, i apartats uns píxels cap a fora a la pantalla: la nansa
                ↔ (a dalt al mig) no els tapa ni en un mòdul baix i fondo. */}
            <AddButton x={selected.x} y={selected.y + selected.height / 2} z={(selected.z ?? 0) + selected.depth} side="left" onClick={() => onAddModule("left")} />
            <AddButton x={selected.x + selected.width} y={selected.y + selected.height / 2} z={(selected.z ?? 0) + selected.depth} side="right" onClick={() => onAddModule("right")} />
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
        <ContactShadow
          position={CONTACT_POS}
          opacity={0.35}
          // A passos (quatre per octava, cap amunt): editar les mides no refà els render targets a cada canvi.
          scale={2 ** (Math.ceil(Math.log2(Math.max(size.width, size.depth, 100) * S * 2.2) * 4) / 4)}
          blur={q.contactBlur}
          far={size.height * S + 0.5}
          resolution={q.contactResolution}
        />
      )}
      <CameraRig size={size} view={view} fitKey={fitKey} onFramedChange={onFramedChange} initialCamera={initialCamera} onCameraChange={onCameraChange} />
      {onCapture && <Capture onCapture={onCapture} gridRef={gridRef} />}
      {onSceneAccess && <SceneAccess onAccess={onSceneAccess} />}
    </Canvas>
  )
}

const ZERO3: [number, number, number] = [0, 0, 0]
const CONTACT_POS: [number, number, number] = [0, 0.0005, 0]
/**
 * Pas de temps d'una animació (s): amb `frameloop="demand"`, el primer fotograma després d'una estona quieta porta tot
 * el temps que no s'ha pintat i saltaria al final de cop; aquest compta com 1/60 s. Després, el temps de debò (com a
 * molt 0,1 s). `running` es posa a false quan arriba.
 */
function animStep(running: { current: boolean }, dt: number): number {
  const step = running.current ? Math.min(dt, 0.1) : 1 / 60
  running.current = true
  return step
}

/** Aplica el moviment d'obertura (gir sobre el pivot o desplaçament) a una peça. */
function MovingPanel({ transform, children }: { transform: ReturnType<typeof transformAt> | null; children: React.ReactNode }) {
  const outer = useRef<Group>(null)
  const target = useRef(transform)
  const running = useRef(false)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => {
    target.current = transform
    invalidate()
  }, [transform, invalidate])
  useFrame((st, dt) => {
    const g = outer.current
    if (!g) return
    const tr = target.current
    const rx = tr?.rotation[0] ?? 0
    const ry = tr?.rotation[1] ?? 0
    const tx = (tr?.translation[0] ?? 0) * S
    const ty = (tr?.translation[1] ?? 0) * S
    const tz = (tr?.translation[2] ?? 0) * S
    const px = (tr?.pivot[0] ?? 0) * S + tx
    const py = (tr?.pivot[1] ?? 0) * S + ty
    const pz = (tr?.pivot[2] ?? 0) * S + tz
    const left = Math.max(Math.abs(rx - g.rotation.x), Math.abs(ry - g.rotation.y), Math.abs(px - g.position.x), Math.abs(py - g.position.y), Math.abs(pz - g.position.z))
    // Quasi a lloc: s'hi posa i s'atura (sense demanar més fotogrames).
    if (left < 1e-5) {
      running.current = false
      if (left === 0) return
      g.rotation.x = rx
      g.rotation.y = ry
      g.position.set(px, py, pz)
      return
    }
    const k = Math.min(1, animStep(running, dt) * 8)
    g.rotation.x += (rx - g.rotation.x) * k
    g.rotation.y += (ry - g.rotation.y) * k
    g.position.x += (px - g.position.x) * k
    g.position.y += (py - g.position.y) * k
    g.position.z += (pz - g.position.z) * k
    st.invalidate()
  })
  const pivot = transform?.pivot ?? [0, 0, 0]
  return (
    <group ref={outer} position={[pivot[0] * S, pivot[1] * S, pivot[2] * S]}>
      <group position={[-pivot[0] * S, -pivot[1] * S, -pivot[2] * S]}>{children}</group>
    </group>
  )
}

/** Distància màxima de la càmera de l'editor (m). */
const MAX_DISTANCE = 12

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
 * Càmera: s'enquadra en muntar-se, en canviar de vista, en redimensionar el visor i quan
 * canvia `fitKey`. Editar el moble (mides, mòduls, objectes) no la mou: es queda on l'has deixat.
 */
function CameraRig({ size, view, fitKey, onFramedChange, initialCamera, onCameraChange }: { size: CabinetViewerProps["size"]; view: ViewName; fitKey: number; onFramedChange?: (framed: boolean) => void; initialCamera?: CameraPose; onCameraChange?: (camera: CameraPose) => void }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size: viewport, invalidate } = useThree()
  const w = size.width * S
  const h = size.height * S
  const d = size.depth * S
  const targetY = h * 0.5
  const aspect = viewport.width / Math.max(viewport.height, 1)
  const goal = useRef<{ pos: Vector3; zoom: number } | null>(null)
  const goalRunning = useRef(false)
  const lastPos = useRef<Vector3 | null>(null)
  const lastZoom = useRef(1)
  const ortho = view !== "3d"
  // Enquadrat = la càmera és on l'ha deixat l'últim enquadrament i el moble té la mateixa mida.
  const fittedSize = useRef("")
  // Càmera desada que s'ha restaurat (fins que s'enquadri o es canviï de vista) i els disparadors ja vistos
  // (vista | fitKey): un de nou és de l'usuari; els altres reenquadraments són de redimensionar el visor.
  const restored = useRef<CameraPose | null>(null)
  const fitTriggered = useRef(new Set<string>())
  const reportAfterGoal = useRef(false)
  const reportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reportRef = useRef(onCameraChange)
  useEffect(() => {
    reportRef.current = onCameraChange
  })
  // Es llegeix 1 s després de deixar-la anar (l'esmorteïment encara la mou una mica).
  // Lectura pendent: en desmuntar el visor o amagar la pàgina es fa de seguida (si no, es perdria).
  const pendingReport = useRef<(() => void) | null>(null)
  const scheduleReport = () => {
    clearTimeout(reportTimer.current)
    // El punt mirat és un Vector3 que els controls actualitzen: es guarda ara (en desmuntar, la ref ja és buida).
    const t = controls.current?.target
    const run = () => {
      clearTimeout(reportTimer.current)
      pendingReport.current = null
      const tt = t ?? controls.current?.target
      if (!tt || !("fov" in camera) || ("isOrthographicCamera" in camera && camera.isOrthographicCamera)) return
      const r = (v: number) => Math.round(v * 10000) / 10000
      const pose: CameraPose = { position: [r(camera.position.x), r(camera.position.y), r(camera.position.z)], target: [r(tt.x), r(tt.y), r(tt.z)], fov: camera.fov as number }
      if ([...pose.position, ...pose.target].every(Number.isFinite)) reportRef.current?.(pose)
    }
    pendingReport.current = run
    reportTimer.current = setTimeout(run, 1000)
  }
  useEffect(() => {
    const flush = () => pendingReport.current?.()
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [])
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
      // Com a molt la distància màxima dels controls: més enllà, els controls la retenien i l'animació no arribava
      // mai (amb `frameloop="demand"`, el visor no pararia de pintar).
      dist = Math.min(MAX_DISTANCE * 0.999, (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.08)
    } else {
      dist = radius * 4 + 1
      // Extensió visible segons la vista, amb marge per a les cotes.
      const [ew, eh] = view === "top" ? [w, d] : view === "left" || view === "right" ? [d, h] : [w, h]
      // Marge per a les cotes (fins a 2 línies a cada costat) i per a les barres del visor
      // (pestanyes a dalt i vistes a baix, ~56 px cadascuna), perquè no tapin cap cota.
      zoom = Math.min((viewport.width - 40) / (ew + 0.5), (viewport.height - 120) / (eh + 0.5))
    }
    const pos = new Vector3((dir[0] / len) * dist, targetY + (dir[1] / len) * dist, (dir[2] / len) * dist)
    // Càmera desada: en obrir-lo (vista 3D) es torna on es va deixar. Mentre no s'enquadri ni es canviï de vista,
    // redimensionar el visor (la disposició es mou en obrir-se) no la treu d'allà.
    const restore = restored.current ?? (!ortho && initialCamera && !fitTriggered.current.size ? initialCamera : null)
    const trigger = `${view}|${fitKey}`
    const userFit = fitTriggered.current.size > 0 && !fitTriggered.current.has(trigger)
    fitTriggered.current.add(trigger)
    if (restore && !userFit && !ortho) {
      restored.current = restore
      goal.current = null
      camera.position.set(...restore.position)
      controls.current?.target.set(...restore.target)
      controls.current?.update()
      invalidate()
      fittedSize.current = `${size.width}x${size.height}x${size.depth}`
      setFramed(camera.position.distanceTo(pos) < 0.005 && Math.abs(restore.target[0]) + Math.abs(restore.target[2]) + Math.abs(restore.target[1] - targetY) < 0.005)
      return
    }
    restored.current = null
    reportAfterGoal.current = userFit && !ortho
    goal.current = { pos, zoom }
    fittedSize.current = `${size.width}x${size.height}x${size.depth}`
    setFramed(true)
    controls.current?.target.set(0, targetY, 0)
    controls.current?.update()
    // L'animació cap a l'enquadrament (`useFrame`) demana els fotogrames fins que arriba.
    invalidate()
    // Les mides es llegeixen però no disparen el reenquadrament.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, view, ortho, viewport.width, viewport.height, fitKey])

  useFrame((st, dt) => {
    const g = goal.current
    if (!g) {
      goalRunning.current = false
      return
    }
    const k = Math.min(1, animStep(goalRunning, dt) * 6)
    camera.position.lerp(g.pos, k)
    if ("isOrthographicCamera" in camera && camera.isOrthographicCamera) {
      camera.zoom += (g.zoom - camera.zoom) * k
      camera.updateProjectionMatrix()
    }
    controls.current?.update()
    // Arribat, o encallat (els controls no la deixen anar més enllà, p. ex. el límit d'angle): s'acaba.
    const zoom = "isOrthographicCamera" in camera && camera.isOrthographicCamera ? camera.zoom : 1
    const stuck = lastPos.current !== null && camera.position.distanceToSquared(lastPos.current) < 1e-14 && Math.abs(zoom - lastZoom.current) < 1e-6
    lastPos.current = (lastPos.current ?? new Vector3()).copy(camera.position)
    lastZoom.current = zoom
    if (stuck || (camera.position.distanceTo(g.pos) < 0.002 && (!("isOrthographicCamera" in camera) || Math.abs(camera.zoom - g.zoom) < 0.5))) {
      goal.current = null
      goalRunning.current = false
      lastPos.current = null
      // «Enquadrar» (o tornar a la vista 3D): la càmera nova també es desa.
      if (reportAfterGoal.current) {
        reportAfterGoal.current = false
        scheduleReport()
      }
    } else st.invalidate()
  })

  return (
    <>
      {ortho ? <OrthographicCamera makeDefault near={-50} far={100} position={[0, targetY, 5]} zoom={80} /> : <PerspectiveCamera makeDefault fov={38} near={0.01} far={100} position={[1.4, 1.1, 1.9]} />}
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={0.3} maxDistance={MAX_DISTANCE} maxPolarAngle={Math.PI * 0.55} enableRotate={!ortho} onStart={() => {
          goal.current = null
          restored.current = null
          setFramed(false)
          clearTimeout(reportTimer.current)
        }} onEnd={() => {
          if (!ortho) scheduleReport()
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


/**
 * Model 3D (`.glb`) d'un objecte: la còpia de `modelInstance` (m, coordenades de la composició, com les peces). Es torna
 * a fer quan acaba de carregar-se o canvia el model, la mida, la posició o el gir. Comparteix geometria i materials amb
 * la memòria de `models3d` (`userData.sharedModel`): no s'alliberen mai aquí (`dispose={null}`). `shift`: desplaçament
 * en viu mentre s'arrossega (m).
 */
/** Cursor de les peces dels mòduls (el hover el porta `CabinetViewer`, fora del Canvas). */
function HoverCursor({ active }: { active: boolean }) {
  const cursor = useViewerCursor()
  useEffect(() => cursor.hover(active ? "pointer" : null), [cursor, active])
  return null
}

function ModelMesh({ m, selected, shift, onSelect }: { m: ModelObject; selected: boolean; shift?: [number, number, number]; onSelect?: (id: string) => void }) {
  const [loaded, setLoaded] = useState(0)
  useEffect(() => onModelsLoaded(() => setLoaded((v) => v + 1)), [])
  const { id, name, src, x, y, z, w, h, d, rot } = m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const obj = useMemo(() => modelInstance({ id, name, src, x, y, z, w, h, d, rot }), [id, name, src, x, y, z, w, h, d, rot, loaded])
  const [hover, setHover] = useState(false)
  const cursor = useViewerCursor()
  if (!obj) return null
  return (
    <group position={shift ?? [0, 0, 0]}>
      <primitive
        object={obj}
        dispose={null}
        onClick={onSelect ? (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return
          e.stopPropagation()
          onSelect(id)
        } : undefined}
        onPointerOver={onSelect ? (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          cursor.hover("pointer")
          if (e.pointerType === "mouse") setHover(true)
        } : undefined}
        onPointerOut={onSelect ? () => {
          setHover(false)
          cursor.hover(null)
        } : undefined}
      />
      {/* Seleccionat: contorn gruixut; ratolí a sobre: prim (com els objectes). */}
      {(selected || hover) && (
        <group position={[(x + w / 2) * S, (y + h / 2) * S, (z + d / 2) * S]}>
          <BoxFrame w={(w + 4) * S} h={(h + 4) * S} d={(d + 4) * S} strong={selected} />
        </group>
      )}
    </group>
  )
}

/**
 * Objecte de referència (translúcid, o sòlid si té material). Seleccionat, es mou només amb les fletxes del gizmo (cada
 * una en la seva direcció; el cos no s'arrossega). S'enganxa a les arestes dels mòduls i dels altres objectes (Alt: sense
 * imant). Amb el ratolí a sobre, contorn del color de selecció.
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
  onDrag,
  outline = false,
  materials = [],
}: {
  /** Posició en viu mentre s'arrossega amb el gizmo (null en acabar), per moure-hi el que hi ha a sota (models 3D). */
  onDrag?: (pos: { x: number; y: number; z: number } | null) => void
  /** Només el contorn (peça lliure: la peça de debò ja es veu a sota). */
  outline?: boolean
  /** Materials de Preferències (per als objectes que en porten). */
  materials?: MaterialPref[]
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
  // Ratolí a sobre: contorn del color de selecció (més suau), perquè es vegi què es triarà.
  const [hover, setHover] = useState(false)
  const cursor = useViewerCursor()
  // Obstacle en blau; objecte que talla en violeta; seleccionat en taronja; amb problema en vermell.
  const tint = hit ? "#dc2626" : selected ? SELECT_COLOR : g.effect === "cut" ? "#7c3aed" : "#3b82f6"
  const draggable = selected && !!onMove
  const cyl = g.shape === "cylinder"
  const profileGeo = useMemo(() => (g.shape === "profile" && g.profile && g.profile.length >= 3 ? profileGeometry(g) : null), [g])
  // Amb material: sòlid, amb ombres, i surt a la Presentació i al render (els fantasmes no hi surten).
  const solidMat = useMemo(() => (g.material && g.effect !== "cut" && !outline ? surfaceMaterial(materials, g.material, Math.max(g.w, g.d), g.h) : null), [g.material, g.effect, g.w, g.h, g.d, outline, materials])
  // Totes les textures del material (color, normals, rugositat), no només `map`.
  useEffect(() => () => void (solidMat && disposeMaterial(solidMat)), [solidMat])
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
    onDrag?.(null)
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
        onDrag?.({ x: next.x, y: next.y, z: next.z })
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
      castShadow={!!solidMat}
      receiveShadow={!!solidMat}
      renderOrder={g.effect === "cut" ? 8 : 0}
      onClick={onSelect ? (e: ThreeEvent<MouseEvent>) => {
        // El clic que acaba un arrossegament (d'una fletxa o de la càmera) no selecciona.
        if (e.delta > 4) return
        e.stopPropagation()
        onSelect(g.id)
      } : undefined}
      onPointerOver={onSelect ? (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        cursor.hover("pointer")
        if (e.pointerType === "mouse") setHover(true)
      } : undefined}
      onPointerOut={onSelect ? () => {
        setHover(false)
        cursor.hover(null)
      } : undefined}
      // El cos no s'arrossega (per decisió de l'usuari): només les fletxes del gizmo, així sempre se sap cap on es mourà.
    >
      {profileGeo ? <primitive object={profileGeo} attach="geometry" /> : cyl ? <cylinderGeometry args={[radius * S, radius * S, len * S, 40]} /> : <boxGeometry args={[g.w * S, g.h * S, g.d * S]} />}
      {/* Els que tallen solen quedar dins del fons o darrere de les portes: es veuen a través. */}
      {solidMat ? (
        <primitive object={solidMat} attach="material" />
      ) : (
        <meshStandardMaterial side={DoubleSide} color={hover && !selected && !hit ? SELECT_COLOR : tint} transparent opacity={outline ? 0.08 : selected || hit ? 0.38 : g.effect === "cut" ? 0.45 : hover ? 0.32 : 0.22} depthWrite={false} depthTest={g.effect !== "cut"} />
      )}
      {((guides && !solidMat) || selected || hit || g.effect === "cut") && <Edges color={selected ? SELECT_COLOR : tint} threshold={cyl ? 30 : 1} depthTest={g.effect !== "cut"} renderOrder={g.effect === "cut" ? 9 : 0} />}
    </mesh>
      {/* Seleccionat: contorn gruixut que es veu sempre (també sobre un objecte sòlid i fosc); a sobre: més prim. */}
      {!outline && (selected || (hover && !drag)) && <BoxFrame w={(g.w + 4) * S} h={(g.h + 4) * S} d={(g.d + 4) * S} strong={selected} />}
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


/** Elements d'edició (botons +, nanses, gizmo): la imatge del visor per al render no els porta (`SceneAccess`). */
const EDITOR_ONLY = { editorOnly: true }

/** Botó + d'afegir un mòdul al costat: (x, y, z) és l'aresta del mòdul; el botó va 1,7 radis cap a fora a la pantalla. */
function AddButton({ x, y, z, side, onClick }: { x: number; y: number; z: number; side: "left" | "right"; onClick: () => void }) {
  // Botó 3D (no Html): mida constant a la pantalla, sempre per sobre del moble.
  const scaler = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  const cursor = useViewerCursor()
  usePixelScale(scaler, 15)
  const white = <meshBasicMaterial color="white" depthTest={false} depthWrite={false} transparent />
  return (
    <group position={[x * S, y * S, z * S]} userData={EDITOR_ONLY}>
      <Billboard>
        <group ref={scaler}>
          <group position={[side === "left" ? -1.7 : 1.7, 0, 0]}>
          <mesh
            renderOrder={20}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(true)
              cursor.hover("pointer")
            }}
            onPointerOut={() => {
              setHover(false)
              cursor.hover(null)
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
/** La nansa ↔ va `HANDLE_LIFT` radis per sobre de l'aresta de dalt (a la pantalla) i, com a molt, a `HANDLE_TOP_PX` de dalt del visor. */
const HANDLE_LIFT = 1.8
const HANDLE_TOP_PX = 56

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
  const cursor = useViewerCursor()
  // Al mig de l'aresta de dalt de davant; el cercle va uns píxels més amunt (a la pantalla, `HANDLE_LIFT`).
  const top: [number, number, number] = [(m.x + m.width / 2) * S, (m.y + m.height) * S, ((m.z ?? 0) + m.depth) * S]
  // Mida constant a la pantalla (uns 30 px), s'allunyi o s'acosti la càmera.
  const scaler = useRef<Group>(null)
  const anchor = useRef<Group>(null)
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3() }), [])
  // En un mòdul alt (una columna) amb la càmera a prop, la nansa sortiria per dalt del visor: baixa per l'aresta de
  // davant (com a molt fins a una quarta part de l'alçada) fins que hi cap, a sota de la barra de dalt del visor.
  useFrame(({ camera, size }) => {
    const g = anchor.current
    if (!g) return
    const ox = (live?.dx ?? 0) * S, oy = (live?.dy ?? 0) * S, oz = (live?.dz ?? 0) * S
    const hi = tmp.a.set(top[0] + ox, top[1] + oy, top[2] + oz)
    let y = hi.y
    const limit = 1 - (2 * (HANDLE_TOP_PX + HANDLE_LIFT * 14)) / Math.max(1, size.height)
    // Les coordenades són del grup del moble (centrat a l'escena): a la pantalla, amb la seva matriu.
    const parent = g.parent?.matrixWorld
    const ndcOf = (v: Vector3) => (parent ? v.clone().applyMatrix4(parent) : v.clone()).project(camera).y
    const ndcHi = ndcOf(hi)
    if (ndcHi > limit) {
      const drop = m.height * 0.75 * S
      const lo = tmp.b.set(hi.x, hi.y - drop, hi.z)
      const ndcLo = ndcOf(lo)
      const t = ndcHi - ndcLo > 1e-6 ? Math.min(1, Math.max(0, (ndcHi - limit) / (ndcHi - ndcLo))) : 0
      y = hi.y - t * drop
    }
    g.position.set(hi.x, y, hi.z)
  })
  usePixelScale(scaler, 14)
  // r3f no fa arribar el `pointercancel` (un gest del sistema a l'iPhone, girar la pantalla…) ni el `pointerup` si el
  // dit acaba fora de la nansa i no s'ha pogut capturar el punter: com al gizmo, s'escolten a la finestra perquè
  // l'arrossegament acabi igualment (`end` ignora un final repetit).
  const endRef = useRef<(e: ThreeEvent<PointerEvent>) => void>(() => {})
  const unlisten = useRef<(() => void) | null>(null)
  useEffect(() => () => unlisten.current?.(), [])
  const listenEnd = (pointerId: number) => {
    unlisten.current?.()
    const fin = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      unlisten.current?.()
      endRef.current({ target: null, pointerId } as unknown as ThreeEvent<PointerEvent>)
    }
    window.addEventListener("pointerup", fin)
    window.addEventListener("pointercancel", fin)
    unlisten.current = () => {
      window.removeEventListener("pointerup", fin)
      window.removeEventListener("pointercancel", fin)
      unlisten.current = null
    }
  }

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
    unlisten.current?.()
    ;(e.target as Element | null)?.releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    cursor.drag(null)
    const d = latest.current
    latest.current = null
    setLive(null)
    onDrop(d?.dx ?? 0, d?.dy ?? 0, d?.dz ?? 0, d?.all ?? false)
  }
  useEffect(() => {
    endRef.current = end
  })
  const sign = (v: number) => `${v > 0 ? "+" : ""}${v}`
  const label = live ? (live.all ? `Tot el moble ${sign(live.dx)} mm` : `${sign(live.dx)} mm${live.dy ? ` · ${sign(live.dy)} mm` : ""}${live.dz ? ` · paret ${(m.z ?? 0) + live.dz} mm` : ""}`) : null

  return (
    <group ref={anchor} position={top} userData={EDITOR_ONLY}>
      <Billboard>
        <group ref={scaler}>
        <group position={[0, HANDLE_LIFT, 0]}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            cursor.hover("grab")
          }}
          onPointerOut={() => {
            setHover(false)
            cursor.hover(null)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
            // «Al terra»: arrossega sobre un pla horitzontal (pel terra); la resta, pel pla de la paret.
            const plane = new Plane().setFromNormalAndCoplanarPoint(m.free && !e.shiftKey ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1), e.point)
            start.current = { p: e.point.clone(), plane, all: e.shiftKey }
            if (controls) controls.enabled = false
            cursor.drag("grabbing")
            listenEnd(e.pointerId)
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
        </group>
      </Billboard>
      {label && (
        // Per sobre de la nansa (que va uns 25 px per sobre de l'aresta).
        <Html position={[0, 0, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff", background: "#b57a37", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", display: "block", transform: "translateY(-52px)" }}>{label}</span>
        </Html>
      )}
    </group>
  )
}

const BEVEL_USERDATA = { bevel: true }

interface PanelMeshProps {
  /**
   * Signatura visual de la peça (`panelVisualKey`) i col·locació (JSON): si no canvien (i la resta de props tampoc),
   * la peça no es torna a dibuixar ni refà la geometria i els materials. Sense, es calcula aquí.
   */
  sig?: string
  place?: string
  /** El ratolí entra o surt de la peça (ressaltat del mòdul en passar-hi per sobre). Estable: la peça va com a dada. */
  onHover?: (panel: Panel, on: boolean) => void
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
  /** Clic a la peça, amb el punt tocat (coordenades del món, m). Estable: la peça va com a dada. */
  onClick?: (panel: Panel, point: Vector3) => void
}

/** Les mateixes props: per signatura si n'hi ha (la peça és un objecte nou a cada construcció), si no per referència. */
const samePanelProps = (a: PanelMeshProps, b: PanelMeshProps) =>
  (a.sig !== undefined ? a.sig === b.sig && a.place === b.place : a.panel === b.panel) &&
  a.exploded === b.exploded &&
  a.showHoles === b.showHoles &&
  a.dimmed === b.dimmed &&
  a.edges === b.edges &&
  a.hardware === b.hardware &&
  a.materialMode === b.materialMode &&
  a.materials === b.materials &&
  a.onClick === b.onClick &&
  a.onHover === b.onHover

/** Peça del moble al visor (també a la foto realista). Només es torna a pintar si canvia el que es veu (`samePanelProps`). */
export const PanelMesh = memo(function PanelMesh({
  panel,
  sig: givenSig,
  exploded,
  showHoles,
  dimmed = false,
  materialMode,
  materials,
  onClick,
  onHover,
  edges = true,
  hardware = false,
}: PanelMeshProps) {
  const group = useRef<Group>(null)
  const amount = useRef(exploded ? 1 : 0)
  const running = useRef(false)
  const invalidate = useThree((st) => st.invalidate)
  const ownSig = useMemo(() => (givenSig === undefined ? panelVisualKey(panel, showHoles || hardware) : ""), [givenSig, panel, showHoles, hardware])
  const sig = givenSig ?? ownSig
  // La peça que es dibuixa: la mateixa mentre la signatura no canviï (una construcció nova la torna a fer igual).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vpanel = useMemo(() => panel, [sig])

  const { matrix, explode } = useMemo(() => {
    const { origin, xAxis, yAxis, zAxis, explodeDir } = panel.placement
    const m = new Matrix4().makeBasis(new Vector3(...xAxis), new Vector3(...yAxis), new Vector3(...zAxis))
    m.setPosition(origin[0] * S, origin[1] * S, origin[2] * S)
    return { matrix: m, explode: new Vector3(...explodeDir).multiplyScalar(EXPLODE_MM * S) }
  }, [panel.placement])

  const mats = useMemo(() => panelMaterials(vpanel, materialMode, materials, dimmed), [vpanel, materialMode, materials, dimmed])
  // Peces amb talls passants (reixetes, taulell amb pica i vitro, passacables): geometria
  // extruïda amb els forats de debò, perquè es vegi a través.
  // Peces a inglet (sense talls): secció en trapezi, perquè la cantonada es vegi a 45°.
  // Els forats dels tiradors no es buiden al 3D (els tapa el tirador): així una peça a inglet
  // amb tirador continua sent un prisma a 45°.
  const vis = useMemo(() => visualPanel(vpanel), [vpanel])
  const cut = useMemo(() => (isShaped(vis) ? shapedGeometry(vis) : vis.mitres?.length ? mitreGeometry(vis) : null), [vis])
  const cutMats = useMemo(() => {
    if (!cut) return null
    const m = cutoutMaterials(vpanel, materialMode, materials, dimmed)
    // A la geometria d'inglet els grups van al revés: [0] puntes (cantell), [1] cares.
    return isShaped(vis) ? m : [m[1]!, m[0]!]
  }, [cut, vpanel, vis, materialMode, materials, dimmed])
  useEffect(
    () => () => {
      cut?.dispose()
      for (const m of cutMats ?? []) disposeMaterial(m)
    },
    [cut, cutMats],
  )
  useEffect(
    () => () => {
      for (const m of new Set(mats)) disposeMaterial(m)
    },
    [mats],
  )

  // Explosionar o muntar: l'animació (`useFrame`) demana els fotogrames fins que arriba.
  useEffect(() => invalidate(), [exploded, invalidate])
  useFrame((st, dt) => {
    const g = group.current
    if (!g) return
    const target = exploded ? 1 : 0
    if (amount.current !== target) {
      amount.current += (target - amount.current) * Math.min(1, animStep(running, dt) * 7)
      if (Math.abs(target - amount.current) < 0.002) {
        amount.current = target
        running.current = false
      } else st.invalidate()
    }
    g.position.copy(explode).multiplyScalar(amount.current)
  })

  const L = vpanel.length * S
  const W = vpanel.width * S
  const T = vpanel.thickness * S

  return (
    <group ref={group}>
      <group matrix={matrix} matrixAutoUpdate={false}>
        <mesh
          position={cut ? [0, 0, 0] : [L / 2, W / 2, T / 2]}
          castShadow
          receiveShadow
          material={cut && cutMats ? cutMats : mats}
          geometry={cut ?? undefined}
          // El render arrodoneix les arestes dels taulers (`sceneData`).
          userData={BEVEL_USERDATA}
          onClick={onClick ? (e: ThreeEvent<MouseEvent>) => {
            // El clic que acaba un arrossegament (d'una fletxa o de la càmera) no selecciona.
            if (e.delta > 4) return
            e.stopPropagation()
            onClick(panel, e.point)
          } : undefined}
          onPointerOver={onHover ? (e: ThreeEvent<PointerEvent>) => {
            if (e.pointerType !== "mouse") return
            e.stopPropagation()
            onHover(panel, true)
          } : undefined}
          onPointerOut={onHover ? () => onHover(panel, false) : undefined}
        >
          {!cut && <boxGeometry args={[L, W, T]} />}
          {edges && <Edges color={dimmed ? "#a08a6a" : "#6b5a3e"} threshold={15} />}
        </mesh>
        {showHoles && vpanel.holes.length > 0 && <HoleMarks holes={vpanel.holes} thickness={T} />}
        {hardware && <PanelHardware panel={vpanel} />}
        {vpanel.grooves.map((g, i) => (
          <mesh key={`g${i}`} position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, g.face === "A" ? T - (g.depth * S) / 2 + 0.0002 : (g.depth * S) / 2 - 0.0002]}>
            <boxGeometry args={[g.w * S, g.h * S, g.depth * S]} />
            <meshStandardMaterial color="#8a7150" roughness={1} />
          </mesh>
        ))}

      </group>
    </group>
  )
}, samePanelProps)

const HOLE_COLOR = "#3b2f1f"
const EPS = 0.0004
/** Disc de radi 1 i material comuns a totes les marques de forat (cada forat és una instància, escalada al seu radi). */
const HOLE_GEO = new CircleGeometry(1, 20)
const HOLE_MAT = new MeshBasicMaterial({ color: HOLE_COLOR })
HOLE_MAT.userData.shared = true

/** Gir de la marca d'un forat de cantell: disc perpendicular al cantell, al mig del gruix. */
const EDGE_MARK: Record<string, { d: [number, number, number]; r: [number, number, number] }> = {
  left: { d: [-EPS, 0, 0], r: [0, -Math.PI / 2, 0] },
  right: { d: [EPS, 0, 0], r: [0, Math.PI / 2, 0] },
  bottom: { d: [0, -EPS, 0], r: [Math.PI / 2, 0, 0] },
  top: { d: [0, EPS, 0], r: [-Math.PI / 2, 0, 0] },
}

/**
 * Marques dels forats d'una peça (discos foscos a la cara A, a la B o al cantell): una sola malla instanciada per peça
 * amb la geometria i el material comuns (abans, una malla i un material per forat: centenars per moble).
 */
function HoleMarks({ holes, thickness }: { holes: Hole[]; thickness: number }) {
  const marks = useMemo(() => {
    const o = new Object3D()
    const out: Matrix4[] = []
    for (const h of holes) {
      const x = h.x * S
      const y = h.y * S
      if (h.face === "A") {
        o.position.set(x, y, thickness + EPS)
        o.rotation.set(0, 0, 0)
      } else if (h.face === "B") {
        o.position.set(x, y, -EPS)
        o.rotation.set(Math.PI, 0, 0)
      } else {
        const e = h.edge ? EDGE_MARK[h.edge] : undefined
        if (!e) continue
        o.position.set(x + e.d[0], y + e.d[1], thickness / 2 + e.d[2])
        o.rotation.set(...e.r)
      }
      o.scale.setScalar((h.diameter / 2) * S)
      o.updateMatrix()
      out.push(o.matrix.clone())
    }
    return out
  }, [holes, thickness])
  const ref = useRef<InstancedMesh>(null)
  const invalidate = useThree((st) => st.invalidate)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    marks.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [marks, invalidate])
  if (!marks.length) return null
  // La mida de la malla és el nombre de forats: si canvia, se'n fa una de nova.
  return <instancedMesh key={marks.length} ref={ref} args={[HOLE_GEO, HOLE_MAT, marks.length]} />
}


/** Dona accés a l'escena, la càmera i la mida del visor (per al render per CPU). */
