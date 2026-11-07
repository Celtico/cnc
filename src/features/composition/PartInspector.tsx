import { Badge, Button, HStack, IconButton, Menu, Stack, Switch, Text } from "@chakra-ui/react"
import { segGroup, segItem } from "../../components/segmented"
import { useState } from "react"
import {
  LuBan,
  LuCopy,
  LuFactory,
  LuGroup,
  LuListChecks,
  LuLink,
  LuMove,
  LuMoveDiagonal,
  LuMoveDiagonal2,
  LuMoveHorizontal,
  LuMoveVertical,
  LuPalette,
  LuPencilRuler,
  LuPuzzle,
  LuBox,
  LuScan,
  LuRectangleHorizontal,
  LuSpline,
  LuScissors,
  LuSquare,
  LuTrash2,
  LuSprout,
  LuAlignCenterHorizontal,
  LuAlignCenterVertical,
  LuAlignEndHorizontal,
  LuAlignEndVertical,
  LuAlignHorizontalDistributeCenter,
  LuAlignStartHorizontal,
  LuAlignStartVertical,
  LuAlignVerticalDistributeCenter,
  LuAlignHorizontalSpaceAround,
  LuAlignVerticalSpaceAround,
} from "react-icons/lu"
import { Tooltip } from "../../components/ui/tooltip"
import { IconChoice, type IconOption } from "../../components/IconChoice"
import { FoldItem } from "../../components/Fold"
import {
  DEFAULT_JOINERY,
  insertPartCopy,
  materialByName,
  mobleBody,
  partChoices,
  reorientPart,
  PART_AXES,
  materialCategory,
  compositionKind, partJoinery, partsOnlyKind,
  partOffset,
  groupNames,
  newGroupName,
  partSize,
  multiBox,
  groupMulti,
  ungroupMulti,
  alignMulti,
  distributeMulti,
  spaceMulti,
  setMultiMaterial,
  setMultiRot,
  setMultiSize,
  type Composition,
  type MultiItem,
  type FreePart,
  type Joinery,
  type PartOrient,
  type Panel,
  SIDE_NAMES,
} from "../../core/model"
import { JOINT_LABEL, type PartJoint } from "../../core/build/freeParts"
import { NumRow } from "../../components/NumRow"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { MaterialSelect } from "../settings/MaterialSelect"
import { useSettings } from "../settings/SettingsContext"
import { ProfileEditor } from "./ProfileEditor"
import { AxisLabel } from "../../components/AxisLabel"
import { ORIENT_ICON, ORIENTS } from "./partOrient"
import { moduleChips } from "./moduleChips"
import { ActionsMenu } from "../../components/ActionsMenu"

/** Orientació d'una peça lliure: com està posada (el pla del tauler). */

const NEW_GROUP = "__new_group__"

/** Noms de les dues mides del pla segons l'orientació. */
const DIM_NAMES: Record<PartOrient, [string, string]> = { front: ["Amplada", "Alçada"], side: ["Fondària", "Alçada"], flat: ["Amplada", "Fondària"] }

const GRAIN: IconOption<"u" | "v" | "none">[] = [
  { value: "u", label: "Al llarg de l'ample", icon: LuMoveHorizontal },
  { value: "v", label: "Al llarg de l'alt", icon: LuMoveVertical },
  { value: "none", label: "Sense veta", icon: LuBan },
]

/** Propietats d'una peça lliure: orientació, material, mides, forma, posició i encaixos. */
export function PartInspector({ comp, id, joints, panels, onChange }: { comp: Composition; id: string; joints: PartJoint[]; panels?: Panel[]; onChange: (c: Composition) => void }) {
  const { settings } = useSettings()
  const [editing, setEditing] = useState(false)
  const p = comp.parts?.find((x) => x.id === id)
  if (!p) return null
  const update = (patch: Partial<FreePart>) => onChange({ ...comp, parts: (comp.parts ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const [un, vn] = DIM_NAMES[p.orient]
  const ax = PART_AXES[p.orient]
  const size = partSize(p)
  const cutter = p.effect === "cut"
  const cnc = p.nest !== false && !cutter
  // Objecte (ambients): les peces només es veuen.
  const object = compositionKind(comp) === "objecte"
  // Flat-pack = «Encaixos» de la peça (opció expressa, a qualsevol moble que es fabrica).
  const joins = partJoinery(comp, p)
  const mat = materialByName(settings, p.material)
  const mine = joints.filter((j) => j.a === id || j.b === id)
  const nameOf = (pid: string) => comp.parts?.find((x) => x.id === pid)?.name ?? "?"
  // Tot menys els fons: ferro, pedra i vidre surten del nesting; els de simulació, per als objectes (`partChoices`).
  const boards = partChoices(settings.materials)
  const pickMaterial = (name: string) => {
    const m = materialByName(settings, name)
    const t = m && m.cnc !== false && !m.thicknesses.includes(p.thickness) ? m.thicknesses.reduce((a, b) => (Math.abs(b - p.thickness) < Math.abs(a - p.thickness) ? b : a)) : p.thickness
    // Si el material no es talla a la CNC (ferro, pedra, vidre…), la peça surt del nesting.
    update({ material: name, thickness: object ? p.thickness : t, nest: (m && materialCategory(m) === "sim") || object ? false : undefined })
  }
  // «Com el cos» (per decisió de l'usuari, 2026-10-16): el material i el gruix del cos del mòdul on va enganxada o, si no,
  // del moble (el més repetit dels mòduls).
  const host = p.module ? comp.modules.find((m) => m.id === p.module) : undefined
  const body = host ? { material: host.carcass.material, thickness: host.carcass.thickness } : mobleBody(comp)
  const asBody = !!body && !object && p.material === body.material && p.thickness === body.thickness
  const groupLabel = p.group ?? "Sense grup"
  const attachable = !partsOnlyKind(compositionKind(comp)) && comp.modules.length > 0
  const attachedTo = p.module ? (comp.modules.find((m) => m.id === p.module)?.name ?? "?") : "Res"
  // Cada apartat, una secció pròpia (sense «General»); el que no toca, no surt.
  return (
    <Stack gap={0}>
      {/* Peça o forat (booleana), com els objectes de referència. */}
      <FoldItem optionId="part.effect" id="part-effect" title="Efecte" icon={cutter ? LuScissors : LuPuzzle} badge={cutter ? "Talla" : "Peça"}>
        <FormRow
          optionId="part.effect"
          label="Efecte"
          help={
            cutter
              ? "Talla: no és una peça. Fa un forat passant, amb la seva forma, a cada peça que travessa en la direcció del seu gruix: per foradar un tauler estirat, posa-la estirada; un de cara, de cara. Surt al nesting, al DXF i al STEP de les peces tallades."
              : object ? "Peça de l'objecte: només es veu (no es fabrica)." : "Peça: un tauler de debò (nesting, DXF, STEP, CSV)."
          }
        >
          <ChoiceChips
            label="Efecte"
            options={[
              { id: "part", label: <><LuPuzzle /> Peça</> },
              { id: "cut", label: <><LuScissors /> Talla</> },
            ]}
            value={cutter ? "cut" : "part"}
            onChange={(v) => update({ effect: v === "cut" ? "cut" : undefined, ...(v === "cut" ? {} : { round: undefined }) })}
          />
        </FormRow>
        {cutter && (
          <NumRow
            optionId="part.effect.round"
            label="Fons arrodonit"
            help="Si no travessa la peça: el buidat té el fons arrodonit amb aquest radi, com una pica (la paret recta i un quart de cercle fins al fons). 0 = de fons pla. Al programa de la CNC hi va el desbast i l'acabat en 3D."
            value={p.round ?? 0}
            min={0}
            max={500}
            step={5}
            onChange={(r) => update({ round: r > 0 ? r : undefined })}
          />
        )}
      </FoldItem>
      <FoldItem optionId="part.orient" id="part-orient" title="Orientació" icon={ORIENT_ICON[p.orient]} badge={ORIENTS.find((o) => o.value === p.orient)!.label}>
        <FormRow optionId="part.orient" label="Orientació">
          <IconChoice label="Orientació" hideLabel value={p.orient} options={ORIENTS} onChange={(o) => onChange({ ...comp, parts: (comp.parts ?? []).map((x) => (x.id === id ? reorientPart(x, o) : x)) })} />
        </FormRow>
      </FoldItem>
      <FoldItem optionId="part.size" id="part-size" title="Mides" icon={LuMoveDiagonal} badge={size.join(" × ")}>
        {/* Sempre ample (X), alt (Y) i fondària (Z) com la resta de l'app; la del gruix depèn de
            l'orientació. De CNC: el gruix, només els del tauler. Si no és de CNC: tot lliure. */}
        {(["Amplada", "Alçada", "Fondària"] as const).map((label, a) => {
            const isT = a === ax.n
            if (isT && cnc && mat)
              return (
                <FormRow key={label} optionId="part.size" label={label} help="Gruix del tauler">
                  <ChoiceChips
                    label={label}
                    options={(mat.thicknesses.includes(p.thickness) ? mat.thicknesses : [p.thickness, ...mat.thicknesses]).map((t) => ({ id: String(t), label: `${t} mm` }))}
                    value={String(p.thickness)}
                    onChange={(v) => update({ thickness: Number(v) })}
                  />
                </FormRow>
              )
            return (
              <NumRow
                key={label}
                optionId="part.size"
                label={label}
                value={size[a]!}
                min={1}
                max={10000}
                step={isT ? 1 : 10}
                help={isT ? "Gruix" : undefined}
                onChange={(v) => {
                  if (!Number.isFinite(v) || v <= 0) return
                  update(isT ? { thickness: v } : a === ax.u ? { w: v } : { h: v })
                }}
              />
            )
          })}
        {!cnc && !cutter && (
          <Text fontSize="xs" color="fg.muted">
            No és de CNC: les tres mides són lliures (també el gruix).
          </Text>
        )}
      </FoldItem>
      {!cutter && (
        <FoldItem optionId="part.material" id="part-material" title="Material" icon={LuPalette} badge={p.material}>
          <FormRow optionId="part.material" label="Material" maxW="280px">
            <MaterialSelect
              label="Material"
              hideLabel
              materials={boards}
              value={asBody ? "" : p.material}
              {...(body && !object ? { emptyLabel: `Com el cos (${body.material}, ${body.thickness} mm)` } : {})}
              onChange={(v) => (v || !body ? pickMaterial(v) : update({ material: body.material, thickness: body.thickness, nest: undefined }))}
            />
          </FormRow>
          {/* La veta és del tauler. Ferro, pedra, vidre…: sense veta. */}
          {cnc && (
            <FormRow optionId="part.material.grain" label="Veta">
              <IconChoice label="Veta" hideLabel value={p.grain ?? "u"} options={GRAIN} onChange={(g) => update({ grain: g === "u" ? undefined : g })} />
            </FormRow>
          )}
        </FoldItem>
      )}
      <FoldItem optionId="part.shape" id="part-shape" title="Forma" icon={p.shape ? LuSpline : LuRectangleHorizontal} badge={p.shape ? "A mida" : "Rectangle"}>
        <FormRow optionId="part.shape" label="Forma" help={`La forma s'escala a ${un.toLowerCase()} × ${vn.toLowerCase()}. Els encaixos es retallen sobre la forma (pestanyes, osques i mortalles).`}>
          <HStack {...segGroup}>
            <Button {...segItem(!p.shape)} px={2} onClick={() => update({ shape: undefined })}>
              <LuSquare /> Rectangle
            </Button>
            <Button {...segItem(!!p.shape)} px={2} onClick={() => setEditing(true)}>
              <LuPencilRuler /> {p.shape ? "Editar la forma…" : "Forma a mida…"}
            </Button>
          </HStack>
        </FormRow>
      </FoldItem>
      <ProfileEditor
        key={editing ? "open" : "closed"}
        open={editing}
        initial={p.shape ?? [{ x: 0, y: 0 }, { x: p.w, y: 0 }, { x: p.w, y: p.h }, { x: 0, y: p.h }]}
        axes={DIM_NAMES[p.orient]}
        onClose={() => setEditing(false)}
        onApply={({ points, w, h }) => {
          update({ shape: points, w: Math.round(w), h: Math.round(h) })
          setEditing(false)
        }}
      />
      {!cutter && (
        <FoldItem optionId="part.cnc" id="part-cnc" title="CNC" icon={LuFactory} badge={p.nest === false ? "No" : "Sí"} badgePalette={p.nest === false ? "gray" : "wood"}>
          <FormRow optionId="part.cnc" label="CNC" help={p.nest === false ? `No és de CNC (${p.material}): es veu al 3D però no va al nesting ni als fitxers del taller. Surt a Peces, a «Elements sense nesting». Sense encaixos.` : undefined}>
            <Switch.Root size="sm" pt="6px" checked={p.nest !== false} onCheckedChange={(e) => update({ nest: e.checked ? undefined : false })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Es talla a la CNC (va al nesting)</Switch.Label>
            </Switch.Root>
          </FormRow>
          {/* El cantell és de fabricació (cantejadora). */}
          {cnc && (
            <FormRow optionId="part.cnc.edge" label="Cantell">
              <Switch.Root size="sm" pt="6px" checked={!!p.edged} onCheckedChange={(e) => update({ edged: e.checked ? true : undefined })}>
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label fontSize="sm">Als quatre costats</Switch.Label>
              </Switch.Root>
            </FormRow>
          )}
        </FoldItem>
      )}
      {cnc && !object && (
        <FoldItem optionId="part.joints" id="part-joints" title="Encaixos" icon={LuPuzzle} badge={joins ? mine.length : "No"} badgePalette={joins ? "wood" : "gray"}>
          <FormRow
            optionId="part.joints"
            label="Encaixos"
            help="Flat-pack: encaix automàtic amb les altres peces lliures que també en fan (no amb els mòduls)."
          >
            <Switch.Root size="sm" pt="6px" checked={joins} onCheckedChange={(e) => update({ joinery: e.checked })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Amb les altres peces</Switch.Label>
            </Switch.Root>
          </FormRow>
          {joins && (
            <Stack gap={1}>
              {mine.length === 0 ? (
                <Text fontSize="xs" color="fg.muted">
                  Cap encaix: fes que toqui o que entri dins d'una altra peça lliure amb «Encaixos» (d'orientació diferent).
                </Text>
              ) : (
                mine.map((j, i) => {
                  const other = nameOf(j.a === id ? j.b : j.a)
                  const detail = j.kind === "tab" ? (j.into === id ? "hi entra" : j.through ? "mortalles passants" : "mortalles cegues") : j.kind === "dowel" ? (j.into === id ? "cantell" : "cara") : ""
                  return (
                    <HStack key={i} gap={2} fontSize="xs">
                      <Badge variant="subtle" colorPalette="wood">
                        {JOINT_LABEL[j.kind]}
                      </Badge>
                      <Text truncate data-truncate="">
                        amb «{other}»{detail ? ` · ${detail}` : ""}
                      </Text>
                    </HStack>
                  )
                })
              )}
            </Stack>
          )}
        </FoldItem>
      )}
      <FoldItem optionId="part.group" id="part-group" title="Grup" icon={LuGroup} badge={groupLabel} badgePalette={p.group ? "wood" : "gray"}>
        <FormRow optionId="part.group" label="Grup">
          <ChoiceChips
            label="Grup"
            options={[{ id: "", label: "Sense grup" }, ...groupNames(comp).map((g) => ({ id: g, label: g })), { id: NEW_GROUP, label: "+ Grup nou" }]}
            value={p.group ?? ""}
            onChange={(v) => update({ group: v === NEW_GROUP ? newGroupName(comp) : v || undefined })}
          />
        </FormRow>
      </FoldItem>
      {attachable && (
        <FoldItem optionId="part.attach" id="part-attach" title="Enganxada" icon={LuLink} badge={attachedTo} badgePalette={p.module ? "wood" : "gray"}>
          <FormRow optionId="part.attach" label="Enganxada a" help="«Res»: lliure al moble. Enganxada a un mòdul, el segueix quan es mou (el taulell de l'illa).">
            <ChoiceChips
              label="Enganxada a"
              options={[{ id: "", label: "Res" }, ...moduleChips(comp.modules, p.module)]}
              value={p.module ?? ""}
              onChange={(v) => {
                // Es queda on és: les coordenades passen a ser relatives al mòdul nou.
                const from = partOffset(comp, p)
                const next = { ...p, module: v || undefined }
                const to = partOffset(comp, next)
                update({ module: next.module, x: p.x + from[0] - to[0], y: p.y + from[1] - to[1], z: p.z + from[2] - to[2] })
              }}
            />
          </FormRow>
        </FoldItem>
      )}
      {(p.fit || p.dyn) && (
        <FoldItem optionId="part.link" id="part-link" title="Lligada" icon={LuLink} badge={p.fit ? "Bloc condicionat" : "Tauler dinàmic"} badgePalette="wood">
          <Text fontSize="xs" color="fg.muted">
            {p.fit ? "Omple el buit on és i es torna a ajustar si el moble canvia." : "S'enganxa a aquestes cares i es recalcula si es mouen. El desplaçament va cap a dins del tauler."}
          </Text>
          {p.fit && <NumRow optionId="part.link" label="Folgança" value={p.fit.gap ?? 0} min={0} max={50} step={0.5} onChange={(gap) => update({ fit: { gap } })} />}
          {p.dyn?.limits.map((L, i) => {
            const ref = L.panel.startsWith("part:") ? comp.parts?.find((q) => `part:${q.id}` === L.panel)?.name : panels?.find((q) => q.id === L.panel)?.label
            return (
              <NumRow
                key={i}
                optionId="part.link"
                label={`${SIDE_NAMES[L.a]![L.s]} · ${ref ?? "cara perduda"}`}
                value={L.off}
                min={-3000}
                max={3000}
                step={0.5}
                onChange={(off) => update({ dyn: { ...p.dyn!, limits: p.dyn!.limits.map((x, k) => (k === i ? { ...x, off } : x)) } })}
              />
            )
          })}
          <Button size="xs" variant="outline" alignSelf="start" onClick={() => update({ fit: undefined, dyn: undefined })}>
            Deixa-la fixa
          </Button>
        </FoldItem>
      )}
      <FoldItem optionId="part.position" id="part-position" title="Posició" icon={LuMove}>
        <NumRow optionId="part.position" label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'esquerra" />} ariaLabel="De costat (X)" value={p.x} min={-30000} max={30000} step={1} onChange={(x) => update({ x })} />
        <NumRow optionId="part.position" label={<AxisLabel icon={LuMoveVertical} name="Alçada" axis="Y" hint="Des del terra" />} ariaLabel="Alçada (Y)" value={p.y} min={0} max={30000} step={1} onChange={(y) => update({ y })} />
        <NumRow optionId="part.position" label={<AxisLabel icon={LuMoveDiagonal2} name="Fondària" axis="Z" hint="Des de la paret cap endavant" />} ariaLabel="Fondària (Z)" value={p.z} min={-30000} max={30000} step={1} onChange={(z) => update({ z })} />
        <Text fontSize="xs" color="fg.muted">
          {p.module && !partsOnlyKind(compositionKind(comp)) ? `Respecte al mòdul «${comp.modules.find((m) => m.id === p.module)?.name ?? "?"}» (el segueix). ` : ""}Cantonada esquerra, de baix i del darrere. Al 3D, arrossega-la amb les fletxes (s'enganxa a les vores de les altres peces; Alt: lliure). Fletxes del teclat: 1 mm (Maj: 10); Re Pàg / Av Pàg: fons.
        </Text>
      </FoldItem>
      {cnc && joins && (
        <FoldItem optionId="part.joinery" id="part-joinery" title="Encaixos (tot el moble)" icon={LuPuzzle}>
          <PartJoineryForm comp={comp} onChange={onChange} />
        </FoldItem>
      )}
    </Stack>
  )
}

/** Joc, fresa i pestanyes dels encaixos de totes les peces lliures. */
export function PartJoineryForm({ comp, onChange }: { comp: Composition; onChange: (c: Composition) => void }) {
  const j: Joinery = { ...DEFAULT_JOINERY, ...comp.joinery }
  const set = (patch: Partial<Joinery>) => onChange({ ...comp, joinery: { ...j, ...patch } })
  const fit = j.clearance === 0 ? "a pressió dur" : j.clearance <= 0.25 ? "a pressió" : j.clearance <= 0.5 ? "fluix (desmuntable)" : "molt fluix"
  return (
    <Stack gap={3}>
      <NumRow optionId="moble.joinery.clearance" label="Folgança" value={j.clearance} min={0} max={3} step={0.05} onChange={(clearance) => set({ clearance: Math.max(0, clearance || 0) })} />
      <NumRow optionId="moble.joinery.tool" label="Diàmetre fresa (Ø)" value={j.tool} min={0} max={25} step={1} onChange={(tool) => set({ tool: Math.max(0, tool || 0) })} />
      <NumRow optionId="moble.joinery.tabWidth" label="Pestanya" value={j.tabWidth} min={10} max={500} step={5} onChange={(tabWidth) => set({ tabWidth: Math.max(10, tabWidth || 10) })} />
      <FormRow optionId="moble.joinery.dogbones" label="Dogbones">
        <Switch.Root size="sm" pt="6px" checked={j.dogbones !== false} onCheckedChange={(e) => set({ dogbones: e.checked ? undefined : false })}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">A les cantonades interiors</Switch.Label>
        </Switch.Root>
      </FormRow>
      <Text fontSize="xs" color="fg.muted">
        Folgança {j.clearance} mm: encaix {fit}. Les mortalles surten la folgança més amples que la pestanya. La fresa no fa cantonades vives: el dogbone (Ø fresa) les buida perquè la peça hi entri fins al fons.
      </Text>
      <Text fontSize="xs" color="fg.muted">
        Com es fa cada encaix: si una peça entra dins d'una altra i hi acaba → pestanyes i mortalles (passants si la travessa); si s'encreuen → mitja fusta; si totes dues hi acaben (cantonada) → dits; si només es toquen cantell contra cara → espigues.
      </Text>
    </Stack>
  )
}

/** Accions de la peça seleccionada (capçalera de l'inspector). */
export function PartActions({ comp, id, onChange, onRemoved, onSelected }: { comp: Composition; id: string; onChange: (c: Composition) => void; onRemoved: () => void; onSelected?: (id: string) => void }) {
  const p = comp.parts?.find((x) => x.id === id)
  if (!p) return null
  return (
    <ActionsMenu label="Accions de la peça">
      <Menu.Item
        value="dup"
        onClick={() => {
          const res = insertPartCopy(comp, p)
          onChange(res.comp)
          onSelected?.(res.id)
        }}
      >
        <LuCopy /> Duplicar
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item
        value="del"
        color="fg.error"
        onClick={() => {
          onChange({ ...comp, parts: (comp.parts ?? []).filter((x) => x.id !== id) })
          onRemoved()
        }}
      >
        <LuTrash2 /> Eliminar
      </Menu.Item>
    </ActionsMenu>
  )
}

/**
 * Selecció múltiple (Maj + clic; per decisió de l'usuari, 2026-10-14): la posició de tots junts, el que hi ha (tocar-ne un
 * el tria sol) i les accions: agrupar les peces, els models i els mòduls, duplicar-ho (com ⌘D) i eliminar-ho tot.
 */
export function MultiInspector({ comp, items, onChange, onSelect, onMove, onGroup, onDuplicate, onRemove }: { comp: Composition; items: MultiItem[]; onChange: (c: Composition) => void; onSelect: (item: MultiItem) => void; onMove: (dx: number, dy: number, dz: number) => void; onGroup: () => void; onDuplicate: () => void; onRemove: () => void }) {
  const { settings } = useSettings()
  // L'espai de «Repartir amb aquest espai» (es recorda mentre l'inspector és obert).
  const [gap, setGap] = useState(0)
  const b = multiBox(comp, items)
  if (!b) return null
  // Propietats comunes (per decisió de l'usuari): el valor si tots el tenen igual; si no, «Diversos» i el que triïs va a tots.
  const objs = items.flatMap((x) => {
    // Un mòdul, amb el material i les mides del cos.
    const mod = x.kind === "module" ? comp.modules.find((m) => m.id === x.id) : undefined
    const o = mod ? { material: mod.carcass.material, w: mod.carcass.width, h: mod.carcass.height, d: mod.carcass.depth } : x.kind === "part" ? comp.parts?.find((p) => p.id === x.id) : x.kind === "model" ? comp.models?.find((m) => m.id === x.id) : comp.references.find((r) => r.id === x.id)
    return o ? [{ kind: x.kind, o }] : []
  })
  const common = <T,>(vals: T[]): T | undefined => (vals.length && vals.every((v) => v === vals[0]) ? vals[0] : undefined)
  const material = common(objs.map(({ o }) => o.material ?? ""))
  const kinds = new Set(objs.map((x) => x.kind))
  const one = kinds.size === 1 ? [...kinds][0]! : null
  // Mides: amb un sol tipus (les peces: ample, alt i gruix; els models i els objectes: ample, alt i fondària).
  const sizeOf = (key: "w" | "h" | "d") => common(objs.map(({ kind, o }) => (kind === "part" && key === "d" ? (o as FreePart).thickness : (o as { w: number; h: number; d: number })[key])))
  const rot = one === "model" ? common(objs.map(({ o }) => (o as { rot?: number }).rot ?? 0)) : undefined
  const sizeRow = (key: "w" | "h" | "d", label: string) => {
    const v = sizeOf(key)
    return <NumRow optionId="multi.size" label={label} value={v ?? 0} min={1} max={20000} step={10} help={v === undefined ? "Diversos: el valor que hi posis va a tots." : undefined} onChange={(n) => n > 0 && onChange(setMultiSize(comp, items, key, n))} />
  }
  const size = [0, 1, 2].map((a) => Math.round(b.max[a]! - b.min[a]!))
  const nameOf = (x: MultiItem) => (x.kind === "part" ? comp.parts?.find((p) => p.id === x.id)?.name : x.kind === "model" ? comp.models?.find((m) => m.id === x.id)?.name : x.kind === "module" ? comp.modules.find((m) => m.id === x.id)?.name : comp.references.find((r) => r.id === x.id)?.name) ?? "?"
  const groupable = items.length > 0
  // El grup dels mòduls és el del mòdul (no el de l'objecte de mides que se'n fa a `objs`).
  const group = common(items.map((x) => (x.kind === "module" ? comp.modules.find((m) => m.id === x.id)?.group : x.kind === "part" ? comp.parts?.find((p) => p.id === x.id)?.group : x.kind === "ref" ? comp.references.find((r) => r.id === x.id)?.group : comp.models?.find((m) => m.id === x.id)?.group) ?? ""))
  return (
    <Stack gap={0}>
      <FoldItem optionId="multi.position" id="multi-position" title="Posició" icon={LuMove} badge={size.join(" × ")}>
        <NumRow optionId="multi.position" label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'esquerra" />} ariaLabel="De costat (X)" value={b.min[0]} min={-30000} max={30000} step={10} onChange={(x) => Number.isFinite(x) && onMove(x - b.min[0], 0, 0)} />
        <NumRow optionId="multi.position" label={<AxisLabel icon={LuMoveVertical} name="Alçada" axis="Y" hint="Des del terra" />} ariaLabel="Alçada (Y)" value={b.min[1]} min={0} max={30000} step={10} onChange={(y) => Number.isFinite(y) && onMove(0, y - b.min[1], 0)} />
        <NumRow optionId="multi.position" label={<AxisLabel icon={LuMoveDiagonal2} name="Fondària" axis="Z" hint="Des de la paret cap endavant" />} ariaLabel="Fondària (Z)" value={b.min[2]} min={-30000} max={30000} step={10} onChange={(z) => Number.isFinite(z) && onMove(0, 0, z - b.min[2])} />
        <Text fontSize="xs" color="fg.muted">
          Es mouen tots junts: amb les fletxes del 3D, del teclat o aquí. Maj + clic (a l'arbre o al 3D) n'afegeix o en treu.
        </Text>
      </FoldItem>
      {/* Alinear i repartir (com Figma): respecte de la caixa de tots els triats. */}
      <FoldItem optionId="multi.align" id="multi-align" title="Alineació" icon={LuAlignCenterVertical}>
        <NumRow optionId="multi.align" label="Espai entre ells" value={gap} min={-5000} max={20000} step={5} help="Per al darrer botó de cada fila: el primer es queda i els altres es posen a aquest espai de l'anterior (0 = tocant-se)." onChange={(n) => Number.isFinite(n) && setGap(n)} />
        {([
          { axis: 0, label: "De costat (X)", opts: [["min", "A l'esquerra", LuAlignStartVertical], ["mid", "Al centre", LuAlignCenterVertical], ["max", "A la dreta", LuAlignEndVertical]] },
          { axis: 1, label: "Alçada (Y)", opts: [["min", "A baix", LuAlignEndHorizontal], ["mid", "Al mig", LuAlignCenterHorizontal], ["max", "A dalt", LuAlignStartHorizontal]] },
          { axis: 2, label: "Fondària (Z)", opts: [["min", "Al darrere", LuAlignStartVertical], ["mid", "Al mig", LuAlignCenterVertical], ["max", "Al davant", LuAlignEndVertical]] },
        ] as const).map(({ axis, label, opts }) => (
          <FormRow key={axis} optionId="multi.align" label={label}>
            <HStack gap={1}>
              {opts.map(([mode, name, Icon]) => (
                <Tooltip key={mode} content={name}>
                  <IconButton aria-label={`${label}: ${name}`} size="xs" variant="outline" onClick={() => onChange(alignMulti(comp, items, axis, mode))}>
                    <Icon />
                  </IconButton>
                </Tooltip>
              ))}
              {items.length > 2 && (
                <Tooltip content="Repartir (el mateix espai entre ells)">
                  <IconButton aria-label={`${label}: repartir`} size="xs" variant="outline" onClick={() => onChange(distributeMulti(comp, items, axis))}>
                    {axis === 1 ? <LuAlignVerticalDistributeCenter /> : <LuAlignHorizontalDistributeCenter />}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip content={`Repartir amb ${gap} mm entre ells`}>
                <IconButton aria-label={`${label}: repartir amb ${gap} mm`} size="xs" variant="outline" onClick={() => onChange(spaceMulti(comp, items, axis, gap))}>
                  {axis === 1 ? <LuAlignVerticalSpaceAround /> : <LuAlignHorizontalSpaceAround />}
                </IconButton>
              </Tooltip>
            </HStack>
          </FormRow>
        ))}
        <Text fontSize="xs" color="fg.muted">
          Respecte de la caixa de tots els triats. «Repartir», amb tres o més: el primer i l'últim es queden i els del mig es posen amb el mateix espai entre ells.
        </Text>
      </FoldItem>
      <FoldItem optionId="multi.material" id="multi-material" title="Material" icon={LuPalette} badge={material === undefined ? "Diversos" : material || "Cap"}>
        <FormRow optionId="multi.material" label="Material" help={material === undefined ? "Diversos: el material que triïs va a tots." : "El material de tots els triats."} maxW="280px">
          <MaterialSelect label="Material" hideLabel materials={partChoices(settings.materials)} value={material ?? ""} emptyLabel={material === undefined ? "Diversos" : "Cap"} onChange={(v) => v && onChange(setMultiMaterial(comp, items, v, settings.materials))} />
        </FormRow>
      </FoldItem>
      {one && (
        <FoldItem optionId="multi.size" id="multi-size" title="Mides" icon={LuMoveDiagonal}>
          {sizeRow("w", "Amplada")}
          {sizeRow("h", "Alçada")}
          {sizeRow("d", one === "part" ? "Gruix" : "Fondària")}
          {one === "model" && <NumRow optionId="multi.size" label="Gir" suffix="°" value={rot ?? 0} min={-360} max={360} step={15} help={rot === undefined ? "Diversos: el gir que hi posis va a tots." : "Al voltant del vertical, pel centre."} onChange={(n) => Number.isFinite(n) && onChange(setMultiRot(comp, items, n))} />}
        </FoldItem>
      )}
      {/* El grup de tots (com el Grup d'una peça): posar-los en un grup, en un de nou o treure'ls del seu. */}
      {groupable && (
        <FoldItem optionId="multi.group" id="multi-group" title="Grup" icon={LuGroup} badge={group === undefined ? "Diversos" : group || "Sense grup"} badgePalette={group ? "wood" : "gray"}>
          <FormRow optionId="multi.group" label="Grup" help={`${group === undefined ? "Diversos: el grup que triïs va a tots." : "El grup de tots els triats."} Drecera: ⌘G (Ctrl+G) en fa un de nou; ⇧⌘G els treu del grup.`}>
            <ChoiceChips
              label="Grup"
              options={[{ id: "", label: "Sense grup" }, ...groupNames(comp).map((g) => ({ id: g, label: g })), { id: NEW_GROUP, label: "+ Grup nou" }]}
              value={group ?? "__diversos__"}
              onChange={(v) => (v === NEW_GROUP ? onGroup() : onChange(v ? groupMulti(comp, items, v) : ungroupMulti(comp, items)))}
            />
          </FormRow>
        </FoldItem>
      )}
      <FoldItem optionId="multi.items" id="multi-items" title="Triats" icon={LuListChecks} badge={items.length}>
        <Stack gap={0.5}>
          {items.map((x) => (
            <Button key={`${x.kind}:${x.id}`} size="xs" variant="ghost" justifyContent="flex-start" onClick={() => onSelect(x)}>
              {x.kind === "part" ? <LuPuzzle /> : x.kind === "model" ? <LuSprout /> : x.kind === "module" ? <LuBox /> : <LuScan />} {nameOf(x)}
            </Button>
          ))}
        </Stack>
        <HStack gap={2}>
          <Button size="xs" variant="outline" onClick={onDuplicate}>
            <LuCopy /> Duplicar
          </Button>
          <Button size="xs" variant="outline" colorPalette="red" onClick={onRemove}>
            <LuTrash2 /> Eliminar
          </Button>
        </HStack>
      </FoldItem>
    </Stack>
  )
}
