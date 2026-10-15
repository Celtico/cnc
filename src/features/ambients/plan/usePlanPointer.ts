import { useRef, type Dispatch, type PointerEvent as RPointerEvent, type RefObject, type SetStateAction } from "react"
import { expandWalls, moveWalls, newId, roomWalls, snapToWalls, wallLength, addOpening, clampOpening, nearestWall, type Ambient, type AmbientItem, type PlanPt, type Wall } from "../../../core/model"
import { toaster } from "../../../components/ui/toaster"
import type { ItemGeometry } from "../ambientData"
import { nearestEndpoint, samePt, snapAngle, snapGrid, type Selection, type Tool, type View } from "../planGeom"
import { joinedAt, movedEnds, moveWhole, wallMap, type Drag } from "./planDrag"
import type { PlanTools } from "./usePlanTools"

/**
 * El punter sobre el plànol: pessigar, desplaçar, les eines (ploma, habitació, finestres i portes, calibrar) i arrossegar
 * elements, parets, extrems, punts de control, obertures i el plànol de fons.
 */
export function usePlanPointer({
  ambient,
  geos,
  tool,
  snap,
  wallDefaults,
  onChange,
  onSelect,
  onToolDone,
  onCalibrate,
  onPickItem,
  onPickWall,
  host,
  view,
  setView,
  toWorld,
  tools,
}: {
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  tool: Tool
  /** Imant (opcions de vista). */
  snap: boolean
  wallDefaults: { thickness: number; height: number }
  onChange: (a: Ambient, commit: boolean) => void
  onSelect: (s: Selection) => void
  onToolDone: () => void
  onCalibrate: (a: PlanPt, b: PlanPt) => void
  onPickItem: (id: string) => string[]
  onPickWall?: (id: string) => string[]
  host: RefObject<HTMLDivElement | null>
  view: View
  setView: Dispatch<SetStateAction<View>>
  toWorld: (clientX: number, clientY: number) => PlanPt
  tools: PlanTools
}) {
  const { setRoom, chain, setChain, penOut, setPenOut, penStraight, setPenStraight, setCursor, calib, setCalib, space } = tools
  const drag = useRef<Drag | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; cx: number; cy: number; view: View } | null>(null)

  const tolMm = 12 / view.s

  /** Punt de la ploma: imant als extrems i angle a 15° (Maj: el tram recte, sense nansa; Alt: del tot lliure, al mm). */
  const penPoint = (raw: PlanPt, e: { shiftKey: boolean; altKey: boolean }): PlanPt => {
    if (!e.altKey && snap) {
      const first = chain[0]
      if (first && chain.length >= 2 && Math.hypot(raw[0] - first[0], raw[1] - first[1]) < tolMm) return first
      const near = nearestEndpoint(ambient.walls, raw, tolMm)
      if (near) return near
    }
    if (e.altKey) return [Math.round(raw[0]), Math.round(raw[1])]
    const last = chain.at(-1)
    if (last) return snapAngle(last, raw)
    return [snapGrid(raw[0]), snapGrid(raw[1])]
  }

  const onDown = (e: RPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }]
      const r = host.current!.getBoundingClientRect()
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, view }
      drag.current = null
      return
    }
    const p = toWorld(e.clientX, e.clientY)
    if (e.button === 1 || space.current) {
      drag.current = { kind: "pan", x: e.clientX, y: e.clientY, view }
      return
    }
    if (tool === "wall") {
      const q = penPoint(p, e)
      const last = chain.at(-1)
      if (last && samePt(last, q)) return
      let wallId: string | undefined
      if (last) {
        // La nansa del punt d'abans (clic i arrossegar) fa la paret corba: surt amb aquella direcció.
        const w: Wall = { id: newId("w"), a: last, b: q, thickness: wallDefaults.thickness, height: wallDefaults.height, ...(penOut && !e.shiftKey ? { curve: { c1: [last[0] + penOut[0], last[1] + penOut[1]] as PlanPt, c2: q } } : {}) }
        wallId = w.id
        onChange({ ...ambient, walls: [...ambient.walls, w] }, true)
      }
      setPenOut(null)
      // Tancar la cadena al primer punt.
      if (chain.length >= 2 && samePt(q, chain[0]!)) {
        setChain([])
        onToolDone()
        return
      }
      setChain([...chain, q])
      // Arrossegar abans de deixar anar: la nansa d'aquest punt (com Figma).
      drag.current = { kind: "pen", start: q, at: q, ...(wallId ? { wallId } : {}), moved: false }
      return
    }
    if (tool === "room") {
      const s: PlanPt = [snapGrid(p[0], 50), snapGrid(p[1], 50)]
      drag.current = { kind: "room", start: s, cur: s }
      setRoom({ a: s, b: s })
      return
    }
    if (tool === "window" || tool === "door") {
      // Finestra o porta: clic sobre una paret, centrada on s'ha clicat.
      // Les parets corbes no porten finestres ni portes.
      const hit = nearestWall(ambient.walls.filter((w) => !w.curve), p, 12 / view.s)
      if (!hit) return
      // No trepitja les que ja hi són: al forat lliure més proper o, si no n'hi ha, no es posa.
      const next = addOpening(hit.wall, tool, snapGrid(hit.at))
      if (!next) {
        toaster.create({ title: "No hi cap", description: "Aquesta paret no té cap tros lliure prou ample.", type: "info" })
        return
      }
      onChange({ ...ambient, walls: ambient.walls.map((w) => (w.id === hit.wall.id ? next : w)) }, true)
      onSelect({ kind: "wall", id: hit.wall.id })
      onToolDone()
      return
    }
    if (tool === "calibrate") {
      const next = [...calib, p]
      if (next.length === 2) {
        setCalib([])
        onCalibrate(next[0]!, next[1]!)
      } else setCalib(next)
      return
    }
    // Seleccionar: el fons desselecciona i desplaça.
    onSelect(null)
    drag.current = { kind: "pan", x: e.clientX, y: e.clientY, view }
  }

  const onMove = (e: RPointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }]
      const r = host.current!.getBoundingClientRect()
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top
      const v0 = pinch.current.view
      const s = Math.min(3, Math.max(0.005, (v0.s * d) / pinch.current.d))
      const wx = (pinch.current.cx - v0.tx) / v0.s, wy = (pinch.current.cy - v0.ty) / v0.s
      setView({ s, tx: cx - wx * s, ty: cy - wy * s })
      return
    }
    const p = toWorld(e.clientX, e.clientY)
    const g = drag.current
    if (tool === "wall") {
      setCursor(penPoint(p, e))
      if (penStraight !== e.shiftKey) setPenStraight(e.shiftKey)
    }
    else if (tool === "calibrate") setCursor(p)
    if (!g) return
    if (g.kind === "pan") {
      setView({ ...g.view, tx: g.view.tx + e.clientX - g.x, ty: g.view.ty + e.clientY - g.y })
      return
    }
    const dx = p[0] - g.start[0], dy = p[1] - g.start[1]
    if (g.kind === "room") {
      const cur: PlanPt = [snapGrid(p[0], 50), snapGrid(p[1], 50)]
      g.cur = cur
      setRoom({ a: g.start, b: cur })
    } else if (g.kind === "item") {
      g.moved = g.moved || Math.hypot(dx, dy) * view.s > 3
      if (!g.moved) return
      // Alt: del tot lliure (al mm, sense quadrícula ni parets).
      let ox = e.altKey ? Math.round(dx) : snapGrid(dx), oy = e.altKey ? Math.round(dy) : snapGrid(dy)
      // Un sol element: s'arramba a les parets (Alt: sense imant). Un grup es mou sencer.
      if (g.ids.length === 1 && !e.altKey && snap) {
        const it = ambient.items.find((x) => x.id === g.ids[0])
        const geo = geos.get(g.ids[0]!)
        const f = g.from.get(g.ids[0]!)
        if (it && geo && f) {
          const sn = snapToWalls(f[0] + ox, f[1] + oy, geo.w, geo.d, it.rot, expandWalls(ambient.walls), 14 / view.s)
          ox = Math.round(sn.x - f[0])
          oy = Math.round(sn.y - f[1])
        }
      }
      // Les parets de la selecció, des d'on eren en començar.
      const walls = g.walls?.length ? ambient.walls.map((w) => moveWalls({ ...ambient, walls: g.walls! }, g.walls!.map((q) => q.id), ox, oy).walls.find((q) => q.id === w.id) ?? w) : ambient.walls
      onChange({ ...ambient, walls, items: ambient.items.map((it) => {
        const f = g.from.get(it.id)
        return f ? { ...it, x: f[0] + ox, y: f[1] + oy } : it
      }) }, false)
    } else if (g.kind === "wall") {
      g.moved = g.moved || Math.hypot(dx, dy) * view.s > 3
      if (!g.moved) return
      const ox = e.altKey ? Math.round(dx) : snapGrid(dx), oy = e.altKey ? Math.round(dy) : snapGrid(dy)
      const na: PlanPt = [g.a[0] + ox, g.a[1] + oy], nb: PlanPt = [g.b[0] + ox, g.b[1] + oy]
      // Les parets enganxades als extrems en començar el segueixen (les cantonades no s'obren); les que toca pel camí, no.
      const ends = new Map<string, Partial<Record<"a" | "b", PlanPt>>>()
      for (const j of g.joinedA) ends.set(j.id, { ...ends.get(j.id), [j.end]: na })
      for (const j of g.joinedB) ends.set(j.id, { ...ends.get(j.id), [j.end]: nb })
      onChange({ ...ambient, walls: ambient.walls.map((w) => (w.id === g.id ? moveWhole(w, g.walls.get(w.id), na, nb, ox, oy) : movedEnds(w, g.walls, ends.get(w.id)))) }, false)
    } else if (g.kind === "ctrl") {
      g.moved = true
      const q: PlanPt = e.altKey ? [Math.round(p[0]), Math.round(p[1])] : [snapGrid(p[0]), snapGrid(p[1])]
      onChange({ ...ambient, walls: ambient.walls.map((x) => (x.id === g.id && x.curve ? { ...x, curve: { ...x.curve, [g.c]: q } } : x)) }, false)
    } else if (g.kind === "pen") {
      // Ploma: clic i arrossegar = la nansa del punt (la paret que hi acaba es corba; la següent en sortirà corba). Amb Maj,
      // recta: sense nansa.
      const h: PlanPt = [Math.round(p[0] - g.at[0]), Math.round(p[1] - g.at[1])]
      if (e.shiftKey) {
        setPenOut(null)
        if (g.wallId) {
          const id = g.wallId
          onChange({ ...ambient, walls: ambient.walls.map((x) => (x.id === id && x.curve ? { ...x, curve: x.curve.c1[0] === x.a[0] && x.curve.c1[1] === x.a[1] ? undefined : { ...x.curve, c2: x.b } } : x)) }, false)
        }
        return
      }
      if (Math.hypot(h[0], h[1]) * view.s < 4) return
      g.moved = true
      setPenOut(h)
      if (g.wallId) {
        const id = g.wallId
        onChange({ ...ambient, walls: ambient.walls.map((x) => (x.id === id ? { ...x, curve: { c1: x.curve?.c1 ?? x.a, c2: [g.at[0] - h[0], g.at[1] - h[1]] } } : x)) }, false)
      }
    } else if (g.kind === "end") {
      g.moved = true
      const w = ambient.walls.find((x) => x.id === g.id)
      if (!w) return
      const other = g.end === "a" ? w.b : w.a
      // Alt: del tot lliure (al mm, sense angle, quadrícula ni extrems); Maj: sense angle, a la quadrícula.
      let q: PlanPt = e.altKey ? [Math.round(p[0]), Math.round(p[1])] : e.shiftKey ? [snapGrid(p[0]), snapGrid(p[1])] : snapAngle(other, p)
      if (!e.altKey) {
        const near = nearestEndpoint(ambient.walls, p, tolMm, (x, end) => x.id === g.id || g.joined.some((j) => j.id === x.id && j.end === end))
        if (near) q = near
      }
      // Només es mouen els extrems que hi eren enganxats en començar (no els que toca pel camí). Les obertures es
      // queden on eren (`setWallEnds`).
      const ends = new Map<string, Partial<Record<"a" | "b", PlanPt>>>([[g.id, { [g.end]: q }]])
      for (const j of g.joined) ends.set(j.id, { ...ends.get(j.id), [j.end]: q })
      onChange({ ...ambient, walls: ambient.walls.map((x) => movedEnds(x, g.walls, ends.get(x.id))) }, false)
    } else if (g.kind === "opening") {
      const w = ambient.walls.find((x) => x.id === g.wallId)
      const o = w?.openings?.[g.index]
      if (!w || !o) return
      g.moved = g.moved || Math.hypot(dx, dy) * view.s > 3
      if (!g.moved) return
      // Es mou al llarg de la paret (projecció del desplaçament).
      const L = wallLength(w) || 1
      const along = (dx * (w.b[0] - w.a[0]) + dy * (w.b[1] - w.a[1])) / L
      const next = clampOpening(w, { ...o, at: e.altKey ? Math.round(g.at + along) : snapGrid(g.at + along) })
      onChange({ ...ambient, walls: ambient.walls.map((x) => (x.id === w.id ? { ...x, openings: x.openings!.map((q, i) => (i === g.index ? next : q)) } : x)) }, false)
    } else if (g.kind === "plan" && ambient.plan) {
      onChange({ ...ambient, plan: { ...ambient.plan, x: Math.round(g.x + dx), y: Math.round(g.y + dy) } }, false)
    }
  }

  const onUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const g = drag.current
    drag.current = null
    if (!g) return
    if (g.kind === "room") {
      setRoom(null)
      const x0 = Math.min(g.start[0], g.cur[0]), x1 = Math.max(g.start[0], g.cur[0])
      const y0 = Math.min(g.start[1], g.cur[1]), y1 = Math.max(g.start[1], g.cur[1])
      if (x1 - x0 >= 500 && y1 - y0 >= 500) {
        onChange({ ...ambient, walls: [...ambient.walls, ...roomWalls(x0, y0, x1, y1, wallDefaults.thickness, wallDefaults.height)] }, true)
        onToolDone()
      }
    } else if ((g.kind === "item" || g.kind === "wall" || g.kind === "end" || g.kind === "opening" || g.kind === "ctrl" || g.kind === "pen") && g.moved) onChange(ambient, true)
    else if (g.kind === "plan") onChange(ambient, true)
  }

  const startItem = (e: RPointerEvent, it: AmbientItem) => {
    if (tool !== "select" || e.button === 1 || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const ids = onPickItem(it.id)
    const from = new Map(ambient.items.filter((x) => ids.includes(x.id)).map((x) => [x.id, [x.x, x.y] as PlanPt]))
    // Les parets de la selecció (múltiple o d'un grup) es mouen amb els elements.
    const walls = ambient.walls.filter((w) => ids.includes(w.id))
    drag.current = { kind: "item", ids: ids.filter((id) => from.has(id)), start: toWorld(e.clientX, e.clientY), from, moved: false, ...(walls.length ? { walls } : {}) }
  }
  const startWall = (e: RPointerEvent, w: Wall) => {
    if (tool !== "select" || e.button === 1 || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const ids = onPickWall ? onPickWall(w.id) : (onSelect({ kind: "wall", id: w.id }), [w.id])
    // Més d'una (selecció múltiple o grup): es mouen totes les triades, i els elements, juntes.
    if (ids.length > 1 || !ids.includes(w.id)) {
      const from = new Map(ambient.items.filter((x) => ids.includes(x.id)).map((x) => [x.id, [x.x, x.y] as PlanPt]))
      drag.current = { kind: "item", ids: [...from.keys()], start: toWorld(e.clientX, e.clientY), from, moved: false, walls: ambient.walls.filter((q) => ids.includes(q.id)) }
      return
    }
    drag.current = { kind: "wall", id: w.id, start: toWorld(e.clientX, e.clientY), a: w.a, b: w.b, moved: false, walls: wallMap(ambient.walls), joinedA: joinedAt(ambient.walls, w.a, w.id), joinedB: joinedAt(ambient.walls, w.b, w.id) }
  }
  const startOpening = (e: RPointerEvent, w: Wall, index: number) => {
    if (tool !== "select" || e.button === 1 || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    onSelect({ kind: "wall", id: w.id })
    drag.current = { kind: "opening", wallId: w.id, index, start: toWorld(e.clientX, e.clientY), at: w.openings![index]!.at, moved: false }
  }
  const startEnd = (e: RPointerEvent, w: Wall, end: "a" | "b") => {
    if (tool !== "select") return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    drag.current = { kind: "end", id: w.id, end, start: toWorld(e.clientX, e.clientY), orig: w[end], moved: false, walls: wallMap(ambient.walls), joined: joinedAt(ambient.walls, w[end], w.id) }
  }
  const startCtrl = (e: RPointerEvent, w: Wall, c: "c1" | "c2") => {
    if (tool !== "select" || !w.curve) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    drag.current = { kind: "ctrl", id: w.id, c, start: toWorld(e.clientX, e.clientY), orig: w.curve[c], moved: false }
  }
  const startPlan = (e: RPointerEvent) => {
    if (tool !== "select" || !ambient.plan || ambient.plan.locked !== false || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    onSelect(null)
    drag.current = { kind: "plan", start: toWorld(e.clientX, e.clientY), x: ambient.plan.x, y: ambient.plan.y }
  }

  // Es llegeix en pintar (com abans): la mà tancada mentre es desplaça.
  const panning = drag.current?.kind === "pan"

  return { onDown, onMove, onUp, startItem, startWall, startOpening, startEnd, startCtrl, startPlan, panning }
}
