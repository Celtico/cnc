import { Accordion, Badge, CloseButton, Input, InputGroup, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { LuFolders, LuHistory, LuSearch } from "react-icons/lu"
import { SnapshotThumb } from "../../components/SnapshotThumb"
import { useSettings } from "../settings/SettingsContext"
import { requestTemplateThumb, templateThumb } from "./projectThumbs"
import { FURNITURE_COLLECTIONS, STORE_CATALOG, type Composition, type CompositionKind, type Template } from "../../core/model"
import { KINDS } from "../composition/kinds"
import { FoldTitle } from "./FoldTitle"
import { GalleryCard } from "./GalleryCard"
import { GALLERY_COLS, fold, useSessionList } from "./galleryGrid"
import { CatalogSection } from "./CatalogSection"
import { CollectionsSection } from "./CollectionsSection"

const kindLabel = (k: CompositionKind) => KINDS.find((x) => x.value === k)!.label
const euros = (n: number) => `${n.toLocaleString("ca-ES")} €`

/** Targeta d'una plantilla de l'app: la miniatura es calcula en muntar-la (les de botiga, en obrir la categoria). */
export function TemplateCard({ t, title, kicker, onPick }: { t: Template; title?: string; kicker?: string; onPick: (t: Template) => void }) {
  const comp = useMemo(() => t.make(), [t])
  // Foto 3D feta fora de pantalla (en memòria mentre l'app és oberta); mentrestant, el dibuix.
  const { settings } = useSettings()
  const [thumb, setThumb] = useState(() => templateThumb(t.id))
  useEffect(() => {
    if (!thumb) requestTemplateThumb(t.id, () => comp, settings.materials, setThumb)
  }, [t.id, comp, settings.materials, thumb])
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

/** Títol d'un acordió de la galeria: icona, nom i quantitat. */
export { FoldTitle } from "./FoldTitle"

const COLS = GALLERY_COLS


/**
 * Pàgina de Mobles, com l'inici de Figma o Google Docs: cercador i acordions (tots tancats en
 * obrir l'app): Historial (el que és de pas), Projectes (els grups), el catàleg de botigues i les col·leccions de mobles.
 */
export function NewMobleGallery({
  onCreate,
  history,
  storageKey = "mobles:gallery",
}: {
  onCreate: (composition: Composition, name: string) => void
  /** Historial: els mobles que ja tens (del tipus triat), al primer acordió. */
  history: (kind: CompositionKind | "all", query: (text: string) => boolean, searching: boolean) => { count: number; node: ReactNode; projects?: { count: number; node: ReactNode } }
  /** Clau de sessió dels acordions oberts (la pàgina Mobles i la finestra dels ambients, per separat). */
  storageKey?: string
}) {
  // Filtre per tipus de moble (Tot, Moble, Cuina, Armari, Taula, Flat-pack).
  // Sense filtre de tipus: el cercador també troba pel tipus («cuina», «armari», «taula»…).
  const kind = "all" as CompositionKind | "all"
  const fits = (t: Template) => kind === "all" || t.kind === kind
  // Ordenades pel tipus, i dins de cada tipus com a la llista.
  // Cercador de tota la pàgina: historial, les teves, les de l'app i les de botiga (sense accents).
  const [query, setQuery] = useState("")
  const q = fold(query.trim())
  const matches = (text: string) => !q || fold(text).includes(q)
  const store = STORE_CATALOG.map((c) => ({
    ...c,
    types: c.types
      .map((ty) => ({ ...ty, items: ty.items.filter((t) => fits(t) && (!q || fold(`${c.name} ${t.name} ${t.description} ${kindLabel(t.kind)}`).includes(q))) }))
      .filter((ty) => ty.items.length > 0),
  })).filter((c) => c.types.length > 0)
  const storeCount = store.reduce((n, c) => n + c.types.reduce((m, ty) => m + ty.items.length, 0), 0)
  // Col·leccions de mobles: la cerca també mira la fitxa d'estudi (referència, materials, llenguatge…).
  const collections = FURNITURE_COLLECTIONS.map((c) => ({
    ...c,
    pieces: c.pieces.filter((t) => fits(t) && (!q || fold(`${c.name} ${t.name} ${t.description} ${kindLabel(t.kind)} ${Object.values(t.study).join(" ")}`).includes(q))),
  }))
  const collectionsCount = collections.reduce((n, c) => n + c.pieces.length, 0)
  const [openSections, setOpenSections] = useSessionList(storageKey)
  const [openCats, setOpenCats] = useSessionList(`${storageKey}-store`)
  const [openCols, setOpenCols] = useSessionList(`${storageKey}-collections`)
  const hist = history(kind, matches, !!q)
  // Amb cerca, s'obren les seccions que tenen resultats.
  const found = [...(hist.projects?.count ? ["projects"] : []), ...(hist.count ? ["history"] : []), ...(storeCount ? ["store"] : []), ...(collectionsCount ? ["collections"] : [])]
  const pick = (t: Template) => onCreate({ ...t.make(), kind: t.kind }, t.name)


  return (
    <Stack gap={4}>

      <InputGroup maxW={{ base: "full", md: "420px" }} startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => setQuery("")} /> : undefined}>
        <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cercar: nom, tipus, estil, material, color…" aria-label="Cercar mobles i plantilles" />
      </InputGroup>
      {q && !found.length && (
        <Text fontSize="sm" color="fg.muted">
          Cap moble ni plantilla no coincideix amb «{query.trim()}».
        </Text>
      )}


      <Accordion.Root className="gallery-accordion" multiple collapsible lazyMount variant="enclosed" value={q ? found : openSections} onValueChange={(e) => !q && setOpenSections(e.value)}>
        <Accordion.Item value="history">
          <Accordion.ItemTrigger cursor="pointer">
            <FoldTitle icon={<LuHistory />} title="Historial" count={hist.count} />
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>{hist.node}</Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>
        {hist.projects && (
          <Accordion.Item value="projects">
            <Accordion.ItemTrigger cursor="pointer">
              <FoldTitle icon={<LuFolders />} title="Projectes" count={hist.projects.count} />
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>{hist.projects.node}</Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
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
      </Accordion.Root>

    </Stack>
  )
}
