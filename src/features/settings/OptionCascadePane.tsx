import { HStack, Stack, Text, TreeView } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuChevronRight } from "react-icons/lu"
import { SearchBar } from "../../components/SearchBar"
import { useSessionList } from "../../components/sessionState"
import { OPTION_CASCADE, type OptionNode, type OptionPrefs } from "../../core/model"
import { OptionNodeView } from "./OptionNodeView"
import { branchIds, filterOptions, optionCollection, prefCounts } from "./optionTree"

/**
 * Preferències › **Opcions en cascada** (per decisió de l'usuari, 2026-10-15): tota la cascada d'opcions de l'Editor com un
 * arbre (el `TreeView` de Chakra, amb les línies de cada branca), sempre al dia amb el codi (`core/model/options`, el
 * comprova `src/optionCascade.test.ts`). A cada opció: quan surt (no es pot canviar: també decideix la fabricació), les
 * tries i el que fan aparèixer o desaparèixer, «Amagar» (si es pot) i el valor per defecte dels elements nous (si es pot
 * triar). Les possibles incoherències de l'auditoria surten marcades. Una cerca filtra l'arbre.
 */
export function OptionCascadePane({ prefs, onChange }: { prefs: OptionPrefs; onChange: (prefs: OptionPrefs) => void }) {
  const [query, setQuery] = useState("")
  // Obertes: les del moble, el mòdul i el compartiment (es recorden durant la sessió).
  const [open, setOpen] = useSessionList("mobles:option-cascade-open", ["moble", "module", "zone"])
  const nodes = useMemo(() => filterOptions(OPTION_CASCADE, query), [query])
  const collection = useMemo(() => optionCollection(nodes), [nodes])
  // Durant la cerca, tot obert (el que coincideix és a la vista).
  const expanded = query.trim() ? branchIds(nodes) : open
  const counts = prefCounts(prefs)
  return (
    <Stack gap={4}>
      <Text fontSize="sm" color="fg.muted">
        Amaga les opcions que no fas servir (l'Editor queda més net i els mòduls nous fan servir el valor per defecte) i tria el
        valor per defecte dels mòduls, compartiments i peces nous. Els mobles fets no canvien. Quan surt cada opció no es pot
        canviar aquí: també decideix com es fabrica.
      </Text>
      <HStack gap={3} wrap="wrap">
        <SearchBar value={query} onChange={setQuery} placeholder="Cercar una opció…" ariaLabel="Cercar una opció" />
        <Text fontSize="xs" color="fg.muted">
          {counts.hidden === 1 ? "1 amagada" : `${counts.hidden} amagades`} · {counts.defaults === 1 ? "1 per defecte propi" : `${counts.defaults} per defecte propis`}
        </Text>
      </HStack>
      {nodes.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          Cap opció amb «{query}».
        </Text>
      ) : (
        <TreeView.Root
          collection={collection}
          colorPalette="wood"
          size="sm"
          expandedValue={expanded}
          onExpandedChange={(e) => !query.trim() && setOpen(e.expandedValue)}
          aria-label="Opcions en cascada"
        >
          <TreeView.Tree>
            <TreeView.Node<OptionNode>
              indentGuide={<TreeView.BranchIndentGuide />}
              render={({ node, nodeState }) =>
                nodeState.isBranch ? (
                  <TreeView.BranchControl alignItems="flex-start">
                    <TreeView.BranchIndicator mt="5px" transition="transform 0.2s" _open={{ transform: "rotate(90deg)" }}>
                      <LuChevronRight />
                    </TreeView.BranchIndicator>
                    <OptionNodeView node={node} prefs={prefs} onChange={onChange} />
                  </TreeView.BranchControl>
                ) : (
                  <TreeView.Item alignItems="flex-start">
                    <OptionNodeView node={node} prefs={prefs} onChange={onChange} />
                  </TreeView.Item>
                )
              }
            />
          </TreeView.Tree>
        </TreeView.Root>
      )}
    </Stack>
  )
}
