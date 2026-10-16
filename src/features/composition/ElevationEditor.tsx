import { Box } from "@chakra-ui/react"
import type { ModuleBuild } from "../../core/build/buildModule"
import { panelBox, type Placed } from "../../core/build/geometry"
import type { ZoneRect } from "../../core/build/layout"
import { moduleElevation, walkZones, type Module, type RefObject, type Zone } from "../../core/model"

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
  moduleY,
  neighbors = [],
  onSelectModule,
  maxH = "60vh",
}: {
  /** Altres mòduls de la composició (peces en coordenades de la composició), per orientar-se. */
  neighbors?: { id: string; name: string; panels: { placement: { origin: readonly number[]; xAxis: readonly number[]; yAxis: readonly number[]; zAxis: readonly number[] }; length: number; width: number; thickness: number; role: string }[] }[]
  /** Clic a un mòdul veí: passar a editar-lo. */
  onSelectModule?: (id: string) => void
  module: Module
  build: ModuleBuild
  selectedZoneId: string | null
  onSelectZone: (id: string) => void
  /** Objectes fantasma en coordenades de la composició. */
  references: RefObject[]
  moduleX: number
  /** Alçada de la base del mòdul sobre el terra (potes, penjat o apilat). */
  moduleY?: number
  /** Alçada màxima del dibuix (CSS). L'amplada s'hi adapta. */
  maxH?: string
}) {
  const { width: W, height: H } = module.carcass
  const legs = moduleY ?? moduleElevation(module.carcass)
  const hasLegs = module.carcass.base.kind === "legs"
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

  // Veïns: peces frontals en coordenades locals d'aquest mòdul (només se'n veu una franja
  // a cada costat, i a sobre si n'hi ha d'apilats).
  const baseY = legs
  const side = Math.max(W, H) * 0.45
  const neigh = neighbors
    .map((n) => {
      const rects = n.panels
        .filter((p) => p.role !== "back")
        .map((p) => frontFootprint(p))
        .filter((r): r is Rect => r !== null)
        .map((r) => ({ ...r, x: r.x - moduleX, y: r.y - baseY }))
      if (!rects.length) return null
      const x0 = Math.min(...rects.map((r) => r.x))
      const x1 = Math.max(...rects.map((r) => r.x + r.w))
      const y0 = Math.min(...rects.map((r) => r.y))
      const y1 = Math.max(...rects.map((r) => r.y + r.h))
      return { id: n.id, name: n.name, rects, x0, x1, y0, y1 }
    })
    .filter((n): n is NonNullable<typeof n> => n !== null && n.x1 > -side && n.x0 < W + side && n.y0 < H + side)
  const vx0 = Math.min(0, ...neigh.map((n) => Math.max(n.x0, -side)))
  const vx1 = Math.max(W, ...neigh.map((n) => Math.min(n.x1, W + side)))
  const vTop = Math.max(total, ...neigh.map((n) => Math.min(n.y1 + legs, total + side)))
  // Per sota del terra del dibuix (mòdul penjat o apilat: els de sota també es veuen).
  const vBot = Math.min(0, ...neigh.map((n) => Math.max(n.y0 + legs, -side)))
  const vH = vTop - vBot

  const panelRects = build.panels
    .filter((p) => ["side", "bottom", "top", "divider", "fixedShelf", "plinth"].includes(p.role))
    .map((p) => frontFootprint(p))
    .filter((r): r is Rect => r !== null)

  return (
    // La caixa té la mida del mòdul (com sempre); l'SVG en surt pels costats per mostrar
    // els veïns sense fer el mòdul més petit.
    <Box position="relative" w="full" mx="auto" maxW={`calc(${maxH} * ${(W + 2 * pad) / (total + 2 * pad)})`} color="fg" style={{ aspectRatio: `${W + 2 * pad} / ${total + 2 * pad}` }} userSelect="none">
      <svg
        viewBox={`${vx0 - pad} ${-pad} ${vx1 - vx0 + 2 * pad} ${vH + 2 * pad}`}
        style={{
          touchAction: "manipulation",
          position: "absolute",
          overflow: "visible",
          left: `${(vx0 / (W + 2 * pad)) * 100}%`,
          width: `${((vx1 - vx0 + 2 * pad) / (W + 2 * pad)) * 100}%`,
          top: `${(-(vTop - total) / (total + 2 * pad)) * 100}%`,
          height: `${((vH + 2 * pad) / (total + 2 * pad)) * 100}%`,
        }}
      >
        <g transform={`translate(0 ${vTop}) scale(1 -1)`}>
          {/* Mòduls veïns, translúcids: per orientar-se. Un clic hi passa. */}
          <g transform={`translate(0 ${legs})`}>
            {neigh.map((n) => (
              <g key={n.id} onClick={onSelectModule ? () => onSelectModule(n.id) : undefined} style={{ cursor: onSelectModule ? "pointer" : undefined }} opacity={0.35}>
                <title>{`${n.name} — clica per editar-lo`}</title>
                <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={n.y1 - n.y0} fill="var(--chakra-colors-bg-muted)" stroke="var(--chakra-colors-border)" strokeWidth={stroke} />
                {n.rects.map((r, i) => (
                  <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--chakra-colors-wood-muted)" stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke * 0.7} />
                ))}
                <g transform={`translate(${n.x0 < 0 ? Math.max(n.x0, -side) + Math.min(n.x1 - Math.max(n.x0, -side), side) / 2 : Math.min(n.x0, W + side) + (Math.min(n.x1, W + side) - n.x0) / 2} ${Math.min(n.y1, H + side) - font * 1.6}) scale(1 -1)`}>
                  <text textAnchor="middle" fontSize={font} fill="currentColor" fontFamily="system-ui, sans-serif" fontWeight="bold">
                    {n.name}
                  </text>
                </g>
              </g>
            ))}
          </g>
          {/* Potes */}
          {hasLegs && legs > 0 && (
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
                  {/* Cotes de la llum (amb un halo del color del fons: es llegeixen encara que passin per sobre d'un tirador) */}
                  <g transform={`translate(${rect.x0 + w / 2} ${rect.y0 + h / 2}) scale(1 -1)`}>
                    {/* Fons darrere del text: tapa el tirador del calaix del mig si hi passa per sota. */}
                    {(() => {
                      const bw = Math.min(w - stroke * 4, Math.max(`${Math.round(w)} × ${Math.round(h)}`.length, describeZone(zone).length * 0.8) * font * 0.58 + font)
                      return bw > 0 ? <rect x={-bw / 2} y={-font * 1.25} width={bw} height={font * 2.55} rx={font * 0.3} fill={selected ? "var(--chakra-colors-wood-emphasized)" : "var(--chakra-colors-bg-muted)"} /> : null
                    })()}
                    <text textAnchor="middle" fontSize={font} fill="currentColor" fontFamily="system-ui, sans-serif" y={-font * 0.2} stroke={selected ? "var(--chakra-colors-wood-emphasized)" : "var(--chakra-colors-bg-muted)"} strokeWidth={font * 0.3} paintOrder="stroke" strokeLinejoin="round">
                      {Math.round(w)} × {Math.round(h)}
                    </text>
                    <text textAnchor="middle" fontSize={font * 0.8} fill="currentColor" opacity={0.7} fontFamily="system-ui, sans-serif" y={font * 0.9} stroke={selected ? "var(--chakra-colors-wood-emphasized)" : "var(--chakra-colors-bg-muted)"} strokeWidth={font * 0.3} paintOrder="stroke" strokeLinejoin="round">
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
function frontFootprint(p: Placed): Rect | null {
  const { min, max } = panelBox(p)
  if (!Number.isFinite(min[0])) return null
  return { x: min[0], y: min[1], w: max[0] - min[0], h: max[1] - min[1] }
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
