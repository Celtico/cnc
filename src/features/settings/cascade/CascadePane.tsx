import { Box, Button, Dialog, HStack, IconButton, Menu, Portal, Spinner, Splitter, Stack, Switch, Text } from "@chakra-ui/react"
import { ReactFlowProvider } from "@xyflow/react"
import { useContext, useRef, useState } from "react"
import { LuCheck, LuChevronsDownUp, LuCircleAlert, LuChevronsUpDown, LuRefreshCw, LuSave, LuTrash2, LuUpload, LuWorkflow } from "react-icons/lu"
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
import type { DraftSaveState } from "./useCascadeDraft"
import { useCascadeEditor } from "./useCascadeEditor"
import { ActionsMenu } from "../../../components/ActionsMenu"

/**
 * Preferències › **Opcions en cascada** (per decisió de l'usuari, 2026-10-15): un **esborrany** de la cascada d'opcions de
 * l'Editor dibuixat amb React Flow, per pensar-la abans de canviar-la. Surt del registre (`core/model/options`, al dia amb
 * el codi pel test `src/optionCascade.test.ts`); s'organitza a mà (moure nodes, canviar-los de pare, afegir, treure i
 * editar), es pleguen branques, i es marquen les diferències amb l'app (Exportar JSON). Es desa sol a IndexedDB. **No s'aplica a l'Editor.**
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
  const exportDraft = () => downloadText(draftToJson(ed.draft), "opcions-en-cascada.json", "application/json")
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
              <Tooltip content="Eliminar el triat (Supr)">
                <IconButton aria-label="Eliminar el triat" size="sm" variant="ghost" disabled={!ed.selected.count} onClick={ed.removeSelected}>
                  <LuTrash2 />
                </IconButton>
              </Tooltip>
            </HStack>
          }
        />
        <HStack gap={1} wrap="wrap">
          <Button size="sm" variant="outline" onClick={ed.collapseAll}>
            <LuChevronsDownUp /> Plegar tot
          </Button>
          <Button size="sm" variant="outline" onClick={ed.expandAll}>
            <LuChevronsUpDown /> Desplegar tot
          </Button>
          <Tooltip content="Torna a posar tots els nodes en arbre, de dalt a baix (es pot desfer)">
            <Button size="sm" variant="outline" onClick={ed.relayout}>
              <LuWorkflow /> Reordenar automàticament
            </Button>
          </Tooltip>
          <SaveButton state={ed.save} />
          <Tooltip content="Un fitxer JSON amb el dibuix i les diferències amb l'app (es pot tornar a importar)">
            <Button size="sm" variant="outline" onClick={exportDraft}>
              <LuSave /> Desar com a fitxer…
            </Button>
          </Tooltip>
          <ActionsMenu label="Més accions" size="sm">
            <Menu.Item value="import" onClick={() => fileInput.current?.click()}>
              <LuUpload /> Importar JSON…
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item value="reload" onClick={() => setAsking(true)}>
              <LuRefreshCw /> Tornar a carregar des de l'app…
            </Menu.Item>
          </ActionsMenu>
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

/**
 * L'esborrany es desa sol (mig segon després de cada canvi, a aquest navegador). El botó ho diu i, si encara queda res per
 * desar, ho desa ara mateix.
 */
function SaveButton({ state }: { state: DraftSaveState }) {
  const tip = state === "failed" ? "No s'ha pogut desar en aquest navegador (navegació privada?): desa'l com a fitxer" : "Es desa sol a cada canvi, en aquest navegador"
  return (
    <Tooltip content={tip}>
      <Button
        size="sm"
        variant="ghost"
        colorPalette={state === "failed" ? "red" : "gray"}
        color={state === "saved" ? "fg.muted" : undefined}
        minW="104px"
        aria-live="polite"
        onClick={() => window.dispatchEvent(new Event("mobles:flush-save"))}
      >
        {state === "saving" ? <Spinner size="xs" /> : state === "failed" ? <LuCircleAlert /> : <LuCheck />}
        {state === "saving" ? "Desant…" : state === "failed" ? "No s'ha desat" : "Desat"}
      </Button>
    </Tooltip>
  )
}
