import { Accordion, Badge, Box, Button, Card, CloseButton, Dialog, Editable, HStack, IconButton, Input, InputGroup, Menu, Portal, SegmentGroup, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { LuBookmark, LuCopy, LuEllipsis, LuHistory, LuLayoutTemplate, LuPlus, LuSearch, LuShare2, LuStore, LuTrash2 } from "react-icons/lu"
import { CompositionThumb } from "../../components/CompositionThumb"
import { toaster } from "../../components/ui/toaster"
import { applySettingsToModule, BUILTIN_TEMPLATES, compositionHeight, compositionKind, compositionWidth, defaultModule, newId, STORE_CATALOG, tableModule, type Composition, type CompositionKind, type Template } from "../../core/model"
import { KINDS } from "../composition/kinds"
import { deleteUserTemplate, duplicateUserTemplate, loadUserTemplates, renameUserTemplate, type UserTemplate } from "../../db/compositionStore"
import { saveTemplateAsFile } from "../file/mobleIo"
import { useSettings } from "../settings/SettingsContext"

const size = (c: Composition) => {
  const h = Math.round(compositionHeight(c))
  const d = Math.max(...c.modules.map((m) => m.carcass.depth))
  return `${Math.round(compositionWidth(c))} × ${h} × ${d}`
}

const kindLabel = (k: CompositionKind) => KINDS.find((x) => x.value === k)!.label
const kindOrder = (k: CompositionKind) => KINDS.findIndex((x) => x.value === k)
const euros = (n: number) => `${n.toLocaleString("ca-ES")} €`
/** Per cercar sense accents ni majúscules. */
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/** Targeta d'una plantilla de l'app: la miniatura es calcula en muntar-la (les de botiga, en obrir la categoria). */
function TemplateCard({ t, title, onPick }: { t: Template; title?: string; onPick: (t: Template) => void }) {
  const comp = useMemo(() => t.make(), [t])
  return (
    <Card.Root asChild variant="outline" size="sm" cursor="pointer" _hover={{ borderColor: "wood.solid" }}>
      <button type="button" onClick={() => onPick(t)}>
        <Card.Body p={3} gap={2} alignItems="stretch" textAlign="left">
          <CompositionThumb composition={comp} />
          <HStack justify="space-between" gap={1}>
            <Text fontWeight="semibold" fontSize="sm" truncate title={t.name}>
              {title ?? t.name}
            </Text>
            <Badge size="xs" variant="subtle" flexShrink={0}>
              {kindLabel(t.kind)}
            </Badge>
          </HStack>
          <Text fontSize="xs" color="fg.muted" lineClamp={t.price ? 3 : 2} title={t.description}>
            {t.description}
          </Text>
          {t.price !== undefined && (
            <Text fontSize="xs" fontWeight="semibold" color="wood.fg">
              Preu orientatiu: {euros(t.price)}
            </Text>
          )}
        </Card.Body>
      </button>
    </Card.Root>
  )
}

/** Títol d'un acordió de la galeria: icona, nom i quantitat. */
function FoldTitle({ icon, title, count }: { icon?: ReactNode; title: string; count: number }) {
  return (
    <HStack flex={1} gap={2} minW={0}>
      {icon && (
        <Box color="wood.fg" display="inline-flex">
          {icon}
        </Box>
      )}
      <Text fontWeight="semibold" fontSize="sm" truncate>
        {title}
      </Text>
      <Badge size="xs" variant="subtle" colorPalette="gray">
        {count}
      </Badge>
    </HStack>
  )
}

const COLS = { base: 2, md: 3, lg: 4, "2xl": 5 }

/** Acordions oberts: comencen tancats i es recorden només durant la sessió (com les seccions). */
function useSessionList(key: string): [string[], (v: string[]) => void] {
  const [v, setV] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[]
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* sense sessionStorage: només en memòria */
    }
  }, [key, v])
  return [v, setV]
}

/**
 * Pàgina de Mobles, com l'inici de Figma o Google Docs: començar en blanc, filtre per tipus i
 * acordions (tots tancats en obrir l'app): Historial (els mobles que ja tens), les teves
 * plantilles (es gestionen aquí, menú ⋯), les de l'app i les de botigues de mobles.
 */
export function NewMobleGallery({
  onCreate,
  history,
}: {
  onCreate: (composition: Composition, name: string) => void
  /** Historial: els mobles que ja tens (del tipus triat), al primer acordió. */
  history: (kind: CompositionKind | "all") => { count: number; node: ReactNode }
}) {
  const { settings } = useSettings()
  const [mine, setMine] = useState<UserTemplate[]>(loadUserTemplates)
  const [confirmDelete, setConfirmDelete] = useState<UserTemplate | null>(null)
  // Es poden haver desat plantilles des de l'Editor: es tornen a llegir en tornar a la finestra.
  useEffect(() => {
    const reload = () => setMine(loadUserTemplates())
    window.addEventListener("focus", reload)
    return () => window.removeEventListener("focus", reload)
  }, [])
  // Filtre per tipus de moble (Tot, Moble, Cuina, Armari, Taula, Flat-pack).
  const [kind, setKind] = useState<CompositionKind | "all">("all")
  const fits = (t: Template) => kind === "all" || t.kind === kind
  // Ordenades pel tipus, i dins de cada tipus com a la llista.
  const shownBuiltin = BUILTIN_TEMPLATES.filter(fits).sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind))
  const shownMine = mine.filter((t) => kind === "all" || compositionKind(t.composition) === kind)
  // Plantilles per a botigues: per categoria › tipus de moble, amb el filtre i la cerca.
  const [query, setQuery] = useState("")
  const q = fold(query.trim())
  const store = STORE_CATALOG.map((c) => ({
    ...c,
    types: c.types
      .map((ty) => ({ ...ty, items: ty.items.filter((t) => fits(t) && (!q || fold(`${c.name} ${t.name} ${t.description}`).includes(q))) }))
      .filter((ty) => ty.items.length > 0),
  })).filter((c) => c.types.length > 0)
  const storeCount = store.reduce((n, c) => n + c.types.reduce((m, ty) => m + ty.items.length, 0), 0)
  const [openSections, setOpenSections] = useSessionList("mobles:gallery")
  const [openCats, setOpenCats] = useSessionList("mobles:gallery-store")
  const hist = history(kind)
  const pick = (t: Template) => onCreate({ ...t.make(), kind: t.kind }, t.name)

  const blank = () => {
    const k = kind === "all" ? "moble" : kind
    const m = k === "taula" ? tableModule(newId("m"), "Taula") : applySettingsToModule(settings, defaultModule(newId("m"), "Mòdul 1"))
    const names: Record<CompositionKind, string> = { moble: "Moble nou", cuina: "Cuina nova", armari: "Armari nou", taula: "Taula nova", lliure: "Flat-pack nou" }
    onCreate({ kind: k, modules: [m], references: [] }, names[k])
  }

  return (
    <Stack gap={4}>
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

      <SimpleGrid columns={COLS} gap={3}>
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

      <Accordion.Root multiple collapsible lazyMount variant="enclosed" value={openSections} onValueChange={(e) => setOpenSections(e.value)}>
        <Accordion.Item value="history">
          <Accordion.ItemTrigger cursor="pointer">
            <FoldTitle icon={<LuHistory />} title="Historial" count={hist.count} />
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>{hist.node}</Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>

        <Accordion.Item value="mine">
          <Accordion.ItemTrigger cursor="pointer">
            <FoldTitle icon={<LuBookmark />} title="Les teves plantilles" count={shownMine.length} />
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>
              {shownMine.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  {mine.length === 0 ? "Encara no en tens. Obre un moble i, a la barra de dalt, ⋯ → Desar com a plantilla." : "Cap plantilla teva d'aquest tipus."}
                </Text>
              ) : (
                <SimpleGrid columns={COLS} gap={3}>
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
              )}
            </Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>

        <Accordion.Item value="app">
          <Accordion.ItemTrigger cursor="pointer">
            <FoldTitle icon={<LuLayoutTemplate />} title="Plantilles de l'app" count={shownBuiltin.length} />
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>
              <SimpleGrid columns={COLS} gap={3}>
                {shownBuiltin.map((t) => (
                  <TemplateCard key={t.id} t={t} onPick={pick} />
                ))}
              </SimpleGrid>
            </Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>

        <Accordion.Item value="store">
          <Accordion.ItemTrigger cursor="pointer">
            <FoldTitle icon={<LuStore />} title="Plantilles per a botigues de mobles" count={storeCount} />
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>
              <Stack gap={3}>
                <Text fontSize="xs" color="fg.muted">
                  Catàleg de mostra: tres dissenys per a cada tipus de moble, amb estil, materials, colors, públic i preu orientatiu.
                </Text>
                <InputGroup maxW="480px" startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => setQuery("")} /> : undefined}>
                  <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cercar: nom, estil, material, color…" aria-label="Cercar plantilles de botiga" />
                </InputGroup>
                {store.length === 0 && (
                  <Text fontSize="sm" color="fg.muted">
                    Cap plantilla no coincideix amb la cerca o el tipus.
                  </Text>
                )}
                {/* Amb cerca, totes les categories que coincideixen, obertes. */}
                <Accordion.Root multiple collapsible lazyMount variant="enclosed" size="sm" value={q ? store.map((c) => c.id) : openCats} onValueChange={(e) => !q && setOpenCats(e.value)}>
                  {store.map((c) => (
                    <Accordion.Item key={c.id} value={c.id}>
                      <Accordion.ItemTrigger cursor="pointer">
                        <FoldTitle title={c.name} count={c.types.reduce((m, ty) => m + ty.items.length, 0)} />
                        <Accordion.ItemIndicator />
                      </Accordion.ItemTrigger>
                      <Accordion.ItemContent>
                        <Accordion.ItemBody>
                          <Stack gap={4}>
                            {c.types.map((ty) => (
                              <Stack key={ty.name} gap={2}>
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                                  {ty.name}
                                </Text>
                                <SimpleGrid columns={COLS} gap={3}>
                                  {ty.items.map((t) => (
                                    <TemplateCard key={t.id} t={t} title={t.name.replace(`${ty.name} `, "")} onPick={pick} />
                                  ))}
                                </SimpleGrid>
                              </Stack>
                            ))}
                          </Stack>
                        </Accordion.ItemBody>
                      </Accordion.ItemContent>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              </Stack>
            </Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>

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
    </Stack>
  )
}
