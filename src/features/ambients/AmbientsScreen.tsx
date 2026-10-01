import { Accordion, Badge, Button, Card, CloseButton, Dialog, HStack, IconButton, Input, InputGroup, Menu, Portal, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react"
import { useMemo, useState, type ReactNode } from "react"
import { LuBookOpen, LuFolders, LuCopy, LuEllipsis, LuFolderInput, LuHistory, LuPlus, LuSearch, LuTrash2 } from "react-icons/lu"
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
import { PageHeader } from "../../components/PageHeader"

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
  const looseRows = shownRows.filter((r) => !r.folder)
  const groupedRows = shownRows.filter((r) => r.folder)
  const catLabel = (id: string) => AMBIENT_CATEGORIES.find((c) => c.id === id)?.label ?? ""
  const shownTemplates = AMBIENT_TEMPLATES.filter((t) => matches(`${t.name} ${t.description} ${catLabel(t.category)}`))
  const shownCats = AMBIENT_CATEGORIES.filter((c) => shownTemplates.some((t) => t.category === c.id))
  const [openCats, setOpenCats] = useSessionList("mobles:ambients-categories")
  const [open, setOpen] = useSessionList("mobles:ambients")
  const found = [...(groupedRows.length ? ["projects"] : []), ...(looseRows.length ? ["history"] : []), ...(shownTemplates.length ? ["catalog"] : [])]
  const create = async () => {
    const names = (await db.ambients.toArray()).map((a) => a.name)
    const data: Ambient = { ...EMPTY_AMBIENT, walls: roomWalls(0, 0, 4000, 3000) }
    onOpen(await createAmbient(uniqueName("Ambient nou", names), data))
  }
  // «Duplicar (per a un client)…»: es pregunta per a qui és (client o projecte, opcional). Les escenes del catàleg s'obren directament.
  const [asking, setAsking] = useState<{ t: AmbientTemplate } | { row: AmbientRow } | null>(null)
  const [client, setClient] = useState("")
  const clients = [...new Set((rows ?? []).filter((r) => r.folder).map((r) => r.folder!))].sort()
  const fromTemplate = async (t: AmbientTemplate, who?: string) => {
    setBusy(t.id)
    try {
      const id = await createAmbientFromTemplate(t, who)
      // Els del catàleg són per veure'ls: s'obren al 3D.
      try {
        localStorage.setItem(AMBIENT_TAB_KEY, "3d")
      } catch {
        /* sense emmagatzematge */
      }
      onOpen(id)
      toaster.create({ title: `«${t.name}» creat`, description: who ? `Els seus mobles i objectes són al grup «${who.trim()}» de Mobles i Objectes, enllaçats a l'ambient.` : "Va a l'Historial, amb els seus mobles i objectes. Si és per a un client: ⋯ › «Duplicar (per a un client)…».", type: "success" })
    } finally {
      setBusy(null)
    }
  }
  // Historial = el que és de pas (sense grup); el que es desa en un grup passa a Projectes.
  const ambGrid = (show: "folders" | "loose", list: AmbientRow[], toolbar?: ReactNode) => (
    <FolderedGrid
      show={show}
      items={list}
      folderOf={(r) => r.folder}
      keyOf={(r) => r.id}
      storageKey="mobles:folders-ambients"
      toolbar={toolbar}
      selection={{
        noun: ["ambient", "ambients"],
        folders: [...new Set((rows ?? []).filter((r) => r.folder).map((r) => r.folder!))].sort(),
        onMove: (ids, f) => void setAmbientsFolder(ids as number[], f),
        onDelete: async (ids) => {
          for (const id of ids as number[]) await deleteAmbient(id)
          toaster.create({ title: ids.length === 1 ? "1 esborrat" : `${ids.length} esborrats`, description: "Els mobles i objectes que hi havia es queden a Mobles i Objectes.", type: "info" })
        },
      }}
      searching={!!q}
      onRenameFolder={(from, to) => void setAmbientsFolder((rows ?? []).filter((r) => r.folder === from).map((r) => r.id), to)}
      onUngroup={(name) => void setAmbientsFolder((rows ?? []).filter((r) => r.folder === name).map((r) => r.id), undefined)}
      render={(r) => {
        const a = parseAmbient(r.data)
        return (
          <Card.Root variant="outline" size="sm" _hover={{ borderColor: "wood.solid" }}>
            <Card.Body p={3} gap={2} cursor="pointer" onClick={() => onOpen(r.id)}>
              <AmbientThumb a={a} />
              <Text className="card-title" fontWeight="semibold" fontSize="sm" lineClamp={2} title={r.name}>
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
                      <Menu.Item value="dup" onClick={() => (setClient(""), setAsking({ row: r }))}>
                        <LuCopy /> Duplicar (per a un client)…
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
  )

  return (
    <VStack align="stretch" gap={5}>
      <PageHeader
        title="Ambients"
        description="El plànol de la casa amb els mobles al seu lloc: dibuixa les parets (o posa-hi la imatge d'un plànol), col·loca-hi els teus mobles i objectes i mira-ho en 3D o fes-ne un render. Al catàleg hi ha habitacions moblades, a punt per a renders."
        actions={
          <Button colorPalette="wood" size={{ base: "sm", md: "md" }} onClick={() => void create()}>
            <LuPlus /> Nou ambient
          </Button>
        }
      />
      <Stack gap={4}>
        <InputGroup maxW={{ base: "full", md: "420px" }} startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => setQuery("")} /> : undefined}>
          <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cercar ambients: nom, habitació, material…" aria-label="Cercar ambients" />
        </InputGroup>
        <Accordion.Root multiple collapsible lazyMount variant="enclosed" value={q ? found : open} onValueChange={(e) => !q && setOpen(e.value)}>
          <Accordion.Item value="history">
            <Accordion.ItemTrigger cursor="pointer">
              <FoldTitle icon={<LuHistory />} title="Historial" count={looseRows.length} />
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                {looseRows.length === 0 ? (
                  <Text fontSize="sm" color="fg.muted">
                    {shownRows.length ? "L'historial és buit: el que tens és a Projectes." : rows?.length ? "Cap ambient no coincideix amb la cerca." : "Encara no en tens: comença en blanc o des del catàleg."}
                  </Text>
                ) : (
                  ambGrid(
                    "loose",
                    looseRows,
                        <ClearHistory
                          count={looseRows.length}
                          noun={["ambient", "ambients"]}
                          onConfirm={async () => {
                            for (const r of looseRows) await deleteAmbient(r.id)
                            toaster.create({ title: "Historial esborrat", description: "Els dels Projectes es conserven; els mobles i objectes que hi havia es queden a Mobles i Objectes.", type: "info" })
                          }}
                        />,
                  )
                )}
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
          <Accordion.Item value="projects">
            <Accordion.ItemTrigger cursor="pointer">
              <FoldTitle icon={<LuFolders />} title="Projectes" count={groupedRows.length} />
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                {groupedRows.length ? (
                  ambGrid("folders", groupedRows)
                ) : (
                  <Text fontSize="sm" color="fg.muted">
                    Encara no n'hi ha cap. Amb «Duplicar (per a un client)…» d'un ambient, o amb «Grup nou» a l'Historial: el que hi desis queda aquí i «Esborrar l'historial» no el toca.
                  </Text>
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

      <Dialog.Root open={asking !== null} onOpenChange={(e) => !e.open && setAsking(null)} size="sm">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const a = asking
                  setAsking(null)
                  if (a && "t" in a) void fromTemplate(a.t, client)
                  else if (a) void duplicateAmbient(a.row.id, client).then((id) => {
                    toaster.create({ title: "Ambient duplicat", description: "Amb còpies pròpies dels seus mobles i objectes: canviar-los no toca l'original.", type: "success" })
                    if (id) onOpen(id)
                  })
                }}
              >
                <Dialog.Header>
                  <Dialog.Title>«{asking ? ("t" in asking ? asking.t.name : asking.row.name) : ""}» per a…</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <Stack gap={3}>
                    <Text fontSize="sm" color="fg.muted">
                      Es fa una còpia nova de l'escena amb els seus mobles i objectes. Si és per a un client o un projecte, posa-hi el
                      nom: tot anirà al seu grup (a Ambients, Mobles i Objectes) i no es barrejarà amb el d'altres clients.
                    </Text>
                    <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client o projecte (opcional)" aria-label="Client o projecte" autoFocus list="ambient-clients" />
                    <datalist id="ambient-clients">
                      {clients.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Stack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="outline" onClick={() => setAsking(null)}>
                    Cancel·lar
                  </Button>
                  <Button type="submit" colorPalette="wood">
                    <LuPlus /> Crear l'ambient
                  </Button>
                </Dialog.Footer>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
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
            <Text className="card-title" fontWeight="semibold" fontSize="sm" lineClamp={2} title={t.name}>
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
