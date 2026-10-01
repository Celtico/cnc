import { Accordion, Box, Button, CloseButton, Drawer, Field, HStack, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuCheck, LuPalette } from "react-icons/lu"
import { MATERIAL_CATEGORIES, materialCategory, type MaterialPref } from "../../core/model"
import { MaterialThumb } from "./MaterialBits"

/**
 * Tria d'un material, la mateixa a tota l'app: un botó amb la mostra i el nom que obre un calaix (a la dreta a
 * l'ordinador, de baix al mòbil) amb un acordió per categoria; dins, les mostres de la textura (només es pinten les
 * de la categoria oberta) i en tocar-ne una es tria i es tanca. `emptyLabel`: una primera opció sense material
 * («Com el cos», «Com a Preferències»…), que dona `""`.
 */
export function MaterialSelect({ label, materials, value, onChange, emptyLabel, hideLabel }: { label: string; materials: MaterialPref[]; value: string; onChange: (name: string) => void; emptyLabel?: string; hideLabel?: boolean }) {
  const [open, setOpen] = useState(false)
  const current = materials.find((m) => m.name === value)
  const cats = MATERIAL_CATEGORIES.map((c) => ({ ...c, list: materials.filter((m) => materialCategory(m) === c.id) })).filter((c) => c.list.length)
  const [openCats, setOpenCats] = useState<string[]>([])
  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }
  return (
    <Field.Root flex={hideLabel ? 1 : undefined} minW={0}>
      {!hideLabel && <Field.Label fontSize="sm">{label}</Field.Label>}
      {/* Un botó (no un desplegable, per decisió de l'usuari): fons suau, amplada del contingut i la icona de Materials. */}
      <Button
        size="sm"
        variant="subtle"
        alignSelf="flex-start"
        maxW="full"
        justifyContent="flex-start"
        gap={2}
        px={2}
        fontWeight="normal"
        aria-label={`${label}: ${current?.name ?? (value || emptyLabel || "sense material")}`}
        onClick={() => {
          // S'obre per la categoria del material triat.
          setOpenCats(current ? [materialCategory(current)] : [])
          setOpen(true)
        }}
      >
        {current ? <MaterialThumb m={current} size={20} /> : <Box w="20px" h="20px" rounded="sm" borderWidth="1px" borderStyle="dashed" flexShrink={0} />}
        <Text truncate textAlign="start">
          {current?.name ?? (value || emptyLabel || "(sense material)")}
        </Text>
        <Box color="wood.fg" display="inline-flex" flexShrink={0}>
          <LuPalette />
        </Box>
      </Button>

      <Drawer.Root open={open} onOpenChange={(e) => setOpen(e.open)} placement={{ base: "bottom", md: "end" }} size={{ base: "full", md: "sm" }}>
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content roundedTop={{ base: "l3", md: "none" }} maxH={{ base: "85dvh", md: "none" }} pb="env(safe-area-inset-bottom, 0px)">
              <Drawer.Header pt="calc(var(--chakra-spacing-4) + env(safe-area-inset-top, 0px))">
                <Drawer.Title>{label}</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>
                <Stack gap={3}>
                  {emptyLabel !== undefined && (
                    <Row on={value === ""} onClick={() => pick("")}>
                      <Box w="36px" h="36px" rounded="md" borderWidth="1px" borderStyle="dashed" flexShrink={0} />
                      <Text fontSize="sm">{emptyLabel}</Text>
                    </Row>
                  )}
                  {value && !current && (
                    <Text fontSize="xs" color="fg.muted">
                      Ara: «{value}» (no és a Preferències).
                    </Text>
                  )}
                  <Accordion.Root multiple collapsible lazyMount variant="plain" value={openCats} onValueChange={(e) => setOpenCats(e.value)}>
                    {cats.map((c) => (
                      <Accordion.Item key={c.id} value={c.id}>
                        <Accordion.ItemTrigger cursor="pointer" borderBottomWidth="1px" rounded="none" px={0}>
                          <HStack flex={1} gap={2}>
                            <Text fontWeight="semibold" fontSize="sm">
                              {c.label}
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                              {c.list.length}
                            </Text>
                          </HStack>
                          <Accordion.ItemIndicator />
                        </Accordion.ItemTrigger>
                        <Accordion.ItemContent>
                          <Accordion.ItemBody px={0}>
                            {/* Mostres de la textura: només les de la categoria oberta (lazyMount). */}
                            <SimpleGrid columns={3} gap={2}>
                              {c.list.map((m) => {
                                const on = m.name === value
                                return (
                                  <Box
                                    key={m.id}
                                    asChild
                                    p={1.5}
                                    rounded="md"
                                    borderWidth="2px"
                                    borderColor={on ? "wood.solid" : "transparent"}
                                    bg={on ? "wood.subtle" : undefined}
                                    _hover={{ bg: "bg.muted" }}
                                    cursor="pointer"
                                    textAlign="start"
                                  >
                                    <button type="button" onClick={() => pick(m.name)} aria-pressed={on}>
                                      <Stack gap={1}>
                                        <Box position="relative">
                                          <MaterialThumb m={m} size={96} />
                                          {on && (
                                            <Box position="absolute" top={1} right={1} bg="wood.solid" color="wood.contrast" rounded="full" p={0.5} display="inline-flex">
                                              <LuCheck />
                                            </Box>
                                          )}
                                        </Box>
                                        <Text fontSize="xs" lineClamp={2}>
                                          {m.name}
                                        </Text>
                                      </Stack>
                                    </button>
                                  </Box>
                                )
                              })}
                            </SimpleGrid>
                          </Accordion.ItemBody>
                        </Accordion.ItemContent>
                      </Accordion.Item>
                    ))}
                  </Accordion.Root>
                </Stack>
              </Drawer.Body>
              <Drawer.CloseTrigger asChild top="calc(var(--chakra-spacing-3) + env(safe-area-inset-top, 0px))">
                <CloseButton size="sm" aria-label="Tancar" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Field.Root>
  )
}

function Row({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Box asChild p={1.5} rounded="md" borderWidth="2px" borderColor={on ? "wood.solid" : "transparent"} bg={on ? "wood.subtle" : undefined} _hover={{ bg: "bg.muted" }} cursor="pointer">
      <button type="button" onClick={onClick} aria-pressed={on}>
        <HStack gap={3}>{children}</HStack>
      </button>
    </Box>
  )
}
