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
  HStack,
  Heading,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  SegmentGroup,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react"
import { Children, createContext, Fragment, isValidElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { LuArrowDown, LuArrowUp, LuCheck, LuPaintbrush, LuChevronLeft, LuChevronRight, LuCopy, LuDoorClosed, LuDownload, LuEye, LuEyeOff, LuFileDown, LuGrid3X3, LuHammer, LuImagePlus, LuLampFloor, LuLayoutGrid, LuMonitor, LuMoon, LuPalette, LuPlus, LuRotateCcw, LuRows3, LuRuler, LuScan, LuScissors, LuSparkles, LuSquareStack, LuSun, LuSunMoon, LuTag, LuTrash2, LuUpload } from "react-icons/lu"
import type { IconType } from "react-icons"
import { SettingsGroup } from "../../components/SettingsGroup"
import { MasterDetail } from "../../components/MasterDetail"
import { ChoiceChips, FormRow, FormSection } from "../../components/FormRow"
import { useSessionString } from "./useSessionString"
import { MaterialHero, MaterialThumb, ThicknessChips } from "./MaterialBits"
import { TextureEditor } from "./TextureEditor"
import { MaterialLibrary } from "./MaterialLibrary"
import type { LibraryItem } from "./libraryItems"
import { isEditable } from "./materialPreview"
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
import { NumberField, NumRow } from "../editor/ParamsForm"
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
            <ReferencesList refs={draft.references} onChange={(references) => set("references", references)} />
          </Pane>

          <Pane id="materials" wide title="Materials" icon={LuPalette} desc="Taulers, fons, metall, pedra i vidre, i els de simulació per als ambients." onReset={() => setReset({ key: "materials", label: "Materials" })}>
            <MaterialsList
              materials={draft.materials}
              onChange={(materials) => set("materials", materials)}
              footer={
                // Sota el detall (no penjat a dalt de la pàgina): quin tauler i quin fons tenen els mòduls nous.
                <SettingsGroup icon={<LuSquareStack />} title="Per defecte als mòduls nous" summary={`${draft.defaults.material} ${draft.defaults.thickness} · fons ${draft.defaults.backMaterial} ${draft.defaults.backThickness}`}>
                  <FormRow label="Tauler">
                    <DefaultPick label="Tauler" materials={draft.materials.filter((m) => !m.forBacks && m.category !== "sim")} all={draft.materials} material={draft.defaults.material} thickness={draft.defaults.thickness} onChange={(material, thickness) => set("defaults", { ...draft.defaults, material, thickness })} />
                  </FormRow>
                  <FormRow label="Fons">
                    <DefaultPick label="Fons" materials={draft.materials} all={draft.materials} material={draft.defaults.backMaterial} thickness={draft.defaults.backThickness} onChange={(backMaterial, backThickness) => set("defaults", { ...draft.defaults, backMaterial, backThickness })} />
                  </FormRow>
                </SettingsGroup>
              }
            />
          </Pane>

          <Pane id="boards" title="Taulers i nesting" icon={LuLayoutGrid} desc="Mides dels taulers i com es talla." onReset={() => setReset({ key: "boards", label: "Taulers i nesting" })}>
            <Stack gap={6}>
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
            <NumRow label="Kerf (fresa)" help="Amplada del tall de la fresa." value={draft.boards.kerf} min={0} max={30} step={0.5} onChange={(kerf) => set("boards", { ...draft.boards, kerf })} />
            <NumRow label="Marge del tauler" help="Vora que no s'aprofita, a cada costat." value={draft.boards.margin} min={0} max={100} step={1} onChange={(margin) => set("boards", { ...draft.boards, margin })} />
            <FormRow label="Veta" help="Aprofita més el tauler, però la veta de les peces girades no segueix la del moble.">
              <Switch.Root size="sm" pt={1.5} checked={draft.boards.ignoreGrain} onCheckedChange={(e) => set("boards", { ...draft.boards, ignoreGrain: e.checked })}>
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label fontSize="sm">Girar les peces</Switch.Label>
              </Switch.Root>
            </FormRow>
            </SettingsGroup>
            </Stack>
          </Pane>

          <Pane id="hardware" title="Ferratges i mecanitzats" icon={LuHammer} desc="Frontisses, guies, espigues i forats." onReset={() => setReset({ key: "hardware", label: "Ferratges i mecanitzats" })}>
            <HardwareForm hardware={draft.hardware} onChange={(hardware) => set("hardware", hardware)} />
          </Pane>

          <Pane id="gaps" title="Jocs per defecte" icon={LuRuler} desc="Separacions dels fronts, prestatges i fons." onReset={() => setReset({ key: "gaps", label: "Jocs per defecte" })}>
            <FoldGrid>
            <SettingsGroup icon={<LuDoorClosed />} title="Fronts" summary={`porta–cos ${draft.gaps.outerGap} · entre fronts ${draft.gaps.betweenGap}`}>
            <NumRow label="Porta–cos" help="Joc entre el front i la vora del cos." value={draft.gaps.outerGap} min={0} max={10} step={0.5} onChange={(outerGap) => set("gaps", { ...draft.gaps, outerGap })} />
            <NumRow label="Entre fronts" value={draft.gaps.betweenGap} min={0} max={10} step={0.5} onChange={(betweenGap) => set("gaps", { ...draft.gaps, betweenGap })} />
            </SettingsGroup>
            <SettingsGroup icon={<LuRows3 />} title="Prestatges i fons" summary={`prestatge ${draft.gaps.shelfClearance} / ${draft.gaps.shelfSetback} · ranura ${draft.gaps.backSetback} × ${draft.gaps.grooveDepth}`}>
            <NumRow label="Prestatge (joc)" value={draft.gaps.shelfClearance} min={0} max={5} step={0.5} onChange={(shelfClearance) => set("gaps", { ...draft.gaps, shelfClearance })} />
            <NumRow label="Prestatge (retranq.)" help="Quant es fica cap endins respecte del davant." value={draft.gaps.shelfSetback} min={0} max={100} step={1} onChange={(shelfSetback) => set("gaps", { ...draft.gaps, shelfSetback })} />
            <NumRow label="Fons (joc)" value={draft.gaps.backClearance} min={0} max={4} step={0.5} onChange={(backClearance) => set("gaps", { ...draft.gaps, backClearance })} />
            <NumRow label="Ranura del fons" help="Distància al cantell posterior." value={draft.gaps.backSetback} min={0} max={60} step={1} onChange={(backSetback) => set("gaps", { ...draft.gaps, backSetback })} />
            <NumRow label="Fondària ranura" value={draft.gaps.grooveDepth} min={3} max={15} step={1} onChange={(grooveDepth) => set("gaps", { ...draft.gaps, grooveDepth })} />
            </SettingsGroup>
            </FoldGrid>
          </Pane>

          <Pane id="label" title="Etiquetes" icon={LuTag} desc="Mida de l'etiqueta de les peces." onReset={() => setReset({ key: "label", label: "Etiquetes" })}>
            <SettingsGroup icon={<LuTag />} title="Etiqueta de peça" summary={`${draft.label.w} × ${draft.label.h} mm`}>
              <Text fontSize="sm" color="fg.muted">
                Mida de l'etiqueta per triar on s'enganxa (PosX/PosY del CSV del taller). Per defecte 99 × 68, Avery L7165.
              </Text>
              <NumRow label="Amplada" value={draft.label.w} min={10} max={300} step={1} onChange={(w) => set("label", { ...draft.label, w })} />
              <NumRow label="Alçada" value={draft.label.h} min={10} max={300} step={1} onChange={(h) => set("label", { ...draft.label, h })} />
            </SettingsGroup>
          </Pane>

          <Pane id="display" title="Visualització" icon={LuGrid3X3} desc="Unitat de les mides a la pantalla." onReset={() => setReset({ key: "display", label: "Visualització" })}>
            <SettingsGroup icon={<LuRuler />} title="Mides" summary={draft.display.unit === "cm" ? "En centímetres" : "En mil·límetres"}>
            <FormRow label="Unitat" help="Internament tot es guarda en mm; els fitxers per al taller sempre van en mm.">
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
            </FormRow>
            </SettingsGroup>
          </Pane>

          <Pane id="theme" title="Tema" icon={LuSunMoon} desc="Dia o nit i el color principal de l'app.">
            <SettingsGroup icon={<LuSunMoon />} title="Aparença" summary="Es guarda en aquest dispositiu">
              <ThemeField />
              <AccentField />
            </SettingsGroup>
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

/** Clau de l'element obert a les pàgines de llista i detall (per saber quin «Tornar» es veu). */
const DETAIL_KEYS = { materials: "mobles:settings-material", references: "mobles:settings-ref" } as const

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
function Pane(props: PaneProps): ReactNode {
  void props
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
  // Al mòbil, un sol «‹ Tornar» a la vista: amb un element obert (material, objecte) només el seu.
  const [matSel] = useSessionString(DETAIL_KEYS.materials)
  const [refSel] = useSessionString(DETAIL_KEYS.references)
  const detailOpen = (active === "materials" && matSel !== null) || (active === "references" && refSel !== null)
  // Apartats agrupats per categoria (com la Configuració de macOS): el que no hi surti, a «Altres».
  const groups = SETTINGS_GROUPS.map((g) => ({ label: g.label, panes: g.ids.flatMap((id) => panes.filter((p) => p.id === id)) }))
  const rest = panes.filter((p) => !SETTINGS_GROUPS.some((g) => g.ids.includes(p.id)))
  if (rest.length) groups.push({ label: "Altres", panes: rest })
  const ordered = groups.flatMap((g) => g.panes)
  const cur = panes.find((p) => p.id === active) ?? null
  const shown = cur ?? ordered[0]!
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
                alignItems="flex-start"
              >
                <Box color="wood.fg" display="inline-flex" mt="3px">
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
                <Box color="fg.subtle" display={{ base: "inline-flex", md: "none" }} alignSelf="center">
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
        <Button display={{ base: detailOpen ? "none" : "inline-flex", md: "none" }} variant="ghost" size="sm" alignSelf="flex-start" ml={-2} onClick={() => setActive(null)}>
          <LuChevronLeft /> Preferències
        </Button>
        {!shown.wide && <PaneHeader pane={shown} />}
        <Stack gap={6} w="full" maxW={shown.wide ? "none" : "760px"}>
          {/* Pàgines de llista i detall: el títol va a dalt de la llista i el detall comença a dalt de tot. */}
          <PaneHeadContext.Provider value={shown.wide ? <PaneHeader pane={shown} /> : null}>{shown.children}</PaneHeadContext.Provider>
        </Stack>
      </Stack>
    </Flex>
    </Stack>
  )
}

/** Títol de la pàgina que es mira: a les de llista i detall, el posa la llista (`MasterDetail.head`). */
const PaneHeadContext = createContext<ReactNode>(null)

function PaneHeader({ pane }: { pane: PaneProps }) {
  const Icon = pane.icon
  return (
    <HStack justify="space-between" gap={3} wrap="wrap" w="full" maxW={pane.wide ? "none" : "760px"}>
      <HStack gap={2.5} align="flex-start">
        <Box color="wood.fg" fontSize="xl" display="inline-flex" mt="5px">
          <Icon />
        </Box>
        <Stack gap={0}>
          <Heading size="lg">{pane.title}</Heading>
          {pane.desc && (
            <Text fontSize="sm" color="fg.muted">
              {pane.desc}
            </Text>
          )}
        </Stack>
      </HStack>
      {pane.onReset && (
        <Button size="xs" variant="ghost" colorPalette="red" onClick={pane.onReset}>
          <LuRotateCcw /> Restaurar valors inicials
        </Button>
      )}
    </HStack>
  )
}

/**
 * Grups d'una pàgina de Preferències: una sola columna, un sota l'altre (com la Configuració de
 * macOS o Figma): es llegeix de dalt a baix, sense forats, i tots els camps tenen el mateix ample.
 */
function FoldGrid({ children }: { children: ReactNode }) {
  return <Stack gap={6}>{children}</Stack>
}

// --- Objectes de referència --------------------------------------------------------------

function ReferencesList({ refs, onChange }: { refs: RefPreset[]; onChange: (r: RefPreset[]) => void }) {
  const head = useContext(PaneHeadContext)
  const [sel, setSel] = useSessionString(DETAIL_KEYS.references)
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
  // Un element que ja no existeix no compta com a obert.
  useEffect(() => {
    if (sel !== null && i < 0) setSel(null)
  }, [sel, i, setSel])
  return (
    <MasterDetail
      head={
        <Stack gap={3}>
          {head}
          <Text fontSize="sm" color="fg.muted">
            Una sola llista per a la foto (es calibra amb la cara del davant, amplada × alçada) i per a l'editor (fantasma 3D, cal
            fondària). La distància a la paret corregeix l'escala si l'objecte no hi toca.
          </Text>
        </Stack>
      }
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
            <FormRow label="Nom" maxW="360px">
              <Input size="sm" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
            </FormRow>
            <NumRow label="Amplada" value={r.w} min={1} max={10000} step={10} onChange={(w) => update(i, { w })} />
            <NumRow label="Alçada" value={r.h} min={1} max={10000} step={10} onChange={(h) => update(i, { h })} />
            <NumRow label="Fondària" help={r.d ? undefined : "Buida: només per a la foto (no surt al 3D)."} value={r.d ?? NaN} min={1} max={10000} step={10} onChange={(d) => update(i, { d: Number.isFinite(d) && d > 0 ? d : undefined })} />
            <FormRow label="Pla" maxW="180px">
              <NativeSelect.Root size="sm">
                <NativeSelect.Field aria-label="Pla" value={r.plane} onChange={(e) => update(i, { plane: e.target.value as RefPreset["plane"] })}>
                  <option value="wall">Paret</option>
                  <option value="floor">Terra</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </FormRow>
            <NumRow label="A la paret" help="Distància a la paret si l'objecte no hi toca (corregeix l'escala de la foto)." value={r.wallOffset} min={0} max={5000} step={10} onChange={(wallOffset) => update(i, { wallOffset })} />
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

function MaterialsList({ materials, onChange, footer }: { materials: MaterialPref[]; onChange: (m: MaterialPref[]) => void; footer?: ReactNode }) {
  const head = useContext(PaneHeadContext)
  const [sel, setSel] = useSessionString(DETAIL_KEYS.materials)
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
  const [library, setLibrary] = useState(false)
  const addMaterial = (m: MaterialPref) => {
    onChange([m, ...materials])
    setSel(m.id)
    setJustAdded(m.id)
    // Que es vegi: si el filtre és d'una altra categoria, es treu.
    if (cat && cat !== "all" && cat !== materialCategory(m)) setCat("all")
  }
  const blank = () => {
    // A la categoria que es mira (si n'hi ha una de triada); amb nom únic i el nom a punt d'escriure.
    const base: MaterialPref = { id: newId("mat"), name: uniqueName("Material nou"), thicknesses: [19], hasGrain: false, finish: { kind: "color", color: "#e5e5e5" }, edge: "" }
    addMaterial(cat && cat !== "all" ? withCategory(base, cat as MaterialCategory) : base)
  }
  const add = () => setLibrary(true)
  const fromLibrary = ({ group: _g, ...item }: LibraryItem) => addMaterial({ ...structuredClone(item), id: newId("mat"), name: uniqueName(item.name) })
  const q = query.trim().toLowerCase()
  const filterId = cat ?? "all"
  const i = materials.findIndex((m) => m.id === sel)
  const m = i >= 0 ? materials[i]! : null
  useEffect(() => {
    if (sel !== null && i < 0) setSel(null)
  }, [sel, i, setSel])
  return (
    <>
    <MasterDetail
      head={head}
      footer={footer}
      // Per categories: Taulers · Fons · Metall, pedra i vidre · Simulació.
      filters={[{ id: "all", label: "Tots", count: materials.length }, ...MATERIAL_CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: materials.filter((x) => materialCategory(x) === c.id).length }))]}
      filter={filterId}
      onFilter={setCat}
      groups={MATERIAL_CATEGORIES.filter((c) => filterId === "all" || c.id === filterId).map((c) => ({
        id: c.id,
        label: c.label,
        // L'explicació de cada categoria és al detall (Categoria), no sota cada grup de la llista.
        items: materials
          .filter((x) => materialCategory(x) === c.id && (!q || x.name.toLowerCase().includes(q)))
          .map((x) => ({ id: x.id, lead: <MaterialThumb m={x} />, title: x.name, subtitle: materialSummary(x) })),
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
    <MaterialLibrary open={library} onClose={() => setLibrary(false)} onPick={fromLibrary} onBlank={blank} />
    </>
  )
}

const FINISH_LABEL: Record<Finish["kind"], string> = { color: "Color llis", lacquer: "Lacat", wood: "Fusta", image: "Foto real", metal: "Metall", glass: "Vidre", fabric: "Teixit", tiles: "Rajola", stone: "Pedra" }

/** Resum d'una línia: acabat, gruixos i cantell. */
function materialSummary(m: MaterialPref): string {
  return `${FINISH_LABEL[m.finish.kind]} · ${m.thicknesses.join(" · ")} mm${m.edge ? ` · ${m.edge}` : ""}`
}

function MaterialCard({ m, onChange, onDuplicate, onDelete, canDelete, autoFocusName }: { m: MaterialPref; onChange: (p: Partial<MaterialPref>) => void; onDuplicate: () => void; onDelete: () => void; canDelete: boolean; autoFocusName?: boolean }) {
  const [editing, setEditing] = useState(false)
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
  const setKind = (k: Finish["kind"]) => {
    if (k === "image") {
      // Primer cal triar la foto; si es cancel·la, l'acabat no canvia.
      void pickTexture().then((t) => t && onChange({ finish: { kind: "image", tileMm: 800, ...t } }))
      return
    }
    const color = swatch ?? "#e5e5e5"
    onChange({
      finish:
        k === "wood"
          ? { kind: "wood", species: "oak" }
          : k === "tiles"
            ? { kind: "tiles", color, grout: "#cfcac0", size: 600 }
            : k === "stone"
              ? { kind: "stone", color: swatch ?? "#e8e4dc", vein: "#8f8a82", veins: 0.5, size: 1200, seed: 7 }
              : k === "fabric"
                ? { kind: "fabric", color }
                : { kind: k, color },
    })
  }
  const category = MATERIAL_CATEGORIES.find((c) => c.id === materialCategory(m))!
  return (
    <Box borderWidth="1px" rounded="xl" bg="bg.panel" overflow="hidden">
      {/* Capçalera: la mostra a tota l'amplada, a escala real. */}
      <MaterialHero m={m} />
      <TextureEditor m={m} open={editing} onClose={() => setEditing(false)} onApply={(f) => onChange({ finish: f })} />

      {/* Nom (editable, gran) i accions. */}
      <HStack gap={2} px={{ base: 4, sm: 6 }} pt={4} pb={4} align="flex-start">
        <Stack gap={0.5} flex={1} minW={0}>
          <Input
            variant="flushed"
            size="md"
            fontSize="lg"
            fontWeight="semibold"
            value={m.name}
            onChange={(e) => onChange({ name: e.target.value })}
            autoFocus={autoFocusName}
            onFocus={(e) => autoFocusName && e.currentTarget.select()}
            aria-label="Nom del material"
            borderColor="transparent"
            _hover={{ borderColor: "border" }}
            _focus={{ borderColor: "wood.solid" }}
          />
          <Text fontSize="xs" color="fg.muted" truncate>
            {materialSummary(m)}
          </Text>
        </Stack>
        <HStack gap={0} flexShrink={0} pt={1.5}>
          <IconButton aria-label="Duplicar material" title="Duplicar" size="sm" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
          <IconButton aria-label="Eliminar material" title="Eliminar" size="sm" variant="ghost" colorPalette="red" disabled={!canDelete} onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </HStack>
      </HStack>

      <FormSection title="Aspecte">
        <FormRow label="Acabat">
          <NativeSelect.Root size="sm" maxW="280px">
            <NativeSelect.Field value={finish.kind} onChange={(e) => setKind(e.target.value as Finish["kind"])}>
              <option value="color">Color llis</option>
              <option value="lacquer">Lacat</option>
              <option value="wood">Fusta</option>
              <option value="image">Foto (textura)</option>
              <option value="metal">Metall</option>
              <option value="glass">Vidre</option>
              <option value="fabric">Teixit</option>
              <option value="tiles">Rajola</option>
              <option value="stone">Pedra / marbre</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </FormRow>
        {finish.kind === "image" ? (
          <FormRow label="Foto" help={`${finish.tileMm} × ${Math.round(finish.tileMm * (finish.aspect ?? 1))} mm de tauler per repetició, ${finish.seamless ? "repetida tal qual" : "en mirall"}.`}>
            <HStack gap={2} wrap="wrap">
              <HStack gap={1.5}>
                <Input
                  size="sm"
                  w="96px"
                  type="number"
                  inputMode="numeric"
                  value={finish.tileMm}
                  min={50}
                  max={5000}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (v >= 50 && v <= 5000) onChange({ finish: { ...finish, tileMm: v } })
                  }}
                  aria-label="Amplada de la foto (mm)"
                  title="Quants mm de tauler de debò surten a la foto (d'esquerra a dreta)"
                />
                <Text fontSize="sm" color="fg.muted">
                  mm d'amplada
                </Text>
              </HStack>
              <Button size="sm" variant="outline" onClick={() => void pickTexture().then((t) => t && onChange({ finish: { ...finish, ...t } }))}>
                <LuImagePlus /> Canviar
              </Button>
              <Button size="sm" variant="ghost" colorPalette="red" onClick={() => onChange({ finish: m.hasGrain ? { kind: "wood", species: "oak" } : { kind: "color", color: "#e5e5e5" } })}>
                <LuTrash2 /> Treure
              </Button>
            </HStack>
            <Switch.Root size="sm" mt={1} checked={!!finish.seamless} onCheckedChange={(e) => onChange({ finish: { ...finish, seamless: e.checked || undefined } })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Sense costures (repetir sense mirall)</Switch.Label>
            </Switch.Root>
          </FormRow>
        ) : finish.kind === "wood" ? (
          <FormRow label="Espècie">
            <NativeSelect.Root size="sm" maxW="280px">
              <NativeSelect.Field value={finish.species} onChange={(e) => onChange({ finish: { kind: "wood", species: e.target.value as typeof finish.species } })}>
                {SPECIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </FormRow>
        ) : (
          <FormRow label="Color">
            {/* Mostra de color compacta amb el codi al costat. */}
            <HStack gap={2} maxW="280px">
              <Input size="sm" type="color" value={finish.color} onChange={(e) => onChange({ finish: { ...finish, color: e.target.value } })} p={0.5} w="44px" flexShrink={0} aria-label="Color" />
              <Input size="sm" key={finish.color} defaultValue={finish.color} onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value.trim()) && onChange({ finish: { ...finish, color: e.target.value.trim() } })} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} fontFamily="mono" aria-label="Codi del color" />
            </HStack>
          </FormRow>
        )}
        {finish.kind === "tiles" && (
          <FormRow label="Rajola">
            <HStack gap={3} wrap="wrap">
              <HStack gap={1.5}>
                <Input size="sm" w="96px" type="number" inputMode="numeric" value={finish.size} min={20} max={1500} onChange={(e) => { const v = Number(e.target.value); if (v >= 20 && v <= 1500) onChange({ finish: { ...finish, size: v } }) }} aria-label="Mida de la rajola (mm)" />
                <Text fontSize="sm" color="fg.muted">mm</Text>
              </HStack>
              <HStack gap={1.5}>
                <Input size="sm" type="color" value={finish.grout} onChange={(e) => onChange({ finish: { ...finish, grout: e.target.value } })} p={0.5} w="44px" aria-label="Color de la junta" />
                <Text fontSize="sm" color="fg.muted">junta</Text>
              </HStack>
            </HStack>
          </FormRow>
        )}
        {isEditable(finish) && (
          <FormRow label="Textura" help="Dissenya-la (veta, nusos, vetes del marbre, trama…) o posa-hi una foto del tauler de debò.">
            <HStack gap={2} wrap="wrap">
              <Button size="sm" variant="outline" colorPalette="wood" onClick={() => setEditing(true)}>
                <LuPaintbrush /> Editar la textura
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void pickTexture().then((t) => t && onChange({ finish: { kind: "image", tileMm: 800, ...t } }))}>
                <LuImagePlus /> Posar una foto
              </Button>
            </HStack>
          </FormRow>
        )}
      </FormSection>

      <FormSection title="Fabricació">
        <FormRow label="Gruixos" help="Els que es poden triar a les peces d'aquest material.">
          <ThicknessChips value={m.thicknesses} onChange={(thicknesses) => onChange({ thicknesses })} label={false} />
        </FormRow>
        <FormRow label="Cantell">
          <Input size="sm" maxW="280px" value={m.edge} onChange={(e) => onChange({ edge: e.target.value })} placeholder="PVC blanc 1 mm" />
        </FormRow>
        <FormRow label="Veta" help="Té una direcció (fusta, xapa) que cal respectar en tallar.">
          <Switch.Root size="sm" pt={1.5} checked={m.hasGrain} onCheckedChange={(e) => onChange({ hasGrain: e.checked })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Té veta</Switch.Label>
          </Switch.Root>
        </FormRow>
        <FormRow label="Categoria" help={category.hint}>
          <NativeSelect.Root size="sm" maxW="280px">
            <NativeSelect.Field
              value={category.id}
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
        </FormRow>
      </FormSection>
    </Box>
  )
}

/** Material i gruix per defecte en una fila: el gruix es tria d'entre els del material. */
function DefaultPick({ label, materials, all, material, thickness, onChange }: { label: string; materials: MaterialPref[]; all: MaterialPref[]; material: string; thickness: number; onChange: (material: string, thickness: number) => void }) {
  const list = all.find((m) => m.name === material)?.thicknesses ?? []
  const options = list.includes(thickness) ? list : [...list, thickness].sort((a, b) => a - b)
  return (
    <HStack gap={2} maxW="400px">
      <MaterialSelect
        hideLabel
        label={label}
        materials={materials}
        value={material}
        onChange={(name) => {
          // En canviar de material, el gruix passa al més proper dels seus.
          const t = all.find((m) => m.name === name)?.thicknesses ?? []
          onChange(name, t.includes(thickness) || !t.length ? thickness : t.reduce((a, b) => (Math.abs(b - thickness) < Math.abs(a - thickness) ? b : a)))
        }}
      />
      <NativeSelect.Root size="sm" w="104px" flexShrink={0}>
        <NativeSelect.Field aria-label={`Gruix ${label.toLowerCase()}`} value={thickness} onChange={(e) => onChange(material, Number(e.target.value))}>
          {options.map((t) => (
            <option key={t} value={t}>
              {t} mm
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </HStack>
  )
}

export function MaterialSelect({ label, materials, value, onChange, emptyLabel, hideLabel }: { label: string; materials: MaterialPref[]; value: string; onChange: (name: string) => void; emptyLabel?: string; hideLabel?: boolean }) {
  const known = materials.some((m) => m.name === value) || (emptyLabel !== undefined && value === "")
  return (
    <Field.Root flex={hideLabel ? 1 : undefined} minW={0}>
      {!hideLabel && <Field.Label fontSize="sm">{label}</Field.Label>}
      <NativeSelect.Root size="sm">
        <NativeSelect.Field aria-label={hideLabel ? label : undefined} value={value} onChange={(e) => onChange(e.target.value)}>
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
        <NumRow label="Diàmetre (Ø)" value={h.hinge.cupDiameter} min={20} max={40} step={1} onChange={(cupDiameter) => sub("hinge", { cupDiameter })} />
        <NumRow label="Fondària" value={h.hinge.cupDepth} min={5} max={20} step={0.5} onChange={(cupDepth) => sub("hinge", { cupDepth })} />
        <NumRow label="Al cantell" help="Del cantell de la porta a la vora de la cassoleta." value={h.hinge.cupOffset} min={15} max={30} step={0.5} onChange={(cupOffset) => sub("hinge", { cupOffset })} />
      </Group>
      <Group title="System 32" icon={LuGrid3X3}>
        <NumRow label="Filera al cantell" value={h.system32.edgeOffset} min={20} max={60} step={1} onChange={(edgeOffset) => sub("system32", { edgeOffset })} />
        <NumRow label="Pas" value={h.system32.pitch} min={16} max={64} step={1} onChange={(pitch) => sub("system32", { pitch })} />
        <NumRow label="Diàmetre (Ø)" value={h.system32.diameter} min={3} max={10} step={0.5} onChange={(diameter) => sub("system32", { diameter })} />
        <NumRow label="Fondària" value={h.system32.depth} min={5} max={16} step={0.5} onChange={(depth) => sub("system32", { depth })} />
      </Group>
      <Group title="Espigues" icon={LuHammer}>
        <NumRow label="Diàmetre (Ø)" value={h.dowel.diameter} min={5} max={12} step={1} onChange={(diameter) => sub("dowel", { diameter })} />
        <NumRow label="Als extrems" value={h.dowel.endOffset} min={20} max={120} step={5} onChange={(endOffset) => sub("dowel", { endOffset })} />
        <NumRow label="Fondària a la cara" value={h.dowel.faceDepth} min={5} max={20} step={0.5} onChange={(faceDepth) => sub("dowel", { faceDepth })} />
        <NumRow label="Fondària al cantell" value={h.dowel.edgeDepth} min={10} max={40} step={0.5} onChange={(edgeDepth) => sub("dowel", { edgeDepth })} />
      </Group>
      <Group title="Calaixos (guia genèrica)" icon={LuFileDown}>
        <FormRow label="Llargades de guia" help="Es tria la més llarga que hi cap." maxW="360px">
          <Input
            size="sm"
            aria-invalid={h.drawer.slideLengths.length === 0 || undefined}
            value={slides}
            onChange={(e) => {
              setSlides(e.target.value)
              const list = parseList(e.target.value)
              if (list.length) sub("drawer", { slideLengths: list })
            }}
            onBlur={() => setSlides(h.drawer.slideLengths.join(" · "))}
            placeholder="250 · 300 · 350 · 400 · 450 · 500 · 550"
          />
        </FormRow>
        <NumRow label="Joc lateral (costat)" value={h.drawer.sideClearance} min={0} max={30} step={0.5} onChange={(sideClearance) => sub("drawer", { sideClearance })} />
        <NumRow label="Gruix caixa" value={h.drawer.boxThickness} min={8} max={25} step={1} onChange={(boxThickness) => sub("drawer", { boxThickness })} />
        <NumRow label="Gruix fons caixa" value={h.drawer.bottomThickness} min={3} max={16} step={1} onChange={(bottomThickness) => sub("drawer", { bottomThickness })} />
        <NumRow label="Front − caixa" help="Quant més baixa és la caixa que el front." value={h.drawer.boxDrop} min={0} max={100} step={1} onChange={(boxDrop) => sub("drawer", { boxDrop })} />
        <NumRow label="Fons des de baix" value={h.drawer.bottomOffset} min={0} max={40} step={1} onChange={(bottomOffset) => sub("drawer", { bottomOffset })} />
        <NumRow label="Joc amb el fons" value={h.drawer.backClearance} min={0} max={60} step={1} onChange={(backClearance) => sub("drawer", { backClearance })} />
      </Group>
      <Group title="Imants (reixetes i trapes)" icon={LuSquareStack}>
        <NumRow label="Diàmetre (Ø)" value={h.magnet.diameter} min={5} max={20} step={1} onChange={(diameter) => sub("magnet", { diameter })} />
        <NumRow label="Fondària" value={h.magnet.depth} min={2} max={15} step={0.5} onChange={(depth) => sub("magnet", { depth })} />
        <NumRow label="A la cantonada" value={h.magnet.cornerOffset} min={20} max={200} step={5} onChange={(cornerOffset) => sub("magnet", { cornerOffset })} />
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
    <FormRow label="Tema">
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
    </FormRow>
  )
}

function AccentField() {
  const [accent, setAccent] = useAccent()
  return (
    <FormRow label="Color principal" help="Botons, seleccions i ressaltats.">
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
    </FormRow>
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
  const { settings } = useSettings()
  const wallName = scene.wallMaterial ?? WALLS.find((w) => w.color === scene.wall)?.label
  return (
    <FoldGrid>
      <SettingsGroup icon={<LuSparkles />} title="Qualitat" summary={QUALITY_LABELS[quality]}>
      <FormRow label="Qualitat" help="Ràpida per treballar (al visor, modes «Per peça» i «Textura»); Presentació per ensenyar-lo. També es canvia a «Opcions de vista» del visor.">
        <SegmentGroup.Root size="sm" value={quality} onValueChange={(e) => e.value && e.value in QUALITY_LABELS && setQuality(e.value as RenderQuality)}>
          <SegmentGroup.Indicator />
          {(Object.keys(QUALITY_LABELS) as RenderQuality[]).map((k) => (
            <SegmentGroup.Item key={k} value={k}>
              <SegmentGroup.ItemText>{QUALITY_LABELS[k]}</SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>
      </FormRow>
      </SettingsGroup>

      <SettingsGroup icon={<LuLampFloor />} title="Escena de presentació" summary={`${wallName ?? "Paret personalitzada"} · ${LIGHTS.find((l) => l.id === scene.light)?.label ?? ""}`}>
      <Text textStyle="sm" color="fg.muted">
        Escena de «Presentació»: on es posa el moble per ensenyar-lo o fer-ne una imatge.
      </Text>
      <ScenePreview composition={previewComposition} />
      {/* Terra i paret: un material de la biblioteca (els mateixos dels ambients) o una mostra ràpida. */}
      <FormRow label="Terra" help="Un material de la biblioteca (Preferències › Materials) o una de les mostres ràpides.">
        <Stack gap={2.5}>
          <Box maxW="280px">
            <MaterialSelect label="Material del terra" hideLabel materials={settings.materials} value={scene.floorMaterial ?? ""} emptyLabel="Mostra ràpida (a sota)" onChange={(name) => setScene({ floorMaterial: name || undefined })} />
          </Box>
          <FloorTiles value={scene.floorMaterial ? ("" as FloorId) : scene.floor} onChange={(floor) => setScene({ floor, floorMaterial: undefined })} />
        </Stack>
      </FormRow>
      <FormRow label="Paret" help={scene.wallMaterial ? undefined : (wallName ?? "Personalitzada")}>
        <Stack gap={2.5}>
          <Box maxW="280px">
            <MaterialSelect label="Material de la paret" hideLabel materials={settings.materials} value={scene.wallMaterial ?? ""} emptyLabel="Color (a sota)" onChange={(name) => setScene({ wallMaterial: name || undefined })} />
          </Box>
          <Swatches label="Paret" items={WALLS.map((w) => ({ id: w.color, label: w.label, swatch: w.color }))} value={scene.wallMaterial ? "" : scene.wall} onChange={(wall) => setScene({ wall, wallMaterial: undefined })} />
        </Stack>
      </FormRow>
      <FormRow label="Sòcol de paret">
        <ChoiceChips label="Sòcol de paret" options={SKIRTINGS} value={scene.skirting} onChange={(skirting) => setScene({ skirting })} />
      </FormRow>
      <FormRow label="Llum" help={LIGHTS.find((l) => l.id === scene.light)?.help}>
        <ChoiceChips label="Llum" options={LIGHTS} value={scene.light} onChange={(light) => setScene({ light })} />
      </FormRow>
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
