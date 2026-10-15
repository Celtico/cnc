import { Button, Dialog, Portal, Text } from "@chakra-ui/react"
import { LuMessageSquarePlus } from "react-icons/lu"

/** «Nova conversa» quan n'hi ha una: es pregunta abans d'esborrar-la. */
export function NewChatDialog({ open, running, onCancel, onConfirm }: { open: boolean; running: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog.Root role="alertdialog" open={open} onOpenChange={(e) => !e.open && onCancel()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Començar una conversa nova?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                Perdràs el context que teníeu: la conversa d'ara s'esborra i l'assistent no recordarà res del que heu parlat.{running ? " La resposta que està escrivint s'aturarà." : ""} Els canvis que ha fet als mobles i ambients es queden (es poden desfer amb ⌘Z).
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onCancel}>
                Cancel·lar
              </Button>
              <Button colorPalette="red" onClick={onConfirm}>
                <LuMessageSquarePlus /> Esborrar i començar de nou
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
