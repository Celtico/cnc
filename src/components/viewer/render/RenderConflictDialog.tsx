import { Button, Dialog, Portal, Stack, Text } from "@chakra-ui/react"
import { LuEye, LuRotateCcw } from "react-icons/lu"
import { renderProgressText, renderStateText, resolvePendingRender, useRenderStatus } from "./renderStore"

/**
 * «Ja hi ha un render»: s'ha demanat el Render d'un altre moble o ambient mentre el d'ara calcula o té una imatge sense
 * desar (`renderStore.ts`). Continuar el que corre (es mostra), aturar-lo i començar el nou (es perd), o cancel·lar.
 */
export function RenderConflictDialog({ pending }: { /** Nom del document del render nou (`null`: no es pregunta res). */ pending: string | null }) {
  const status = useRenderStatus()
  const cancel = () => resolvePendingRender("cancel")
  return (
    <Dialog.Root role="alertdialog" open={pending !== null} onOpenChange={(e) => !e.open && cancel()} placement="center">
      <Portal>
        {/* Per sobre de la finestra del Render (que és per sobre de tot). */}
        <Dialog.Backdrop style={{ zIndex: "calc(var(--chakra-z-index-tooltip) - 5)" }} />
        <Dialog.Positioner style={{ zIndex: "calc(var(--chakra-z-index-tooltip) - 5)" }}>
          <Dialog.Content mx={4}>
            <Dialog.Header>
              <Dialog.Title>Ja hi ha un render</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={2}>
                <Text fontSize="sm">
                  El render de <strong>«{status?.name}»</strong>{" "}
                  {status?.running ? "està calculant" : "té una imatge que no s'ha desat"}. Què en vols fer abans de fer el de <strong>«{pending}»</strong>?
                </Text>
                {status && (
                  <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
                    {renderStateText(status)} · {renderProgressText(status)}
                  </Text>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer flexWrap="wrap">
              <Button variant="ghost" onClick={cancel}>
                Cancel·lar
              </Button>
              <Button variant="outline" colorPalette="red" onClick={() => resolvePendingRender("replace")}>
                <LuRotateCcw /> Aturar-lo i començar el nou
              </Button>
              <Button colorPalette="wood" onClick={() => resolvePendingRender("keep")}>
                <LuEye /> Continuar el que corre
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
