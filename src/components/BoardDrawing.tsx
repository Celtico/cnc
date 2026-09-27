import { Box } from "@chakra-ui/react"
import type { Panel } from "../core/model"
import type { NestedBoard } from "../core/nesting/nest"

/**
 * Tauler de nesting en SVG: contorn, marge útil i cada peça amb el seu nom i mides.
 * Origen a baix a l'esquerra (Y cap amunt), com al nucli.
 */
export function BoardDrawing({
  board,
  panels,
  margin,
}: {
  board: NestedBoard
  panels: Map<string, Panel>
  margin: number
}) {
  const { w, h } = board
  const pad = Math.max(w, h) * 0.02
  const stroke = Math.max(w, h) / 600
  const font = Math.max(w, h) / 45

  return (
    <Box asChild w="full" color="fg" style={{ aspectRatio: `${w + 2 * pad} / ${h + 2 * pad}` }}>
      <svg viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`}>
        <g transform={`translate(0 ${h}) scale(1 -1)`}>
          <rect x={0} y={0} width={w} height={h} fill="var(--chakra-colors-bg-muted)" stroke="currentColor" strokeWidth={stroke * 1.5} />
          <rect
            x={margin}
            y={margin}
            width={w - 2 * margin}
            height={h - 2 * margin}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke / 2}
            strokeDasharray={`${stroke * 6} ${stroke * 6}`}
            opacity={0.5}
          />
          {board.placements.map((pl) => {
            const p = panels.get(pl.panelId)
            const label = p?.label ?? pl.panelId
            const dims = p ? `${p.length} × ${p.width}` : `${pl.w} × ${pl.h}`
            const textUp = pl.w < pl.h * 0.8
            return (
              <g key={pl.panelId}>
                <rect
                  x={pl.x}
                  y={pl.y}
                  width={pl.w}
                  height={pl.h}
                  fill={p?.role === "back" ? "var(--chakra-colors-wood-emphasized)" : "var(--chakra-colors-wood-subtle)"}
                  stroke="var(--chakra-colors-wood-fg)"
                  strokeWidth={stroke}
                />
                {/* Marca de veta: ratlles fines en la direcció de la veta (X si angle 0). */}
                {p?.grain !== "none" && (
                  <line
                    x1={pl.angle === 0 ? pl.x + pl.w * 0.1 : pl.cx}
                    y1={pl.angle === 0 ? pl.cy : pl.y + pl.h * 0.1}
                    x2={pl.angle === 0 ? pl.x + pl.w * 0.9 : pl.cx}
                    y2={pl.angle === 0 ? pl.cy : pl.y + pl.h * 0.9}
                    stroke="var(--chakra-colors-wood-fg)"
                    strokeWidth={stroke / 2}
                    opacity={0.35}
                  />
                )}
                <g transform={`translate(${pl.cx} ${pl.cy}) scale(1 -1) ${textUp ? "rotate(-90)" : ""}`}>
                  <text textAnchor="middle" fontSize={font} fill="currentColor" fontFamily="system-ui, sans-serif" y={-font * 0.15}>
                    {label}
                  </text>
                  <text textAnchor="middle" fontSize={font * 0.8} fill="currentColor" opacity={0.7} fontFamily="system-ui, sans-serif" y={font * 0.85}>
                    {dims}
                  </text>
                </g>
              </g>
            )
          })}
        </g>
      </svg>
    </Box>
  )
}
