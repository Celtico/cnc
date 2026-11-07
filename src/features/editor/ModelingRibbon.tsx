import { Box, Button, Checkbox, Collapsible, HStack, SegmentGroup, Separator, Slider, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { TopBarSlot } from "../../components/TopBar"
import { toaster } from "../../components/ui/toaster"
import { Tooltip } from "../../components/ui/tooltip"
import { boardChoices, circlePts, extrudeSketch, insertModuleCopy, mountModule, insertPartCopy, moduleRot, partSize, SIDE_NAMES, mountOf, newId, partBox, removeModule, reorientPart, type Composition, type FreePart, type Module, type PartOrient, type Settings } from "../../core/model"
import { freePartFor } from "../composition/addElements"
import { ModulePicker, pickInto } from "../composition/ModulePicker"
import type { Selection } from "../composition/StructureTree"
import type { EditorCamera } from "./useEditorCamera"
import type { ViewerOptions } from "./useViewerOptions"
import { TaulellIcon, type TaulellIconName } from "../modeling/TaulellIcon"
import { FloatingWindow } from "../../components/FloatingWindow"
import { NumRow } from "../../components/NumRow"
import { DOWELS, FACE_TOOL_INFO, FACE_TOOL_LABEL, finishSketch, resizePartFace, type DowelSize, type FaceToolId, type FaceToolOpts } from "../modeling/faceTools"
import { MaterialSelect } from "../settings/MaterialSelect"
import { NouMobleDialog } from "../modeling/NouMobleDialog"

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
  const faceToolBtn = (id: FaceToolId, icon: TaulellIconName, label: string): Tool => ({ icon, label, hint: FACE_TOOL_INFO[id], on: faceTool === id, run: () => (setFaceOpts({ ...faceOpts, draft: undefined, cutTarget: undefined, measureFrom: undefined }), setFaceTool(faceTool === id ? null : id)) })
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
  // Nou moble: el formulari del Taulell (recorda les últimes opcions).
  const [wizard, setWizard] = useState(false)
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
  // Girar (el Taulell gira amb anells; aquí, de 90 en 90 al voltant del vertical: les peces i els mobles van a escaire).
  const rotate = part
    ? () => setComp({ ...comp, parts: (comp.parts ?? []).map((q) => (q.id === part.id ? turnPart(q) : q)) })
    : module
      ? () => {
          const order = mountOf(module) === "floor" ? [0, 90, 180, 270] : [0, 90, 270]
          const next = order[(order.indexOf(moduleRot(module) ?? 0) + 1) % order.length]!
          const { turned: _t, rot: _r, ...rest } = module
          setComp({ ...comp, modules: comp.modules.map((m) => (m.id === module.id ? (next ? { ...rest, rot: next as 90 | 180 | 270 } : rest) : m)) })
        }
      : undefined
  const [arrayOpen, setArrayOpen] = useState(false)
  const tauler: Tool = { icon: "panel", label: "Tauler", hint: "Un tauler solt.", run: () => addPart("front", "Tauler") }
  // Extrusió: el croquis triat (a l'arbre o just dibuixat) passa a ser una peça lliure amb el gruix de l'eina.
  const sketch = comp.sketches?.find((k) => k.id === faceOpts.selSketch)
  const extrude: Tool = {
    icon: "extrude",
    label: "Extrusió",
    hint: sketch ? `Fa una peça de ${faceOpts.T} mm amb «${sketch.name}».` : "Tria un croquis (a l'arbre) o dibuixa'n un.",
    run: sketch
      ? () => {
          const base = freePartFor(comp, settings, "flat", center, "Peça")
          const n = (comp.parts ?? []).filter((q) => q.name.startsWith("Peça")).length
          const p = extrudeSketch(sketch, faceOpts.T, { id: base.id, name: `Peça ${n + 1}`, material: base.material })
          setComp({ ...comp, parts: [...(comp.parts ?? []), p], sketches: (comp.sketches ?? []).filter((k) => k.id !== sketch.id) })
          setFaceOpts({ ...faceOpts, selSketch: undefined })
          select({ kind: "part", id: p.id })
        }
      : undefined,
  }
  // Desplaçar: al nostre 3D, el moble o la peça seleccionada ja porta les fletxes per moure'l (s'imanten a les vores).
  const move: Tool = { icon: "move", label: "Desplaçar", hint: "Arrossega les fletxes del moble o la peça seleccionada (Alt: sense imant).", run: () => toaster.create({ title: part || module ? "Arrossega les fletxes del 3D per moure'l." : pickOne, duration: 2500 }) }
  const pickOne = "Selecciona un moble o una peça."
  const settingsPage = () => window.dispatchEvent(new Event("mobles:open-settings"))

  const nouMoble: Tool = { icon: "cabinet", label: "Nou moble", hint: "Un moble nou amb les opcions del Taulell (mides, calaixos, potes, sostre, fons…). Recorda les de l'últim.", on: wizard, run: () => setWizard(true) }
  const [picking, setPicking] = useState(false)
  const plantilles: Tool = { icon: "tpl", label: "Plantilles", hint: "Afegeix un moble de la galeria (o un en blanc).", on: picking, run: () => setPicking(true) }
  const plana: Tool = { icon: "flat", label: "Plana", hint: "Cada tipus de peça d'un color.", on: opts.roleColors, run: () => opts.setRoleColors(!opts.roleColors) }
  const interior: Tool = { icon: "interior", label: "Interior", hint: "Amaga les portes i els frontals per veure l'interior.", on: !!opts.viewer.hideFronts, run: () => opts.setViewer({ hideFronts: !opts.viewer.hideFronts }) }
  const seccio: Tool = { icon: "section", label: "Secció", hint: "Talla el model amb un pla i en mostra una meitat.", on: !!opts.viewer.section, run: () => opts.setViewer({ section: opts.viewer.section ? null : { axis: 0, pos: Math.round(center.x), flip: false, paint: true } }) }
  const TABS: [string, Group[]][] = [
    [
      "Inici",
      [
        ["Moble", [nouMoble, plantilles]],
        ["Taulers", [faceToolBtn("dynpanel", "dynpanel", "Tauler dinàmic")]],
        ["Mesura", [faceToolBtn("laser", "laser", "Làser")]],
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
            { icon: "dsh", label: "Ombrejat", hint: "Les peces opaques, amb el seu material.", on: opts.viewer.opacity === 1 && !opts.roleColors && !opts.viewer.wire, run: () => (opts.setRoleColors(false), opts.setViewer({ opacity: 1, wire: false })) },
            { icon: "dwire", label: "Filferro", hint: "Només els cantells de les peces.", on: !!opts.viewer.wire, run: () => opts.setViewer({ wire: !opts.viewer.wire }) },
            { icon: "dxray", label: "Transparent", hint: "Les peces translúcides, per veure'n l'interior.", on: opts.viewer.opacity < 1, run: () => opts.setViewer({ opacity: opts.viewer.opacity < 1 ? 1 : 0.35, wire: false }) },
            plana,
            interior,
            seccio,
          ],
        ],
      ],
    ],
    [
      "Espai",
      [
        [
          "Habitació",
          [
            {
              icon: "room",
              label: "Habitació",
              hint: "Posa o treu les parets dels costats de l'habitació (la del fons hi és sempre).",
              on: !!(comp.scene?.leftWall && comp.scene?.rightWall),
              run: () => {
                const on = !(comp.scene?.leftWall && comp.scene?.rightWall)
                setComp({ ...comp, scene: { ...comp.scene, leftWall: on || undefined, rightWall: on || undefined } })
              },
            },
          ],
        ],
        ["Col·locar", [{ icon: "wallplace", label: "A la paret", hint: module ? "Arramba el moble a la paret que té al darrere (gira'l abans per posar-lo a una paret del costat)." : "Selecciona un moble.", run: module ? () => setComp(mountModule(comp, module.id, "wall", 0)) : undefined }, { icon: "rotcab", label: "Gira 90°", hint: rotate ? "Gira 90° el moble o la peça seleccionada." : pickOne, run: rotate }, move]],
        ["Mobles", [nouMoble, plantilles]],
      ],
    ],
    [
      "Esbós",
      [
        ["Croquis", [faceToolBtn("rect", "rect", "Rectangle"), faceToolBtn("poly", "poly", "Polilínia"), faceToolBtn("circle", "circle", "Cercle")]],
        ["Volum", [extrude, tauler]],
      ],
    ],
    [
      "Forma",
      [
        [
          "Transformar",
          [
            faceToolBtn("face", "face", "Cara dinàmica"),
            move,
            { icon: "rotate", label: "Girar", hint: rotate ? "Gira 90° el moble o la peça seleccionada (vist de dalt)." : pickOne, run: rotate },
            { icon: "copy", label: "Copiar", hint: copy ? "Copia el moble o la peça seleccionada." : pickOne, run: copy },
            { icon: "array", label: "Matriu", hint: part || module ? "Còpies en filera de la peça o el moble seleccionat." : pickOne, on: arrayOpen, run: part || module ? () => setArrayOpen(!arrayOpen) : undefined },
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
            tauler,
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
        ["Fresats", [faceToolBtn("groove", "groove", "Ranura"), faceToolBtn("rebate", "rebate", "Galze"), faceToolBtn("cut", "cut", "Retall")]],
        ["Ferratges", [faceToolBtn("cabineo", "cabineo", "Cabineo"), faceToolBtn("screw", "screw", "Cargols"), faceToolBtn("dowel", "dowel", "Clavilles")]],
      ],
    ],
    [
      "Eines",
      [
        ["Anàlisi", [faceToolBtn("laser", "laser", "Làser"), faceToolBtn("measure", "measure", "Mesurar"), { icon: "dimclr", label: "Esborra cotes", hint: "Treu la mesura del 3D.", run: faceOpts.measureLine || faceOpts.measureFrom ? () => setFaceOpts({ ...faceOpts, measureLine: undefined, measureFrom: undefined }) : undefined }, plana, interior, seccio]],
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
                    <Button variant={tool.on ? "subtle" : "ghost"} colorPalette={tool.on ? "wood" : undefined} aria-pressed={tool.on} size="sm" h="auto" py={1.5} px={1.5} flexDirection="column" gap={1} minW="64px" disabled={!tool.run} onClick={tool.run} aria-label={tool.label}>
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
      <FloatingWindow id="modeling-tool-3" kind="picker" width={240} height={300} minSize={{ width: 200, height: 120 }} bodyProps={{ p: 3 }} open={!!faceTool} onClose={() => setFaceTool(null)} title={faceTool ? FACE_TOOL_LABEL[faceTool] : ""} initialFocus={false} closeHint="Acabar (Esc)">
        {faceTool && (
          <Stack gap={2}>
            <ToolOptions tool={faceTool} o={faceOpts} set={setFaceOpts} comp={comp} setComp={setComp} settings={settings} />
            {faceTool !== "laser" && (
              <Text fontSize="xs" color="fg.muted">
                {FACE_TOOL_INFO[faceTool]}
              </Text>
            )}
          </Stack>
        )}
      </FloatingWindow>
      <NouMobleDialog
        open={wizard}
        onClose={() => setWizard(false)}
        settings={settings}
        count={comp.modules.length}
        onCreate={(m, warnings) => {
          setWizard(false)
          setComp({ ...comp, modules: [...comp.modules, m] })
          select({ kind: "module", id: m.id })
          if (warnings.length) toaster.create({ title: "Moble fet", description: warnings.join(" "), duration: 8000 })
        }}
      />
      <ModulePicker
        open={picking}
        onClose={() => setPicking(false)}
        mobleName={comp.modules[0]?.name ?? "Moble"}
        onBlank={() => (setPicking(false), addModule())}
        onPick={(c, n) => {
          setPicking(false)
          pickInto(comp, c, n, setComp, select)
        }}
      />
      <FloatingWindow id="modeling-section" kind="picker" width={240} height={260} minSize={{ width: 200, height: 120 }} bodyProps={{ p: 3 }} open={!!opts.viewer.section} onClose={() => opts.setViewer({ section: null })} title="Secció" initialFocus={false}>
        {opts.viewer.section && <SectionOptions s={opts.viewer.section} center={center} set={(section) => opts.setViewer({ section })} look={(x) => camera.frameFrom(x.axis === 1 ? "top" : x.axis === 0 ? (x.flip ? "left" : "right") : x.flip ? "back" : "front")} />}
      </FloatingWindow>
      <FloatingWindow id="modeling-array" kind="picker" width={240} height={300} minSize={{ width: 200, height: 120 }} bodyProps={{ p: 3 }} open={arrayOpen && !!(part || module)} onClose={() => setArrayOpen(false)} title="Matriu" initialFocus={false}>
        <ArrayOptions
          isModule={!part}
          onApply={(n, gap, axis) => {
            if (part) {
              const s = partBox(part)
              const step = s.max[axis]! - s.min[axis]! + gap
              const key = (["x", "y", "z"] as const)[axis]
              const copies: FreePart[] = Array.from({ length: n }, (_, k) => ({ ...structuredClone(part), dyn: undefined, id: newId("p"), name: `${part.name} ${k + 2}`, [key]: part[key] + step * (k + 1) }))
              setComp({ ...comp, parts: [...(comp.parts ?? []), ...copies] })
            } else if (module) {
              let c = comp
              let after = module.id
              for (let k = 0; k < n; k++) {
                const r = insertModuleCopy(c, module, after)
                c = r.comp
                after = r.id
              }
              setComp(c)
            }
            setArrayOpen(false)
          }}
        />
      </FloatingWindow>
    </>
  )
}

/** Les opcions de l'eina activa, a la seva finestra flotant (com la finestreta d'opcions del Taulell). */
function ToolOptions({ tool, o, set, comp, setComp, settings }: { tool: FaceToolId; o: FaceToolOpts; set: (o: FaceToolOpts) => void; comp: Composition; setComp: (c: Composition) => void; settings: Settings }) {
  if (tool === "face") return <FaceSize o={o} comp={comp} setComp={setComp} />
  if (tool === "rect" || tool === "poly" || tool === "circle") return <SketchOptions tool={tool} o={o} set={set} comp={comp} setComp={setComp} />
  const num = (k: NumKey, label: string, min = 0) => <NumRow key={k} maxW="110px" label={label} value={o[k]} min={min} max={3000} step={0.5} onChange={(v) => set({ ...o, [k]: v })} />
  const check = (k: "dowDist" | "scrDist", label: string) => (
    <Checkbox.Root key={k} size="sm" colorPalette="wood" checked={o[k]} onCheckedChange={(e) => set({ ...o, [k]: !!e.checked })}>
      <Checkbox.HiddenInput />
      <Checkbox.Control />
      <Checkbox.Label>{label}</Checkbox.Label>
    </Checkbox.Root>
  )
  // El material de la peça nova (com al Taulell: dins d'un moble, si no se'n tria cap, agafa el del moble).
  const mat = <MaterialSelect key="mat" label="Material" materials={boardChoices(settings.materials)} value={o.mat} emptyLabel="Com el moble" onChange={(v) => set({ ...o, mat: v })} />
  const presets = (items: [string, () => FaceToolOpts, boolean][]) => (
    <HStack key="presets" gap={1} flexWrap="wrap">
      {items.map(([l, f, on]) => (
        <Button key={l} size="2xs" variant={on ? "subtle" : "outline"} colorPalette={on ? "wood" : undefined} onClick={() => set(f())}>
          {l}
        </Button>
      ))}
    </HStack>
  )
  const rows =
    tool === "fitblock"
      ? [num("T", "Gruix"), mat, num("fitGap", "Folgança")]
      : tool === "dynpanel"
        ? [<NumRow key="T" maxW="110px" label="Gruix" value={o.T} min={1} max={200} step={0.5} onChange={(v) => set({ ...o, T: v, ownT: true })} />, mat, num("dynOff", "Desplaçament", -3000)]
        : tool === "shelf"
          ? [num("T", "Gruix"), mat, num("setback", "Retirada")]
          : tool === "hole"
            ? [
                num("d", "Diàmetre"),
                num("depth", "Fondària"),
                presets(
                  (
                    [
                      ["Ø5", 5, 12],
                      ["Ø8", 8, 12],
                      ["Ø8 cantell", 8, 30],
                      ["Ø15", 15, 13],
                    ] as const
                  ).map(([l, d, depth]) => [l, () => ({ ...o, d, depth }), o.d === d && o.depth === depth]),
                ),
              ]
            : tool === "cup"
              ? [num("cd", "Diàmetre"), num("cdepth", "Fondària")]
              : tool === "line32"
                ? [num("ld", "Diàmetre"), num("ldepth", "Fondària"), num("pitch", "Pas"), num("margin", "Marge")]
                : tool === "dowel"
                  ? [
                      presets((Object.keys(DOWELS) as DowelSize[]).map((k) => [k.replace("x", "×"), () => ({ ...o, dowM: k, dowD: DOWELS[k].d, dowF: DOWELS[k].f, dowE: DOWELS[k].e }), o.dowM === k])),
                      num("dowF", "Fondària a la cara"),
                      num("dowE", "Fondària al cantell"),
                      check("dowDist", "Repartir a tota la junta"),
                      ...(o.dowDist ? [num("dowMargin", "Marge als extrems"), num("dowPitch", "Pas màxim")] : []),
                    ]
                  : tool === "screw"
                    ? [num("scrD", "Cargol Ø"), num("scrL", "Llargada"), num("scrHole", "Forat passant Ø"), check("scrDist", "Repartir a tota la junta"), ...(o.scrDist ? [num("scrMargin", "Marge als extrems"), num("scrPitch", "Pas màxim")] : [])]
                    : tool === "cabineo"
                      ? [
                          num("cabiMargin", "Marge als extrems"),
                          num("cabiPitch", "Pas màxim"),
                          <Collapsible.Root key="cabi">
                            <Collapsible.Trigger asChild>
                              <Button size="2xs" variant="ghost" px={0}>
                                Mides del mecanitzat
                              </Button>
                            </Collapsible.Trigger>
                            <Collapsible.Content>
                              <Stack gap={2} pt={1}>
                                {num("cabiD", "Butxaca Ø")}
                                {num("cabiDepth", "Butxaca prof.")}
                                {num("cabiFirst", "1r forat des del cantell")}
                                {num("cabiStep", "Entre forats")}
                                {num("cabiAxis", "Eix del cargol des de la cara")}
                                {num("cabiSd", "Cargol Ø")}
                              </Stack>
                            </Collapsible.Content>
                          </Collapsible.Root>,
                        ]
                      : tool === "groove"
                        ? [num("grW", "Amplada"), num("grD", "Profunditat"), num("grOff", "Distància al cantell")]
                        : tool === "rebate"
                          ? [num("rbW", "Amplada"), num("rbD", "Profunditat")]
                          : []
  return (
    <Stack gap={2}>
      {tool === "fitblock" && (
        <SegmentGroup.Root size="xs" value={o.fitOrient} onValueChange={(e) => e.value && set({ ...o, fitOrient: e.value as FaceToolOpts["fitOrient"] })}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={[{ value: "flat", label: "Prestatge" }, { value: "side", label: "Divisió" }, { value: "front", label: "De cara" }]} />
        </SegmentGroup.Root>
      )}
      {tool === "laser" && (
        <>
          <SegmentGroup.Root size="xs" value={o.laserMode} onValueChange={(e) => e.value && set({ ...o, laserMode: e.value as "face" | "axis", measureFrom: undefined, measureLine: undefined })}>
            <SegmentGroup.Indicator />
            <SegmentGroup.Items items={[{ value: "face", label: "Cara a cara" }, { value: "axis", label: "Eix a eix" }]} />
          </SegmentGroup.Root>
          <Text fontSize="sm" color="fg.muted">
            {o.laserMode === "axis"
              ? "Clica el primer eix i després el segon: un forat (el seu centre) o un tauler (el mig del gruix). Et dona la distància i les diferències en X, Y i Z."
              : "Apunta a una cara de dins del moble (un lateral, la base, el fons…): el raig surt recte fins a la peça del davant i et diu la distància. Clica per deixar-la fixada; torna a clicar per mesurar una altra cosa."}
          </Text>
        </>
      )}
      {tool === "groove" && (
        <SegmentGroup.Root size="xs" value={o.grDir} onValueChange={(e) => e.value && set({ ...o, grDir: e.value as "L" | "A" })}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={[{ value: "L", label: "Al llarg" }, { value: "A", label: "A l'ample" }]} />
        </SegmentGroup.Root>
      )}
      {tool === "cabineo" && (
        <SegmentGroup.Root size="xs" value={o.cabiM} onValueChange={(e) => e.value && set({ ...o, cabiM: e.value as "12" | "8" })}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={[{ value: "12", label: "Cabineo 12" }, { value: "8", label: "Cabineo 8" }]} />
        </SegmentGroup.Root>
      )}
      {rows}
      {tool === "band" && <Text fontSize="sm">Sense opcions: clica a prop del cantell.</Text>}
    </Stack>
  )
}

/** Gira 90° una peça lliure al voltant del vertical, pel seu centre: de cara ↔ de costat; estirada, l'amplada i la fondària es canvien. */
function turnPart(p: FreePart): FreePart {
  if (p.orient === "front") return reorientPart(p, "side")
  if (p.orient === "side") return reorientPart(p, "front")
  const b = partBox(p)
  const cx = (b.min[0] + b.max[0]) / 2
  const cz = (b.min[2] + b.max[2]) / 2
  return { ...p, w: p.h, h: p.w, x: Math.round(cx - p.h / 2), z: Math.round(cz - p.w / 2) }
}

/** La finestra de la Matriu (com la del Taulell): quantes còpies, a quina separació i en quina direcció. */
function ArrayOptions({ isModule, onApply }: { isModule: boolean; onApply: (n: number, gap: number, axis: 0 | 1 | 2) => void }) {
  const [n, setN] = useState(3)
  const [gap, setGap] = useState(0)
  const [axis, setAxis] = useState<0 | 1 | 2>(0)
  return (
    <Stack gap={2}>
      <NumRow maxW="110px" label="Còpies" value={n} min={1} max={50} step={1} onChange={setN} />
      {isModule ? (
        <Text fontSize="xs" color="fg.muted">
          Els mobles van l'un al costat de l'altre, a la fila.
        </Text>
      ) : (
        <>
          <SegmentGroup.Root size="xs" value={String(axis)} onValueChange={(e) => e.value && setAxis(Number(e.value) as 0 | 1 | 2)}>
            <SegmentGroup.Indicator />
            <SegmentGroup.Items items={[{ value: "0", label: "De costat" }, { value: "1", label: "Amunt" }, { value: "2", label: "Endavant" }]} />
          </SegmentGroup.Root>
          <NumRow maxW="110px" label="Separació" value={gap} min={-3000} max={3000} step={1} onChange={setGap} />
        </>
      )}
      <Button size="xs" colorPalette="wood" alignSelf="start" onClick={() => onApply(n, gap, axis)}>
        Fes les còpies
      </Button>
    </Stack>
  )
}

/** Cara dinàmica: la mida de la peça en la direcció de la cara clicada (la cara del davant es queda on és). */
function FaceSize({ o, comp, setComp }: { o: FaceToolOpts; comp: Composition; setComp: (c: Composition) => void }) {
  const f = o.facePick
  const p = f && comp.parts?.find((q) => q.id === f.part)
  if (!f || !p) return <Text fontSize="sm">Clica una cara d'una peça.</Text>
  return (
    <Stack gap={1}>
      <Text fontSize="sm">
        <b>{p.name}</b> · cara {SIDE_NAMES[f.a]![f.s].toLowerCase()}
      </Text>
      <NumRow maxW="110px" label="Mida" value={partSize(p)[f.a]!} min={1} max={5000} step={1} onChange={(v) => setComp({ ...comp, parts: (comp.parts ?? []).map((q) => (q.id === p.id ? resizePartFace(q, f.a, f.s, v) : q)) })} />
      {(p.fit || p.dyn) && (
        <Text fontSize="xs" color="fg.muted">
          Si la canvies, deixa d'estar lligada.
        </Text>
      )}
    </Stack>
  )
}

type NumKey = { [K in keyof FaceToolOpts]-?: FaceToolOpts[K] extends number ? K : never }[keyof FaceToolOpts]

/** Rectangle, Polilínia i Cercle: el que s'ha clicat, les mides per escriure i acabar el croquis. */
function SketchOptions({ tool, o, set, comp, setComp }: { tool: "rect" | "poly" | "circle"; o: FaceToolOpts; set: (o: FaceToolOpts) => void; comp: Composition; setComp: (c: Composition) => void }) {
  const d = o.draft
  const done = (pts: [number, number][], rect: boolean) => {
    const r = finishSketch(comp, o, pts, rect)
    if (r.comp) setComp(r.comp)
    if (r.opts) set(r.opts)
    toaster.create({ title: r.message, type: r.error ? "warning" : "success", duration: 2500 })
  }
  const p0 = d?.pts[0]
  return (
    <Stack gap={2}>
      <Text fontSize="sm">{!d ? (tool === "circle" ? "Clica el centre sobre una cara." : "Clica el primer punt sobre una cara.") : tool === "poly" ? `${d.pts.length} punts.` : tool === "circle" ? "Centre fixat." : "Primer cantó fixat."}</Text>
      {tool === "rect" && (
        <>
          <NumRow maxW="110px" label="Llarg" value={o.sketchL} min={1} max={5000} step={1} onChange={(v) => set({ ...o, sketchL: v })} />
          <NumRow maxW="110px" label="Ample" value={o.sketchW} min={1} max={5000} step={1} onChange={(v) => set({ ...o, sketchW: v })} />
        </>
      )}
      {tool === "circle" && <NumRow maxW="110px" label="Diàmetre" value={o.sketchD} min={1} max={5000} step={1} onChange={(v) => set({ ...o, sketchD: v })} />}
      {d && p0 && (
        <HStack gap={2} flexWrap="wrap">
          {tool === "rect" && (
            <Button size="xs" colorPalette="wood" onClick={() => done([p0, [p0[0] + o.sketchL, p0[1]], [p0[0] + o.sketchL, p0[1] + o.sketchW], [p0[0], p0[1] + o.sketchW]], true)}>
              Aplica les mides
            </Button>
          )}
          {tool === "circle" && (
            <Button size="xs" colorPalette="wood" onClick={() => done(circlePts(p0, o.sketchD), false)}>
              Aplica el diàmetre
            </Button>
          )}
          {tool === "poly" && (
            <Button size="xs" colorPalette="wood" disabled={d.pts.length < 3} onClick={() => done(d.pts, false)}>
              Tanca
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={() => set({ ...o, draft: d.pts.length > 1 && tool === "poly" ? { ...d, pts: d.pts.slice(0, -1) } : undefined })}>
            {tool === "poly" && d.pts.length > 1 ? "Treu l'últim" : "Torna a començar"}
          </Button>
        </HStack>
      )}
    </Stack>
  )
}

type Section = { axis: 0 | 1 | 2; pos: number; flip: boolean; paint?: boolean }
/** La finestra de la Secció (com la del Taulell): el pla (X, Z o Y), on és (lliscant i posició exacta), girar-la, pintar la cara tallada i mirar-la de cara. */
function SectionOptions({ s, center, set, look }: { s: Section; center: { x: number; y: number; z: number }; set: (s: Section) => void; look: (s: Section) => void }) {
  const mid = [center.x, center.y, center.z]
  const max = Math.max(10, Math.round(2 * mid[s.axis]!))
  return (
    <Stack gap={2.5}>
      <HStack gap={1}>
        <SegmentGroup.Root size="xs" value={String(s.axis)} onValueChange={(e) => e.value && set({ ...s, axis: Number(e.value) as 0 | 1 | 2, pos: Math.round(mid[Number(e.value)]!) })}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={[{ value: "0", label: "Pla X" }, { value: "2", label: "Pla Z" }, { value: "1", label: "Pla Y" }]} />
        </SegmentGroup.Root>
        <Button size="2xs" variant="outline" onClick={() => set({ ...s, flip: !s.flip })} title="Mostra l'altra meitat">
          ⇄ Gira
        </Button>
      </HStack>
      <Box>
        <HStack justify="space-between" fontSize="sm">
          <Text>{["De costat (X)", "Alçada (Y)", "Fondària (Z)"][s.axis]}</Text>
          <Text fontFamily="mono">{s.pos} mm</Text>
        </HStack>
        <Slider.Root size="sm" colorPalette="wood" min={0} max={max} step={1} value={[Math.min(max, Math.max(0, s.pos))]} onValueChange={(e) => set({ ...s, pos: e.value[0]! })}>
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumbs />
          </Slider.Control>
        </Slider.Root>
      </Box>
      <NumRow maxW="110px" label="Posició exacta" value={s.pos} min={-10000} max={30000} step={1} onChange={(pos) => set({ ...s, pos })} />
      <Checkbox.Root size="sm" colorPalette="wood" checked={!!s.paint} onCheckedChange={(e) => set({ ...s, paint: !!e.checked || undefined })}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>Pinta la cara tallada</Checkbox.Label>
      </Checkbox.Root>
      <Button size="xs" variant="outline" onClick={() => look(s)}>
        Mira la secció de cara
      </Button>
    </Stack>
  )
}
