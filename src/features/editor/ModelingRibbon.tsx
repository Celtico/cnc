import { Box, Button, HStack, SegmentGroup, Separator, Text } from "@chakra-ui/react"
import { useState } from "react"
import { TopBarSlot } from "../../components/TopBar"
import { Tooltip } from "../../components/ui/tooltip"
import { insertModuleCopy, insertPartCopy, newId, removeModule, type Composition, type Module, type PartOrient, type Settings } from "../../core/model"
import { freePartFor } from "../composition/addElements"
import type { Selection } from "../composition/StructureTree"
import type { EditorCamera } from "./useEditorCamera"
import type { ViewerOptions } from "./useViewerOptions"
import { TaulellIcon, type TaulellIconName } from "../modeling/TaulellIcon"

/** Una eina de la barra (la icona i el nom del Taulell): `run` si ja la fem; sense, surt apagada amb «Aviat». */
type Tool = { icon: TaulellIconName; label: string; hint?: string; run?: () => void; on?: boolean }
type Group = [label: string, tools: Tool[]]

/**
 * Barra d'eines de Modelatge (cel, 2026-11-07: «Nou model s'ha d'obrir amb el nostre ull, amb les eines que té el meu
 * germà»): les mateixes pestanyes, apartats, eines i icones que el Taulell, amb els nostres components. Les pestanyes van al
 * mig de la barra de dalt (`TopBarTabs`) i les eines de la triada, en una filera a sota. No hi ha les de fabricar ni
 * d'exportar (Peces, Nesting, .mpr...): es fan a Mobles, quan el model ja és un mòdul. Tampoc «Document» (desfer, refer i
 * tornar als projectes ja són a la barra de dalt). Les eines que encara no tenim surten apagades.
 */
export function ModelingRibbon({
  comp,
  setComp,
  selection,
  select,
  settings,
  center,
  newModule,
  opts,
  camera,
}: {
  comp: Composition
  setComp: (c: Composition) => void
  selection: Selection
  select: (s: Selection) => void
  settings: Settings
  center: { x: number; y: number; z: number }
  newModule: (id: string, name: string) => Module
  opts: ViewerOptions
  camera: Pick<EditorCamera, "frameFrom">
}) {
  const [tab, setTab] = useState("Inici")
  const addPart = (orient: PartOrient, name: string) => {
    const n = (comp.parts ?? []).filter((p) => p.name.startsWith(name)).length
    const p = freePartFor(comp, settings, orient, center, n ? `${name} ${n + 1}` : name)
    setComp({ ...comp, parts: [...(comp.parts ?? []), p] })
    select({ kind: "part", id: p.id })
  }
  const addModule = () => {
    const m = newModule(newId("m"), `Moble ${comp.modules.length + 1}`)
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
  const pickOne = "Selecciona un moble o una peça."
  const settingsPage = () => window.dispatchEvent(new Event("mobles:open-settings"))

  const nouMoble: Tool = { icon: "cabinet", label: "Nou moble", hint: "Un moble nou dins del model, amb totes les opcions del mòdul.", run: addModule }
  const plantilles: Tool = { icon: "tpl", label: "Plantilles" }
  const TABS: [string, Group[]][] = [
    [
      "Inici",
      [
        ["Moble", [nouMoble, plantilles]],
        ["Taulers", [{ icon: "dynpanel", label: "Tauler dinàmic" }]],
        ["Mesura", [{ icon: "laser", label: "Làser" }]],
        [
          "Vista",
          [
            { icon: "fit", label: "Encaixa", hint: "Encaixa el model a la vista.", run: () => camera.frameFrom(null) },
            { icon: "viso", label: "Isomètrica", hint: "Vista de 3/4.", run: () => camera.frameFrom(null) },
            { icon: "vfront", label: "Frontal", hint: "Vista de davant.", run: () => camera.frameFrom("front") },
            { icon: "vtop", label: "Superior", hint: "Vista de dalt.", run: () => camera.frameFrom("top") },
            { icon: "vright", label: "Dreta", hint: "Vista de la dreta.", run: () => camera.frameFrom("right") },
          ],
        ],
        [
          "Visualització",
          [
            { icon: "dsh", label: "Ombrejat", hint: "Les peces opaques, amb el seu material.", on: opts.viewer.opacity === 1 && !opts.roleColors, run: () => (opts.setRoleColors(false), opts.setViewer({ opacity: 1 })) },
            { icon: "dwire", label: "Filferro" },
            { icon: "dxray", label: "Transparent", hint: "Les peces translúcides, per veure'n l'interior.", on: opts.viewer.opacity < 1, run: () => opts.setViewer({ opacity: opts.viewer.opacity < 1 ? 1 : 0.35 }) },
            { icon: "flat", label: "Plana", hint: "Cada tipus de peça d'un color.", on: opts.roleColors, run: () => opts.setRoleColors(!opts.roleColors) },
            { icon: "interior", label: "Interior" },
            { icon: "section", label: "Secció" },
          ],
        ],
      ],
    ],
    [
      "Espai",
      [
        ["Habitació", [{ icon: "room", label: "Habitació" }]],
        ["Col·locar", [{ icon: "wallplace", label: "A la paret" }, { icon: "rotcab", label: "Gira 90°" }, { icon: "move", label: "Desplaçar" }]],
        ["Mobles", [nouMoble, plantilles]],
      ],
    ],
    [
      "Esbós",
      [
        ["Croquis", [{ icon: "rect", label: "Rectangle" }, { icon: "poly", label: "Polilínia" }, { icon: "circle", label: "Cercle" }]],
        ["Volum", [{ icon: "extrude", label: "Extrusió" }, { icon: "panel", label: "Tauler" }]],
      ],
    ],
    [
      "Forma",
      [
        [
          "Transformar",
          [
            { icon: "face", label: "Cara dinàmica" },
            { icon: "move", label: "Desplaçar" },
            { icon: "rotate", label: "Girar" },
            { icon: "copy", label: "Copiar", hint: copy ? "Copia el moble o la peça seleccionada." : pickOne, run: copy },
            { icon: "array", label: "Matriu" },
          ],
        ],
        ["Edició", [{ icon: "del", label: "Esborrar", hint: remove ? "Esborra el moble o la peça seleccionada." : pickOne, run: remove }]],
      ],
    ],
    [
      "Fusta",
      [
        [
          "Taulers",
          [
            nouMoble,
            plantilles,
            { icon: "dynpanel", label: "Tauler dinàmic", hint: "Clica les cares que el limiten: el tauler les omple i les segueix." },
            { icon: "fitblock", label: "Bloc condicionat", hint: "Clica una cara de dins d'un buit: la peça l'omple i el segueix." },
            { icon: "panel", label: "Tauler", hint: "Un tauler solt.", run: () => addPart("front", "Tauler") },
            { icon: "shelf", label: "Prestatge", hint: "Un prestatge solt.", run: () => addPart("flat", "Prestatge") },
          ],
        ],
        ["Acabat", [{ icon: "band", label: "Cantell" }]],
      ],
    ],
    [
      "Mecanitzat",
      [
        ["Perforacions", [{ icon: "hole", label: "Perforació" }, { icon: "cup", label: "Cassoleta" }, { icon: "line32", label: "Línia 32" }]],
        ["Fresats", [{ icon: "groove", label: "Ranura" }, { icon: "rebate", label: "Galze" }, { icon: "cut", label: "Retall" }]],
        ["Ferratges", [{ icon: "cabineo", label: "Cabineo" }, { icon: "screw", label: "Cargols" }, { icon: "dowel", label: "Clavilles" }]],
      ],
    ],
    [
      "Eines",
      [
        ["Anàlisi", [{ icon: "laser", label: "Làser" }, { icon: "measure", label: "Mesurar" }, { icon: "dimclr", label: "Esborra cotes" }, { icon: "flat", label: "Plana" }, { icon: "interior", label: "Interior" }, { icon: "section", label: "Secció" }]],
        [
          "Taller",
          [
            { icon: "cnc", label: "Màquines CNC", hint: "Les màquines i les eines (Preferències).", run: settingsPage },
            { icon: "dtccfg", label: "Calaixos DTC", hint: "Els calaixos (Preferències).", run: settingsPage },
            { icon: "hngcfg", label: "Frontisses", hint: "Les frontisses (Preferències).", run: settingsPage },
          ],
        ],
      ],
    ],
  ]

  const groups = (TABS.find(([t]) => t === tab) ?? TABS[0]!)[1]
  return (
    <>
      {/* Les pestanyes, al mig de la barra de dalt i amb el mateix botó que Editor · Peces · Nesting · Exportar dels mobles
          (cel, 2026-11-07: «que sembli el mateix programa»). */}
      <TopBarSlot slot="tabs">
        <SegmentGroup.Root size="sm" value={tab} onValueChange={(e) => e.value && setTab(e.value)}>
          <SegmentGroup.Indicator />
          {TABS.map(([t]) => (
            <SegmentGroup.Item key={t} value={t} justifyContent="center">
              <SegmentGroup.ItemText>{t}</SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>
      </TopBarSlot>
      {/* Les eines de la pestanya, a la franja de sota la barra (el mateix gris i la mateixa vora). */}
      <TopBarSlot slot="tools">
      <HStack gap={2} align="stretch" overflowX="auto" css={{ scrollbarWidth: "thin" }} role="toolbar" aria-label={`Eines · ${tab}`}>
        {groups.map(([label, tools], i) => (
          <HStack key={label} gap={2} align="stretch">
            {i > 0 && <Separator orientation="vertical" />}
            <Box>
              <HStack gap={0.5}>
                {tools.map((tool) => (
                  <Tooltip key={tool.label} content={tool.run ? (tool.hint ?? tool.label) : `${tool.hint ?? tool.label} Aviat.`}>
                    <Button variant={tool.on ? "subtle" : "ghost"} aria-pressed={tool.on} size="sm" h="auto" py={1.5} px={1.5} flexDirection="column" gap={1} minW="64px" disabled={!tool.run} onClick={tool.run} aria-label={tool.label}>
                      <TaulellIcon name={tool.icon} size="22px" />
                      <Text fontSize="xs" fontWeight="normal" lineHeight="1.1" whiteSpace="nowrap">
                        {tool.label}
                      </Text>
                    </Button>
                  </Tooltip>
                ))}
              </HStack>
              <Text fontSize="2xs" color="fg.muted" textAlign="center" mt={0.5}>
                {label}
              </Text>
            </Box>
          </HStack>
        ))}
      </HStack>
      </TopBarSlot>
    </>
  )
}
