import { Box, Button, CloseButton, Dialog, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { LuPlus } from "react-icons/lu"
import type { MaterialPref } from "../../core/model"
import { MaterialPreview } from "./MaterialBits"
import { MATERIAL_LIBRARY, type LibraryItem } from "./materialLibrary"

/** Diàleg «Afegir material»: la biblioteca de materials fets en graella (i «En blanc» per començar de zero). */
export function MaterialLibrary({ open, onClose, onPick, onBlank }: { open: boolean; onClose: () => void; onPick: (m: LibraryItem) => void; onBlank: () => void }) {
  const groups = [...new Set(MATERIAL_LIBRARY.map((m) => m.group))]
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size={{ base: "full", md: "xl" }} placement="center" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content pt={{ base: "env(safe-area-inset-top, 0px)", md: 0 }} h={{ base: "100dvh", md: "auto" }} maxH={{ md: "85dvh" }}>
            <Dialog.Header>
              <Dialog.Title>Afegir un material</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={6}>
                <Text fontSize="sm" color="fg.muted">
                  Tria'n un de fet: queda afegit amb la seva categoria, gruixos i cantell. Després el pots retocar amb «Editar la textura».
                </Text>
                {groups.map((g) => (
                  <Stack key={g} gap={2}>
                    <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                      {g}
                    </Text>
                    <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={3}>
                      {MATERIAL_LIBRARY.filter((m) => m.group === g).map((m) => (
                        <Box
                          key={m.name}
                          as="button"
                          textAlign="left"
                          rounded="md"
                          p={1.5}
                          borderWidth="1px"
                          borderColor="transparent"
                          _hover={{ borderColor: "wood.solid", bg: "bg.muted" }}
                          cursor="pointer"
                          onClick={() => {
                            onPick(m)
                            onClose()
                          }}
                        >
                          <MaterialPreview m={{ ...m, id: m.name } as MaterialPref} w={150} h={90} caption={false} />
                          <Text fontSize="sm" fontWeight="medium" mt={1.5} truncate>
                            {m.name}
                          </Text>
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Stack>
                ))}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="ghost"
                mr="auto"
                onClick={() => {
                  onBlank()
                  onClose()
                }}
              >
                <LuPlus /> En blanc
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild top={{ base: "calc(env(safe-area-inset-top, 0px) + 8px)", md: 2 }}>
              <CloseButton size="sm" aria-label="Tancar" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
