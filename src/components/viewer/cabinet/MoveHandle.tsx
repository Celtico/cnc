import { useThree, type ThreeEvent } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { useEffect, useRef, useState } from "react"
import { Vector3, type Plane } from "three"
import { axisDragPlane } from "../gizmoDrag"
import { MoveGizmo, type GizmoHandle } from "../MoveGizmo"
import type { Axis } from "../pixelScale"
import { S, SELECT_COLOR } from "./constants"
import { snapToleranceMm } from "../snapTolerance"
import { snapWithGuides, type Guide, type GuideBox } from "../guideSnap"
import { SmartGuides } from "../SmartGuides"
import type { SnapTargets } from "./RefGhost"
import type { ViewerModule } from "./types"
import { useOrbitControls } from "../orbitControls"

/** Elements d'edició (gizmo, etiqueta): la imatge del visor per al render no els porta (`SceneAccess`). */
const EDITOR_ONLY = { editorOnly: true }

/**
 * Gizmo per moure el mòdul seleccionat (o, amb Maj, tot el moble): el mateix de les peces lliures i els objectes (per
 * decisió de l'usuari, 2026-10-22: «que sigui tot unificat»), al mig del mòdul. Només hi ha les fletxes de les direccions
 * que el mòdul es pot moure: al llarg de la fila (vermella), amunt i avall si és penjat (verda), endavant i enrere si és
 * al terra (blava). La bola del mig, lliure pel pla de la paret (penjat) o pel terra. S'enganxa a les vores i al mig dels
 * altres mòduls i dels objectes, amb les guies vermelles del Figma (Alt: lliure).
 */
export function MoveHandle({
  m,
  others,
  planes,
  onDrag,
  onDrop,
}: {
  m: ViewerModule
  /** Caixes on s'enganxa (vores i mig), amb les guies del Figma: els altres mòduls i els objectes. */
  others: GuideBox[]
  /** Terra i paret. */
  planes: SnapTargets
  onDrag: (d: { index: number; dx: number; dy: number; dz: number; all: boolean } | null) => void
  onDrop: (dx: number, dy: number, dz: number, all: boolean) => void
}) {
  const controls = useOrbitControls()
  // La càmera i la mida d'ara (l'imant va en píxels de pantalla).
  const getThree = useThree((st) => st.get)
  const camera = useThree((st) => st.camera)
  const start = useRef<{ p: Vector3; plane: Plane; all: boolean; axes: Axis[]; handle: GizmoHandle; moved: boolean; at: [number, number] } | null>(null)
  const latest = useRef<{ dx: number; dy: number; dz: number; all: boolean; guides: Guide[] } | null>(null)
  const [live, setLive] = useState<{ dx: number; dy: number; dz: number; all: boolean; guides: Guide[] } | null>(null)
  const [active, setActive] = useState<GizmoHandle | null>(null)
  // Al terra en fila: només al llarg de la fila; penjat: també amunt i avall; al terra lliure: també endavant i enrere.
  // D'esquena a la paret d'un costat: al llarg d'aquella paret (endavant i enrere) i, penjat, amunt i avall.
  const axes: Axis[] = m.side ? ["z", ...(m.wall ? (["y"] as Axis[]) : [])] : ["x", ...(m.wall ? (["y"] as Axis[]) : []), ...(m.free ? (["z"] as Axis[]) : [])]

  const compute = (e: ThreeEvent<PointerEvent>) => {
    const s0 = start.current
    const p = s0 && e.ray.intersectPlane(s0.plane, new Vector3())
    if (!s0 || !p) return null
    const on = (a: Axis) => s0.axes.includes(a)
    // Amb Maj (tot el moble), només al llarg de la fila.
    const raw = { x: on("x") ? (p.x - s0.p.x) / S : 0, y: on("y") && !s0.all ? (p.y - s0.p.y) / S : 0, z: on("z") && !s0.all ? (p.z - s0.p.z) / S : 0 }
    const three = getThree()
    const tol = snapToleranceMm(three.camera, three.size.height, p, S)
    const z0 = m.z ?? 0
    const r = snapWithGuides({ x: m.x + raw.x, y: m.y + raw.y, z: z0 + raw.z, w: m.width, h: m.height, d: m.depth }, s0.axes, others, planes, tol, e.altKey)
    // «Al terra»: endavant i enrere, sense passar la paret.
    const dz = Math.max(-(m.side ? (m.along ?? 0) : z0), Math.round(r.box.z - z0))
    return { dx: Math.round(r.box.x - m.x), dy: Math.round(r.box.y - m.y), dz, all: s0.all, guides: s0.all ? [] : r.guides }
  }
  const begin = (a: GizmoHandle, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const all = e.shiftKey
    const use: Axis[] = all ? ["x"] : a === "free" ? axes : [a]
    // La bola: pel terra si és al terra lliure, si no pel pla de la paret. Amb Maj, la fletxa de la fila.
    const plane = axisDragPlane(all ? "x" : a, camera, e.point, m.side ? new Vector3(1, 0, 0) : m.free ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1))
    if (!plane) return
    start.current = { p: e.point.clone(), plane, all, axes: use, handle: a, moved: false, at: [e.clientX, e.clientY] }
    ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
    setActive(a)
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const s0 = start.current
    if (!s0) return
    e.stopPropagation()
    if (!s0.moved && Math.hypot(e.clientX - s0.at[0], e.clientY - s0.at[1]) < 3) return
    s0.moved = true
    const d = compute(e)
    if (!d) return
    latest.current = d
    setLive(d)
    onDrag({ index: m.index, dx: d.dx, dy: d.dy, dz: d.dz, all: d.all })
  }
  const end = (e: ThreeEvent<PointerEvent>) => {
    if (!start.current) return
    start.current = null
    ;(e.target as Element | null)?.releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    const d = latest.current
    latest.current = null
    setLive(null)
    setActive(null)
    onDrop(d?.dx ?? 0, d?.dy ?? 0, d?.dz ?? 0, d?.all ?? false)
  }
  // Si el mòdul desapareix a mig arrossegament, la càmera torna a girar.
  useEffect(() => () => {
    if (controls) controls.enabled = true
  }, [controls])

  const sign = (v: number) => `${v > 0 ? "+" : ""}${v}`
  const label = live ? (live.all ? `Tot el moble ${sign(live.dx)} mm` : `${sign(live.dx)} mm${live.dy ? ` · ${sign(live.dy)} mm` : ""}${live.dz ? ` · paret ${(m.side ? (m.along ?? 0) : (m.z ?? 0)) + live.dz} mm` : ""}`) : null
  const ox = live?.dx ?? 0, oy = live?.dy ?? 0, oz = live?.dz ?? 0
  const center: [number, number, number] = [(m.x + ox + m.width / 2) * S, (m.y + oy + m.height / 2) * S, ((m.z ?? 0) + oz + m.depth / 2) * S]

  return (
    <>
    {live && <SmartGuides guides={live.guides} />}
    <group position={center} userData={EDITOR_ONLY}>
      <MoveGizmo axes={axes} free={axes.length > 1} active={active} onStart={begin} onMove={move} onEnd={end} />
      {label && (
        <Html position={[0, (m.height / 2) * S, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#fff", background: SELECT_COLOR, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", display: "block", transform: "translateY(-16px)" }}>{label}</span>
        </Html>
      )}
    </group>
    </>
  )
}
