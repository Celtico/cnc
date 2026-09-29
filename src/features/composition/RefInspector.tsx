import { Field, IconButton, Input, Menu, NativeSelect, Portal, SegmentGroup, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { LuBookmark, LuEllipsis, LuMove, LuMoveDiagonal, LuPlus, LuScan, LuTrash2 } from "react-icons/lu"
import { PanelSection } from "../../components/PanelSection"
import { toaster } from "../../components/ui/toaster"
import { canBeGhost, compositionWidth, newId, visibleReferences, type Composition, type RefObject } from "../../core/model"
import { NumberField } from "../editor/ParamsForm"
import { useSettings } from "../settings/SettingsContext"

/**
 * Objectes que tallen, preparats: travessen el fons (de z = −10 a 30) davant del moble, a
 * 300 mm del terra. Després s'arrosseguen al lloc.
 */
const CUTTERS: Omit<RefObject, "id" | "x" | "y" | "z">[] = [
  { name: "Passacables Ø60", w: 60, h: 60, d: 40, effect: "cut", shape: "cylinder", axis: "z" },
  { name: "Tub Ø110", w: 110, h: 110, d: 40, effect: "cut", shape: "cylinder", axis: "z" },
  { name: "Endoll 80 × 80", w: 80, h: 80, d: 40, effect: "cut" },
]

/** Menú «+» per afegir un objecte de referència (a mida o de les preferències). */
export function RefAddMenu({ comp, onChange, onAdded }: { comp: Composition; onChange: (c: Composition) => void; onAdded?: (id: string) => void }) {
  const { settings } = useSettings()
  const presets = visibleReferences(settings).filter(canBeGhost)
  const width = compositionWidth(comp)
  const add = (o: Omit<RefObject, "id" | "x" | "y" | "z"> & Partial<Pick<RefObject, "x" | "y" | "z">>) => {
    const id = newId("r")
    onChange({ ...comp, references: [...comp.references, { id, x: 0, y: 0, z: 0, ...o }] })
    onAdded?.(id)
  }
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton aria-label="Afegir objecte de referència" title="Afegir objecte de referència" size="2xs" variant="ghost">
          <LuPlus />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content maxH="60vh" overflowY="auto">
            <Menu.Item value="custom" onClick={() => add({ name: "Objecte", w: 600, h: 600, d: 100 })}>
              Objecte a mida
            </Menu.Item>
            <Menu.Item value="pillar" onClick={() => add({ name: "Pilar rodó Ø300", w: 300, h: 2500, d: 300, shape: "cylinder", axis: "y" })}>
              Pilar rodó
            </Menu.Item>
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Tallen la fusta</Menu.ItemGroupLabel>
              {CUTTERS.map((c) => (
                <Menu.Item key={c.name} value={c.name} onClick={() => add({ ...c, x: Math.round(width / 2 - c.w / 2), y: 300, z: -10 })}>
                  {c.name}
                </Menu.Item>
              ))}
            </Menu.ItemGroup>
            {presets.length > 0 && <Menu.Separator />}
            {presets.map((r) => (
              <Menu.Item key={r.id} value={r.id} onClick={() => add({ name: r.name, w: r.w, h: r.h, d: r.d!, z: r.wallOffset })}>
                <Stack gap={0}>
                  <Text>{r.name}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    {r.w} × {r.h} × {r.d}
                  </Text>
                </Stack>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/** Propietats d'un objecte de referència (fantasma): nom, mides i posició. */
export function RefInspector({ comp, id, onChange }: { comp: Composition; id: string; onChange: (c: Composition) => void }) {
  const o = comp.references.find((r) => r.id === id)
  if (!o) return null
  const update = (patch: Partial<RefObject>) => onChange({ ...comp, references: comp.references.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  // Mateix patró que la resta de l'inspector: accions a la capçalera (RefActions) i seccions plegables.
  return (
    <Stack gap={0}>
      <PanelSection id="ref-general" title="General" icon={LuScan}>
        <Field.Root>
          <Field.Label>Nom</Field.Label>
          <Input size="sm" value={o.name} onChange={(e) => update({ name: e.target.value })} />
        </Field.Root>
        <Field.Root>
          <Field.Label>Efecte</Field.Label>
          <Segments
            value={o.effect ?? "obstacle"}
            items={[
              ["obstacle", "Obstacle"],
              ["cut", "Talla la fusta"],
            ]}
            onChange={(v) => update({ effect: v === "cut" ? "cut" : undefined })}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Forma</Field.Label>
          <Segments
            value={o.shape ?? "box"}
            items={[
              ["box", "Caixa"],
              ["cylinder", "Cilindre"],
            ]}
            onChange={(v) => update(v === "cylinder" ? cylinderPatch(o, o.axis ?? "z") : { shape: undefined, axis: undefined })}
          />
        </Field.Root>
        <Text fontSize="xs" color="fg.muted">
          {o.effect === "cut"
            ? "Fa un forat passant a cada peça que travessa (tub, endoll, passacables…). Si el mous, el forat el segueix; surt al nesting, al DXF i al STEP."
            : "Obstacle: no forma part del moble, es veu translúcid per comprovar que tot hi cap i avisa si xoca amb alguna peça."}
        </Text>
      </PanelSection>
      <PanelSection id="ref-size" title="Mides" icon={LuMoveDiagonal}>
        {o.shape === "cylinder" ? (
          <>
            <Field.Root>
              <Field.Label>Direcció</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field value={o.axis ?? "z"} onChange={(e) => update(cylinderPatch(o, e.target.value as Axis))}>
                  <option value="z">Cap a la paret</option>
                  <option value="y">Vertical</option>
                  <option value="x">De costat</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <SimpleGrid columns={2} gap={2}>
              <NumberField label="Ø" value={cylinderDims(o).diameter} min={1} max={2000} step={5} onChange={(diameter) => update(cylinderPatch(o, o.axis ?? "z", { diameter }))} />
              <NumberField label="Llarg" value={cylinderDims(o).length} min={1} max={5000} step={10} onChange={(length) => update(cylinderPatch(o, o.axis ?? "z", { length }))} />
            </SimpleGrid>
          </>
        ) : (
          <>
          {o.effect === "cut" && (
            <Field.Root>
              <Field.Label>Direcció del tall</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field value={o.axis ?? "z"} onChange={(e) => update({ axis: e.target.value === "z" ? undefined : (e.target.value as Axis) })}>
                  <option value="z">Cap a la paret (fons, portes)</option>
                  <option value="y">Vertical (base, tapa, prestatges)</option>
                  <option value="x">De costat (laterals, divisions)</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          )}
          <SimpleGrid columns={3} gap={2}>
            <NumberField label="Ample" value={o.w} min={1} max={5000} step={10} onChange={(w) => update({ w })} />
            <NumberField label="Alt" value={o.h} min={1} max={5000} step={10} onChange={(h) => update({ h })} />
            <NumberField label="Fondària" value={o.d} min={1} max={5000} step={10} onChange={(d) => update({ d })} />
          </SimpleGrid>
          </>
        )}
      </PanelSection>
      <PanelSection id="ref-position" title="Posició" icon={LuMove}>
        <SimpleGrid columns={3} gap={2}>
          <NumberField label="X" value={o.x} min={-5000} max={10000} step={10} onChange={(x) => update({ x })} />
          <NumberField label="Y" value={o.y} min={-5000} max={5000} step={10} onChange={(y) => update({ y })} />
          <NumberField label="Z" value={o.z} min={-5000} max={5000} step={10} onChange={(z) => update({ z })} />
        </SimpleGrid>
        <Text fontSize="xs" color="fg.muted">
          X des de l'esquerra del moble, Y des del terra, Z des del darrere (paret).
        </Text>
        <Text fontSize="xs" color="fg.muted">
          Al 3D, arrossega'l: s'enganxa a les vores dels mòduls i dels altres objectes (Alt: lliure; Maj: pel terra). Fletxes: 1 mm (Maj: 10 mm); Re Pàg / Av Pàg: fondària.
        </Text>
      </PanelSection>
    </Stack>
  )
}

type Axis = "x" | "y" | "z"

/** Ø i llarg d'un cilindre a partir de la seva caixa. */
function cylinderDims(o: RefObject): { diameter: number; length: number } {
  const a = o.axis ?? "z"
  if (a === "x") return { diameter: Math.min(o.h, o.d), length: o.w }
  if (a === "y") return { diameter: Math.min(o.w, o.d), length: o.h }
  return { diameter: Math.min(o.w, o.h), length: o.d }
}

/** Caixa d'un cilindre amb eix `axis` (conserva el centre de la secció). */
function cylinderPatch(o: RefObject, axis: Axis, change: { diameter?: number; length?: number } = {}): Partial<RefObject> {
  const cur = o.shape === "cylinder" ? cylinderDims(o) : { diameter: Math.min(o.w, o.h), length: o.d }
  const diameter = change.diameter ?? cur.diameter
  const length = change.length ?? cur.length
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2
  const cz = o.z + o.d / 2
  const w = axis === "x" ? length : diameter
  const h = axis === "y" ? length : diameter
  const d = axis === "z" ? length : diameter
  return { shape: "cylinder", axis, w, h, d, x: Math.round(cx - w / 2), y: Math.max(0, Math.round(cy - h / 2)), z: Math.round(cz - d / 2) }
}

function Segments({ value, items, onChange }: { value: string; items: [string, string][]; onChange: (v: string) => void }) {
  return (
    <SegmentGroup.Root size="sm" w="full" value={value} onValueChange={(e) => e.value && onChange(e.value)}>
      <SegmentGroup.Indicator />
      {items.map(([v, label]) => (
        <SegmentGroup.Item key={v} value={v} flex={1}>
          <SegmentGroup.ItemText>{label}</SegmentGroup.ItemText>
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  )
}

/** Accions de l'objecte seleccionat, a la capçalera de l'inspector. */
export function RefActions({ comp, id, onChange, onRemoved }: { comp: Composition; id: string; onChange: (c: Composition) => void; onRemoved: () => void }) {
  const { settings, save } = useSettings()
  const o = comp.references.find((r) => r.id === id)
  if (!o) return null
  const saveAsPreset = () => {
    void save({ ...settings, references: [{ id: newId("ref"), name: o.name, w: o.w, h: o.h, d: o.d, plane: "wall", wallOffset: Math.max(0, o.z) }, ...settings.references] })
    toaster.create({ title: `«${o.name}» desat a les preferències`, type: "success" })
  }
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label="Accions de l'objecte">
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="save" onClick={saveAsPreset}>
              <LuBookmark /> Desar a les preferències
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item
              value="del"
              color="fg.error"
              onClick={() => {
                onChange({ ...comp, references: comp.references.filter((r) => r.id !== id) })
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
