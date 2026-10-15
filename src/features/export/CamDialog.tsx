import { CloseButton, Dialog, Portal, Text } from "@chakra-ui/react"
import type { Machine } from "../../core/model"
import { CamPreview } from "./CamPreview"
import type { MaestroPrograms } from "./useMaestroPrograms"

/** Vista CAM: els programes del zip dibuixats, per revisar-los abans d'enviar-los a la màquina. */
export function CamDialog({ open, onOpenChange, xcs, machine }: { open: boolean; onOpenChange: (open: boolean) => void; xcs: MaestroPrograms | null; machine: Machine | undefined }) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} size="full" placement="center" lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content w="100vw" maxW="100vw" h="100dvh" maxH="100dvh" rounded="none" display="flex" flexDirection="column" overflow="hidden" pt="env(safe-area-inset-top, 0px)" pb="env(safe-area-inset-bottom, 0px)" ps="env(safe-area-inset-left, 0px)" pe="env(safe-area-inset-right, 0px)">
            <Dialog.Header flexDirection="column" alignItems="start" gap={0.5} pe={14}>
              <Dialog.Title>Vista CAM</Dialog.Title>
              <Text fontSize="sm" color="fg.muted">
                El que rebrà la màquina: cada programa .xcs del zip, llegit i dibuixat.
              </Text>
            </Dialog.Header>
            <Dialog.Body flex={1} minH={0} overflowY={{ base: "auto", lg: "hidden" }} px={{ base: 4, md: 6 }} pb={6}>
              {xcs && <CamPreview sheets={xcs.sheetList} machine={machine} />}
            </Dialog.Body>
            <Dialog.CloseTrigger asChild top="calc(env(safe-area-inset-top, 0px) + 8px)" insetEnd="calc(env(safe-area-inset-right, 0px) + 8px)">
              <CloseButton size="sm" aria-label="Tancar" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
