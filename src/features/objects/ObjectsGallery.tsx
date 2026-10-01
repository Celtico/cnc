import { Accordion, CloseButton, Input, InputGroup, SimpleGrid, Stack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { useState } from "react"
import { LuFolders, LuHistory, LuSearch } from "react-icons/lu"
import { OBJECT_CATEGORIES, OBJECT_TEMPLATES, objectCategory, type Composition, type Template } from "../../core/model"
import { FoldTitle, TemplateCard } from "../projects/NewMobleGallery"
import { GALLERY_COLS, fold, useSessionList } from "../projects/galleryGrid"
import { CatalogSection } from "../projects/CatalogSection"


/**
 * Galeria d'objectes (pàgina Objectes i finestra «Afegir un objecte» dels ambients), com la de
 * Mobles: cercador i acordions tancats: els teus objectes i les plantilles.
 */
export function ObjectsGallery({
  onCreate,
  history,
  storageKey = "mobles:objects",
}: {
  onCreate: (composition: Composition, name: string) => void
  history: (query: (text: string) => boolean, searching: boolean) => { count: number; node: ReactNode; projects?: { count: number; node: ReactNode } }
  storageKey?: string
}) {
  const [query, setQuery] = useState("")
  const q = fold(query.trim())
  const matches = (text: string) => !q || fold(text).includes(q)
  const templates = OBJECT_TEMPLATES.filter((t) => matches(`${t.name} ${t.description}`))
  const hist = history(matches, !!q)
  const [open, setOpen] = useSessionList(storageKey)
  const [openCats, setOpenCats] = useSessionList(`${storageKey}-categories`)
  const found = [...(hist.projects?.count ? ["projects"] : []), ...(hist.count ? ["mine"] : []), ...(templates.length ? ["templates"] : [])]
  const pick = (t: Template) => onCreate({ ...t.make(), kind: "objecte" }, t.name)
  return (
    <Stack gap={4}>
      <InputGroup maxW={{ base: "full", md: "420px" }} startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => setQuery("")} /> : undefined}>
        <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cercar objectes: nom, material…" aria-label="Cercar objectes" />
      </InputGroup>
      <Accordion.Root className="gallery-accordion" multiple collapsible lazyMount variant="enclosed" value={q ? found : open} onValueChange={(e) => !q && setOpen(e.value)}>
        <Accordion.Item value="mine">
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
      </Accordion.Root>
    </Stack>
  )
}
