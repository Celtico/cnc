import { Button, Dialog, HStack, Portal, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuTrash2 } from "react-icons/lu"

/**
 * «Esborrar l'historial» (el mateix a Mobles, Objectes i Ambients): botó a dalt de l'historial i
 * confirmació amb quants se n'esborraran i quants es conserven (els que són en un ambient).
 */
export function ClearHistory({ count, kept = 0, noun, keptNote, onConfirm }: { count: number; kept?: number; noun: [string, string]; keptNote?: string; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!count && !kept) return null
  const n = (k: number) => `${k} ${k === 1 ? noun[0] : noun[1]}`
  return (
    <>
      <HStack justify="flex-end">
        <Button size="xs" variant="ghost" colorPalette="red" onClick={() => setOpen(true)} disabled={!count}>
          <LuTrash2 /> Esborrar l'historial
        </Button>
      </HStack>
      <Dialog.Root role="alertdialog" open={open} onOpenChange={(e) => !e.open && setOpen(false)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Esborrar l'historial?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  S'esborraran {n(count)}. No es pot desfer.
                  {kept > 0 && keptNote ? ` ${keptNote.replace("{n}", n(kept))}` : ""}
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel·lar
                </Button>
                <Button
                  colorPalette="red"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await onConfirm()
                    } finally {
                      setBusy(false)
                      setOpen(false)
                    }
                  }}
                >
                  <LuTrash2 /> Esborrar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
