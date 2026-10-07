import { Badge, Button, HStack, IconButton, Menu, Portal, Stack, Switch, Text } from "@chakra-ui/react"
import { segGroup, segItem } from "../../components/segmented"
import { useState } from "react"
import {
  LuBan,
  LuCopy,
  LuEllipsis,
  LuFactory,
  LuGroup,
  LuLink,
  LuMove,
  LuMoveDiagonal,
  LuMoveDiagonal2,
  LuMoveHorizontal,
  LuMoveVertical,
  LuPalette,
  LuPencilRuler,
  LuPuzzle,
  LuRectangleHorizontal,
  LuSpline,
  LuScissors,
  LuSquare,
  LuTrash2,
  LuUngroup,
} from "react-icons/lu"
import { IconChoice, type IconOption } from "../../components/IconChoice"
import { FoldItem } from "../../components/Fold"
import {
  DEFAULT_JOINERY,
  insertPartCopy,
  materialByName,
  partChoices,
  reorientPart,
  PART_AXES,
  partsBox,
  materialCategory,
  compositionKind, partJoinery, partsOnlyKind,
  partOffset,
  resolveParts,
  partGroups,
  newGroupName,
  partSize,
  type Composition,
  type FreePart,
  type Joinery,
  type PartOrient,
} from "../../core/model"
import { JOINT_LABEL, type PartJoint } from "../../core/build/freeParts"
import { NumRow } from "../../components/NumRow"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { MaterialSelect } from "../settings/MaterialSelect"
import { useSettings } from "../settings/SettingsContext"
import { ProfileEditor } from "./ProfileEditor"
import { AxisLabel } from "./RefInspector"
import { ORIENT_ICON, ORIENTS } from "./partOrient"
import { moduleChips } from "./moduleChips"

/** Orientació d'una peça lliure: com està posada (el pla del tauler). */

const NEW_GROUP = "__new_group__"

/** Noms de les dues mides del pla segons l'orientació. */
const DIM_NAMES: Record<PartOrient, [string, string]> = { front: ["Ample", "Alt"], side: ["Fondària", "Alt"], flat: ["Ample", "Fondària"] }

const GRAIN: IconOption<"u" | "v" | "none">[] = [
  { value: "u", label: "Al llarg de l'ample", icon: LuMoveHorizontal },
  { value: "v", label: "Al llarg de l'alt", icon: LuMoveVertical },
  { value: "none", label: "Sense veta", icon: LuBan },
]

/** Propietats d'una peça lliure: orientació, material, mides, forma, posició i encaixos. */
export function PartInspector({ comp, id, joints, onChange }: { comp: Composition; id: string; joints: PartJoint[]; onChange: (c: Composition) => void }) {
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
  const groupLabel = p.group ?? "Sense grup"
  const attachable = !partsOnlyKind(compositionKind(comp)) && comp.modules.length > 0
  const attachedTo = p.module ? (comp.modules.find((m) => m.id === p.module)?.name ?? "?") : "Res"
  // Cada apartat, una secció pròpia (sense «General»); el que no toca, no surt.
  return (
    <Stack gap={0}>
      {/* Peça o forat (booleana), com els objectes de referència. */}
      <FoldItem id="part-effect" title="Efecte" icon={cutter ? LuScissors : LuPuzzle} badge={cutter ? "Talla" : "Peça"}>
        <FormRow
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
            onChange={(v) => update({ effect: v === "cut" ? "cut" : undefined })}
          />
        </FormRow>
      </FoldItem>
      <FoldItem id="part-orient" title="Orientació" icon={ORIENT_ICON[p.orient]} badge={ORIENTS.find((o) => o.value === p.orient)!.label}>
        <FormRow label="Orientació">
          <IconChoice label="Orientació" hideLabel value={p.orient} options={ORIENTS} onChange={(o) => onChange({ ...comp, parts: (comp.parts ?? []).map((x) => (x.id === id ? reorientPart(x, o) : x)) })} />
        </FormRow>
      </FoldItem>
      <FoldItem id="part-size" title="Mides" icon={LuMoveDiagonal} badge={size.join(" × ")}>
        {/* Sempre ample (X), alt (Y) i fondària (Z) com la resta de l'app; la del gruix depèn de
            l'orientació. De CNC: el gruix, només els del tauler. Si no és de CNC: tot lliure. */}
        {(["Ample", "Alt", "Fondària"] as const).map((label, a) => {
            const isT = a === ax.n
            if (isT && cnc && mat)
              return (
                <FormRow key={label} label={label} help="Gruix del tauler">
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
        <FoldItem id="part-material" title="Material" icon={LuPalette} badge={p.material}>
          <FormRow label="Material" maxW="280px">
            <MaterialSelect label="Material" hideLabel materials={boards} value={p.material} onChange={pickMaterial} />
          </FormRow>
          {/* La veta és del tauler. Ferro, pedra, vidre…: sense veta. */}
          {cnc && (
            <FormRow label="Veta">
              <IconChoice label="Veta" hideLabel value={p.grain ?? "u"} options={GRAIN} onChange={(g) => update({ grain: g === "u" ? undefined : g })} />
            </FormRow>
          )}
        </FoldItem>
      )}
      <FoldItem id="part-shape" title="Forma" icon={p.shape ? LuSpline : LuRectangleHorizontal} badge={p.shape ? "A mida" : "Rectangle"}>
        <FormRow label="Forma" help={`La forma s'escala a ${un.toLowerCase()} × ${vn.toLowerCase()}. Els encaixos es retallen sobre la forma (pestanyes, osques i mortalles).`}>
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
        <FoldItem id="part-cnc" title="CNC" icon={LuFactory} badge={p.nest === false ? "No" : "Sí"} badgePalette={p.nest === false ? "gray" : "wood"}>
          <FormRow label="CNC" help={p.nest === false ? `No és de CNC (${p.material}): es veu al 3D però no va al nesting ni als fitxers del taller. Surt a Peces, a «Elements sense nesting». Sense encaixos.` : undefined}>
            <Switch.Root size="sm" pt="6px" checked={p.nest !== false} onCheckedChange={(e) => update({ nest: e.checked ? undefined : false })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Es talla a la CNC (va al nesting)</Switch.Label>
            </Switch.Root>
          </FormRow>
          {/* El cantell és de fabricació (cantejadora). */}
          {cnc && (
            <FormRow label="Cantell">
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
        <FoldItem id="part-joints" title="Encaixos" icon={LuPuzzle} badge={joins ? mine.length : "No"} badgePalette={joins ? "wood" : "gray"}>
          <FormRow
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
      <FoldItem id="part-group" title="Grup" icon={LuGroup} badge={groupLabel} badgePalette={p.group ? "wood" : "gray"}>
        <FormRow label="Grup">
          <ChoiceChips
            label="Grup"
            options={[{ id: "", label: "Sense grup" }, ...partGroups(comp.parts ?? []).map((g) => ({ id: g, label: g })), { id: NEW_GROUP, label: "+ Grup nou" }]}
            value={p.group ?? ""}
            onChange={(v) => update({ group: v === NEW_GROUP ? newGroupName(comp) : v || undefined })}
          />
        </FormRow>
      </FoldItem>
      {attachable && (
        <FoldItem id="part-attach" title="Enganxada" icon={LuLink} badge={attachedTo} badgePalette={p.module ? "wood" : "gray"}>
          <FormRow label="Enganxada a" help="«Res»: lliure al moble. Enganxada a un mòdul, el segueix quan es mou (el taulell de l'illa).">
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
      <FoldItem id="part-position" title="Posició" icon={LuMove}>
        <NumRow label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'esquerra" />} ariaLabel="De costat (X)" value={p.x} min={-30000} max={30000} step={1} onChange={(x) => update({ x })} />
        <NumRow label={<AxisLabel icon={LuMoveVertical} name="Alçada" axis="Y" hint="Des del terra" />} ariaLabel="Alçada (Y)" value={p.y} min={0} max={30000} step={1} onChange={(y) => update({ y })} />
        <NumRow label={<AxisLabel icon={LuMoveDiagonal2} name="Fondària" axis="Z" hint="Des de la paret cap endavant" />} ariaLabel="Fondària (Z)" value={p.z} min={-30000} max={30000} step={1} onChange={(z) => update({ z })} />
        <Text fontSize="xs" color="fg.muted">
          {p.module && !partsOnlyKind(compositionKind(comp)) ? `Respecte al mòdul «${comp.modules.find((m) => m.id === p.module)?.name ?? "?"}» (el segueix). ` : ""}Cantonada esquerra, de baix i del darrere. Al 3D, arrossega-la amb les fletxes (s'enganxa a les vores de les altres peces; Alt: lliure). Fletxes del teclat: 1 mm (Maj: 10); Re Pàg / Av Pàg: fons.
        </Text>
      </FoldItem>
      {cnc && joins && (
        <FoldItem id="part-joinery" title="Encaixos (tot el moble)" icon={LuPuzzle}>
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
      <NumRow label="Joc" value={j.clearance} min={0} max={3} step={0.05} onChange={(clearance) => set({ clearance: Math.max(0, clearance || 0) })} />
      <NumRow label="Diàmetre fresa (Ø)" value={j.tool} min={0} max={25} step={1} onChange={(tool) => set({ tool: Math.max(0, tool || 0) })} />
      <NumRow label="Pestanya" value={j.tabWidth} min={10} max={500} step={5} onChange={(tabWidth) => set({ tabWidth: Math.max(10, tabWidth || 10) })} />
      <FormRow label="Dogbones">
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
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label="Accions de la peça">
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
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
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/** Grup de peces lliures: posició de tot el grup (es mouen juntes), peces i accions. */
export function GroupInspector({ comp, group, onChange, onSelectPart, onMove }: { comp: Composition; group: string; onChange: (c: Composition) => void; onSelectPart: (id: string) => void; onMove: (dx: number, dy: number, dz: number) => void }) {
  const members = (comp.parts ?? []).filter((p) => p.group === group)
  if (!members.length) return null
  // Posició a la composició (les enganxades a un mòdul, sumant-hi la seva).
  const b = partsBox(resolveParts(comp).filter((p) => p.group === group))
  const size = [0, 1, 2].map((a) => Math.round(b.max[a]! - b.min[a]!))
  return (
    <Stack gap={0}>
      <FoldItem id="group-position" title="Posició del grup" icon={LuMove} badge={size.join(" × ")}>
        <NumRow label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'esquerra" />} ariaLabel="De costat (X)" value={b.min[0]} min={-30000} max={30000} step={10} onChange={(x) => Number.isFinite(x) && onMove(x - b.min[0], 0, 0)} />
        <NumRow label={<AxisLabel icon={LuMoveVertical} name="Alçada" axis="Y" hint="Des del terra" />} ariaLabel="Alçada (Y)" value={b.min[1]} min={0} max={30000} step={10} onChange={(y) => Number.isFinite(y) && onMove(0, y - b.min[1], 0)} />
        <NumRow label={<AxisLabel icon={LuMoveDiagonal2} name="Fondària" axis="Z" hint="Des de la paret cap endavant" />} ariaLabel="Fondària (Z)" value={b.min[2]} min={-30000} max={30000} step={10} onChange={(z) => Number.isFinite(z) && onMove(0, 0, z - b.min[2])} />
        <Text fontSize="xs" color="fg.muted">
          Tot el grup es mou junt: amb les fletxes del 3D, del teclat o aquí. Al 3D, el primer clic selecciona el grup i el segon, la peça.
        </Text>
      </FoldItem>
      <FoldItem id="group-parts" title="Peces" icon={LuPuzzle} badge={members.length}>
        <Stack gap={0.5}>
          {members.map((p) => {
            const Icon = ORIENT_ICON[p.orient]
            return (
              <Button key={p.id} size="xs" variant="ghost" justifyContent="flex-start" onClick={() => onSelectPart(p.id)}>
                <Icon /> {p.name}
                <Text as="span" color="fg.muted" ms="auto">
                  {p.w} × {p.h}
                </Text>
              </Button>
            )
          })}
        </Stack>
        <HStack gap={2}>
          <Button size="xs" variant="outline" onClick={() => onChange({ ...comp, parts: (comp.parts ?? []).map((q) => (q.group === group ? { ...q, group: undefined } : q)) })}>
            <LuUngroup /> Desagrupar
          </Button>
        </HStack>
      </FoldItem>
    </Stack>
  )
}
