import { Tabs } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuLayoutGrid, LuListTree } from "react-icons/lu"
import type { Composition } from "../../core/model"
import { pickInto, useMobleHistory } from "../composition/ModulePicker"
import type { Selection } from "../composition/StructureTree"
import { GalleryColsContext } from "../projects/galleryGrid"
import { NewMobleGallery } from "../projects/NewMobleGallery"

const ONE_COL = { base: 1 }

/**
 * Panell esquerre de l'editor (cel, 2026-11-07, com el Taulell): «Arbre» (l'estructura del moble) i «Catàleg» (la mateixa
 * galeria que «Afegir mòdul»: els teus mobles i models i tot el catàleg). Tocar una targeta del Catàleg en porta els mòduls
 * i les peces a aquest moble, igual que la finestra.
 */
export function EditorLeftPanel({ tree, comp, onChange, onSelect }: { tree: ReactNode; comp: Composition; onChange: (c: Composition) => void; onSelect: (s: Selection) => void }) {
  const [tab, setTab] = useState("tree")
  const pick = (c: Composition, n: string) => {
    pickInto(comp, c, n, onChange, onSelect)
    setTab("tree")
  }
  const history = useMobleHistory(pick, "mobles:side-catalog-folders")
  return (
    <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} variant="line" size="sm" colorPalette="wood" lazyMount unmountOnExit>
      <Tabs.List mb={2}>
        <Tabs.Trigger value="tree">
          <LuListTree /> Arbre
        </Tabs.Trigger>
        <Tabs.Trigger value="catalog">
          <LuLayoutGrid /> Catàleg
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="tree" pt={0}>
        {tree}
      </Tabs.Content>
      <Tabs.Content value="catalog" pt={0}>
        <GalleryColsContext.Provider value={ONE_COL}>
          <NewMobleGallery storageKey="mobles:side-catalog" onCreate={pick} history={history} />
        </GalleryColsContext.Provider>
      </Tabs.Content>
    </Tabs.Root>
  )
}
