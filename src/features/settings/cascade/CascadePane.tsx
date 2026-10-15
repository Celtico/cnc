import { Box, Button, Dialog, HStack, IconButton, Menu, Portal, Spinner, Splitter, Stack, Switch, Text } from "@chakra-ui/react"
import { ReactFlowProvider } from "@xyflow/react"
import { useContext, useRef, useState } from "react"
import { LuArrowDown, LuArrowRight, LuChevronsDownUp, LuChevronsUpDown, LuDownload, LuEllipsis, LuRefreshCw, LuTrash2, LuUpload } from "react-icons/lu"
import { PanelSplit, SplitHandle } from "../../../components/PanelSplit"
import { SearchBar } from "../../../components/SearchBar"
import { UndoRedo } from "../../../components/UndoRedo"
import { toaster } from "../../../components/ui/toaster"
import { Tooltip } from "../../../components/ui/tooltip"
import { draftToJson, parseDraftJson } from "../../../core/model"
import { downloadText } from "../../../lib/download"
import { usePersistentNumber } from "../../../lib/usePersistentNumber"
import { fileAccept } from "../../file/fileAccept"
import { PaneHeadContext } from "../paneHead"
import { CascadeCanvas } from "./CascadeCanvas"
import { CascadeDetail } from "./CascadeDetail"
import { useCascadeEditor } from "./useCascadeEditor"

/**
 * Preferències › **Opcions en cascada** (per decisió de l'usuari, 2026-10-15): un **esborrany** de la cascada d'opcions de
 * l'Editor dibuixat amb React Flow, per pensar-la abans de canviar-la. Surt del registre (`core/model/options`, al dia amb
 * el codi pel test `src/optionCascade.test.ts`); s'hi poden afegir, treure, unir i editar nodes, plegar i desplegar
 * branques, i es marquen les diferències amb l'app (Exportar JSON). Es desa sol a IndexedDB. **No s'aplica a l'Editor.**
 */
export function CascadePane() {
  return (
    <ReactFlowProvider>
      <CascadeEditor />
    </ReactFlowProvider>
  )
}

function CascadeEditor() {
  const head = useContext(PaneHeadContext)
  const ed = useCascadeEditor()
  const [panelWidth, setPanelWidth] = usePersistentNumber("mobles:cascade-panel", 340)
  const [asking, setAsking] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const { history, view, diff } = ed
  const doImport = async (file: File | undefined) => {
    if (!file) return
    try {
      ed.replace(parseDraftJson(await file.text()))
      toaster.create({ title: "Esborrany importat", description: "Es pot desfer.", type: "success" })
    } catch (e) {
      toaster.create({ title: "No s'ha pogut importar", description: (e as Error).message, type: "error" })
    }
    if (fileInput.current) fileInput.current.value = ""
  }
  return (
    <Stack gap={3} w="full">
      {head}
      <input ref={fileInput} type="file" accept={fileAccept("application/json,.json")} hidden onChange={(e) => void doImport(e.target.files?.[0])} />
      <HStack gap={2} wrap="wrap">
        <SearchBar
          value={ed.query}
          onChange={ed.setQuery}
          placeholder="Cercar al dibuix…"
          ariaLabel="Cercar al dibuix"
          add={{ label: ed.selected.node ? "Afegir a dins" : "Afegir", onClick: ed.addNode }}
          extra={
            <HStack gap={1}>
              <UndoRedo canUndo={history.canUndo} canRedo={history.canRedo} undo={history.undo} redo={history.redo} />
              <Tooltip content="Esborrar el triat (Supr)">
                <IconButton aria-label="Esborrar el triat" size="sm" variant="ghost" disabled={!ed.selected.count} onClick={ed.removeSelected}>
                  <LuTrash2 />
                </IconButton>
              </Tooltip>
            </HStack>
          }
        />
        <HStack gap={1}>
          <Button size="sm" variant="outline" onClick={ed.collapseAll}>
            <LuChevronsDownUp /> Plegar tot
          </Button>
          <Button size="sm" variant="outline" onClick={ed.expandAll}>
            <LuChevronsUpDown /> Desplegar tot
          </Button>
          <Tooltip content={view.tb ? "De dalt a baix (canviar a d'esquerra a dreta)" : "D'esquerra a dreta (canviar a de dalt a baix)"}>
            <IconButton aria-label="Direcció de l'arbre" size="sm" variant="ghost" onClick={() => view.setTb(!view.tb)}>
              {view.tb ? <LuArrowDown /> : <LuArrowRight />}
            </IconButton>
          </Tooltip>
          <Menu.Root positioning={{ placement: "bottom-end" }}>
            <Menu.Trigger asChild>
              <IconButton aria-label="Més accions" size="sm" variant="ghost">
                <LuEllipsis />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="export" onClick={() => downloadText(draftToJson(ed.draft), "opcions-en-cascada.json", "application/json")}>
                    <LuDownload /> Exportar JSON (amb les diferències)
                  </Menu.Item>
                  <Menu.Item value="import" onClick={() => fileInput.current?.click()}>
                    <LuUpload /> Importar JSON…
                  </Menu.Item>
                  <Menu.Separator />
                  <Menu.Item value="reload" onClick={() => setAsking(true)}>
                    <LuRefreshCw /> Tornar a carregar des de l'app…
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </HStack>
        <HStack gap={4} fontSize="sm">
          <ViewSwitch label="Fa aparèixer / desaparèixer" checked={view.showLinks} onChange={view.setShowLinks} />
          <ViewSwitch label={`Diferències (${diff.count})`} checked={view.showDiff} onChange={view.setShowDiff} />
        </HStack>
      </HStack>
      <PanelSplit panels={[{ id: "canvas", min: 320 }, { id: "detail", width: panelWidth, setWidth: setPanelWidth, min: 280, max: 560 }]}>
        <Splitter.Panel id="canvas">
          <Box h={{ base: "68dvh", md: "calc(100dvh - 250px)" }} minH="420px" borderWidth="1px" rounded="lg" overflow="hidden">
            {ed.loaded ? (
              <CascadeCanvas nodes={ed.flow.nodes} edges={ed.flow.edges} {...ed.canvas} />
            ) : (
              <HStack h="full" justify="center">
                <Spinner colorPalette="wood" />
              </HStack>
            )}
          </Box>
        </Splitter.Panel>
        <SplitHandle id="canvas:detail" label="Amplada del panell" onReset={() => setPanelWidth(340)} />
        <Splitter.Panel id="detail">
          <Box borderWidth="1px" rounded="lg" bg="bg.panel" maxH={{ md: "calc(100dvh - 250px)" }} overflowY="auto" ml={{ md: 3 }} mt={{ base: 3, md: 0 }}>
            <CascadeDetail draft={ed.draft} diff={diff} node={ed.selected.node} edge={ed.selected.edge} many={ed.selected.count} actions={ed.actions} />
          </Box>
        </Splitter.Panel>
      </PanelSplit>
      <Dialog.Root role="alertdialog" open={asking} onOpenChange={(e) => !e.open && setAsking(false)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Tornar a carregar des de l'app?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>L'esborrany torna a ser la cascada que fa l'app ara: es perden els nodes, les fletxes i les notes que hi has posat. Es pot desfer.</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setAsking(false)}>
                  Cancel·lar
                </Button>
                <Button
                  colorPalette="red"
                  onClick={() => {
                    ed.reloadFromApp()
                    setAsking(false)
                  }}
                >
                  <LuRefreshCw /> Tornar a carregar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  )
}

function ViewSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch.Root size="sm" colorPalette="wood" checked={checked} onCheckedChange={(e) => onChange(e.checked)}>
      <Switch.HiddenInput />
      <Switch.Control />
      <Switch.Label>{label}</Switch.Label>
    </Switch.Root>
  )
}
