import { Accordion, Badge, Box, Button, Card, CloseButton, Dialog, Heading, HStack, IconButton, Input, InputGroup, Menu, Portal, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuBookOpen, LuCopy, LuEllipsis, LuFolderInput, LuHistory, LuPlus, LuSearch, LuTrash2 } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { uniqueName } from "../../core/file/mobleFile"
import { AMBIENT_CATEGORIES, AMBIENT_TEMPLATES, EMPTY_AMBIENT, footprintCorners, parseAmbient, roomWalls, wallCorners, type Ambient, type AmbientTemplate } from "../../core/model"
import { createAmbient, db, deleteAmbient, duplicateAmbient, setAmbientsFolder, type AmbientRow } from "../../db/db"
import { useLiveQuery } from "../../db/useLiveQuery"
import { FoldTitle } from "../projects/NewMobleGallery"
import { GALLERY_COLS, fold, useSessionList } from "../projects/galleryGrid"
import { ClearHistory } from "../projects/ClearHistory"
import { FolderedGrid, MoveToFolderDialog } from "../projects/Folders"
import { createAmbientFromTemplate, templatePreview } from "./fromTemplate"
import { AMBIENT_TAB_KEY } from "./planGeom"

/**
 * Ambients: plànols de la casa on es col·loquen els mobles (els de la llista, enllaçats) i
 * blocs senzills. Cada targeta és un ambient; «Ambient nou» en crea un amb una habitació de
 * 4 × 3 m per començar.
 */
export function AmbientsScreen({ onOpen }: { onOpen: (id: number) => void }) {
  const rows = useLiveQuery(() => db.ambients.orderBy("updatedAt").reverse().toArray(), [])
  const [toDelete, setToDelete] = useState<AmbientRow | null>(null)
  const [toMove, setToMove] = useState<AmbientRow | null>(null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const q = fold(query.trim())
  const matches = (text: string) => !q || fold(text).includes(q)
  const shownRows = (rows ?? []).filter((r) => matches(r.name))
  const catLabel = (id: string) => AMBIENT_CATEGORIES.find((c) => c.id === id)?.label ?? ""
  const shownTemplates = AMBIENT_TEMPLATES.filter((t) => matches(`${t.name} ${t.description} ${catLabel(t.category)}`))
  const shownCats = AMBIENT_CATEGORIES.filter((c) => shownTemplates.some((t) => t.category === c.id))
  const [openCats, setOpenCats] = useSessionList("mobles:ambients-categories")
  const [open, setOpen] = useSessionList("mobles:ambients")
  const found = [...(shownRows.length ? ["history"] : []), ...(shownTemplates.length ? ["catalog"] : [])]
  const create = async () => {
    const names = (await db.ambients.toArray()).map((a) => a.name)
    const data: Ambient = { ...EMPTY_AMBIENT, walls: roomWalls(0, 0, 4000, 3000) }
    onOpen(await createAmbient(uniqueName("Ambient nou", names), data))
  }
  const fromTemplate = async (t: AmbientTemplate) => {
    setBusy(t.id)
    try {
      const id = await createAmbientFromTemplate(t)
      // Els del catàleg són per veure'ls: s'obren al 3D.
      try {
        localStorage.setItem(AMBIENT_TAB_KEY, "3d")
      } catch {
        /* sense emmagatzematge */
      }
      onOpen(id)
      toaster.create({ title: `«${t.name}» creat`, description: "Els seus mobles i objectes s'han creat a Mobles i Objectes, enllaçats a l'ambient.", type: "success" })
    } finally {
      setBusy(null)
    }
  }
  return (
    <VStack align="stretch" gap={5}>
      <Heading size="xl">Ambients</Heading>
      <Text fontSize="sm" color="fg.muted" maxW="640px" mt={-3}>
        El plànol de la casa amb els mobles al seu lloc: dibuixa les parets (o posa-hi la imatge d'un plànol), col·loca-hi els teus mobles i objectes i mira-ho en 3D o fes-ne un render. Al catàleg hi ha habitacions moblades, a punt per a renders.
      </Text>
      <Stack gap={4}>
        <InputGroup maxW={{ base: "full", md: "420px" }} startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => setQuery("")} /> : undefined}>
          <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cercar ambients: nom, habitació, material…" aria-label="Cercar ambients" />
        </InputGroup>
        <SimpleGrid columns={GALLERY_COLS} gap={3}>
          <Card.Root asChild variant="outline" size="sm" cursor="pointer" _hover={{ borderColor: "wood.solid" }}>
            <button type="button" onClick={() => void create()}>
              <Card.Body p={3} gap={2} alignItems="stretch" textAlign="left">
                <Box h="96px" rounded="md" borderWidth="2px" borderStyle="dashed" display="flex" alignItems="center" justifyContent="center" color="fg.muted" fontSize="2xl">
                  <LuPlus />
                </Box>
                <Text fontWeight="semibold">En blanc</Text>
                <Text fontSize="xs" color="fg.muted">
                  Una habitació de 4 × 3 m per començar: mou-ne les parets o dibuixa'n de noves.
                </Text>
              </Card.Body>
            </button>
          </Card.Root>
        </SimpleGrid>
        <Accordion.Root multiple collapsible lazyMount variant="enclosed" value={q ? found : open} onValueChange={(e) => !q && setOpen(e.value)}>
          <Accordion.Item value="history">
            <Accordion.ItemTrigger cursor="pointer">
              <FoldTitle icon={<LuHistory />} title="Historial" count={shownRows.length} />
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                {shownRows.length === 0 ? (
                  <Text fontSize="sm" color="fg.muted">
                    {rows?.length ? "Cap ambient no coincideix amb la cerca." : "Encara no en tens: comença en blanc o des del catàleg."}
                  </Text>
                ) : (
                  <Stack gap={2}>
                    <ClearHistory
                      count={shownRows.length}
                      noun={["ambient", "ambients"]}
                      onConfirm={async () => {
                        for (const r of shownRows) await deleteAmbient(r.id)
                        toaster.create({ title: "Historial esborrat", description: "Els mobles i objectes que hi havia es queden a Mobles i Objectes.", type: "info" })
                      }}
                    />
                    <FolderedGrid
                      items={shownRows}
                      folderOf={(r) => r.folder}
                      keyOf={(r) => r.id}
                      storageKey="mobles:folders-ambients"
                      searching={!!q}
                      onRenameFolder={(from, to) => void setAmbientsFolder(shownRows.filter((r) => r.folder === from).map((r) => r.id), to)}
                      onUngroup={(name) => void setAmbientsFolder(shownRows.filter((r) => r.folder === name).map((r) => r.id), undefined)}
                      render={(r) => {
                        const a = parseAmbient(r.data)
                        return (
                          <Card.Root variant="outline" size="sm" _hover={{ borderColor: "wood.solid" }}>
                            <Card.Body p={3} gap={2} cursor="pointer" onClick={() => onOpen(r.id)}>
                              <AmbientThumb a={a} />
                              <Text fontWeight="semibold" fontSize="sm" truncate title={r.name}>
                                {r.name}
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                {a.walls.length} {a.walls.length === 1 ? "paret" : "parets"} · {a.items.length} {a.items.length === 1 ? "element" : "elements"}
                              </Text>
                            </Card.Body>
                            <Card.Footer px={3} pb={3} pt={0} gap={0.5} justifyContent="space-between">
                              <Text fontSize="xs" color="fg.subtle" truncate>
                                {new Date(r.updatedAt).toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" })}
                              </Text>
                              <Menu.Root positioning={{ placement: "bottom-end" }}>
                                <Menu.Trigger asChild>
                                  <IconButton aria-label={`Opcions de «${r.name}»`} size="xs" variant="ghost">
                                    <LuEllipsis />
                                  </IconButton>
                                </Menu.Trigger>
                                <Portal>
                                  <Menu.Positioner>
                                    <Menu.Content>
                                      <Menu.Item value="dup" onClick={() => void duplicateAmbient(r.id).then(() => toaster.create({ title: "Ambient duplicat", type: "success" }))}>
                                        <LuCopy /> Duplicar
                                      </Menu.Item>
                                      <Menu.Item value="move" onClick={() => setToMove(r)}>
                                        <LuFolderInput /> Moure a un grup…
                                      </Menu.Item>
                                      <Menu.Separator />
                                      <Menu.Item value="del" color="fg.error" onClick={() => setToDelete(r)}>
                                        <LuTrash2 /> Esborrar
                                      </Menu.Item>
                                    </Menu.Content>
                                  </Menu.Positioner>
                                </Portal>
                              </Menu.Root>
                            </Card.Footer>
                          </Card.Root>
                        )
                      }}
                    />
                  </Stack>
                )}
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
          <Accordion.Item value="catalog">
            <Accordion.ItemTrigger cursor="pointer">
              <FoldTitle icon={<LuBookOpen />} title="Catàleg d'ambients" count={shownTemplates.length} />
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <Stack gap={3}>
                  <Text fontSize="xs" color="fg.muted">
                    Habitacions moblades amb mobles de les plantilles i objectes, per fer-ne renders per a la web o el catàleg. En triar-ne una, els mobles es creen a Mobles i Objectes i queden enllaçats.
                  </Text>
                  {/* Una categoria per acordió (com les plantilles de botiga); la cerca obre les que coincideixen. */}
                  <Accordion.Root multiple collapsible lazyMount variant="plain" value={q ? shownCats.map((c) => c.id) : openCats} onValueChange={(e) => !q && setOpenCats(e.value)}>
                    {shownCats.map((c) => {
                      const list = shownTemplates.filter((t) => t.category === c.id)
                      return (
                        <Accordion.Item key={c.id} value={c.id}>
                          <Accordion.ItemTrigger cursor="pointer">
                            <FoldTitle title={c.label} count={list.length} />
                            <Accordion.ItemIndicator />
                          </Accordion.ItemTrigger>
                          <Accordion.ItemContent>
                            <Accordion.ItemBody>
                              <SimpleGrid columns={GALLERY_COLS} gap={3}>
                                {list.map((t) => (
                                  <CatalogCard key={t.id} t={t} busy={busy === t.id} onPick={() => void fromTemplate(t)} />
                                ))}
                              </SimpleGrid>
                            </Accordion.ItemBody>
                          </Accordion.ItemContent>
                        </Accordion.Item>
                      )
                    })}
                  </Accordion.Root>
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
      </Stack>

      <MoveToFolderDialog
        open={toMove !== null}
        what={toMove?.name ?? ""}
        folders={[...new Set((rows ?? []).filter((r) => r.folder).map((r) => r.folder!))].sort()}
        current={toMove?.folder}
        onPick={(f) => toMove && void setAmbientsFolder([toMove.id], f)}
        onClose={() => setToMove(null)}
      />
      <Dialog.Root role="alertdialog" open={toDelete !== null} onOpenChange={(e) => !e.open && setToDelete(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Esborrar «{toDelete?.name}»?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Els mobles i objectes que hi ha no s'esborren: continuen a Mobles i Objectes.</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setToDelete(null)}>
                  Cancel·lar
                </Button>
                <Button
                  colorPalette="red"
                  onClick={() => {
                    if (toDelete) void deleteAmbient(toDelete.id)
                    setToDelete(null)
                  }}
                >
                  <LuTrash2 /> Esborrar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  )
}

/** Targeta del catàleg: miniatura del plànol moblat (es calcula en obrir el catàleg). */
function CatalogCard({ t, busy, onPick }: { t: AmbientTemplate; busy: boolean; onPick: () => void }) {
  const preview = useMemo(() => templatePreview(t), [t])
  return (
    <Card.Root asChild variant="outline" size="sm" cursor="pointer" _hover={{ borderColor: "wood.solid" }} opacity={busy ? 0.6 : 1}>
      <button type="button" onClick={onPick} disabled={busy}>
        <Card.Body p={3} gap={2} alignItems="stretch" textAlign="left">
          <AmbientThumb a={preview} />
          <HStack justify="space-between" gap={1}>
            <Text fontWeight="semibold" fontSize="sm" truncate title={t.name}>
              {t.name}
            </Text>
            <Badge size="xs" variant="subtle" flexShrink={0}>
              {t.items.length} elements
            </Badge>
          </HStack>
          <Text fontSize="xs" color="fg.muted" lineClamp={2} title={t.description}>
            {t.description}
          </Text>
        </Card.Body>
      </button>
    </Card.Root>
  )
}

/** Miniatura: parets i elements (els mobles, amb una petjada aproximada). */
function AmbientThumb({ a }: { a: Ambient }) {
  const polys = [
    ...a.walls.map((w) => ({ pts: wallCorners(w), wall: true })),
    ...a.items.map((it) => ({ pts: footprintCorners(it.x, it.y, it.kind === "block" ? it.w : 800, it.kind === "block" ? it.d : 500, it.rot), wall: false })),
  ]
  const xs = polys.flatMap((p) => p.pts.map((q) => q[0])), ys = polys.flatMap((p) => p.pts.map((q) => q[1]))
  const x0 = Math.min(0, ...xs), y0 = Math.min(0, ...ys), x1 = Math.max(1000, ...xs), y1 = Math.max(1000, ...ys)
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} style={{ width: "100%", height: 96, background: "var(--chakra-colors-bg-subtle)", borderRadius: 6 }} aria-hidden>
      {polys.map((p, i) => (
        <polygon key={i} points={p.pts.map((q) => q.join(",")).join(" ")} fill={p.wall ? "var(--chakra-colors-fg)" : "var(--chakra-colors-wood-muted)"} stroke={p.wall ? "none" : "var(--chakra-colors-wood-solid)"} strokeWidth={(x1 - x0) / 300} />
      ))}
    </svg>
  )
}
