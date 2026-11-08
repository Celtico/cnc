/** Les finestres d'opcions de les eines del Modelatge (com les del Taulell): unions, cara dinàmica, esbós, secció i tauler dinàmic. */
import { Box, Button, Checkbox, Collapsible, HStack, SegmentGroup, Slider, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { toaster } from "../../components/ui/toaster"
import { boardChoices, circlePts, partSize, SIDE_NAMES, type Composition, type FreePart, type Settings } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { NumRow } from "../../components/NumRow"
import { createRefPanel, finishBoard, finishSketch, MODULE_DIM, movePart, resizePartFace } from "../modeling/faceTools"
import { DOWELS, type DowelSize, type FaceToolId, type FaceToolOpts } from "../modeling/faceToolOptions"
import { moduleFaceChange } from "../modeling/dragArrows"
import { MaterialSelect } from "../settings/MaterialSelect"


export function ToolOptions({ tool, o, set, comp, setComp, settings, build, selection, select, done }: { tool: FaceToolId; o: FaceToolOpts; set: (o: FaceToolOpts) => void; comp: Composition; setComp: (c: Composition) => void; settings: Settings; build?: CompositionBuild; selection: Selection; select: (s: Selection) => void; done: () => void }) {
  if (tool === "dynpanel") return <DynPanelOptions o={o} set={set} comp={comp} setComp={setComp} settings={settings} build={build} selection={selection} select={select} done={done} />
  if (tool === "face") return <FaceSize o={o} set={set} comp={comp} setComp={setComp} />
  if (tool === "rect" || tool === "poly" || tool === "circle" || tool === "board") return <SketchOptions tool={tool} o={o} set={set} comp={comp} setComp={setComp} settings={settings} select={select} />
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

function FaceSize({ o, set, comp, setComp }: { o: FaceToolOpts; set: (o: FaceToolOpts) => void; comp: Composition; setComp: (c: Composition) => void }) {
  const [delta, setDelta] = useState(0)
  const mode = o.faceMode
  const modes = (
    <SegmentGroup.Root size="xs" value={mode} onValueChange={(e) => e.value && set({ ...o, faceMode: e.value as FaceToolOpts["faceMode"], mateFrom: undefined, facePick: undefined })}>
      <SegmentGroup.Indicator />
      <SegmentGroup.Items items={[{ value: "pull", label: "Estirar" }, { value: "move", label: "Desplaçar" }, { value: "mate", label: "Enganxar" }]} />
    </SegmentGroup.Root>
  )
  const note = (t: ReactNode) => (
    <Text fontSize="sm" color="fg.muted">
      {t}
    </Text>
  )
  if (mode === "mate") {
    const from = o.mateFrom && comp.parts?.find((q) => q.id === o.mateFrom!.part)
    return (
      <Stack gap={2}>
        {modes}
        <SegmentGroup.Root size="xs" value={o.mateMode} onValueChange={(e) => e.value && set({ ...o, mateMode: e.value as "contact" | "flush" })}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={[{ value: "contact", label: "De cara" }, { value: "flush", label: "Alineades" }]} />
        </SegmentGroup.Root>
        <NumRow maxW="110px" label="Separació" value={o.faceGap} min={-1000} max={1000} step={0.5} onChange={(v) => set({ ...o, faceGap: v })} />
        {from && o.mateFrom
          ? note(
              <>
                <b>1. {from.name}</b> · cara {SIDE_NAMES[o.mateFrom.a]![o.mateFrom.s].toLowerCase()}
                <br />
                2. Ara clica la cara on s'ha d'enganxar.
              </>,
            )
          : note(
              <>
                1. Clica la cara de la peça que es mou. 2. Clica la cara on s'ha d'enganxar. <b>De cara</b>: es toquen. <b>Alineades</b>: queden al mateix pla.
              </>,
            )}
      </Stack>
    )
  }
  const f = o.facePick
  const p = f?.part ? comp.parts?.find((q) => q.id === f.part) : undefined
  const m = f?.module ? comp.modules.find((q) => q.id === f.module) : undefined
  if (!f || (!p && !m))
    return (
      <Stack gap={2}>
        {modes}
        {note(mode === "pull" ? "Clica una cara per allargar o escurçar la peça. En un moble, una cara de fora en canvia la mida." : "Clica una cara per moure la peça (o el moble) en aquella direcció.")}
      </Stack>
    )
  const sign = f.s ? 1 : -1
  const dim = m ? MODULE_DIM[f.a]! : null
  const apply = (d: number) => {
    if (!d) return
    if (p) {
      const next = mode === "pull" ? resizePartFace(p, f.a, f.s, Math.max(1, partSize(p)[f.a]! + d)) : movePart(p, f.a, sign * d)
      setComp({ ...comp, parts: (comp.parts ?? []).map((q) => (q.id === p.id ? next : q)) })
    } else if (m && dim) {
      const next = moduleFaceChange(comp, m.id, f.a, f.s, mode === "pull" ? "pull" : "move", d)
      if (next) setComp(next)
      else toaster.create({ title: "Un moble es mou de costat amb la cara dinàmica; amunt, avall i endavant, amb Desplaçar.", duration: 3000 })
    }
    setDelta(0)
  }
  return (
    <Stack gap={2}>
      {modes}
      <Text fontSize="sm">
        <b>{p ? p.name : m!.name}</b> · cara {SIDE_NAMES[f.a]![f.s].toLowerCase()}
        {m && mode === "move" ? " (es mou sencer)" : ""}
      </Text>
      {mode === "pull" && p && <NumRow maxW="110px" label="Mida" value={partSize(p)[f.a]!} min={1} max={5000} step={1} onChange={(v) => setComp({ ...comp, parts: (comp.parts ?? []).map((q) => (q.id === p.id ? resizePartFace(q, f.a, f.s, v) : q)) })} />}
      {mode === "pull" && m && dim && <NumRow maxW="110px" label={dim[1]} value={m.carcass[dim[0]]} min={100} max={3000} step={1} onChange={(v) => setComp({ ...comp, modules: comp.modules.map((q) => (q.id === m.id ? { ...q, carcass: { ...q.carcass, [dim[0]]: v } } : q)) })} />}
      <NumRow maxW="110px" label={mode === "pull" ? "Estira" : "Desplaça"} value={delta} min={-5000} max={5000} step={1} onChange={setDelta} />
      <Button size="xs" colorPalette="wood" onClick={() => apply(delta)}>
        Aplica
      </Button>
      {note("Mesura positiva cap a fora de la cara.")}
      {p && (p.fit || p.dyn) && note("Si la canvies, deixa d'estar lligada.")}
    </Stack>
  )
}

type NumKey = { [K in keyof FaceToolOpts]-?: FaceToolOpts[K] extends number ? K : never }[keyof FaceToolOpts]

/** Rectangle, Polilínia i Cercle: el que s'ha clicat, les mides per escriure i acabar el croquis. */
function SketchOptions({ tool, o, set, comp, setComp, settings, select }: { tool: "rect" | "poly" | "circle" | "board"; o: FaceToolOpts; set: (o: FaceToolOpts) => void; comp: Composition; setComp: (c: Composition) => void; settings: Settings; select: (s: Selection) => void }) {
  const d = o.draft
  const done = (pts: [number, number][], rect: boolean) => {
    const r = tool === "board" ? finishBoard(comp, o, pts) : finishSketch(comp, o, pts, rect)
    if (r.comp) setComp(r.comp)
    if (r.select) select(r.select)
    if (r.opts) set(r.opts)
    toaster.create({ title: r.message, type: r.error ? "warning" : "success", duration: 2500 })
  }
  const p0 = d?.pts[0]
  return (
    <Stack gap={2}>
      <Text fontSize="sm">{!d ? (tool === "circle" ? "Clica el centre a terra o sobre una cara." : "Clica el primer punt a terra o sobre una cara.") : tool === "poly" ? `${d.pts.length} punts.` : tool === "circle" ? "Centre fixat." : "Primer cantó fixat: mou el ratolí i clica l'altre cantó."}</Text>
      {tool === "board" && (
        <>
          <NumRow maxW="110px" label="Gruix" value={o.T} min={1} max={200} step={0.5} onChange={(v) => set({ ...o, T: v })} />
          <MaterialSelect label="Material" materials={boardChoices(settings.materials)} value={o.mat} emptyLabel="Com el moble" onChange={(v) => set({ ...o, mat: v })} />
        </>
      )}
      {(tool === "rect" || tool === "board") && (
        <>
          <NumRow maxW="110px" label="Llarg" value={o.sketchL} min={1} max={5000} step={1} onChange={(v) => set({ ...o, sketchL: v })} />
          <NumRow maxW="110px" label="Ample" value={o.sketchW} min={1} max={5000} step={1} onChange={(v) => set({ ...o, sketchW: v })} />
        </>
      )}
      {tool === "circle" && <NumRow maxW="110px" label="Diàmetre" value={o.sketchD} min={1} max={5000} step={1} onChange={(v) => set({ ...o, sketchD: v })} />}
      {d && p0 && (
        <HStack gap={2} flexWrap="wrap">
          {(tool === "rect" || tool === "board") && (
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
export function SectionOptions({ s, center, set, look }: { s: Section; center: { x: number; y: number; z: number }; set: (s: Section) => void; look: (s: Section) => void }) {
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

/**
 * La finestra del Tauler dinàmic (com la del Taulell): «Dinàmic» (clica la cara on es recolza) o «Cares de referència»
 * (clica les cares que el limiten, una a una, i «Crea el tauler»), l'orientació, el gruix i el desplaçament. Amb un tauler
 * dinàmic triat, s'edita: el gruix, el desplaçament de cada cara, Fet, Esborra o Deixa'l fix.
 */
function DynPanelOptions({ o, set, comp, setComp, settings, build, selection, select, done }: { o: FaceToolOpts; set: (o: FaceToolOpts) => void; comp: Composition; setComp: (c: Composition) => void; settings: Settings; build?: CompositionBuild; selection: Selection; select: (s: Selection) => void; done: () => void }) {
  const editing = selection.kind === "part" ? comp.parts?.find((q) => q.id === selection.id && q.dyn) : undefined
  const label = (id: string) => build?.panels.find((q) => q.id === id)?.label ?? "Cara perduda"
  const note = (t: ReactNode) => (
    <Text fontSize="sm" color="fg.muted">
      {t}
    </Text>
  )
  const mat = <MaterialSelect label="Material" materials={boardChoices(settings.materials)} value={o.mat} emptyLabel="Com el moble" onChange={(v) => set({ ...o, mat: v })} />
  const thick = <NumRow maxW="110px" label="Gruix" value={o.T} min={1} max={200} step={0.5} onChange={(v) => set({ ...o, T: v, ownT: true })} />
  const orient = (withAuto: string) => (
    <HStack gap={1} flexWrap="wrap">
      {(
        [
          [1, "Horitzontal"],
          [0, "De costat"],
          [2, "De cara"],
          ["auto", withAuto],
        ] as const
      ).map(([k, l]) => (
        <Button key={l} size="2xs" variant={o.dynOrient === k ? "subtle" : "outline"} colorPalette={o.dynOrient === k ? "wood" : undefined} onClick={() => set({ ...o, dynOrient: k })}>
          {l}
        </Button>
      ))}
    </HStack>
  )
  if (editing?.dyn) {
    const d = editing.dyn
    const put = (dyn: NonNullable<FreePart["dyn"]> | undefined, extra: Partial<FreePart> = {}) => setComp({ ...comp, parts: (comp.parts ?? []).map((q) => (q.id === editing.id ? { ...q, dyn, ...extra } : q)) })
    return (
      <Stack gap={2}>
        <Text fontSize="sm" fontWeight="semibold">
          Editant {editing.name}
        </Text>
        <NumRow maxW="110px" label="Gruix" value={editing.thickness} min={1} max={200} step={0.5} onChange={(v) => put(d, { thickness: v })} />
        {d.limits.map((L, i) => (
          <NumRow
            key={i}
            maxW="110px"
            label={`${SIDE_NAMES[L.a]![L.s]} · ${label(L.panel)}`}
            value={L.off}
            min={-3000}
            max={3000}
            step={0.5}
            onChange={(v) => put({ ...d, limits: d.limits.map((x, k) => (k === i ? { ...x, off: v } : x)) })}
          />
        ))}
        <Box bg="bg.muted" rounded="md" px={2.5} py={1.5} fontFamily="mono" fontSize="sm">
          {editing.w} × {editing.h} × {editing.thickness} mm
        </Box>
        {note("S'enganxa a aquestes cares i es recalcula si es mouen. El desplaçament és cap a dins.")}
        <HStack gap={1.5} flexWrap="wrap">
          <Button size="xs" colorPalette="wood" onClick={() => (select({ kind: "moble" }), done())}>
            Fet
          </Button>
          <Button size="xs" variant="outline" onClick={() => put(undefined)}>
            Deixa'l fix
          </Button>
          <Button size="xs" variant="outline" colorPalette="red" onClick={() => (setComp({ ...comp, parts: (comp.parts ?? []).filter((q) => q.id !== editing.id) }), select({ kind: "moble" }))}>
            Esborra
          </Button>
        </HStack>
      </Stack>
    )
  }
  const modes = (
    <SegmentGroup.Root size="xs" value={o.dynMode} onValueChange={(e) => e.value && set({ ...o, dynMode: e.value as "auto" | "ref", refLimits: undefined, refSeed: undefined })}>
      <SegmentGroup.Indicator />
      <SegmentGroup.Items items={[{ value: "auto", label: "Dinàmic" }, { value: "ref", label: "Cares de referència" }]} />
    </SegmentGroup.Root>
  )
  if (o.dynMode === "ref") {
    const refs = o.refLimits ?? []
    return (
      <Stack gap={2}>
        {modes}
        {!refs.length ? (
          note(
            <>
              <b>1.</b> Clica les cares que limiten el tauler (laterals, fons, sostre…), una a una. <b>2.</b> Tria l'orientació. <b>3.</b> «Crea el tauler». Torna a clicar una cara per treure-la.
            </>,
          )
        ) : (
          <Stack gap={0.5} fontSize="sm">
            {refs.map((L, i) => (
              <HStack key={i} gap={2}>
                <Text fontWeight="semibold" minW="64px">
                  {SIDE_NAMES[L.a]![L.s]}
                </Text>
                <Text color="fg.muted" truncate>
                  {label(L.panel)}
                </Text>
              </HStack>
            ))}
          </Stack>
        )}
        <Text fontSize="xs" color="fg.muted">
          Orientació
        </Text>
        {orient("Auto")}
        {thick}
        {mat}
        <HStack gap={1.5}>
          <Button
            size="xs"
            colorPalette="wood"
            disabled={refs.length < 2}
            onClick={() => {
              const r = createRefPanel(o, comp, build)
              if (r.comp) setComp(r.comp)
              if (r.opts) set(r.opts)
              if (r.select) select(r.select)
              toaster.create({ title: r.message, type: r.error ? "warning" : "success", duration: 2500 })
            }}
          >
            Crea el tauler
          </Button>
          {refs.length > 0 && (
            <Button size="xs" variant="ghost" onClick={() => set({ ...o, refLimits: undefined, refSeed: undefined })}>
              Torna a començar
            </Button>
          )}
        </HStack>
      </Stack>
    )
  }
  return (
    <Stack gap={2}>
      {modes}
      {note("Mou el ratolí per dins del moble: el tauler surt en verd. Clica la cara on es recolza (per exemple la base): s'hi posa i s'estén fins a les cares del costat. Per editar-ne un de fet, selecciona'l.")}
      {orient("Com la cara")}
      {thick}
      <NumRow maxW="110px" label="Desplaçament" value={o.dynOff} min={-3000} max={3000} step={0.5} onChange={(v) => set({ ...o, dynOff: v })} />
      {mat}
    </Stack>
  )
}
