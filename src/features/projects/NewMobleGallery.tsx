import { SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState, type ReactNode } from "react"
import { LuBlocks, LuFlaskConical, LuFolders, LuHistory, LuRows3, LuShapes } from "react-icons/lu"
import { SearchBar } from "../../components/SearchBar"
import { FURNITURE_COLLECTIONS, JOINED_COMBOS, SLICED_GALLERY, MODEL_COMBOS, SHAPE_COMBOS, STORE_CATALOG, type ComboCategory, withInnerClearance, withZonePlinths, type Composition, type Template } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"
import { kindLabel } from "./kindLabel"
import { TemplateCard } from "./TemplateCard"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { GALLERY_COLS, fold, useSessionList } from "./galleryGrid"
import { CatalogSection } from "./CatalogSection"
import { CollectionsSection } from "./CollectionsSection"
import { CombosSection } from "./CombosSection"

const COLS = GALLERY_COLS

/**
 * Pàgina de Mobles, com l'inici de Figma o Google Docs: cercador i acordions (tots tancats en
 * obrir l'app): Historial (el que és de pas), Projectes (els grups), el catàleg de botigues, les col·leccions de mobles i
 * els models constructius (les combinacions de les regles del model).
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
  add?: { label: string; onClick?: () => void; menu?: ReactNode }
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
  const sliced = SLICED_GALLERY.map((c) => ({ ...c, items: c.items.filter((t) => !q || fold(`Llistons ${c.name} ${t.name} ${t.description}`).includes(q)) }))
  const slicedCount = sliced.reduce((n, c) => n + c.items.length, 0)
  // Col·leccions de mobles: la cerca també mira la fitxa d'estudi (referència, materials, llenguatge…).
  const collections = FURNITURE_COLLECTIONS.map((c) => ({
    ...c,
    pieces: c.pieces.filter((t) => !q || fold(`${c.name} ${t.name} ${t.description} ${kindLabel(t.kind)} ${Object.values(t.study).join(" ")}`).includes(q)),
  }))
  const collectionsCount = collections.reduce((n, c) => n + c.pieces.length, 0)
  // Les mostres de proves (fitxers i aleatoris) es carreguen a part: són grans.
  const [samples, setSamples] = useState<ComboCategory[]>([])
  useEffect(() => {
    let live = true
    void import("./sampleMobles").then((m) => live && setSamples(m.sampleCategories()))
    return () => {
      live = false
    }
  }, [])
  const filterCats = (cs: ComboCategory[]) => cs.map((c) => ({ ...c, items: c.items.filter((t) => !q || fold(`${c.name} ${t.name} ${t.description}`).includes(q)) }))
  const combos = filterCats(MODEL_COMBOS)
  const combosCount = combos.reduce((n, c) => n + c.items.length, 0)
  const shapes = filterCats(SHAPE_COMBOS)
  const shapesCount = shapes.reduce((n, c) => n + c.items.length, 0)
  const joined = filterCats(JOINED_COMBOS)
  const joinedCount = joined.reduce((n, c) => n + c.items.length, 0)
  const tests = filterCats(samples)
  const testsCount = tests.reduce((n, c) => n + c.items.length, 0)
  const [openCats, setOpenCats] = useSessionList(`${storageKey}-store`)
  const [openCols, setOpenCols] = useSessionList(`${storageKey}-collections`)
  const [openSliced, setOpenSliced] = useSessionList(`${storageKey}-sliced`)
  const [openCombos, setOpenCombos] = useSessionList(`${storageKey}-combos`)
  const [openShapes, setOpenShapes] = useSessionList(`${storageKey}-shapes`)
  const [openJoined, setOpenJoined] = useSessionList(`${storageKey}-joined`)
  const [openTests, setOpenTests] = useSessionList(`${storageKey}-tests`)
  const hist = history(matches, !!q)
  // Amb cerca, s'obren les seccions que tenen resultats.
  const found = [...(hist.projects?.count ? ["projects"] : []), ...(hist.count ? ["history"] : []), ...(storeCount ? ["store"] : []), ...(slicedCount ? ["sliced"] : []), ...(collectionsCount ? ["collections"] : []), ...(combosCount ? ["combos"] : []), ...(shapesCount ? ["shapes"] : []), ...(joinedCount ? ["joined"] : []), ...(testsCount ? ["tests"] : [])]
  // Una plantilla instanciada a partir d'ara pren la folgança de les peces de dins de Preferències (com un mòdul nou).
  const { settings } = useSettings()
  const pick = (t: Template) => onCreate(withZonePlinths(withInnerClearance({ ...t.make(), kind: t.kind }, settings.gaps.innerClearance, settings.gaps.grooveClearance)), t.name)


  return (
    <Stack gap={4}>

      <SearchBar value={query} onChange={setQuery} placeholder="Cercar mobles: nom, tipus, estil, material, color…" ariaLabel="Cercar mobles" add={add} extra={extra} />
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
        <CatalogSection
          value="sliced"
          title="Llistons"
          icon={LuRows3}
          description="Sofàs, butaques, cadires, bancs, taules i murals de llistons de roure massís, tallats d'una forma lliure amb barres roscades que els uneixen. Mostra la forma per canviar-la i torna-la a tallar."
          searching={!!q}
          open={openSliced}
          onOpenChange={setOpenSliced}
          categories={sliced.map((c) => ({
            id: c.id,
            label: c.name,
            count: c.items.length,
            content: (
              <SimpleGrid columns={COLS} gap={3}>
                {c.items.map((t) => (
                  <TemplateCard key={t.id} t={t} onPick={pick} />
                ))}
              </SimpleGrid>
            ),
          }))}
        />
        <CollectionsSection value="collections" collections={collections} searching={!!q} open={openCols} onOpenChange={setOpenCols} onCreate={pick} />
        <CombosSection value="combos" categories={combos} searching={!!q} open={openCombos} onOpenChange={setOpenCombos} onCreate={pick} />
        <CombosSection
          value="shapes"
          title="Formes"
          icon={LuShapes}
          description="Mobles amb forma (L, U, T, escala, piràmide, pont, creu, Z, caixa penjada), fets amb zones que treuen les parets del mig. Cada forma, petita, mitjana, gran, penjada o sense fons, amb calaixos o portes. I l'abecedari: cada lletra, buida o plena."
          categories={shapes}
          searching={!!q}
          open={openShapes}
          onOpenChange={setOpenShapes}
          onCreate={pick}
        />
        <CombosSection
          value="joined"
          title="Mobles junts"
          icon={LuBlocks}
          description="Composicions de mòduls de mides diferents que es toquen (escala, piràmide, escacs, ciutat, torres, pont de TV, rebedor, penjats en cascada): el mòdul més baix no porta el lateral del costat del veí, que fa de lateral dels dos."
          categories={joined}
          searching={!!q}
          open={openJoined}
          onOpenChange={setOpenJoined}
          onCreate={pick}
        />
        <CombosSection
          value="tests"
          title="Proves"
          icon={LuFlaskConical}
          description="Els mòduls dels teus fitxers de proves (regles del model, caixa de la zona, divisions, estructura) i mobles i formes a l'atzar, amb els seus materials. Tria'n un per obrir-lo com a moble nou."
          categories={tests}
          searching={!!q}
          open={openTests}
          onOpenChange={setOpenTests}
          onCreate={pick}
        />
      </FoldGroup>

    </Stack>
  )
}
