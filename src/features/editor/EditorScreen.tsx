import { useEffect, useMemo, useState } from "react"
import { useSessionList } from "../../components/sessionState"
import { Workspace } from "../../components/Workspace"
import { useWorkspace } from "../../components/useWorkspace"
import { TopBarActions } from "../../components/TopBar"
import { toaster } from "../../components/ui/toaster"
import { applySettingsToModule, compositionKind, defaultMachine, CompositionSchema, emptyModule, partsOnlyKind, tableModule, withMobleMaterials, type Composition } from "../../core/model"
import { readComposition, updateProjectComposition, type CompositionRead } from "../../db/compositionStore"
import type { Project } from "../../db/db"
import { StructureTree } from "../composition/StructureTree"
import { PhotoScreen } from "../photo/PhotoScreen"
import { useSettings } from "../settings/SettingsContext"
import { useCompositionBuild, useProject } from "../useProject"
import { UndoRedo } from "../../components/UndoRedo"
import { useDebouncedSave } from "../../lib/useDebouncedSave"
import { compositionEdits, hardwareCommands } from "./editorCommands"
import { EditorInspector } from "./EditorInspector"
import { EditorLeftPanel } from "./EditorLeftPanel"
import { ModelingRibbon } from "./ModelingRibbon"
import { ModelingTree } from "../modeling/ModelingTree"
import { EditorViewport } from "./EditorViewport"
import { framePose, warningTarget } from "./warningTarget"
import { openFolds } from "../../components/foldOpen"
import type { CompositionWarning } from "../../core/build/buildComposition"
import type { FixPlaceKey } from "../../core/build/buildModule"
import { ElevationView } from "./ElevationView"
import { SceneView } from "./SceneView"
import { ViewerToolbar } from "./ViewerToolbar"
import { useEditorAssistant } from "./useEditorAssistant"
import { useEditorCamera } from "./useEditorCamera"
import { useEditorDoc } from "./useEditorDoc"
import { useEditorKeys } from "./useEditorKeys"
import { isSelectionLocked, useEditorSelection } from "./useEditorSelection"
import { useSceneData } from "./useSceneData"
import { useViewerHandles } from "./useViewerHandles"
import { useViewerOptions } from "./useViewerOptions"
import { viewerPicks } from "./viewerPicks"
import { HoverLinkProvider } from "../../components/HoverLinkProvider"
import { FloatingWindow } from "../../components/FloatingWindow"

export function EditorScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  // Els àlies dels materials («X (foto)») depenen de les preferències: no es fa la composició fins que s'han llegit.
  const { loading } = useSettings()
  const read = useMemo(() => (project && !loading ? readComposition(project) : undefined), [project, loading])
  if (!project || !read) return null
  return <Editor key={project.id} projectId={project.id} name={project.name} initial={read.composition} read={read} project={project} />
}

function Editor({ projectId, name, initial, read: readNow, project }: { projectId: number; name: string; initial: Composition; read: CompositionRead; project: Project }) {
  // La secció oberta de l'inspector (una sola alhora).
  const [inspectorOpen, setInspectorOpen] = useSessionList("mobles:inspector-open")
  // La lectura en obrir-lo (la de després de cada desada ja no cal: és la que hem desat).
  const [read] = useState(readNow)
  // Composició (i càmera) amb desfer/refer i les seves dreceres (`useEditorDoc`).
  const { history, setDoc, commitHistory, comp, setComp, getComp, applyLive } = useEditorDoc(initial)
  const kind = compositionKind(comp)
  // Espai de treball compartit (Workspace): panells, amplades i pestanya del mòbil.
  // A l'ordinador, cada panell lateral es plega pel seu compte (com les barres laterals
  // d'una app d'escriptori): l'arbre a l'esquerra i les propietats a la dreta.
  // Amplades dels panells laterals: s'arrosseguen per la vora (com el separador de l'app de
  // Claude) i es recorden. Si la finestra és estreta, els panells s'encongeixen fins al seu
  // mínim abans que el visor es faci més petit que el seu mínim.
  const ws = useWorkspace("editor", { tree: 280, form: 340 })
  // Selecció única (arbre, 3D i alçat van sincronitzats) i el mòdul de treball.
  const { selectedZone, module, moduleIndex, zone, selection, select, selectModule, selectZone, pick, shiftRef } = useEditorSelection({ comp, initial, kind, setMobilePane: ws.setMobilePane })
  const camera = useEditorCamera({ projectId, initial, setDoc, histCam: history.value.cam })
  const opts = useViewerOptions(compositionKind(initial) === "objecte")
  const photoTab = opts.viewTab === "photo"
  // Contenidor de l'inspector on la pestanya Foto hi pinta els seus controls.
  const [photoControls, setPhotoControls] = useState<HTMLDivElement | null>(null)
  const { settings } = useSettings()

  const build = useCompositionBuild(comp)
  const moduleBuild = build?.modules[moduleIndex]?.build

  // Desa amb retard quan la composició canvia; el que queda pendent es desa en sortir de l'Editor (si
  // no, Exportar llegiria la versió anterior). Només si és vàlida (com a Preferències): un camp a mig escriure no
  // ha de desar un moble que després no s'obriria.
  // Si la composició desada no s'ha pogut llegir, no es desa a sobre (`updateProjectComposition` tampoc ho faria).
  useDebouncedSave(comp, (c) => {
    if (read.unreadable) return undefined
    return CompositionSchema.safeParse(c).success ? updateProjectComposition(projectId, c) : undefined
  })
  // Avís (un cop en obrir-lo) si s'ha hagut de reparar o no s'ha pogut llegir.
  useEffect(() => {
    if (read.unreadable) {
      toaster.create({ id: `unreadable-${projectId}`, title: "No s'ha pogut llegir aquest moble", description: "Es mostra una caixa per defecte i els canvis no es desaran, per no perdre les dades desades.", type: "error", duration: 12000 })
    } else if (read.problems.length) {
      const shown = read.problems.slice(0, 4).join(" ")
      const more = read.problems.length > 4 ? ` (i ${read.problems.length - 4} més)` : ""
      toaster.create({ id: `repaired-${projectId}`, title: "S'han tret dades malmeses del moble", description: shown + more, type: "warning", duration: 12000 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- l'avís surt un cop, en obrir el moble
  }, [])

  // Assistent IA: les eines del document i la selecció, a `assistantHub`.
  useEditorAssistant({ projectId, name, kind, settings, comp, selection, getComp, applyLive, commitHistory })

  // El que es dibuixa i s'avisa: peces, mòduls, fantasmes, avisos, obertura i ressaltats.
  const scene = useSceneData({ comp, build, materials: settings.materials, machine: defaultMachine(settings.machines), selectionKind: selection.kind, selectedZone, module, moduleIndex, moduleBuild, viewer: opts.viewer })
  const edits = compositionEdits(setComp)
  const { duplicateHardware, removeHardware, hardwareActions } = hardwareCommands({
    comp,
    setComp,
    selection,
    select,
    openInspector: () => {
      setInspectorOpen(["hw-place"])
      ws.setPropsHidden(false)
    },
  })
  const selectionLocked = isSelectionLocked(comp, selection)
  // Teclat: copiar, enganxar, duplicar, esborrar, agrupar i moure amb les fletxes.
  useEditorKeys({ comp, setComp, selection, select, module, zone, selectionLocked, absParts: scene.absParts, edits, duplicateHardware, removeHardware })
  const picks = viewerPicks({ comp, build, selection, select, selectModule, pick, shiftRef })
  // «Anar-hi» d'un avís (per decisió de l'usuari, 2026-10-17): tria on és, la càmera hi vola amb les peces marcades i
  // s'obre la secció on s'arregla. El marcatge es treu quan es tria una altra cosa.
  const gotoWarning = (w: CompositionWarning, where?: FixPlaceKey) => {
    const t = warningTarget(w, comp, build, where)
    if (t.select) select(t.select)
    if (opts.viewTab !== "3d") opts.setViewTab("3d")
    camera.focusAlert(new Set(t.panels), t.box ? framePose(t.box, scene.frameSize) : null, JSON.stringify(t.select ?? selection))
    ws.setPropsHidden(false)
    if (t.fix) {
      setInspectorOpen([t.fix.folds[0]!])
      openFolds(t.fix.folds)
    }
  }
  const { alert, clearAlert } = camera
  useEffect(() => {
    if (alert && JSON.stringify(selection) !== alert.sel) clearAlert()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- només quan canvia la selecció
  }, [selection])
  const handles = useViewerHandles()
  // Botó dret al 3D (com Figma, per decisió de l'usuari, 2026-10-28): les propietats del que hi ha sota el ratolí en una
  // finestra al seu costat, per canviar-les allà mateix. És el mateix inspector del panell (no una còpia de camps).
  const [propsAt, setPropsAt] = useState<{ x: number; y: number } | null>(null)
  // Una selecció nova, un inspector nou: les finestres de tria (material, ferratge) que s'hi havien obert es tanquen
  // (no són modals: si no, la tria aniria a parar al que s'ha seleccionat després). `popup`: el de la finestra del botó
  // dret (sense els controls de la Foto, que són del panell).
  const inspector = (popup: boolean) => (
    <EditorInspector
      key={JSON.stringify(selection)}
      inspectorOpen={inspectorOpen}
      setInspectorOpen={setInspectorOpen}
      comp={comp}
      setComp={setComp}
      kind={kind}
      name={name}
      project={project}
      settings={settings}
      build={build}
      scene={scene}
      selection={selection}
      select={select}
      selectZone={selectZone}
      module={module}
      moduleIndex={moduleIndex}
      moduleBuild={moduleBuild}
      zone={zone}
      photoTab={popup ? false : photoTab}
      setPhotoControls={popup ? NO_PHOTO : setPhotoControls}
      edits={edits}
      hardwareActions={hardwareActions}
      onGotoWarning={gotoWarning}
    />
  )

  const newModule = (id: string, n: string) => withMobleMaterials(applySettingsToModule(settings, kind === "taula" ? tableModule(id, n) : emptyModule(id, n)), comp.modules)
  const partCenter = { x: Math.round(scene.size.width / 2), y: partsOnlyKind(kind) ? 0 : Math.round(scene.size.height / 2), z: partsOnlyKind(kind) ? 0 : Math.round(scene.size.depth + 50) }

  return (
    <HoverLinkProvider>
      <TopBarActions>
        <UndoRedo {...history} />
      </TopBarActions>

      {/* Un model de Modelatge: la barra d'eines del Taulell, amb els nostres components (cel, 2026-11-07). */}
      {project.modeling && (
        <ModelingRibbon comp={comp} setComp={setComp} selection={selection} select={select} settings={settings} center={partCenter} newModule={newModule} opts={opts} camera={camera} />
      )}
      <Workspace
        ws={ws}
        left={
        <EditorLeftPanel
          catalog={!project.modeling}
          comp={comp}
          onChange={setComp}
          onSelect={(s) => pick(s, true)}
          tree={
        // A Modelatge, l'arbre del Taulell: mobles, peces i mecanitzats (cel, 2026-11-07).
        project.modeling ? <ModelingTree comp={comp} build={build} selection={selection} onSelect={(s) => pick(s, true)} /> : <StructureTree
          name={name}
          comp={comp}
          selection={selection}
          onSelect={(s) => pick(s, true)}
          onChange={setComp}
          newModule={newModule}
          partCenter={partCenter}
        />
          }
        />
        }
        right={
          inspector(false)
        }
        // Mobles i objectes: el mateix xat amb les eines de cada tipus (un objecte només té peces lliures). Els `lliure`
        // d'abans (flat-pack que es fabrica) no en tenen.
        // Sense pestanya «Assistent» (per decisió de l'usuari, 2026-10-13): l'assistent personal és al menú principal
        // i fa servir aquest document pel `assistantHub`.
        center={(chrome) => (
          <EditorViewport
            opts={opts}
            shownPanels={scene.shownPanels}
            // A Modelatge, els botons del visor són a la barra d'eines (Inici › Vista i Visualització), com al Taulell.
            chrome={project.modeling ? null : chrome}
            tabs={kind !== "objecte" && !project.modeling}
            photo={
              <PhotoScreen
                projectId={projectId}
                panels={scene.panels}
                embedded
                controlsTarget={photoControls}
                composition={comp}
                onApplyMeasure={edits.applyMeasure}
                selectedModule={selection.kind === "module" || selection.kind === "zone" ? moduleIndex + 1 : null}
              />
            }
            elevation={
              <ElevationView
                comp={comp}
                kind={kind}
                module={module}
                moduleBuild={moduleBuild}
                moduleX={build?.modules[moduleIndex]?.x}
                moduleY={build?.modules[moduleIndex]?.y}
                panels={scene.panels}
                selectedZone={selectedZone}
                select={select}
                selectModule={selectModule}
                formHidden={opts.formHidden}
              />
            }
            scene={
              <SceneView
                comp={comp}
                setComp={setComp}
                materials={settings.materials}
                scene={scene}
                opts={opts}
                camera={camera}
                selection={selection}
                module={module}
                selectionLocked={selectionLocked}
                select={select}
                pick={pick}
                picks={picks}
                edits={edits}
                onSceneAccess={handles.registerScene}
                onProps={setPropsAt}
              />
            }
            toolbar={
              project.modeling ? null : <ViewerToolbar
                opts={opts}
                camera={camera}
                name={name}
                projectId={projectId}
                viewerPanels={scene.viewerPanels}
                models={build?.models}
                hasMoving={scene.groups.length > 0}
                hasSelectedZone={!!scene.zoneRect}
                sceneGetter={handles.sceneGetter}
              />
            }
          />
        )}
      />
      <FloatingWindow id="editor-props" kind="picker" width={360} height={600} open={!!propsAt} at={propsAt ?? undefined} onClose={() => setPropsAt(null)} title="Propietats" initialFocus={false}>
        {inspector(true)}
      </FloatingWindow>
    </HoverLinkProvider>
  )
}

const NO_PHOTO = () => {}
