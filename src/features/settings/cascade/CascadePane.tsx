import { Box, Button, HStack, Splitter, Stack, Switch, Text } from "@chakra-ui/react"
import { ReactFlowProvider } from "@xyflow/react"
import { useContext, useEffect, useState } from "react"
import { LuBookOpen, LuChevronsDownUp, LuChevronsUpDown, LuEye, LuMousePointerClick } from "react-icons/lu"
import { FoldGroup, FoldItem } from "../../../components/Fold"
import { PanelSplit, SplitHandle } from "../../../components/PanelSplit"
import { SearchBar } from "../../../components/SearchBar"
import { usePersistentNumber } from "../../../lib/usePersistentNumber"
import { PaneHeadContext } from "../paneHead"
import { CascadeCanvas } from "./CascadeCanvas"
import { CascadeNodeInfo } from "./CascadeDetail"
import { useCascadeView } from "./useCascadeView"

/**
 * Preferències › **Opcions en cascada**: la cascada d'opcions de l'Editor dibuixada amb React Flow, **només per mirar**
 * (per decisió de l'usuari, 2026-10-21: «que l'esquema vingui donat per la realitat, que no es pugui editar»). Surt sempre
 * del registre (`core/model/options`, al dia amb el codi pel test `src/optionCascade.test.ts`); cada inspector és un arbre
 * i van un sota l'altre. Les eines (cercar, plegar, les fletxes) i el detall del node triat són al lateral, en acordió.
 */
export function CascadePane() {
  return (
    <ReactFlowProvider>
      <CascadeView />
    </ReactFlowProvider>
  )
}

function CascadeView() {
  const head = useContext(PaneHeadContext)
  const view = useCascadeView()
  const [panelWidth, setPanelWidth] = usePersistentNumber("mobles:cascade-panel", 340)
  const [open, setOpen] = useState<string[]>(["cascade-view"])
  // Triar un node obre el seu detall.
  const selectedId = view.selected?.id
  useEffect(() => {
    if (selectedId) setOpen(["cascade-node"])
  }, [selectedId])
  return (
    <Stack gap={3} w="full">
      {head}
      <PanelSplit panels={[{ id: "canvas", min: 320 }, { id: "detail", width: panelWidth, setWidth: setPanelWidth, min: 280, max: 560 }]}>
        <Splitter.Panel id="canvas">
          <Box h={{ base: "68dvh", md: "calc(100dvh - 250px)" }} minH="420px" borderWidth="1px" rounded="lg" overflow="hidden">
            <CascadeCanvas nodes={view.flow.nodes} edges={view.flow.edges} {...view.canvas} />
          </Box>
        </Splitter.Panel>
        <SplitHandle id="canvas:detail" label="Amplada del panell" onReset={() => setPanelWidth(340)} />
        <Splitter.Panel id="detail">
          <Box borderWidth="1px" rounded="lg" bg="bg.panel" px={3} maxH={{ md: "calc(100dvh - 250px)" }} overflowY="auto" ml={{ md: 3 }} mt={{ base: 3, md: 0 }}>
            <FoldGroup value={open} onValueChange={setOpen}>
              <FoldItem id="cascade-view" title="Veure" icon={LuEye}>
                <Stack gap={3}>
                  <SearchBar value={view.query} onChange={view.setQuery} placeholder="Cercar al dibuix…" ariaLabel="Cercar al dibuix" maxW="full" />
                  {view.query.trim() && (
                    <Text fontSize="xs" color="fg.muted">
                      {view.matchCount ? `${view.matchCount} ${view.matchCount === 1 ? "coincidència" : "coincidències"}` : "Cap coincidència"}
                    </Text>
                  )}
                  <HStack gap={1} wrap="wrap">
                    <Button size="sm" variant="outline" onClick={view.collapseAll}>
                      <LuChevronsDownUp /> Plegar tot
                    </Button>
                    <Button size="sm" variant="outline" onClick={view.expandAll}>
                      <LuChevronsUpDown /> Desplegar tot
                    </Button>
                  </HStack>
                  <Switch.Root size="sm" colorPalette="wood" checked={view.showLinks} onCheckedChange={(e) => view.setShowLinks(e.checked)}>
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label>Fa aparèixer / desaparèixer</Switch.Label>
                  </Switch.Root>
                </Stack>
              </FoldItem>
              <FoldItem id="cascade-node" title="Node triat" icon={LuMousePointerClick} badge={view.selected?.label}>
                <CascadeNodeInfo draft={view.draft} node={view.selected} focus={view.focus} />
              </FoldItem>
              <FoldItem id="cascade-legend" title="Com es llegeix" icon={LuBookOpen}>
                <Stack gap={1.5} fontSize="xs" color="fg.muted">
                  <Text>
                    És la cascada <b>tal com és ara a l'Editor</b>: es fa sola a partir del codi i no es pot editar. Cada inspector
                    (Estructura, Moble, Mòdul, Compartiment, Peça lliure, Objecte de referència, Selecció múltiple) és un arbre, un
                    sota l'altre.
                  </Text>
                  <Text>Vora gruixuda: secció. Vora fina: opció. Vora a ratlles: tria. Puntet taronja: possible incoherència.</Text>
                  <Text>
                    Amb «Fa aparèixer / desaparèixer», les fletxes a ratlles diuen quina tria fa sortir (color fusta) o amagar
                    (vermell) una opció.
                  </Text>
                  <Text>Clic a un node: el detall. Doble clic o la fletxeta de sota: plegar o desplegar.</Text>
                </Stack>
              </FoldItem>
            </FoldGroup>
          </Box>
        </Splitter.Panel>
      </PanelSplit>
    </Stack>
  )
}
