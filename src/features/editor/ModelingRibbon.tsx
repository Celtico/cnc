import { Box, Button, HStack, SegmentGroup, Separator, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { TopBarSlot } from "../../components/TopBar"
import { Tooltip } from "../../components/ui/tooltip"
import { insertModuleCopy, insertPartCopy, newId, removeModule, type Composition, type Module, type PartOrient, type Settings } from "../../core/model"
import { freePartFor } from "../composition/addElements"
import type { Selection } from "../composition/StructureTree"
import type { EditorCamera } from "./useEditorCamera"
import type { ViewerOptions } from "./useViewerOptions"
import { TaulellIcon, type TaulellIconName } from "../modeling/TaulellIcon"
import { FloatingWindow } from "../../components/FloatingWindow"
import { NumRow } from "../../components/NumRow"
import { FACE_TOOL_INFO, FACE_TOOL_LABEL, type FaceToolId, type FaceToolOpts } from "../modeling/faceTools"

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
  faceTool,
  setFaceTool,
  faceOpts,
  setFaceOpts,
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
  faceTool: FaceToolId | null
  setFaceTool: (t: FaceToolId | null) => void
  faceOpts: FaceToolOpts
  setFaceOpts: (o: FaceToolOpts) => void
}) {
  // Esc deixa l'eina (com al Taulell).
  useEffect(() => {
    if (!faceTool) return
    const on = (e: KeyboardEvent) => e.key === "Escape" && setFaceTool(null)
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [faceTool, setFaceTool])
  /** Una eina de clicar cares: la deixa activa (un altre clic la treu). */
  const faceToolBtn = (id: FaceToolId, icon: TaulellIconName, label: string): Tool => ({ icon, label, hint: FACE_TOOL_INFO[id], on: faceTool === id, run: () => setFaceTool(faceTool === id ? null : id) })
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
        ["Taulers", [faceToolBtn("dynpanel", "dynpanel", "Tauler dinàmic")]],
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
            faceToolBtn("dynpanel", "dynpanel", "Tauler dinàmic"),
            faceToolBtn("fitblock", "fitblock", "Bloc condicionat"),
            { icon: "panel", label: "Tauler", hint: "Un tauler solt.", run: () => addPart("front", "Tauler") },
            faceToolBtn("shelf", "shelf", "Prestatge"),
          ],
        ],
        ["Acabat", [faceToolBtn("band", "band", "Cantell")]],
      ],
    ],
    [
      "Mecanitzat",
      [
        ["Perforacions", [faceToolBtn("hole", "hole", "Perforació"), faceToolBtn("cup", "cup", "Cassoleta"), faceToolBtn("line32", "line32", "Línia 32")]],
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
      <FloatingWindow key={faceTool ?? ""} id={`modeling-tool-${faceTool ?? ""}`} kind="picker" width={240} height={faceTool === "line32" ? 400 : faceTool === "fitblock" || faceTool === "shelf" || faceTool === "hole" || faceTool === "cup" ? 300 : 240} minSize={{ width: 200, height: 120 }} bodyProps={{ p: 3 }} open={!!faceTool} onClose={() => setFaceTool(null)} title={faceTool ? FACE_TOOL_LABEL[faceTool] : ""} initialFocus={false} closeHint="Acabar (Esc)">
        {faceTool && (
          <Stack gap={2}>
            <ToolOptions tool={faceTool} o={faceOpts} set={setFaceOpts} />
            <Text fontSize="xs" color="fg.muted">
              {FACE_TOOL_INFO[faceTool]}
            </Text>
          </Stack>
        )}
      </FloatingWindow>
    </>
  )
}

/** Les opcions de l'eina activa, a la seva finestra flotant (com la finestreta d'opcions del Taulell). */
function ToolOptions({ tool, o, set }: { tool: FaceToolId; o: FaceToolOpts; set: (o: FaceToolOpts) => void }) {
  const num = (k: Exclude<keyof FaceToolOpts, "fitOrient">, label: string, min = 0) => <NumRow key={k} maxW="110px" label={label} value={o[k]} min={min} max={3000} step={0.5} onChange={(v) => set({ ...o, [k]: v })} />
  const rows =
    tool === "fitblock"
      ? [num("T", "Gruix"), num("fitGap", "Folgança")]
      : tool === "dynpanel"
        ? [num("dynOff", "Separació", -3000)]
        : tool === "shelf"
          ? [num("T", "Gruix"), num("setback", "Retirada")]
          : tool === "hole"
            ? [num("d", "Diàmetre"), num("depth", "Fondària")]
            : tool === "cup"
              ? [num("cd", "Diàmetre"), num("cdepth", "Fondària")]
              : tool === "line32"
                ? [num("ld", "Diàmetre"), num("ldepth", "Fondària"), num("pitch", "Pas"), num("margin", "Marge")]
                : []
  return (
    <Stack gap={2}>
      {tool === "fitblock" && (
        <SegmentGroup.Root size="xs" value={o.fitOrient} onValueChange={(e) => e.value && set({ ...o, fitOrient: e.value as FaceToolOpts["fitOrient"] })}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={[{ value: "flat", label: "Prestatge" }, { value: "side", label: "Divisió" }, { value: "front", label: "De cara" }]} />
        </SegmentGroup.Root>
      )}
      {rows}
      {tool === "band" && <Text fontSize="sm">Sense opcions: clica a prop del cantell.</Text>}
    </Stack>
  )
}
