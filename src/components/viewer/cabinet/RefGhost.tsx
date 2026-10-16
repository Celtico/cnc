import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { Edges, Html } from "@react-three/drei"
import { useEffect, useMemo, useRef, useState } from "react"
import { DoubleSide, Plane, Vector3 } from "three"
import type { MaterialPref, RefObject } from "../../../core/model"
import { useLatest } from "../../../lib/useLatest"
import { BoxFrame } from "../BoxFrame"
import { useViewerCursor } from "../cursor"
import { MoveGizmo } from "../MoveGizmo"
import type { Axis } from "../pixelScale"
import { profileGeometry } from "../refGeometry"
import { surfaceMaterial } from "../surfaceMaterial"
import { disposeMaterial } from "../textures"
import { S, SELECT_COLOR } from "./constants"
import { useOrbitControls } from "../orbitControls"

export interface SnapTargets {
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

/** Fletxa de cada direcció a l'etiqueta d'arrossegar un objecte (com les icones de Posició). */
const AXIS_ARROW = { x: "↔", y: "↕", z: "⤢" } as const

/** Eix del món que la càmera mira gairebé de cara (|cos| > 0,97, unes vistes de costat o de dalt), o null. */
function useFacingAxis(): Axis | null {
  const [axis, setAxis] = useState<Axis | null>(null)
  const cur = useRef<Axis | null>(null)
  const v = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => {
    camera.getWorldDirection(v)
    const a: Axis | null = Math.abs(v.x) > 0.97 ? "x" : Math.abs(v.y) > 0.97 ? "y" : Math.abs(v.z) > 0.97 ? "z" : null
    if (a !== cur.current) {
      cur.current = a
      setAxis(a)
    }
  })
  return axis
}

/**
 * Objecte de referència (translúcid, o sòlid si té material). Seleccionat, es mou només amb les fletxes del gizmo (cada
 * una en la seva direcció; el cos no s'arrossega). S'enganxa a les arestes dels mòduls i dels altres objectes (Alt: sense
 * imant). Amb el ratolí a sobre, contorn del color de selecció.
 */
export function RefGhost({
  g,
  selected,
  hit,
  guides,
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
  offset: [number, number, number]
  targets: SnapTargets
  /** Tots els objectes: les arestes dels altres també enganxen. */
  others: RefObject[]
  onSelect?: (id: string) => void
  onMove?: (id: string, pos: { x: number; y: number; z: number }) => void
}) {
  const controls = useOrbitControls()
  const [drag, setDrag] = useState<{ x: number; y: number; z: number; axes: Axis[]; snapped: Axis[] } | null>(null)
  const latest = useLatest(drag)
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
  // Obstacle en blau; objecte que talla en verd; seleccionat en taronja; amb problema (o que talla i no toca res) en vermell.
  const tint = hit ? "#dc2626" : selected ? SELECT_COLOR : g.effect === "cut" ? "#16a34a" : "#3b82f6"
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
  // Direccions que es poden moure (els enganxaments en fixen alguna); la que mira a la càmera (una vista de costat o de
  // dalt) no es pot arrossegar i s'amaga.
  const facing = useFacingAxis()
  const gizmoAxes = (["x", "y", "z"] as Axis[]).filter((a) => !(a === "y" && g.onFloor) && !(a === "z" && g.onWall) && a !== facing)

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
        <meshStandardMaterial side={DoubleSide} color={hover && !selected && !hit ? SELECT_COLOR : tint} transparent opacity={outline ? 0.08 : selected || hit ? 0.38 : g.effect === "cut" ? 0.15 : hover ? 0.32 : 0.22} depthWrite={false} depthTest={g.effect !== "cut"} />
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
