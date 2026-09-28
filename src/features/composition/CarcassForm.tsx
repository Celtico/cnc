import { Button, Field, HStack, IconButton, Input, NativeSelect, SimpleGrid, Stack, Switch, Text } from "@chakra-ui/react"
import { LuPlus, LuTrash2 } from "react-icons/lu"
import { DEFAULT_GRILLE, materialByName, type Base, type Carcass, type Module, type Top } from "../../core/model"
import { NumberField } from "../editor/ParamsForm"
import { useSettings } from "../settings/SettingsContext"
import { MaterialSelect } from "../settings/SettingsScreen"

/** Formulari de la carcassa i dels jocs del mòdul seleccionat. */
export function CarcassForm({ module, onChange }: { module: Module; onChange: (m: Module) => void }) {
  const c = module.carcass
  const set = (patch: Partial<Carcass>) => onChange({ ...module, carcass: { ...c, ...patch } })

  return (
    <Stack gap={4}>
        <Field.Root>
          <Field.Label>Nom del mòdul</Field.Label>
          <Input size="sm" value={module.name} onChange={(e) => onChange({ ...module, name: e.target.value })} />
        </Field.Root>
        <SimpleGrid columns={3} gap={3}>
          <NumberField label="Amplada" value={c.width} min={100} max={3000} step={10} onChange={(width) => set({ width })} />
          <NumberField label="Alçada" value={c.height} min={100} max={2800} step={10} onChange={(height) => set({ height })} />
          <NumberField label="Fondària" value={c.depth} min={100} max={1200} step={10} onChange={(depth) => set({ depth })} />
        </SimpleGrid>

        <SimpleGrid columns={2} gap={3}>
          <Field.Root>
            <Field.Label>Base</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={c.base.kind}
                onChange={(e) => {
                  const k = e.target.value as Base["kind"]
                  const base: Base = k === "plinth" ? { kind: "plinth", height: 60, setback: 30 } : k === "legs" ? { kind: "legs", height: 100 } : { kind: k }
                  set({ base })
                }}
              >
                <option value="none">A terra</option>
                <option value="plinth">Sòcol</option>
                <option value="legs">Potes</option>
                <option value="open">Sense base (obert)</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          {c.base.kind === "plinth" && (
            <HStack align="end" gap={2}>
              <NumberField label="Alçada sòcol" value={c.base.height} min={20} max={300} step={5} onChange={(height) => set({ base: { kind: "plinth", height, setback: (c.base as { setback: number }).setback } })} />
              <NumberField label="Retranqueig" value={c.base.setback} min={0} max={100} step={5} onChange={(setback) => set({ base: { kind: "plinth", height: (c.base as { height: number }).height, setback } })} />
            </HStack>
          )}
          {c.base.kind === "legs" && <NumberField label="Alçada potes" value={c.base.height} min={20} max={400} step={5} onChange={(height) => set({ base: { kind: "legs", height } })} />}
        </SimpleGrid>

        <SimpleGrid columns={2} gap={3}>
          <Field.Root>
            <Field.Label>Fons</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field value={c.back} onChange={(e) => set({ back: e.target.value as Carcass["back"] })}>
                <option value="groove">En ranura</option>
                <option value="screwed">Cargolat darrere</option>
                <option value="none">Sense fons</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <Field.Root>
            <Field.Label>Tapa</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={c.top.kind}
                onChange={(e) => {
                  const k = e.target.value as Top["kind"]
                  const top: Top = k === "ventSlot" ? { kind: "ventSlot", gap: 60 } : k === "grille" ? { kind: "grille", pattern: DEFAULT_GRILLE } : { kind: k }
                  set({ top })
                }}
              >
                <option value="full">Sencera</option>
                <option value="ventSlot">Amb ranura d'aire al darrere</option>
                <option value="grille">Amb reixeta</option>
                <option value="none">Sense tapa</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          {c.top.kind === "ventSlot" && <NumberField label="Ranura d'aire" value={c.top.gap} min={20} max={200} step={5} onChange={(gap) => set({ top: { kind: "ventSlot", gap } })} />}
        </SimpleGrid>

        <HStack gap={6}>
          <Switch.Root size="sm" checked={c.sides.left} onCheckedChange={(e) => set({ sides: { ...c.sides, left: e.checked } })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>Lateral esquerre</Switch.Label>
          </Switch.Root>
          <Switch.Root size="sm" checked={c.sides.right} onCheckedChange={(e) => set({ sides: { ...c.sides, right: e.checked } })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>Lateral dret</Switch.Label>
          </Switch.Root>
        </HStack>

        <Stack gap={2}>
          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              Passacables (Ø passant)
            </Text>
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...module,
                  extras: { ...module.extras, cableHoles: [...module.extras.cableHoles, { panel: "back", x: Math.round(c.width / 2), y: Math.round(c.height * 0.6), diameter: 60 }] },
                })
              }
            >
              <LuPlus /> Afegir
            </Button>
          </HStack>
          {module.extras.cableHoles.map((h, i) => {
            const update = (patch: Partial<typeof h>) =>
              onChange({ ...module, extras: { ...module.extras, cableHoles: module.extras.cableHoles.map((x, k) => (k === i ? { ...x, ...patch } : x)) } })
            return (
              <HStack key={i} align="end" gap={2}>
                <Field.Root flex={1}>
                  <Field.Label>A</Field.Label>
                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field value={h.panel} onChange={(e) => update({ panel: e.target.value as typeof h.panel })}>
                      <option value="back">Fons</option>
                      <option value="top">Tapa</option>
                      <option value="bottom">Base</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                <NumberField label="X" value={h.x} min={0} max={3000} step={10} onChange={(x) => update({ x })} />
                <NumberField label={h.panel === "back" ? "Y (alçada)" : "Y (des del darrere)"} value={h.y} min={0} max={3000} step={10} onChange={(y) => update({ y })} />
                <NumberField label="Ø" value={h.diameter} min={10} max={200} step={5} onChange={(diameter) => update({ diameter })} />
                <IconButton aria-label="Eliminar passacables" size="sm" variant="ghost" colorPalette="red" onClick={() => onChange({ ...module, extras: { ...module.extras, cableHoles: module.extras.cableHoles.filter((_, k) => k !== i) } })}>
                  <LuTrash2 />
                </IconButton>
              </HStack>
            )
          })}
        </Stack>
    </Stack>
  )
}

/** Materials, gruixos, jocs: la secció "Fusteria" del mòdul seleccionat. */
export function JoineryForm({ module, onChange }: { module: Module; onChange: (m: Module) => void }) {
  const c = module.carcass
  const { settings } = useSettings()
  const set = (patch: Partial<Carcass>) => onChange({ ...module, carcass: { ...c, ...patch } })
  const mat = materialByName(settings, c.material)
  const backMat = materialByName(settings, c.backMaterial)
  /** En triar un material, si el gruix actual no és dels seus, s'agafa el més proper. */
  const pickMaterial = (key: "material" | "backMaterial", thicknessKey: "thickness" | "backThickness") => (name: string) => {
    const m = materialByName(settings, name)
    const current = c[thicknessKey]
    const thickness = m && !m.thicknesses.includes(current) ? m.thicknesses.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a)) : current
    set({ [key]: name, [thicknessKey]: thickness })
  }
  return (
    <Stack gap={3}>
      <SimpleGrid columns={2} gap={3}>
        <MaterialSelect label="Material tauler" materials={settings.materials.filter((m) => !m.forBacks)} value={c.material} onChange={pickMaterial("material", "thickness")} />
        <NumberField label="Gruix tauler" value={c.thickness} min={8} max={40} step={1} onChange={(thickness) => set({ thickness })} help={mat ? mat.thicknesses.join(" · ") : "10 · 12 · 16 · 19 · 30"} />
        <MaterialSelect label="Material fons" materials={settings.materials} value={c.backMaterial} onChange={pickMaterial("backMaterial", "backThickness")} />
        <NumberField label="Gruix fons" value={c.backThickness} min={3} max={20} step={1} onChange={(backThickness) => set({ backThickness })} help={backMat ? backMat.thicknesses.join(" · ") : undefined} />
      </SimpleGrid>
      {mat?.edge && (
        <Text fontSize="xs" color="fg.muted">
          Cantell del material: {mat.edge}
        </Text>
      )}
      <SimpleGrid columns={2} gap={3}>
        <NumberField label="Joc front–cos" value={module.fronts.outerGap} min={0} max={10} step={0.5} onChange={(outerGap) => onChange({ ...module, fronts: { ...module.fronts, outerGap } })} />
        <NumberField label="Joc entre fronts" value={module.fronts.betweenGap} min={0} max={10} step={0.5} onChange={(betweenGap) => onChange({ ...module, fronts: { ...module.fronts, betweenGap } })} />
        <NumberField label="Retranqueig prest." value={c.shelfSetback} min={0} max={100} step={1} onChange={(shelfSetback) => set({ shelfSetback })} />
        <NumberField label="Ranura del fons" value={c.backSetback} min={0} max={60} step={1} onChange={(backSetback) => set({ backSetback })} help="Distància al cantell posterior" />
      </SimpleGrid>
      <SimpleGrid columns={3} gap={3}>
        <NumberField label="Cassoleta Ø" value={module.hardware.hinge.cupDiameter} min={20} max={40} step={1} onChange={(cupDiameter) => onChange({ ...module, hardware: { ...module.hardware, hinge: { ...module.hardware.hinge, cupDiameter } } })} />
        <NumberField label="S32 pas" value={module.hardware.system32.pitch} min={16} max={64} step={1} onChange={(pitch) => onChange({ ...module, hardware: { ...module.hardware, system32: { ...module.hardware.system32, pitch } } })} />
        <NumberField label="Espiga Ø" value={module.hardware.dowel.diameter} min={5} max={12} step={1} onChange={(diameter) => onChange({ ...module, hardware: { ...module.hardware, dowel: { ...module.hardware.dowel, diameter } } })} />
      </SimpleGrid>
      <Text fontSize="xs" color="fg.muted">
        Guies de calaix: {module.hardware.drawer.slideLengths.join(" · ")} mm, joc lateral {module.hardware.drawer.sideClearance} mm per costat.
      </Text>
    </Stack>
  )
}
