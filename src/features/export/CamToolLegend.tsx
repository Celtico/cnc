import { Box, HStack, Stack, Text } from "@chakra-ui/react"
import { SectionLabel } from "../../components/SectionLabel"
import { type CamSheetView } from "./camDrawing"
import { fmtNum } from "../../lib/format"

/** Llegenda: una eina per color. */
export function CamToolLegend({ view }: { view: CamSheetView }) {
  const { preview: p } = view
  return (
    <Stack gap={1.5}>
      <SectionLabel>Eines</SectionLabel>
      <HStack gap={3} rowGap={1.5} wrap="wrap" fontSize="xs">
        {view.tools.map((t) => (
          <HStack key={t.key} gap={1.5}>
            <Box w="12px" h="12px" rounded={t.kind === "drill" ? "full" : "sm"} style={{ background: t.color }} flexShrink={0} />
            <Text>
              {t.kind === "drill" ? "Broca" : t.kind === "blade" ? "Disc" : "Fresa"} {t.name}
              {t.diameter ? ` · Ø${fmtNum(t.diameter)}` : " · Ø ?"} · {t.count}
              {t.kind === "drill" ? (t.count === 1 ? " forat" : " forats") : t.count === 1 ? " op." : " op."}
            </Text>
          </HStack>
        ))}
        {view.small.size > 0 && (
          <HStack gap={1.5}>
            <Box w="12px" h="12px" rounded="sm" bg="yellow.subtle" borderWidth="1px" borderColor="yellow.fg" flexShrink={0} />
            <Text>Peça petita (en passades)</Text>
          </HStack>
        )}
      </HStack>
      <Text fontSize="xs" color="fg.muted">
        Línia: la geometria del programa. Discontínua i franja: el centre de l'eina i el que treu (aproximat, només per veure-ho). Fletxa: entrada en rampa. Punta: sentit de cada contorn i tall (Preferències › Regles de mecanitzat › «Sentit dels contorns i talls»).
      </Text>
      {p.unknown > 0 && (
        <Text fontSize="xs" color="fg.warning">
          {p.unknown} {p.unknown === 1 ? "línia no reconeguda" : "línies no reconegudes"} pel visor (no es dibuixen): {p.unknownLines.slice(0, 3).map((u) => `${u.line}`).join(", ")}
          {p.unknownLines.length > 3 ? "…" : ""}
        </Text>
      )}
    </Stack>
  )
}
