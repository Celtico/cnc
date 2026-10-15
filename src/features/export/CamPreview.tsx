import { Box, HStack, Stack, Switch, Text } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { ChoiceChips } from "../../components/FormRow"
import type { Machine } from "../../core/model"
import { camSheetView, fmtMm } from "./camDrawing"
import { CamOpList } from "./CamOpList"
import { CamSheetSvg, type Zoom } from "./CamSheetSvg"
import { CamToolLegend } from "./CamToolLegend"
import { useElementWidth } from "./useElementWidth"

interface CamSheet {
  file: string
  text: string
}

/**
 * Vista CAM d'Exportar: dibuixa el programa de cada tauler **a partir del text del .xcs** (el mateix que va al zip),
 * perquè el taller vegi què rebrà la màquina sense obrir TopSolid: tauler i marge, peces amb la ref, forats per eina,
 * fresats amb la franja de l'eina (Ø) al costat que toca, entrades en rampa, ordre i llista d'operacions.
 */
export function CamPreview({ sheets, machine }: { sheets: CamSheet[]; machine?: Machine }) {
  const [tab, setTab] = useState(0)
  const [order, setOrder] = useState(false)
  const [band, setBand] = useState(true)
  const [zoom, setZoom] = useState<Zoom>("1")
  const [sel, setSel] = useState<number | null>(null)
  const sheet = sheets[Math.min(tab, sheets.length - 1)]
  const view = useMemo(() => (sheet ? camSheetView(sheet.text, machine) : null), [sheet, machine])
  const [wrap, cw] = useElementWidth<HTMLDivElement>(360)

  if (!sheet || !view) return <Text color="fg.muted">Cap programa per veure.</Text>
  const { preview: p } = view
  const L = p.workpiece?.L ?? 1000
  const W = p.workpiece?.W ?? 1000
  const selRow = sel === null ? null : (view.rows.find((r) => r.from === sel) ?? null)
  const tabLabel = (f: string, i: number) => /^T\d+/.exec(f)?.[0] ?? `${i + 1}`

  return (
    <Stack direction={{ base: "column", lg: "row" }} gap={5} align="stretch" minH={0} h={{ lg: "full" }}>
      <Stack gap={3} flex={1} minW={0} minH={0} overflowY={{ lg: "auto" }} pe={{ lg: 1 }}>
        {sheets.length > 1 && (
          <ChoiceChips
            label="Tauler"
            options={sheets.map((s, i) => ({ id: String(i), label: tabLabel(s.file, i) }))}
            value={String(Math.min(tab, sheets.length - 1))}
            onChange={(v) => {
              setTab(Number(v))
              setSel(null)
            }}
          />
        )}
        <Stack gap={0.5}>
          <Text fontSize="sm" fontWeight="medium" truncate>
            {sheet.file}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {p.workpiece ? `${p.workpiece.name} · ${fmtMm(L)} × ${fmtMm(W)} × ${fmtMm(p.workpiece.T)} mm · ` : ""}
            {p.parts.length} {p.parts.length === 1 ? "peça" : "peces"} · {p.ops.length} {p.ops.length === 1 ? "operació" : "operacions"}
            {p.edgeTrim !== undefined ? ` · marge ${fmtMm(p.edgeTrim)} mm` : ""}
          </Text>
        </Stack>
        <HStack gap={4} wrap="wrap" rowGap={2}>
          <Switch.Root size="sm" checked={order} onCheckedChange={(e) => setOrder(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Ordre</Switch.Label>
          </Switch.Root>
          <Switch.Root size="sm" checked={band} onCheckedChange={(e) => setBand(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Amplada de l'eina</Switch.Label>
          </Switch.Root>
          <ChoiceChips<Zoom>
            label="Zoom"
            options={[
              { id: "1", label: "1×" },
              { id: "2", label: "2×" },
              { id: "4", label: "4×" },
            ]}
            value={zoom}
            onChange={setZoom}
          />
        </HStack>
        <Box ref={wrap} w="full" overflow="auto" borderWidth="1px" rounded="md" bg="bg.subtle" maxH={{ base: "70vh", lg: "none" }} flexShrink={0}>
          <CamSheetSvg view={view} file={sheet.file} cw={cw} zoom={zoom} band={band} order={order} selRow={selRow} />
        </Box>
        <CamToolLegend view={view} />
      </Stack>

      <CamOpList view={view} sel={sel} onSelect={setSel} />
    </Stack>
  )
}
