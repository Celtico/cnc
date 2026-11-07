import { Box, Button, HStack, SegmentGroup, Separator, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { TopBarSlot } from "../../components/TopBar"
import { toaster } from "../../components/ui/toaster"
import { Tooltip } from "../../components/ui/tooltip"
import { circlePts, extrudeSketch, insertModuleCopy, insertPartCopy, moduleRot, partSize, SIDE_NAMES, mountOf, newId, partBox, removeModule, reorientPart, type Composition, type FreePart, type Module, type PartOrient, type Settings } from "../../core/model"
import { freePartFor } from "../composition/addElements"
import type { Selection } from "../composition/StructureTree"
import type { EditorCamera } from "./useEditorCamera"
import type { ViewerOptions } from "./useViewerOptions"
import { TaulellIcon, type TaulellIconName } from "../modeling/TaulellIcon"
import { FloatingWindow } from "../../components/FloatingWindow"
import { NumRow } from "../../components/NumRow"
import { FACE_TOOL_INFO, FACE_TOOL_LABEL, finishSketch, resizePartFace, type FaceToolId, type FaceToolOpts } from "../modeling/faceTools"

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
  const faceToolBtn = (id: FaceToolId, icon: TaulellIconName, label: string): Tool => ({ icon, label, hint: FACE_TOOL_INFO[id], on: faceTool === id, run: () => (setFaceOpts({ ...faceOpts, draft: undefined }), setFaceTool(faceTool === id ? null : id)) })
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
        ["Col·locar", [{ icon: "wallplace", label: "A la paret" }, { icon: "rotcab", label: "Gira 90°", hint: rotate ? "Gira 90° el moble o la peça seleccionada." : pickOne, run: rotate }, move]],
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
      <FloatingWindow id="modeling-tool-3" kind="picker" width={240} height={300} minSize={{ width: 200, height: 120 }} bodyProps={{ p: 3 }} open={!!faceTool} onClose={() => setFaceTool(null)} title={faceTool ? FACE_TOOL_LABEL[faceTool] : ""} initialFocus={false} closeHint="Acabar (Esc)">
        {faceTool && (
          <Stack gap={2}>
            <ToolOptions tool={faceTool} o={faceOpts} set={setFaceOpts} comp={comp} setComp={setComp} />
            <Text fontSize="xs" color="fg.muted">
              {FACE_TOOL_INFO[faceTool]}
            </Text>
          </Stack>
        )}
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
function ToolOptions({ tool, o, set, comp, setComp }: { tool: FaceToolId; o: FaceToolOpts; set: (o: FaceToolOpts) => void; comp: Composition; setComp: (c: Composition) => void }) {
  if (tool === "face") return <FaceSize o={o} comp={comp} setComp={setComp} />
  if (tool === "rect" || tool === "poly" || tool === "circle") return <SketchOptions tool={tool} o={o} set={set} comp={comp} setComp={setComp} />
  const num = (k: NumKey, label: string, min = 0) => <NumRow key={k} maxW="110px" label={label} value={o[k]} min={min} max={3000} step={0.5} onChange={(v) => set({ ...o, [k]: v })} />
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
        <HStack gap={2}>
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
