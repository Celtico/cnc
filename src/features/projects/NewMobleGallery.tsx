import { Badge, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { LuFolders, LuHistory } from "react-icons/lu"
import { SearchBar } from "../../components/SearchBar"
import { SnapshotThumb } from "../../components/SnapshotThumb"
import { useSettings } from "../settings/SettingsContext"
import { requestTemplateThumb, templateThumb } from "./projectThumbs"
import { FURNITURE_COLLECTIONS, STORE_CATALOG, type Composition, type CompositionKind, type Template } from "../../core/model"
import { KINDS } from "../composition/kinds"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { GalleryCard } from "./GalleryCard"
import { GALLERY_COLS, fold, useSessionList } from "./galleryGrid"
import { CatalogSection } from "./CatalogSection"
import { CollectionsSection } from "./CollectionsSection"

const kindLabel = (k: CompositionKind) => KINDS.find((x) => x.value === k)!.label
const euros = (n: number) => `${n.toLocaleString("ca-ES")} €`

/** Targeta d'una plantilla (catàleg, col·leccions, objectes): la miniatura es calcula en muntar-la (al catàleg, en obrir la categoria). */
export function TemplateCard({ t, title, kicker, onPick }: { t: Template; title?: string; kicker?: string; onPick: (t: Template) => void }) {
  const comp = useMemo(() => t.make(), [t])
  // Foto 3D feta fora de pantalla (desada entre sessions); mentrestant, el dibuix.
  const { settings } = useSettings()
  const [thumb, setThumb] = useState(() => templateThumb(t.id, comp, settings.materials))
  useEffect(() => (thumb ? undefined : requestTemplateThumb(t.id, () => comp, settings.materials, setThumb)), [t.id, comp, settings.materials, thumb])
  return (
    <GalleryCard
      thumb={<SnapshotThumb src={thumb} />}
      title={title ?? t.name}
      kicker={kicker}
      description={t.description}
      tags={
        <Badge size="xs" variant="subtle" colorPalette="wood">
          {kindLabel(t.kind)}
        </Badge>
      }
      aside={
        t.price !== undefined && (
          <Text fontSize="xs" fontWeight="semibold" color="wood.fg" truncate>
            {euros(t.price)}
          </Text>
        )
      }
      onClick={() => onPick(t)}
    />
  )
}


const COLS = GALLERY_COLS

/**
 * Pàgina de Mobles, com l'inici de Figma o Google Docs: cercador i acordions (tots tancats en
 * obrir l'app): Historial (el que és de pas), Projectes (els grups), el catàleg de botigues i les col·leccions de mobles.
 */
export function NewMobleGallery({
  onCreate,
  history,
  storageKey = "mobles:gallery",
  add,
  extra,
}: {
  onCreate: (composition: Composition, name: string) => void
  /** Botó principal al costat del cercador («Nou moble»); la finestra dels ambients no en porta. */
  add?: { label: string; onClick: () => void }
  /** Més accions a la fila del cercador («Obrir fitxer»). */
  extra?: ReactNode
  /** Historial: els mobles que ja tens (que coincideixen amb la cerca), al primer acordió; `projects`, els dels grups. */
  history: (query: (text: string) => boolean, searching: boolean) => { count: number; node: ReactNode; projects?: { count: number; node: ReactNode } }
  /** Clau de sessió dels acordions oberts (la pàgina Mobles i la finestra dels ambients, per separat). */
  storageKey?: string
}) {
  // Sense filtre de tipus: el cercador també troba pel tipus («cuina», «armari», «taula»…).
  // Cercador de tota la pàgina: historial, projectes, catàleg i col·leccions (sense accents).
  const [query, setQuery] = useState("")
  const q = fold(query.trim())
  const matches = (text: string) => !q || fold(text).includes(q)
  const store = STORE_CATALOG.map((c) => ({
    ...c,
    types: c.types
      .map((ty) => ({ ...ty, items: ty.items.filter((t) => !q || fold(`${c.name} ${t.name} ${t.description} ${kindLabel(t.kind)}`).includes(q)) }))
      .filter((ty) => ty.items.length > 0),
  })).filter((c) => c.types.length > 0)
  const storeCount = store.reduce((n, c) => n + c.types.reduce((m, ty) => m + ty.items.length, 0), 0)
  // Col·leccions de mobles: la cerca també mira la fitxa d'estudi (referència, materials, llenguatge…).
  const collections = FURNITURE_COLLECTIONS.map((c) => ({
    ...c,
    pieces: c.pieces.filter((t) => !q || fold(`${c.name} ${t.name} ${t.description} ${kindLabel(t.kind)} ${Object.values(t.study).join(" ")}`).includes(q)),
  }))
  const collectionsCount = collections.reduce((n, c) => n + c.pieces.length, 0)
  const [openCats, setOpenCats] = useSessionList(`${storageKey}-store`)
  const [openCols, setOpenCols] = useSessionList(`${storageKey}-collections`)
  const hist = history(matches, !!q)
  // Amb cerca, s'obren les seccions que tenen resultats.
  const found = [...(hist.projects?.count ? ["projects"] : []), ...(hist.count ? ["history"] : []), ...(storeCount ? ["store"] : []), ...(collectionsCount ? ["collections"] : [])]
  const pick = (t: Template) => onCreate({ ...t.make(), kind: t.kind }, t.name)


  return (
    <Stack gap={4}>

      <SearchBar value={query} onChange={setQuery} placeholder="Cercar: nom, tipus, estil, material, color…" ariaLabel="Cercar mobles i plantilles" add={add} extra={extra} />
      {q && !found.length && (
        <Text fontSize="sm" color="fg.muted">
          Cap moble ni plantilla no coincideix amb «{query.trim()}».
        </Text>
      )}


      <FoldGroup variant="gallery" storageKey={storageKey} forceOpen={q ? found : null}>
        <FoldItem id="history" icon={LuHistory} title="Historial" count={hist.count}>
          {hist.node}
        </FoldItem>
        {hist.projects && (
          <FoldItem id="projects" icon={LuFolders} title="Projectes" count={hist.projects.count}>
            {hist.projects.node}
          </FoldItem>
        )}

        <CatalogSection
          value="store"
          description="Plantilles per a botigues de mobles: tres dissenys per a cada tipus de moble, amb estil, materials, colors, públic i preu orientatiu."
          searching={!!q}
          open={openCats}
          onOpenChange={setOpenCats}
          categories={store.map((c) => ({
            id: c.id,
            label: c.name,
            count: c.types.reduce((m, ty) => m + ty.items.length, 0),
            // Una sola graella per categoria (com les altres); el tipus va a la targeta.
            content: (
              <SimpleGrid columns={COLS} gap={3}>
                {c.types.flatMap((ty) => ty.items.map((t) => <TemplateCard key={t.id} t={t} kicker={ty.name} title={t.name.replace(`${ty.name} `, "")} onPick={pick} />))}
              </SimpleGrid>
            ),
          }))}
        />
        <CollectionsSection value="collections" collections={collections} searching={!!q} open={openCols} onOpenChange={setOpenCols} onCreate={pick} />
      </FoldGroup>

    </Stack>
  )
}
