import { Accordion, Badge, Box, Button, CloseButton, Drawer, Field, HStack, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuCheck, LuTriangleAlert } from "react-icons/lu"
import { MATERIAL_CATEGORIES, materialCategory, type MaterialPref } from "../../core/model"
import { MaterialThumb } from "./MaterialBits"
import { useSettings } from "./SettingsContext"

/**
 * Tria d'un material, la mateixa a tota l'app: un botó amb la mostra i el nom que obre un calaix (a la dreta a
 * l'ordinador, de baix al mòbil) amb un acordió per categoria; dins, les mostres de la textura (només es pinten les
 * de la categoria oberta) i en tocar-ne una es tria i es tanca. `emptyLabel`: una primera opció sense material
 * («Com el cos», «Com a Preferències»…), que dona `""`.
 */
export function MaterialSelect({ label, materials, value, onChange, emptyLabel, hideLabel }: { label: string; materials: MaterialPref[]; value: string; onChange: (name: string) => void; emptyLabel?: string; hideLabel?: boolean }) {
  const [open, setOpen] = useState(false)
  // La mostra del botó surt de tots els materials (la llista que es passa pot estar filtrada: sense fons, sense els de
  // simulació…); «no és a Preferències» només si de debò no hi és.
  const { settings } = useSettings()
  const current = materials.find((m) => m.name === value) ?? settings.materials.find((m) => m.name === value)
  const known = !!current
  // El valor actual no és dels que es poden triar aquí (un moble fet amb vidre al cos, un material que ja no hi és): es
  // continua veient com a valor actual, amb un avís.
  const offList = !!value && !materials.some((m) => m.name === value)
  const offNote = !known ? "No és a Preferències" : materialCategory(current) === "sim" ? "Només de simulació" : materialCategory(current) === "hard" ? "No es talla a la CNC" : "No és per a aquí"
  const cats = MATERIAL_CATEGORIES.map((c) => ({ ...c, list: materials.filter((m) => materialCategory(m) === c.id) })).filter((c) => c.list.length)
  const [openCats, setOpenCats] = useState<string[]>([])
  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }
  return (
    <Field.Root flex={hideLabel ? 1 : undefined} minW={0}>
      {!hideLabel && <Field.Label fontSize="sm">{label}</Field.Label>}
      {/* Un botó (no un desplegable, per decisió de l'usuari): sense fons (per decisió de l'usuari), tota l'amplada, la mostra i el nom. */}
      <Button
        size="sm"
        variant="ghost"
        w="full"
        justifyContent="flex-start"
        gap={2}
        px={2}
        fontWeight="normal"
        aria-label={`${label}: ${current?.name ?? (value || emptyLabel || "sense material")}`}
        onClick={() => {
          // S'obre per la categoria del material triat (sense, si només n'hi ha una, aquella).
          setOpenCats(current ? [materialCategory(current)] : cats.length === 1 ? [cats[0]!.id] : [])
          setOpen(true)
        }}
      >
        {current ? <MaterialThumb m={current} size={20} /> : <Box w="20px" h="20px" rounded="sm" borderWidth="1px" borderStyle="dashed" flexShrink={0} />}
        <Text truncate textAlign="start">
          {current?.name ?? (value || emptyLabel || "(sense material)")}
        </Text>
        {offList && (
          <Box as="span" color="orange.fg" flexShrink={0} ml="auto" display="inline-flex" title={offNote}>
            <LuTriangleAlert />
          </Box>
        )}
      </Button>
      {offList && (
        <Badge size="xs" colorPalette="orange" variant="subtle" alignSelf="flex-start" mt={1} whiteSpace="normal">
          {offNote}
        </Badge>
      )}

      <Drawer.Root open={open} onOpenChange={(e) => setOpen(e.open)} placement={{ base: "bottom", md: "end" }} size={{ base: "full", md: "sm" }}>
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content roundedTop={{ base: "l3", md: "none" }} maxH={{ base: "85dvh", md: "none" }} pb="env(safe-area-inset-bottom, 0px)">
              <Drawer.Header pt={{ base: 4, md: "calc(var(--chakra-spacing-4) + env(safe-area-inset-top, 0px))" }}>
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
                  {offList && (
                    <Text fontSize="xs" color="fg.muted">
                      Ara: «{value}» ({offNote.toLowerCase()}). Es manté fins que en triïs un altre.
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
                            {/* Mostres quadrades a tota l'amplada de la columna, alineades a dalt; el nom, sempre dues línies
                                d'alt. La triada: vora del color principal al voltant de la mostra i ✓ a la cantonada. */}
                            <SimpleGrid columns={3} gap={3} alignItems="start">
                              {c.list.map((m) => {
                                const on = m.name === value
                                return (
                                  <Box key={m.id} asChild rounded="md" cursor="pointer" textAlign="start" role="group" focusRing="outside">
                                    <button type="button" onClick={() => pick(m.name)} aria-pressed={on}>
                                      <Stack gap={1.5}>
                                        <Box position="relative" rounded="md" outline={on ? "2px solid" : undefined} outlineColor="wood.solid" outlineOffset="2px" _groupHover={on ? undefined : { opacity: 0.85 }}>
                                          <MaterialThumb m={m} size={96} fill />
                                          {on && (
                                            <Box position="absolute" top={1.5} right={1.5} w="22px" h="22px" bg="wood.solid" color="wood.contrast" rounded="full" display="flex" alignItems="center" justifyContent="center" fontSize="xs" shadow="md">
                                              <LuCheck />
                                            </Box>
                                          )}
                                        </Box>
                                        <Text fontSize="xs" lineClamp={2} minH="2lh" color={on ? "wood.fg" : undefined} fontWeight={on ? "semibold" : undefined}>
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
              {/* Al mòbil és un full de baix: la zona segura de dalt no hi toca (només a la columna de la dreta, a l'iPad). */}
              <Drawer.CloseTrigger asChild top={{ base: 3, md: "calc(var(--chakra-spacing-3) + env(safe-area-inset-top, 0px))" }}>
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
