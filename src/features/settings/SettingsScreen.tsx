import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Field,
  HStack,
  Heading,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  SegmentGroup,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  LuArrowDown,
  LuArrowUp,
  LuCopy,
  LuDownload,
  LuEye,
  LuEyeOff,
  LuFileDown,
  LuGrid3X3,
  LuHammer,
  LuLayoutGrid,
  LuPalette,
  LuPlus,
  LuRotateCcw,
  LuRuler,
  LuScan,
  LuSquareStack,
  LuTag,
  LuTrash2,
  LuUpload,
} from "react-icons/lu"
import type { IconType } from "react-icons"
import { PanelGroup, PanelSection } from "../../components/PanelSection"
import { toaster } from "../../components/ui/toaster"
import {
  DEFAULT_SETTINGS,
  SettingsSchema,
  newId,
  settingsFromJson,
  settingsToJson,
  type Finish,
  type MaterialPref,
  type RefPreset,
  type Settings,
} from "../../core/model"
import { downloadText } from "../download"
import { NumberField } from "../editor/ParamsForm"
import { useSettings } from "./SettingsContext"

type SectionKey = keyof Omit<Settings, "version">

/** Missatge en català d'un problema de validació. */
function issueText(issue: { path: PropertyKey[]; code: string; message: string; minimum?: unknown; maximum?: unknown }): string {
  const path = issue.path.map(String).join(" › ")
  if (issue.code === "too_small" && typeof issue.minimum === "number") return `${path}: mínim ${issue.minimum}`
  if (issue.code === "too_big" && typeof issue.maximum === "number") return `${path}: màxim ${issue.maximum}`
  if (issue.code === "invalid_type") return `${path}: cal un valor`
  return `${path}: ${issue.message}`
}

export function SettingsScreen() {
  const { settings, loading, save } = useSettings()
  if (loading) return null
  return <SettingsEditor key={JSON.stringify(settings.version)} initial={settings} save={save} />
}

function SettingsEditor({ initial, save }: { initial: Settings; save: (s: Settings) => Promise<void> }) {
  const [draft, setDraft] = useState<Settings>(initial)
  const [reset, setReset] = useState<{ key: SectionKey; label: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const validation = useMemo(() => SettingsSchema.safeParse(draft), [draft])
  const problems = validation.success ? [] : validation.error.issues.map(issueText)

  // Desa amb retard, només si és vàlid.
  const last = useRef(initial)
  useEffect(() => {
    if (draft === last.current || !validation.success) return
    const t = setTimeout(() => {
      last.current = validation.data
      void save(validation.data)
    }, 400)
    return () => clearTimeout(t)
  }, [draft, validation, save])

  const set = <K extends SectionKey>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const doExport = () => downloadText(settingsToJson(validation.success ? validation.data : draft), "mobles-preferencies.json", "application/json")
  const doImport = async (file: File | undefined) => {
    if (!file) return
    const res = settingsFromJson(await file.text())
    if (res.problems.length) {
      toaster.create({ title: "Preferències importades amb avisos", description: res.problems.join(" "), type: "warning", duration: 8000 })
    } else toaster.create({ title: "Preferències importades", type: "success" })
    setDraft(res.settings)
    if (fileInput.current) fileInput.current.value = ""
  }
  const confirmReset = () => {
    if (!reset) return
    setDraft((d) => ({ ...d, [reset.key]: structuredClone(DEFAULT_SETTINGS[reset.key]) }))
    toaster.create({ title: `«${reset.label}» restaurat`, type: "info" })
    setReset(null)
  }

  return (
    <Stack gap={5} w="full">
      <HStack justify="space-between" wrap="wrap" gap={3}>
        <Heading size="xl">Preferències</Heading>
        <HStack>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
          <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
            <LuUpload /> Importar
          </Button>
          <Button size="sm" variant="outline" onClick={doExport}>
            <LuDownload /> Exportar
          </Button>
        </HStack>
      </HStack>
      <Text fontSize="sm" color="fg.muted">
        Mides i valors que depenen de tu i del taller. Canviar-los no modifica els mobles ja fets: només els mòduls nous i les
        pantalles que llegeixen aquestes llistes (foto, editor, nesting, export).
      </Text>
      {problems.length > 0 && (
        <Alert.Root status="error" size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No es desa fins que sigui vàlid</Alert.Title>
            <Alert.Description>{problems.slice(0, 3).join(" · ")}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <PanelGroup storageKey="mobles:settings-open-section" defaultOpen="references">
        <Stack gap={0}>
          <Section id="references" title="Objectes de referència" icon={LuScan} onReset={() => setReset({ key: "references", label: "Objectes de referència" })}>
            <Text fontSize="sm" color="fg.muted">
              Una sola llista per a la foto (es calibra amb la cara del davant, amplada × alçada) i per a l'editor (fantasma 3D,
              cal fondària). La distància a la paret corregeix l'escala si l'objecte no hi toca.
            </Text>
            <ReferencesList refs={draft.references} onChange={(references) => set("references", references)} />
          </Section>

          <Section id="materials" title="Materials" icon={LuPalette} onReset={() => setReset({ key: "materials", label: "Materials" })}>
            <MaterialsList materials={draft.materials} onChange={(materials) => set("materials", materials)} />
            <Heading size="sm">Per defecte als mòduls nous</Heading>
            <SimpleGrid columns={2} gap={3}>
              <MaterialSelect label="Tauler" materials={draft.materials.filter((m) => !m.forBacks)} value={draft.defaults.material} onChange={(material) => set("defaults", { ...draft.defaults, material })} />
              <NumberField label="Gruix tauler" value={draft.defaults.thickness} min={8} max={40} step={1} onChange={(thickness) => set("defaults", { ...draft.defaults, thickness })} />
              <MaterialSelect label="Fons" materials={draft.materials} value={draft.defaults.backMaterial} onChange={(backMaterial) => set("defaults", { ...draft.defaults, backMaterial })} />
              <NumberField label="Gruix fons" value={draft.defaults.backThickness} min={3} max={20} step={1} onChange={(backThickness) => set("defaults", { ...draft.defaults, backThickness })} />
            </SimpleGrid>
          </Section>

          <Section id="boards" title="Taulers i nesting" icon={LuLayoutGrid} onReset={() => setReset({ key: "boards", label: "Taulers i nesting" })}>
            <Stack gap={2}>
              {draft.boards.sheets.map((s, i) => {
                const update = (patch: Partial<typeof s>) => set("boards", { ...draft.boards, sheets: draft.boards.sheets.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
                return (
                  <HStack key={i} align="end" gap={2}>
                    <Field.Root flex={1}>
                      <Field.Label fontSize="sm">Material</Field.Label>
                      <NativeSelect.Root size="sm">
                        <NativeSelect.Field value={s.material} onChange={(e) => update({ material: e.target.value })}>
                          <option value="">Tots els altres</option>
                          {draft.materials.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Field.Root>
                    <NumberField label="Llarg" value={s.w} min={300} max={6000} step={10} onChange={(w) => update({ w })} />
                    <NumberField label="Ample" value={s.h} min={300} max={6000} step={10} onChange={(h) => update({ h })} />
                    <IconButton aria-label="Eliminar tauler" size="sm" variant="ghost" colorPalette="red" disabled={draft.boards.sheets.length <= 1} onClick={() => set("boards", { ...draft.boards, sheets: draft.boards.sheets.filter((_, k) => k !== i) })}>
                      <LuTrash2 />
                    </IconButton>
                  </HStack>
                )
              })}
              <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={() => set("boards", { ...draft.boards, sheets: [...draft.boards.sheets, { material: "", w: 2440, h: 1220 }] })}>
                <LuPlus /> Afegir mida de tauler
              </Button>
            </Stack>
            <SimpleGrid columns={2} gap={3}>
              <NumberField label="Kerf (fresa)" value={draft.boards.kerf} min={0} max={30} step={0.5} onChange={(kerf) => set("boards", { ...draft.boards, kerf })} />
              <NumberField label="Marge del tauler" value={draft.boards.margin} min={0} max={100} step={1} onChange={(margin) => set("boards", { ...draft.boards, margin })} />
            </SimpleGrid>
            <Switch.Root size="sm" checked={draft.boards.ignoreGrain} onCheckedChange={(e) => set("boards", { ...draft.boards, ignoreGrain: e.checked })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label>Permetre girar les peces encara que tinguin veta</Switch.Label>
            </Switch.Root>
          </Section>

          <Section id="hardware" title="Ferratges i mecanitzats" icon={LuHammer} onReset={() => setReset({ key: "hardware", label: "Ferratges i mecanitzats" })}>
            <HardwareForm hardware={draft.hardware} onChange={(hardware) => set("hardware", hardware)} />
          </Section>

          <Section id="gaps" title="Jocs per defecte" icon={LuRuler} onReset={() => setReset({ key: "gaps", label: "Jocs per defecte" })}>
            <SimpleGrid columns={2} gap={3}>
              <NumberField label="Porta–cos" value={draft.gaps.outerGap} min={0} max={10} step={0.5} onChange={(outerGap) => set("gaps", { ...draft.gaps, outerGap })} />
              <NumberField label="Entre fronts" value={draft.gaps.betweenGap} min={0} max={10} step={0.5} onChange={(betweenGap) => set("gaps", { ...draft.gaps, betweenGap })} />
              <NumberField label="Prestatge (joc)" value={draft.gaps.shelfClearance} min={0} max={5} step={0.5} onChange={(shelfClearance) => set("gaps", { ...draft.gaps, shelfClearance })} />
              <NumberField label="Prestatge (retranq.)" value={draft.gaps.shelfSetback} min={0} max={100} step={1} onChange={(shelfSetback) => set("gaps", { ...draft.gaps, shelfSetback })} />
              <NumberField label="Fons (joc)" value={draft.gaps.backClearance} min={0} max={4} step={0.5} onChange={(backClearance) => set("gaps", { ...draft.gaps, backClearance })} />
              <NumberField label="Ranura del fons" value={draft.gaps.backSetback} min={0} max={60} step={1} help="Distància al cantell posterior" onChange={(backSetback) => set("gaps", { ...draft.gaps, backSetback })} />
              <NumberField label="Fondària ranura" value={draft.gaps.grooveDepth} min={3} max={15} step={1} onChange={(grooveDepth) => set("gaps", { ...draft.gaps, grooveDepth })} />
            </SimpleGrid>
          </Section>

          <Section id="label" title="Etiquetes" icon={LuTag} onReset={() => setReset({ key: "label", label: "Etiquetes" })}>
            <Text fontSize="sm" color="fg.muted">
              Mida de l'etiqueta per triar on s'enganxa (PosX/PosY del CSV del taller). Per defecte 99 × 68, Avery L7165.
            </Text>
            <SimpleGrid columns={2} gap={3}>
              <NumberField label="Amplada" value={draft.label.w} min={10} max={300} step={1} onChange={(w) => set("label", { ...draft.label, w })} />
              <NumberField label="Alçada" value={draft.label.h} min={10} max={300} step={1} onChange={(h) => set("label", { ...draft.label, h })} />
            </SimpleGrid>
          </Section>

          <Section id="display" title="Visualització" icon={LuGrid3X3} onReset={() => setReset({ key: "display", label: "Visualització" })}>
            <Field.Root>
              <Field.Label>Unitat de les mides a la pantalla</Field.Label>
              <SegmentGroup.Root size="sm" value={draft.display.unit} onValueChange={(e) => (e.value === "mm" || e.value === "cm") && set("display", { unit: e.value })}>
                <SegmentGroup.Indicator />
                <SegmentGroup.Item value="mm">
                  <SegmentGroup.ItemText>mm</SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
                <SegmentGroup.Item value="cm">
                  <SegmentGroup.ItemText>cm</SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              </SegmentGroup.Root>
              <Field.HelperText>Internament tot es guarda en mm; els fitxers per al taller sempre van en mm.</Field.HelperText>
            </Field.Root>
          </Section>
        </Stack>
      </PanelGroup>

      <Dialog.Root role="alertdialog" open={reset !== null} onOpenChange={(e) => !e.open && setReset(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Restaurar «{reset?.label}»?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Es perdran els canvis d'aquesta secció i tornaran els valors inicials. Els mobles ja fets no canvien.</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setReset(null)}>
                  Cancel·lar
                </Button>
                <Button colorPalette="red" onClick={confirmReset}>
                  <LuRotateCcw /> Restaurar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  )
}

function Section({ id, title, icon, onReset, children }: { id: string; title: string; icon: IconType; onReset: () => void; children: ReactNode }) {
  return (
    <PanelSection id={id} title={title} icon={icon}>
      {children}
      <Button size="xs" variant="ghost" colorPalette="red" alignSelf="flex-start" onClick={onReset}>
        <LuRotateCcw /> Restaurar valors inicials
      </Button>
    </PanelSection>
  )
}

// --- Objectes de referència --------------------------------------------------------------

function ReferencesList({ refs, onChange }: { refs: RefPreset[]; onChange: (r: RefPreset[]) => void }) {
  const update = (i: number, patch: Partial<RefPreset>) => onChange(refs.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= refs.length) return
    const next = [...refs]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }
  const add = () => onChange([{ id: newId("ref"), name: "Objecte nou", w: 600, h: 600, plane: "wall", wallOffset: 0 }, ...refs])
  const duplicate = (i: number) => {
    const src = refs[i]!
    const copy: RefPreset = { ...src, id: newId("ref"), name: `${src.name} (còpia)`, builtin: undefined, hidden: undefined }
    const next = [...refs]
    next.splice(i + 1, 0, copy)
    onChange(next)
  }
  return (
    <Stack gap={2}>
      <Button size="xs" variant="outline" alignSelf="flex-start" onClick={add}>
        <LuPlus /> Afegir objecte
      </Button>
      {refs.map((r, i) => (
        <Card.Root key={r.id} variant="subtle" size="sm" opacity={r.hidden ? 0.55 : 1}>
          <Card.Body p={3} gap={2}>
            <HStack justify="space-between" gap={2}>
              <Input size="sm" value={r.name} onChange={(e) => update(i, { name: e.target.value })} fontWeight="semibold" />
              {r.builtin && (
                <Badge size="sm" variant="subtle">
                  inicial
                </Badge>
              )}
              <HStack gap={0}>
                <IconButton aria-label="Pujar" size="xs" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                  <LuArrowUp />
                </IconButton>
                <IconButton aria-label="Baixar" size="xs" variant="ghost" disabled={i === refs.length - 1} onClick={() => move(i, 1)}>
                  <LuArrowDown />
                </IconButton>
                <IconButton aria-label="Duplicar objecte" size="xs" variant="ghost" onClick={() => duplicate(i)}>
                  <LuCopy />
                </IconButton>
                {r.builtin ? (
                  <IconButton aria-label={r.hidden ? "Mostrar objecte" : "Amagar objecte"} size="xs" variant="ghost" onClick={() => update(i, { hidden: !r.hidden })}>
                    {r.hidden ? <LuEyeOff /> : <LuEye />}
                  </IconButton>
                ) : (
                  <IconButton aria-label="Eliminar objecte" size="xs" variant="ghost" colorPalette="red" onClick={() => onChange(refs.filter((_, k) => k !== i))}>
                    <LuTrash2 />
                  </IconButton>
                )}
              </HStack>
            </HStack>
            <SimpleGrid columns={{ base: 2, md: 5 }} gap={2}>
              <NumberField label="Amplada" value={r.w} min={1} max={10000} step={10} onChange={(w) => update(i, { w })} />
              <NumberField label="Alçada" value={r.h} min={1} max={10000} step={10} onChange={(h) => update(i, { h })} />
              <NumberField label="Fondària" value={r.d ?? NaN} min={1} max={10000} step={10} help={r.d ? undefined : "Buida: només per a la foto"} onChange={(d) => update(i, { d: Number.isFinite(d) && d > 0 ? d : undefined })} />
              <Field.Root>
                <Field.Label fontSize="sm">Pla</Field.Label>
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field value={r.plane} onChange={(e) => update(i, { plane: e.target.value as RefPreset["plane"] })}>
                    <option value="wall">Paret</option>
                    <option value="floor">Terra</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
              <NumberField label="A la paret" value={r.wallOffset} min={0} max={5000} step={10} onChange={(wallOffset) => update(i, { wallOffset })} />
            </SimpleGrid>
          </Card.Body>
        </Card.Root>
      ))}
    </Stack>
  )
}

// --- Materials ---------------------------------------------------------------------------

const SPECIES: { value: Extract<Finish, { kind: "wood" }>["species"]; label: string }[] = [
  { value: "oak", label: "Roure" },
  { value: "walnut", label: "Noguera" },
  { value: "ash", label: "Freixe" },
]

function parseList(text: string): number[] {
  return text
    .split(/[,;·\s]+/)
    .map((s) => Number(s.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0)
}

function MaterialsList({ materials, onChange }: { materials: MaterialPref[]; onChange: (m: MaterialPref[]) => void }) {
  const update = (i: number, patch: Partial<MaterialPref>) => onChange(materials.map((m, k) => (k === i ? { ...m, ...patch } : m)))
  const add = () => onChange([{ id: newId("mat"), name: "Material nou", thicknesses: [19], hasGrain: false, finish: { kind: "color", color: "#e5e5e5" }, edge: "" }, ...materials])
  return (
    <Stack gap={2}>
      <Button size="xs" variant="outline" alignSelf="flex-start" onClick={add}>
        <LuPlus /> Afegir material
      </Button>
      {materials.map((m, i) => (
        <MaterialCard key={m.id} m={m} onChange={(patch) => update(i, patch)} onDuplicate={() => {
          const next = [...materials]
          next.splice(i + 1, 0, { ...m, id: newId("mat"), name: `${m.name} (còpia)` })
          onChange(next)
        }} onDelete={() => onChange(materials.filter((_, k) => k !== i))} canDelete={materials.length > 1} />
      ))}
    </Stack>
  )
}

function MaterialCard({ m, onChange, onDuplicate, onDelete, canDelete }: { m: MaterialPref; onChange: (p: Partial<MaterialPref>) => void; onDuplicate: () => void; onDelete: () => void; canDelete: boolean }) {
  const [thickText, setThickText] = useState(m.thicknesses.join(" · "))
  const finish = m.finish
  const swatch = finish.kind === "wood" ? undefined : finish.color
  return (
    <Card.Root variant="subtle" size="sm">
      <Card.Body p={3} gap={2}>
        <HStack justify="space-between" gap={2}>
          <Box w="18px" h="18px" rounded="sm" borderWidth="1px" flexShrink={0} bg={swatch} bgImage={finish.kind === "wood" ? "repeating-linear-gradient(90deg, #b98b57 0 2px, #a3763f 2px 3px)" : undefined} />
          <Input size="sm" value={m.name} onChange={(e) => onChange({ name: e.target.value })} fontWeight="semibold" />
          <IconButton aria-label="Duplicar material" size="xs" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
          <IconButton aria-label="Eliminar material" size="xs" variant="ghost" colorPalette="red" disabled={!canDelete} onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </HStack>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={2}>
          <Field.Root invalid={m.thicknesses.length === 0}>
            <Field.Label fontSize="sm">Gruixos</Field.Label>
            <Input
              size="sm"
              value={thickText}
              onChange={(e) => {
                setThickText(e.target.value)
                onChange({ thicknesses: parseList(e.target.value) })
              }}
              onBlur={() => setThickText(m.thicknesses.join(" · "))}
              placeholder="10 · 16 · 19"
            />
            {m.thicknesses.length === 0 && <Field.ErrorText>Cal almenys un gruix (3–60 mm)</Field.ErrorText>}
          </Field.Root>
          <Field.Root>
            <Field.Label fontSize="sm">Acabat</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={finish.kind}
                onChange={(e) => {
                  const k = e.target.value as Finish["kind"]
                  onChange({ finish: k === "wood" ? { kind: "wood", species: "oak" } : { kind: k, color: swatch ?? "#e5e5e5" } })
                }}
              >
                <option value="color">Color llis</option>
                <option value="lacquer">Lacat</option>
                <option value="wood">Fusta</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          {finish.kind === "wood" ? (
            <Field.Root>
              <Field.Label fontSize="sm">Espècie</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field value={finish.species} onChange={(e) => onChange({ finish: { kind: "wood", species: e.target.value as typeof finish.species } })}>
                  {SPECIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          ) : (
            <Field.Root>
              <Field.Label fontSize="sm">Color</Field.Label>
              <Input size="sm" type="color" value={finish.color} onChange={(e) => onChange({ finish: { kind: finish.kind, color: e.target.value } })} p={0.5} />
            </Field.Root>
          )}
          <Field.Root>
            <Field.Label fontSize="sm">Cantell</Field.Label>
            <Input size="sm" value={m.edge} onChange={(e) => onChange({ edge: e.target.value })} placeholder="PVC blanc 1 mm" />
          </Field.Root>
        </SimpleGrid>
        <HStack gap={5} wrap="wrap">
          <Switch.Root size="sm" checked={m.hasGrain} onCheckedChange={(e) => onChange({ hasGrain: e.checked })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>Té veta</Switch.Label>
          </Switch.Root>
          <Switch.Root size="sm" checked={!!m.forBacks} onCheckedChange={(e) => onChange({ forBacks: e.checked || undefined })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>Per a fons</Switch.Label>
          </Switch.Root>
        </HStack>
      </Card.Body>
    </Card.Root>
  )
}

export function MaterialSelect({ label, materials, value, onChange }: { label: string; materials: MaterialPref[]; value: string; onChange: (name: string) => void }) {
  const known = materials.some((m) => m.name === value)
  return (
    <Field.Root>
      <Field.Label fontSize="sm">{label}</Field.Label>
      <NativeSelect.Root size="sm">
        <NativeSelect.Field value={value} onChange={(e) => onChange(e.target.value)}>
          {!known && <option value={value}>{value || "(sense material)"}</option>}
          {materials.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>
  )
}

// --- Ferratges -----------------------------------------------------------------------------

function HardwareForm({ hardware: h, onChange }: { hardware: Settings["hardware"]; onChange: (h: Settings["hardware"]) => void }) {
  const [slides, setSlides] = useState(h.drawer.slideLengths.join(" · "))
  const sub = <K extends keyof Settings["hardware"]>(key: K, patch: Partial<Settings["hardware"][K]>) => onChange({ ...h, [key]: { ...h[key], ...patch } })
  return (
    <Stack gap={4}>
      <Group title="Cassoleta de frontissa" icon={LuSquareStack}>
        <SimpleGrid columns={3} gap={3}>
          <NumberField label="Ø" value={h.hinge.cupDiameter} min={20} max={40} step={1} onChange={(cupDiameter) => sub("hinge", { cupDiameter })} />
          <NumberField label="Fondària" value={h.hinge.cupDepth} min={5} max={20} step={0.5} onChange={(cupDepth) => sub("hinge", { cupDepth })} />
          <NumberField label="Al cantell" value={h.hinge.cupOffset} min={15} max={30} step={0.5} onChange={(cupOffset) => sub("hinge", { cupOffset })} />
        </SimpleGrid>
      </Group>
      <Group title="System 32" icon={LuGrid3X3}>
        <SimpleGrid columns={2} gap={3}>
          <NumberField label="Filera al cantell" value={h.system32.edgeOffset} min={20} max={60} step={1} onChange={(edgeOffset) => sub("system32", { edgeOffset })} />
          <NumberField label="Pas" value={h.system32.pitch} min={16} max={64} step={1} onChange={(pitch) => sub("system32", { pitch })} />
          <NumberField label="Ø forat" value={h.system32.diameter} min={3} max={10} step={0.5} onChange={(diameter) => sub("system32", { diameter })} />
          <NumberField label="Fondària" value={h.system32.depth} min={5} max={16} step={0.5} onChange={(depth) => sub("system32", { depth })} />
        </SimpleGrid>
      </Group>
      <Group title="Espigues" icon={LuHammer}>
        <SimpleGrid columns={2} gap={3}>
          <NumberField label="Ø" value={h.dowel.diameter} min={5} max={12} step={1} onChange={(diameter) => sub("dowel", { diameter })} />
          <NumberField label="Als extrems" value={h.dowel.endOffset} min={20} max={120} step={5} onChange={(endOffset) => sub("dowel", { endOffset })} />
          <NumberField label="Fond. a la cara" value={h.dowel.faceDepth} min={5} max={20} step={0.5} onChange={(faceDepth) => sub("dowel", { faceDepth })} />
          <NumberField label="Fond. al cantell" value={h.dowel.edgeDepth} min={10} max={40} step={0.5} onChange={(edgeDepth) => sub("dowel", { edgeDepth })} />
        </SimpleGrid>
      </Group>
      <Group title="Calaixos (guia genèrica)" icon={LuFileDown}>
        <Field.Root invalid={h.drawer.slideLengths.length === 0}>
          <Field.Label fontSize="sm">Llargades de guia disponibles</Field.Label>
          <Input
            size="sm"
            value={slides}
            onChange={(e) => {
              setSlides(e.target.value)
              const list = parseList(e.target.value)
              if (list.length) sub("drawer", { slideLengths: list })
            }}
            onBlur={() => setSlides(h.drawer.slideLengths.join(" · "))}
            placeholder="250 · 300 · 350 · 400 · 450 · 500 · 550"
          />
          <Field.HelperText>Es tria la més llarga que hi cap.</Field.HelperText>
        </Field.Root>
        <SimpleGrid columns={{ base: 2, md: 3 }} gap={3}>
          <NumberField label="Joc lateral (costat)" value={h.drawer.sideClearance} min={0} max={30} step={0.5} onChange={(sideClearance) => sub("drawer", { sideClearance })} />
          <NumberField label="Gruix caixa" value={h.drawer.boxThickness} min={8} max={25} step={1} onChange={(boxThickness) => sub("drawer", { boxThickness })} />
          <NumberField label="Gruix fons caixa" value={h.drawer.bottomThickness} min={3} max={16} step={1} onChange={(bottomThickness) => sub("drawer", { bottomThickness })} />
          <NumberField label="Front − caixa" value={h.drawer.boxDrop} min={0} max={100} step={1} onChange={(boxDrop) => sub("drawer", { boxDrop })} />
          <NumberField label="Fons des de baix" value={h.drawer.bottomOffset} min={0} max={40} step={1} onChange={(bottomOffset) => sub("drawer", { bottomOffset })} />
          <NumberField label="Joc amb el fons" value={h.drawer.backClearance} min={0} max={60} step={1} onChange={(backClearance) => sub("drawer", { backClearance })} />
        </SimpleGrid>
      </Group>
      <Group title="Imants (reixetes i trapes)" icon={LuSquareStack}>
        <SimpleGrid columns={3} gap={3}>
          <NumberField label="Ø" value={h.magnet.diameter} min={5} max={20} step={1} onChange={(diameter) => sub("magnet", { diameter })} />
          <NumberField label="Fondària" value={h.magnet.depth} min={2} max={15} step={0.5} onChange={(depth) => sub("magnet", { depth })} />
          <NumberField label="A la cantonada" value={h.magnet.cornerOffset} min={20} max={200} step={5} onChange={(cornerOffset) => sub("magnet", { cornerOffset })} />
        </SimpleGrid>
      </Group>
    </Stack>
  )
}

function Group({ title, icon: Icon, children }: { title: string; icon: IconType; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <HStack gap={2} color="fg.muted">
        <Icon />
        <Text fontSize="sm" fontWeight="semibold">
          {title}
        </Text>
      </HStack>
      {children}
    </Stack>
  )
}
