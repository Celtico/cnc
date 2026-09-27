import { Box } from "@chakra-ui/react"
import type { ModuleBuild } from "../../core/build/buildModule"
import type { ZoneRect } from "../../core/build/layout"
import { walkZones, type Module, type RefObject, type Zone } from "../../core/model"

/**
 * Alçat frontal 2D del mòdul: carcassa, divisors, zones (llums acotades) i fronts.
 * Tocar una zona la selecciona. Coordenades del mòdul (Y amunt) → SVG (Y avall).
 */
export function ElevationEditor({
  module,
  build,
  selectedZoneId,
  onSelectZone,
  references,
  moduleX,
}: {
  module: Module
  build: ModuleBuild
  selectedZoneId: string | null
  onSelectZone: (id: string) => void
  /** Objectes fantasma en coordenades de la composició. */
  references: RefObject[]
  moduleX: number
}) {
  const { width: W, height: H } = module.carcass
  const legs = module.carcass.base.kind === "legs" ? module.carcass.base.height : 0
  const pad = Math.max(W, H) * 0.08
  const total = H + legs
  const stroke = Math.max(W, H) / 500
  const font = Math.max(W, H) / 40

  const leaves: { zone: Zone; rect: ZoneRect }[] = []
  const nodes: { zone: Zone; rect: ZoneRect }[] = []
  walkZones(module.root, (z) => {
    const rect = build.layout.rects.get(z.id)
    if (!rect) return
    if (z.split) nodes.push({ zone: z, rect })
    else leaves.push({ zone: z, rect })
  })

  const panelRects = build.panels
    .filter((p) => ["side", "bottom", "top", "divider", "fixedShelf", "plinth"].includes(p.role))
    .map((p) => frontFootprint(p))
    .filter((r): r is Rect => r !== null)

  return (
    <Box asChild w="full" mx="auto" maxW={`calc(60vh * ${(W + 2 * pad) / (total + 2 * pad)})`} color="fg" style={{ aspectRatio: `${W + 2 * pad} / ${total + 2 * pad}` }} userSelect="none">
      <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${total + 2 * pad}`} style={{ touchAction: "manipulation" }}>
        <g transform={`translate(0 ${total}) scale(1 -1)`}>
          {/* Potes */}
          {legs > 0 && (
            <>
              <rect x={30} y={0} width={40} height={legs} fill="var(--chakra-colors-fg-muted)" opacity={0.5} />
              <rect x={W - 70} y={0} width={40} height={legs} fill="var(--chakra-colors-fg-muted)" opacity={0.5} />
            </>
          )}
          <g transform={`translate(0 ${legs})`}>
            {/* Zones (fulles) */}
            {leaves.map(({ zone, rect }) => {
              const selected = zone.id === selectedZoneId
              const w = rect.x1 - rect.x0
              const h = rect.y1 - rect.y0
              return (
                <g key={zone.id} data-zone={zone.id} onClick={() => onSelectZone(zone.id)} style={{ cursor: "pointer" }}>
                  <rect
                    x={rect.x0}
                    y={rect.y0}
                    width={w}
                    height={h}
                    fill={selected ? "var(--chakra-colors-wood-emphasized)" : "var(--chakra-colors-bg-muted)"}
                    stroke={selected ? "var(--chakra-colors-wood-solid)" : "var(--chakra-colors-border)"}
                    strokeWidth={selected ? stroke * 3 : stroke}
                  />
                  <FrontGlyph zone={zone} rect={rect} stroke={stroke} font={font} />
                  {/* Cotes de la llum */}
                  <g transform={`translate(${rect.x0 + w / 2} ${rect.y0 + h / 2}) scale(1 -1)`}>
                    <text textAnchor="middle" fontSize={font} fill="currentColor" fontFamily="system-ui, sans-serif" y={-font * 0.2}>
                      {Math.round(w)} × {Math.round(h)}
                    </text>
                    <text textAnchor="middle" fontSize={font * 0.8} fill="currentColor" opacity={0.7} fontFamily="system-ui, sans-serif" y={font * 0.9}>
                      {describeZone(zone)}
                    </text>
                  </g>
                </g>
              )
            })}
            {/* Nodes seleccionats: contorn */}
            {nodes
              .filter(({ zone }) => zone.id === selectedZoneId)
              .map(({ zone, rect }) => (
                <rect key={zone.id} x={rect.x0} y={rect.y0} width={rect.x1 - rect.x0} height={rect.y1 - rect.y0} fill="none" stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 3} strokeDasharray={`${stroke * 8} ${stroke * 5}`} />
              ))}
            {/* Panells de la carcassa i divisors */}
            {panelRects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--chakra-colors-wood-muted)" stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke} />
            ))}
            {/* Fantasmes */}
            {references.map((o) => (
              <g key={o.id}>
                <rect x={o.x - moduleX} y={o.y - legs} width={o.w} height={o.h} fill="var(--chakra-colors-blue-500)" fillOpacity={0.12} stroke="var(--chakra-colors-blue-500)" strokeWidth={stroke} strokeDasharray={`${stroke * 6} ${stroke * 4}`} />
                <g transform={`translate(${o.x - moduleX + o.w / 2} ${o.y - legs + o.h - font}) scale(1 -1)`}>
                  <text textAnchor="middle" fontSize={font * 0.8} fill="var(--chakra-colors-blue-500)" fontFamily="system-ui, sans-serif">
                    {o.name}
                  </text>
                </g>
              </g>
            ))}
          </g>
          {/* Cotes generals */}
          <g transform={`translate(${W / 2} ${-pad * 0.45}) scale(1 -1)`}>
            <text textAnchor="middle" fontSize={font} fill="currentColor" fontFamily="system-ui, sans-serif">
              {W}
            </text>
          </g>
          <g transform={`translate(${W + pad * 0.5} ${total / 2}) scale(1 -1) rotate(-90)`}>
            <text textAnchor="middle" fontSize={font} fill="currentColor" fontFamily="system-ui, sans-serif">
              {H}
            </text>
          </g>
        </g>
      </svg>
    </Box>
  )
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Projecció frontal (XY) d'una peça, a partir de la seva col·locació. */
function frontFootprint(p: { placement: { origin: readonly number[]; xAxis: readonly number[]; yAxis: readonly number[]; zAxis: readonly number[] }; length: number; width: number; thickness: number }): Rect | null {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const cx of [0, p.length])
    for (const cy of [0, p.width])
      for (const cz of [0, p.thickness]) {
        const px = o[0]! + cx * x[0]! + cy * y[0]! + cz * z[0]!
        const py = o[1]! + cx * x[1]! + cy * y[1]! + cz * z[1]!
        minX = Math.min(minX, px)
        maxX = Math.max(maxX, px)
        minY = Math.min(minY, py)
        maxY = Math.max(maxY, py)
      }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function describeZone(z: Zone): string {
  const parts: string[] = []
  if (z.shelves && z.shelves.n > 0) parts.push(`${z.shelves.n} prest.${z.shelves.adjustable ? "" : " fixos"}`)
  const f = z.front
  if (f) {
    if (f.kind === "door") parts.push(f.mode === "double" ? "2 portes" : "porta")
    else if (f.kind === "drawers") parts.push(`${f.n} calaixos`)
    else if (f.kind === "flap") parts.push("abatible")
    else if (f.kind === "grille") parts.push("reixeta")
    else parts.push("front fix")
  }
  return parts.length ? parts.join(" · ") : "obert"
}

/** Dibuix esquemàtic del front sobre la zona. */
function FrontGlyph({ zone, rect, stroke, font }: { zone: Zone; rect: ZoneRect; stroke: number; font: number }) {
  const f = zone.front
  const w = rect.x1 - rect.x0
  const h = rect.y1 - rect.y0
  const line = { stroke: "var(--chakra-colors-wood-fg)", strokeWidth: stroke, opacity: 0.6 }
  if (zone.shelves && zone.shelves.n > 0 && (!f || f.kind === "door" || f.kind === "grille")) {
    const n = zone.shelves.n
    const gap = h / (n + 1)
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <line key={i} x1={rect.x0 + w * 0.08} x2={rect.x1 - w * 0.08} y1={rect.y0 + gap * (i + 1)} y2={rect.y0 + gap * (i + 1)} {...line} strokeDasharray={zone.shelves!.adjustable ? `${stroke * 4} ${stroke * 3}` : undefined} />
        ))}
        {f?.kind === "door" && <HingeMarks rect={rect} mode={f.mode} hinge={f.hinge} stroke={stroke} />}
      </>
    )
  }
  if (!f) return null
  if (f.kind === "door") return <HingeMarks rect={rect} mode={f.mode} hinge={f.hinge} stroke={stroke} />
  if (f.kind === "drawers") {
    const n = f.n
    const each = h / n
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <line x1={rect.x0} x2={rect.x1} y1={rect.y0 + each * (i + 1)} y2={rect.y0 + each * (i + 1)} {...line} />
            <line x1={rect.x0 + w * 0.35} x2={rect.x1 - w * 0.35} y1={rect.y0 + each * (i + 0.5)} y2={rect.y0 + each * (i + 0.5)} {...line} strokeWidth={stroke * 3} />
          </g>
        ))}
      </>
    )
  }
  if (f.kind === "grille") {
    const n = Math.max(3, Math.min(12, Math.floor(w / 60)))
    const step = w / (n + 1)
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <line key={i} x1={rect.x0 + step * (i + 1)} x2={rect.x0 + step * (i + 1)} y1={rect.y0 + h * 0.1} y2={rect.y1 - h * 0.1} {...line} strokeWidth={stroke * 2} />
        ))}
        {f.hatch && <rect x={rect.x0 + f.hatch.x} y={rect.y0 + f.hatch.y} width={f.hatch.w} height={f.hatch.h} fill="var(--chakra-colors-bg)" stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke} />}
      </>
    )
  }
  if (f.kind === "flap") {
    const y = f.dir === "down" ? rect.y0 + h * 0.08 : rect.y1 - h * 0.08
    return <line x1={rect.x0 + w * 0.1} x2={rect.x1 - w * 0.1} y1={y} y2={y} {...line} strokeWidth={stroke * 3} strokeDasharray={`${font} ${font / 2}`} />
  }
  return <line x1={rect.x0} y1={rect.y0} x2={rect.x1} y2={rect.y1} {...line} />
}

function HingeMarks({ rect, mode, hinge, stroke }: { rect: ZoneRect; mode: "single" | "double"; hinge: "left" | "right"; stroke: number }) {
  const h = rect.y1 - rect.y0
  const w = rect.x1 - rect.x0
  const mark = (x: number, dir: 1 | -1) => (
    <g key={`${x}${dir}`}>
      <line x1={x} y1={rect.y0 + h * 0.15} x2={x} y2={rect.y1 - h * 0.15} stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke * 3} opacity={0.7} />
      <polyline points={`${x},${rect.y0 + h * 0.5 - h * 0.08} ${x + dir * w * 0.06},${rect.y0 + h * 0.5} ${x},${rect.y0 + h * 0.5 + h * 0.08}`} fill="none" stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke} opacity={0.7} />
    </g>
  )
  if (mode === "double") {
    return (
      <>
        {mark(rect.x0 + w * 0.04, 1)}
        {mark(rect.x1 - w * 0.04, -1)}
        <line x1={rect.x0 + w / 2} x2={rect.x0 + w / 2} y1={rect.y0} y2={rect.y1} stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke} opacity={0.6} />
      </>
    )
  }
  return hinge === "left" ? mark(rect.x0 + w * 0.04, 1) : mark(rect.x1 - w * 0.04, -1)
}
