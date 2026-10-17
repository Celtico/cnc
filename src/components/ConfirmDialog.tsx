import { Button, Dialog, Portal, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuTrash2 } from "react-icons/lu"

/**
 * Confirmació curta d'esborrar (un `Dialog` de Chakra, `alertdialog`): «Esborrar «x»?», el que passa i «No es pot desfer.»,
 * i el botó vermell. La mateixa a les galeries (Mobles, Objectes, Ambients), als grups i a les referències.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Esborrar",
  onConfirm,
  onClose,
}: {
  open: boolean
  title: ReactNode
  /** El que passa (el text acaba amb «No es pot desfer.»). */
  body: ReactNode
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  onClose: () => void
}) {
  return (
    <Dialog.Root role="alertdialog" open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>{body}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button
                colorPalette="red"
                onClick={() => {
                  onClose()
                  void onConfirm()
                }}
              >
                <LuTrash2 /> {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
