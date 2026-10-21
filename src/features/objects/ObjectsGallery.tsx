import { SimpleGrid, Stack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { useDeferredValue, useState } from "react"
import { LuFolders, LuHistory } from "react-icons/lu"
import { SearchBar } from "../../components/SearchBar"
import { OBJECT_CATEGORIES, OBJECT_TEMPLATES, objectCategory, type Composition, type Template } from "../../core/model"
import { TemplateCard } from "../projects/TemplateCard"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { GALLERY_COLS, fold, searchKey, useSessionList } from "../projects/galleryGrid"
import { CatalogSection } from "../projects/CatalogSection"


/**
 * Galeria d'objectes (pàgina Objectes i finestra «Afegir un objecte» dels ambients), com la de
 * Mobles: cercador i acordions tancats: els teus objectes i les plantilles.
 */
export function ObjectsGallery({
  onCreate,
  history,
  storageKey = "mobles:objects",
  add,
  extra,
}: {
  onCreate: (composition: Composition, name: string) => void
  /** Botó principal al costat del cercador («Nou objecte»); la finestra dels ambients no en porta. */
  add?: { label: string; onClick: () => void }
  /** Més accions a la fila del cercador (a la pàgina, «Obrir fitxer»). */
  extra?: ReactNode
  history: (query: (text: string) => boolean, searching: boolean) => { count: number; node: ReactNode; projects?: { count: number; node: ReactNode } }
  storageKey?: string
}) {
  const [query, setQuery] = useState("")
  // Comença a filtrar a les 3 lletres, i la llista es refà després d'escriure (la pàgina no es penja mentre s'escriu).
  const q = searchKey(useDeferredValue(query))
  const matches = (text: string) => !q || fold(text).includes(q)
  // Com al catàleg d'ambients: també per la categoria («Llums», «Plantes»…).
  const templates = OBJECT_TEMPLATES.filter((t) => matches(`${t.name} ${t.description} ${OBJECT_CATEGORIES.find((c) => c.id === objectCategory(t))?.label ?? ""}`))
  const hist = history(matches, !!q)
  const [openCats, setOpenCats] = useSessionList(`${storageKey}-categories`)
  const found = [...(hist.projects?.count ? ["projects"] : []), ...(hist.count ? ["mine"] : []), ...(templates.length ? ["templates"] : [])]
  const pick = (t: Template) => onCreate({ ...t.make(), kind: "objecte" }, t.name)
  return (
    <Stack gap={4}>
      <SearchBar value={query} onChange={setQuery} placeholder="Cercar objectes: nom, material…" ariaLabel="Cercar objectes" add={add} extra={extra} />
      <FoldGroup variant="gallery" storageKey={storageKey} forceOpen={q ? found : null}>
        <FoldItem id="mine" icon={LuHistory} title="Historial" count={hist.count}>
          {hist.node}
        </FoldItem>
        {hist.projects && (
          <FoldItem id="projects" icon={LuFolders} title="Projectes" count={hist.projects.count}>
            {hist.projects.node}
          </FoldItem>
        )}
        <CatalogSection
          value="templates"
          description="Sofàs, taules, llums, plantes, catifes… fets amb peces, per col·locar als ambients."
          searching={!!q}
          open={openCats}
          onOpenChange={setOpenCats}
          categories={OBJECT_CATEGORIES.map((c) => {
            const list = templates.filter((t) => objectCategory(t) === c.id)
            return {
              id: c.id,
              label: c.label,
              count: list.length,
              content: (
                <SimpleGrid columns={GALLERY_COLS} gap={3}>
                  {list.map((t) => (
                    <TemplateCard key={t.id} t={t} onPick={pick} />
                  ))}
                </SimpleGrid>
              ),
            }
          })}
        />
      </FoldGroup>
    </Stack>
  )
}
