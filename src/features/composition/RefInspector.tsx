import { Field, IconButton, Input, Menu, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { LuBookmark, LuEllipsis, LuMove, LuMoveDiagonal, LuPlus, LuScan, LuTrash2 } from "react-icons/lu"
import { PanelSection } from "../../components/PanelSection"
import { toaster } from "../../components/ui/toaster"
import { canBeGhost, newId, visibleReferences, type Composition, type RefObject } from "../../core/model"
import { NumberField } from "../editor/ParamsForm"
import { useSettings } from "../settings/SettingsContext"

/** Menú «+» per afegir un objecte de referència (a mida o de les preferències). */
export function RefAddMenu({ comp, onChange, onAdded }: { comp: Composition; onChange: (c: Composition) => void; onAdded?: (id: string) => void }) {
  const { settings } = useSettings()
  const presets = visibleReferences(settings).filter(canBeGhost)
  const add = (o: Omit<RefObject, "id" | "x" | "y" | "z"> & Partial<Pick<RefObject, "z">>) => {
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
        <Text fontSize="xs" color="fg.muted">
          Objecte fantasma: no forma part del moble, es veu translúcid per comprovar que tot hi cap.
        </Text>
      </PanelSection>
      <PanelSection id="ref-size" title="Mides" icon={LuMoveDiagonal}>
        <SimpleGrid columns={3} gap={2}>
          <NumberField label="Ample" value={o.w} min={1} max={5000} step={10} onChange={(w) => update({ w })} />
          <NumberField label="Alt" value={o.h} min={1} max={5000} step={10} onChange={(h) => update({ h })} />
          <NumberField label="Fondària" value={o.d} min={1} max={5000} step={10} onChange={(d) => update({ d })} />
        </SimpleGrid>
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
      </PanelSection>
    </Stack>
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
