import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { toaster } from "../../components/ui/toaster"
import { imageToPlaneAt } from "../../core/photo/camera"
import type { Pt } from "../../core/photo/homography"
import { floorDepth } from "../../core/photo/measure"
import type { PhotoCalibration } from "../../db/db"
import { AXIS_MM, newMeasureId, type DepthResult, type Drag, type SetCal, type Tool, type Vec3m } from "./calibration"
import type { CalibrationScene } from "./useCalibrationScene"

/** Eina activa i tot el que fa el dit sobre la foto: marcar punts i mesures, i arrossegar punts, origen, eixos i moble. */
export function usePhotoPointer(W: number, H: number, cal: PhotoCalibration, setCal: SetCal, scene: CalibrationScene) {
  const { calibrated, measures, camera, homography, floor, wallOffset, toSupport, originScaleNow, originX, originY, originZ, axes } = scene
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [tool, setTool] = useState<Tool>("none")
  /** Punts de la mesura que s'està marcant. */
  const [pending, setPending] = useState<Pt[]>([])
  /** Punt sota el dit mentre s'arrossega (lupa). */
  const [lens, setLens] = useState<Pt | null>(null)
  const [depthResult, setDepthResult] = useState<DepthResult | null>(null)

  const toImage = (e: ReactPointerEvent): Pt | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return [Math.max(0, Math.min(W, pt.x)), Math.max(0, Math.min(H, pt.y))]
  }

  const finishPending = (pts: Pt[]) => {
    const kind = tool === "rect" ? "rect" : "distance"
    const n = measures.length + 1
    const name = kind === "rect" ? `Rectangle ${n}` : `Mesura ${n}`
    setCal((c) => ({ ...c, measures: [...(c.measures ?? []), { id: newMeasureId(), name, kind, points: pts }] }))
    setPending([])
    setTool("none")
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toImage(e)
    if (!p) return
    const target = e.target as SVGElement
    const idx = target.dataset.point
    const axisAttr = target.dataset.axis
    const measureId = target.dataset.measure
    const floorIdx = target.dataset.floor
    if (tool === "origin" && calibrated) {
      const q = toSupport(p)
      if (q) setCal((c) => ({ ...c, originMm: [Math.round(q[0]), Math.round(q[1]), 0], ...originScaleNow, origin: undefined, offset: [0, 0], offsetZ: 0 }))
      setTool("none")
      drag.current = { kind: "origin", z: 0 }
    } else if ((tool === "distance" || tool === "rect") && calibrated) {
      const next = [...pending, p]
      const need = tool === "rect" ? 4 : 2
      if (next.length >= need) finishPending(next)
      else setPending(next)
      drag.current = null
      setLens(p)
    } else if (tool === "floor" && calibrated) {
      const next = [...pending, p]
      if (next.length === 2) {
        setCal((c) => ({ ...c, floorLine: [next[0]!, next[1]!] }))
        setPending([])
        setTool("none")
      } else setPending(next)
      setLens(p)
    } else if (tool === "depth" && calibrated) {
      if (camera && floor) {
        const d = floorDepth(camera, p, floor.y, wallOffset)
        if (d) setDepthResult({ ...d, at: p })
        else toaster.create({ title: "Aquest punt no és a terra", type: "warning" })
      }
      setTool("none")
    } else if (target.dataset.originCenter !== undefined) {
      drag.current = { kind: "origin", z: originZ }
    } else if (axisAttr !== undefined && axes) {
      const axis = Number(axisAttr) as 0 | 1 | 2
      const end = axes.ends[axis]
      const dx = end[0] - axes.o[0]
      const dy = end[1] - axes.o[1]
      const len = Math.hypot(dx, dy) || 1
      drag.current = { kind: "axis", axis, start: p, o0: [originX, originY, originZ], dir: [dx / len, dy / len], pxPerMm: len / AXIS_MM }
    } else if (measureId !== undefined) {
      drag.current = { kind: "measure", id: measureId, index: Number(target.dataset.index) }
      setLens(p)
    } else if (floorIdx !== undefined) {
      drag.current = { kind: "floor", index: Number(floorIdx) }
      setLens(p)
    } else if (idx !== undefined) {
      drag.current = { kind: "point", index: Number(idx) }
      setLens(p)
    } else if (!calibrated) {
      setCal((c) => ({ ...c, points: [...c.points, p] }))
      drag.current = { kind: "point", index: cal.points.length }
      setLens(p)
    } else {
      drag.current = { kind: "cabinet", start: p, offset0: cal.offset }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const p = toImage(e)
    if (!p) return
    if (d.kind === "origin") {
      const q = camera ? imageToPlaneAt(camera, p, -wallOffset + d.z) : null
      if (q) setCal((c) => ({ ...c, originMm: [Math.round(q[0]), Math.round(q[1]), Math.round(d.z)], ...originScaleNow, origin: undefined }))
    } else if (d.kind === "axis") {
      const along = ((p[0] - d.start[0]) * d.dir[0] + (p[1] - d.start[1]) * d.dir[1]) / Math.max(d.pxPerMm, 1e-6)
      const next: Vec3m = [...d.o0]
      next[d.axis] = Math.round(d.o0[d.axis] + along)
      if (d.axis === 2) next[2] = Math.max(0, next[2]) // no dins de la paret
      setCal((c) => ({ ...c, originMm: [Math.round(next[0]), Math.round(next[1]), Math.round(next[2])], ...originScaleNow, origin: undefined }))
    } else if (d.kind === "point") {
      setLens(p)
      setCal((c) => {
        const points = [...c.points]
        if (d.index < points.length) points[d.index] = p
        return { ...c, points }
      })
    } else if (d.kind === "measure") {
      setLens(p)
      setCal((c) => ({ ...c, measures: (c.measures ?? []).map((m) => (m.id === d.id ? { ...m, points: m.points.map((q, i) => (i === d.index ? p : q)) } : m)) }))
    } else if (d.kind === "floor") {
      setLens(p)
      setCal((c) => (c.floorLine ? { ...c, floorLine: d.index === 0 ? [p, c.floorLine[1]] : [c.floorLine[0], p] } : c))
    } else if (homography) {
      const a = toSupport(d.start)
      const b = toSupport(p)
      if (a && b) setCal((c) => ({ ...c, offset: [Math.round(d.offset0[0] + b[0] - a[0]), Math.round(d.offset0[1] + b[1] - a[1])] }))
    }
  }

  const onPointerUp = () => {
    drag.current = null
    setLens(null)
  }

  return { svgRef, tool, setTool, pending, setPending, lens, depthResult, setDepthResult, onPointerDown, onPointerMove, onPointerUp }
}
