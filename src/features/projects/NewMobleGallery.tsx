import { Accordion, Badge, Card, CloseButton, HStack, Input, InputGroup, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useMemo, useState, type ReactNode } from "react"
import { LuFolders, LuHistory, LuSearch } from "react-icons/lu"
import { CompositionThumb } from "../../components/CompositionThumb"
import { STORE_CATALOG, type Composition, type CompositionKind, type Template } from "../../core/model"
import { KINDS } from "../composition/kinds"
import { FoldTitle } from "./FoldTitle"
import { GALLERY_COLS, fold, useSessionList } from "./galleryGrid"
import { CatalogSection } from "./CatalogSection"

const kindLabel = (k: CompositionKind) => KINDS.find((x) => x.value === k)!.label
const euros = (n: number) => `${n.toLocaleString("ca-ES")} €`

/** Targeta d'una plantilla de l'app: la miniatura es calcula en muntar-la (les de botiga, en obrir la categoria). */
export function TemplateCard({ t, title, kicker, onPick }: { t: Template; title?: string; kicker?: string; onPick: (t: Template) => void }) {
  const comp = useMemo(() => t.make(), [t])
  return (
    <Card.Root asChild variant="outline" size="sm" cursor="pointer" _hover={{ borderColor: "wood.solid" }}>
      <button type="button" onClick={() => onPick(t)}>
        <Card.Body p={3} gap={2} alignItems="stretch" textAlign="left">
          <CompositionThumb composition={comp} />
          {kicker && (
            <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide" truncate mb={-1.5}>
              {kicker}
            </Text>
          )}
          <HStack justify="space-between" gap={1}>
            <Text className="card-title" fontWeight="semibold" fontSize="sm" lineClamp={2} title={t.name}>
              {title ?? t.name}
            </Text>
            <Badge size="xs" variant="subtle" flexShrink={0}>
              {kindLabel(t.kind)}
            </Badge>
          </HStack>
          <Text fontSize="xs" color="fg.muted" lineClamp={2} title={t.description}>
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
export { FoldTitle } from "./FoldTitle"

const COLS = GALLERY_COLS


/**
 * Pàgina de Mobles, com l'inici de Figma o Google Docs: cercador i acordions (tots tancats en
 * obrir l'app): Historial (el que és de pas), Projectes (els grups) i el catàleg de botigues.
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
  const [openSections, setOpenSections] = useSessionList(storageKey)
  const [openCats, setOpenCats] = useSessionList(`${storageKey}-store`)
  const hist = history(kind, matches, !!q)
  // Amb cerca, s'obren les seccions que tenen resultats.
  const found = [...(hist.projects?.count ? ["projects"] : []), ...(hist.count ? ["history"] : []), ...(storeCount ? ["store"] : [])]
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


      <Accordion.Root multiple collapsible lazyMount variant="enclosed" value={q ? found : openSections} onValueChange={(e) => !q && setOpenSections(e.value)}>
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
      </Accordion.Root>

    </Stack>
  )
}
