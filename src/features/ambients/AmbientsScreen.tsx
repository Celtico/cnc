import { Badge, Button, Dialog, Input, IconButton, Menu, Portal, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react"
import { useEffect, useState, type ReactNode } from "react"
import { LuFolders, LuCopy, LuEllipsis, LuFolderInput, LuHistory, LuPlus, LuTrash2 } from "react-icons/lu"
import { SearchBar } from "../../components/SearchBar"
import { toaster } from "../../components/ui/toaster"
import { uniqueName } from "../../core/file/mobleFile"
import { AMBIENT_CATEGORIES, AMBIENT_TEMPLATES, EMPTY_AMBIENT, parseAmbient, type Ambient, type AmbientTemplate } from "../../core/model"
import { createAmbient, db, deleteAmbient, duplicateAmbient, setAmbientsFolder, type AmbientRow } from "../../db/db"
import { useSettings } from "../settings/SettingsContext"
import { useLiveQuery } from "../../db/useLiveQuery"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { GALLERY_COLS, fold, useSessionList } from "../projects/galleryGrid"
import { ClearHistory } from "../projects/ClearHistory"
import { FolderedGrid, MoveToFolderDialog } from "../projects/Folders"
import { createAmbientFromTemplate } from "./fromTemplate"
import { AMBIENT_TAB_KEY } from "./planGeom"
import { PageHeader } from "../../components/PageHeader"
import { CardDate, GalleryCard } from "../projects/GalleryCard"
import { CatalogSection } from "../projects/CatalogSection"
import { SnapshotThumb } from "../../components/SnapshotThumb"
import { catalogThumb, needsAmbientThumb, requestAmbientThumb, requestCatalogThumb } from "./ambientThumbs"

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
  const shownRows = (rows ?? []).filter((r) => matches(`${r.name} ${r.folder ?? ""}`))
  const looseRows = shownRows.filter((r) => !r.folder)
  const groupedRows = shownRows.filter((r) => r.folder)
  const catLabel = (id: string) => AMBIENT_CATEGORIES.find((c) => c.id === id)?.label ?? ""
  const shownTemplates = AMBIENT_TEMPLATES.filter((t) => matches(`${t.name} ${t.description} ${catLabel(t.category)}`))
  const shownCats = AMBIENT_CATEGORIES.filter((c) => shownTemplates.some((t) => t.category === c.id))
  const [openCats, setOpenCats] = useSessionList("mobles:ambients-categories")
  const found = [...(groupedRows.length ? ["projects"] : []), ...(looseRows.length ? ["history"] : []), ...(shownTemplates.length ? ["catalog"] : [])]
  const create = async () => {
    const names = (await db.ambients.toArray()).map((a) => a.name)
    // Buit (per decisió de l'usuari: «que no fiqui res»): sense parets ni elements; es dibuixen al plànol.
    const data: Ambient = { ...EMPTY_AMBIENT }
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
          <GalleryCard
            thumb={<RowThumb row={r} />}
            title={r.name}
            description={`${a.walls.length} ${a.walls.length === 1 ? "paret" : "parets"}`}
            tags={<ElementsTag n={a.items.length} />}
            onClick={() => onOpen(r.id)}
            footer={
              <>
                <CardDate at={r.updatedAt} />
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
              </>
            }
          />
        )
      }}
    />
  )

  return (
    <VStack align="stretch" gap={5}>
      <PageHeader
        title="Ambients"
        description="El plànol de la casa amb els mobles al seu lloc: dibuixa les parets (o posa-hi la imatge d'un plànol), col·loca-hi els teus mobles i objectes i mira-ho en 3D o fes-ne un render. Al catàleg hi ha habitacions moblades, a punt per a renders."
      />
      <Stack gap={4}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cercar ambients: nom, habitació, material…" ariaLabel="Cercar ambients" add={{ label: "Nou ambient", onClick: () => void create() }} />
        <FoldGroup variant="gallery" storageKey="mobles:ambients" forceOpen={q ? found : null}>
          <FoldItem id="history" icon={LuHistory} title="Historial" count={looseRows.length}>
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
          </FoldItem>
          <FoldItem id="projects" icon={LuFolders} title="Projectes" count={groupedRows.length}>
            {groupedRows.length ? (
              ambGrid("folders", groupedRows)
            ) : (
              <Text fontSize="sm" color="fg.muted">
                Encara no n'hi ha cap. Amb «Duplicar (per a un client)…» d'un ambient, o amb «Grup nou» a l'Historial: el que hi desis queda aquí i «Esborrar» de l'Historial no el toca.
              </Text>
            )}
          </FoldItem>
          <CatalogSection
            value="catalog"
            description="Habitacions moblades amb mobles de les plantilles i objectes, per fer-ne renders per a la web o el catàleg. En triar-ne una, els mobles es creen a Mobles i Objectes i queden enllaçats."
            searching={!!q}
            open={openCats}
            onOpenChange={setOpenCats}
            categories={shownCats.map((c) => {
              const list = shownTemplates.filter((t) => t.category === c.id)
              return {
                id: c.id,
                label: c.label,
                count: list.length,
                content: (
                  <SimpleGrid columns={GALLERY_COLS} gap={3}>
                    {list.map((t) => (
                      <CatalogCard key={t.id} t={t} busy={busy === t.id} onPick={() => void fromTemplate(t)} />
                    ))}
                  </SimpleGrid>
                ),
              }
            })}
          />
        </FoldGroup>
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
  // Foto 3D de l'escena amb els mobles de debò (feta fora de pantalla, desada entre sessions); mentrestant, el requadre buit.
  const { settings } = useSettings()
  const [thumb, setThumb] = useState(() => catalogThumb(t, settings.materials))
  useEffect(() => (thumb ? undefined : requestCatalogThumb(t, settings.materials, setThumb)), [t, thumb, settings.materials])
  return (
    <GalleryCard
      thumb={<SnapshotThumb src={thumb} />}
      title={t.name}
      description={t.description}
      tags={<ElementsTag n={t.items.length} />}
      onClick={onPick}
      disabled={busy}
    />
  )
}

/** Quants elements (mobles i objectes) té un ambient: la mateixa etiqueta a l'historial i al catàleg. */
function ElementsTag({ n }: { n: number }) {
  return (
    <Badge size="xs" variant="subtle" colorPalette="wood">
      {n} {n === 1 ? "element" : "elements"}
    </Badge>
  )
}

/** Miniatura d'un ambient de l'usuari: la foto 3D (es fa sola i es refà si canvia) o, mentrestant, el requadre buit. */
function RowThumb({ row }: { row: AmbientRow }) {
  const { settings } = useSettings()
  useEffect(() => (needsAmbientThumb(row) ? requestAmbientThumb(row, settings.materials) : undefined), [row, settings.materials])
  return <SnapshotThumb src={row.thumb} />
}
