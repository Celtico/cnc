import { Button, Dialog, Portal, Text } from "@chakra-ui/react"
import { LuRotateCcw } from "react-icons/lu"
import type { SectionReset } from "./useSectionReset"

/** Confirmació de «Restaurar valors inicials» d'una secció. */
export function ResetDialog({ reset, onCancel, onConfirm }: { reset: SectionReset | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog.Root role="alertdialog" open={reset !== null} onOpenChange={(e) => !e.open && onCancel()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Restaurar «{reset?.label}»?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>Es perdran els canvis d'aquesta secció i tornaran els valors inicials. Els mobles ja fets no canvien.</Text>
              {reset?.key === "materials" && <Text mt={2}>El tauler i el fons per defecte i les mides de tauler d'un material que deixi d'existir tornen als inicials.</Text>}
              {reset?.note && <Text mt={2}>{reset.note}</Text>}
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => onCancel()}>
                Cancel·lar
              </Button>
              <Button colorPalette="red" onClick={onConfirm}>
                <LuRotateCcw /> Restaurar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
