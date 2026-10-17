import { Box, HStack, Spinner, Stack, Switch, Text } from "@chakra-ui/react"
import { Suspense, lazy, useMemo, useState } from "react"
import { LuMap, LuRotate3D } from "react-icons/lu"
import { ChoiceChips } from "../../components/FormRow"
import type { Machine } from "../../core/model"
import { usePersistentFlag } from "../../lib/usePersistentFlag"
import { camSheetView} from "./camDrawing"
import { camInspect, type CamInspection, type CamTarget } from "./camInspect"
import { CamOpList } from "./CamOpList"
import { CamSheetSvg, type Zoom } from "./CamSheetSvg"
import { buildSimProgram } from "./camSim"
import { CamSimControls } from "./CamSimControls"
import { CamToolLegend } from "./CamToolLegend"
import { useCamSim } from "./useCamSim"
import { useElementWidth } from "./useElementWidth"
import { fmtNum } from "../../lib/format"

/** La simulació 3D (three) es carrega en triar «3D»: no és al bloc d'Exportar. */
const CamSim3D = lazy(() => import("./CamSim3D"))

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
  /** On és el ratolí dins del dibuix: la fitxa hi va al costat (per decisió de l'usuari, 2026-10-17). */
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const sheet = sheets[Math.min(tab, sheets.length - 1)]
  const view = useMemo(() => (sheet ? camSheetView(sheet.text, machine) : null), [sheet, machine])
  const [wrap, cw] = useElementWidth<HTMLDivElement>(360)
  const [is3d, set3d] = usePersistentFlag("mobles:cam-3d")
  const [paths, setPaths] = useState(true)
  const [rapids, setRapids] = useState(false)
  const prog = useMemo(() => (is3d && view ? buildSimProgram(view) : null), [is3d, view])
  const clock = useCamSim(prog)

  if (!sheet || !view) return <Text color="fg.muted">Cap programa per veure.</Text>
  const { preview: p } = view
  const L = p.workpiece?.L ?? 1000
  const W = p.workpiece?.W ?? 1000
  const selRow = sel === null ? null : (view.rows.find((r) => r.from === sel) ?? null)
  const tabLabel = (f: string, i: number) => /^T\d+/.exec(f)?.[0] ?? `${i + 1}`
  const rowOf = (n: number) => view.rows.find((r) => r.ops.some((o) => o.n === n))
  const target = hover?.t ?? pin
  const insp = camInspect(view, target)
  const simOp = clock && clock.op >= 0 ? clock.prog.ops[clock.op] : undefined
  const hot = clock ? (simOp ? (rowOf(simOp.n)?.from ?? null) : null) : target?.kind === "op" ? (rowOf(target.n)?.from ?? null) : null
  const same = (a: CamTarget | null, b: CamTarget | null) => !!a && !!b && (a.kind === "part" ? b.kind === "part" && a.ref === b.ref : b.kind === "op" && a.n === b.n)
  /** Tocar (o clicar) al dibuix: fixa la inspecció i, si és una operació, en marca la fila; tornar-hi la treu. */
  const pick = (t: CamTarget | null) => {
    const off = !t || same(t, pin)
    setPin(off ? null : t)
    if (t?.kind === "op") setSel(off ? null : (rowOf(t.n)?.from ?? null))
  }
  const select = (from: number | null) => {
    setSel(from)
    // 3D: tocar una operació hi porta la simulació (al seu començament).
    const so = clock && from !== null ? clock.prog.ops.find((o) => o.n === from) : undefined
    if (clock && so) clock.seek(so.t0)
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
            {p.workpiece ? `${p.workpiece.name} · ${fmtNum(L)} × ${fmtNum(W)} × ${fmtNum(p.workpiece.T)} mm · ` : ""}
            {p.parts.length} {p.parts.length === 1 ? "peça" : "peces"} · {p.ops.length} {p.ops.length === 1 ? "operació" : "operacions"}
            {p.edgeTrim !== undefined ? ` · marge ${fmtNum(p.edgeTrim)} mm` : ""}
          </Text>
        </Stack>
        <HStack gap={4} wrap="wrap" rowGap={2}>
          <ChoiceChips
            label="Vista"
            options={[
              { id: "2d", label: <HStack gap={1.5}><LuMap /> 2D</HStack> },
              { id: "3d", label: <HStack gap={1.5}><LuRotate3D /> 3D</HStack> },
            ]}
            value={is3d ? "3d" : "2d"}
            onChange={(v) => set3d(v === "3d")}
          />
          {clock ? (
            <>
              <Toggle label="Recorreguts" checked={paths} onChange={setPaths} />
              <Toggle label="Desplaçaments" checked={rapids} onChange={setRapids} />
            </>
          ) : (
            <>
              <Toggle label="Ordre" checked={order} onChange={setOrder} />
              <Toggle label="Amplada de l'eina" checked={band} onChange={setBand} />
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
            </>
          )}
        </HStack>
        {clock ? (
          <Stack gap={2} flexShrink={0}>
            <Box h={{ base: "55vh", lg: "min(620px, 60dvh)" }} borderWidth="1px" rounded="md" overflow="hidden" bg="bg.subtle">
              <Suspense fallback={<Spinner size="sm" color="wood.solid" m={3} />}>
                <CamSim3D clock={clock} paths={paths} rapids={rapids} />
              </Suspense>
            </Box>
            <CamSimControls clock={clock} view={view} />
            <Text fontSize="xs" color="fg.muted">
              Arrossega per girar-lo; amb dos dits o la roda, més a prop. Aproximat: velocitats fixes (tall 10 m/min, ràpids 40 m/min) i, a les caixeres, un buidat en zig-zag.
              {clock.prog.side ? ` ${clock.prog.side} ${clock.prog.side === 1 ? "operació" : "operacions"} de cantell (o sense geometria) no es veuen al 3D.` : ""}
            </Text>
          </Stack>
        ) : (
          <>
            <Box
              position="relative"
              flexShrink={0}
              onPointerMove={(e) => {
                if (e.pointerType === "touch") return
                const r = e.currentTarget.getBoundingClientRect()
                setCursor({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height })
              }}
              onPointerLeave={() => setCursor(null)}
            >
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
              {insp && <InspectBox insp={insp} left={insp.focus[0] > L / 2} at={hover?.from === "svg" ? cursor : null} />}
            </Box>
            <Text fontSize="xs" color="fg.muted">
              Passa el ratolí (o toca) una peça, un forat o un fresat per veure'n les cotes.
            </Text>
          </>
        )}
        <CamToolLegend view={view} />
      </Stack>

      <CamOpList
        view={view}
        sel={sel}
        onSelect={select}
        hot={hot}
        follow={!!clock || hover?.from === "svg"}
        onHover={(from) => {
          const o = from === null ? undefined : view.rows.find((r) => r.from === from)?.ops[0]
          setHover(o ? { t: { kind: "op", n: o.n }, from: "list" } : null)
        }}
      />
    </Stack>
  )
}

interface Cursor {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Fitxa de la inspecció. Amb el ratolí, al costat del cursor (a la dreta i a sota; a l'altra banda si no hi cap); tocada
 * (mòbil) o des de la llista, a un racó del dibuix (el contrari d'on és el que s'inspecciona). No intercepta el ratolí.
 */
function InspectBox({ insp, left, at }: { insp: CamInspection; left: boolean; at: Cursor | null }) {
  const gap = 16
  const place = at
    ? { ...(at.x > at.w * 0.55 ? { right: `${at.w - at.x + gap}px` } : { left: `${at.x + gap}px` }), ...(at.y > at.h * 0.6 ? { bottom: `${at.h - at.y + gap}px` } : { top: `${at.y + gap}px` }) }
    : { top: 2, ...(left ? { left: 2 } : { right: 2 }) }
  return (
    <Stack position="absolute" {...place} zIndex={1} maxW="min(340px, 70%)" gap={0.5} px={2.5} py={1.5} bg="bg.panel" borderWidth="1px" rounded="md" shadow="md" opacity={0.95} pointerEvents="none" fontSize="xs" aria-live="polite">
      <Text fontWeight="semibold">{insp.title}</Text>
      {insp.lines.map((l) => (
        <Text key={l} color="fg.muted" fontVariantNumeric="tabular-nums">
          {l}
        </Text>
      ))}
    </Stack>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <Switch.Root size="sm" checked={checked} onCheckedChange={(e) => onChange(e.checked)}>
      <Switch.HiddenInput />
      <Switch.Control />
      <Switch.Label fontSize="sm">{label}</Switch.Label>
    </Switch.Root>
  )
}
