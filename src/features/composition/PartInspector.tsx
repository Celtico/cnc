import { Badge, Button, Field, HStack, IconButton, Menu, NativeSelect, Portal, SegmentGroup, SimpleGrid, Stack, Switch, Text } from "@chakra-ui/react"
import { useState } from "react"
import type { IconType } from "react-icons"
import {
  LuBan,
  LuCopy,
  LuEllipsis,
  LuMove,
  LuMoveDiagonal,
  LuMoveDiagonal2,
  LuMoveHorizontal,
  LuMoveVertical,
  LuPanelLeft,
  LuPencilRuler,
  LuPlus,
  LuPuzzle,
  LuRectangleHorizontal,
  LuRectangleVertical,
  LuSpline,
  LuScissors,
  LuSquare,
  LuTrash2,
  LuUngroup,
} from "react-icons/lu"
import { IconChoice, type IconOption } from "../../components/IconChoice"
import { PanelSection } from "../../components/PanelSection"
import {
  DEFAULT_JOINERY,
  insertPartCopy,
  materialByName,
  newFreePart,
  reorientPart,
  PART_AXES,
  partsBox,
  compositionKind,
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
import { NumberField } from "../editor/ParamsForm"
import { MaterialSelect } from "../settings/SettingsScreen"
import { useSettings } from "../settings/SettingsContext"
import { ProfileEditor } from "./ProfileEditor"
import { AxisLabel } from "./RefInspector"

/** Orientació d'una peça lliure: com està posada (el pla del tauler). */
export const ORIENTS: IconOption<PartOrient>[] = [
  { value: "front", label: "De cara", icon: LuRectangleVertical, hint: "De cara: dreta, mirant endavant (fons, travesser, pota de davant)" },
  { value: "side", label: "De costat", icon: LuPanelLeft, hint: "De costat: dreta, de perfil (lateral, divisor, pota de costat)" },
  { value: "flat", label: "Estirada", icon: LuRectangleHorizontal, hint: "Estirada: horitzontal (prestatge, tapa, seient)" },
]
export const ORIENT_ICON: Record<PartOrient, IconType> = { front: LuRectangleVertical, side: LuPanelLeft, flat: LuRectangleHorizontal }

const NEW_GROUP = "__new_group__"

/** Noms de les dues mides del pla segons l'orientació. */
const DIM_NAMES: Record<PartOrient, [string, string]> = { front: ["Ample", "Alt"], side: ["Fondària", "Alt"], flat: ["Ample", "Fondària"] }

const GRAIN: IconOption<"u" | "v" | "none">[] = [
  { value: "u", label: "Al llarg de l'ample", icon: LuMoveHorizontal },
  { value: "v", label: "Al llarg de l'alt", icon: LuMoveVertical },
  { value: "none", label: "Sense veta", icon: LuBan },
]

/** Menú «+» per afegir una peça lliure (davant del moble, al mig). */
export function PartAddMenu({ comp, onChange, onAdded, center }: { comp: Composition; onChange: (c: Composition) => void; onAdded?: (id: string) => void; center: { x: number; y: number; z: number } }) {
  const { settings } = useSettings()
  const base = comp.modules[0]?.carcass
  const add = (o: PartOrient) => {
    const mat = comp.parts?.at(-1)
    const p = newFreePart(o, center, mat?.material ?? (comp.kind === "lliure" ? undefined : base?.material), mat?.thickness ?? (comp.kind === "lliure" ? undefined : base?.thickness))
    // Si el material no és de les preferències, el primer de la llista.
    const known = materialByName(settings, p.material)
    const fresh = known ? { ...p, ...(known.cnc === false ? { nest: false } : {}) } : { ...p, material: settings.materials.find((m) => !m.forBacks && m.cnc !== false)?.name ?? p.material }
    onChange({ ...comp, parts: [...(comp.parts ?? []), fresh] })
    onAdded?.(p.id)
  }
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton aria-label="Afegir peça lliure" title="Afegir peça lliure" size="2xs" variant="ghost">
          <LuPlus />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {ORIENTS.map((o) => (
              <Menu.Item key={o.value} value={o.value} onClick={() => add(o.value)}>
                <o.icon /> {o.label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

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
  // Els encaixos només són del Flat-pack.
  const flatPack = compositionKind(comp) === "lliure"
  const mat = materialByName(settings, p.material)
  const mine = joints.filter((j) => j.a === id || j.b === id)
  const nameOf = (pid: string) => comp.parts?.find((x) => x.id === pid)?.name ?? "?"
  const boards = settings.materials.filter((m) => !m.forBacks)
  const pickMaterial = (name: string) => {
    const m = materialByName(settings, name)
    const t = m && m.cnc !== false && !m.thicknesses.includes(p.thickness) ? m.thicknesses.reduce((a, b) => (Math.abs(b - p.thickness) < Math.abs(a - p.thickness) ? b : a)) : p.thickness
    // Si el material no es talla a la CNC (ferro, pedra, vidre…), la peça surt del nesting.
    update({ material: name, thickness: t, nest: m?.cnc === false ? false : undefined })
  }
  return (
    <Stack gap={0}>
      <PanelSection id="part-general" title="General" icon={LuPuzzle} badge={ORIENTS.find((o) => o.value === p.orient)!.label}>
        <IconChoice label="Orientació" value={p.orient} options={ORIENTS} onChange={(o) => onChange({ ...comp, parts: (comp.parts ?? []).map((x) => (x.id === id ? reorientPart(x, o) : x)) })} />
        {/* Peça o forat (booleana), com els objectes de referència. */}
        <Field.Root>
          <Field.Label>Efecte</Field.Label>
          <SegmentGroup.Root size="sm" w="full" value={cutter ? "cut" : "part"} onValueChange={(e) => e.value && update({ effect: e.value === "cut" ? "cut" : undefined })}>
            <SegmentGroup.Indicator />
            {(
              [
                ["part", "Peça", LuSquare],
                ["cut", "Talla", LuScissors],
              ] as const
            ).map(([v, label, Icon]) => (
              <SegmentGroup.Item key={v} value={v} flex={1}>
                <SegmentGroup.ItemText>
                  <HStack gap={1.5}>
                    <Icon /> {label}
                  </HStack>
                </SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
            ))}
          </SegmentGroup.Root>
          <Field.HelperText>
            {cutter
              ? "Talla: no és una peça. Fa un forat passant, amb la seva forma, a cada peça que travessa en la direcció del seu gruix: per foradar un tauler estirat, posa-la estirada; un de cara, de cara. Surt al nesting, al DXF i al STEP de les peces tallades."
              : "Peça: un tauler de debò (nesting, DXF, STEP, CSV)."}
          </Field.HelperText>
        </Field.Root>
        {!cutter && <MaterialSelect label="Material" materials={boards} value={p.material} onChange={pickMaterial} />}
        {comp.kind !== "lliure" && comp.modules.length > 0 && (
          <Field.Root>
            <Field.Label fontSize="sm">Enganxada a</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={p.module ?? ""}
                onChange={(e) => {
                  // Es queda on és: les coordenades passen a ser relatives al mòdul nou.
                  const from = partOffset(comp, p)
                  const next = { ...p, module: e.target.value || undefined }
                  const to = partOffset(comp, next)
                  update({ module: next.module, x: p.x + from[0] - to[0], y: p.y + from[1] - to[1], z: p.z + from[2] - to[2] })
                }}
              >
                <option value="">Res (lliure al moble)</option>
                {comp.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    Mòdul «{m.name}»
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.HelperText>Enganxada a un mòdul, el segueix quan es mou (el taulell de l'illa).</Field.HelperText>
          </Field.Root>
        )}
        <Field.Root>
          <Field.Label fontSize="sm">Grup</Field.Label>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={p.group ?? ""}
              onChange={(e) => update({ group: e.target.value === NEW_GROUP ? newGroupName(comp) : e.target.value || undefined })}
            >
              <option value="">Sense grup</option>
              {partGroups(comp.parts ?? []).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value={NEW_GROUP}>+ Grup nou</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
        {!cutter && <Switch.Root size="sm" checked={p.nest !== false} onCheckedChange={(e) => update({ nest: e.checked ? undefined : false })}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>Es talla a la CNC (va al nesting)</Switch.Label>
        </Switch.Root>}
        {p.nest === false && !cutter && (
          <Text fontSize="xs" color="fg.muted">
            No és de CNC ({p.material}): es veu al 3D però no va al nesting ni als fitxers del taller. Surt a Peces, a «Elements sense nesting». Sense encaixos.
          </Text>
        )}
        {/* Ferro, pedra, vidre…: sense veta ni encaixos. */}
        {cnc && <IconChoice label="Veta" value={p.grain ?? "u"} options={GRAIN} onChange={(g) => update({ grain: g === "u" ? undefined : g })} />}
        {cnc && flatPack && (<Switch.Root size="sm" disabled={p.nest === false} checked={p.joints !== false && p.nest !== false} onCheckedChange={(e) => update({ joints: e.checked ? undefined : false })}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>Encaixos amb les altres peces</Switch.Label>
        </Switch.Root>)}
        {flatPack && p.joints !== false && p.nest !== false && (
          <Stack gap={1}>
            {mine.length === 0 ? (
              <Text fontSize="xs" color="fg.muted">
                Cap encaix: fes que toqui o que entri dins d'una altra peça lliure (d'orientació diferent).
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
      </PanelSection>
      <PanelSection id="part-size" title="Mides" icon={LuMoveDiagonal} badge={size.join(" × ")}>
        {/* Sempre ample (X), alt (Y) i fondària (Z) com la resta de l'app; la del gruix depèn de
            l'orientació. De CNC: el gruix, només els del tauler. Si no és de CNC: tot lliure. */}
        <SimpleGrid columns={3} gap={2}>
          {(["Ample", "Alt", "Fondària"] as const).map((label, a) => {
            const isT = a === ax.n
            if (isT && cnc && mat)
              return (
                <Field.Root key={label}>
                  <Field.Label fontSize="sm">{label}</Field.Label>
                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field value={String(p.thickness)} onChange={(e) => update({ thickness: Number(e.target.value) })}>
                      {!mat.thicknesses.includes(p.thickness) && <option value={p.thickness}>{p.thickness}</option>}
                      {mat.thicknesses.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Field.HelperText>Gruix del tauler</Field.HelperText>
                </Field.Root>
              )
            return (
              <NumberField
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
        </SimpleGrid>
        {!cnc && !cutter && (
          <Text fontSize="xs" color="fg.muted">
            No és de CNC: les tres mides són lliures (també el gruix).
          </Text>
        )}
      </PanelSection>
      <PanelSection id="part-shape" title="Forma" icon={LuSpline} badge={p.shape ? "A mida" : "Rectangle"}>
        <HStack gap={2}>
          <Button size="xs" variant={p.shape ? "outline" : "solid"} colorPalette="wood" onClick={() => update({ shape: undefined })}>
            <LuSquare /> Rectangle
          </Button>
          <Button size="xs" variant={p.shape ? "solid" : "outline"} colorPalette="wood" onClick={() => setEditing(true)}>
            <LuPencilRuler /> {p.shape ? "Editar la forma…" : "Forma a mida…"}
          </Button>
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          La forma s'escala a {un.toLowerCase()} × {vn.toLowerCase()}. Els encaixos es retallen sobre la forma (pestanyes, osques i mortalles).
        </Text>
      </PanelSection>
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
      <PanelSection id="part-position" title="Posició" icon={LuMove}>
        <SimpleGrid columns={3} gap={2}>
          <NumberField label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'esquerra" />} value={p.x} min={-30000} max={30000} step={1} onChange={(x) => update({ x })} />
          <NumberField label={<AxisLabel icon={LuMoveVertical} name="Alçada" axis="Y" hint="Des del terra" />} value={p.y} min={0} max={30000} step={1} onChange={(y) => update({ y })} />
          <NumberField label={<AxisLabel icon={LuMoveDiagonal2} name="Fons" axis="Z" hint="Des de la paret cap endavant" />} value={p.z} min={-30000} max={30000} step={1} onChange={(z) => update({ z })} />
        </SimpleGrid>
        <Text fontSize="xs" color="fg.muted">
          {p.module && comp.kind !== "lliure" ? `Respecte al mòdul «${comp.modules.find((m) => m.id === p.module)?.name ?? "?"}» (el segueix). ` : ""}Cantonada esquerra, de baix i del darrere. Al 3D, arrossega-la amb les fletxes (s'enganxa a les vores de les altres peces; Alt: lliure). Fletxes del teclat: 1 mm (Maj: 10); Re Pàg / Av Pàg: fons.
        </Text>
      </PanelSection>
      {flatPack && (
        <PanelSection id="part-joinery" title="Encaixos (tot el moble)" icon={LuPuzzle}>
          <PartJoineryForm comp={comp} onChange={onChange} />
        </PanelSection>
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
      <SimpleGrid columns={3} gap={2}>
        <NumberField label="Joc" value={j.clearance} min={0} max={3} step={0.05} onChange={(clearance) => set({ clearance: Math.max(0, clearance || 0) })} />
        <NumberField label="Ø fresa" value={j.tool} min={0} max={25} step={1} onChange={(tool) => set({ tool: Math.max(0, tool || 0) })} />
        <NumberField label="Pestanya" value={j.tabWidth} min={10} max={500} step={5} onChange={(tabWidth) => set({ tabWidth: Math.max(10, tabWidth || 10) })} />
      </SimpleGrid>
      <Switch.Root size="sm" checked={j.dogbones !== false} onCheckedChange={(e) => set({ dogbones: e.checked ? undefined : false })}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>Dogbones a les cantonades interiors</Switch.Label>
      </Switch.Root>
      <Text fontSize="xs" color="fg.muted">
        Joc {j.clearance} mm: encaix {fit}. Les mortalles surten el joc més amples que la pestanya. La fresa no fa cantonades vives: el dogbone (Ø fresa) les buida perquè la peça hi entri fins al fons.
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
      <PanelSection id="group-position" title="Posició del grup" icon={LuMove} badge={size.join(" × ")}>
        <SimpleGrid columns={3} gap={2}>
          <NumberField label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'esquerra" />} value={b.min[0]} min={-30000} max={30000} step={10} onChange={(x) => Number.isFinite(x) && onMove(x - b.min[0], 0, 0)} />
          <NumberField label={<AxisLabel icon={LuMoveVertical} name="Alçada" axis="Y" hint="Des del terra" />} value={b.min[1]} min={0} max={30000} step={10} onChange={(y) => Number.isFinite(y) && onMove(0, y - b.min[1], 0)} />
          <NumberField label={<AxisLabel icon={LuMoveDiagonal2} name="Fons" axis="Z" hint="Des de la paret cap endavant" />} value={b.min[2]} min={-30000} max={30000} step={10} onChange={(z) => Number.isFinite(z) && onMove(0, 0, z - b.min[2])} />
        </SimpleGrid>
        <Text fontSize="xs" color="fg.muted">
          Tot el grup es mou junt: amb les fletxes del 3D, del teclat o aquí. Al 3D, el primer clic selecciona el grup i el segon, la peça.
        </Text>
      </PanelSection>
      <PanelSection id="group-parts" title="Peces" icon={LuPuzzle} badge={members.length}>
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
      </PanelSection>
    </Stack>
  )
}
