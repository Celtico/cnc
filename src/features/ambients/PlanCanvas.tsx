import { Box } from "@chakra-ui/react"
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react"
import { newId, roomWalls, snapToWalls, wallCorners, wallLength, type Ambient, type AmbientItem, type PlanPt, type Wall } from "../../core/model"
import { formatLength, useUnit } from "../units"
import type { ItemGeometry } from "./ambientData"
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

type Drag =
  | { kind: "pan"; x: number; y: number; view: View }
  | { kind: "item"; id: string; start: PlanPt; x: number; y: number; moved: boolean }
  | { kind: "wall"; id: string; start: PlanPt; a: PlanPt; b: PlanPt; moved: boolean }
  | { kind: "end"; id: string; end: "a" | "b"; start: PlanPt; orig: PlanPt; moved: boolean }
  | { kind: "room"; start: PlanPt; cur: PlanPt }
  | { kind: "plan"; start: PlanPt; x: number; y: number }

/**
 * Plànol de l'ambient (SVG, vista de dalt), amb la manera de fer de Figma: roda o dos dits per
 * desplaçar, Ctrl/⌘ + roda o pessigar per fer zoom, arrossegar el fons per desplaçar. Eines:
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
  onSelect,
  tool,
  onToolDone,
  onChange,
  wallDefaults,
  onCalibrate,
  fitSignal,
}: {
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  names: Map<string, string>
  selection: Selection
  onSelect: (s: Selection) => void
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
    setView(fitView(ambientBox(ambient, geos), size.w, size.h))
  }, [fitSignal, size, ambient, geos])

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
        if (e.ctrlKey || e.metaKey) {
          const k = Math.exp(-e.deltaY * 0.01)
          const s = Math.min(3, Math.max(0.005, v.s * k))
          return { s, tx: px - ((px - v.tx) / v.s) * s, ty: py - ((py - v.ty) / v.s) * s }
        }
        return { ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY }
      })
    }
    el.addEventListener("wheel", wheel, { passive: false })
    return () => el.removeEventListener("wheel", wheel)
  }, [])

  const setItem = (id: string, patch: Partial<AmbientItem>, commit: boolean) =>
    onChange({ ...ambient, items: ambient.items.map((it) => (it.id === id ? ({ ...it, ...patch } as AmbientItem) : it)) }, commit)

  const tolMm = 12 / view.s

  /** Punt de la ploma: imant als extrems i angle a 15° (Maj: lliure; Alt: sense imant). */
  const penPoint = (raw: PlanPt, e: { shiftKey: boolean; altKey: boolean }): PlanPt => {
    if (!e.altKey) {
      const first = chain[0]
      if (first && chain.length >= 2 && Math.hypot(raw[0] - first[0], raw[1] - first[1]) < tolMm) return first
      const near = nearestEndpoint(ambient.walls, raw, tolMm)
      if (near) return near
    }
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
      const it = ambient.items.find((x) => x.id === g.id)
      const geo = geos.get(g.id)
      if (!it || !geo) return
      let x = snapGrid(g.x + dx), y = snapGrid(g.y + dy)
      if (!e.altKey) {
        const s = snapToWalls(x, y, geo.w, geo.d, it.rot, ambient.walls, 14 / view.s)
        x = Math.round(s.x)
        y = Math.round(s.y)
      }
      setItem(g.id, { x, y }, false)
    } else if (g.kind === "wall") {
      g.moved = g.moved || Math.hypot(dx, dy) * view.s > 3
      if (!g.moved) return
      const ox = snapGrid(dx), oy = snapGrid(dy)
      const na: PlanPt = [g.a[0] + ox, g.a[1] + oy], nb: PlanPt = [g.b[0] + ox, g.b[1] + oy]
      // Les parets enganxades als extrems el segueixen (les cantonades no s'obren).
      onChange({ ...ambient, walls: ambient.walls.map((w) => (w.id === g.id ? { ...w, a: na, b: nb } : moveJoined(moveJoined(w, g.a, na, ambient, g.id), g.b, nb, ambient, g.id))) }, false)
    } else if (g.kind === "end") {
      g.moved = true
      const w = ambient.walls.find((x) => x.id === g.id)
      if (!w) return
      const other = g.end === "a" ? w.b : w.a
      let q: PlanPt = e.shiftKey ? [snapGrid(p[0]), snapGrid(p[1])] : snapAngle(other, p)
      if (!e.altKey) {
        const near = nearestEndpoint(ambient.walls, p, tolMm, (x, end) => x.id === g.id || samePt(x[end], w[g.end]))
        if (near) q = near
      }
      const cur = w[g.end]
      onChange({ ...ambient, walls: ambient.walls.map((x) => (x.id === g.id ? { ...x, [g.end]: q } : moveJoined(x, cur, q, ambient, g.id))) }, false)
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
    } else if ((g.kind === "item" || g.kind === "wall" || g.kind === "end") && g.moved) onChange(ambient, true)
    else if (g.kind === "plan") onChange(ambient, true)
  }

  const startItem = (e: RPointerEvent, it: AmbientItem) => {
    if (tool !== "select" || e.button === 1 || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    onSelect({ kind: "item", id: it.id })
    drag.current = { kind: "item", id: it.id, start: toWorld(e.clientX, e.clientY), x: it.x, y: it.y, moved: false }
  }
  const startWall = (e: RPointerEvent, w: Wall) => {
    if (tool !== "select" || e.button === 1 || space.current) return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    onSelect({ kind: "wall", id: w.id })
    drag.current = { kind: "wall", id: w.id, start: toWorld(e.clientX, e.clientY), a: w.a, b: w.b, moved: false }
  }
  const startEnd = (e: RPointerEvent, w: Wall, end: "a" | "b") => {
    if (tool !== "select") return
    e.stopPropagation()
    ;(host.current as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    drag.current = { kind: "end", id: w.id, end, start: toWorld(e.clientX, e.clientY), orig: w[end], moved: false }
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
          <rect x={(-view.tx) / view.s} y={(-view.ty) / view.s} width={size.w / view.s} height={size.h / view.s} fill={view.s > 0.03 ? "url(#amb-grid-major)" : "none"} />

          {ambient.plan && (
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
            const sel = selection?.kind === "item" && selection.id === it.id
            const w = g?.w ?? 600, d = g?.d ?? 600
            return (
              <g key={it.id} transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`} style={{ cursor: tool === "select" ? "move" : undefined }} onPointerDown={(e) => startItem(e, it)}>
                <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={C.item} fillOpacity={0.92} stroke={sel ? C.accent : C.wall} strokeWidth={px(sel ? 2 : 1)} strokeDasharray={g ? undefined : `${px(4)} ${px(3)}`} />
                {g && view.s > 0.04 &&
                  g.rects.map((r, i) => <rect key={i} x={r.x0} y={r.z0} width={Math.max(0.1, r.x1 - r.x0)} height={Math.max(0.1, r.z1 - r.z0)} fill="none" stroke={C.line} strokeWidth={px(0.6)} />)}
                {/* El davant: línia gruixuda. */}
                <line x1={-w / 2} y1={d / 2} x2={w / 2} y2={d / 2} stroke={sel ? C.accent : C.wall} strokeWidth={px(3)} />
                <g transform={`rotate(${-it.rot})`} style={{ pointerEvents: "none" }}>
                  <text textAnchor="middle" style={{ fontSize: px(12) }} fill={C.wall} fontWeight={600} y={px(-2)}>
                    {names.get(it.id)}
                  </text>
                  {g && (
                    <text textAnchor="middle" style={{ fontSize: px(10.5) }} fill={C.muted} y={px(12)}>
                      {Math.round(w)} × {Math.round(d)}
                    </text>
                  )}
                </g>
              </g>
            )
          })}

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

          {/* Mides de les parets (quan hi caben). */}
          {view.s > 0.035 &&
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
    </Box>
  )
}

/** Mou l'extrem de `w` que era a `from` (una paret enganxada a la que s'arrossega). */
function moveJoined(w: Wall, from: PlanPt, to: PlanPt, _a: Ambient, dragging: string): Wall {
  if (w.id === dragging) return w
  if (samePt(w.a, from)) return { ...w, a: to }
  if (samePt(w.b, from)) return { ...w, b: to }
  return w
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
