import { useTheme } from "next-themes"
import { ACCENTS, useAccent } from "../../theme/accent"
import { QUALITY_LABELS, useRenderQuality, type RenderQuality } from "../../components/viewer/renderQuality"
import { FLOORS, LIGHTS, SKIRTINGS, WALLS, usePresentationScene, type FloorId } from "../../components/viewer/presentationScene"
import { floorSwatchUrl } from "../../components/viewer/PresentationRoom"
import type { Composition } from "../../core/model"
import { ScenePreview } from "./ScenePreview"
import {
  Alert,
  Badge,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  Grid,
  GridItem,
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
import { Children, Fragment, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { LuArrowDown, LuArrowUp, LuCheck, LuChevronLeft, LuChevronRight, LuCopy, LuDoorClosed, LuDownload, LuEye, LuEyeOff, LuFileDown, LuGrid3X3, LuHammer, LuImage, LuImagePlus, LuLampFloor, LuLayoutGrid, LuMonitor, LuMoon, LuPalette, LuPlus, LuRotateCcw, LuRows3, LuRuler, LuScan, LuScissors, LuSparkles, LuSquareStack, LuSun, LuSunMoon, LuTag, LuTrash2, LuUpload } from "react-icons/lu"
import type { IconType } from "react-icons"
import { SettingsGroup } from "../../components/SettingsGroup"
import { MasterDetail } from "../../components/MasterDetail"
import { useSessionString } from "./useSessionString"
import { MaterialPreview, ThicknessChips } from "./MaterialBits"
import { toaster } from "../../components/ui/toaster"
import {
  DEFAULT_SETTINGS,
  MATERIAL_CATEGORIES,
  materialCategory,
  withCategory,
  type MaterialCategory,
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
import { fileAccept } from "../file/fileAccept"

type SectionKey = keyof Omit<Settings, "version">

/** Missatge en català d'un problema de validació. */
function issueText(issue: { path: PropertyKey[]; code: string; message: string; minimum?: unknown; maximum?: unknown }): string {
  const path = issue.path.map(String).join(" › ")
  if (issue.code === "too_small" && typeof issue.minimum === "number") return `${path}: mínim ${issue.minimum}`
  if (issue.code === "too_big" && typeof issue.maximum === "number") return `${path}: màxim ${issue.maximum}`
  if (issue.code === "invalid_type") return `${path}: cal un valor`
  return `${path}: ${issue.message}`
}

export function SettingsScreen({ previewComposition }: { previewComposition?: Composition }) {
  const { settings, loading, save } = useSettings()
  if (loading) return null
  return <SettingsEditor key={JSON.stringify(settings.version)} initial={settings} save={save} previewComposition={previewComposition} />
}

function SettingsEditor({ initial, save, previewComposition }: { initial: Settings; save: (s: Settings) => Promise<void>; previewComposition?: Composition }) {
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
      <SettingsPages
        header={
          <Stack gap={4}>
      <HStack justify="space-between" wrap="wrap" gap={3}>
        <Heading size="xl">Preferències</Heading>
        <HStack>
          <input ref={fileInput} type="file" accept={fileAccept("application/json,.json")} hidden onChange={(e) => void doImport(e.target.files?.[0])} />
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

          </Stack>
        }
      >
          <Pane id="references" wide title="Objectes de referència" icon={LuScan} desc="Mides conegudes per calibrar la foto i per veure-les al costat del moble." onReset={() => setReset({ key: "references", label: "Objectes de referència" })}>
            <Text fontSize="sm" color="fg.muted" maxW="3xl">
              Una sola llista per a la foto (es calibra amb la cara del davant, amplada × alçada) i per a l'editor (fantasma 3D,
              cal fondària). La distància a la paret corregeix l'escala si l'objecte no hi toca.
            </Text>
            <ReferencesList refs={draft.references} onChange={(references) => set("references", references)} />
          </Pane>

          <Pane id="materials" wide title="Materials" icon={LuPalette} desc="Taulers, fons, metall, pedra i vidre, i els de simulació per als ambients." onReset={() => setReset({ key: "materials", label: "Materials" })}>
            <SettingsGroup icon={<LuSquareStack />} title="Per defecte als mòduls nous" summary={`${draft.defaults.material} ${draft.defaults.thickness} · fons ${draft.defaults.backMaterial} ${draft.defaults.backThickness}`}>
            <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
              <MaterialSelect label="Tauler" materials={draft.materials.filter((m) => !m.forBacks && m.category !== "sim")} value={draft.defaults.material} onChange={(material) => set("defaults", { ...draft.defaults, material })} />
              <NumberField label="Gruix tauler" value={draft.defaults.thickness} min={8} max={40} step={1} onChange={(thickness) => set("defaults", { ...draft.defaults, thickness })} />
              <MaterialSelect label="Fons" materials={draft.materials} value={draft.defaults.backMaterial} onChange={(backMaterial) => set("defaults", { ...draft.defaults, backMaterial })} />
              <NumberField label="Gruix fons" value={draft.defaults.backThickness} min={3} max={40} step={1} onChange={(backThickness) => set("defaults", { ...draft.defaults, backThickness })} />
            </SimpleGrid>
            </SettingsGroup>
            <MaterialsList materials={draft.materials} onChange={(materials) => set("materials", materials)} />
          </Pane>

          <Pane id="boards" title="Taulers i nesting" icon={LuLayoutGrid} desc="Mides dels taulers i com es talla." onReset={() => setReset({ key: "boards", label: "Taulers i nesting" })}>
            <Stack gap={3}>
            <SettingsGroup icon={<LuLayoutGrid />} title="Mides de tauler" summary={draft.boards.sheets.map((x) => `${x.w}×${x.h}`).join(" · ")}>
            {/* Taula en graella: capçalera una sola vegada i una fila per mida. */}
            <Grid templateColumns={{ base: "minmax(0, 1fr) minmax(0, 1fr) 32px", sm: "minmax(0, 1fr) 150px 150px 32px" }} gap={2} alignItems="center">
              <Text textStyle="xs" color="fg.muted" display={{ base: "none", sm: "block" }}>Material</Text>
              <Text textStyle="xs" color="fg.muted">Llarg</Text>
              <Text textStyle="xs" color="fg.muted">Ample</Text>
              <span />
              {draft.boards.sheets.map((s, i) => {
                const update = (patch: Partial<typeof s>) => set("boards", { ...draft.boards, sheets: draft.boards.sheets.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
                return (
                  <Fragment key={i}>
                    {/* Al mòbil, el material ocupa tota la fila i les mides van a sota. */}
                    <NativeSelect.Root size="sm" gridColumn={{ base: "1 / -1", sm: "auto" }} mt={{ base: i > 0 ? 2 : 0, sm: 0 }}>
                      <NativeSelect.Field aria-label="Material" value={s.material} onChange={(e) => update({ material: e.target.value })}>
                        <option value="">Tots els altres</option>
                        {draft.materials.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <NumberField label="" value={s.w} min={300} max={6000} step={10} onChange={(w) => update({ w })} />
                    <NumberField label="" value={s.h} min={300} max={6000} step={10} onChange={(h) => update({ h })} />
                    <IconButton aria-label="Eliminar tauler" size="sm" variant="ghost" colorPalette="red" disabled={draft.boards.sheets.length <= 1} onClick={() => set("boards", { ...draft.boards, sheets: draft.boards.sheets.filter((_, k) => k !== i) })}>
                      <LuTrash2 />
                    </IconButton>
                  </Fragment>
                )
              })}
            </Grid>
            <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={() => set("boards", { ...draft.boards, sheets: [...draft.boards.sheets, { material: "", w: 2440, h: 1220 }] })}>
              <LuPlus /> Afegir mida de tauler
            </Button>
            </SettingsGroup>
            <SettingsGroup icon={<LuScissors />} title="Tall" summary={`kerf ${draft.boards.kerf} · marge ${draft.boards.margin}${draft.boards.ignoreGrain ? " · gira amb veta" : ""}`}>
            <SimpleGrid columns={2} gap={3}>
              <NumberField label="Kerf (fresa)" value={draft.boards.kerf} min={0} max={30} step={0.5} onChange={(kerf) => set("boards", { ...draft.boards, kerf })} />
              <NumberField label="Marge del tauler" value={draft.boards.margin} min={0} max={100} step={1} onChange={(margin) => set("boards", { ...draft.boards, margin })} />
            </SimpleGrid>
            <Switch.Root size="sm" checked={draft.boards.ignoreGrain} onCheckedChange={(e) => set("boards", { ...draft.boards, ignoreGrain: e.checked })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label>Permetre girar les peces encara que tinguin veta</Switch.Label>
            </Switch.Root>
            </SettingsGroup>
            </Stack>
          </Pane>

          <Pane id="hardware" title="Ferratges i mecanitzats" icon={LuHammer} desc="Frontisses, guies, espigues i forats." onReset={() => setReset({ key: "hardware", label: "Ferratges i mecanitzats" })}>
            <HardwareForm hardware={draft.hardware} onChange={(hardware) => set("hardware", hardware)} />
          </Pane>

          <Pane id="gaps" title="Jocs per defecte" icon={LuRuler} desc="Separacions dels fronts, prestatges i fons." onReset={() => setReset({ key: "gaps", label: "Jocs per defecte" })}>
            <FoldGrid>
            <SettingsGroup icon={<LuDoorClosed />} title="Fronts" summary={`porta–cos ${draft.gaps.outerGap} · entre fronts ${draft.gaps.betweenGap}`}>
            <SimpleGrid columns={2} gap={3}>
              <NumberField label="Porta–cos" value={draft.gaps.outerGap} min={0} max={10} step={0.5} onChange={(outerGap) => set("gaps", { ...draft.gaps, outerGap })} />
              <NumberField label="Entre fronts" value={draft.gaps.betweenGap} min={0} max={10} step={0.5} onChange={(betweenGap) => set("gaps", { ...draft.gaps, betweenGap })} />
            </SimpleGrid>
            </SettingsGroup>
            <SettingsGroup icon={<LuRows3 />} title="Prestatges i fons" summary={`prestatge ${draft.gaps.shelfClearance} / ${draft.gaps.shelfSetback} · ranura ${draft.gaps.backSetback} × ${draft.gaps.grooveDepth}`}>
            <SimpleGrid columns={2} gap={3}>
              <NumberField label="Prestatge (joc)" value={draft.gaps.shelfClearance} min={0} max={5} step={0.5} onChange={(shelfClearance) => set("gaps", { ...draft.gaps, shelfClearance })} />
              <NumberField label="Prestatge (retranq.)" value={draft.gaps.shelfSetback} min={0} max={100} step={1} onChange={(shelfSetback) => set("gaps", { ...draft.gaps, shelfSetback })} />
              <NumberField label="Fons (joc)" value={draft.gaps.backClearance} min={0} max={4} step={0.5} onChange={(backClearance) => set("gaps", { ...draft.gaps, backClearance })} />
              <NumberField label="Ranura del fons" value={draft.gaps.backSetback} min={0} max={60} step={1} help="Distància al cantell posterior" onChange={(backSetback) => set("gaps", { ...draft.gaps, backSetback })} />
              <NumberField label="Fondària ranura" value={draft.gaps.grooveDepth} min={3} max={15} step={1} onChange={(grooveDepth) => set("gaps", { ...draft.gaps, grooveDepth })} />
            </SimpleGrid>
            </SettingsGroup>
            </FoldGrid>
          </Pane>

          <Pane id="label" title="Etiquetes" icon={LuTag} desc="Mida de l'etiqueta de les peces." onReset={() => setReset({ key: "label", label: "Etiquetes" })}>
            <Text fontSize="sm" color="fg.muted">
              Mida de l'etiqueta per triar on s'enganxa (PosX/PosY del CSV del taller). Per defecte 99 × 68, Avery L7165.
            </Text>
            <SimpleGrid columns={2} gap={3}>
              <NumberField label="Amplada" value={draft.label.w} min={10} max={300} step={1} onChange={(w) => set("label", { ...draft.label, w })} />
              <NumberField label="Alçada" value={draft.label.h} min={10} max={300} step={1} onChange={(h) => set("label", { ...draft.label, h })} />
            </SimpleGrid>
          </Pane>

          <Pane id="display" title="Visualització" icon={LuGrid3X3} desc="Unitat de les mides a la pantalla." onReset={() => setReset({ key: "display", label: "Visualització" })}>
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
          </Pane>

          <Pane id="theme" title="Tema" icon={LuSunMoon} desc="Dia o nit i el color principal de l'app.">
            <FoldGrid>
              <SettingsGroup icon={<LuSunMoon />} title="Aparença" summary="Dia · Nit · Com el sistema">
                <ThemeField />
              </SettingsGroup>
              <SettingsGroup icon={<LuPalette />} title="Color principal" summary="Botons, seleccions i ressaltats">
                <AccentField />
              </SettingsGroup>
            </FoldGrid>
          </Pane>

          <Pane id="viewer3d" title="Visor 3D" icon={LuLampFloor} desc="Qualitat del visor i l'escena del mode Presentació.">
            <SceneFields previewComposition={previewComposition} />
          </Pane>
      </SettingsPages>

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

/** Categories dels apartats de Preferències. */
const SETTINGS_GROUPS: { label: string; ids: string[] }[] = [
  { label: "Fabricació", ids: ["materials", "boards", "hardware", "gaps", "label"] },
  { label: "Foto i visor 3D", ids: ["references", "viewer3d"] },
  { label: "App", ids: ["display", "theme"] },
]

interface PaneProps {
  id: string
  title: string
  icon: IconType
  desc?: string
  onReset?: () => void
  wide?: boolean
  children: ReactNode
}

/** Una pàgina de Preferències (només en llegeix les propietats `SettingsPages`). */
function Pane(_: PaneProps): ReactNode {
  return null
}

/**
 * Preferències com les apps professionals (Configuració de macOS, Figma, VS Code): a l'esquerra
 * la llista d'apartats i a la dreta la pàgina triada, amb els grups d'opcions a la vista (res no
 * s'obre de cop). Al mòbil: la llista d'apartats i, en triar-ne un, la seva pàgina amb «‹ Preferències».
 */
function SettingsPages({ header, children }: { header: ReactNode; children: ReactNode }) {
  const panes = Children.toArray(children)
    .filter(isValidElement)
    .map((c) => c.props as PaneProps)
  const [active, setActive] = useSessionString("mobles:settings-section")
  // Apartats agrupats per categoria (com la Configuració de macOS): el que no hi surti, a «Altres».
  const groups = SETTINGS_GROUPS.map((g) => ({ label: g.label, panes: g.ids.flatMap((id) => panes.filter((p) => p.id === id)) }))
  const rest = panes.filter((p) => !SETTINGS_GROUPS.some((g) => g.ids.includes(p.id)))
  if (rest.length) groups.push({ label: "Altres", panes: rest })
  const ordered = groups.flatMap((g) => g.panes)
  const cur = panes.find((p) => p.id === active) ?? null
  const shown = cur ?? ordered[0]!
  const Icon = shown.icon
  return (
    <Stack gap={5}>
    {/* Capçalera (títol, importar/exportar): al mòbil, només a la llista d'apartats. */}
    <Box display={{ base: cur ? "none" : "block", md: "block" }}>{header}</Box>
    <Flex gap={6} align="flex-start">
      {/* Llista d'apartats: a l'ordinador sempre; al mòbil, només si no n'hi ha cap d'obert. */}
      <Stack as="nav" aria-label="Apartats de Preferències" w={{ base: "full", md: "230px" }} flexShrink={0} gap={0.5} display={{ base: cur ? "none" : "flex", md: "flex" }} position={{ md: "sticky" }} top={{ md: 0 }}>
        {groups.map((g) => (
        <Stack key={g.label} gap={1} mb={{ base: 3, md: 2 }}>
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide" px={{ base: 1, md: 3 }}>
          {g.label}
        </Text>
        <Box borderWidth={{ base: "1px", md: 0 }} rounded="lg" overflow="hidden" bg={{ base: "bg.panel", md: "transparent" }}>
          {g.panes.map((p, i) => {
            const on = p.id === shown.id
            const PIcon = p.icon
            return (
              <HStack
                key={p.id}
                as="button"
                w="full"
                gap={3}
                px={3}
                py={{ base: 3, md: 2 }}
                rounded={{ md: "md" }}
                borderTopWidth={{ base: i ? "1px" : 0, md: 0 }}
                textAlign="left"
                cursor="pointer"
                bg={{ md: on ? "wood.subtle" : undefined }}
                color={{ md: on ? "wood.fg" : undefined }}
                fontWeight={{ md: on ? "semibold" : "normal" }}
                _hover={{ bg: { base: "bg.muted", md: on ? "wood.subtle" : "bg.muted" } }}
                aria-current={on ? "page" : undefined}
                onClick={() => setActive(p.id)}
              >
                <Box color="wood.fg" display="inline-flex">
                  <PIcon />
                </Box>
                <Stack gap={0} flex={1} minW={0}>
                  <Text fontSize="sm" truncate>
                    {p.title}
                  </Text>
                  {p.desc && (
                    <Text fontSize="xs" color="fg.muted" truncate display={{ md: "none" }}>
                      {p.desc}
                    </Text>
                  )}
                </Stack>
                <Box color="fg.subtle" display={{ base: "inline-flex", md: "none" }}>
                  <LuChevronRight />
                </Box>
              </HStack>
            )
          })}
        </Box>
        </Stack>
        ))}
      </Stack>
      <Stack flex={1} minW={0} gap={4} display={{ base: cur ? "flex" : "none", md: "flex" }}>
        <Button display={{ base: "inline-flex", md: "none" }} variant="ghost" size="sm" alignSelf="flex-start" ml={-2} onClick={() => setActive(null)}>
          <LuChevronLeft /> Preferències
        </Button>
        <HStack justify="space-between" gap={3} wrap="wrap" w="full" maxW={shown.wide ? "none" : "760px"}>
          <HStack gap={2.5}>
            <Box color="wood.fg" fontSize="xl" display="inline-flex">
              <Icon />
            </Box>
            <Stack gap={0}>
              <Heading size="lg">{shown.title}</Heading>
              {shown.desc && (
                <Text fontSize="sm" color="fg.muted">
                  {shown.desc}
                </Text>
              )}
            </Stack>
          </HStack>
          {shown.onReset && (
            <Button size="xs" variant="ghost" colorPalette="red" onClick={shown.onReset}>
              <LuRotateCcw /> Restaurar valors inicials
            </Button>
          )}
        </HStack>
        <Stack gap={3} w="full" maxW={shown.wide ? "none" : "760px"}>
          {shown.children}
        </Stack>
      </Stack>
    </Flex>
    </Stack>
  )
}

/**
 * Grups d'una pàgina de Preferències: una sola columna, un sota l'altre (com la Configuració de
 * macOS o Figma): es llegeix de dalt a baix, sense forats, i tots els camps tenen el mateix ample.
 */
function FoldGrid({ children }: { children: ReactNode }) {
  return <Stack gap={3}>{children}</Stack>
}

// --- Objectes de referència --------------------------------------------------------------

function ReferencesList({ refs, onChange }: { refs: RefPreset[]; onChange: (r: RefPreset[]) => void }) {
  const [sel, setSel] = useSessionString("mobles:settings-ref")
  const [query, setQuery] = useState("")
  const update = (i: number, patch: Partial<RefPreset>) => onChange(refs.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= refs.length) return
    const next = [...refs]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }
  const add = () => {
    const r: RefPreset = { id: newId("ref"), name: "Objecte nou", w: 600, h: 600, plane: "wall", wallOffset: 0 }
    onChange([r, ...refs])
    setSel(r.id)
  }
  const duplicate = (i: number) => {
    const src = refs[i]!
    const copy: RefPreset = { ...src, id: newId("ref"), name: `${src.name} (còpia)`, builtin: undefined, hidden: undefined }
    const next = [...refs]
    next.splice(i + 1, 0, copy)
    onChange(next)
    setSel(copy.id)
  }
  const q = query.trim().toLowerCase()
  const shown = refs.filter((r) => !q || r.name.toLowerCase().includes(q))
  const i = refs.findIndex((r) => r.id === sel)
  const r = i >= 0 ? refs[i]! : null
  return (
    <MasterDetail
      groups={[
        {
          id: "refs",
          label: "Objectes",
          hint: "Els inicials es poden amagar; els teus, eliminar.",
          items: shown.map((x) => ({
            id: x.id,
            lead: <LuScan />,
            title: x.name,
            subtitle: `${x.w} × ${x.h}${x.d ? ` × ${x.d}` : ""} mm · ${x.plane === "floor" ? "terra" : "paret"}`,
            badge: x.builtin ? (
              <Badge size="xs" variant="subtle">
                inicial
              </Badge>
            ) : undefined,
            dimmed: x.hidden,
          })),
        },
      ]}
      selected={r ? r.id : null}
      onSelect={setSel}
      query={query}
      onQuery={setQuery}
      addLabel="Afegir"
      onAdd={add}
      backLabel="Objectes de referència"
      empty={<Text fontSize="sm" color="fg.muted">Tria un objecte de la llista per editar-lo.</Text>}
      detail={
        r && (
          <SettingsGroup
            icon={<LuScan />}
            title={r.name}
            summary={r.builtin ? "Objecte inicial (es pot amagar, no eliminar)" : "Objecte teu"}
            actions={
              <>
                <IconButton aria-label="Pujar a la llista" size="xs" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                  <LuArrowUp />
                </IconButton>
                <IconButton aria-label="Baixar a la llista" size="xs" variant="ghost" disabled={i === refs.length - 1} onClick={() => move(i, 1)}>
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
                  <IconButton
                    aria-label="Eliminar objecte"
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => {
                      onChange(refs.filter((_, k) => k !== i))
                      setSel(null)
                    }}
                  >
                    <LuTrash2 />
                  </IconButton>
                )}
              </>
            }
          >
            <Field.Root>
              <Field.Label fontSize="sm">Nom</Field.Label>
              <Input size="sm" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
            </Field.Root>
            <Grid templateColumns="repeat(6, minmax(0, 1fr))" gap={2}>
              <GridItem colSpan={2}>
                <NumberField label="Amplada" value={r.w} min={1} max={10000} step={10} onChange={(w) => update(i, { w })} />
              </GridItem>
              <GridItem colSpan={2}>
                <NumberField label="Alçada" value={r.h} min={1} max={10000} step={10} onChange={(h) => update(i, { h })} />
              </GridItem>
              <GridItem colSpan={2}>
                <NumberField label="Fondària" value={r.d ?? NaN} min={1} max={10000} step={10} help={r.d ? undefined : "Buida: només foto"} onChange={(d) => update(i, { d: Number.isFinite(d) && d > 0 ? d : undefined })} />
              </GridItem>
              <Field.Root gridColumn="span 3">
                <Field.Label fontSize="sm">Pla</Field.Label>
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field value={r.plane} onChange={(e) => update(i, { plane: e.target.value as RefPreset["plane"] })}>
                    <option value="wall">Paret</option>
                    <option value="floor">Terra</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
              <GridItem colSpan={3}>
                <NumberField label="A la paret" value={r.wallOffset} min={0} max={5000} step={10} onChange={(wallOffset) => update(i, { wallOffset })} />
              </GridItem>
            </Grid>
          </SettingsGroup>
        )
      }
    />
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
  const [sel, setSel] = useSessionString("mobles:settings-material")
  const [cat, setCat] = useSessionString("mobles:settings-material-cat")
  const [query, setQuery] = useState("")
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const update = (i: number, patch: Partial<MaterialPref>) => onChange(materials.map((m, k) => (k === i ? { ...m, ...patch } : m)))
  const uniqueName = (base: string) => {
    const names = new Set(materials.map((m) => m.name))
    if (!names.has(base)) return base
    let n = 2
    while (names.has(`${base} ${n}`)) n++
    return `${base} ${n}`
  }
  const add = () => {
    // A la categoria que es mira (si n'hi ha una de triada); amb nom únic i el nom a punt d'escriure.
    const base: MaterialPref = { id: newId("mat"), name: uniqueName("Material nou"), thicknesses: [19], hasGrain: false, finish: { kind: "color", color: "#e5e5e5" }, edge: "" }
    const m = cat && cat !== "all" ? withCategory(base, cat as MaterialCategory) : base
    onChange([m, ...materials])
    setSel(m.id)
    setJustAdded(m.id)
  }
  const q = query.trim().toLowerCase()
  const filterId = cat ?? "all"
  const i = materials.findIndex((m) => m.id === sel)
  const m = i >= 0 ? materials[i]! : null
  return (
    <MasterDetail
      // Per categories: Taulers · Fons · Metall, pedra i vidre · Simulació.
      filters={[{ id: "all", label: "Tots", count: materials.length }, ...MATERIAL_CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: materials.filter((x) => materialCategory(x) === c.id).length }))]}
      filter={filterId}
      onFilter={setCat}
      groups={MATERIAL_CATEGORIES.filter((c) => filterId === "all" || c.id === filterId).map((c) => ({
        id: c.id,
        label: c.label,
        hint: c.hint,
        items: materials
          .filter((x) => materialCategory(x) === c.id && (!q || x.name.toLowerCase().includes(q)))
          .map((x) => ({ id: x.id, lead: <MaterialSwatch m={x} />, title: x.name, subtitle: `${x.thicknesses.join(" · ")} mm · ${FINISH_LABEL[x.finish.kind]}${x.edge ? ` · ${x.edge}` : ""}` })),
      }))}
      selected={m ? m.id : null}
      onSelect={setSel}
      query={query}
      onQuery={setQuery}
      addLabel="Afegir"
      onAdd={add}
      backLabel="Materials"
      empty={<Text fontSize="sm" color="fg.muted">Tria un material de la llista per editar-lo.</Text>}
      detail={
        m && (
          <MaterialCard
            key={m.id}
            m={m}
            onChange={(patch) => update(i, patch)}
            autoFocusName={justAdded === m.id}
            onDuplicate={() => {
              const copy = { ...m, id: newId("mat"), name: uniqueName(`${m.name} (còpia)`) }
              const next = [...materials]
              next.splice(i + 1, 0, copy)
              onChange(next)
              setSel(copy.id)
            }}
            onDelete={() => {
              onChange(materials.filter((_, k) => k !== i))
              setSel(null)
            }}
            canDelete={materials.length > 1}
          />
        )
      }
    />
  )
}

/** Mostra del material (color, fusta o la foto de la textura). */
function MaterialSwatch({ m, size = "18px" }: { m: MaterialPref; size?: string }) {
  const f = m.finish
  const swatch = f.kind === "wood" || f.kind === "image" ? undefined : f.color
  return <Box w={size} h={size} rounded="sm" borderWidth="1px" flexShrink={0} bg={swatch} bgImage={f.kind === "wood" ? "repeating-linear-gradient(90deg, #b98b57 0 2px, #a3763f 2px 3px)" : f.kind === "image" ? `url(${f.src})` : undefined} bgSize="cover" />
}

const FINISH_LABEL: Record<Finish["kind"], string> = { color: "color llis", lacquer: "lacat", wood: "fusta", image: "foto real", metal: "metall", glass: "vidre", fabric: "teixit", tiles: "rajola" }

function MaterialCard({ m, onChange, onDuplicate, onDelete, canDelete, autoFocusName }: { m: MaterialPref; onChange: (p: Partial<MaterialPref>) => void; onDuplicate: () => void; onDelete: () => void; canDelete: boolean; autoFocusName?: boolean }) {
  const finish = m.finish
  // Fotos d'abans (sense proporció): es mesura la imatge un cop.
  const needsAspect = finish.kind === "image" && finish.aspect === undefined ? finish.src : null
  useEffect(() => {
    if (!needsAspect || finish.kind !== "image") return
    const img = new Image()
    img.onload = () => img.width && onChange({ finish: { ...finish, aspect: Math.round((img.height / img.width) * 1000) / 1000 } })
    img.src = needsAspect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAspect])
  const swatch = finish.kind === "wood" || finish.kind === "image" ? undefined : finish.color
  return (
    <SettingsGroup
      icon={<MaterialSwatch m={m} size="22px" />}
      title={
        <HStack gap={1.5} as="span">
          <span>{m.name}</span>
        </HStack>
      }
      summary={`${m.thicknesses.join(" · ")} mm · ${FINISH_LABEL[finish.kind]}${m.edge ? ` · ${m.edge}` : ""}`}
      actions={
        <>
          <IconButton aria-label="Duplicar material" size="xs" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
          <IconButton aria-label="Eliminar material" size="xs" variant="ghost" colorPalette="red" disabled={!canDelete} onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </>
      }
    >
      {/* A dalt: la mostra a escala real al costat del nom i els gruixos. */}
      <Flex gap={4} direction={{ base: "column", sm: "row" }} align={{ sm: "flex-start" }}>
        <MaterialPreview m={m} />
        <Stack gap={3} flex={1} minW={0}>
          <Field.Root>
            <Field.Label fontSize="sm">Nom</Field.Label>
            <Input size="sm" value={m.name} onChange={(e) => onChange({ name: e.target.value })} autoFocus={autoFocusName} onFocus={(e) => autoFocusName && e.currentTarget.select()} />
          </Field.Root>
          <ThicknessChips value={m.thicknesses} onChange={(thicknesses) => onChange({ thicknesses })} />
        </Stack>
      </Flex>
        <SimpleGrid columns={2} gap={2}>
          <Field.Root>
            <Field.Label fontSize="sm">Acabat</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={finish.kind}
                onChange={(e) => {
                  const k = e.target.value as Finish["kind"]
                  if (k === "image") {
                    // Primer cal triar la foto; si es cancel·la, l'acabat no canvia.
                    void pickTexture().then((t) => t && onChange({ finish: { kind: "image", tileMm: 800, ...t } }))
                    return
                  }
                  const color = swatch ?? "#e5e5e5"
                  onChange({ finish: k === "wood" ? { kind: "wood", species: "oak" } : k === "tiles" ? { kind: "tiles", color, grout: "#cfcac0", size: 600 } : { kind: k, color } })
                }}
              >
                <option value="color">Color llis</option>
                <option value="lacquer">Lacat</option>
                <option value="wood">Fusta</option>
                <option value="image">Foto (textura)</option>
                <option value="metal">Metall</option>
                <option value="glass">Vidre</option>
                <option value="fabric">Teixit</option>
                <option value="tiles">Rajola</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          {finish.kind === "image" ? (
            <Field.Root>
              <Field.Label fontSize="sm">Amplada de la foto</Field.Label>
              <HStack gap={1.5} w="full">
                <Input
                  size="sm"
                  type="number"
                  inputMode="numeric"
                  value={finish.tileMm}
                  min={50}
                  max={5000}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (v >= 50 && v <= 5000) onChange({ finish: { ...finish, tileMm: v } })
                  }}
                  title="Quants mm de tauler de debò surten a la foto (d'esquerra a dreta)"
                />
                <IconButton
                  size="sm"
                  variant="outline"
                  aria-label="Canviar la foto"
                  title="Canviar la foto"
                  onClick={() => void pickTexture().then((t) => t && onChange({ finish: { ...finish, ...t } }))}
                >
                  <LuImage />
                </IconButton>
              </HStack>
            </Field.Root>
          ) : finish.kind === "wood" ? (
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
              {/* Mostra de color compacta amb el codi al costat (no una barra de punta a punta). */}
              <HStack gap={2}>
                <Input size="sm" type="color" value={finish.color} onChange={(e) => onChange({ finish: { ...finish, color: e.target.value } })} p={0.5} w="44px" flexShrink={0} aria-label="Color" />
                <Input size="sm" key={finish.color} defaultValue={finish.color} onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value.trim()) && onChange({ finish: { ...finish, color: e.target.value.trim() } })} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} fontFamily="mono" aria-label="Codi del color" />
              </HStack>
            </Field.Root>
          )}
          {finish.kind === "tiles" && (
            <>
              <NumberField label="Mida de la rajola" value={finish.size} min={20} max={1500} step={10} onChange={(size) => onChange({ finish: { ...finish, size } })} />
              <Field.Root>
                <Field.Label fontSize="sm">Junta</Field.Label>
                <Input size="sm" type="color" value={finish.grout} onChange={(e) => onChange({ finish: { ...finish, grout: e.target.value } })} p={0.5} w="44px" aria-label="Color de la junta" />
              </Field.Root>
            </>
          )}
          <Field.Root>
            <Field.Label fontSize="sm">Cantell</Field.Label>
            <Input size="sm" value={m.edge} onChange={(e) => onChange({ edge: e.target.value })} placeholder="PVC blanc 1 mm" />
          </Field.Root>
        </SimpleGrid>
        {/* Textura amb imatge: a la vista, no només com a opció de l'Acabat. */}
        {finish.kind === "image" ? (
          <HStack gap={3} align="center">
            <Box w="72px" h="48px" rounded="sm" borderWidth="1px" flexShrink={0} bgImage={`url(${finish.src})`} bgSize="cover" backgroundPosition="center" />
            <Stack gap={1} flex={1} minW={0}>
              <Text fontSize="xs" color="fg.muted">
                {finish.tileMm} × {Math.round(finish.tileMm * (finish.aspect ?? 1))} mm de tauler per repetició,{" "}
                {finish.seamless ? "repetida tal qual" : "en mirall"}.
              </Text>
              <Switch.Root size="sm" checked={!!finish.seamless} onCheckedChange={(e) => onChange({ finish: { ...finish, seamless: e.checked || undefined } })}>
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label fontSize="xs">Sense costures (seamless): repetir sense mirall</Switch.Label>
              </Switch.Root>
              <HStack gap={1.5}>
                <Button size="xs" variant="outline" onClick={() => void pickTexture().then((t) => t && onChange({ finish: { ...finish, ...t } }))}>
                  <LuImagePlus /> Canviar la foto
                </Button>
                <Button size="xs" variant="ghost" colorPalette="red" onClick={() => onChange({ finish: m.hasGrain ? { kind: "wood", species: "oak" } : { kind: "color", color: "#e5e5e5" } })}>
                  <LuTrash2 /> Treure-la
                </Button>
              </HStack>
            </Stack>
          </HStack>
        ) : (
          <HStack gap={2} wrap="wrap">
            <Button size="xs" variant="outline" onClick={() => void pickTexture().then((t) => t && onChange({ finish: { kind: "image", tileMm: 800, ...t } }))}>
              <LuImagePlus /> Posar una foto de textura
            </Button>
            <Text fontSize="xs" color="fg.muted">
              Una foto del tauler de debò (fusta, laminat, pedra).
            </Text>
          </HStack>
        )}
        <HStack gap={5} wrap="wrap">
          <Switch.Root size="sm" checked={m.hasGrain} onCheckedChange={(e) => onChange({ hasGrain: e.checked })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>Té veta</Switch.Label>
          </Switch.Root>
        </HStack>
        <Field.Root>
          <Field.Label fontSize="sm">Categoria</Field.Label>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={materialCategory(m)}
              onChange={(e) => {
                const next = withCategory(m, e.target.value as MaterialCategory)
                // Replaça tot el material: `forBacks` i `cnc` poden desaparèixer.
                onChange({ ...next, forBacks: next.forBacks, cnc: next.cnc, category: next.category })
              }}
            >
              {MATERIAL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Field.HelperText>{MATERIAL_CATEGORIES.find((c) => c.id === materialCategory(m))!.hint}</Field.HelperText>
        </Field.Root>
    </SettingsGroup>
  )
}

export function MaterialSelect({ label, materials, value, onChange, emptyLabel }: { label: string; materials: MaterialPref[]; value: string; onChange: (name: string) => void; emptyLabel?: string }) {
  const known = materials.some((m) => m.name === value) || (emptyLabel !== undefined && value === "")
  return (
    <Field.Root>
      <Field.Label fontSize="sm">{label}</Field.Label>
      <NativeSelect.Root size="sm">
        <NativeSelect.Field value={value} onChange={(e) => onChange(e.target.value)}>
          {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
          {!known && <option value={value}>{value || "(sense material)"}</option>}
          {MATERIAL_CATEGORIES.map((c) => {
            const list = materials.filter((m) => materialCategory(m) === c.id)
            return list.length ? (
              <optgroup key={c.id} label={c.label}>
                {list.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ) : null
          })}
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
    <FoldGrid>
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
    </FoldGrid>
  )
}

function Group({ title, icon: Icon, children }: { title: string; icon: IconType; children: ReactNode }) {
  return (
    <SettingsGroup icon={<Icon />} title={title}>
      {children}
    </SettingsGroup>
  )
}

/**
 * Aparença (clar / fosc / com el sistema). És una preferència del dispositiu, no de les
 * dades: la desa next-themes al navegador, no s'exporta amb les preferències.
 */
function ThemeField() {
  const { theme, setTheme } = useTheme()
  return (
    <Field.Root>
      <Field.Label>Aparença</Field.Label>
      <SegmentGroup.Root size="sm" value={theme ?? "system"} onValueChange={(e) => e.value && setTheme(e.value)}>
        <SegmentGroup.Indicator />
        {(
          [
            ["light", "Dia", LuSun],
            ["dark", "Nit", LuMoon],
            ["system", "Com el sistema", LuMonitor],
          ] as const
        ).map(([v, label, Icon]) => (
          <SegmentGroup.Item key={v} value={v}>
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <Icon /> {label}
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
    </Field.Root>
  )
}

function AccentField() {
  const [accent, setAccent] = useAccent()
  return (
    <Field.Root>
      <Field.Label>Color principal</Field.Label>
      <HStack gap={2} wrap="wrap" role="radiogroup" aria-label="Color principal">
        {ACCENTS.map((a) => {
          const on = a.id === accent
          return (
            <Box
              key={a.id}
              asChild
              w="36px"
              h="36px"
              rounded="full"
              borderWidth="2px"
              borderColor={on ? "fg" : "transparent"}
              p="3px"
              cursor="pointer"
            >
              <button type="button" role="radio" aria-checked={on} aria-label={a.label} title={a.label} onClick={() => setAccent(a.id)}>
                <Box w="full" h="full" rounded="full" bg={a.swatch} display="flex" alignItems="center" justifyContent="center" color="white">
                  {on && <LuCheck />}
                </Box>
              </button>
            </Box>
          )
        })}
      </HStack>
      <Field.HelperText>Botons, seleccions i ressaltats. Es guarda en aquest dispositiu.</Field.HelperText>
    </Field.Root>
  )
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160
}

/** Una fila de mostres de color rodones (com el color principal). */
function Swatches<T extends string>({ label, items, value, onChange }: { label: string; items: { id: T; label: string; swatch: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <HStack gap={2} wrap="wrap" role="radiogroup" aria-label={label}>
      {items.map((a) => {
        const on = a.id === value
        return (
          <Box key={a.id} asChild w="36px" h="36px" rounded="full" borderWidth="2px" borderColor={on ? "fg" : "transparent"} p="3px" cursor="pointer">
            <button type="button" role="radio" aria-checked={on} aria-label={a.label} title={a.label} onClick={() => onChange(a.id)}>
              <Box w="full" h="full" rounded="full" bg={a.swatch} borderWidth="1px" borderColor="blackAlpha.200" display="flex" alignItems="center" justifyContent="center" color={isLight(a.swatch) ? "gray.800" : "white"}>
                {on && <LuCheck />}
              </Box>
            </button>
          </Box>
        )
      })}
    </HStack>
  )
}

/** Mostres de terra: rajoles amb la textura real i el nom a sota. */
function FloorTiles({ value, onChange }: { value: FloorId; onChange: (v: FloorId) => void }) {
  return (
    <HStack gap={2} wrap="wrap" role="radiogroup" aria-label="Terra">
      {FLOORS.map((f) => {
        const on = f.id === value
        const img = floorSwatchUrl(f.id)
        return (
          <Stack key={f.id} asChild gap={1} align="center" cursor="pointer">
            <button type="button" role="radio" aria-checked={on} onClick={() => onChange(f.id)}>
              <Box w="72px" h="52px" rounded="md" borderWidth="2px" borderColor={on ? "colorPalette.solid" : "border"} colorPalette="wood" p="2px">
                <Box w="full" h="full" rounded="sm" bg={f.swatch} bgImage={img ? `url(${img})` : undefined} bgSize="cover" />
              </Box>
              <Text textStyle="xs" color={on ? "fg" : "fg.muted"} fontWeight={on ? "medium" : "normal"}>
                {f.label}
              </Text>
            </button>
          </Stack>
        )
      })}
    </HStack>
  )
}

/**
 * Qualitat del visor i escena del mode Presentació. Preferències del dispositiu (es
 * desen al navegador): no s'exporten amb la resta de preferències.
 */
function SceneFields({ previewComposition }: { previewComposition?: Composition }) {
  const [quality, setQuality] = useRenderQuality()
  const [scene, setScene] = usePresentationScene()
  const wallName = WALLS.find((w) => w.color === scene.wall)?.label
  return (
    <FoldGrid>
      <SettingsGroup icon={<LuSparkles />} title="Qualitat" summary={QUALITY_LABELS[quality]}>
      <Field.Root>
        <Field.Label>Qualitat</Field.Label>
        <SegmentGroup.Root size="sm" value={quality} onValueChange={(e) => e.value && e.value in QUALITY_LABELS && setQuality(e.value as RenderQuality)}>
          <SegmentGroup.Indicator />
          {(Object.keys(QUALITY_LABELS) as RenderQuality[]).map((k) => (
            <SegmentGroup.Item key={k} value={k}>
              <SegmentGroup.ItemText>{QUALITY_LABELS[k]}</SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>
        <Field.HelperText>Ràpida per treballar (al visor, modes «Per peça» i «Textura»); Presentació per ensenyar-lo. També es canvia a «Opcions de vista» del visor.</Field.HelperText>
      </Field.Root>
      </SettingsGroup>

      <SettingsGroup icon={<LuLampFloor />} title="Escena de presentació" summary={`${wallName ?? "Paret personalitzada"} · ${LIGHTS.find((l) => l.id === scene.light)?.label ?? ""}`}>
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6} alignItems="start">
        <Stack gap={4}>
          <Text textStyle="sm" color="fg.muted">
            Escena de «Presentació»: on es posa el moble per ensenyar-lo o fer-ne una imatge.
          </Text>

          <Field.Root>
            <Field.Label>Terra</Field.Label>
            <FloorTiles value={scene.floor} onChange={(floor) => setScene({ floor })} />
          </Field.Root>

          <Field.Root>
            <Field.Label>Paret · {wallName ?? "Personalitzada"}</Field.Label>
            <Swatches label="Paret" items={WALLS.map((w) => ({ id: w.color, label: w.label, swatch: w.color }))} value={scene.wall} onChange={(wall) => setScene({ wall })} />
          </Field.Root>

          <Field.Root>
            <Field.Label>Sòcol de paret</Field.Label>
            <SegmentGroup.Root size="sm" value={scene.skirting} onValueChange={(e) => {
              const k = SKIRTINGS.find((x) => x.id === e.value)
              if (k) setScene({ skirting: k.id })
            }}>
              <SegmentGroup.Indicator />
              {SKIRTINGS.map((k) => (
                <SegmentGroup.Item key={k.id} value={k.id}>
                  <SegmentGroup.ItemText>{k.label}</SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              ))}
            </SegmentGroup.Root>
          </Field.Root>

          <Field.Root>
            <Field.Label>Llum</Field.Label>
            <SegmentGroup.Root size="sm" value={scene.light} onValueChange={(e) => {
              const l = LIGHTS.find((x) => x.id === e.value)
              if (l) setScene({ light: l.id })
            }}>
              <SegmentGroup.Indicator />
              {LIGHTS.map((l) => (
                <SegmentGroup.Item key={l.id} value={l.id}>
                  <SegmentGroup.ItemText>{l.label}</SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              ))}
            </SegmentGroup.Root>
            <Field.HelperText>{LIGHTS.find((l) => l.id === scene.light)?.help}</Field.HelperText>
          </Field.Root>
        </Stack>
        <ScenePreview composition={previewComposition} />
      </SimpleGrid>
      </SettingsGroup>
    </FoldGrid>
  )
}

/**
 * Tria una foto del tauler (galeria o càmera al mòbil) i la redueix a 1024 px en JPEG, perquè
 * càpiga a les preferències sense ocupar massa.
 */
function pickTexture(): Promise<{ src: string; aspect: number } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const k = Math.min(1, 1024 / Math.max(img.width, img.height))
        const c = document.createElement("canvas")
        c.width = Math.round(img.width * k)
        c.height = Math.round(img.height * k)
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        resolve({ src: c.toDataURL("image/jpeg", 0.85), aspect: Math.round((c.height / c.width) * 1000) / 1000 })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    }
    input.click()
  })
}
