import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react"
import { SectionLabel } from "../../components/SectionLabel"
import type { CamOp } from "../../core/export/xcsPreview"
import { colorFor, fmtMm, opLabel, type CamSheetView } from "./camDrawing"

const opLine = (o: CamOp) => {
  const parts = [o.ref, opLabel(o)].filter(Boolean)
  return parts.join(" · ")
}

/** Llista d'operacions en l'ordre del fitxer: tocar-ne una la marca al dibuix. */
export function CamOpList({ view, sel, onSelect }: { view: CamSheetView; sel: number | null; onSelect: (from: number | null) => void }) {
  const { preview: p } = view
  return (
    <Stack gap={1.5} w={{ base: "full", lg: "420px" }} flexShrink={0} minH={0} overflowY={{ lg: "auto" }}>
      <SectionLabel>Operacions ({p.ops.length})</SectionLabel>
      <Stack gap={0} borderWidth="1px" rounded="md" overflow="hidden">
        {view.rows.map((r) => {
          const o = r.ops[0]!
          const on = sel === r.from
          const extras = [
            o.pass ? `P${o.pass.index}/${o.pass.count}` : "",
            o.approach && view.widths.get(o.n) ? `rampa ${fmtMm(o.approach.k * (view.widths.get(o.n)! / 2))} mm` : o.approach ? "rampa" : "",
            o.maxPass ? `passades de ${fmtMm(o.maxPass)}` : "",
            o.overMaterial ? `sobrant ${fmtMm(o.overMaterial)}` : "",
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
              bg={on ? "bg.emphasized" : undefined}
              _hover={{ bg: on ? "bg.emphasized" : "bg.muted" }}
              onClick={() => onSelect(on ? null : r.from)}
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
                  {r.count > 1 ? opLabel(o, r.count) : opLine(o)} · {fmtMm(r.depth)} mm
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
