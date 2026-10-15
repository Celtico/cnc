import { Box, Stack, Text } from "@chakra-ui/react"
import { useMemo } from "react"
import { viewBounds, type HardwareView } from "../../../core/import/views"
import { dimFont, fmtMm, layoutDims, viewCircles } from "../../../components/dims"
import { DimLayer } from "../../../components/DimLine"

const VIEW_LABEL: Record<HardwareView["name"], string> = { front: "Vista frontal", side: "Vista lateral", top: "Vista de dalt" }

/**
 * Una vista 2D del fitxer (línies i punts de connexió), tal com ve o encaixada al marc del ferratge, **acotada** (per
 * decisió de l'usuari, «a les vistes les mides de tot»): la mida total, els cercles (forats) amb el Ø i les cotes
 * encadenades des dels cantells, entre forats i, si la vista és al marc dels forats, des del punt de referència.
 */
export function ViewDrawing({ view }: { view: HardwareView }) {
  const layout = useMemo(() => {
    const b = viewBounds(view.lines)
    if (!b) return null
    const box = { x0: b.x0, y0: -b.y1, x1: b.x1, y1: -b.y0 }
    const fs = dimFont(box)
    const feats = viewCircles(view.lines).map((c) => ({ x: c.x, y: -c.y, hx: c.r, hy: c.r, label: `Ø${fmtMm(Math.round(c.r * 20) / 10)}` }))
    return { fs, l: layoutDims(box, feats, fs, { ...(view.registered ? { ref: [0, 0] as [number, number] } : {}), title: VIEW_LABEL[view.name] }) }
  }, [view])
  if (!layout) return null
  const vb = layout.l.extent
  const stroke = Math.max(vb.w, vb.h) / 500
  const mark = layout.fs * 0.5
  return (
    <Stack gap={1} bg="bg" rounded="lg" borderWidth="1px" p={2} data-testid={`hardware-view-${view.name}`}>
      <Text fontSize="sm" fontWeight="medium" px={1}>
        {VIEW_LABEL[view.name]}
        {view.registered && (
          <Text as="span" color="fg.muted" fontWeight="normal">
            {" "}
            · al marc dels forats
          </Text>
        )}
      </Text>
      <Box asChild color="fg" w="full" style={{ aspectRatio: `${vb.w} / ${vb.h}` }} maxH="340px">
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
          <g transform="scale(1 -1)" fill="none" stroke="currentColor" strokeWidth={stroke}>
            {view.lines.map((l, i) => (
              <polyline key={i} points={l.map((v, k) => (k % 2 ? `${v} ` : `${v},`)).join("")} />
            ))}
            {!view.registered &&
              view.points.map(([x, y], i) => (
                <g key={`p${i}`} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 1.5}>
                  <line x1={x - mark} y1={y} x2={x + mark} y2={y} />
                  <line x1={x} y1={y - mark} x2={x} y2={y + mark} />
                </g>
              ))}
            {view.registered && (
              <g stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 1.5}>
                <line x1={-mark} y1={0} x2={mark} y2={0} />
                <line x1={0} y1={-mark} x2={0} y2={mark} />
              </g>
            )}
          </g>
          <DimLayer layout={layout.l} stroke={stroke} fs={layout.fs} />
        </svg>
      </Box>
    </Stack>
  )
}
