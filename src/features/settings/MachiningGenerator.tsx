import { Box, Button, HStack, IconButton, Stack, Switch, Text, Textarea } from "@chakra-ui/react"
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { LuFileUp, LuPlus, LuTrash2 } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../components/FormRow"
import { NumberField } from "../../components/NumRow"
import { toaster } from "../../components/ui/toaster"
import { readDxf } from "../../core/import/dxf"
import { hasMachiningLayers, machiningFromDxf, partFromFileName } from "../../core/import/dxfMachining"
import type { HardwareView } from "../../core/import/views"
import { assetViews, getHardwareAsset } from "../../db/hardwareAssets"
import { useLiveQuery } from "../../db/useLiveQuery"
import {
  edgeLabel,
  genOpText,
  GEN_OP_KINDS,
  machiningParts,
  machiningProblems,
  newId,
  PART_KINDS,
  partKindOf,
  reassignMachining,
  setMachining,
  type EdgeRef,
  type GenOp,
  type GenTool,
  type HardwareItem,
  type PartKind,
  type Pos,
} from "../../core/model"
import { atFor, axisNames, newOp, opShape, parsePoints, placeLines, pointsText, SAMPLE, snapPoints, snapTo, withKind, type MachiningUi, type Shape } from "./machiningDraw"

/** Des d'on es mira el dibuix (P cap a la dreta, Q amunt), segons la normal de la peça. */
const VIEW_FROM: Record<"x" | "y" | "z", string> = { x: "vista des de l'esquerra", y: "vista de sota (el davant amunt)", z: "vista de davant" }
const VIEW_LABEL: Record<HardwareView["name"], string> = { front: "Frontal", side: "Lateral", top: "De dalt" }
const n = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")

/**
 * **Generador de mecanitzats** d'un ferratge (qualsevol: també els «només 3D» i els importats): què li fa a cada peça
 * (porta, lateral, base, tapa…) quan es col·loca a mà al moble (Editor › mòdul o peça lliure › Ferratges). Per a cada
 * peça, el dibuix d'una peça d'exemple amb el punt de referència al mig, les operacions i, de fons, la vista 2D del fitxer
 * (girada com calgui); un clic al dibuix posa el mecanitzat triat en aquell punt (s'enganxa als vèrtexs i als centres
 * dels cercles de la vista). Les eines surten de la màquina per defecte (Preferències › Màquines CNC) i en donen el Ø o
 * l'amplada i en comproven la fondària. Un importat que es toca queda sense confirmar.
 */
export function MachiningGenerator({ item, onChange, tools, ui: [ui, patch] }: { item: HardwareItem; onChange: (next: HardwareItem) => void; tools: GenTool[]; ui: [MachiningUi, (p: Partial<MachiningUi>) => void] }) {
  const ops = useMemo(() => item.machining ?? [], [item.machining])
  const part = ui.part ?? machiningParts(ops)[0] ?? "top"
  const sel = ui.sel
  const setSel = (id: string | null) => patch({ sel: id })
  const file = useRef<HTMLInputElement>(null)
  const problems = useMemo(() => machiningProblems(ops, tools), [ops, tools])
  const set = (next: GenOp[]) => onChange(setMachining(item, next))
  const setOp = (id: string, next: GenOp) => set(ops.map((o) => (o.id === id ? next : o)))
  const mine = ops.filter((o) => o.part === part)
  const bbox = item.imported?.bbox
  const readFile = async (f: File) => {
    try {
      const drawing = readDxf(await f.text())
      if (!hasMachiningLayers(drawing)) {
        toaster.create({ title: "Aquest DXF no té capes de mecanitzat", description: "Cal que les capes es diguin com les del nostre DXF: DRILL_D5_P12, GROOVE_W8_P10, POCKET_P12, CUT_THROUGH, CONTOUR (vegeu «Com exportar des de TopSolid»).", type: "warning", duration: 10000 })
        return
      }
      const target = partFromFileName(f.name) ?? part
      const got = machiningFromDxf(drawing, target, newId("dxf"))
      set([...ops.filter((o) => o.part !== target), ...got.ops])
      patch({ part: target, sel: null })
      toaster.create({
        title: `${got.ops.length} mecanitzats llegits del DXF (${partKindOf(target).label.toLowerCase()})`,
        description: [item.imported ? "Revisa'ls i confirma el ferratge: fins aleshores no fa cap forat." : "", ...got.notes].filter(Boolean).join(" "),
        type: got.notes.length ? "warning" : "success",
        duration: 10000,
      })
    } catch (e) {
      toaster.create({ title: "No s'ha pogut llegir el DXF", description: e instanceof Error ? e.message : String(e), type: "error", duration: 8000 })
    }
  }
  return (
    <FormSection title="Generador de mecanitzats">
      <Text fontSize="sm" color="fg.muted">
        Què fa el ferratge a cada peça quan el col·loques a mà al moble (Editor › mòdul o peça lliure › «Ferratges»): forats, ranures, caixeres i
        contorns, mesurats des del <strong>punt de referència</strong> (on el col·loques; la creu del dibuix) o des d'un cantell de la peça. Les mides
        les dius tu (o un DXF del taller): el 3D i les vistes són per mirar-les.
        {item.imported ? " Un importat amb mecanitzats s'ha de confirmar; si els canvies, torna a quedar sense confirmar." : ""}
      </Text>
      {bbox && (
        <FormRow label="Caixa del model" help="Del fitxer (STEP), al marc del ferratge: u · v · n (n fora de la cara on va muntat). L'origen és el punt de referència.">
          <Text fontSize="sm" pt="6px" fontFamily="mono" data-testid="machining-bbox">
            {n(bbox.max[0] - bbox.min[0])} × {n(bbox.max[1] - bbox.min[1])} × {n(bbox.max[2] - bbox.min[2])} mm
          </Text>
        </FormRow>
      )}
      <FormRow label="Peça" help="La peça del moble on van aquests mecanitzats (cada grup té els seus).">
        <ChoiceChips
          label="Peça"
          value={part}
          options={PART_KINDS.filter((p) => p.id !== "any" || part === "any" || ops.some((o) => o.part === "any")).map((p) => {
            const k = ops.filter((o) => o.part === p.id).length
            return { id: p.id, label: k ? `${p.label} (${k})` : p.label }
          })}
          onChange={(p) => patch({ part: p, sel: null })}
        />
      </FormRow>
      {part === "any" && mine.length > 0 && (
        <FormRow
          label="Assignar a"
          help="El fitxer no diu a quina peça van aquests mecanitzats (exactes: el Ø, la fondària i la posició són els del programa). Tria-la: fins aleshores el ferratge no es pot confirmar."
        >
          <ChoiceChips
            label="Assignar a"
            value={"any" as PartKind}
            options={PART_KINDS.filter((p) => p.id !== "any").map((p) => ({ id: p.id, label: p.label }))}
            onChange={(to) => {
              set(reassignMachining(ops, "any", to))
              patch({ part: to, sel: null })
            }}
          />
        </FormRow>
      )}
      <Stack gap={2} data-testid="machining-ops">
        {mine.map((op, i) => (
          <OpEditor
            key={op.id}
            n={i + 1}
            op={op}
            tools={tools}
            selected={sel === op.id}
            problems={problems.filter((p) => p.op === op.id).map((p) => p.message)}
            onSelect={() => setSel(sel === op.id ? null : op.id)}
            onChange={(next) => setOp(op.id, next)}
            onDelete={() => set(ops.filter((o) => o.id !== op.id))}
          />
        ))}
        {!mine.length && (
          <Text fontSize="sm" color="fg.muted">
            Cap mecanitzat a {partKindOf(part).label.toLowerCase()}.
          </Text>
        )}
      </Stack>
      <HStack gap={2} wrap="wrap">
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            const op = newOp(part)
            set([...ops, op])
            setSel(op.id)
          }}
          data-testid="machining-add"
        >
          <LuPlus /> Afegir mecanitzat
        </Button>
        <Button size="xs" variant="ghost" onClick={() => file.current?.click()} title="DXF d'una peça amb les capes de mecanitzat (DRILL_D…_P…, GROOVE_W…_P…, POCKET_P…, CUT_THROUGH, CONTOUR)">
          <LuFileUp /> Llegir un DXF…
        </Button>
        <input
          ref={file}
          type="file"
          accept=".dxf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ""
            if (f) void readFile(f)
          }}
        />
      </HStack>
    </FormSection>
  )
}

/**
 * El dibuix del generador a l'escenari de l'editor del ferratge (a l'esquerra, sota el 3D): la peça triada al formulari
 * amb els mecanitzats, la vista 2D del fitxer de fons (girada i en mirall si cal) i les mides de la caixa del model.
 * Clic = posar-hi el mecanitzat triat.
 */
export function MachiningStage({ item, onChange, ui: [ui, patch] }: { item: HardwareItem; onChange: (next: HardwareItem) => void; ui: [MachiningUi, (p: Partial<MachiningUi>) => void] }) {
  const assetId = item.imported?.asset
  const asset = useLiveQuery(() => (assetId ? getHardwareAsset(assetId) : undefined), [assetId])
  const views = useMemo(() => assetViews(asset), [asset])
  const ops = useMemo(() => item.machining ?? [], [item.machining])
  const part = ui.part ?? machiningParts(ops)[0] ?? "top"
  const viewName = ui.view ?? views[0]?.name ?? "none"
  const view = views.find((v) => v.name === viewName) ?? null
  const bbox = item.imported?.bbox
  if (!ops.length && !views.length) return null
  return (
    <Stack gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} data-testid="machining-stage">
      <Stack gap={0}>
        <Text fontSize="sm" fontWeight="semibold">
          Mecanitzats a mà · {partKindOf(part).label}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {ops.filter((o) => o.part === part).length} a aquesta peça · {ops.length} en total
          {bbox ? ` · model de ${n(bbox.max[0] - bbox.min[0])} × ${n(bbox.max[1] - bbox.min[1])} × ${n(bbox.max[2] - bbox.min[2])} mm (u · v · n)` : ""}
        </Text>
      </Stack>
      <MachiningDrawing part={part} ops={ops.filter((o) => o.part === part)} sel={ui.sel} view={view} rot={ui.rot} mirror={ui.mirror} onSelect={(id) => patch({ sel: id })} onPick={(op) => onChange(setMachining(item, ops.map((o) => (o.id === op.id ? op : o))))} />
      {views.length > 0 && (
        <HStack gap={3} wrap="wrap">
          <ChoiceChips label="Vista de fons" value={viewName} options={[{ id: "none", label: "Sense vista" }, ...views.map((v) => ({ id: v.name, label: `Vista ${VIEW_LABEL[v.name].toLowerCase()}` }))]} onChange={(v) => patch({ view: v })} />
          {view && (
            <>
              <ChoiceChips label="Gir de la vista" value={String(ui.rot)} options={(["0", "90", "180", "270"] as const).map((x) => ({ id: x, label: `${x}°` }))} onChange={(x) => patch({ rot: Number(x) as 0 | 90 | 180 | 270 })} />
              <Switch.Root size="sm" checked={ui.mirror} onCheckedChange={(e) => patch({ mirror: e.checked })}>
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label fontSize="sm">Mirall</Switch.Label>
              </Switch.Root>
            </>
          )}
        </HStack>
      )}
    </Stack>
  )
}

/** Peça d'exemple amb les operacions (Q amunt), el punt de referència i la vista de fons; clic = posar l'operació triada. */
function MachiningDrawing({ part, ops, sel, view, rot, mirror, onSelect, onPick }: { part: PartKind; ops: GenOp[]; sel: string | null; view: HardwareView | null; rot: 0 | 90 | 180 | 270; mirror: boolean; onSelect: (id: string | null) => void; onPick: (op: GenOp) => void }) {
  const size = SAMPLE[part]
  const ref: [number, number] = [size[0] / 2, size[1] / 2]
  const lines = useMemo(() => (view ? placeLines(view, rot, mirror, [size[0] / 2, size[1] / 2]) : []), [view, rot, mirror, size])
  const snaps = useMemo(() => snapPoints(lines), [lines])
  const [hover, setHover] = useState<[number, number] | null>(null)
  const pad = Math.max(size[0], size[1]) * 0.08
  const vb = { x: -pad, y: -size[1] - pad, w: size[0] + 2 * pad, h: size[1] + 2 * pad }
  const stroke = Math.max(vb.w, vb.h) / 400
  const names = axisNames(part)
  const toPlane = (e: ReactPointerEvent<SVGSVGElement>): [number, number] | null => {
    const svg = e.currentTarget
    const m = svg.getScreenCTM()
    if (!m) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return snapTo([pt.x, -pt.y], snaps, Math.max(size[0], size[1]) * 0.012)
  }
  const selected = ops.find((o) => o.id === sel)
  const place = (p: [number, number]) => {
    if (!selected) return
    const setPos = (pos: Pos, x: number, s: number, r: number): Pos => ({ ...pos, at: atFor(pos, x, s, r) })
    onPick({ ...selected, p: setPos(selected.p, p[0], size[0], ref[0]), q: setPos(selected.q, p[1], size[1], ref[1]) })
  }
  const shape = (o: GenOp) => opShape(o, size, ref)
  return (
    <Stack gap={1}>
      <Box asChild w="full" maxH="420px" style={{ aspectRatio: `${vb.w} / ${vb.h}` }} rounded="md" borderWidth="1px" bg="bg.subtle" cursor={selected ? "crosshair" : "default"}>
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          data-testid="machining-drawing"
          onPointerMove={(e) => setHover(toPlane(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const p = toPlane(e as unknown as ReactPointerEvent<SVGSVGElement>)
            if (p) place(p)
          }}
        >
          <g transform="scale(1 -1)">
            <rect x={0} y={0} width={size[0]} height={size[1]} fill="var(--chakra-colors-bg)" stroke="var(--chakra-colors-fg-muted)" strokeWidth={stroke * 1.5} />
            {lines.map((l, i) => (
              <polyline key={`v${i}`} points={l.map((v, k) => (k % 2 ? `${v} ` : `${v},`)).join("")} fill="none" stroke="var(--chakra-colors-fg-subtle)" strokeWidth={stroke} />
            ))}
            {ops.map((o) => {
              const s = shape(o)
              return s ? <ShapeMark key={o.id} s={s} on={o.id === sel} stroke={stroke} onClick={() => onSelect(o.id)} /> : null
            })}
            <g stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 1.5}>
              <line x1={ref[0] - pad / 2} y1={ref[1]} x2={ref[0] + pad / 2} y2={ref[1]} />
              <line x1={ref[0]} y1={ref[1] - pad / 2} x2={ref[0]} y2={ref[1] + pad / 2} />
            </g>
            {hover && selected && <circle cx={hover[0]} cy={hover[1]} r={stroke * 4} fill="var(--chakra-colors-wood-solid)" />}
          </g>
          <g fontSize={pad * 0.32} fill="var(--chakra-colors-fg-muted)">
            <text x={0} y={-size[1] - pad * 0.3} style={{ fontSize: pad * 0.32 }}>
              {names.q.ends[1]} ↑
            </text>
            <text x={size[0]} y={pad * 0.6} textAnchor="end" style={{ fontSize: pad * 0.32 }}>
              {names.p.ends[1]} →
            </text>
            <text x={0} y={pad * 0.6} style={{ fontSize: pad * 0.32 }}>
              {names.p.ends[0]}
            </text>
          </g>
        </svg>
      </Box>
      <Text fontSize="xs" color="fg.muted" data-testid="machining-hover">
        Peça d'exemple de {size[0]} × {size[1]} mm ({names.p.name.toLowerCase()} × {names.q.name.toLowerCase()}), {VIEW_FROM[partKindOf(part).normal ?? "z"]}; la creu
        és el punt de referència. Cara B, discontinu. {hover ? `Punter: ${names.p.name} ${n(hover[0] - ref[0])} · ${names.q.name} ${n(hover[1] - ref[1])} des de la referència. ` : ""}
        {selected ? "Clic per posar-hi el mecanitzat triat." : "Tria un mecanitzat (al dibuix o a la llista) per posar-lo amb un clic."}
      </Text>
    </Stack>
  )
}

function ShapeMark({ s, on, stroke, onClick }: { s: Shape; on: boolean; stroke: number; onClick: () => void }) {
  const color = on ? "var(--chakra-colors-wood-solid)" : "var(--chakra-colors-fg)"
  const fill = s.kind !== "edge" && s.through ? "none" : on ? "var(--chakra-colors-wood-muted)" : "var(--chakra-colors-fg-subtle)"
  const dash = s.kind !== "edge" && s.faceB ? `${stroke * 4} ${stroke * 3}` : undefined
  const common = { stroke: color, strokeWidth: stroke * (on ? 2.5 : 1.5), fill, strokeDasharray: dash, onClick: (e: React.MouseEvent) => (e.stopPropagation(), onClick()), style: { cursor: "pointer" } }
  if (s.kind === "circle") return <circle cx={s.cx} cy={s.cy} r={Math.max(s.r, stroke * 2.5)} {...common} />
  if (s.kind === "rect") return <rect x={s.x0} y={s.y0} width={Math.max(s.x1 - s.x0, stroke)} height={Math.max(s.y1 - s.y0, stroke)} {...common} />
  if (s.kind === "poly") return <polygon points={s.pts.map(([x, y]) => `${x},${y}`).join(" ")} {...common} />
  // Forat de cantell: el canal que entra a la peça des del cantell, discontinu.
  const [x0, y0] = [s.cx, s.cy]
  const [x1, y1] = [s.cx + s.dx * s.depth, s.cy + s.dy * s.depth]
  const w = s.dx !== 0 ? 0 : s.r
  const h = s.dy !== 0 ? 0 : s.r
  return <rect x={Math.min(x0, x1) - w} y={Math.min(y0, y1) - h} width={Math.abs(x1 - x0) + 2 * w} height={Math.abs(y1 - y0) + 2 * h} {...common} fill="none" strokeDasharray={`${stroke * 4} ${stroke * 3}`} />
}

function PosRow({ label, ends, pos, onChange, help }: { label: string; ends: [string, string]; pos: Pos; onChange: (p: Pos) => void; help?: string }) {
  return (
    <FormRow label={label} help={help}>
      <Stack gap={1.5}>
        <ChoiceChips
          label={label}
          value={pos.from}
          options={[
            { id: "ref", label: "Referència" },
            { id: "min", label: `Des de ${ends[0] === "esquerra" ? "l'esquerra" : ends[0] === "darrere" ? "darrere" : ends[0]}` },
            { id: "max", label: `Des de ${ends[1] === "dreta" ? "la dreta" : ends[1]}` },
            { id: "center", label: "Mig" },
          ]}
          onChange={(from) => onChange({ ...pos, from })}
        />
        <Box maxW="160px">
          <NumberField label="" ariaLabel={`${label}: distància`} value={pos.at} min={-5000} max={5000} step={0.5} onChange={(at) => Number.isFinite(at) && onChange({ ...pos, at })} />
        </Box>
      </Stack>
    </FormRow>
  )
}

function OpEditor({ n: num, op, tools, selected, problems, onSelect, onChange, onDelete }: { n: number; op: GenOp; tools: GenTool[]; selected: boolean; problems: string[]; onSelect: () => void; onChange: (op: GenOp) => void; onDelete: () => void }) {
  const names = axisNames(op.part)
  const [ptsText, setPtsText] = useState(pointsText(op.points ?? []))
  const fit = tools.filter((t) => (op.kind === "drill" ? t.kind === "drill" : t.kind === "router"))
  const setNum = (key: "d" | "depth" | "w" | "h" | "len" | "r", v: number) => {
    if (!Number.isFinite(v)) return
    const next = { ...op, [key]: v } as GenOp
    // Una mida diferent de la de l'eina en treu l'eina.
    if (op.tool && ((key === "d" && op.kind === "drill") || (key === "w" && op.kind === "groove"))) delete next.tool
    onChange(next)
  }
  const flag = (key: "through" | "full", v: boolean) => {
    const { [key]: _old, ...rest } = op
    onChange(v ? ({ ...rest, [key]: true } as GenOp) : (rest as GenOp))
  }
  return (
    <Box borderWidth="1px" borderColor={selected ? "wood.solid" : "border.muted"} rounded="md" p={2} data-testid={`machining-op-${num}`}>
      <HStack justify="space-between" gap={2} mb={selected ? 2 : 0}>
        <Button variant="plain" size="sm" px={0} minW={0} flex={1} justifyContent="flex-start" onClick={onSelect} aria-expanded={selected}>
          <Text as="span" truncate fontWeight="medium">
            {num}. {genOpText(op)}
          </Text>
        </Button>
        <IconButton aria-label={`Treure el mecanitzat ${num}`} title="Treure" size="2xs" variant="ghost" colorPalette="red" onClick={onDelete}>
          <LuTrash2 />
        </IconButton>
      </HStack>
      {problems.map((p, i) => (
        <Text key={i} fontSize="xs" color="red.fg">
          {p}
        </Text>
      ))}
      {selected && (
        <Stack gap={0}>
          <FormRow label="Què és">
            <ChoiceChips label="Què és" value={op.kind} options={GEN_OP_KINDS.map((k) => ({ id: k.id, label: k.label }))} onChange={(k) => onChange(withKind(op, k))} />
          </FormRow>
          <FormRow label="Cara" help={op.part === "part" ? "Cara A o B de la peça lliure, o un cantell (només forats)." : "A = la cara de dins del moble (la que mecanitza la CNC: sota a la tapa, dalt a la base, dins als laterals i a les portes, davant al fons). Al cantell, només forats."}>
            <ChoiceChips
              label="Cara"
              value={op.face}
              options={[{ id: "A", label: "A" }, { id: "B", label: "B" }, ...(op.kind === "drill" ? [{ id: "edge" as const, label: "Cantell" }] : [])]}
              onChange={(face) => {
                const { edge: _e, through: _t, ...rest } = op
                onChange(face === "edge" ? { ...rest, face, edge: op.edge ?? "pmax" } : { ...rest, face, ...(op.through ? { through: true } : {}) })
              }}
            />
          </FormRow>
          {op.face === "edge" && (
            <FormRow label="Cantell">
              <ChoiceChips label="Cantell" value={op.edge ?? "pmax"} options={(["pmin", "pmax", "qmin", "qmax"] as EdgeRef[]).map((e) => ({ id: e, label: edgeLabel(op.part, e) }))} onChange={(edge) => onChange({ ...op, edge })} />
            </FormRow>
          )}
          {!(op.face === "edge" && op.edge?.startsWith("p")) && !(op.kind === "groove" && op.full && op.along === "p") && (
            <PosRow label={names.p.name} ends={names.p.ends} pos={op.p} onChange={(p) => onChange({ ...op, p })} help="Del centre del mecanitzat." />
          )}
          {!(op.face === "edge" && op.edge?.startsWith("q")) && !(op.kind === "groove" && op.full && op.along === "q") && (
            <PosRow label={names.q.name} ends={names.q.ends} pos={op.q} onChange={(q) => onChange({ ...op, q })} help="Del centre del mecanitzat." />
          )}
          {op.kind === "groove" && (
            <>
              <FormRow label="Al llarg de">
                <ChoiceChips label="Al llarg de" value={op.along ?? "p"} options={[{ id: "p", label: names.p.name }, { id: "q", label: names.q.name }]} onChange={(along) => onChange({ ...op, along })} />
              </FormRow>
              <FormRow label="Llargada">
                <Stack gap={1.5}>
                  <Switch.Root size="sm" checked={!!op.full} onCheckedChange={(e) => flag("full", e.checked)}>
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label fontSize="sm">De cantell a cantell</Switch.Label>
                  </Switch.Root>
                  {!op.full && (
                    <Box maxW="160px">
                      <NumberField label="" ariaLabel="Llargada de la ranura" value={op.len ?? NaN} min={1} max={3000} step={1} onChange={(v) => setNum("len", v)} />
                    </Box>
                  )}
                </Stack>
              </FormRow>
            </>
          )}
          <FormRow label="Mides">
            <HStack gap={2} wrap="wrap" align="flex-end">
              {op.kind === "drill" && (
                <Box w="110px">
                  <NumberField label="Ø" ariaLabel="Diàmetre" value={op.d ?? NaN} min={1} max={100} step={0.5} onChange={(v) => setNum("d", v)} />
                </Box>
              )}
              {op.kind === "groove" && (
                <Box w="110px">
                  <NumberField label="Amplada" ariaLabel="Amplada" value={op.w ?? NaN} min={1} max={200} step={0.5} onChange={(v) => setNum("w", v)} />
                </Box>
              )}
              {op.kind === "pocket" && (
                <>
                  <Box w="110px">
                    <NumberField label={names.p.name} ariaLabel="Mida al llarg" value={op.w ?? NaN} min={1} max={2000} step={0.5} onChange={(v) => setNum("w", v)} />
                  </Box>
                  <Box w="110px">
                    <NumberField label={names.q.name} ariaLabel="Mida a través" value={op.h ?? NaN} min={1} max={2000} step={0.5} onChange={(v) => setNum("h", v)} />
                  </Box>
                  <Box w="110px">
                    <NumberField label="Radi" ariaLabel="Radi de les cantonades" value={op.r ?? 0} min={0} max={500} step={0.5} onChange={(v) => setNum("r", v)} />
                  </Box>
                </>
              )}
              {!op.through && (
                <Box w="110px">
                  <NumberField label="Fondària" ariaLabel="Fondària" value={op.depth} min={0.5} max={100} step={0.5} onChange={(v) => setNum("depth", v)} />
                </Box>
              )}
            </HStack>
          </FormRow>
          {op.face !== "edge" && (
            <FormRow label="Passant" help="Travessa tot el gruix (al taller, un tall).">
              <Switch.Root size="sm" pt="6px" checked={!!op.through} onCheckedChange={(e) => flag("through", e.checked)}>
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
            </FormRow>
          )}
          {op.kind === "contour" && (
            <FormRow label="Punts" help="Un per línia, «x, y» en mm des del centre (la posició de dalt); es tanca sol. Si no és passant, ha de ser un rectangle.">
              <Textarea
                size="sm"
                rows={5}
                fontFamily="mono"
                value={ptsText}
                onChange={(e) => setPtsText(e.target.value)}
                onBlur={() => {
                  const pts = parsePoints(ptsText)
                  if (pts) onChange({ ...op, points: pts })
                  else setPtsText(pointsText(op.points ?? []))
                }}
              />
            </FormRow>
          )}
          <FormRow label="Eina" help={fit.length ? "De la màquina per defecte: dona el Ø (broca) o l'amplada (fresa de ranura) i en comprova la fondària útil." : "Importa la màquina a Preferències › Màquines CNC per triar-ne l'eina."}>
            <ChoiceChips
              label="Eina"
              value={op.tool ?? "none"}
              options={[{ id: "none", label: "Cap" }, ...fit.map((t) => ({ id: t.code, label: t.label ?? t.code }))]}
              onChange={(code) => {
                const { tool: _t, ...rest } = op
                if (code === "none") return onChange(rest as GenOp)
                const t = fit.find((x) => x.code === code)!
                if (op.kind === "drill") onChange({ ...rest, tool: code, d: t.diameter })
                else if (op.kind === "groove") onChange({ ...rest, tool: code, w: t.diameter })
                else if (op.kind === "pocket") onChange({ ...rest, tool: code, r: Math.max(op.r ?? 0, t.diameter / 2) })
                else onChange({ ...rest, tool: code })
              }}
            />
          </FormRow>
        </Stack>
      )}
    </Box>
  )
}
