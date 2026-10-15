import { Box, HStack, IconButton, Text } from "@chakra-ui/react"
import { LuMinus, LuPlus } from "react-icons/lu"
import { formatLength, useUnit } from "../../../lib/units"

/** L'escala (a baix a l'esquerra) i els botons − / + amb l'escala de pantalla (a baix a la dreta). */
export function PlanZoomBar({ s, onZoom }: { s: number; onZoom: (k: number) => void }) {
  return (
    <>
      {/* Escala. */}
      <ScaleBar s={s} />
      <HStack position="absolute" right={3} bottom={3} gap={1} bg="bg.panel" rounded="md" borderWidth="1px" p={0.5} onPointerDown={(e) => e.stopPropagation()}>
        <IconButton aria-label="Allunyar" title="Allunyar" size="xs" variant="ghost" onClick={() => onZoom(1 / 1.4)}>
          <LuMinus />
        </IconButton>
        {/* Escala de pantalla (96 ppp: 1 px = 0,2646 mm), com als plànols: 1:50, 1:100… */}
        <Text fontSize="xs" color="fg.muted" minW="52px" textAlign="center" title="Escala a la pantalla">
          1:{Math.max(1, Math.round(1 / (s * 0.2646)))}
        </Text>
        <IconButton aria-label="Apropar" title="Apropar" size="xs" variant="ghost" onClick={() => onZoom(1.4)}>
          <LuPlus />
        </IconButton>
      </HStack>
    </>
  )
}

function ScaleBar({ s }: { s: number }) {
  const unit = useUnit()
  // Una mida rodona que faci entre 60 i 150 px.
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const mm = steps.find((m) => m * s >= 60) ?? 20000
  return (
    <Box position="absolute" left={3} bottom={3} fontSize="xs" color="fg.muted" pointerEvents="none">
      <Box h="6px" w={`${mm * s}px`} borderWidth="1px" borderTopWidth={0} borderColor="fg.muted" />
      {formatLength(mm, unit)}
    </Box>
  )
}
