import { Spinner, Stack, Text } from "@chakra-ui/react"
import { lazy, Suspense } from "react"
import { LuFactory, LuLampFloor, LuLayoutGrid, LuListTree, LuMessageSquare, LuPalette, LuRoute, LuRuler, LuScan, LuScanEye, LuSunMoon, LuTag, LuWrench } from "react-icons/lu"
import { setKitPilot, defaultMachine, type Composition, type Settings } from "../../core/model"
import { SettingsGroup } from "../../components/SettingsGroup"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { NumRow } from "../../components/NumRow"
import { MaterialsList } from "./MaterialsPane"
import { useSettings } from "./SettingsContext"
import { MachinesList } from "./MachinesPane"
import { MachineRulesGroup } from "./MachineRules"
import { DeleteMaterialDialog } from "./DeleteMaterialDialog"
import { DeleteHardwareDialog } from "./DeleteHardwareDialog"
import { HardwareList } from "./HardwarePane"
import { AssistantPane } from "./AssistantPane"
import { AccentField, ThemeField } from "./screen/AppearanceFields"
import { BoardsFields } from "./screen/BoardsFields"
import { GapsFields } from "./screen/GapsFields"
import { KitPilotGroup } from "./screen/KitPilotGroup"
import { MaterialDefaults } from "./screen/MaterialDefaults"
import { ReferencesList } from "./screen/ReferencesList"
import { ResetDialog } from "./screen/ResetDialog"
import { SceneFields } from "./screen/SceneFields"
import { SettingsHeader } from "./screen/SettingsHeader"
import { Pane, SettingsPages } from "./screen/SettingsPages"
import { useHardwareActions, useMaterialActions } from "./screen/useLibraryActions"
import { useSectionReset } from "./screen/useSectionReset"
import { useSettingsDraft } from "./screen/useSettingsDraft"
import { useSettingsFile } from "./screen/useSettingsFile"

// El dibuix de la cascada porta React Flow: es carrega en obrir la pàgina.
const CascadePane = lazy(() => import("./cascade/CascadePane").then((m) => ({ default: m.CascadePane })))

export function SettingsScreen({ previewComposition }: { previewComposition?: Composition }) {
  const { settings, loading, save } = useSettings()
  if (loading) return null
  return <SettingsEditor key={JSON.stringify(settings.version)} initial={settings} save={save} previewComposition={previewComposition} />
}

function SettingsEditor({ initial, save, previewComposition }: { initial: Settings; save: (s: Settings) => Promise<void>; previewComposition?: Composition }) {
  const { draft, setDraft, validation, problems, set } = useSettingsDraft(initial, save)
  const { reset, setReset, confirmReset } = useSectionReset(setDraft)
  const machine = defaultMachine(draft.machines)
  // Canviar el nom o eliminar un material (els desats el segueixen); eliminar o confirmar un ferratge.
  const { cascade, renameMaterial, deleting, setDeleting, confirmDelete } = useMaterialActions(draft, setDraft, save)
  const { deletingHw, setDeletingHw, confirmDeleteHw, confirmedHw } = useHardwareActions(draft, setDraft, save)
  const { fileInput, doExport, doImport } = useSettingsFile(draft, setDraft, validation.success ? validation.data : undefined, cascade)

  return (
    <Stack gap={5} w="full">
      <SettingsPages header={<SettingsHeader fileInput={fileInput} onImport={doImport} onExport={doExport} problems={problems} />}>
          <Pane id="references" wide title="Objectes de referència" icon={LuScan} desc="Mides conegudes per calibrar la foto i per veure-les al costat del moble." onReset={() => setReset({ key: "references", label: "Objectes de referència" })}>
            <ReferencesList refs={draft.references} onChange={(references) => set("references", references)} />
          </Pane>

          <Pane id="materials" wide title="Materials" icon={LuPalette} desc="Taulers, fons, metall, pedra i vidre, i els de simulació per als ambients." onReset={() => setReset({ key: "materials", label: "Materials" })}>
            <MaterialsList
              materials={draft.materials}
              onChange={(materials) => set("materials", materials)}
              onRename={renameMaterial}
              onDelete={setDeleting}
              defaults={draft.defaults}
              footer={
                // A l'editor d'un tauler o d'un fons, sota el formulari: quin tauler i quin fons tenen els mòduls nous.
                <MaterialDefaults materials={draft.materials} defaults={draft.defaults} onChange={(defaults) => set("defaults", defaults)} />
              }
            />
          </Pane>

          <Pane id="boards" title="Taulers" icon={LuLayoutGrid} desc="Mides dels taulers de fàbrica per al nesting. La separació i el marge són de la màquina." onReset={() => setReset({ key: "boards", label: "Taulers" })}>
            <BoardsFields boards={draft.boards} materials={draft.materials} machine={machine} onChange={(boards) => set("boards", boards)} />
          </Pane>

          <Pane id="hardware" wide title="Ferratges" icon={LuWrench} desc="La biblioteca: frontisses i plaques, guies i jocs de calaix, espigues, System 32, braços, imants, tiradors, potes, accessoris (barra de penjar, perfil LED, marc de vitrina) i els importats del fabricant; els seus forats i quin fa servir cada lloc als mòduls nous." onReset={() => setReset({ key: "hardwareLibrary", label: "Ferratges", note: "Torna la biblioteca inicial (els ferratges afegits es perden) i els per defecte. Els mobles fets porten la seva còpia: no canvien." })}>
            <HardwareList items={draft.hardwareLibrary} defaults={draft.hardwareDefaults} onChange={(hardwareLibrary) => set("hardwareLibrary", hardwareLibrary)} onDefaults={(hardwareDefaults) => set("hardwareDefaults", hardwareDefaults)} onDelete={setDeletingHw} onConfirmed={confirmedHw} settings={draft} />
          </Pane>

          <Pane
            id="rules"
            title="Regles de mecanitzat"
            icon={LuRoute}
            desc="Com mecanitza la CNC: freses per a cada cosa, passades, rampa, peces petites i la prebroca dels cargols."
            onReset={() => setReset({ key: "machiningRules", label: "Regles de mecanitzat", note: "Les regles tornen a les del taller (les mateixes per a totes les màquines). Les eines de les màquines no canvien." })}
          >
            <MachineRulesGroup rules={draft.machiningRules} machines={draft.machines} onChange={(rules) => set("machiningRules", rules)} />
            {/* Els jocs de la biblioteca en copien els números (`setKitPilot`). */}
            <KitPilotGroup pilot={draft.kitPilot} onChange={(next) => setDraft((d) => ({ ...d, kitPilot: next, hardwareLibrary: setKitPilot(d.hardwareLibrary, next) }))} />
          </Pane>

          <Pane id="gaps" title="Folgances per defecte" icon={LuRuler} desc="Separacions (folgances) dels fronts i de les peces de dins, retranqueig dels prestatges i ranura del fons, per als mòduls nous." onReset={() => setReset({ key: "gaps", label: "Folgances per defecte" })}>
            <GapsFields gaps={draft.gaps} onChange={(gaps) => set("gaps", gaps)} />
          </Pane>

          <Pane id="options" wide title="Opcions en cascada" icon={LuListTree} desc="Un esborrany de la cascada d'opcions de l'Editor per dibuixar com la vols: no canvia res de l'Editor.">
            <Suspense fallback={<Spinner colorPalette="wood" />}>
              <CascadePane />
            </Suspense>
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

          <Pane id="assistant" title="Assistent IA" icon={LuMessageSquare} desc="La clau de l'API de Claude i el model de l'assistent: el xat de l'Editor (mobles i objectes) i dels Ambients.">
            <AssistantPane value={draft.assistant} onChange={(assistant) => set("assistant", assistant)} />
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
      <DeleteHardwareDialog item={deletingHw} items={draft.hardwareLibrary} defaults={draft.hardwareDefaults} onCancel={() => setDeletingHw(null)} onConfirm={confirmDeleteHw} />

      <ResetDialog reset={reset} onCancel={() => setReset(null)} onConfirm={confirmReset} />
    </Stack>
  )
}
