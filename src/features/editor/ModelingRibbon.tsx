import { Box, Button, HStack, Separator, Tabs, Text } from "@chakra-ui/react"
import type { IconType } from "react-icons"
import {
  LuCircle,
  LuSquareDashed,
  LuCircleDot,
  LuCopy,
  LuCpu,
  LuDrill,
  LuGrid3X3,
  LuHouse,
  LuMoveHorizontal,
  LuPanelLeft,
  LuPanelTop,
  LuPenLine,
  LuRectangleHorizontal,
  LuRotateCw,
  LuRows3,
  LuRuler,
  LuScan,
  LuScissors,
  LuSpline,
  LuSquarePlus,
  LuTrash2,
  LuArrowUpFromLine,
  LuGalleryVertical,
  LuMinus,
} from "react-icons/lu"
import { useState } from "react"
import { TopBarTabs } from "../../components/TopBar"
import { Tooltip } from "../../components/ui/tooltip"
import { insertModuleCopy, insertPartCopy, newId, removeModule, type Composition, type Module, type PartOrient, type Settings } from "../../core/model"
import { freePartFor } from "../composition/addElements"
import type { Selection } from "../composition/StructureTree"

/** Una eina de la barra: `run` si ja la fem; sense, surt apagada amb «Aviat» (és a la llista de Modelatge). */
type Tool = { label: string; icon: IconType; hint: string; run?: () => void }
type Group = { label: string; tools: Tool[] }

/**
 * Barra d'eines de Modelatge (cel, 2026-11-07: «Nou model s'ha d'obrir amb el nostre ull, amb les eines que té el meu
 * germà»): les pestanyes del Taulell (Inici, Espai, Esbós, Forma, Fusta, Mecanitzat, Eines) amb els nostres components.
 * Cada eina fa servir el que ja fa l'editor (mòduls, peces lliures, copiar, esborrar, les pàgines del moble); les que
 * encara no tenim surten apagades, en l'ordre en què es faran.
 */
export function ModelingRibbon({
  comp,
  setComp,
  selection,
  select,
  settings,
  center,
  newModule,
}: {
  comp: Composition
  setComp: (c: Composition) => void
  selection: Selection
  select: (s: Selection) => void
  settings: Settings
  center: { x: number; y: number; z: number }
  newModule: (id: string, name: string) => Module
}) {
  const [tab, setTab] = useState("inici")
  const addPart = (orient: PartOrient, name: string) => {
    const n = (comp.parts ?? []).filter((p) => p.name.startsWith(name)).length
    const p = freePartFor(comp, settings, orient, center, n ? `${name} ${n + 1}` : name)
    setComp({ ...comp, parts: [...(comp.parts ?? []), p] })
    select({ kind: "part", id: p.id })
  }
  const addModule = () => {
    const m = newModule(newId("m"), `Mòdul ${comp.modules.length + 1}`)
    setComp({ ...comp, modules: [...comp.modules, { ...m, gapBefore: 0 }] })
    select({ kind: "module", id: m.id })
  }
  const part = selection.kind === "part" ? comp.parts?.find((p) => p.id === selection.id) : undefined
  const module = selection.kind === "module" ? comp.modules.find((m) => m.id === selection.id) : undefined
  const copy = part
    ? () => {
        const r = insertPartCopy(comp, part)
        setComp(r.comp)
        select({ kind: "part", id: r.id })
      }
    : module
      ? () => {
          const r = insertModuleCopy(comp, module, module.id)
          setComp(r.comp)
          select({ kind: "module", id: r.id })
        }
      : undefined
  const remove = part
    ? () => {
        setComp({ ...comp, parts: (comp.parts ?? []).filter((p) => p.id !== part.id) })
        select({ kind: "moble" })
      }
    : module
      ? () => {
          setComp(removeModule(comp, module.id).comp)
          select({ kind: "moble" })
        }
      : undefined
  const soon = (label: string, icon: IconType, hint: string): Tool => ({ label, icon, hint })

  const TABS: { id: string; label: string; groups: Group[] }[] = [
    {
      id: "inici",
      label: "Inici",
      groups: [
        { label: "Moble", tools: [{ label: "Nou moble", icon: LuSquarePlus, hint: "Un mòdul nou (caixa amb totes les opcions del mòdul).", run: addModule }] },
        { label: "Mesura", tools: [soon("Làser", LuRuler, "Mesura des d'una cara fins a la peça del davant.")] },
      ],
    },
    { id: "espai", label: "Espai", groups: [{ label: "Habitació", tools: [soon("Habitació", LuHouse, "Terra i parets on va el moble (ara, a Ambients).")] }] },
    {
      id: "esbos",
      label: "Esbós",
      groups: [
        { label: "Croquis", tools: [soon("Rectangle", LuRectangleHorizontal, "Dibuixa un rectangle."), soon("Polilínia", LuSpline, "Dibuixa un contorn punt a punt."), soon("Cercle", LuCircle, "Dibuixa un cercle.")] },
        { label: "Volum", tools: [soon("Extrusió", LuArrowUpFromLine, "Fes volum d'un croquis."), soon("Tauler", LuPenLine, "Fes un tauler d'un croquis.")] },
      ],
    },
    {
      id: "forma",
      label: "Forma",
      groups: [
        { label: "Transformar", tools: [soon("Cara dinàmica", LuScan, "Estira una cara fins a una altra."), soon("Girar", LuRotateCw, "Gira la peça."), soon("Matriu", LuGrid3X3, "Repeteix la peça en línia.")] },
        {
          label: "Edició",
          tools: [
            { label: "Copiar", icon: LuCopy, hint: copy ? "Copia la peça o el mòdul seleccionat." : "Selecciona una peça o un mòdul.", run: copy },
            { label: "Esborrar", icon: LuTrash2, hint: remove ? "Esborra la peça o el mòdul seleccionat." : "Selecciona una peça o un mòdul.", run: remove },
          ],
        },
      ],
    },
    {
      id: "fusta",
      label: "Fusta",
      groups: [
        {
          label: "Taulers",
          tools: [
            soon("Tauler dinàmic", LuMoveHorizontal, "Clica les cares que el limiten: el tauler les omple i les segueix."),
            soon("Bloc condicionat", LuSquareDashed, "Clica una cara de dins d'un buit: la peça l'omple i el segueix."),
            { label: "Tauler", icon: LuPanelTop, hint: "Un tauler dret, de cara (peça lliure).", run: () => addPart("front", "Tauler") },
            { label: "Lateral", icon: LuPanelLeft, hint: "Un tauler dret, de costat (peça lliure).", run: () => addPart("side", "Lateral") },
            { label: "Prestatge", icon: LuRows3, hint: "Un tauler estirat (peça lliure).", run: () => addPart("flat", "Prestatge") },
          ],
        },
        { label: "Acabat", tools: [soon("Cantell", LuMinus, "Posa o treu cantell clicant el cantell de la peça.")] },
      ],
    },
    {
      id: "mecanitzat",
      label: "Mecanitzat",
      groups: [
        { label: "Perforacions", tools: [soon("Perforació", LuDrill, "Un forat clicant la cara."), soon("Cassoleta", LuCircleDot, "La cassoleta de frontissa."), soon("Línia 32", LuGalleryVertical, "Una filera de forats cada 32 mm.")] },
        { label: "Fresat", tools: [soon("Ranura", LuMinus, "Una ranura clicant la cara."), soon("Galze", LuPanelTop, "Un galze al cantell."), soon("Retall", LuScissors, "Un retall de la peça.")] },
        { label: "Ferratges", tools: [soon("Cabineo", LuCircleDot, "Unió Cabineo entre dues peces."), soon("Cargols", LuDrill, "Cargols entre dues peces."), soon("Clavilles", LuMinus, "Espigues entre dues peces.")] },
      ],
    },
    {
      id: "eines",
      label: "Eines",
      groups: [
        { label: "Màquines", tools: [{ label: "Màquines CNC", icon: LuCpu, hint: "Les màquines i les eines (Preferències).", run: () => window.dispatchEvent(new Event("mobles:open-settings")) }] },
      ],
    },
  ]

  return (
    <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} variant="line" size="sm" colorPalette="wood" mb={2} flexShrink={0}>
      {/* Les pestanyes, al mig de la barra de dalt (on els mobles hi tenen Editor · Peces · Nesting · Exportar). */}
      <TopBarTabs>
        <Tabs.List borderBottomWidth={0}>
          {TABS.map((t) => (
            <Tabs.Trigger key={t.id} value={t.id}>
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </TopBarTabs>
      {TABS.map((t) => (
        <Tabs.Content key={t.id} value={t.id} pt={0} pb={0}>
          <HStack gap={3} align="stretch" overflowX="auto" css={{ scrollbarWidth: "thin" }}>
            {t.groups.map((g, i) => (
              <HStack key={g.label} gap={3} align="stretch">
                {i > 0 && <Separator orientation="vertical" />}
                <Box>
                  <HStack gap={1}>
                    {g.tools.map((tool) => (
                      <Tooltip key={tool.label} content={tool.run ? tool.hint : `${tool.hint} Aviat.`}>
                        <Button variant="ghost" size="sm" h="auto" py={1.5} px={2} flexDirection="column" gap={1} minW="84px" disabled={!tool.run} onClick={tool.run} aria-label={tool.label}>
                          <tool.icon />
                          <Text fontSize="xs" fontWeight="normal" lineHeight="1.1">
                            {tool.label}
                          </Text>
                        </Button>
                      </Tooltip>
                    ))}
                  </HStack>
                  <Text fontSize="2xs" color="fg.muted" textAlign="center" mt={0.5}>
                    {g.label}
                  </Text>
                </Box>
              </HStack>
            ))}
          </HStack>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
