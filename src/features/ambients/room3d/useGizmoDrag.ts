import { useThree, type ThreeEvent } from "@react-three/fiber"
import { useMemo, useRef, useState } from "react"
import { Plane, Vector3 } from "three"
import type { Axis } from "../../../components/viewer/pixelScale"
import { expandWalls, rad, snapToWalls, type Ambient } from "../../../core/model"
import type { ItemGeometry } from "../ambientData"
import { snapGrid } from "../planGeom"
import { useOrbitControls } from "../../../components/viewer/orbitControls"

/** El gizmo per moure la selecció al 3D: on va (al centre de la selecció) i l'arrossegament de cada fletxa. */
export function useGizmoDrag({ ambient, geos, selectedIds, onChange, snap, cameraLocked }: { ambient: Ambient; geos: Map<string, ItemGeometry | null>; selectedIds: string[]; onChange?: (a: Ambient, commit: boolean) => void; snap: boolean; cameraLocked: boolean }) {
  // Moure amb el gizmo: cada fletxa en la seva direcció (X o Z del plànol, i la verda en alçada, «Del terra») sobre un pla que conté l'eix i mira a la
  // càmera; la resta, com al plànol (quadrícula, imant a les parets per a un sol element, Alt sense imant, un sol pas
  // de desfer en deixar-lo anar).
  const camera = useThree((st) => st.camera)
  const orbit = useOrbitControls()
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
  return { gizmoAt, activeAxis, startAxis, moveAxis, endAxis }
}
