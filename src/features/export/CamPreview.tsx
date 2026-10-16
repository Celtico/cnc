import { Box, HStack, Stack, Switch, Text } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { ChoiceChips } from "../../components/FormRow"
import type { Machine } from "../../core/model"
import { camSheetView, fmtMm } from "./camDrawing"
import { camInspect, type CamInspection, type CamTarget } from "./camInspect"
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
  /** Inspecció: la del ratolí (dibuix o llista) mana; si no n'hi ha, la fixada en tocar o clicar. */
  const [hover, setHover] = useState<{ t: CamTarget; from: "svg" | "list" } | null>(null)
  const [pin, setPin] = useState<CamTarget | null>(null)
  const sheet = sheets[Math.min(tab, sheets.length - 1)]
  const view = useMemo(() => (sheet ? camSheetView(sheet.text, machine) : null), [sheet, machine])
  const [wrap, cw] = useElementWidth<HTMLDivElement>(360)

  if (!sheet || !view) return <Text color="fg.muted">Cap programa per veure.</Text>
  const { preview: p } = view
  const L = p.workpiece?.L ?? 1000
  const W = p.workpiece?.W ?? 1000
  const selRow = sel === null ? null : (view.rows.find((r) => r.from === sel) ?? null)
  const tabLabel = (f: string, i: number) => /^T\d+/.exec(f)?.[0] ?? `${i + 1}`
  const rowOf = (n: number) => view.rows.find((r) => r.ops.some((o) => o.n === n))
  const target = hover?.t ?? pin
  const insp = camInspect(view, target)
  const hot = target?.kind === "op" ? (rowOf(target.n)?.from ?? null) : null
  const same = (a: CamTarget | null, b: CamTarget | null) => !!a && !!b && (a.kind === "part" ? b.kind === "part" && a.ref === b.ref : b.kind === "op" && a.n === b.n)
  /** Tocar (o clicar) al dibuix: fixa la inspecció i, si és una operació, en marca la fila; tornar-hi la treu. */
  const pick = (t: CamTarget | null) => {
    const off = !t || same(t, pin)
    setPin(off ? null : t)
    if (t?.kind === "op") setSel(off ? null : (rowOf(t.n)?.from ?? null))
  }
  const select = (from: number | null) => {
    setSel(from)
    const o = from === null ? undefined : view.rows.find((r) => r.from === from)?.ops[0]
    setPin(o ? { kind: "op", n: o.n } : null)
  }

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
              setPin(null)
              setHover(null)
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
        <Box position="relative" flexShrink={0}>
          <Box ref={wrap} w="full" overflow="auto" borderWidth="1px" rounded="md" bg="bg.subtle" maxH={{ base: "70vh", lg: "none" }}>
            <CamSheetSvg
              view={view}
              file={sheet.file}
              cw={cw}
              zoom={zoom}
              band={band}
              order={order}
              selRow={selRow}
              target={target}
              insp={insp}
              onHover={(t) => setHover(t ? { t, from: "svg" } : null)}
              onPick={pick}
            />
          </Box>
          {insp && <InspectBox insp={insp} left={insp.focus[0] > L / 2} />}
        </Box>
        <Text fontSize="xs" color="fg.muted">
          Passa el ratolí (o toca) una peça, un forat o un fresat per veure'n les cotes.
        </Text>
        <CamToolLegend view={view} />
      </Stack>

      <CamOpList
        view={view}
        sel={sel}
        onSelect={select}
        hot={hot}
        follow={hover?.from === "svg"}
        onHover={(from) => {
          const o = from === null ? undefined : view.rows.find((r) => r.from === from)?.ops[0]
          setHover(o ? { t: { kind: "op", n: o.n }, from: "list" } : null)
        }}
      />
    </Stack>
  )
}

/** Fitxa de la inspecció, a un racó del dibuix (el contrari d'on és el que s'inspecciona). No intercepta el ratolí. */
function InspectBox({ insp, left }: { insp: CamInspection; left: boolean }) {
  return (
    <Stack position="absolute" top={2} {...(left ? { left: 2 } : { right: 2 })} maxW="min(340px, 70%)" gap={0.5} px={2.5} py={1.5} bg="bg.panel" borderWidth="1px" rounded="md" shadow="md" opacity={0.95} pointerEvents="none" fontSize="xs" aria-live="polite">
      <Text fontWeight="semibold">{insp.title}</Text>
      {insp.lines.map((l) => (
        <Text key={l} color="fg.muted" fontVariantNumeric="tabular-nums">
          {l}
        </Text>
      ))}
    </Stack>
  )
}
