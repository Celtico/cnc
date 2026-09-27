import { Box, Text, VStack } from "@chakra-ui/react"
import type { Panel } from "../core/model"

/**
 * Plànol 2D d'una peça (el mateix que anirà al DXF): contorn, forats i ranures,
 * vist des de la cara A. Origen a baix a l'esquerra, com a la CNC.
 */
export function PanelDrawing({ panel }: { panel: Panel }) {
  const { length: L, width: W } = panel
  const pad = Math.max(L, W) * 0.04
  const viewBox = `${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}`
  const stroke = Math.max(L, W) / 400

  return (
    <VStack align="stretch" gap={1}>
      <Box asChild color="fg" w="full" style={{ aspectRatio: `${L + 2 * pad} / ${W + 2 * pad}` }}>
        <svg viewBox={viewBox}>
        {/* Y cap amunt: girem el sistema de coordenades. */}
        <g transform={`translate(0 ${W}) scale(1 -1)`}>
          <rect x={0} y={0} width={L} height={W} fill="var(--chakra-colors-wood-subtle)" stroke="currentColor" strokeWidth={stroke * 1.5} />
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
          {/* Cantells folrats: línia gruixuda. */}
          {panel.edges.bottom && <line x1={0} y1={0} x2={L} y2={0} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 5} />}
          {panel.edges.top && <line x1={0} y1={W} x2={L} y2={W} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 5} />}
          {panel.edges.left && <line x1={0} y1={0} x2={0} y2={W} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 5} />}
          {panel.edges.right && <line x1={L} y1={0} x2={L} y2={W} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 5} />}
        </g>
        </svg>
      </Box>
      <Text fontSize="sm" color="fg.muted" textAlign="center">
        {panel.label} · {panel.length} × {panel.width} × {panel.thickness} mm · {panel.holes.length} forats
      </Text>
    </VStack>
  )
}
