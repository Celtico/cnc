import { Button, Dialog, Portal, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import { NumRow } from "../../../components/NumRow"

export function CalibrateDialog({ open, measured, onClose, onApply }: { open: boolean; measured: number; onClose: () => void; onApply: (real: number) => void }) {
  const [real, setReal] = useState(1000)
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xs">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Mida real</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <Text fontSize="sm" color="fg.muted">
                  Ara fa {Math.round(measured)} mm al plànol. Quant fa de debò?
                </Text>
                <NumRow label="Distància real" value={real} min={10} step={10} onChange={setReal} />
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" onClick={() => onApply(real)}>
                Posar a escala
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
