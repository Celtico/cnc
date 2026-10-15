import { Box, Flex } from "@chakra-ui/react"
import { useCallback, useMemo, useRef, useState } from "react"
import { toaster } from "../../components/ui/toaster"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { openRender } from "../../components/viewer/render/renderStore"
import { ambientSummary, parseAmbient, type Ambient, type Composition, type PlanPt } from "../../core/model"
import { createProject, db } from "../../db/db"
import { TopBarActions } from "../../components/TopBar"
import { uniqueName } from "../../core/file/mobleFile"
import { AmbientPicker } from "./AmbientPicker"
import { useLiveQuery } from "../../db/useLiveQuery"
import { Workspace } from "../../components/Workspace"
import { useWorkspace } from "../../components/useWorkspace"
import { useSettings } from "../settings/SettingsContext"
import { useProjects } from "../useProject"
import { Ambient3D } from "./Ambient3D"
import { itemName, useItemGeometries } from "./ambientData"
import { PlanCanvas } from "./PlanCanvas"
import type { Tool } from "./planGeom"
import { useUndoKeys } from "../history/useHistory"
import { UndoRedo } from "../../components/UndoRedo"
import { AmbientTree } from "./editor/AmbientTree"
import { CalibrateDialog } from "./editor/CalibrateDialog"
import { kindOf } from "./editor/itemKind"
import { pickPlanImage } from "./editor/pickPlanImage"
import { SelectionInspector } from "./editor/SelectionInspector"
import { useAmbientActions } from "./editor/useAmbientActions"
import { useAmbientAssistant } from "./editor/useAmbientAssistant"
import { useAmbientDoc } from "./editor/useAmbientDoc"
import { useAmbientSelection } from "./editor/useAmbientSelection"
import { useAmbientShortcuts } from "./editor/useAmbientShortcuts"
import { useAmbientTab } from "./editor/useAmbientTab"
import { useCameraHistory } from "./editor/useCameraHistory"
import { useViewFlags } from "./editor/useViewFlags"
import { AmbientViewOptions, CameraButtons, DrawTools, ToolHint, ViewerTabs } from "./editor/ViewerOverlays"

/**
 * Editor d'un ambient: el plànol (parets, plànol de fons, mobles i blocs) i la vista 3D. Els
 * mobles són els de la llista (enllaç): aquí només se'n toquen les mides generals i la posició.
 * Desfer/refer, i dreceres com a Figma: V · P · H, Supr, fletxes (Maj ×10), R (girar 90°),
 * Ctrl/⌘ D (duplicar), Ctrl/⌘ Z / Maj Z.
 */
/** Barra superior de l'ambient obert: «Ambients › nom» (el nom es reanomena amb un clic). */
export function AmbientEditor({ ambientId, onOpenProject }: { ambientId: number; onOpenProject: (id: number) => void }) {
  const row = useLiveQuery(() => db.ambients.get(ambientId), [ambientId])
  // Els àlies dels materials («X (foto)») depenen de les preferències: s'espera que s'hagin llegit.
  const { loading } = useSettings()
  // Es llegeix un cop en obrir (després, la font de veritat és l'estat local, que es desa sol).
  if (!row || loading) return null
  return <EditorInner key={ambientId} ambientId={ambientId} name={row.name} initial={parseAmbient(row.data)} onOpenProject={onOpenProject} />
}

function EditorInner({ ambientId, name, initial, onOpenProject }: { ambientId: number; name: string; initial: Ambient; onOpenProject: (id: number) => void }) {
  const { settings } = useSettings()
  const projects = useProjects()
  // L'ambient amb desfer/refer, desat sol (`useAmbientDoc`).
  const { history, amb, setAmb, ambRef, change, resizeLinked, shownAmb, changeShown } = useAmbientDoc(ambientId, initial)
  const { undo, redo } = history
  const [tool, setTool] = useState<Tool>("select")
  const [tab, setTab] = useAmbientTab()
  const [fit, setFit] = useState(0)
  // Botons «Encabir» / «Enquadrar» / «Interior» marcats mentre la vista és la seva (com a l'editor).
  const [planFramed, setPlanFramed] = useState(true)
  const [pose, setPose] = useState<"home" | "eye" | null>("home")
  // Vista d'interior: la càmera a l'alçada dels ulls, dins de l'habitació (per als renders).
  const [eye, setEye] = useState(0)
  const [calib, setCalib] = useState<{ a: PlanPt; b: PlanPt } | null>(null)
  const [wallDefaults, setWallDefaults] = useState({ thickness: 100, height: 2600 })
  const [picker, setPicker] = useState(false)
  // El mateix espai de treball que l'editor de mobles (panells arrossegables i plegables).
  const ws = useWorkspace("ambient", { tree: 260, form: 320 })
  const flags = useViewFlags()
  const selection = useAmbientSelection(amb, ws.setMobilePane)
  const { sel, select, selIds, selWallIds, pickItem, pickWall } = selection
  const [objPicker, setObjPicker] = useState(false)
  // Render (path tracing per GPU o CPU), el mateix de l'editor.
  const startRender = () => openRender({ getScene: () => sceneGetter.current?.() ?? null, name, saveKey: `ambient:${ambientId}` })
  const sceneGetter = useRef<SceneGetter | null>(null)
  const onSceneAccess = useCallback((g: SceneGetter) => {
    sceneGetter.current = g
  }, [])
  const camera = useCameraHistory(ambientId, initial.camera)
  useAmbientAssistant({ ambientId, name, settings, amb, sel, ambRef, setAmb, commit: history.commit })
  // Dreceres de desfer/refer, les mateixes que a l'editor (`undoKeyAction`: no amb un diàleg modal obert).
  useUndoKeys(undo, redo)

  const geos = useItemGeometries(amb.items, projects)
  const names = useMemo(() => new Map(amb.items.map((it) => [it.id, itemName(it, projects)])), [amb.items, projects])
  const summary = ambientSummary(amb, (it) => kindOf(it, projects))
  const groups = [...new Set([...amb.items.map((i) => i.group), ...amb.walls.map((w) => w.group)].filter((g): g is string => !!g))]
  const actions = useAmbientActions({ amb, change, sel, setSel: selection.setSel, selIds, selWallIds, geos, setTool })
  const { addMoble } = actions
  useAmbientShortcuts({ amb, change, selection, actions, setTool })

  /** Crea un moble o objecte (plantilla o en blanc) a la llista i el col·loca a l'ambient. */
  const createAndAdd = (c: Composition, n: string, what: "moble" | "object") =>
    void (async () => {
      const existing = (await db.projects.toArray()).map((p) => p.name)
      const id = await createProject(uniqueName(n, existing), undefined, { composition: c })
      const p = await db.projects.get(id)
      if (p) addMoble(p)
      if (what === "moble") setPicker(false)
      else setObjPicker(false)
      toaster.create({ title: `«${p?.name ?? n}» afegit`, description: what === "moble" ? "S'ha creat a Mobles i s'ha col·locat a l'ambient." : "S'ha creat a Objectes i s'ha col·locat a l'ambient.", type: "success" })
    })()

  const importPlan = async () => {
    const img = await pickPlanImage()
    if (!img) return
    const mmPerPx = 10
    change({ ...amb, plan: { src: img.src, pxW: img.w, pxH: img.h, mmPerPx, x: 0, y: 0, opacity: 0.6, locked: true } }, true)
    setFit((n) => n + 1)
    setTab("plan")
    setTool("calibrate")
    toaster.create({ title: "Plànol importat", description: "Ara marca dos punts d'una mida coneguda (una paret, una porta) per posar-lo a escala.", type: "info", duration: 8000 })
  }

  const applyCalibration = (real: number) => {
    if (!calib || !amb.plan) return
    const cur = Math.hypot(calib.b[0] - calib.a[0], calib.b[1] - calib.a[1])
    if (cur < 1 || !(real > 0)) return
    const p = amb.plan
    const k = real / cur
    const mmPerPx = p.mmPerPx * k
    // El primer punt es queda on era.
    const ax = (calib.a[0] - p.x) / p.mmPerPx, ay = (calib.a[1] - p.y) / p.mmPerPx
    change({ ...amb, plan: { ...p, mmPerPx, x: Math.round(calib.a[0] - ax * mmPerPx), y: Math.round(calib.a[1] - ay * mmPerPx) } }, true)
    setCalib(null)
    setTool("select")
    setFit((n) => n + 1)
  }

  const simMaterials = settings.materials
  const toolDone = useCallback(() => setTool("select"), [])

  return (
    <Flex direction="column" flex={1} minH={0} gap={2}>
      {/* Desfer/refer a la barra superior (la mateixa que la dels mobles: «Ambients › nom»). */}
      <TopBarActions>
        <UndoRedo {...history} />
      </TopBarActions>

      <Workspace
        ws={ws}
        left={
          <AmbientTree
            ambientId={ambientId}
            name={name}
            amb={amb}
            change={change}
            selection={selection}
            geos={geos}
            names={names}
            projects={projects}
            groups={groups}
            totalWallLength={summary.wallLength}
            setTool={setTool}
            onSelectAmbient={() => (select(null), ws.setMobilePane("props"), setTool("select"))}
            onAddMoble={() => setPicker(true)}
            onAddObject={() => setObjPicker(true)}
            onOpenProject={onOpenProject}
          />
        }
        right={
          // Una selecció nova, un inspector nou: les finestres de tria que s'hi havien obert es tanquen (com a l'editor de mobles).
          <SelectionInspector
            key={JSON.stringify(selection.sel)}
            name={name}
            amb={amb}
            change={change}
            selection={selection}
            actions={actions}
            geos={geos}
            names={names}
            projects={projects}
            materials={simMaterials}
            groups={groups}
            summary={summary}
            wallDefaults={wallDefaults}
            onWallDefaults={setWallDefaults}
            onResize={resizeLinked}
            onOpenProject={onOpenProject}
            onImportPlan={() => void importPlan()}
            onCalibrate={() => (setTab("plan"), setTool("calibrate"))}
          />
        }
        // Sense pestanya «Assistent» (per decisió de l'usuari, 2026-10-13): l'assistent personal és al menú principal
        // i fa servir aquest ambient pel `assistantHub`.
        center={(chrome) => (
          // Centre: plànol o 3D, amb la barra d'eines flotant (com Figma) i els botons de plegar.
          <Box order={{ base: 0, md: 2 }} flex={{ md: 1 }} minW={0} minH={{ base: "56vh", md: 0 }} h={{ base: "56vh", md: "full" }} position="relative">
          {tab === "plan" ? (
            <PlanCanvas
              ambient={shownAmb}
              geos={geos}
              names={names}
              selection={sel}
              selectedIds={selIds}
              onPickItem={pickItem}
              onPickWall={pickWall}
              selectedWallIds={selWallIds}
              onSelect={select}
              tool={tool}
              onToolDone={toolDone}
              onChange={changeShown}
              wallDefaults={wallDefaults}
              onCalibrate={(a, b) => setCalib({ a, b })}
              fitSignal={fit}
              show={{ grid: flags.showGrid, dims: flags.showDims, labels: flags.showLabels, detail: flags.showDetail, snap: flags.snapOn, plan: flags.showPlan }}
              onFramedChange={setPlanFramed}
            />
          ) : (
            // Fons del 3D (el visor és transparent): el mateix gris que el plànol.
            <Box position="absolute" inset={0} rounded="md" overflow="hidden" borderWidth="1px" bg="bg.subtle">
              <Ambient3D ambient={shownAmb} geos={geos} materials={settings.materials} onSceneAccess={onSceneAccess} fitSignal={fit} eyeSignal={eye} selectedIds={selIds} onSelect={(id) => (id ? void pickItem(id) : select(null))} onPick={pickItem} onChange={changeShown} snap={flags.snapOn} dollhouse={flags.dollhouse} shadows={flags.shadows} ceiling={flags.ceiling} roof={flags.roofOn} onPoseChange={setPose} initialCamera={camera.cameraRef.current} onCameraChange={camera.saveCamera} cameraLocked={camera.camLocked} cameraGoto={camera.camGoto} />
            </Box>
          )}
            {chrome}
          <ViewerTabs tab={tab} onTab={setTab} />
          {tab === "plan" && <DrawTools tool={tool} onTool={setTool} />}
          {tab === "3d" && <CameraButtons locked={camera.camLocked} onToggleLock={() => camera.setCamLocked((v) => !v)} canGoBack={!!camera.camBack} onBack={camera.cameraBack} />}
          <AmbientViewOptions
            tab={tab}
            flags={flags}
            planFramed={planFramed}
            pose={pose}
            hasPlan={!!amb.plan}
            hasRoof={!!amb.roof}
            onFit={() => setFit((n) => n + 1)}
            onEye={() => setEye((n) => n + 1)}
            onTab={setTab}
            onRender={startRender}
          />
          {tab === "plan" && tool !== "select" && <ToolHint tool={tool} />}
          </Box>
        )}
      />

      {/* Afegir un moble o un objecte: la mateixa galeria de la pàgina (Historial · Projectes · Catàleg) en una finestra. */}
      <AmbientPicker what="moble" open={picker} onClose={() => setPicker(false)} ambientId={ambientId} ambientName={name} projects={projects} onAdd={(p) => (addMoble(p), setPicker(false))} onCreate={(c, n) => createAndAdd(c, n, "moble")} />
      <AmbientPicker what="object" open={objPicker} onClose={() => setObjPicker(false)} ambientId={ambientId} ambientName={name} projects={projects} onAdd={(p) => (addMoble(p), setObjPicker(false))} onCreate={(c, n) => createAndAdd(c, n, "object")} />

      <CalibrateDialog open={calib !== null} measured={calib ? Math.hypot(calib.b[0] - calib.a[0], calib.b[1] - calib.a[1]) : 0} onClose={() => (setCalib(null), setTool("select"))} onApply={applyCalibration} />
    </Flex>
  )
}
