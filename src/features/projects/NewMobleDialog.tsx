import { Badge, Box, Button, Card, Dialog, Editable, HStack, IconButton, Menu, Portal, SegmentGroup, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuCopy, LuEllipsis, LuPlus, LuShare2, LuTrash2 } from "react-icons/lu"
import { CompositionThumb } from "../../components/CompositionThumb"
import { toaster } from "../../components/ui/toaster"
import { applySettingsToModule, BUILTIN_TEMPLATES, compositionHeight, compositionKind, compositionWidth, defaultModule, newId, tableModule, type Composition, type CompositionKind } from "../../core/model"
import { KINDS } from "../composition/kinds"
import { deleteUserTemplate, duplicateUserTemplate, loadUserTemplates, renameUserTemplate, type UserTemplate } from "../../db/compositionStore"
import { saveTemplateAsFile } from "../file/mobleIo"
import { useSettings } from "../settings/SettingsContext"

const size = (c: Composition) => {
  const h = Math.round(compositionHeight(c))
  const d = Math.max(...c.modules.map((m) => m.carcass.depth))
  return `${Math.round(compositionWidth(c))} × ${h} × ${d}`
}

/**
 * «Nou moble»: galeria per començar en blanc o des d'una plantilla (de l'app o teva),
 * com a Figma o Google Docs. Les plantilles teves es gestionen aquí mateix (menú ⋯).
 */
export function NewMobleDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (composition: Composition, name: string) => void
}) {
  const { settings } = useSettings()
  const [mine, setMine] = useState<UserTemplate[]>(loadUserTemplates)
  const [confirmDelete, setConfirmDelete] = useState<UserTemplate | null>(null)
  // Recarrega en obrir (s'hi poden haver desat plantilles des de l'Editor).
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setMine(loadUserTemplates())
  }
  const builtin = useMemo(() => BUILTIN_TEMPLATES.map((t) => ({ t, comp: t.make() })), [])
  // Filtre per tipus de moble (Tot, Moble, Cuina, Armari, Taula).
  const [kind, setKind] = useState<CompositionKind | "all">("all")
  const kindLabel = (k: CompositionKind) => KINDS.find((x) => x.value === k)!.label
  // Ordenades pel tipus (Moble, Cuina, Armari, Taula), i dins de cada tipus com a la llista.
  const kindOrder = (k: CompositionKind) => KINDS.findIndex((x) => x.value === k)
  const shownBuiltin = builtin.filter(({ t }) => kind === "all" || t.kind === kind).sort((a, b) => kindOrder(a.t.kind) - kindOrder(b.t.kind))
  const shownMine = mine.filter((t) => kind === "all" || compositionKind(t.composition) === kind)

  const blank = () => {
    const k = kind === "all" ? "moble" : kind
    const m = k === "taula" ? tableModule(newId("m"), "Taula") : applySettingsToModule(settings, defaultModule(newId("m"), "Mòdul 1"))
    const names: Record<CompositionKind, string> = { moble: "Moble nou", cuina: "Cuina nova", armari: "Armari nou", taula: "Taula nova", lliure: "Flat-pack nou" }
    onCreate({ kind: k, modules: [m], references: [] }, names[k])
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xl" scrollBehavior="inside">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Nou moble</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap={5}>
                  <SegmentGroup.Root size="sm" value={kind} onValueChange={(e) => e.value && setKind(e.value as CompositionKind | "all")} alignSelf={{ base: "stretch", sm: "flex-start" }}>
                    <SegmentGroup.Indicator />
                    <SegmentGroup.Item value="all" flex={{ base: 1, sm: "initial" }} justifyContent="center">
                      <SegmentGroup.ItemText>Tot</SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                    {KINDS.map((k) => (
                      <SegmentGroup.Item key={k.value} value={k.value} title={k.hint} aria-label={k.label} flex={{ base: 1, sm: "initial" }} justifyContent="center">
                        <SegmentGroup.ItemText>
                          {/* Al mòbil només la icona (el nom, al títol i a la insígnia de cada plantilla). */}
                          <HStack gap={1.5}>
                            <k.icon />
                            <Box as="span" display={{ base: "none", sm: "inline" }}>
                              {k.label}
                            </Box>
                          </HStack>
                        </SegmentGroup.ItemText>
                        <SegmentGroup.ItemHiddenInput />
                      </SegmentGroup.Item>
                    ))}
                  </SegmentGroup.Root>
                  <SimpleGrid columns={{ base: 2, md: 3 }} gap={3}>
                    <Card.Root asChild variant="outline" size="sm" cursor="pointer" _hover={{ borderColor: "wood.solid" }}>
                      <button type="button" onClick={blank}>
                        <Card.Body p={3} gap={2} alignItems="stretch" textAlign="left">
                          <Box h="96px" rounded="md" borderWidth="2px" borderStyle="dashed" display="flex" alignItems="center" justifyContent="center" color="fg.muted" fontSize="2xl">
                            <LuPlus />
                          </Box>
                          <Text fontWeight="semibold">En blanc</Text>
                          <Text fontSize="xs" color="fg.muted">
                            {kind === "taula" ? "Un tauler amb dos laterals de panell." : "Un mòdul amb els valors de les preferències."}
                          </Text>
                        </Card.Body>
                      </button>
                    </Card.Root>
                  </SimpleGrid>

                  {shownMine.length > 0 && (
                    <Stack gap={2}>
                      <Text fontSize="sm" fontWeight="semibold">
                        Les teves plantilles
                      </Text>
                      <SimpleGrid columns={{ base: 2, md: 3 }} gap={3}>
                        {shownMine.map((t) => (
                          <Card.Root key={t.id} variant="outline" size="sm" _hover={{ borderColor: "wood.solid" }}>
                            <Card.Body p={3} gap={2}>
                              <Box cursor="pointer" onClick={() => onCreate(structuredClone(t.composition), t.name)}>
                                <CompositionThumb composition={t.composition} />
                              </Box>
                              <HStack gap={1} align="center">
                                <Editable.Root
                                  defaultValue={t.name}
                                  onValueCommit={(e) => setMine(renameUserTemplate(t.id, e.value))}
                                  fontWeight="semibold"
                                  fontSize="sm"
                                  flex={1}
                                  minW={0}
                                  aria-label="Nom de la plantilla"
                                >
                                  <Editable.Preview truncate title="Clica per canviar el nom" />
                                  <Editable.Input />
                                </Editable.Root>
                                <Menu.Root>
                                  <Menu.Trigger asChild>
                                    <IconButton aria-label={`Opcions de «${t.name}»`} size="xs" variant="ghost">
                                      <LuEllipsis />
                                    </IconButton>
                                  </Menu.Trigger>
                                  <Portal>
                                    <Menu.Positioner>
                                      <Menu.Content>
                                        <Menu.Item value="dup" onClick={() => setMine(duplicateUserTemplate(t.id))}>
                                          <LuCopy /> Duplicar
                                        </Menu.Item>
                                        <Menu.Item
                                          value="file"
                                          onClick={() =>
                                            void saveTemplateAsFile(t, settings).then((r) =>
                                              toaster.create({ title: r.how === "shared" ? "Plantilla compartida" : "Plantilla desada", description: r.filename, type: "success" }),
                                            )
                                          }
                                        >
                                          <LuShare2 /> Desar com a fitxer
                                        </Menu.Item>
                                        <Menu.Separator />
                                        <Menu.Item value="del" color="fg.error" onClick={() => setConfirmDelete(t)}>
                                          <LuTrash2 /> Eliminar
                                        </Menu.Item>
                                      </Menu.Content>
                                    </Menu.Positioner>
                                  </Portal>
                                </Menu.Root>
                              </HStack>
                              <Text fontSize="xs" color="fg.muted">
                                {t.composition.modules.length} {t.composition.modules.length === 1 ? "mòdul" : "mòduls"} · {size(t.composition)}
                              </Text>
                            </Card.Body>
                          </Card.Root>
                        ))}
                      </SimpleGrid>
                    </Stack>
                  )}

                  <Stack gap={2}>
                    <Text fontSize="sm" fontWeight="semibold">
                      Plantilles de l'app
                    </Text>
                    <SimpleGrid columns={{ base: 2, md: 3 }} gap={3}>
                      {shownBuiltin.map(({ t, comp }) => (
                        <Card.Root key={t.id} asChild variant="outline" size="sm" cursor="pointer" _hover={{ borderColor: "wood.solid" }}>
                          <button type="button" onClick={() => onCreate({ ...t.make(), kind: t.kind }, t.name)}>
                            <Card.Body p={3} gap={2} alignItems="stretch" textAlign="left">
                              <CompositionThumb composition={comp} />
                              <HStack justify="space-between" gap={1}>
                                <Text fontWeight="semibold" fontSize="sm" truncate>
                                  {t.name}
                                </Text>
                                <Badge size="xs" variant="subtle" flexShrink={0}>
                                  {kindLabel(t.kind)}
                                </Badge>
                              </HStack>
                              <Text fontSize="xs" color="fg.muted" lineClamp={2}>
                                {t.description}
                              </Text>
                            </Card.Body>
                          </button>
                        </Card.Root>
                      ))}
                    </SimpleGrid>
                  </Stack>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Text fontSize="xs" color="fg.muted" flex={1}>
                  Per crear-ne una: obre un moble i, a la barra de dalt, ⋯ → Desar com a plantilla.
                </Text>
                <Button variant="outline" onClick={onClose}>
                  Cancel·lar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root role="alertdialog" open={confirmDelete !== null} onOpenChange={(e) => !e.open && setConfirmDelete(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Eliminar la plantilla «{confirmDelete?.name}»?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Els mobles que ja has fet amb aquesta plantilla no canvien.</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                  Cancel·lar
                </Button>
                <Button
                  colorPalette="red"
                  onClick={() => {
                    if (confirmDelete) setMine(deleteUserTemplate(confirmDelete.id))
                    setConfirmDelete(null)
                  }}
                >
                  <LuTrash2 /> Eliminar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
