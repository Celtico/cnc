import { Box } from "@chakra-ui/react"
import { flatten, type Panel } from "../core/model"
import type { NestedBoard } from "../core/nesting/nest"
import { localToBoard } from "../core/export/topsolidCsv"

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
                {/* Peça amb forma (tauler oval, tires a 45°…): el contorn de debò, girat com la peça;
                    el rectangle que ocupa, en traç fi. */}
                {p?.outline ? (
                  <>
                    <rect x={pl.x} y={pl.y} width={pl.w} height={pl.h} fill="none" stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke / 2} strokeDasharray={`${stroke * 4} ${stroke * 3}`} opacity={0.5} />
                    <polygon
                      points={flatten(p.outline)
                        .map(([x, y]) => localToBoard(pl, x, y))
                        .map((q) => `${q.x},${q.y}`)
                        .join(" ")}
                      fill="var(--chakra-colors-wood-subtle)"
                      stroke="var(--chakra-colors-wood-fg)"
                      strokeWidth={stroke}
                    />
                  </>
                ) : (
                  <rect
                    x={pl.x}
                    y={pl.y}
                    width={pl.w}
                    height={pl.h}
                    fill={p?.role === "back" ? "var(--chakra-colors-wood-emphasized)" : "var(--chakra-colors-wood-subtle)"}
                    stroke="var(--chakra-colors-wood-fg)"
                    strokeWidth={stroke}
                  />
                )}
                {/* Talls passants (reixetes, forats de pica i vitro, passacables), girats com la peça. */}
                {p?.cutouts?.map((c, i) => {
                  if (c.kind === "circle") {
                    const q = localToBoard(pl, c.x, c.y)
                    return <circle key={`c${i}`} cx={q.x} cy={q.y} r={c.diameter / 2} fill="var(--chakra-colors-bg-muted)" stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke / 2} />
                  }
                  if (c.kind === "polygon") {
                    const pts = flatten(c.points).map(([x, y]) => localToBoard(pl, x, y)).map((q) => `${q.x},${q.y}`).join(" ")
                    return <polygon key={`c${i}`} points={pts} fill="var(--chakra-colors-bg-muted)" stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke / 2} />
                  }
                  const a = localToBoard(pl, c.x, c.y)
                  const b = localToBoard(pl, c.x + c.w, c.y + c.h)
                  const rr = c.kind === "slot" ? Math.min(c.w, c.h) / 2 : 0
                  return (
                    <rect
                      key={`c${i}`}
                      x={Math.min(a.x, b.x)}
                      y={Math.min(a.y, b.y)}
                      width={Math.abs(b.x - a.x)}
                      height={Math.abs(b.y - a.y)}
                      rx={rr}
                      fill="var(--chakra-colors-bg-muted)"
                      stroke="var(--chakra-colors-wood-fg)"
                      strokeWidth={stroke / 2}
                    />
                  )
                })}
                {/* Forats de cara (frontisses, System 32, espigues, tiradors): els fa la CNC al
                    nesting; els de la cara B (2a cara), buits. Els de cantell no es veuen des de dalt. */}
                {p?.holes.map((hole, i) => {
                  if (hole.face === "edge") return null
                  const q = localToBoard(pl, hole.x, hole.y)
                  return (
                    <circle
                      key={`h${i}`}
                      cx={q.x}
                      cy={q.y}
                      r={Math.max(hole.diameter / 2, stroke)}
                      fill={hole.face === "A" ? "var(--chakra-colors-wood-fg)" : "none"}
                      stroke="var(--chakra-colors-wood-fg)"
                      strokeWidth={stroke / 2}
                      opacity={hole.face === "A" ? 0.75 : 0.9}
                    />
                  )
                })}
                {/* Marca de veta: una ratlla fina en la direcció de la veta de la peça al tauler
                    (horitzontal si la veta de la peça va pel llarg i el llarg va en X). */}
                {p && p.grain !== "none" && ((p.grain === "x") === (pl.angle === 0) ? (
                  <line x1={pl.x + pl.w * 0.1} y1={pl.cy} x2={pl.x + pl.w * 0.9} y2={pl.cy} stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke / 2} opacity={0.35} />
                ) : (
                  <line x1={pl.cx} y1={pl.y + pl.h * 0.1} x2={pl.cx} y2={pl.y + pl.h * 0.9} stroke="var(--chakra-colors-wood-fg)" strokeWidth={stroke / 2} opacity={0.35} />
                ))}
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
