import { Accordion, CloseButton, Input, InputGroup, SimpleGrid, Stack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { useState } from "react"
import { LuHistory, LuLayoutTemplate, LuSearch } from "react-icons/lu"
import { OBJECT_TEMPLATES, type Composition, type Template } from "../../core/model"
import { FoldTitle, TemplateCard } from "../projects/NewMobleGallery"
import { GALLERY_COLS, fold, useSessionList } from "../projects/galleryGrid"


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
  history: (query: (text: string) => boolean, searching: boolean) => { count: number; node: ReactNode }
  storageKey?: string
}) {
  const [query, setQuery] = useState("")
  const q = fold(query.trim())
  const matches = (text: string) => !q || fold(text).includes(q)
  const templates = OBJECT_TEMPLATES.filter((t) => matches(`${t.name} ${t.description}`))
  const hist = history(matches, !!q)
  const [open, setOpen] = useSessionList(storageKey)
  const found = [...(hist.count ? ["mine"] : []), ...(templates.length ? ["templates"] : [])]
  const pick = (t: Template) => onCreate({ ...t.make(), kind: "objecte" }, t.name)
  return (
    <Stack gap={4}>
      <InputGroup maxW={{ base: "full", md: "420px" }} startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => setQuery("")} /> : undefined}>
        <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cercar objectes: nom, material…" aria-label="Cercar objectes" />
      </InputGroup>
      <Accordion.Root multiple collapsible lazyMount variant="enclosed" value={q ? found : open} onValueChange={(e) => !q && setOpen(e.value)}>
        <Accordion.Item value="mine">
          <Accordion.ItemTrigger cursor="pointer">
            <FoldTitle icon={<LuHistory />} title="Historial" count={hist.count} />
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>{hist.node}</Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>
        <Accordion.Item value="templates">
          <Accordion.ItemTrigger cursor="pointer">
            <FoldTitle icon={<LuLayoutTemplate />} title="Plantilles d'objectes" count={templates.length} />
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>
              <SimpleGrid columns={GALLERY_COLS} gap={3}>
                {templates.map((t) => (
                  <TemplateCard key={t.id} t={t} onPick={pick} />
                ))}
              </SimpleGrid>
            </Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>
    </Stack>
  )
}
