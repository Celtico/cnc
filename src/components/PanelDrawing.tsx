import { Box, Text, VStack } from "@chakra-ui/react"
import { flatten, type Panel } from "../core/model"
import { dimFont, layoutDims, type DrawFeature } from "./dims"
import { DimLayer } from "./DimLine"

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
  underlay,
}: {
  panel: Panel
  /** Sense la línia de sota (nom, mides i forats): miniatures. */
  caption?: boolean
  /** Només aquest tros de la peça (coordenades de la peça, mm): un detall dels forats. */
  crop?: { x: number; y: number; w: number; h: number }
  /**
   * Cotes: `true` = del primer forat als cantells (el detall dels ferratges); `"full"` = totes (mida total, cotes
   * encadenades dels forats, talls i ranures des dels cantells i entre ells, Ø × fondària), com les vistes dels ferratges.
   */
  dims?: boolean | "full"
  /** Dibuix de fons (coordenades de la peça, polilínies planes [x0, y0, x1, y1, …]): la vista d'un ferratge importat. */
  underlay?: number[][]
}) {
  const { length: L, width: W } = panel
  const pad = Math.max(L, W) * 0.04
  // Y cap amunt: el tros (x, y des de baix) passa a la y de la pantalla (des de dalt).
  const full = dims === "full" && !crop ? fullDims(panel) : null
  const view = crop ? { x: crop.x, y: W - crop.y - crop.h, w: crop.w, h: crop.h } : full ? full.layout.extent : { x: -pad, y: -pad, w: L + 2 * pad, h: W + 2 * pad }
  const viewBox = `${view.x} ${view.y} ${view.w} ${view.h}`
  const stroke = Math.max(view.w, view.h) / 400
  // Cotes (només amb `dims`): del centre del primer forat (o tall rodó) als dos cantells més propers.
  const first = panel.holes[0] ?? panel.cutouts?.find((c) => c.kind === "circle")
  const dim = dims === true && first && "x" in first ? { cx: first.x, cy: first.y, r: "diameter" in first ? first.diameter / 2 : 0, ex: first.x < L / 2 ? 0 : L, ey: first.y < W / 2 ? 0 : W } : null

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
          {underlay && (
            <g fill="none" stroke="var(--chakra-colors-fg-muted)" strokeWidth={stroke * 0.6} data-testid="panel-underlay">
              {underlay.map((l, i) => (
                <polyline key={`u${i}`} points={l.map((v, k) => (k % 2 ? `${v} ` : `${v},`)).join("")} />
              ))}
            </g>
          )}
          {panel.holes.map((h, i) => (
            <circle
              key={`h${i}`}
              cx={h.x}
              cy={h.y}
              r={h.diameter / 2}
              fill={h.face === "edge" ? "none" : "var(--chakra-colors-wood-fg)"}
              fillOpacity={underlay ? 0.45 : undefined}
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
        {full && <DimLayer layout={full.layout} stroke={stroke} fs={full.fs} />}
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

/** Les cotes de tota la peça (y cap avall: `W − y`): forats, talls i ranures. */
function fullDims(panel: Panel) {
  const { length: L, width: W } = panel
  const n = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")
  const feats: DrawFeature[] = []
  for (const h of panel.holes) {
    const r = h.diameter / 2
    feats.push({ x: h.x, y: W - h.y, hx: r, hy: r, label: `Ø${n(h.diameter)} × ${n(h.depth)}${h.face === "B" ? " (B)" : h.face === "edge" ? " cantell" : ""}` })
  }
  for (const c of panel.cutouts ?? []) {
    if (c.kind === "circle") feats.push({ x: c.x, y: W - c.y, hx: c.diameter / 2, hy: c.diameter / 2, label: `Ø${n(c.diameter)} passant` })
    else if (c.kind !== "polygon") feats.push({ x: c.x + c.w / 2, y: W - c.y - c.h / 2, hx: c.w / 2, hy: c.h / 2, label: `${n(c.w)} × ${n(c.h)} passant` })
  }
  for (const g of panel.grooves) feats.push({ x: g.x + g.w / 2, y: W - g.y - g.h / 2, hx: g.w / 2, hy: g.h / 2, label: `R ${n(Math.min(g.w, g.h))} × ${n(g.depth)}`, skipX: g.w >= L - 0.05, skipY: g.h >= W - 0.05 })
  const box = { x0: 0, y0: 0, x1: L, y1: W }
  const fs = dimFont(box)
  return { fs, layout: layoutDims(box, feats, fs, { title: panel.label }) }
}
