import { Box, HStack, IconButton, Text } from "@chakra-ui/react"
import { LuMinus, LuPlus } from "react-icons/lu"
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react"
import { footprintBox, newId, roomWalls, snapToWalls, wallCorners, wallLength, addOpening, clampOpening, nearestWall, setWallEnds, type Ambient, type AmbientItem, type PlanPt, type Wall } from "../../core/model"
import { toaster } from "../../components/ui/toaster"
import { formatLength, useUnit } from "../units"
import { isEmptyGeometry, type ItemGeometry } from "./ambientData"
import { ambientBox, fitView, nearestEndpoint, samePt, snapAngle, snapGrid, type Selection, type Tool, type View } from "./planGeom"

const C = {
  wall: "var(--chakra-colors-fg)",
  accent: "var(--chakra-colors-wood-solid)",
  accentFg: "var(--chakra-colors-wood-fg)",
  item: "var(--chakra-colors-bg-panel)",
  line: "var(--chakra-colors-border-emphasized)",
  muted: "var(--chakra-colors-fg-muted)",
  grid: "var(--chakra-colors-border)",
  gridMajor: "var(--chakra-colors-border-emphasized)",
}

export interface PlanShow {
  grid: boolean
  dims: boolean
  labels: boolean
  detail: boolean
  snap: boolean
  plan: boolean
}
const PLAN_SHOW_ALL: PlanShow = { grid: true, dims: true, labels: true, detail: true, snap: true, plan: true }

/** Extrem d'una altra paret enganxat al que s'arrossega (es mira en començar: després només es mouen aquests). */
type Joined = { id: string; end: "a" | "b" }

type Drag =
  | { kind: "pan"; x: number; y: number; view: View }
  | { kind: "item"; ids: string[]; start: PlanPt; from: Map<string, PlanPt>; moved: boolean }
  | { kind: "wall"; id: string; start: PlanPt; a: PlanPt; b: PlanPt; moved: boolean; walls: Map<string, Wall>; joinedA: Joined[]; joinedB: Joined[] }
  | { kind: "end"; id: string; end: "a" | "b"; start: PlanPt; orig: PlanPt; moved: boolean; walls: Map<string, Wall>; joined: Joined[] }
  | { kind: "room"; start: PlanPt; cur: PlanPt }
  | { kind: "plan"; start: PlanPt; x: number; y: number }
  | { kind: "opening"; wallId: string; index: number; start: PlanPt; at: number; moved: boolean }

/**
 * Plànol de l'ambient (SVG, vista de dalt): la roda fa zoom al punt del ratolí (com al 3D),
 * pessigar també; arrossegar el fons (o espai + arrossegar) desplaça; Maj + roda, de costat.
 * Botons − / + amb el percentatge a baix a la dreta. Eines:
 * **Seleccionar** (moure elements i parets, arrossegar els extrems de les parets), **Paret**
 * (ploma: clic a clic, angle a 15° i imant als extrems; clicar el primer punt tanca; Retorn,
 * Esc o doble clic acaben), **Habitació** (arrossegar un rectangle: quatre parets) i
 * **Calibrar** (dos punts sobre el plànol de fons). Maj: sense angles; Alt: sense imant.
 */
export function PlanCanvas({
  ambient,
  geos,
  names,
  selection,
  selectedIds,
  onSelect,
  onPickItem,
  tool,
  onToolDone,
  onChange,
  wallDefaults,
  onCalibrate,
  fitSignal,
  onFramedChange,
  show = PLAN_SHOW_ALL,
}: {
  /** La vista és la d'«Encabir» (el botó surt marcat) o s'ha mogut. */
  onFramedChange?: (framed: boolean) => void
  /** Opcions de vista: graella, mides de les parets, noms, detall de les peces, imant. */
  show?: PlanShow
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  names: Map<string, string>
  selection: Selection
  /** Elements seleccionats (un, o tots els d'un grup). */
  selectedIds: string[]
  onSelect: (s: Selection) => void
  /** Clic a un element: tria què se selecciona (el grup o l'element, com Figma) i torna els ids a moure. */
  onPickItem: (id: string) => string[]
  tool: Tool
  onToolDone: () => void
  /** `commit`: afegir un pas de desfer (en deixar anar); si no, és un canvi en viu. */
  onChange: (a: Ambient, commit: boolean) => void
  wallDefaults: { thickness: number; height: number }
  onCalibrate: (a: PlanPt, b: PlanPt) => void
  /** Canvia per tornar a encabir la vista. */
  fitSignal: number
}) {
  const unit = useUnit()
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ tx: 0, ty: 0, s: 0.1 })
  const drag = useRef<Drag | null>(null)
  const [room, setRoom] = useState<{ a: PlanPt; b: PlanPt } | null>(null)
  const [chain, setChain] = useState<PlanPt[]>([])
  const [cursor, setCursor] = useState<PlanPt | null>(null)
  const [calib, setCalib] = useState<PlanPt[]>([])
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; cx: number; cy: number; view: View } | null>(null)
  const space = useRef(false)

  // Mida del requadre.
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  // Encabir en obrir i quan es demana.
  const fitted = useRef(-1)
  useEffect(() => {
    if (size.w < 50 || fitted.current === fitSignal) return
    fitted.current = fitSignal
    const v = fitView(ambientBox(ambient, geos), size.w, size.h)
    setView(v)
    setFitV(v)
  }, [fitSignal, size, ambient, geos])
  // Qualsevol desplaçament o zoom fa una vista nova (un altre objecte): ja no és la d'«Encabir».
  const [fitV, setFitV] = useState<View | null>(null)
  useEffect(() => onFramedChange?.(view === fitV), [view, fitV, onFramedChange])

  // Canviar d'eina buida la ploma i la calibració.
  useEffect(() => {
    setChain([])
    setCalib([])
    setRoom(null)
  }, [tool])

  // Espai: arrossegar per desplaçar (com Figma). Esc / Retorn acaben la ploma.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) return
      if (e.code === "Space") space.current = true
      if (tool === "wall" && (e.key === "Escape" || e.key === "Enter")) {
        setChain([])
        onToolDone()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [tool, onToolDone])

  const toWorld = (clientX: number, clientY: number): PlanPt => {
    const r = host.current!.getBoundingClientRect()
    return [(clientX - r.left - view.tx) / view.s, (clientY - r.top - view.ty) / view.s]
  }

  // Roda: desplaçar; Ctrl/⌘ + roda (o pessigar al trackpad): zoom al punt.
  useEffect(() => {
    const el = host.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left, py = e.clientY - r.top
      setView((v) => {
        // Com al 3D: la roda fa zoom al punt del ratolí (pessigar al trackpad, més fi). Maj + roda: desplaçar.
        if (e.shiftKey) return { ...v, tx: v.tx - (e.deltaX || e.deltaY), ty: v.ty }
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
        const k = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015))
        return zoomAt(v, px, py, k)
      })
    }
    el.addEventListener("wheel", wheel, { passive: false })
    return () => el.removeEventListener("wheel", wheel)
  }, [])

  const tolMm = 12 / view.s

  /** Punt de la ploma: imant als extrems i angle a 15° (Maj: sense angle, a la quadrícula; Alt: del tot lliure, al mm). */
  const penPoint = (raw: PlanPt, e: { shiftKey: boolean; altKey: boolean }): PlanPt => {
    if (!e.altKey && show.snap) {
      const first = chain[0]
      if (first && chain.length >= 2 && Math.hypot(raw[0] - first[0], raw[1] - first[1]) < tolMm) return first
      const near = nearestEndpoint(ambient.walls, raw, tolMm)
      if (near) return near
    }
    if (e.altKey) return [Math.round(raw[0]), Math.round(raw[1])]
    const last = chain.at(-1)
    if (last && !e.shiftKey) return snapAngle(last, raw)
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
      if (last) {
        const w: Wall = { id: newId("w"), a: last, b: q, thickness: wallDefaults.thickness, height: wallDefaults.height }
        onChange({ ...ambient, walls: [...ambient.walls, w] }, true)
      }
      // Tancar la cadena al primer punt.
      if (chain.length >= 2 && samePt(q, chain[0]!)) {
        setChain([])
        onToolDone()
        return
      }
      setChain([...chain, q])
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
      const hit = nearestWall(ambient.walls, p, 12 / view.s)
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
    if (tool === "wall") setCursor(penPoint(p, e))
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
      if (g.ids.length === 1 && !e.altKey && show.snap) {
        const it = ambient.items.find((x) => x.id === g.ids[0])
        const geo = geos.get(g.ids[0]!)
        const f = g.from.get(g.ids[0]!)
        if (it && geo && f) {
          const sn = snapToWalls(f[0] + ox, f[1] + oy, geo.w, geo.d, it.rot, ambient.walls, 14 / view.s)
          ox = Math.round(sn.x - f[0])
          oy = Math.round(sn.y - f[1])
        }
      }
      onChange({ ...ambient, items: ambient.items.map((it) => {
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
      onChange({ ...ambient, walls: ambient.walls.map((w) => (w.id === g.id ? { ...w, a: na, b: nb } : movedEnds(w, g.walls, ends.get(w.id)))) }, false)
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
    } else if ((g.kind === "item" || g.kind === "wall" || g.kind === "end" || g.kind === "opening") && g.moved) onChange(ambient, true)
    else if (g.kind === "plan") onChange(ambient, true)
  }

  const startItem = (e: RPointerEvent, it: AmbientItem) => {
    if (tool !== "select" || e.button === 1 || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const ids = onPickItem(it.id)
    const from = new Map(ambient.items.filter((x) => ids.includes(x.id)).map((x) => [x.id, [x.x, x.y] as PlanPt]))
    drag.current = { kind: "item", ids, start: toWorld(e.clientX, e.clientY), from, moved: false }
  }
  const startWall = (e: RPointerEvent, w: Wall) => {
    if (tool !== "select" || e.button === 1 || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    onSelect({ kind: "wall", id: w.id })
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
  const startPlan = (e: RPointerEvent) => {
    if (tool !== "select" || !ambient.plan || ambient.plan.locked !== false || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    onSelect(null)
    drag.current = { kind: "plan", start: toWorld(e.clientX, e.clientY), x: ambient.plan.x, y: ambient.plan.y }
  }

  const px = (n: number) => n / view.s
  const selWall = selection?.kind === "wall" ? ambient.walls.find((w) => w.id === selection.id) : undefined
  const cursorStyle = tool === "select" ? (drag.current?.kind === "pan" ? "grabbing" : "default") : "crosshair"

  return (
    <Box
      ref={host}
      position="absolute"
      inset={0}
      overflow="hidden"
      bg="bg.subtle"
      rounded="md"
      borderWidth="1px"
      style={{ touchAction: "none", cursor: cursorStyle }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => setCursor(null)}
      onDoubleClick={() => {
        if (tool === "wall") {
          setChain([])
          onToolDone()
        }
      }}
    >
      <svg width={size.w} height={size.h} style={{ display: "block", userSelect: "none" }} aria-label="Plànol de l'ambient">
        <defs>
          <pattern id="amb-grid" width={100} height={100} patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke={C.grid} strokeWidth={px(0.5)} />
          </pattern>
          <pattern id="amb-grid-major" width={1000} height={1000} patternUnits="userSpaceOnUse">
            <rect width={1000} height={1000} fill="url(#amb-grid)" />
            <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke={C.gridMajor} strokeWidth={px(1)} />
          </pattern>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <rect x={(-view.tx) / view.s} y={(-view.ty) / view.s} width={size.w / view.s} height={size.h / view.s} fill={show.grid && view.s > 0.03 ? "url(#amb-grid-major)" : "none"} />

          {ambient.plan && show.plan && (
            <image
              href={ambient.plan.src}
              x={ambient.plan.x}
              y={ambient.plan.y}
              width={ambient.plan.pxW * ambient.plan.mmPerPx}
              height={ambient.plan.pxH * ambient.plan.mmPerPx}
              opacity={ambient.plan.opacity}
              preserveAspectRatio="none"
              style={{ cursor: tool === "select" && ambient.plan.locked === false ? "move" : undefined, pointerEvents: tool === "select" && ambient.plan.locked === false ? "auto" : "none" }}
              onPointerDown={startPlan}
            />
          )}

          {/* Elements (mobles i blocs) sota les parets, en vista de dalt. */}
          {ambient.items.map((it) => {
            const g = geos.get(it.id)
            const sel = selectedIds.includes(it.id)
            // Sense geometria (esborrat) o buit (moble nou sense mòduls): requadre discontinu de 600 × 600.
            const ghost = !g || isEmptyGeometry(g)
            const w = ghost ? 600 : g.w, d = ghost ? 600 : g.d
            return (
              <g key={it.id} transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`} style={{ cursor: tool === "select" ? "move" : undefined }} onPointerDown={(e) => startItem(e, it)}>
                <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={C.item} fillOpacity={0.92} stroke={sel ? C.accent : C.wall} strokeWidth={px(sel ? 2 : 1)} strokeDasharray={ghost ? `${px(4)} ${px(3)}` : undefined} />
                {g && show.detail && view.s > 0.04 &&
                  g.rects.map((r, i) => <rect key={i} x={r.x0} y={r.z0} width={Math.max(0.1, r.x1 - r.x0)} height={Math.max(0.1, r.z1 - r.z0)} fill="none" stroke={C.line} strokeWidth={px(0.6)} />)}
                {/* El davant: línia gruixuda. */}
                <line x1={-w / 2} y1={d / 2} x2={w / 2} y2={d / 2} stroke={sel ? C.accent : C.wall} strokeWidth={px(3)} />
                {/* El nom (i la mida) només si hi cap a la pantalla: si no, tapaven els veïns i el plànol. */}
                {show.labels && labelFits(names.get(it.id) ?? "", w, d, it.rot, view.s, 12, 18) && <g transform={`rotate(${-it.rot})`} style={{ pointerEvents: "none" }}>
                  <text textAnchor="middle" style={{ fontSize: px(12) }} fill={C.wall} fontWeight={600} y={px(-2)}>
                    {names.get(it.id)}
                  </text>
                  {!ghost && labelFits(`${Math.round(w)} × ${Math.round(d)}`, w, d, it.rot, view.s, 10.5, 34) && (
                    <text textAnchor="middle" style={{ fontSize: px(10.5) }} fill={C.muted} y={px(12)}>
                      {Math.round(w)} × {Math.round(d)}
                    </text>
                  )}
                </g>}
              </g>
            )
          })}

          {/* Caixa del grup seleccionat (discontínua), com a l'editor. */}
          {(selection?.kind === "group" || selection?.kind === "multi") &&
            (() => {
              const bs = ambient.items.filter((i) => selectedIds.includes(i.id)).flatMap((i) => {
                const g = geos.get(i.id)
                return g ? [isEmptyGeometry(g) ? footprintBox(i.x, i.y, 600, 600, i.rot) : footprintBox(i.x, i.y, g.w, g.d, i.rot)] : []
              })
              if (!bs.length) return null
              const x0 = Math.min(...bs.map((b) => b.x0)), y0 = Math.min(...bs.map((b) => b.y0)), x1 = Math.max(...bs.map((b) => b.x1)), y1 = Math.max(...bs.map((b) => b.y1))
              return <rect x={x0 - px(6)} y={y0 - px(6)} width={x1 - x0 + px(12)} height={y1 - y0 + px(12)} fill="none" stroke={C.accent} strokeWidth={px(1.5)} strokeDasharray={`${px(6)} ${px(4)}`} style={{ pointerEvents: "none" }} />
            })()}
          {ambient.walls.map((w) => {
            const sel = selWall?.id === w.id
            return (
              <polygon
                key={w.id}
                points={wallCorners(w).map((p) => p.join(",")).join(" ")}
                fill={sel ? C.accent : C.wall}
                stroke={sel ? C.accent : C.wall}
                strokeWidth={px(0.5)}
                style={{ cursor: tool === "select" ? "move" : undefined }}
                onPointerDown={(e) => startWall(e, w)}
              />
            )
          })}
          {/* Finestres, portes i vidrieres: el forat de la paret amb el vidre (o la fulla) al mig. S'arrosseguen al llarg de la paret. */}
          {ambient.walls.map((w) => {
            if (!w.openings?.length) return null
            const deg = (Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]) * 180) / Math.PI
            const t = w.thickness
            return (
              <g key={`o-${w.id}`} transform={`translate(${w.a[0]} ${w.a[1]}) rotate(${deg})`}>
                {w.openings.map((o, i) => {
                  const u0 = o.at - o.w / 2, u1 = o.at + o.w / 2
                  return (
                    <g key={i} style={{ cursor: tool === "select" ? "ew-resize" : undefined, pointerEvents: tool === "select" ? "auto" : "none" }} onPointerDown={(e) => startOpening(e, w, i)}>
                      <rect x={u0} y={-t / 2} width={u1 - u0} height={t} fill="var(--chakra-colors-bg)" stroke={selWall?.id === w.id ? C.accent : C.wall} strokeWidth={px(1)} />
                      {o.kind === "door" ? (
                        <path d={`M ${u0} ${t / 2} L ${u0} ${t / 2 + (u1 - u0)} A ${u1 - u0} ${u1 - u0} 0 0 0 ${u1} ${t / 2}`} fill="none" stroke={C.muted} strokeWidth={px(1)} />
                      ) : (
                        <line x1={u0} y1={0} x2={u1} y2={0} stroke={C.wall} strokeWidth={px(o.kind === "glazing" ? 3 : 1.5)} />
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* Mides de les parets (quan hi caben). */}
          {show.dims && view.s > 0.035 &&
            ambient.walls.map((w) => {
              const L = wallLength(w)
              if (L * view.s < 60) return null
              const mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2
              let ang = (Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]) * 180) / Math.PI
              if (ang > 90 || ang < -90) ang += 180
              const off = w.thickness / 2 + px(10)
              const nx = -Math.sin((ang * Math.PI) / 180) * off, ny = Math.cos((ang * Math.PI) / 180) * off
              return (
                <text key={`l${w.id}`} x={mx - nx} y={my - ny} transform={`rotate(${ang} ${mx - nx} ${my - ny})`} textAnchor="middle" dominantBaseline="middle" fill={C.muted} style={{ fontSize: px(11), pointerEvents: "none" }}>
                  {formatLength(Math.round(L), unit)}
                </text>
              )
            })}

          {/* Extrems de la paret seleccionada: s'arrosseguen. */}
          {selWall &&
            (["a", "b"] as const).map((end) => (
              <circle key={end} cx={selWall[end][0]} cy={selWall[end][1]} r={px(6)} fill="white" stroke={C.accent} strokeWidth={px(2)} style={{ cursor: "grab" }} onPointerDown={(e) => startEnd(e, selWall, end)} />
            ))}

          {/* Ploma: punts posats i tram de previsualització amb la mida. */}
          {tool === "wall" && chain.length > 0 && (
            <g style={{ pointerEvents: "none" }}>
              <polyline points={[...chain, ...(cursor ? [cursor] : [])].map((p) => p.join(",")).join(" ")} fill="none" stroke={C.accent} strokeWidth={wallDefaults.thickness} strokeOpacity={0.35} strokeLinejoin="miter" />
              {chain.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={px(4)} fill={i === 0 ? C.accent : "white"} stroke={C.accent} strokeWidth={px(1.5)} />
              ))}
              {cursor && (
                <text x={cursor[0] + px(10)} y={cursor[1] - px(10)} style={{ fontSize: px(12) }} fill={C.accentFg} fontWeight={600}>
                  {formatLength(Math.round(Math.hypot(cursor[0] - chain.at(-1)![0], cursor[1] - chain.at(-1)![1])), unit)}
                </text>
              )}
            </g>
          )}
          {tool === "wall" && chain.length === 0 && cursor && <circle cx={cursor[0]} cy={cursor[1]} r={px(4)} fill={C.accent} style={{ pointerEvents: "none" }} />}

          {room && (
            <g style={{ pointerEvents: "none" }}>
              <rect x={Math.min(room.a[0], room.b[0])} y={Math.min(room.a[1], room.b[1])} width={Math.abs(room.b[0] - room.a[0])} height={Math.abs(room.b[1] - room.a[1])} fill={C.accent} fillOpacity={0.08} stroke={C.accent} strokeWidth={wallDefaults.thickness} strokeOpacity={0.4} />
              <text x={(room.a[0] + room.b[0]) / 2} y={(room.a[1] + room.b[1]) / 2} textAnchor="middle" style={{ fontSize: px(13) }} fill={C.accentFg} fontWeight={600}>
                {formatLength(Math.abs(room.b[0] - room.a[0]), unit)} × {formatLength(Math.abs(room.b[1] - room.a[1]), unit)}
              </text>
            </g>
          )}

          {tool === "calibrate" && (
            <g style={{ pointerEvents: "none" }}>
              {calib[0] && cursor && <line x1={calib[0][0]} y1={calib[0][1]} x2={cursor[0]} y2={cursor[1]} stroke={C.accent} strokeWidth={px(2)} strokeDasharray={`${px(6)} ${px(4)}`} />}
              {calib.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={px(5)} fill={C.accent} />
              ))}
            </g>
          )}
        </g>
      </svg>
      {/* Escala. */}
      <ScaleBar s={view.s} />
      <HStack position="absolute" right={3} bottom={3} gap={1} bg="bg.panel" rounded="md" borderWidth="1px" p={0.5} onPointerDown={(e) => e.stopPropagation()}>
        <IconButton aria-label="Allunyar" title="Allunyar" size="xs" variant="ghost" onClick={() => setView((v) => zoomAt(v, size.w / 2, size.h / 2, 1 / 1.4))}>
          <LuMinus />
        </IconButton>
        {/* Escala de pantalla (96 ppp: 1 px = 0,2646 mm), com als plànols: 1:50, 1:100… */}
        <Text fontSize="xs" color="fg.muted" minW="52px" textAlign="center" title="Escala a la pantalla">
          1:{Math.max(1, Math.round(1 / (view.s * 0.2646)))}
        </Text>
        <IconButton aria-label="Apropar" title="Apropar" size="xs" variant="ghost" onClick={() => setView((v) => zoomAt(v, size.w / 2, size.h / 2, 1.4))}>
          <LuPlus />
        </IconButton>
      </HStack>
    </Box>
  )
}

/** Zoom de la vista al voltant d'un punt de la pantalla. */
function zoomAt(v: View, px: number, py: number, k: number): View {
  const s = Math.min(3, Math.max(0.005, v.s * k))
  return { s, tx: px - ((px - v.tx) / v.s) * s, ty: py - ((py - v.ty) / v.s) * s }
}

/** Mou l'extrem de `w` que era a `from` (una paret enganxada a la que s'arrossega). */
/** Extrems d'altres parets que són al punt `p` (enganxats a la paret `except`). */
function joinedAt(walls: Wall[], p: PlanPt, except: string): Joined[] {
  const out: Joined[] = []
  for (const w of walls) {
    if (w.id === except) continue
    if (samePt(w.a, p)) out.push({ id: w.id, end: "a" })
    if (samePt(w.b, p)) out.push({ id: w.id, end: "b" })
  }
  return out
}

const wallMap = (walls: Wall[]) => new Map(walls.map((w) => [w.id, w]))

/**
 * La paret amb els extrems nous (`ends`), calculada des de com era en començar a arrossegar (`orig`): les obertures es
 * queden al mateix punt i s'ajusten (`setWallEnds`) sense anar perdent posició pas a pas.
 */
function movedEnds(w: Wall, orig: Map<string, Wall>, ends: Partial<Record<"a" | "b", PlanPt>> | undefined): Wall {
  if (!ends) return w
  const w0 = orig.get(w.id) ?? w
  const moved = setWallEnds(w0, ends.a ?? w0.a, ends.b ?? w0.b)
  // La resta de camps (material, gruix…) són els d'ara.
  return { ...w, a: moved.a, b: moved.b, ...(moved.openings ? { openings: moved.openings } : {}) }
}

function ScaleBar({ s }: { s: number }) {
  const unit = useUnit()
  // Una mida rodona que faci entre 60 i 150 px.
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const mm = steps.find((m) => m * s >= 60) ?? 20000
  return (
    <Box position="absolute" left={3} bottom={3} fontSize="xs" color="fg.muted" pointerEvents="none">
      <Box h="6px" w={`${mm * s}px`} borderWidth="1px" borderTopWidth={0} borderColor="fg.muted" />
      {formatLength(mm, unit)}
    </Box>
  )
}

/**
 * El text (horitzontal a la pantalla, de `fontPx`) cap dins de la petjada de l'element (w × d mm, girat `rot` graus) a
 * l'escala `s` (px per mm), amb `minH` px d'alçada com a mínim. L'amplada del text s'estima (≈ 0,55 em per lletra).
 */
function labelFits(text: string, w: number, d: number, rot: number, s: number, fontPx: number, minH: number): boolean {
  const a = (rot * Math.PI) / 180
  const c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a))
  const bw = (w * c + d * sn) * s, bh = (w * sn + d * c) * s
  return bh >= minH && text.length * fontPx * 0.55 <= bw * 1.1
}
