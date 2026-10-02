import { useTheme } from "next-themes"
import { ACCENTS, useAccent } from "../../theme/accent"
import { QUALITY_LABELS, useRenderQuality, type RenderQuality } from "../../components/viewer/renderQuality"
import { SKIES, useSkyPref, type SkyId } from "../../components/viewer/render/skies"
import { FLOORS, LIGHTS, SKIRTINGS, WALLS, renamePresentationMaterial, usePresentationScene, type FloorId } from "../../components/viewer/presentationScene"
import { floorSwatchUrl } from "../../components/viewer/floorTextures"
import type { Composition } from "../../core/model"
import { ScenePreview } from "./ScenePreview"
import {
  Alert,
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  HStack,
  Heading,
  IconButton,
  Input,
  Portal,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react"
import { Children, Fragment, isValidElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { LuArchive, LuFactory, LuArrowDown, LuArrowUp, LuCheck, LuCircleDashed, LuCircleDot, LuMagnet, LuScanEye, LuPaintbrush, LuChevronLeft, LuChevronRight, LuCopy, LuDoorClosed, LuDownload, LuEye, LuEyeOff,  LuHammer, LuImagePlus, LuLampFloor, LuLayoutGrid, LuMonitor, LuMoon, LuPalette, LuPlus, LuRotateCcw, LuRotateCw, LuRoute, LuRows3, LuRuler, LuScan, LuSparkles, LuSun, LuSunMoon, LuTag, LuTrash2, LuUpload } from "react-icons/lu"
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
  backChoices,
  boardChoices,
  fixMaterialRefs,
  restoredFinish,
  switchFinish,
  materialNameError,
  removeMaterialFromSettings,
  renameMaterialInSettings,
  tidyMaterialName,
  defaultMachine,
  defaultMachineRules,
  MATERIAL_CATEGORIES,
  materialCategory,
  withCategory,
  type MaterialCategory,
  SettingsSchema,
  newId,
  importSettingsJson,
  settingsToJson,
  type Finish,
  type MaterialPref,
  type RefPreset,
  type Settings,
} from "../../core/model"
import { downloadText } from "../download"
import { NumberField, NumRow } from "../../components/NumRow"
import { useSettings } from "./SettingsContext"
import { fileAccept } from "../file/fileAccept"
import { useDebouncedSave } from "../useDebouncedSave"
import { PageHeader } from "../../components/PageHeader"
import { MaterialSelect } from "./MaterialSelect"
import { SectionLabel } from "../../components/SectionLabel"
import { PaneHeadContext } from "./paneHead"
import { MachinesList } from "./MachinesPane"
import { MachineRulesGroup } from "./MachineRules"
import { MapThumb, TextureMapRows, TextureSetRow } from "./TextureMapRows"
import { encodeMap, pickFiles } from "./textureImport"
import { DeleteMaterialDialog } from "./DeleteMaterialDialog"
import { renameMaterialEverywhere, type RenameCount } from "../../db/materialRefs"

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
  const [reset, setReset] = useState<{ key: SectionKey; label: string; note?: string } | null>(null)
  const machine = defaultMachine(draft.machines)
  const fileInput = useRef<HTMLInputElement>(null)
  const validation = useMemo(() => SettingsSchema.safeParse(draft), [draft])
  const problems = validation.success ? [] : validation.error.issues.map(issueText)

  // Desa amb retard, només si és vàlid (també el que queda pendent en sortir de Preferències).
  useDebouncedSave(
    draft,
    (d) => {
      const r = SettingsSchema.safeParse(d)
      return r.success ? save(r.data) : undefined
    },
    400,
  )

  const set = <K extends SectionKey>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }))

  // Noms de material canviats (canviar el nom, eliminar amb substitut, importar un fitxer antic): els mobles, objectes i
  // ambients desats el segueixen en una transacció, amb les preferències noves (si són vàlides).
  const cascade = (renames: [string, string][], next: Settings): Promise<RenameCount> => {
    for (const [from, to] of renames) renamePresentationMaterial(from, to)
    const valid = SettingsSchema.safeParse(next)
    return renameMaterialEverywhere(renames, valid.success ? () => save(valid.data) : undefined)
  }
  const counted = (c: RenameCount) => `${c.projects} ${c.projects === 1 ? "moble" : "mobles"} i ${c.ambients} ${c.ambients === 1 ? "ambient" : "ambients"} actualitzats`
  const renameMaterial = (from: string, to: string) => {
    const next = renameMaterialInSettings(draft, from, to)
    setDraft(next)
    void cascade([[from, to]], next).then((c) => toaster.create({ title: `Nom canviat: ${counted(c)}`, type: "success" }))
  }
  const [deleting, setDeleting] = useState<MaterialPref | null>(null)
  const confirmDelete = (replacement: string | null) => {
    const m = deleting
    setDeleting(null)
    if (!m) return
    const next = removeMaterialFromSettings(draft, m.name, replacement)
    setDraft(next)
    if (replacement) void cascade([[m.name, replacement]], next).then((c) => toaster.create({ title: `«${m.name}» eliminat`, description: `Passen a «${replacement}»: ${counted(c)}.`, type: "success" }))
    else toaster.create({ title: `«${m.name}» eliminat`, type: "info" })
  }

  const doExport = () => downloadText(settingsToJson(validation.success ? validation.data : draft), "mobles-preferencies.json", "application/json")
  const doImport = async (file: File | undefined) => {
    if (!file) return
    // Les seccions que el fitxer no porta (p. ex. les màquines, en un fitxer antic) es queden com són.
    const res = importSettingsJson(draft, await file.text())
    if (res.problems.length) {
      toaster.create({ title: "Preferències importades amb avisos", description: res.problems.join(" "), type: "warning", duration: 8000 })
    } else toaster.create({ title: "Preferències importades", type: "success" })
    setDraft(res.settings)
    // Un fitxer d'abans de la v12 porta «Melamina 19», «DM 10» o «Pi»: els mobles desats segueixen el nom nou.
    if (res.renames?.length) void cascade(res.renames, res.settings)
    if (fileInput.current) fileInput.current.value = ""
  }
  const confirmReset = () => {
    if (!reset) return
    const key = reset.key
    // Regles de mecanitzat: `defaultMachineRules()` (les del taller), com la resta de seccions.
    // Després, les referències a materials que ja no hi són (per defecte, mides de tauler) es corregeixen.
    setDraft((d) => fixMaterialRefs({ ...d, [key]: key === "machiningRules" ? defaultMachineRules() : structuredClone(DEFAULT_SETTINGS[key]) }))
    toaster.create({ title: `«${reset.label}» restaurat`, type: "info" })
    setReset(null)
  }

  return (
    <Stack gap={5} w="full">
      <SettingsPages
        header={
          <Stack gap={4}>
      <input ref={fileInput} type="file" accept={fileAccept("application/json,.json")} hidden onChange={(e) => void doImport(e.target.files?.[0])} />
      <PageHeader
        title="Preferències"
        description="Mides i valors que depenen de tu i del taller. Canviar-los no modifica els mobles ja fets: només els mòduls nous i les pantalles que llegeixen aquestes llistes (foto, editor, nesting, export)."
        actions={
          <>
            {/* El primer, el principal (color principal), com «Nou moble» a les altres pàgines. */}
            <Button colorPalette="wood" size={{ base: "sm", md: "md" }} onClick={() => fileInput.current?.click()}>
              <LuUpload /> Importar
            </Button>
            <Button variant="outline" size={{ base: "sm", md: "md" }} onClick={doExport}>
              <LuDownload /> Exportar
            </Button>
          </>
        }
      />
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
              onRename={renameMaterial}
              onDelete={setDeleting}
              footer={
                // Sota el detall (no penjat a dalt de la pàgina): quin tauler i quin fons tenen els mòduls nous.
                <SettingsGroup icon={<LuPalette />} title="Per defecte als mòduls nous" summary={`${draft.defaults.material} ${draft.defaults.thickness} · fons ${draft.defaults.backMaterial} ${draft.defaults.backThickness}`}>
                  <FormRow label="Tauler">
                    <DefaultPick label="Tauler" materials={boardChoices(draft.materials)} all={draft.materials} material={draft.defaults.material} thickness={draft.defaults.thickness} onChange={(material, thickness) => set("defaults", { ...draft.defaults, material, thickness })} />
                  </FormRow>
                  <FormRow label="Fons">
                    <DefaultPick label="Fons" materials={backChoices(draft.materials)} all={draft.materials} material={draft.defaults.backMaterial} thickness={draft.defaults.backThickness} onChange={(backMaterial, backThickness) => set("defaults", { ...draft.defaults, backMaterial, backThickness })} />
                  </FormRow>
                </SettingsGroup>
              }
            />
          </Pane>

          <Pane id="boards" title="Taulers" icon={LuLayoutGrid} desc="Mides dels taulers de fàbrica per al nesting. La separació i el marge són de la màquina." onReset={() => setReset({ key: "boards", label: "Taulers" })}>
            <Stack gap={6}>
            {/* Com es talla (separació, marge, fresa) és de la màquina: aquí només el camp de treball, al costat de les mides dels taulers (sense avís si n'és més gran). */}
            <SettingsGroup icon={<LuFactory />} title="Màquina CNC" summary={machine ? machine.name : "sense màquina"}>
              {machine ? (
                <FormRow label="Camp de treball" help={`El màxim que mecanitza ${machine.name}. La separació entre peces i el marge del tauler són de la màquina (Preferències › Màquines CNC).`}>
                  <Text fontSize="sm" pt="6px">{machine.workArea ? `${machine.workArea.x} × ${machine.workArea.y} mm` : "—"}</Text>
                </FormRow>
              ) : (
                <Text fontSize="sm" color="fg.muted">
                  Sense màquina CNC: importa-la a Preferències › Màquines CNC. Mentrestant, la separació i el marge del nesting es trien a la pàgina Nesting de cada moble.
                </Text>
              )}
            </SettingsGroup>
            <SettingsGroup icon={<LuLayoutGrid />} title="Mides de tauler de fàbrica" summary={draft.boards.sheets.map((x) => `${x.w}×${x.h}`).join(" · ")}>
            <Text fontSize="sm" color="fg.muted">
              Els taulers que es compren, per material («Tots els altres»: la resta). El nesting hi reparteix les peces.
            </Text>
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
                    <Box gridColumn={{ base: "1 / -1", sm: "auto" }} mt={{ base: i > 0 ? 2 : 0, sm: 0 }} minW={0}>
                      <MaterialSelect label="Material" hideLabel materials={backChoices(draft.materials)} value={s.material} emptyLabel="Tots els altres" onChange={(material) => update({ material })} />
                    </Box>
                    <NumberField label="" ariaLabel="Llarg" value={s.w} min={300} max={6000} step={10} onChange={(w) => update({ w })} />
                    <NumberField label="" ariaLabel="Ample" value={s.h} min={300} max={6000} step={10} onChange={(h) => update({ h })} />
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
            <SettingsGroup icon={<LuRotateCw />} title="Distribució" summary={draft.boards.ignoreGrain ? "gira les peces amb veta" : "respecta la veta"}>
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

          <Pane id="hardware" title="Ferratges" icon={LuHammer} desc="Frontisses, guies, espigues i els seus forats." onReset={() => setReset({ key: "hardware", label: "Ferratges" })}>
            <HardwareForm hardware={draft.hardware} onChange={(hardware) => set("hardware", hardware)} />
          </Pane>

          <Pane
            id="rules"
            title="Regles de mecanitzat"
            icon={LuRoute}
            desc="Com mecanitza la CNC: freses per a cada cosa, passades, rampa i peces petites."
            onReset={() => setReset({ key: "machiningRules", label: "Regles de mecanitzat", note: "Les regles tornen a les del taller (les mateixes per a totes les màquines). Les eines de les màquines no canvien." })}
          >
            <MachineRulesGroup rules={draft.machiningRules} machines={draft.machines} onChange={(rules) => set("machiningRules", rules)} />
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

          <Pane id="machines" wide title="Màquines CNC" icon={LuFactory} desc="Les màquines del taller i les seves eines, importades de Maestro, per als programes .xcs.">
            <MachinesList machines={draft.machines} onChange={(machines) => set("machines", machines)} />
          </Pane>

          <Pane id="display" title="Visualització" icon={LuScanEye} desc="Unitat de les mides a la pantalla." onReset={() => setReset({ key: "display", label: "Visualització" })}>
            <SettingsGroup icon={<LuRuler />} title="Mides" summary={draft.display.unit === "cm" ? "En centímetres" : "En mil·límetres"}>
            <FormRow label="Unitat" help="Internament tot es guarda en mm; els fitxers per al taller sempre van en mm.">
              <ChoiceChips label="Unitat" value={draft.display.unit} onChange={(unit) => set("display", { unit })} options={[{ id: "mm", label: "mm" }, { id: "cm", label: "cm" }]} />
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

      <DeleteMaterialDialog material={deleting} settings={draft} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />

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
                {reset?.key === "materials" && <Text mt={2}>El tauler i el fons per defecte i les mides de tauler d'un material que deixi d'existir tornen als inicials.</Text>}
                {reset?.note && <Text mt={2}>{reset.note}</Text>}
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
const DETAIL_KEYS = { materials: "mobles:settings-material", references: "mobles:settings-ref", machines: "mobles:settings-machine" } as const

/** Categories dels apartats de Preferències. */
const SETTINGS_GROUPS: { label: string; ids: string[] }[] = [
  { label: "Fabricació", ids: ["machines", "rules", "hardware", "gaps", "materials", "boards", "label"] },
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
  const [machSel] = useSessionString(DETAIL_KEYS.machines)
  const detailOpen = (active === "materials" && matSel !== null) || (active === "references" && refSel !== null) || (active === "machines" && machSel !== null)
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
        <SectionLabel px={{ base: 1, md: 3 }}>
          {g.label}
        </SectionLabel>
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
  return (
    <Stack className="settings-stack" gap={6}>
      {children}
    </Stack>
  )
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
            <NumRow label="Fondària" help={r.d ? undefined : "Buida: només per a la foto (no surt al 3D)."} value={r.d ?? NaN} allowEmpty min={1} max={10000} step={10} onChange={(d) => update(i, { d: Number.isFinite(d) && d > 0 ? d : undefined })} />
            <FormRow label="Pla">
              <ChoiceChips<RefPreset["plane"]>
                label="Pla"
                options={[
                  { id: "wall", label: "Paret" },
                  { id: "floor", label: "Terra" },
                ]}
                value={r.plane}
                onChange={(plane) => update(i, { plane })}
              />
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

function MaterialsList({ materials, onChange, onRename, onDelete, footer }: { materials: MaterialPref[]; onChange: (m: MaterialPref[]) => void; onRename: (from: string, to: string) => void; onDelete: (m: MaterialPref) => void; footer?: ReactNode }) {
  const head = useContext(PaneHeadContext)
  const [sel, setSel] = useSessionString(DETAIL_KEYS.materials)
  const [query, setQuery] = useState("")
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const update = (i: number, patch: Partial<MaterialPref>) => onChange(materials.map((m, k) => (k === i ? { ...m, ...patch } : m)))
  // Noms únics sense majúscules ni espais (com l'esquema, `materialNameKey`).
  const uniqueName = (base: string) => {
    const taken = (n: string) => materialNameError(materials, "", n) !== null
    if (!taken(base)) return base
    let n = 2
    while (taken(`${base} ${n}`)) n++
    return `${base} ${n}`
  }
  const [library, setLibrary] = useState(false)
  const addMaterial = (m: MaterialPref) => {
    onChange([m, ...materials])
    setSel(m.id)
    setJustAdded(m.id)
  }
  const blank = () => {
    // A la categoria del material que es mira (si n'hi ha); amb nom únic i el nom a punt d'escriure.
    const base: MaterialPref = { id: newId("mat"), name: uniqueName("Material nou"), thicknesses: [19], hasGrain: false, finish: { kind: "color", color: "#e5e5e5" }, edge: "" }
    const cur = materials.find((x) => x.id === sel)
    addMaterial(cur ? withCategory(base, materialCategory(cur) as MaterialCategory) : base)
  }
  const add = () => setLibrary(true)
  const fromLibrary = ({ group: _g, ...item }: LibraryItem) => addMaterial({ ...structuredClone(item), id: newId("mat"), name: uniqueName(item.name) })
  const q = query.trim().toLowerCase()
  const i = materials.findIndex((m) => m.id === sel)
  const m = i >= 0 ? materials[i]! : null
  useEffect(() => {
    if (sel !== null && i < 0) setSel(null)
  }, [sel, i, setSel])
  const openExisting = (id: string) => {
    setSel(id)
  }
  // «Per defecte als mòduls nous» només sota un tauler o un fons (els que poden ser-ho).
  const showDefaults = m !== null && (materialCategory(m) === "board" || materialCategory(m) === "back")
  return (
    <>
    <MasterDetail
      head={head}
      footer={showDefaults ? footer : undefined}
      // Per categories en acordió (Taulers · Fons · Simulació), com el selector de materials.
      collapsible="materials"
      groups={MATERIAL_CATEGORIES.map((c) => ({
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
            nameError={(name) => materialNameError(materials, m.id, name)}
            onRename={(name) => onRename(m.name, name)}
            autoFocusName={justAdded === m.id}
            onDuplicate={() => {
              const copy = { ...m, id: newId("mat"), name: uniqueName(`${m.name} (còpia)`) }
              const next = [...materials]
              next.splice(i + 1, 0, copy)
              onChange(next)
              setSel(copy.id)
            }}
            onDelete={() => onDelete(m)}
            canDelete={materials.length > 1}
          />
        )
      }
    />
    <MaterialLibrary open={library} onClose={() => setLibrary(false)} onPick={fromLibrary} onBlank={blank} materials={materials} onOpenExisting={openExisting} />
    </>
  )
}

const FINISH_LABEL: Record<Finish["kind"], string> = { color: "Color llis", lacquer: "Lacat", wood: "Fusta", image: "Foto real", metal: "Metall", glass: "Vidre", fabric: "Teixit", tiles: "Rajola", stone: "Pedra" }

/** Resum d'una línia: acabat, gruixos i cantell. */
function materialSummary(m: MaterialPref): string {
  return `${FINISH_LABEL[m.finish.kind]} · ${m.thicknesses.join(" · ")} mm${m.edge ? ` · ${m.edge}` : ""}`
}

function MaterialCard({ m, onChange, onRename, nameError, onDuplicate, onDelete, canDelete, autoFocusName }: { m: MaterialPref; onChange: (p: Partial<MaterialPref>) => void; onRename: (name: string) => void; nameError: (name: string) => string | null; onDuplicate: () => void; onDelete: () => void; canDelete: boolean; autoFocusName?: boolean }) {
  const [editing, setEditing] = useState(false)
  // El nom es canvia en acabar (sortir del camp o Retorn), no a cada tecla: llavors els mobles i ambients que el fan
  // servir el segueixen (`renameMaterialEverywhere`). Repetit o buit: l'error a sota i, en acabar, es queda l'antic.
  const [nameText, setNameText] = useState(m.name)
  useEffect(() => setNameText(m.name), [m.name])
  const typedError = nameText === m.name ? null : nameError(nameText)
  const commitName = () => {
    const next = tidyMaterialName(nameText)
    if (next === m.name) {
      setNameText(m.name)
      return
    }
    const err = nameError(next)
    if (err) {
      toaster.create({ title: "El nom no s'ha canviat", description: err, type: "warning" })
      setNameText(m.name)
      return
    }
    onRename(next)
  }
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
    if (k === finish.kind) return
    // Si ja havia tingut aquest acabat (o és una foto de l'app), es recupera tal com era.
    const back = restoredFinish(m, k)
    if (back) {
      onChange(switchFinish(m, back))
      return
    }
    if (k === "image") {
      // Primer cal triar la foto; si es cancel·la, l'acabat no canvia.
      void pickTexture().then((t) => t && onChange(switchFinish(m, { kind: "image", tileMm: 800, ...t })))
      return
    }
    const color = swatch ?? "#e5e5e5"
    onChange(switchFinish(m, 
        k === "wood"
          ? { kind: "wood", species: "oak" }
          : k === "tiles"
            ? { kind: "tiles", color, grout: "#cfcac0", size: 600 }
            : k === "stone"
              ? { kind: "stone", color: swatch ?? "#e8e4dc", vein: "#8f8a82", veins: 0.5, size: 1200, seed: 7 }
              : k === "fabric"
                ? { kind: "fabric", color }
                : { kind: k, color },
    ))
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
            value={nameText}
            onChange={(e) => setNameText(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
              else if (e.key === "Escape") {
                setNameText(m.name)
                e.currentTarget.blur()
              }
            }}
            aria-invalid={typedError ? true : undefined}
            autoFocus={autoFocusName}
            onFocus={(e) => autoFocusName && e.currentTarget.select()}
            aria-label="Nom del material"
            borderColor="transparent"
            _hover={{ borderColor: "border" }}
            _focus={{ borderColor: "wood.solid" }}
          />
          {typedError ? (
            <Text fontSize="xs" color="fg.error" role="alert">
              {typedError}
            </Text>
          ) : (
            <Text fontSize="xs" color="fg.muted" truncate>
              {materialSummary(m)}
            </Text>
          )}
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
          <ChoiceChips<Finish["kind"]>
            label="Acabat"
            options={[
              { id: "color", label: "Color llis" },
              { id: "lacquer", label: "Lacat" },
              { id: "wood", label: "Fusta" },
              { id: "image", label: "Foto (textura)" },
              { id: "metal", label: "Metall" },
              { id: "glass", label: "Vidre" },
              { id: "fabric", label: "Teixit" },
              { id: "tiles", label: "Rajola" },
              { id: "stone", label: "Pedra / marbre" },
            ]}
            value={finish.kind}
            onChange={setKind}
          />
        </FormRow>
        {finish.kind === "image" ? (
          <FormRow label="Foto" help={`${finish.tileMm} × ${Math.round(finish.tileMm * (finish.aspect ?? 1))} mm de tauler per repetició, ${finish.seamless ? "repetida tal qual" : "en mirall"}.`}>
            <HStack gap={3} align="flex-start" wrap="wrap">
              <MapThumb src={finish.src} label="Foto de color" />
              <Stack gap={1} minW={0} flex="1 1 200px">
                <HStack gap={2} wrap="wrap">
                  <HStack gap={1.5} wrap="wrap">
                    <Box w="150px">
                      <NumberField label="" ariaLabel="Amplada de la foto" value={finish.tileMm} min={50} max={5000} step={10} onChange={(v) => v >= 50 && v <= 5000 && onChange({ finish: { ...finish, tileMm: v } })} />
                    </Box>
                    <Text fontSize="sm" color="fg.muted">
                      d'amplada
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
              </Stack>
            </HStack>
          </FormRow>
        ) : finish.kind === "wood" ? (
          <FormRow label="Espècie">
            <ChoiceChips label="Espècie" options={SPECIES.map((s) => ({ id: s.value, label: s.label }))} value={finish.species} onChange={(species) => onChange({ finish: { kind: "wood", species } })} />
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
        {finish.kind === "image" && <TextureMapRows finish={finish} onChange={(f) => onChange({ finish: f })} />}
        {finish.kind === "tiles" && (
          <FormRow label="Rajola">
            <HStack gap={3} wrap="wrap">
              <Box w="150px">
                <NumberField label="" ariaLabel="Mida de la rajola" value={finish.size} min={20} max={1500} step={10} onChange={(v) => v >= 20 && v <= 1500 && onChange({ finish: { ...finish, size: v } })} />
              </Box>
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
        <TextureSetRow finish={finish} onChange={(f) => onChange({ finish: f })} />
      </FormSection>

      <FormSection title="Fabricació">
        {/* Els de simulació només es veuen: sense gruixos, cantell ni veta (es conserven per si es canvia de categoria). */}
        {category.id !== "sim" && <>
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
        </>}
        <FormRow label="Categoria" help={category.hint}>
          <ChoiceChips<MaterialCategory>
            label="Categoria"
            options={MATERIAL_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
            value={category.id}
            onChange={(id) => {
              const next = withCategory(m, id)
              // Replaça tot el material: `forBacks` i `cnc` poden desaparèixer.
              onChange({ ...next, forBacks: next.forBacks, cnc: next.cnc, category: next.category })
            }}
          />
        </FormRow>
      </FormSection>
    </Box>
  )
}

/** Material i gruix per defecte en una fila: el gruix es tria d'entre els del material. */
function DefaultPick({ label, materials, all, material, thickness, onChange }: { label: string; materials: MaterialPref[]; all: MaterialPref[]; material: string; thickness: number; onChange: (material: string, thickness: number) => void }) {
  const known = all.find((m) => m.name === material)
  const list = known?.thicknesses ?? []
  // Un gruix que no és dels del material no s'afegeix com a pastilla: una nota a sota.
  return (
    // Les pastilles del gruix van a sota (no hi caben al costat del material).
    <Stack gap={2} maxW="400px">
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
      {list.length > 0 && <ChoiceChips label={`Gruix ${label.toLowerCase()}`} options={list.map((t) => ({ id: String(t), label: `${t} mm` }))} value={String(thickness)} onChange={(v) => onChange(material, Number(v))} />}
      {!known ? (
        <Text fontSize="xs" color="fg.muted">
          El material «{material}» no és a Preferències: tria'n un altre.
        </Text>
      ) : (
        !list.includes(thickness) && (
          <Text fontSize="xs" color="fg.muted">
            El gruix {thickness} mm no és dels gruixos de «{material}»: tria'n un.
          </Text>
        )
      )}
    </Stack>
  )
}

// --- Ferratges -----------------------------------------------------------------------------

function HardwareForm({ hardware: h, onChange }: { hardware: Settings["hardware"]; onChange: (h: Settings["hardware"]) => void }) {
  // Mentre s'escriu, el text tal com és; si no, el de les preferències (així «Restaurar» i «Importar» es veuen).
  const [slides, setSlides] = useState<string | null>(null)
  const sub = <K extends keyof Settings["hardware"]>(key: K, patch: Partial<Settings["hardware"][K]>) => onChange({ ...h, [key]: { ...h[key], ...patch } })
  return (
    <FoldGrid>
      <Group title="Cassoleta de frontissa" icon={LuCircleDashed}>
        <NumRow label="Diàmetre (Ø)" value={h.hinge.cupDiameter} min={20} max={40} step={1} onChange={(cupDiameter) => sub("hinge", { cupDiameter })} />
        <NumRow label="Fondària" value={h.hinge.cupDepth} min={5} max={20} step={0.5} onChange={(cupDepth) => sub("hinge", { cupDepth })} />
        <NumRow label="Al cantell" help="Del cantell de la porta a la vora de la cassoleta." value={h.hinge.cupOffset} min={15} max={30} step={0.5} onChange={(cupOffset) => sub("hinge", { cupOffset })} />
      </Group>
      <Group title="System 32" icon={LuCircleDot}>
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
      <Group title="Calaixos (guia genèrica)" icon={LuArchive}>
        <FormRow label="Llargades de guia" help="Es tria la més llarga que hi cap." maxW="360px">
          <Input
            size="sm"
            aria-invalid={h.drawer.slideLengths.length === 0 || undefined}
            value={slides ?? h.drawer.slideLengths.join(" · ")}
            onChange={(e) => {
              setSlides(e.target.value)
              const list = parseList(e.target.value)
              if (list.length) sub("drawer", { slideLengths: list })
            }}
            onBlur={() => setSlides(null)}
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
      <Group title="Imants (reixetes i trapes)" icon={LuMagnet}>
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
      {/* Pastilles que salten de línia (el control segmentat es desbordava al mòbil). */}
      <ChoiceChips
        label="Tema"
        value={(theme ?? "system") as "light" | "dark" | "system"}
        onChange={setTheme}
        options={[
          { id: "light", label: <><LuSun /> Dia</> },
          { id: "dark", label: <><LuMoon /> Nit</> },
          { id: "system", label: <><LuMonitor /> Sistema</> },
        ]}
      />
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

/** Cel de defecte del render (Preferències › Visor 3D): un per als mobles i un per als ambients. */
function SkyFields() {
  const [moble, setMoble] = useSkyPref("moble")
  const [ambient, setAmbient] = useSkyPref("ambient")
  const opts = SKIES.map((k) => ({ id: k.id, label: k.label }))
  const label = (id: SkyId) => SKIES.find((k) => k.id === id)?.label ?? ""
  return (
    <SettingsGroup icon={<LuSun />} title="Cel del render" summary={`${label(moble)} · ${label(ambient)}`}>
      <Text textStyle="sm" color="fg.muted">
        Amb quin cel comença el render. «Núvols» i «Interior» són cels reals (HDRI de Poly Haven): llum i reflexos de debò. Al render es pot canviar o carregar-ne un de teu.
      </Text>
      <FormRow label="Mobles" help={SKIES.find((k) => k.id === moble)?.help}>
        <ChoiceChips label="Cel dels mobles" value={moble} onChange={setMoble} options={opts} />
      </FormRow>
      <FormRow label="Ambients" help={SKIES.find((k) => k.id === ambient)?.help}>
        <ChoiceChips label="Cel dels ambients" value={ambient} onChange={setAmbient} options={opts} />
      </FormRow>
    </SettingsGroup>
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
        <ChoiceChips label="Qualitat" value={quality} onChange={setQuality} options={(Object.keys(QUALITY_LABELS) as RenderQuality[]).map((k) => ({ id: k, label: QUALITY_LABELS[k] }))} />
      </FormRow>
      </SettingsGroup>

      <SkyFields />

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
 * càpiga a les preferències sense ocupar massa. També en dona el color mitjà (STEP, mostres).
 */
async function pickTexture(): Promise<{ src: string; aspect: number; color?: string } | null> {
  const [p] = await pickFiles({ accept: "image/*" })
  if (!p) return null
  try {
    return await encodeMap(p.file, "color")
  } catch (e) {
    toaster.create({ title: "No s'ha pogut llegir la foto", description: e instanceof Error ? e.message : String(e), type: "error", duration: 8000 })
    return null
  }
}
