import { Box, Text } from "@chakra-ui/react"
import { FloatingWindow } from "../../components/FloatingWindow"
import type { Machine } from "../../core/model"
import { CamPreview } from "./CamPreview"
import type { MaestroPrograms } from "./useMaestroPrograms"

/** Vista CAM: els programes del zip dibuixats, per revisar-los abans d'enviar-los a la màquina. Una finestra gran (`FloatingWindow`). */
export function CamDialog({ open, onOpenChange, xcs, machine }: { open: boolean; onOpenChange: (open: boolean) => void; xcs: MaestroPrograms | null; machine: Machine | undefined }) {
  return (
    <FloatingWindow id="cam" open={open} onClose={() => onOpenChange(false)} title="Vista CAM" width={1400} height={1000} initialFocus={false} bodyProps={{ display: "flex", flexDirection: "column", gap: 3, minH: 0, overflowY: { base: "auto", lg: "hidden" }, px: { base: 4, md: 6 }, pb: 6 }}>
      <Text fontSize="sm" color="fg.muted" flexShrink={0}>
        El que rebrà la màquina: cada programa .xcs del zip, llegit i dibuixat.
      </Text>
      <Box flex={1} minH={0}>
        {xcs && <CamPreview sheets={xcs.sheetList} machine={machine} />}
      </Box>
    </FloatingWindow>
  )
}
