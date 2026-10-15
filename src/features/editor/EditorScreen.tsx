import { useEffect, useMemo, useState } from "react"
import { useSessionList } from "../../components/sessionState"
import { Workspace } from "../../components/Workspace"
import { useWorkspace } from "../../components/useWorkspace"
import { TopBarActions } from "../../components/TopBar"
import { toaster } from "../../components/ui/toaster"
import { applyModuleOptionDefaults, applySettingsToModule, compositionKind, CompositionSchema, emptyModule, partsOnlyKind, tableModule, type Composition } from "../../core/model"
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
import { EditorViewport } from "./EditorViewport"
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
  const scene = useSceneData({ comp, build, materials: settings.materials, selectionKind: selection.kind, selectedZone, module, moduleIndex, moduleBuild, viewer: opts.viewer })
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
  const handles = useViewerHandles(name)

  return (
    <>
      <TopBarActions>
        <UndoRedo {...history} />
      </TopBarActions>

      <Workspace
        ws={ws}
        left={
        <StructureTree
          name={name}
          comp={comp}
          selection={selection}
          onSelect={(s) => pick(s, true)}
          onChange={setComp}
          // Un mòdul nou: materials i folgances de Preferències i, al «+» de sempre (no a les taules), els per defecte de
          // Preferències › Opcions en cascada.
          newModule={(id, n) => (kind === "taula" ? applySettingsToModule(settings, tableModule(id, n)) : applyModuleOptionDefaults(applySettingsToModule(settings, emptyModule(id, n)), settings.optionPrefs))}
          partCenter={{ x: Math.round(scene.size.width / 2), y: partsOnlyKind(kind) ? 0 : Math.round(scene.size.height / 2), z: partsOnlyKind(kind) ? 0 : Math.round(scene.size.depth + 50) }}
        />
        }
        right={
          // Una selecció nova, un inspector nou: les finestres de tria (material, ferratge) que s'hi havien obert es tanquen
          // (no són modals: si no, la tria aniria a parar al que s'ha seleccionat després).
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
            photoTab={photoTab}
            setPhotoControls={setPhotoControls}
            edits={edits}
            hardwareActions={hardwareActions}
          />
        }
        // Mobles i objectes: el mateix xat amb les eines de cada tipus (un objecte només té peces lliures). Els `lliure`
        // d'abans (flat-pack que es fabrica) no en tenen.
        // Sense pestanya «Assistent» (per decisió de l'usuari, 2026-10-13): l'assistent personal és al menú principal
        // i fa servir aquest document pel `assistantHub`.
        center={(chrome) => (
          <EditorViewport
            opts={opts}
            shownPanels={scene.shownPanels}
            chrome={chrome}
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
                onCapture={handles.registerCapture}
                onSceneAccess={handles.registerScene}
              />
            }
            toolbar={
              <ViewerToolbar
                opts={opts}
                camera={camera}
                name={name}
                projectId={projectId}
                viewerPanels={scene.viewerPanels}
                models={build?.models}
                hasMoving={scene.groups.length > 0}
                hasSelectedZone={!!scene.zoneRect}
                sceneGetter={handles.sceneGetter}
                onImage={() => void handles.downloadImage()}
              />
            }
          />
        )}
      />
    </>
  )
}
