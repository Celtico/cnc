import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react"
import { useEffect, useRef } from "react"
import { SectionLabel } from "../../components/SectionLabel"
import type { CamOp } from "../../core/export/xcsPreview"
import { colorFor, opLabel, type CamSheetView } from "./camDrawing"
import { fmtNum } from "../../lib/format"

const opLine = (o: CamOp) => {
  const parts = [o.ref, opLabel(o)].filter(Boolean)
  return parts.join(" · ")
}

/**
 * Llista d'operacions en l'ordre del fitxer: tocar-ne una la marca al dibuix; passar-hi el ratolí en mostra les cotes.
 * `hot`: la fila de l'operació inspeccionada al dibuix (amb `follow`, la llista s'hi desplaça).
 */
export function CamOpList({ view, sel, onSelect, hot, follow, onHover }: { view: CamSheetView; sel: number | null; onSelect: (from: number | null) => void; hot: number | null; follow: boolean; onHover: (from: number | null) => void }) {
  const { preview: p } = view
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Només dins de la llista quan té barra pròpia (pantalla ampla): `scrollIntoView` mouria també la finestra i el dibuix.
    const box = list.current
    const row = follow && hot !== null ? box?.querySelector(`[data-from="${hot}"]`) : null
    if (!box || !row || box.scrollHeight <= box.clientHeight) return
    const b = box.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < b.top) box.scrollTop += r.top - b.top
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom
  }, [hot, follow])
  return (
    <Stack ref={list} gap={1.5} w={{ base: "full", lg: "420px" }} flexShrink={0} minH={0} overflowY={{ lg: "auto" }}>
      <SectionLabel>Operacions ({p.ops.length})</SectionLabel>
      <Stack gap={0} borderWidth="1px" rounded="md" overflow="hidden">
        {view.rows.map((r) => {
          const o = r.ops[0]!
          const on = sel === r.from
          const lit = hot === r.from
          const extras = [
            o.pass ? `P${o.pass.index}/${o.pass.count}` : "",
            o.approach && view.widths.get(o.n) ? `rampa ${fmtNum(o.approach.k * (view.widths.get(o.n)! / 2))} mm` : o.approach ? "rampa" : "",
            o.maxPass ? `passades de ${fmtNum(o.maxPass)}` : "",
            o.overMaterial ? `sobrant ${fmtNum(o.overMaterial)}` : "",
            o.toolpath ? "recorregut" : "",
            o.plane !== "Top" ? o.plane : "",
          ].filter(Boolean)
          return (
            <HStack
              key={r.from}
              as="button"
              gap={2}
              px={3}
              py={1.5}
              textAlign="start"
              borderBottomWidth="1px"
              _last={{ borderBottomWidth: 0 }}
              data-from={r.from}
              bg={on ? "bg.emphasized" : lit ? "bg.muted" : undefined}
              _hover={{ bg: on ? "bg.emphasized" : "bg.muted" }}
              onClick={() => onSelect(on ? null : r.from)}
              onPointerEnter={(e) => e.pointerType !== "touch" && onHover(r.from)}
              onPointerLeave={(e) => e.pointerType !== "touch" && onHover(null)}
              fontSize="xs"
              align="start"
              aria-pressed={on}
            >
              <Text fontVariantNumeric="tabular-nums" color="fg.muted" minW="44px" flexShrink={0}>
                {r.from === r.to ? r.from : `${r.from}–${r.to}`}
              </Text>
              <Box w="10px" h="10px" mt="3px" rounded={o.kind === "drill" ? "full" : "sm"} style={{ background: colorFor(view, o) }} flexShrink={0} />
              <Stack gap={0} flex={1} minW={0}>
                <Text truncate>
                  {r.count > 1 ? opLabel(o, r.count) : opLine(o)} · {fmtNum(r.depth)} mm
                </Text>
                <Text color="fg.muted" lineClamp={2}>
                  {o.tool === "-1" ? "eina automàtica" : o.tool}
                  {extras.length ? ` · ${extras.join(" · ")}` : ""}
                </Text>
              </Stack>
              {o.small && (
                <Badge size="xs" colorPalette="yellow" flexShrink={0}>
                  petita
                </Badge>
              )}
            </HStack>
          )
        })}
      </Stack>
    </Stack>
  )
}
