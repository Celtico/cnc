import { Button, Field, HStack, IconButton, Input, NativeSelect, SimpleGrid, Stack, Switch, Text } from "@chakra-ui/react"
import { LuPlus, LuTrash2 } from "react-icons/lu"
import { DEFAULT_GRILLE, materialByName, type Base, type Carcass, type Module, type Top } from "../../core/model"
import { NumberField } from "../editor/ParamsForm"
import { useSettings } from "../settings/SettingsContext"
import { MaterialSelect } from "../settings/SettingsScreen"

export type CarcassSection = "dims" | "structure" | "cables"

/**
 * Formulari de la carcassa del mòdul seleccionat, per seccions (l'inspector en fa una
 * secció plegable per a cadascuna): mides, estructura (base, fons, tapa, laterals) i
 * passacables.
 */
export function CarcassForm({ module, onChange, section }: { module: Module; onChange: (m: Module) => void; section: CarcassSection }) {
  const c = module.carcass
  const set = (patch: Partial<Carcass>) => onChange({ ...module, carcass: { ...c, ...patch } })

  if (section === "dims")
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
      </Stack>
    )
  if (section === "structure")
    return (
      <Stack gap={4}>
        {/* «Penjat a la paret» és una posició, no una base: es tria a la secció Posició. */}
        {c.base.kind === "wall" ? (
          <Text fontSize="sm" color="fg.muted">
            Base: cap (penjat a la paret, a {c.base.height} mm del terra). Es canvia a Posició.
          </Text>
        ) : (
          <Field.Root>
            <Field.Label>Base</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={c.base.kind}
                onChange={(e) => {
                  const k = e.target.value as Exclude<Base["kind"], "wall">
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
        )}
        {/* Base a tota l'amplada i les seves mides a sota, en dues columnes: així els camps
            numèrics tenen prou espai i les etiquetes no es tallen. */}
        {c.base.kind === "plinth" && (
          <SimpleGrid columns={2} gap={3}>
            <NumberField label="Alçada sòcol" value={c.base.height} min={20} max={300} step={5} onChange={(height) => set({ base: { kind: "plinth", height, setback: (c.base as { setback: number }).setback } })} />
            <NumberField label="Retranqueig" value={c.base.setback} min={0} max={100} step={5} onChange={(setback) => set({ base: { kind: "plinth", height: (c.base as { height: number }).height, setback } })} />
          </SimpleGrid>
        )}
        {c.base.kind === "legs" && (
          <SimpleGrid columns={2} gap={3}>
            <NumberField label="Alçada potes" value={c.base.height} min={20} max={400} step={5} onChange={(height) => set({ base: { kind: "legs", height } })} />
          </SimpleGrid>
        )}

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

        <Field.Root>
          <Field.Label>Laterals</Field.Label>
          <SimpleGrid columns={2} gap={3} w="full">
            <Switch.Root size="sm" checked={c.sides.left} onCheckedChange={(e) => set({ sides: { ...c.sides, left: e.checked } })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label>Esquerre</Switch.Label>
            </Switch.Root>
            <Switch.Root size="sm" checked={c.sides.right} onCheckedChange={(e) => set({ sides: { ...c.sides, right: e.checked } })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label>Dret</Switch.Label>
            </Switch.Root>
          </SimpleGrid>
        </Field.Root>
      </Stack>
    )
  return (
    <Stack gap={4}>
        <Stack gap={2}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="fg.muted">
              Forats passants per als cables.
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
              <Stack key={i} gap={2} borderTopWidth="1px" pt={2}>
                <HStack align="end" gap={2}>
                  <Field.Root flex={1}>
                    <Field.Label>Passacables {i + 1} a</Field.Label>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field value={h.panel} onChange={(e) => update({ panel: e.target.value as typeof h.panel })}>
                        <option value="back">Fons</option>
                        <option value="top">Tapa</option>
                        <option value="bottom">Base</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                  <IconButton aria-label="Eliminar passacables" size="sm" variant="ghost" colorPalette="red" onClick={() => onChange({ ...module, extras: { ...module.extras, cableHoles: module.extras.cableHoles.filter((_, k) => k !== i) } })}>
                    <LuTrash2 />
                  </IconButton>
                </HStack>
                <SimpleGrid columns={3} gap={2}>
                  <NumberField label="X" value={h.x} min={0} max={3000} step={10} onChange={(x) => update({ x })} />
                  <NumberField label="Y" value={h.y} min={0} max={3000} step={10} onChange={(y) => update({ y })} />
                  <NumberField label="Ø" value={h.diameter} min={10} max={200} step={5} onChange={(diameter) => update({ diameter })} />
                </SimpleGrid>
                <Text fontSize="xs" color="fg.muted">
                  X des de l'esquerra; Y {h.panel === "back" ? "des de baix" : "des del darrere"}.
                </Text>
              </Stack>
            )
          })}
        </Stack>
    </Stack>
  )
}

/**
 * Materials del cos, dels fronts i del fons. Es fa servir per a un mòdul i també per al
 * moble sencer (aplica el canvi a tots els mòduls).
 */
/** Valor del desplegable del fons per a «Com el cos» (mateix material i gruix). */
const SAME = "__com-el-cos__"

export function MaterialsForm({ carcass: c, onPatch, mixed }: { carcass: Carcass; onPatch: (patch: Partial<Carcass>) => void; mixed?: boolean }) {
  const { settings } = useSettings()
  const mat = materialByName(settings, c.material)
  const backMat = materialByName(settings, c.backMaterial)
  /** En triar un material, si el gruix actual no és dels seus, s'agafa el més proper. */
  const pickMaterial = (key: "material" | "backMaterial", thicknessKey: "thickness" | "backThickness") => (name: string) => {
    // Fons del mateix material que el cos: també el mateix gruix, perquè comparteixin
    // tauler al nesting (s'agrupa per material i gruix).
    if (key === "backMaterial" && (name === SAME || name === c.material)) {
      onPatch({ backMaterial: c.material, backThickness: c.thickness })
      return
    }
    const m = materialByName(settings, name)
    const current = c[thicknessKey]
    const thickness = m && !m.thicknesses.includes(current) ? m.thicknesses.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a)) : current
    // Fons «com el cos»: segueix el cos quan aquest canvia.
    onPatch(key === "material" && sameBack ? { material: name, thickness, backMaterial: name, backThickness: thickness } : { [key]: name, [thicknessKey]: thickness })
  }
  const sameBack = c.backMaterial === c.material && c.backThickness === c.thickness
  // Mateix material però un altre gruix: al nesting van a taulers diferents.
  const backApart = c.backMaterial === c.material && c.backThickness !== c.thickness
  const boards = settings.materials.filter((m) => !m.forBacks)
  return (
    <Stack gap={3}>
      {mixed && (
        <Text fontSize="xs" color="fg.muted">
          Els mòduls tenen materials diferents; es mostren els del primer. El que triïs s'aplica a tots.
        </Text>
      )}
      <SimpleGrid columns={2} gap={3}>
        <MaterialSelect label="Cos" materials={boards} value={c.material} onChange={pickMaterial("material", "thickness")} />
        <NumberField label="Gruix" value={c.thickness} min={8} max={40} step={1} onChange={(thickness) => onPatch(sameBack ? { thickness, backThickness: thickness } : { thickness })} help={mat ? mat.thicknesses.join(" · ") : undefined} />
      </SimpleGrid>
      <Field.Root>
        <Field.Label fontSize="sm">Fronts (portes, calaixos, abatibles)</Field.Label>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field value={c.frontMaterial ?? ""} onChange={(e) => onPatch({ frontMaterial: e.target.value || undefined })}>
            <option value="">Com el cos</option>
            {boards.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Field.HelperText>Mateix gruix que el cos.</Field.HelperText>
      </Field.Root>
      <SimpleGrid columns={2} gap={3}>
        <Field.Root>
          <Field.Label fontSize="sm">Fons</Field.Label>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field value={sameBack ? SAME : c.backMaterial} onChange={(e) => pickMaterial("backMaterial", "backThickness")(e.target.value)}>
              <option value={SAME}>Com el cos</option>
              {!settings.materials.some((m) => m.name === c.backMaterial) && <option value={c.backMaterial}>{c.backMaterial || "(sense material)"}</option>}
              {settings.materials.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
        <NumberField label="Gruix" value={c.backThickness} min={3} max={40} step={1} onChange={(backThickness) => onPatch({ backThickness })} help={backMat ? backMat.thicknesses.join(" · ") : undefined} />
      </SimpleGrid>
      {backApart && (
        <HStack gap={2} fontSize="xs" color="fg.muted" wrap="wrap">
          <Text>
            El fons és de {c.backMaterial} però de {c.backThickness} mm: no comparteix tauler amb el cos ({c.thickness} mm).
          </Text>
          <Button size="2xs" variant="outline" colorPalette="wood" onClick={() => onPatch({ backThickness: c.thickness })}>
            Posar {c.thickness} mm
          </Button>
        </HStack>
      )}
      {mat?.edge && (
        <Text fontSize="xs" color="fg.muted">
          Cantell del cos: {mat.edge}
        </Text>
      )}
    </Stack>
  )
}

/** Jocs i ferratges del mòdul seleccionat (secció «Fusteria (avançat)»). */
export function JoineryForm({ module, onChange }: { module: Module; onChange: (m: Module) => void }) {
  const c = module.carcass
  const set = (patch: Partial<Carcass>) => onChange({ ...module, carcass: { ...c, ...patch } })
  return (
    <Stack gap={3}>
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
