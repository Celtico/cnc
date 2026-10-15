import { Stack } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * Grups d'una pàgina de Preferències: una sola columna, un sota l'altre (com la Configuració de
 * macOS o Figma): es llegeix de dalt a baix, sense forats, i tots els camps tenen el mateix ample.
 */
export function FoldGrid({ children }: { children: ReactNode }) {
  return (
    <Stack className="settings-stack" gap={6}>
      {children}
    </Stack>
  )
}
