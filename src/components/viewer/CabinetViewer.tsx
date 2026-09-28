import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { QUALITY, type RenderQuality } from "./renderQuality"
import { PresentationRoom } from "./PresentationRoom"
import { LIGHT_SPEC, usePresentationScene } from "./presentationScene"
import { ContactShadows, Edges, Grid, Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei"
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react"
import { LuPlus } from "react-icons/lu"
import { Group, Matrix4, MeshStandardMaterial, Vector3, type Object3D, type Texture, WebGLRenderTarget } from "three"

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>
import type { Hole, MaterialPref, Panel, PanelRole, RefObject } from "../../core/model"
import { useColorModeValue } from "../ui/color-mode"
import { movingGroups, transformAt, type MovingGroup } from "./opening"
import { RAW_EDGE_COLOR, TILE_MM, resolveEdgeFinish, resolveFinish, woodTexture, type FinishSpec } from "./textures"

/** Color de selecció (el mateix taronja que els botons + del 3D). */
const SELECT_COLOR = "#b57a37"

/** Escala mm → m per a l'escena. */
const S = 0.001
/** Separació en vista explosionada (mm). */
const EXPLODE_MM = 160

const ROLE_COLOR: Record<PanelRole, string> = {
  side: "#e6cfa6",
  bottom: "#e6cfa6",
  top: "#e6cfa6",
  shelf: "#efdcb8",
  door: "#d6b076",
  back: "#c9b79a",
  divider: "#e6cfa6",
  fixedShelf: "#e6cfa6",
  plinth: "#b57a37",
  drawerFront: "#d6b076",
  drawerSide: "#efdcb8",
  drawerBack: "#efdcb8",
  drawerBottom: "#c9b79a",
  flap: "#d6b076",
  grille: "#d6b076",
  hatch: "#d6b076",
  panel: "#d6b076",
  worktop: "#c6924f",
}

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
  /** Objecte de referència seleccionat i clic sobre un objecte al 3D. */
  selectedRefId?: string | null
  onSelectRef?: (id: string) => void
  /** Objectes que xoquen amb alguna peça: es pinten de vermell. */
  collidingRefIds?: Set<string>
  /** Compartiment seleccionat (mm, coordenades de la composició): contorn taronja. */
  highlightZone?: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; veil?: boolean } | null
  /** Clic a l'espai buit (sense arrossegar): treure la selecció. */
  onDeselect?: () => void
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
  quality = "balanced",
  onDeselect,
  selectedRefId,
  onSelectRef,
  collidingRefIds,
  highlightZone,
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
  const ortho = view !== "3d"

  return (
    // Canviar la qualitat recrea el renderitzador: les ombres no es poden activar en calent.
    <Canvas
      key={quality}
      shadows={q.shadows ? "soft" : false}
      dpr={q.dpr}
      style={{ touchAction: "none" }}
      gl={{ preserveDrawingBuffer: true, alpha: true }}
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
      <hemisphereLight intensity={q.guides ? 0.55 : light.ambient} groundColor="#8a7a60" />
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
          return (
            <MovingPanel key={p.id} transform={tr}>
              <PanelMesh
                panel={p}
                exploded={exploded}
                showHoles={showHoles}
                dimmed={q.guides && selectedIndex !== undefined && p.module === selectedIndex}
                edges={q.guides}
                materialMode={materialMode}
                materials={materials}
                onClick={onSelectModule ? (pt) => {
                  const id = moduleIdOf(p)
                  // Punt clicat en mm de la composició (el grup està centrat a l'escena).
                  if (id) onSelectModule(id, [pt.x / S + size.width / 2, pt.y / S, pt.z / S + size.depth / 2])
                } : undefined}
              />
            </MovingPanel>
          )
        })}
        {ghosts?.map((g) => {
          const on = g.id === selectedRefId
          const hit = collidingRefIds?.has(g.id) ?? false
          const tint = hit ? "#dc2626" : on ? SELECT_COLOR : "#3b82f6"
          return (
            <mesh
              key={g.id}
              position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, (g.z + g.d / 2) * S]}
              onClick={onSelectRef ? (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation()
                onSelectRef(g.id)
              } : undefined}
              onPointerOver={onSelectRef ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation()
                document.body.style.cursor = "pointer"
              } : undefined}
              onPointerOut={onSelectRef ? () => {
                document.body.style.cursor = ""
              } : undefined}
            >
              <boxGeometry args={[g.w * S, g.h * S, g.d * S]} />
              <meshStandardMaterial color={tint} transparent opacity={on || hit ? 0.38 : 0.22} depthWrite={false} />
              {(q.guides || on || hit) && <Edges color={on ? SELECT_COLOR : tint} />}
            </mesh>
          )
        })}
        {highlightZone && <ZoneHighlight box={highlightZone} />}
        {selected && onAddModule && !ortho && q.guides && (
          <>
            <AddButton x={selected.x - 120} y={selected.y + selected.height / 2} z={selected.depth / 2} side="left" onClick={() => onAddModule("left")} />
            <AddButton x={selected.x + selected.width + 120} y={selected.y + selected.height / 2} z={selected.depth / 2} side="right" onClick={() => onAddModule("right")} />
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
      <CameraRig size={size} view={view} />
      {onCapture && <Capture onCapture={onCapture} gridRef={gridRef} />}
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
function CameraRig({ size, view }: { size: CabinetViewerProps["size"]; view: ViewName }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size: viewport } = useThree()
  const w = size.width * S
  const h = size.height * S
  const d = size.depth * S
  const targetY = h * 0.5
  const aspect = viewport.width / Math.max(viewport.height, 1)
  const goal = useRef<{ pos: Vector3; zoom: number } | null>(null)
  const ortho = view !== "3d"

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
    controls.current?.target.set(0, targetY, 0)
    controls.current?.update()
  }, [camera, w, h, d, targetY, aspect, view, ortho, viewport.width, viewport.height])

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
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={0.3} maxDistance={12} maxPolarAngle={Math.PI * 0.55} enableRotate={!ortho} />
    </>
  )
}

/** Captura la vista actual en PNG a 2× amb fons transparent i sense graella. */
function Capture({ onCapture, gridRef }: { onCapture: (fn: () => Promise<Blob>) => void; gridRef: React.RefObject<Object3D | null> }) {
  const { gl, scene, camera, size } = useThree()
  useEffect(() => {
    onCapture(async () => {
      const width = size.width * 2
      const height = size.height * 2
      const target = new WebGLRenderTarget(width, height)
      const bgBefore = scene.background
      const grid = gridRef.current
      const gridVisible = grid?.visible ?? true
      if (grid) grid.visible = false
      scene.background = null
      const prev = gl.getRenderTarget()
      gl.setRenderTarget(target)
      gl.setClearColor(0x000000, 0)
      gl.clear()
      gl.render(scene, camera)
      const pixels = new Uint8Array(width * height * 4)
      gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)
      gl.setRenderTarget(prev)
      scene.background = bgBefore
      if (grid) grid.visible = gridVisible
      target.dispose()
      // WebGL llegeix de baix a dalt: es gira.
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")!
      const img = ctx.createImageData(width, height)
      const row = width * 4
      for (let y = 0; y < height; y++) img.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row)
      ctx.putImageData(img, 0, 0)
      return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No s'ha pogut generar el PNG"))), "image/png"))
    })
  }, [onCapture, gl, scene, camera, size])
  return null
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
function AddButton({ x, y, z, side, onClick }: { x: number; y: number; z: number; side: "left" | "right"; onClick: () => void }) {
  const label = side === "left" ? "Afegir mòdul a l'esquerra" : "Afegir mòdul a la dreta"
  // L'Html de drei munta el contingut en un arrel React a part, sense el context de
  // Chakra: aquí només hi van elements HTML plans.
  return (
    <Html position={[x * S, y * S, z * S]} center zIndexRange={[20, 10]} style={{ pointerEvents: "auto" }}>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: "2px solid white",
          background: "#b57a37",
          color: "white",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          fontSize: 18,
        }}
      >
        <LuPlus />
      </button>
    </Html>
  )
}

/** Textura clonada amb repetició segons la mida real de la cara i la veta girada si cal. */
function faceTexture(base: Texture, uMm: number, vMm: number, rotate: boolean): Texture {
  const t = base.clone()
  t.needsUpdate = true
  t.center.set(0.5, 0.5)
  t.rotation = rotate ? Math.PI / 2 : 0
  t.repeat.set(uMm / TILE_MM, vMm / TILE_MM)
  return t
}

function makeMaterial(finish: FinishSpec, uMm: number, vMm: number, rotate: boolean, opts: { transparent: boolean; opacity: number }): MeshStandardMaterial {
  if (finish.kind === "wood") {
    return new MeshStandardMaterial({ map: faceTexture(woodTexture(finish.species), uMm, vMm, rotate), roughness: 0.7, metalness: 0, ...opts })
  }
  return new MeshStandardMaterial({ color: finish.color, roughness: finish.roughness, metalness: 0, ...opts })
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
  const raw = () => new MeshStandardMaterial({ color: RAW_EDGE_COLOR, roughness: 0.95, metalness: 0, ...opts })
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
}: {
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
          position={[L / 2, W / 2, T / 2]}
          castShadow
          receiveShadow
          material={mats}
          onClick={onClick ? (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onClick(e.point)
          } : undefined}
        >
          <boxGeometry args={[L, W, T]} />
          {edges && <Edges color={dimmed ? "#a08a6a" : "#6b5a3e"} threshold={15} />}
        </mesh>
        {showHoles && panel.holes.map((h, i) => <HoleMark key={i} hole={h} thickness={T} />)}
        {panel.grooves.map((g, i) => (
          <mesh key={`g${i}`} position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, g.face === "A" ? T - (g.depth * S) / 2 + 0.0002 : (g.depth * S) / 2 - 0.0002]}>
            <boxGeometry args={[g.w * S, g.h * S, g.depth * S]} />
            <meshStandardMaterial color="#8a7150" roughness={1} />
          </mesh>
        ))}
        {panel.cutouts?.map((c, i) => <CutoutMark key={`c${i}`} cutout={c} thickness={T} />)}
      </group>
    </group>
  )
}

const HOLE_COLOR = "#3b2f1f"
const EPS = 0.0004

/** Marca d'un tall passant: forma fosca a la cara A (passacables, ranures de reixeta, trapa). */
function CutoutMark({ cutout: c, thickness }: { cutout: NonNullable<Panel["cutouts"]>[number]; thickness: number }) {
  if (c.kind === "circle") {
    return (
      <mesh position={[c.x * S, c.y * S, thickness + EPS]}>
        <circleGeometry args={[(c.diameter / 2) * S, 24]} />
        <meshBasicMaterial color={HOLE_COLOR} />
      </mesh>
    )
  }
  return (
    <mesh position={[(c.x + c.w / 2) * S, (c.y + c.h / 2) * S, thickness + EPS]}>
      <planeGeometry args={[c.w * S, c.h * S]} />
      <meshBasicMaterial color={HOLE_COLOR} />
    </mesh>
  )
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
