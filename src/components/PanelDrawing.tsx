import { Box, Text, VStack } from "@chakra-ui/react"
import { flatten, type Panel } from "../core/model"

/** Mm amb coma i dues xifres com a molt (cotes). */
const fmt = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")

/**
 * Plànol 2D d'una peça (el mateix que anirà al DXF): contorn, forats i ranures,
 * vist des de la cara A. Origen a baix a l'esquerra, com a la CNC.
 */
export function PanelDrawing({
  panel,
  caption = true,
  crop,
  dims,
}: {
  panel: Panel
  /** Sense la línia de sota (nom, mides i forats): miniatures. */
  caption?: boolean
  /** Només aquest tros de la peça (coordenades de la peça, mm): un detall dels forats. */
  crop?: { x: number; y: number; w: number; h: number }
  /** Cotes del primer forat als cantells (el detall dels ferratges). */
  dims?: boolean
}) {
  const { length: L, width: W } = panel
  const pad = Math.max(L, W) * 0.04
  // Y cap amunt: el tros (x, y des de baix) passa a la y de la pantalla (des de dalt).
  const view = crop ? { x: crop.x, y: W - crop.y - crop.h, w: crop.w, h: crop.h } : { x: -pad, y: -pad, w: L + 2 * pad, h: W + 2 * pad }
  const viewBox = `${view.x} ${view.y} ${view.w} ${view.h}`
  const stroke = Math.max(view.w, view.h) / 400
  // Cotes (només amb `dims`): del centre del primer forat (o tall rodó) als dos cantells més propers.
  const first = panel.holes[0] ?? panel.cutouts?.find((c) => c.kind === "circle")
  const dim = dims && first && "x" in first ? { cx: first.x, cy: first.y, r: "diameter" in first ? first.diameter / 2 : 0, ex: first.x < L / 2 ? 0 : L, ey: first.y < W / 2 ? 0 : W } : null

  return (
    <VStack align="stretch" gap={1}>
      <Box asChild color="fg" w="full" style={{ aspectRatio: `${view.w} / ${view.h}` }}>
        <svg viewBox={viewBox}>
        {/* Y cap amunt: girem el sistema de coordenades. */}
        <g transform={`translate(0 ${W}) scale(1 -1)`}>
          {panel.outline ? (
            <polygon points={flatten(panel.outline).map(([x, y]) => `${x},${y}`).join(" ")} fill="var(--chakra-colors-wood-subtle)" stroke="currentColor" strokeWidth={stroke * 1.5} />
          ) : (
            <rect x={0} y={0} width={L} height={W} fill="var(--chakra-colors-wood-subtle)" stroke="currentColor" strokeWidth={stroke * 1.5} />
          )}
          {panel.grooves.map((g, i) => (
            <rect
              key={`g${i}`}
              x={g.x}
              y={g.y}
              width={g.w}
              height={g.h}
              fill="var(--chakra-colors-wood-emphasized)"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeDasharray={g.face === "B" ? `${stroke * 6} ${stroke * 4}` : undefined}
            />
          ))}
          {panel.holes.map((h, i) => (
            <circle
              key={`h${i}`}
              cx={h.x}
              cy={h.y}
              r={h.diameter / 2}
              fill={h.face === "edge" ? "none" : "var(--chakra-colors-wood-fg)"}
              stroke="currentColor"
              strokeWidth={stroke}
              strokeDasharray={h.face === "edge" ? `${stroke * 3} ${stroke * 3}` : undefined}
            />
          ))}
          {/* Talls passants: forats que travessen la peça. */}
          {panel.cutouts?.map((c, i) =>
            c.kind === "circle" ? (
              <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.diameter / 2} fill="var(--chakra-colors-bg)" stroke="currentColor" strokeWidth={stroke} />
            ) : c.kind === "polygon" ? (
              <polygon key={`c${i}`} points={flatten(c.points).map(([x, y]) => `${x},${y}`).join(" ")} fill="var(--chakra-colors-bg)" stroke="currentColor" strokeWidth={stroke} />
            ) : (
              <rect key={`c${i}`} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.kind === "slot" ? Math.min(c.w, c.h) / 2 : 0} fill="var(--chakra-colors-bg)" stroke="currentColor" strokeWidth={stroke} />
            ),
          )}
          {/* Cantells folrats: línia gruixuda. */}
          {panel.edges.bottom && <line x1={0} y1={0} x2={L} y2={0} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 5} />}
          {panel.edges.top && <line x1={0} y1={W} x2={L} y2={W} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 5} />}
          {panel.edges.left && <line x1={0} y1={0} x2={0} y2={W} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 5} />}
          {panel.edges.right && <line x1={L} y1={0} x2={L} y2={W} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 5} />}
          {dim && (
            <g stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke} strokeDasharray={`${stroke * 4} ${stroke * 3}`}>
              <line x1={dim.ex} y1={dim.cy} x2={dim.cx} y2={dim.cy} />
              <line x1={dim.cx} y1={dim.ey} x2={dim.cx} y2={dim.cy} />
            </g>
          )}
        </g>
        {/* Cotes del primer forat als cantells més propers (fora del grup girat: el text no surt del revés). */}
        {dim && (
          <g fill="var(--chakra-colors-wood-fg)" fontSize={Math.max(view.w, view.h) / 22} fontFamily="inherit">
            <text x={(dim.ex + dim.cx) / 2} y={W - dim.cy - view.h / 40} textAnchor="middle">
              {fmt(Math.abs(dim.cx - dim.ex))}
            </text>
            <text x={dim.cx + dim.r + view.h / 40} y={W - (dim.ey + dim.cy) / 2} dominantBaseline="middle">
              {fmt(Math.abs(dim.cy - dim.ey))}
            </text>
          </g>
        )}
        </svg>
      </Box>
      {caption && <Text fontSize="sm" color="fg.muted" textAlign="center">
        {panel.label} · {panel.length} × {panel.width} × {panel.thickness} mm · {panel.holes.length} forats{panel.cutouts?.length ? ` · ${panel.cutouts.length} talls passants` : ""}
      </Text>}
    </VStack>
  )
}
