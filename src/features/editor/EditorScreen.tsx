import { Alert, Badge, Box, Button, Editable, HStack, IconButton, SegmentGroup, SimpleGrid, Stack, Switch, Text } from "@chakra-ui/react"
import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  LuArrowDownToLine,
  LuBox,
  LuBrickWall,
  LuFrame,
  LuMove,
  LuChevronLeft,
  LuChevronRight,
  LuLampFloor,
  LuPalette,
  LuPuzzle,
  LuAperture,
  LuArrowUp,
  LuWrench,
  LuGroup,
  LuPanelTop,
  LuCamera,
  LuCircleDot,
  LuDoorOpen,
  LuExpand,
  LuBolt,
  LuLayoutPanelLeft,
  LuMaximize2,
  LuMinimize2,
  LuMoveDiagonal,
  LuScan,
  LuShrink,
  LuSparkles,
  LuSprout,
  LuShapes,
  LuTrees,
  LuVideo,
  LuTriangleAlert,
  LuView,
} from "react-icons/lu"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { useSessionList } from "../../components/sessionState"
import { Workspace } from "../../components/Workspace"
import { ViewOptions, ViewTile } from "../../components/ViewOptions"
import { useWorkspace } from "../../components/useWorkspace"
import { TopBarActions } from "../../components/TopBar"
import { toaster } from "../../components/ui/toaster"
import { CabinetViewer, type ViewerModule } from "../../components/viewer/CabinetViewer"
import type { ViewName } from "../../components/viewer/viewNames"
import { ArDialog } from "../../components/viewer/ArDialog"
import { RenderDialog, type SceneGetter } from "../../components/viewer/render/RenderDialog"
import { useRenderQuality } from "../../components/viewer/renderQuality"
import { movingGroups, openingCollisions } from "../../components/viewer/opening"
import { legPoints } from "../../core/build/columnWalls"
import { moduleWorldX, panelBox, type CompositionWarning } from "../../core/build/buildComposition"
import { activeIslands } from "../../core/build/islands"
import { materialIssues } from "../../core/build/materialIssues"
import { splitChildSizes } from "../../core/build/layout"
import { applySettingsToModule, moduleHasInnerPieces, system32RowPlace, moduleSlotItem, hasDrawers, coveringZone, moduleRows, deleteZone, duplicateZone, parseClip, removeModule, type EditClip, findZone, insertModuleCopy, moveAllBy, moveModuleBy, setModuleMount, insertRefCopy, anchorRef, mountOf, compositionKind, partsOnlyKind, partJoinery, tableModule, emptyModule, parentOf, pasteZone, rowOf, walkZones, insertPartCopy, insertModelCopy, moveGroupBy, removeGroup, renameGroup, moveMultiBy, removeMulti, toggleMulti, groupMulti, ungroupMulti, newGroupName, freeX, resolveParts, partOffset, partCutters, CompositionSchema, isEmptyComposition, zoneBounds, carcassBounds, visibleModule, viewerSize, type CameraPose, type MultiItem, type Composition, type HardwareItem, type Module, type Panel } from "../../core/model"
import { readComposition, saveProjectCamera, updateProjectComposition, type CompositionRead } from "../../db/compositionStore"
import type { Project } from "../../db/db"
import { CarcassForm, InnerClearanceRow, JointForm, MaterialsForm } from "../composition/CarcassForm"
import { System32Pick } from "../composition/HardwarePick"
import { ElevationEditor } from "../composition/ElevationEditor"
import { RefActions, RefInspector } from "../composition/RefInspector"
import { ModelActions, ModelInspector } from "../composition/ModelInspector"
import { MultiInspector, PartActions, PartInspector, PartJoineryForm } from "../composition/PartInspector"
import { ORIENT_ICON } from "../composition/partOrient"
import { StructureTree, type Selection } from "../composition/StructureTree"
import { Tooltip } from "../../components/ui/tooltip"
import { ModuleDoorsSection, ZoneActions, ZonePanel } from "../composition/ZonePanel"
import { HardwarePlacements, PlacementButtons, PlacementInspector, type PlacementActions } from "../composition/HardwarePlacements"
import { duplicatePlacement, placementScope, removePlacement, scopePlacements } from "../composition/placements"
import { zoneLabel } from "../composition/zoneLabel"
import { zoneIcon } from "../composition/zoneIcons"
import { downloadBlob, slugify } from "../download"
import { NumRow } from "../../components/NumRow"
import { FormRow } from "../../components/FormRow"
import { ESTIMATED_WARNING, estimatedApplied } from "../photo/appliedState"
import { PhotoScreen } from "../photo/PhotoScreen"
import { useSettings } from "../settings/SettingsContext"
import { usePersistentFlag } from "../usePersistentFlag"
import { useCompositionBuild, useProject } from "../useProject"
import { RoleLegend } from "../../components/viewer/roleColors"
import { IconChoice } from "../../components/IconChoice"
import { ViewerControls, type ViewerState } from "./ViewerControls"
import { useHistory, useUndoKeys } from "../history/useHistory"
import { UndoRedo } from "../../components/UndoRedo"
import { useDebouncedSave } from "../useDebouncedSave"
import { MaterialSelect } from "../settings/MaterialSelect"
import { chatTarget } from "../assistant/chatTarget"
import { registerDoc } from "../assistant/assistantHub"

/** Xat de l'assistent IA (docs/xat-ia.md): a demanda, el primer cop que s'obre la pestanya «Assistent». */

const MOBLE_SUGGESTIONS = [
  "Fes-me un moble de TV de 1800 × 450 × 400 amb dos calaixos a baix i un forat obert al mig.",
  "Divideix aquest mòdul en tres columnes iguals i posa prestatges regulables a les dels costats.",
  "Canvia els fronts a lacat negre brillant.",
  "Revisa els avisos de fusteria i corregeix-los.",
]
const OBJECT_SUGGESTIONS = [
  "Fes-me una tauleta rodona de Ø 500 i 450 d'alt, sobre de marbre i peu de ferro negre.",
  "Afegeix un coixí de 450 × 450 × 120 de vellut verd sobre el seient.",
  "Agrupa les potes i baixa-les 20 mm.",
]

type ViewTab = "3d" | "elevation" | "photo"
const TAB_KEY = "mobles:editor-view-tab"
function readTab(): ViewTab {
  try {
    const v = localStorage.getItem(TAB_KEY)
    return v === "elevation" || v === "photo" ? v : "3d"
  } catch {
    return "3d"
  }
}

type ViewMode = "pieces" | "texture" | "presentation"
/** Llista buida estable (mentre no hi ha moble construït). */
const NO_PANELS: Panel[] = []
const NO_WARNINGS: CompositionWarning[] = []

/** Mida (mm) de l'escena d'un document buit: el que ocuparia un moble mitjà, per enquadrar la càmera i el terra. */
const EMPTY_STAGE = { width: 1200, height: 900, depth: 600 }

const VIEW_MODES: [ViewMode, string, string, typeof LuShapes][] = [
  ["pieces", "Per peça", "cada tipus de peça d'un color, ràpid i amb guies", LuShapes],
  ["texture", "Textura", "materials i veta, ràpid i amb guies", LuTrees],
  ["presentation", "Presentació", "ombres, terra i paret, sense guies", LuSparkles],
]

export function EditorScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  // Els àlies dels materials («X (foto)») depenen de les preferències: no es fa la composició fins que s'han llegit.
  const { loading } = useSettings()
  const read = useMemo(() => (project && !loading ? readComposition(project) : undefined), [project, loading])
  if (!project || !read) return null
  return <Editor key={project.id} projectId={project.id} name={project.name} initial={read.composition} read={read} project={project} />
}

/** Porta-retalls de l'editor (mòdul, objecte, compartiment, peça o model 3D). */
type Clip = EditClip
const CLIP_KEY = "mobles:clipboard"
let memClip: Clip | null = null
function writeClip(c: Clip) {
  memClip = structuredClone(c)
  try {
    localStorage.setItem(CLIP_KEY, JSON.stringify(c))
  } catch {
    /* només en memòria */
  }
}
function readClip(): Clip | null {
  try {
    // Pot venir d'una altra versió de l'app o estar malmès: es valida amb els esquemes (`parseClip`).
    const raw = localStorage.getItem(CLIP_KEY)
    if (raw) return parseClip(JSON.parse(raw))
  } catch {
    /* només en memòria */
  }
  return memClip
}


function Editor({ projectId, name, initial, read: readNow, project }: { projectId: number; name: string; initial: Composition; read: CompositionRead; project: Project }) {
  // La secció oberta de l'inspector (una sola alhora).
  const [inspectorOpen, setInspectorOpen] = useSessionList("mobles:inspector-open")
  // La lectura en obrir-lo (la de després de cada desada ja no cal: és la que hem desat).
  const [read] = useState(readNow)
  // Composició amb desfer/refer (`useHistory`, fins a 50 passos). Canvis seguits (menys de 500 ms entre ells, p. ex.
  // escriure "1180" o arrossegar) compten com un sol pas. La càmera del 3D també és un pas (per decisió de l'usuari,
  // 2026-10-14: ⌘Z la torna on era), però es desa a part (sense «Modificat»); la miniatura, fora del desfer.
  const history = useHistory<{ comp: Composition; cam?: CameraPose }>({ comp: initial, ...(initial.camera ? { cam: initial.camera } : {}) }, { limit: 50, coalesceMs: 500 })
  const { set: setDoc, undo, redo, commit: commitHistory } = history
  const comp = history.value.comp
  const setComp = useCallback(
    (next: Composition | ((cur: Composition) => Composition), opts?: { commit?: boolean; group?: string }) =>
      setDoc((h) => ({ ...h, comp: typeof next === "function" ? next(h.comp) : next }), opts),
    [setDoc],
  )
  // L'assistent IA llegeix la composició d'ara i hi aplica els canvis en viu; en acabar el torn, un sol pas de desfer.
  const compRef = useRef(comp)
  compRef.current = comp
  const getComp = useCallback(() => compRef.current, [])
  const applyLive = useCallback((next: Composition) => setComp(next, { commit: false }), [setComp])
  // Dreceres de desfer/refer (`undoKeyAction`): no als camps de text lliure ni amb un diàleg modal obert (l'editor de
  // perfils té el seu desfer: ⌘Z hi desfeia el moble del darrere).
  useUndoKeys(undo, redo)

  // Selecció única (arbre, 3D i alçat van sincronitzats): moble, mòdul, compartiment o objecte.
  const [selectedModule, setSelectedModule] = useState<string>(initial.modules[0]?.id ?? "")
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [selKind, setSelKind] = useState<"moble" | "module" | "zone" | "ref" | "part" | "group" | "model" | "hardware" | "multi">(partsOnlyKind(compositionKind(initial)) || !initial.modules.length ? "moble" : "module")
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedHardware, setSelectedHardware] = useState<string | null>(null)
  // Selecció múltiple (Maj + clic a l'arbre o al 3D; per decisió de l'usuari, 2026-10-14).
  const [selectedMulti, setSelectedMulti] = useState<MultiItem[]>([])
  // Espai de treball compartit (Workspace): panells, amplades i pestanya del mòbil.
  const ws = useWorkspace("editor", { tree: 280, form: 340 })
  const { setMobilePane } = ws
  const [exploded, setExploded] = useState(false)
  // Tornar a enquadrar la càmera (editar ja no la mou).
  const [fitKey, setFitKey] = useState(0)
  // Última càmera del 3D: es desa a part (sense «Modificat» ni desfer) i el visor hi torna en obrir-se.
  const cameraRef = useRef(initial.camera)
  const saveCamera = useCallback(
    (c: CameraPose) => {
      cameraRef.current = c
      void saveProjectCamera(projectId, c)
      // Un pas de desfer (sense ajuntar-lo amb un canvi del moble).
      setDoc((h) => ({ ...h, cam: c }), { group: `cam-${Date.now()}` })
    },
    [projectId, setDoc],
  )
  // Desfer/refer que torna una càmera d'abans: el visor hi va i es desa.
  const [cameraGoto, setCameraGoto] = useState<{ pose: CameraPose; n: number } | null>(null)
  const histCam = history.value.cam
  useEffect(() => {
    if (!histCam || histCam === cameraRef.current) return
    cameraRef.current = histCam
    void saveProjectCamera(projectId, histCam)
    setCameraGoto((g) => ({ pose: histCam, n: (g?.n ?? 0) + 1 }))
  }, [histCam, projectId])
  // El botó d'enquadrar surt marcat mentre la càmera és a l'enquadrament.
  const [framed, setFramed] = useState(true)
  const [showHoles, setShowHoles] = useState(false)
  // «Veure a casa»: visor 3D amb el botó d'AR Quick Look (Safari a l'iPhone/iPad).
  const [arOpen, setArOpen] = useState(false)
  // Visor: vista, obertura de portes i calaixos, colors.
  // En mode Ràpida, per defecte colors per tipus de peça (més clar per treballar);
  // en mode Presentació sempre els materials reals.
  // Els objectes (sofàs, plantes…) només es veuen, no es fabriquen: s'obren amb la textura, no amb
  // els colors per peça (tenen la seva pròpia preferència).
  const [roleColors, setRoleColors] = usePersistentFlag(compositionKind(initial) === "objecte" ? "mobles:viewer-role-colors-object" : "mobles:viewer-role-colors-fast", compositionKind(initial) !== "objecte")
  const [quality, setQuality] = useRenderQuality()
  const [viewer, setViewerState] = useState<Omit<ViewerState, "materialMode">>({ opening: 0, opacity: 1, openOnlySelected: false })
  // Costat des d'on enquadra la càmera (null = el 3/4 d'«Enquadrar»). Triar una vista compta com «Enquadrar»: la càmera
  // hi va (perspectiva, es pot girar després) i es desa com qualsevol altra.
  const [viewDir, setViewDir] = useState<ViewName | null>(null)
  const frameFrom = (dir: ViewName | null) => {
    setViewDir(dir)
    setFitKey((k) => k + 1)
  }
  const viewerState: ViewerState = { ...viewer, materialMode: quality === "fast" && roleColors ? "role" : "material" }
  // Mode del visor: Per peça (ràpid, colors per tipus), Textura (ràpid, materials) o Presentació.
  const viewMode: ViewMode = quality === "presentation" ? "presentation" : roleColors ? "pieces" : "texture"
  const setViewMode = (m: ViewMode) => {
    setQuality(m === "presentation" ? "presentation" : "fast")
    if (m !== "presentation") setRoleColors(m === "pieces")
  }
  // Ferratges visuals (frontisses, tiradors, potes) i mostres del ray tracing.
  const [hardware, setHardware] = usePersistentFlag("mobles:viewer-hardware", true)
  const setViewer = (patch: Partial<ViewerState>) => {
    const { materialMode, ...rest } = patch
    if (materialMode) setRoleColors(materialMode === "role")
    if (Object.keys(rest).length) setViewerState((v) => ({ ...v, ...rest }))
  }
  const capture = useRef<(() => Promise<Blob>) | null>(null)
  // Render (GPU o CPU): accés a l'escena del visor.
  const sceneGetter = useRef<SceneGetter | null>(null)
  const registerScene = useCallback((g: SceneGetter) => {
    sceneGetter.current = g
  }, [])
  const [renderOpen, setRenderOpen] = useState(false)
  // «Opcions de vista» obert: es tanca en obrir el Render (si no, el popover o el calaix quedaven a sobre).
  const [viewOptsOpen, setViewOptsOpen] = useState(false)
  const registerCapture = useCallback((fn: () => Promise<Blob>) => {
    capture.current = fn
  }, [])
  // Amaga el panell de paràmetres perquè el 3D ocupi tot l'espai.
  const [formHidden, setFormHidden] = usePersistentFlag("mobles:editor-form-hidden")
  // A l'ordinador, cada panell lateral es plega pel seu compte (com les barres laterals
  // d'una app d'escriptori): l'arbre a l'esquerra i les propietats a la dreta.

  // Amplades dels panells laterals: s'arrosseguen per la vora (com el separador de l'app de
  // Claude) i es recorden. Si la finestra és estreta, els panells s'encongeixen fins al seu
  // mínim abans que el visor es faci més petit que el seu mínim.
  // Visor estret (finestra petita o panells amples): les pestanyes queden només amb icona
  // perquè no les tapin els botons de la dreta.
  const viewerBox = useRef<HTMLDivElement>(null)
  const [viewerNarrow, setViewerNarrow] = useState(false)
  useEffect(() => {
    const el = viewerBox.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setViewerNarrow((e?.contentRect.width ?? 999) < 640))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Pestanya del visor: 3D, alçat (compartiments) o sobre la foto del lloc.
  const [viewTab, setViewTabState] = useState<ViewTab>(readTab)
  const setViewTab = (t: ViewTab) => {
    setViewTabState(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* sense localStorage */
    }
  }
  const photoTab = viewTab === "photo"
  // Contenidor de l'inspector on la pestanya Foto hi pinta els seus controls.
  const [photoControls, setPhotoControls] = useState<HTMLDivElement | null>(null)
  const { settings } = useSettings()

  const build = useCompositionBuild(comp)
  const panels = build?.panels ?? NO_PANELS
  const panelsRef = useRef(panels)
  panelsRef.current = panels

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kind = compositionKind(comp)
  // Assistent IA: les eines del moble o de l'objecte (docs/xat-ia.md); un torn = un pas de desfer.
  const assistantTarget = useMemo(() => {
    const live = { getDoc: getComp, apply: applyLive, commit: commitHistory }
    if (kind === "objecte")
      return chatTarget({ ...live, toolset: () => import("../../core/assistant/objectTools").then((m) => m.objectToolSet({ settings })), intro: "Demana-li que faci o canviï l'objecte obert (mides en mm; és decoratiu, no es fabrica). Pots adjuntar-ne una foto: les mides que en tregui són estimades.", suggestions: OBJECT_SUGGESTIONS })
    if (partsOnlyKind(kind)) return undefined
    return chatTarget({ ...live, toolset: () => import("../../core/assistant/tools").then((m) => m.mobleToolSet({ settings })), intro: "Demana-li que faci o canviï el moble obert (mides en mm). Pots adjuntar una foto o un plànol: les mides que en tregui són estimades.", suggestions: MOBLE_SUGGESTIONS })
  }, [kind, settings, getComp, applyLive, commitHistory])
  // El mòdul de treball (alçat, inspector, veïns): el seleccionat o el primer. Un moble nou no en té cap (0 mòduls).
  const module: Module | undefined = comp.modules.find((m) => m.id === selectedModule) ?? comp.modules[0]
  const moduleIndex = module ? comp.modules.indexOf(module) : -1
  // Posició dins de la seva fila (a terra o penjats) i el mòdul anterior de la fila.
  const rowMates = module ? comp.modules.filter((m) => rowOf(m) === rowOf(module) && !freeX(m)) : []
  const rowIndex = module ? rowMates.indexOf(module) : -1
  const rowPrev = rowIndex > 0 ? rowMates[rowIndex - 1] : undefined
  const moduleBuild = build?.modules[moduleIndex]?.build
  // El mòdul triat és el de darrere d'una illa (es col·loca sol): la Posició ho diu i no en mostra els camps.
  const islandBack = module ? activeIslands(comp).find((i) => i.back === module.id) : undefined
  const zone = selectedZone && module ? findZone(module.root, selectedZone) : undefined

  const size = useMemo(() => viewerSize(comp), [comp])
  // Document buit (un moble o un objecte nou): res a enquadrar; el visor mostra el terra d'una escena de mida normal i
  // s'hi pot orbitar. En afegir-hi el primer element, el visor no es mou (editar no mou la càmera).
  const empty = isEmptyComposition(comp)
  const frameSize = empty ? EMPTY_STAGE : size

  const viewerModules: ViewerModule[] = useMemo(
    () =>
      (build?.modules ?? []).map((m) => {
        const c = comp.modules[m.index - 1]!.carcass
        const mod = comp.modules[m.index - 1]!
        return { id: m.id, index: m.index, x: m.x, y: m.y, z: m.z, width: c.width, height: c.height, depth: c.depth + c.thickness, wall: c.base.kind === "wall", free: mountOf(mod) === "floor", ...(c.base.kind === "legs" ? { legs: legsView(c.base, c.depth, m.build.panels, build?.panels.find((p) => p.id === `${m.id}:bottom`)) } : {}) }
      }),
    [build, comp],
  )

  const updateModule = (m: Module) => setComp((c) => ({ ...c, modules: c.modules.map((x) => (x.id === m.id ? m : x)) }))

  // Els triats que encara hi són (desfer o eliminar en pot treure).
  const multiNow = selKind === "multi" ? selectedMulti.filter((x) => (x.kind === "part" ? comp.parts?.some((p) => p.id === x.id) : x.kind === "model" ? comp.models?.some((m) => m.id === x.id) : x.kind === "module" ? comp.modules.some((m) => m.id === x.id) : comp.references.some((r) => r.id === x.id))) : []
  const selectionNow: Selection =
    selKind === "moble"
      ? { kind: "moble" }
      : selKind === "multi" && multiNow.length > 1
        ? { kind: "multi", items: multiNow }
      : selKind === "multi" && multiNow.length === 1
        ? { kind: multiNow[0]!.kind, id: multiNow[0]!.id }
      : selKind === "ref" && selectedRef && comp.references.some((r) => r.id === selectedRef)
        ? { kind: "ref", id: selectedRef }
        : selKind === "part" && selectedPart && comp.parts?.some((r) => r.id === selectedPart)
          ? { kind: "part", id: selectedPart }
          : selKind === "group" && selectedGroup && [...(comp.parts ?? []), ...(comp.models ?? [])].some((r) => r.group === selectedGroup)
            ? { kind: "group", id: selectedGroup }
          : selKind === "model" && selectedModel && comp.models?.some((g) => g.id === selectedModel)
            ? { kind: "model", id: selectedModel }
          : selKind === "hardware" && selectedHardware && comp.hardwarePlacements?.some((h) => h.id === selectedHardware)
            ? { kind: "hardware", id: selectedHardware }
          : partsOnlyKind(kind) || !module || selKind === "ref" || selKind === "part" || selKind === "group" || selKind === "model" || selKind === "multi"
            ? { kind: "moble" }
            : selectedZone && zone
          ? { kind: "zone", moduleId: module.id, zoneId: selectedZone }
          : { kind: "module", id: module.id }
  // La mateixa selecció ha de ser el mateix objecte d'un render a l'altre: si no, tots els càlculs
  // que en depenen (useMemo) es refarien a cada render.
  const selectionKey = JSON.stringify(selectionNow)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selection = useMemo(() => selectionNow, [selectionKey])
  // Assistent personal (`assistantHub.ts`): aquest document s'hi registra amb les seves eines i què hi ha seleccionat
  // (amb els ids que fan servir les eines). La selecció es llegeix en el moment (ref), no en registrar-se.
  const describeSelection = useRef<() => string | undefined>(() => undefined)
  describeSelection.current = () => {
    const name = (id: string) => comp.modules.find((m) => m.id === id)?.name ?? id
    switch (selection.kind) {
      case "module":
        return `mòdul «${name(selection.id)}» (module: ${selection.id})`
      case "zone": {
        const m = comp.modules.find((x) => x.id === selection.moduleId)
        const z = m ? findZone(m.root, selection.zoneId) : undefined
        return `compartiment «${z ? zoneLabel(z, { root: z.id === m?.root.id }) : selection.zoneId}» (zone: ${selection.zoneId}) del mòdul «${name(selection.moduleId)}» (module: ${selection.moduleId})`
      }
      case "ref":
        return `objecte de referència «${comp.references.find((r) => r.id === selection.id)?.name ?? selection.id}» (id ${selection.id})`
      case "part":
        return `peça lliure «${comp.parts?.find((p) => p.id === selection.id)?.name ?? selection.id}» (part_id ${selection.id})`
      case "group":
        return `grup de peces «${selection.id}»`
      case "model":
        return `model 3D (id ${selection.id})`
      case "hardware":
        return `ferratge col·locat (id ${selection.id})`
      case "multi":
        return `${selection.items.length} elements: ${selection.items.map((x) => `${x.kind} ${x.id}`).join(", ")}`
      default:
        return undefined
    }
  }
  useEffect(() => {
    if (!assistantTarget) return
    const docKind = kind === "objecte" ? "objecte" : "moble"
    return registerDoc({ key: `${docKind}:${projectId}`, kind: docKind, id: projectId, name, target: assistantTarget, selection: () => describeSelection.current() })
  }, [assistantTarget, kind, projectId, name])
  const select = (s: Selection, fromPanel = false) => {
    // Un element triat sol és l'inici d'un tram (Maj + clic a l'arbre).
    if (s.kind === "part" || s.kind === "model" || s.kind === "ref" || s.kind === "module") rangeAnchor.current = { kind: s.kind, id: s.id }
    if (s.kind === "moble") setSelKind("moble")
    else if (s.kind === "ref") {
      setSelectedRef(s.id)
      setSelKind("ref")
    } else if (s.kind === "part") {
      setSelectedPart(s.id)
      setSelKind("part")
    } else if (s.kind === "group") {
      setSelectedGroup(s.id)
      setSelKind("group")
    } else if (s.kind === "model") {
      setSelectedModel(s.id)
      setSelKind("model")
    } else if (s.kind === "hardware") {
      // El mòdul del ferratge passa a ser el de treball (alçat, veïns); si el ferratge desapareix (desfer), s'hi torna.
      const main = comp.hardwarePlacements?.find((h) => h.id === s.id)?.targets[0]
      if (main?.module) {
        setSelectedModule(main.module)
        setSelectedZone(null)
      }
      setSelectedHardware(s.id)
      setSelKind("hardware")
    } else if (s.kind === "module") {
      setSelectedModule(s.id)
      setSelectedZone(null)
      setSelKind("module")
    } else if (s.kind === "multi") {
      setSelectedMulti(s.items)
      setSelKind("multi")
    } else {
      setSelectedModule(s.moduleId)
      setSelectedZone(s.zoneId)
      setSelKind("zone")
    }
    // Al mòbil, triar a l'arbre porta a les propietats.
    if (fromPanel) setMobilePane("props")
  }
  const selectModule = (id: string) => select({ kind: "module", id })
  // Maj + clic (a l'arbre o al 3D): afegeix o treu la peça, el model o l'objecte de la selecció, com Figma. Es llegeix la
  // tecla del clic (`pointerdown`), no de cap estat desat.
  // Maj (o ⌘/Ctrl) + clic: la tecla del clic (`pointerdown`), no cap estat desat. `shiftRef` = afegir o treure (al 3D,
  // Maj o ⌘/Ctrl); `rangeRef` = Maj, que a l'arbre tria el tram del primer al darrer (com el Finder).
  const shiftRef = useRef(false)
  const rangeRef = useRef(false)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      shiftRef.current = e.shiftKey || e.metaKey || e.ctrlKey
      rangeRef.current = e.shiftKey && !e.metaKey && !e.ctrlKey
    }
    window.addEventListener("pointerdown", down, true)
    return () => window.removeEventListener("pointerdown", down, true)
  }, [])
  // L'últim triat sol o afegit: l'inici del tram.
  const rangeAnchor = useRef<MultiItem | null>(null)
  // L'ordre de l'arbre de cada tipus (els grups, on surt el primer dels seus).
  const treeOrder = (kind: MultiItem["kind"]): string[] => {
    const grouped = <T extends { id: string; group?: string }>(list: T[]) => {
      const out: string[] = []
      const seen = new Set<string>()
      for (const x of list) {
        if (!x.group) out.push(x.id)
        else if (!seen.has(x.group)) {
          seen.add(x.group)
          out.push(...list.filter((y) => y.group === x.group).map((y) => y.id))
        }
      }
      return out
    }
    if (kind === "module") return [...comp.modules.filter((m) => rowOf(m) === "floor"), ...comp.modules.filter((m) => rowOf(m) === "wall")].map((m) => m.id)
    if (kind === "part") return grouped(comp.parts ?? [])
    if (kind === "model") return grouped(comp.models ?? [])
    return comp.references.map((r) => r.id)
  }
  const pick = (s: Selection, fromPanel = false) => {
    const kind = s.kind === "part" || s.kind === "model" || s.kind === "ref" || s.kind === "module" ? s.kind : null
    if (!kind || !("id" in s)) return select(s, fromPanel)
    const item: MultiItem = { kind, id: s.id }
    const set = (next: MultiItem[]) => select(next.length > 1 ? { kind: "multi", items: next } : next.length === 1 ? { kind: next[0]!.kind, id: next[0]!.id } : { kind: "moble" }, fromPanel)
    // Maj + clic a l'arbre: del primer (l'últim triat) a aquest, si són del mateix tipus.
    const anchor = rangeAnchor.current
    // Un que ja és a la selecció múltiple: Maj + clic el treu (només aquest), també a l'arbre.
    const inSel = selection.kind === "multi" && selection.items.some((x) => x.kind === kind && x.id === s.id)
    if (fromPanel && rangeRef.current && anchor && anchor.kind === kind && !inSel) {
      const order = treeOrder(kind)
      const i = order.indexOf(anchor.id), j = order.indexOf(s.id)
      if (i >= 0 && j >= 0) return set(order.slice(Math.min(i, j), Math.max(i, j) + 1).map((id) => ({ kind, id })))
    }
    rangeAnchor.current = item
    if (!shiftRef.current) return select(s, fromPanel)
    const cur: MultiItem[] = selection.kind === "multi" ? selection.items : selection.kind === "part" || selection.kind === "model" || selection.kind === "ref" || selection.kind === "module" ? [{ kind: selection.kind, id: selection.id }] : []
    set(toggleMulti(cur, item))
  }
  // Esc: treure la selecció (queda el moble sencer), si no s'està escrivint en un camp.
  const deselectRef = useRef(() => select({ kind: "moble" }))
  deselectRef.current = () => select({ kind: "moble" })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
      // Si hi ha un menú o un diàleg obert, Esc el tanca a ell.
      if (document.querySelector('[data-part="content"][data-state="open"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return
      deselectRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const selectZone = (id: string) => module && select({ kind: "zone", moduleId: module.id, zoneId: id })
  // Ferratges col·locats a mà (llista de l'inspector, barra flotant del 3D i teclat): un sol camí, un pas de desfer.
  const duplicateHardware = (id: string) => {
    const r = duplicatePlacement(comp, id)
    if (!r) return
    setComp(r.comp)
    select({ kind: "hardware", id: r.id })
  }
  const editHardware = (id: string) => {
    setInspectorOpen(["hw-place"])
    ws.setPropsHidden(false)
    select({ kind: "hardware", id }, true)
  }
  const hardwareActions: PlacementActions = {
    onSelect: (id) => select({ kind: "hardware", id }),
    onEdit: editHardware,
    onDuplicate: duplicateHardware,
    onRemove: (id) => removeHardware(id),
  }
  const removeHardware = (id: string) => {
    const pl = comp.hardwarePlacements?.find((h) => h.id === id)
    setComp(removePlacement(comp, id))
    const scope = pl && placementScope(pl)
    if (selection.kind === "hardware" && selection.id === id)
      select(scope?.kind === "module" ? { kind: "module", id: scope.moduleId } : scope?.kind === "part" ? { kind: "part", id: scope.partId } : { kind: "moble" })
  }

  /** Mou un grup de peces lliures (desplaçament en mm). */
  const moveGroup = (group: string, dx: number, dy: number, dz: number) => setComp((c) => moveGroupBy(c, group, dx, dy, dz))
  /**
   * Clic a una peça lliure al 3D (com Figma): si és d'un grup i no hi ha res del grup
   * seleccionat, selecciona el grup; si el grup (o una peça seva) ja ho està, la peça.
   */
  const selectPartFrom3D = (id: string) => {
    // Maj + clic: la peça sola, a la selecció múltiple.
    if (shiftRef.current) return pick({ kind: "part", id })
    const g = comp.parts?.find((p) => p.id === id)?.group
    const inside = g && ((selection.kind === "group" && selection.id === g) || (selection.kind === "part" && comp.parts?.find((p) => p.id === selection.id)?.group === g))
    select(g && !inside ? { kind: "group", id: g } : { kind: "part", id })
  }
  /** Mou una peça lliure (arrossegada al 3D o amb les fletxes). */
  // `pos` en coordenades de la composició: si és enganxada a un mòdul, es passa a relativa.
  const movePart = (id: string, pos: { x: number; y: number; z: number }) =>
    setComp((c) =>
      ({
        ...c,
        parts: (c.parts ?? []).map((r) => {
          if (r.id !== id) return r
          const o = partOffset(c, r)
          return { ...r, x: pos.x - o[0], y: Math.max(0, pos.y) - o[1], z: pos.z - o[2] }
        }),
      }),
    )
  const absParts = useMemo(() => resolveParts(comp), [comp])
  // Les peces que tallen es veuen com els objectes que tallen (fantasma violeta, amb el gizmo).
  const solidParts = useMemo(() => absParts.filter((p) => p.effect !== "cut" && !p.hidden), [absParts])
  const cutPartIds = useMemo(() => new Set(absParts.filter((p) => p.effect === "cut").map((p) => p.id)), [absParts])
  const ghosts = useMemo(() => {
    const hiddenParts = new Set((comp.parts ?? []).filter((q) => q.hidden).map((q) => `part:${q.id}`))
    return [...comp.references, ...(cutPartIds.size ? partCutters(comp) : [])].filter((g) => !g.hidden && !hiddenParts.has(g.id))
  }, [comp, cutPartIds])
  // El cadenat de l'arbre: el triat no es mou (ni el gizmo, ni la nansa, ni les fletxes).
  const selectionLocked =
    selection.kind === "module" ? !!comp.modules.find((m) => m.id === selection.id)?.locked
    : selection.kind === "ref" ? !!comp.references.find((r) => r.id === selection.id)?.locked
    : selection.kind === "part" ? !!comp.parts?.find((q) => q.id === selection.id)?.locked
    : selection.kind === "model" ? !!comp.models?.find((g) => g.id === selection.id)?.locked
    : selection.kind === "group" ? [...(comp.parts ?? []), ...(comp.models ?? [])].filter((q) => q.group === selection.id).every((q) => q.locked)
    : selection.kind === "multi" ? selection.items.some((x) => (x.kind === "part" ? comp.parts?.find((q) => q.id === x.id) : x.kind === "model" ? comp.models?.find((q) => q.id === x.id) : x.kind === "module" ? comp.modules.find((q) => q.id === x.id) : comp.references.find((q) => q.id === x.id))?.locked)
    : false
  /** Mou un model 3D (gizmo al 3D o fletxes): no s'enfonsa al terra. */
  const moveModel = (id: string, pos: { x: number; y: number; z: number }) =>
    setComp((c) => ({ ...c, models: (c.models ?? []).map((g) => (g.id === id ? { ...g, x: pos.x, y: Math.max(0, pos.y), z: pos.z } : g)) }))
  /** Mou un objecte de referència (arrossegat al 3D o amb les fletxes). */
  const moveRef = (id: string, pos: { x: number; y: number; z: number }) =>
    setComp((c) => ({ ...c, references: c.references.map((r) => (r.id === id ? anchorRef({ ...r, ...pos }) : r)) }))
  // Fletxes amb un objecte seleccionat: ←→ X, ↑↓ Y, Re Pàg / Av Pàg Z. 1 mm; amb Maj, 10 mm.
  // Copiar, enganxar, duplicar i esborrar amb el teclat (mòduls, objectes i compartiments).
  // El porta-retalls es desa a localStorage: es pot enganxar en un altre moble.
  const editKeysRef = useRef<(e: KeyboardEvent) => void>(() => {})
  editKeysRef.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
    if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    // ⌘G / Ctrl+G: els triats en un grup nou; ⇧⌘G: fora del grup (com Figma). Peces lliures i models 3D.
    if (mod && key === "g" && (selection.kind === "multi" || selection.kind === "part" || selection.kind === "model" || selection.kind === "group")) {
      e.preventDefault()
      const items: MultiItem[] = selection.kind === "multi" ? selection.items : selection.kind === "group" ? [...(comp.parts ?? []).filter((p) => p.group === selection.id).map((p) => ({ kind: "part" as const, id: p.id })), ...(comp.models ?? []).filter((m) => m.group === selection.id).map((m) => ({ kind: "model" as const, id: m.id }))] : [{ kind: selection.kind, id: selection.id }]
      if (e.shiftKey) {
        setComp(ungroupMulti(comp, items))
        if (selection.kind === "group") select(items.length > 1 ? { kind: "multi", items } : { kind: "moble" })
      } else if (selection.kind !== "group") {
        const g = newGroupName(comp)
        setComp(groupMulti(comp, items, g))
        select({ kind: "group", id: g })
      }
      return
    }
    const current = (): Clip | null => {
      if (selection.kind === "module") {
        const m = comp.modules.find((x) => x.id === selection.id)
        return m ? { kind: "module", data: m, label: m.name } : null
      }
      if (selection.kind === "ref") {
        const r = comp.references.find((x) => x.id === selection.id)
        return r ? { kind: "ref", data: r, label: r.name } : null
      }
      if (selection.kind === "part") {
        const r = comp.parts?.find((x) => x.id === selection.id)
        return r ? { kind: "part", data: r, label: r.name } : null
      }
      if (selection.kind === "model") {
        const g = comp.models?.find((x) => x.id === selection.id)
        return g ? { kind: "model", data: g, label: g.name } : null
      }
      if (selection.kind === "zone" && zone) return { kind: "zone", data: zone, label: zoneLabel(zone) }
      return null
    }
    const paste = (clip: Clip) => {
      if (clip.kind === "module") {
        if (partsOnlyKind(compositionKind(comp))) {
          toaster.create({ title: "Aquí no es poden enganxar mòduls", description: "Un flat-pack o un objecte només té peces lliures.", type: "info" })
          return
        }
        const res = insertModuleCopy(comp, clip.data, selection.kind === "module" ? selection.id : selection.kind === "zone" ? selection.moduleId : undefined)
        setComp(res.comp)
        select({ kind: "module", id: res.id })
      } else if (clip.kind === "ref") {
        if (compositionKind(comp) === "objecte") {
          toaster.create({ title: "Aquí no es poden enganxar objectes de referència", description: "Un objecte es fa amb peces lliures (per tallar, una peça amb l'efecte «Talla»).", type: "info" })
          return
        }
        const res = insertRefCopy(comp, clip.data)
        setComp(res.comp)
        select({ kind: "ref", id: res.id })
      } else if (clip.kind === "part") {
        const res = insertPartCopy(comp, clip.data)
        setComp(res.comp)
        select({ kind: "part", id: res.id })
      } else if (clip.kind === "model") {
        if (compositionKind(comp) !== "objecte") {
          toaster.create({ title: "Aquí no es poden enganxar models 3D", description: "Els models 3D van als objectes (sofàs, plantes…), no als mobles.", type: "info" })
          return
        }
        const res = insertModelCopy(comp, clip.data)
        setComp(res.comp)
        select({ kind: "model", id: res.id })
      } else {
        // Un compartiment s'enganxa dins del compartiment (o del mòdul) seleccionat.
        const target = selection.kind === "zone" ? { m: module, zoneId: selection.zoneId } : selection.kind === "module" ? { m: comp.modules.find((x) => x.id === selection.id), zoneId: undefined } : null
        if (!target?.m) {
          toaster.create({ title: "Tria on enganxar el compartiment", description: "Selecciona un compartiment o un mòdul.", type: "info" })
          return
        }
        const zid = target.zoneId ?? target.m.root.id
        updateModule({ ...target.m, root: pasteZone(target.m.root, zid, clip.data) })
        select({ kind: "zone", moduleId: target.m.id, zoneId: zid })
      }
    }
    // L'«Interior» (l'arrel del mòdul) no es retalla, no es duplica ni s'elimina (vegeu `remove`).
    const interior = selection.kind === "zone" && module && selection.zoneId === module.root.id
    if (mod && (key === "c" || key === "x")) {
      const clip = current()
      if (!clip) return
      e.preventDefault()
      // Es refusa abans de copiar: un ⌘X que no talla no ha de canviar el porta-retalls.
      if (key === "x" && interior) {
        refuseInterior("retallar")
        return
      }
      writeClip(clip)
      toaster.create({ title: `Copiat: ${clip.label}`, type: "info", duration: 1500 })
      if (key === "x") remove()
      return
    }
    if (mod && key === "v") {
      const clip = readClip()
      if (!clip) return
      e.preventDefault()
      paste(clip)
      return
    }
    if (mod && key === "d" && selection.kind === "hardware") {
      e.preventDefault()
      duplicateHardware(selection.id)
      return
    }
    if (mod && key === "d") {
      // Un compartiment es duplica al costat (o a continuació, dins de la seva divisió), com al menú de l'inspector.
      if (selection.kind === "zone" && module) {
        e.preventDefault()
        if (interior) {
          refuseInterior("duplicar")
          return
        }
        const parent = parentOf(module.root, selection.zoneId)
        const r = duplicateZone(module.root, selection.zoneId, parent?.split?.dir ?? "v")
        updateModule({ ...module, root: r.root })
        if (r.copyId) select({ kind: "zone", moduleId: module.id, zoneId: r.copyId })
        return
      }
      const clip = current()
      if (!clip) return
      e.preventDefault()
      paste(clip)
      return
    }
    if (!mod && (e.key === "Delete" || e.key === "Backspace")) {
      if (selection.kind === "moble") return
      e.preventDefault()
      remove()
    }
    function refuseInterior(what: "eliminar" | "retallar" | "duplicar") {
      const description = what === "duplicar" ? "Duplica'n un compartiment, o selecciona el mòdul per duplicar-lo." : "Treu-ne la divisió o el front, o elimina el mòdul."
      toaster.create({ title: `L'interior no es pot ${what}`, description, type: "info" })
    }
    function remove() {
      if (selection.kind === "module") {
        const i = comp.modules.findIndex((x) => x.id === selection.id)
        // Peces enganxades, taulell i sòcol i forats del taulell que en depenen (`removeModule`). Pot quedar sense cap
        // mòdul (com un moble nou): aleshores, el moble.
        const res = removeModule(comp, selection.id)
        setComp(res.comp)
        for (const n of res.notes) toaster.create({ title: n, type: "info" })
        const next = res.comp.modules[Math.max(0, i - 1)]
        select(next ? { kind: "module", id: next.id } : { kind: "moble" })
      } else if (selection.kind === "ref") {
        setComp({ ...comp, references: comp.references.filter((r) => r.id !== selection.id) })
        select({ kind: "moble" })
      } else if (selection.kind === "part") {
        setComp({ ...comp, parts: (comp.parts ?? []).filter((r) => r.id !== selection.id) })
        select({ kind: "moble" })
      } else if (selection.kind === "group") {
        setComp(removeGroup(comp, selection.id))
        select({ kind: "moble" })
      } else if (selection.kind === "model") {
        setComp({ ...comp, models: (comp.models ?? []).filter((g) => g.id !== selection.id) })
        select({ kind: "moble" })
      } else if (selection.kind === "hardware") {
        removeHardware(selection.id)
      } else if (selection.kind === "multi") {
        setComp(removeMulti(comp, selection.items))
        select({ kind: "moble" })
      } else if (selection.kind === "zone") {
        // L'«Interior» (l'arrel) no s'elimina: `deleteZone` buidaria tot el mòdul (divisions, fronts i les portes de tot el
        // mòdul). Es buida treient-ne la divisió, el front o les portes (Mòdul › Portes).
        if (interior) {
          refuseInterior("eliminar")
          return
        }
        if (!module) return
        const parent = parentOf(module.root, selection.zoneId)
        updateModule({ ...module, root: deleteZone(module.root, selection.zoneId) })
        if (parent) select({ kind: "zone", moduleId: module.id, zoneId: parent.id })
        else select({ kind: "module", id: module.id })
      }
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => editKeysRef.current(e)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const nudgeRef = useRef<(e: KeyboardEvent) => void>(() => {})
  nudgeRef.current = (e: KeyboardEvent) => {
    if ((selection.kind !== "ref" && selection.kind !== "part" && selection.kind !== "group" && selection.kind !== "model" && selection.kind !== "multi") || selectionLocked || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
    if (selection.kind === "multi") {
      const k = e.shiftKey ? 10 : 1
      const d = { ArrowLeft: [-k, 0, 0], ArrowRight: [k, 0, 0], ArrowUp: [0, k, 0], ArrowDown: [0, -k, 0], PageUp: [0, 0, k], PageDown: [0, 0, -k] }[e.key]
      if (!d) return
      e.preventDefault()
      setComp((c) => moveMultiBy(c, selection.items, d[0]!, d[1]!, d[2]!))
      return
    }
    if (selection.kind === "group") {
      const k = e.shiftKey ? 10 : 1
      const d = { ArrowLeft: [-k, 0, 0], ArrowRight: [k, 0, 0], ArrowUp: [0, k, 0], ArrowDown: [0, -k, 0], PageUp: [0, 0, k], PageDown: [0, 0, -k] }[e.key]
      if (!d) return
      e.preventDefault()
      moveGroup(selection.id, d[0]!, d[1]!, d[2]!)
      return
    }
    const r = selection.kind === "part" ? absParts.find((o) => o.id === selection.id) : selection.kind === "model" ? comp.models?.find((o) => o.id === selection.id) : comp.references.find((o) => o.id === selection.id)
    if (!r) return
    const k = e.shiftKey ? 10 : 1
    const d = { ArrowLeft: [-k, 0, 0], ArrowRight: [k, 0, 0], ArrowUp: [0, k, 0], ArrowDown: [0, -k, 0], PageUp: [0, 0, k], PageDown: [0, 0, -k] }[e.key]
    if (!d) return
    e.preventDefault()
    ;(selection.kind === "part" ? movePart : selection.kind === "model" ? moveModel : moveRef)(r.id, { x: r.x + d[0]!, y: Math.max(0, r.y + d[1]!), z: r.z + d[2]! })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => nudgeRef.current(e)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /**
   * Clic al 3D. El primer clic selecciona el mòdul; si el mòdul ja estava seleccionat (o un
   * compartiment seu), el clic entra a dins i selecciona el compartiment tocat.
   */
  /**
   * Clic al 3D. Un mòdul no seleccionat → el mòdul. Dins del mòdul seleccionat → el
   * compartiment on s'ha clicat. Sobre la carcassa (laterals, tapa, base) → el mòdul. Tornar
   * a clicar el compartiment ja seleccionat → puja al pare (fins al mòdul).
   */
  const selectFrom3D = (id: string, at?: [number, number, number]) => {
    // Maj + clic a un mòdul: el mòdul sencer a la selecció múltiple.
    if (shiftRef.current) return pick({ kind: "module", id })
    const inside = (selection.kind === "module" && selection.id === id) || (selection.kind === "zone" && selection.moduleId === id)
    const idx = comp.modules.findIndex((m) => m.id === id)
    const mb = build?.modules[idx]
    const mod = comp.modules[idx]
    if (!inside || !at || !mb || !mod) return selectModule(id)
    const lx = mb.mirrorX !== undefined ? mb.mirrorX - (at[0] - mb.x) : at[0] - mb.x
    const ly = at[1] - mb.y
    const inner = mb.build.layout.rects.get(mod.root.id)
    if (inner && (lx < inner.x0 || lx > inner.x1 || ly < inner.y0 || ly > inner.y1)) return selectModule(id)
    const tol = 25
    let best: { id: string; area: number } | null = null
    for (const z of mb.build.layout.leaves) {
      const r = mb.build.layout.rects.get(z.id)
      if (!r || lx < r.x0 - tol || lx > r.x1 + tol || ly < r.y0 - tol || ly > r.y1 + tol) continue
      const area = (r.x1 - r.x0) * (r.y1 - r.y0)
      if (!best || area < best.area) best = { id: z.id, area }
    }
    if (!best) return selectModule(id)
    // El mateix compartiment (o un dels seus fills) ja seleccionat: un nivell amunt.
    if (selection.kind === "zone" && selection.moduleId === id) {
      const sel = findZone(mod.root, selection.zoneId)
      if (sel && (sel.id === best.id || findZone(sel, best.id))) {
        const parent = parentOf(mod.root, sel.id)
        // Del compartiment es puja a la divisió, a l'«Interior» (l'arrel) i al mòdul (amb les portes de tot el mòdul).
        return parent ? select({ kind: "zone", moduleId: id, zoneId: parent.id }) : selectModule(id)
      }
    }
    select({ kind: "zone", moduleId: id, zoneId: best.id })
  }

  /**
   * Anterior / següent de la mateixa mena que la selecció: compartiments del mòdul en
   * ordre de lectura (de dalt a baix i d'esquerra a dreta), mòduls o objectes.
   */
  const siblings = useMemo((): { prev: Selection | null; next: Selection | null; pos: string } | null => {
    const around = <T,>(list: T[], i: number, to: (t: T) => Selection) =>
      i < 0 || list.length < 2 ? null : { prev: i > 0 ? to(list[i - 1]!) : null, next: i < list.length - 1 ? to(list[i + 1]!) : null, pos: `${i + 1}/${list.length}` }
    if (selection.kind === "module") return around(comp.modules, comp.modules.findIndex((m) => m.id === selection.id), (m) => ({ kind: "module", id: m.id }))
    if (selection.kind === "hardware") {
      // Els col·locats del mateix mòdul (o peça lliure), en l'ordre de la composició.
      const pl = comp.hardwarePlacements?.find((h) => h.id === selection.id)
      const scope = pl && placementScope(pl)
      const list = scope ? scopePlacements(comp, scope) : []
      return around(list, list.findIndex((h) => h.id === selection.id), (h) => ({ kind: "hardware", id: h.id }))
    }
    if (selection.kind === "ref") return around(comp.references, comp.references.findIndex((r) => r.id === selection.id), (r) => ({ kind: "ref", id: r.id }))
    if (selection.kind === "part") return around(comp.parts ?? [], (comp.parts ?? []).findIndex((r) => r.id === selection.id), (r) => ({ kind: "part", id: r.id }))
    if (selection.kind === "model") return around(comp.models ?? [], (comp.models ?? []).findIndex((g) => g.id === selection.id), (g) => ({ kind: "model", id: g.id }))
    if (selection.kind === "zone" && zone && moduleBuild && module) {
      const wantLeaves = !zone.split
      const list: { id: string; cx: number; cy: number }[] = []
      walkZones(module.root, (z) => {
        if (!!z.split === wantLeaves || z.id === module.root.id) return
        const r = moduleBuild.layout.rects.get(z.id)
        if (r) list.push({ id: z.id, cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2 })
      })
      list.sort((a, b) => (Math.abs(a.cy - b.cy) > 1 ? b.cy - a.cy : a.cx - b.cx))
      return around(list, list.findIndex((z) => z.id === zone.id), (z) => ({ kind: "zone", moduleId: module.id, zoneId: z.id }))
    }
    return null
  }, [selection, comp, zone, module, moduleBuild])

  // Els de fusteria i, com que el build no llegeix Preferències, els de materials (no hi és, gruix que no té).
  const warnings = useMemo(() => {
    if (!build) return NO_WARNINGS
    const own = materialIssues(build, comp, settings.materials)
    return own.length ? [...build.warnings, ...own] : build.warnings
  }, [build, comp, settings.materials])
  // Al 3D també els elements sense nesting (ferro, pedra, vidre…).
  const viewerPanels = useMemo(() => (build?.extras.length ? [...panels, ...build.extras] : panels), [build, panels])
  // L'ull de l'arbre: el que s'amaga no es dibuixa a l'editor (es fabrica igual i surt a Peces, Nesting i Exportar).
  const shownPanels = useMemo(() => {
    const mods = comp.modules.filter((m) => m.hidden).map((m) => `${m.id}:`)
    const parts = (comp.parts ?? []).filter((q) => q.hidden).map((q) => `part:${q.id}`)
    if (!mods.length && !parts.length) return viewerPanels
    return viewerPanels.filter((p) => !mods.some((k) => p.id.startsWith(k)) && !parts.some((k) => p.id === k || p.id.startsWith(`${k}-`)))
  }, [viewerPanels, comp])
  const totalHoles = panels.reduce((n, p) => n + p.holes.length, 0)
  // Mesures de la foto aplicades al moble que encara són estimades.
  const estimated = useMemo(() => estimatedApplied(project.photo), [project.photo])

  /** Aplica una mesura de la foto (mm) a un paràmetre d'un mòdul o d'un objecte de referència. */
  const applyMeasure = (target: string, value: number) => {
    const [kind, id, field] = target.split(":")
    if (kind === "module") {
      setComp((c) => ({
        ...c,
        modules: c.modules.map((m) => (m.id === id && (field === "width" || field === "height" || field === "depth") ? { ...m, carcass: { ...m.carcass, [field]: value } } : m)),
      }))
    } else if (kind === "ref") {
      setComp((c) => ({ ...c, references: c.references.map((r) => (r.id === id && (field === "w" || field === "h" || field === "d") ? { ...r, [field]: value } : r)) }))
    }
  }

  // Obertura: grups mòbils, els del compartiment seleccionat i les col·lisions.
  const groups = useMemo(() => movingGroups(panels), [panels])
  const zoneRect = selectedZone ? moduleBuild?.layout.rects.get(selectedZone) : undefined
  // Caixa del compartiment seleccionat per ressaltar-lo al 3D (fins al front del mòdul).
  const highlightZone = useMemo(() => {
    if (!build) return null
    const mod = build.modules[moduleIndex]
    if (!mod || !module) return null
    const c = module.carcass
    // Mòdul seleccionat: només el contorn, sense vel i sòlid (translúcid només amb un compartiment).
    if (selection.kind === "module")
      return { x0: mod.x, x1: mod.x + c.width, y0: mod.y, y1: mod.y + c.height, z0: mod.z, z1: mod.z + c.depth + c.thickness, veil: false }
    if (selection.kind !== "zone" || !zoneRect) return null
    const [x0, x1] = [moduleWorldX(mod, zoneRect.x0), moduleWorldX(mod, zoneRect.x1)].sort((a, b) => a - b) as [number, number]
    return { x0, x1, y0: mod.y + zoneRect.y0, y1: mod.y + zoneRect.y1, z0: mod.z, z1: mod.z + c.depth + c.thickness }
  }, [selection.kind, zoneRect, build, moduleIndex, module])
  const openOnly = useMemo(() => {
    if (!viewer.openOnlySelected || !zoneRect || !build) return null
    const mod = build.modules[moduleIndex]
    if (!mod) return null
    const [x0, x1] = [moduleWorldX(mod, zoneRect.x0), moduleWorldX(mod, zoneRect.x1)].sort((a, b) => a - b) as [number, number]
    const y0 = mod.y + zoneRect.y0
    const y1 = mod.y + zoneRect.y1
    const ids = new Set<string>()
    for (const g of groups) {
      const p = panels.find((x) => x.id === g.panelIds[0])
      if (!p) continue
      const b = panelBox(p)
      if (b.max[0] > x0 + 1 && b.min[0] < x1 - 1 && b.max[1] > y0 + 1 && b.min[1] < y1 - 1) ids.add(g.id)
    }
    return ids
  }, [viewer.openOnlySelected, zoneRect, build, moduleIndex, groups, panels])
  const collisions = useMemo(() => openingCollisions(panels, groups, viewer.opening, comp.references, openOnly ?? undefined), [panels, groups, viewer.opening, comp.references, openOnly])
  const downloadImage = async () => {
    if (!capture.current) return
    try {
      downloadBlob(await capture.current(), `${slugify(name)}.png`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar la imatge", description: String(e), type: "error" })
    }
  }

  // Avisos de la selecció: del mòdul (inclosos els xocs d'objectes amb les seves peces),
  // de l'objecte de referència seleccionat, o tots si és el moble.
  const moduleWarnings =
    selection.kind === "module" || selection.kind === "zone"
      ? warnings.filter((w) => !w.moduleId || w.moduleId === module?.id)
      : selection.kind === "ref"
        ? warnings.filter((w) => w.refId === selection.id)
        : selection.kind === "part"
          ? warnings.filter((w) => w.partId === selection.id)
          : selection.kind === "model" || selection.kind === "hardware"
            ? NO_WARNINGS
            : warnings
  const collidingRefs = useMemo(() => new Set(warnings.flatMap((w) => (w.refId ? [w.refId] : []))), [warnings])
  // Els que tallen i toquen alguna peça (verd); els altres que tallen, en vermell.
  const cuttingRefs = useMemo(() => new Set(build?.cutting ?? []), [build])

  // --- Inspector: propietats del que hi ha seleccionat ---------------------------
  // A la pestanya Foto, l'inspector mostra el calibratge quan no hi ha res seleccionat (el
  // moble sencer); si es tria un mòdul, un compartiment o un objecte, en mostra les propietats.
  const photoInspector = photoTab && selection.kind === "moble"
  // Títol en dues línies: on és (petit i apagat) i què és (el nom), perquè no es talli.
  const renamePart = (id: string, v: string) => setComp((c) => ({ ...c, parts: (c.parts ?? []).map((r) => (r.id === id ? { ...r, name: v } : r)) }))
  const selPart = selection.kind === "part" ? comp.parts?.find((r) => r.id === selection.id) : undefined
  const selHardware = selection.kind === "hardware" ? comp.hardwarePlacements?.find((h) => h.id === selection.id) : undefined
  const selHardwareScope = selHardware ? placementScope(selHardware) : null
  const hardwareOwnerName = selHardwareScope?.kind === "module" ? (comp.modules.find((m) => m.id === selHardwareScope.moduleId)?.name ?? "") : selHardwareScope?.kind === "part" ? (comp.parts?.find((q) => q.id === selHardwareScope.partId)?.name ?? "") : ""
  const renameModel = (id: string, v: string) => setComp((c) => ({ ...c, models: (c.models ?? []).map((g) => (g.id === id ? { ...g, name: v } : g)) }))
  const renameRef = (id: string, v: string) => setComp((c) => ({ ...c, references: c.references.map((r) => (r.id === id ? { ...r, name: v } : r)) }))
  const inspectorTitle: { icon: ReactNode; text: string; parent?: string; onRename?: (v: string) => void } = photoInspector
    ? { icon: <LuCamera />, text: "Foto del lloc" }
    : selection.kind === "moble"
      ? { icon: <LuBox />, text: name || "Moble" }
      : selection.kind === "multi"
        ? { icon: <LuGroup />, text: `${selection.items.length} elements`, parent: "Selecció" }
      : selection.kind === "group"
        ? { icon: <LuGroup />, text: selection.id, parent: "Grup", onRename: (v) => {
            const old = selection.id
            setComp((c) => renameGroup(c, old, v))
            select({ kind: "group", id: v })
          } }
      : selection.kind === "part" && selPart
        ? { icon: createElement(ORIENT_ICON[selPart.orient]), text: selPart.name, parent: "Peça lliure", onRename: (v) => renamePart(selPart.id, v) }
      : selection.kind === "model"
        ? { icon: <LuSprout />, text: comp.models?.find((g) => g.id === selection.id)?.name ?? "Model", parent: "Model 3D", onRename: (v) => renameModel(selection.id, v) }
      : selection.kind === "ref"
        ? { icon: <LuScan />, text: comp.references.find((r) => r.id === selection.id)?.name ?? "Objecte", parent: "Objecte de referència", onRename: (v) => renameRef(selection.id, v) }
      : selection.kind === "hardware" && selHardware
        ? { icon: <LuWrench />, text: selHardware.item.name, parent: `Ferratge · ${hardwareOwnerName}` }
        : selection.kind === "zone" && zone && module
          ? { icon: createElement(zoneIcon(zone, { root: zone.id === module.root.id })), text: zoneLabel(zone, { root: zone.id === module.root.id }), parent: module.name }
          : module
            ? { icon: <LuBox />, text: module.name, parent: name || "Moble", onRename: (v) => updateModule({ ...module, name: v }) }
            : { icon: <LuBox />, text: name || "Moble" }

  // Accions ràpides del visor, a dalt de «Opcions de vista» (com el menú de visualització
  // de Fusion o Blender): el mode en un grup i la resta com a botons amb icona i nom.
  // Només icona (el text no hi cabia): el nom i l'explicació, al tooltip.
  const tile = (key: string, label: string, icon: ReactNode, on: boolean, onClick: () => void, tip?: string) => <ViewTile key={key} label={label} icon={icon} on={on} onClick={onClick} tip={tip} />
  const viewModes = (
    <SimpleGrid columns={3} gap={1.5}>
      {VIEW_MODES.map(([v, label, tip, Icon]) => tile(v, label, <Icon />, viewMode === v, () => setViewMode(v), `${label}: ${tip}`))}
    </SimpleGrid>
  )
  const viewTiles = (
    <>
      {tile("fit", "Enquadrar", <LuVideo />, framed, () => frameFrom(null), framed ? "Càmera enquadrada (no es mou sola en editar)" : "Enquadrar el moble")}
      {tile("holes", "Forats", <LuCircleDot />, showHoles || exploded || viewer.opacity < 1, () => setShowHoles((v) => !v), exploded ? "A la vista explosionada els forats sempre es veuen" : viewer.opacity < 1 ? "Amb les peces translúcides (Opacitat) els forats sempre es veuen" : showHoles ? "Amagar forats" : "Mostrar forats")}
      {tile("explode", "Explosió", exploded ? <LuShrink /> : <LuExpand />, exploded, () => setExploded((v) => !v), exploded ? "Vista muntada" : "Vista explosionada")}
      {tile("hardware", "Ferratges", <LuWrench />, hardware, () => setHardware((v) => !v), hardware ? "Amagar frontisses, tiradors i potes" : "Mostrar frontisses, tiradors i potes")}
      {tile("render", "Render", <LuAperture />, false, () => (setViewOptsOpen(false), quality === "fast" && roleColors && setRoleColors(false), setRenderOpen(true)), "Render fotorealista (GPU o CPU, com Cinema 4D): es va afinant i es desa en PNG")}
      {tile("ar", "A casa (AR)", <LuView />, false, () => setArOpen(true), "Veure a casa (realitat augmentada)")}
    </>
  )

  // Sense separació entre blocs: les seccions plegables van enganxades (totes amb la
  // mateixa alçada de capçalera); els elements que no són secció porten el seu marge.
  const inspector = (
    <Stack gap={0}>
      {/* Una secció oberta alhora (per decisió de l'usuari, 2026-10-13): obrir-ne una tanca l'altra; es recorda a la
          sessió. Les subseccions de dins (`size="sm"`) continuen independents. */}
      <FoldGroup multiple={false} value={inspectorOpen} onValueChange={setInspectorOpen}>
      {/* Capçalera: on és i què és (dues línies), anterior/següent i ⋯ amb les accions. */}
      <HStack gap={2} color="wood.fg" pb={2} mb={2} borderBottomWidth="1px">
        <Stack gap={0} flex={1} minW={0}>
          {inspectorTitle.parent && (
            <Text fontSize="xs" color="fg.muted" truncate data-truncate="">
              {inspectorTitle.parent}
            </Text>
          )}
          {inspectorTitle.onRename ? (
            // El nom es canvia aquí, a la capçalera (clic al nom), com a Figma.
            <Editable.Root
              key={`${selection.kind}:${inspectorTitle.text}`}
              defaultValue={inspectorTitle.text}
              onValueCommit={(e) => {
                const v = e.value.trim()
                if (v && v !== inspectorTitle.text) inspectorTitle.onRename!(v)
              }}
              fontSize="sm"
              fontWeight="semibold"
              color="fg"
              minW={0}
              aria-label="Nom"
            >
              <Editable.Preview title="Clica per canviar el nom" truncate px={1} mx={-1} py={0} minH="auto" _hover={{ bg: "bg.muted" }} />
              <Editable.Input px={1} mx={-1} py={0} h="22px" />
            </Editable.Root>
          ) : (
            <Text fontSize="sm" fontWeight="semibold" color="fg" truncate data-truncate="">
              {inspectorTitle.text}
            </Text>
          )}
        </Stack>
        {!photoInspector && siblings && (
          <HStack gap={0} flexShrink={0} color="fg.muted">
            <Tooltip content={`Anterior (${siblings.pos})`}>
              <IconButton size="xs" variant="ghost" aria-label="Anterior" disabled={!siblings.prev} onClick={() => siblings.prev && select(siblings.prev)}>
                <LuChevronLeft />
              </IconButton>
            </Tooltip>
            <Tooltip content={`Següent (${siblings.pos})`}>
              <IconButton size="xs" variant="ghost" aria-label="Següent" disabled={!siblings.next} onClick={() => siblings.next && select(siblings.next)}>
                <LuChevronRight />
              </IconButton>
            </Tooltip>
          </HStack>
        )}
        {!photoInspector && selection.kind === "zone" && zone && module && (
          <ZoneActions root={module.root} zone={zone} onChange={(root) => updateModule({ ...module, root })} onSelect={selectZone} />
        )}
        {!photoInspector && selection.kind === "part" && (
          <PartActions comp={comp} id={selection.id} onChange={setComp} onRemoved={() => select({ kind: "moble" })} onSelected={(id) => select({ kind: "part", id })} />
        )}
        {!photoInspector && selection.kind === "model" && (
          <ModelActions comp={comp} id={selection.id} onChange={setComp} onRemoved={() => select({ kind: "moble" })} onSelected={(id) => select({ kind: "model", id })} />
        )}
        {!photoInspector && selection.kind === "hardware" && selHardware && (
          <HStack gap={0} flexShrink={0}>
            <Tooltip content={`Pare: ${hardwareOwnerName}`}>
              <IconButton
                size="xs"
                variant="ghost"
                aria-label="Pare"
                onClick={() => select(selHardwareScope?.kind === "module" ? { kind: "module", id: selHardwareScope.moduleId } : selHardwareScope?.kind === "part" ? { kind: "part", id: selHardwareScope.partId } : { kind: "moble" })}
              >
                <LuArrowUp />
              </IconButton>
            </Tooltip>
            <PlacementButtons id={selHardware.id} name={selHardware.item.name} actions={hardwareActions} edit={false} />
          </HStack>
        )}
        {!photoInspector && selection.kind === "ref" && (
          <RefActions comp={comp} id={selection.id} onChange={setComp} onRemoved={() => select({ kind: "moble" })} onSelected={(id) => select({ kind: "ref", id })} />
        )}
      </HStack>

      {photoTab && !photoInspector && (
        <Button size="xs" variant="outline" alignSelf="flex-start" mb={2} onClick={() => select({ kind: "moble" })}>
          <LuCamera /> {project.photo ? "Tornar a la foto del lloc" : "Opcions de la foto"}
        </Button>
      )}
      {photoInspector ? (
        <Box ref={setPhotoControls} />
      ) : selection.kind === "moble" ? (
        <Stack gap={0}>
          <FoldItem id="moble-summary" title="Resum" icon={LuBox}>
            <Text fontSize="sm" color="fg.muted">
              {empty ? (partsOnlyKind(kind) ? "Buit: afegeix-hi peces amb el + de «Peces lliures»." : "Buit: comença amb el + de «Mòduls» (o de «Peces lliures»).") : `${comp.modules.length} ${comp.modules.length === 1 ? "mòdul" : "mòduls"} · ${size.width} × ${size.height} × ${size.depth} mm`}
            </Text>
            <HStack gap={2} wrap="wrap">
              <Badge variant="subtle">{panels.length} peces</Badge>
              <Badge variant="subtle">{totalHoles} forats</Badge>
              {comp.references.length > 0 && <Badge variant="subtle">{comp.references.length} objectes de referència</Badge>}
              {(comp.models?.length ?? 0) > 0 && <Badge variant="subtle">{comp.models!.length === 1 ? "1 model 3D" : `${comp.models!.length} models 3D`}</Badge>}
            </HStack>
            <Text fontSize="xs" color="fg.muted" display={empty ? "none" : undefined}>
              Selecciona un mòdul, un compartiment o un objecte a l'estructura (o clica'l al 3D) per editar-lo.
            </Text>
          </FoldItem>
          {/* Sense «Tipus» (es tria en crear el moble). Els documents només de peces ho diuen aquí. */}
          {kind === "objecte" ? (
            <Text fontSize="xs" color="fg.muted" px={1} py={2}>
              Objecte per als ambients: fes-lo amb peces lliures (forma amb l'editor de perfils, «Talla» per als forats i buidats) i materials de simulació. Només es veu: no va al nesting ni als fitxers del taller.
            </Text>
          ) : kind === "lliure" ? (
            <Text fontSize="xs" color="fg.muted" px={1} py={2}>
              Moble només de peces lliures (sense mòduls). Les que tenen «Encaixos» activat fan l'encaix sol on es toquen o s'encreuen: pestanyes, mitja fusta, dits o espigues. Les de ferro, pedra o vidre no van al nesting.
            </Text>
          ) : null}
          {/* Sense «Taulell i sòcol» (per decisió de l'usuari, 2026-10-13: «que no aparegui»). Treure ≠ esborrar: les peces
              corregudes que ja hi són (`comp.runs`) es conserven i es fabriquen igual; `RunsForm` es queda sense ús. */}
          {/* Sense «Illes» (per decisió de l'usuari, 2026-10-13: «treu l'opció illa, això és més fàcil amb peces lliures»).
              Treure ≠ esborrar: les illes que ja hi són es conserven i es fabriquen igual; `IslandsForm` es queda sense ús. */}
          {(comp.parts ?? []).some((p) => partJoinery(comp, p)) && (
            <FoldItem id="moble-joinery" title="Encaixos" icon={LuPuzzle} badge={build?.joints.length || undefined}>
              <PartJoineryForm comp={comp} onChange={setComp} />
            </FoldItem>
          )}
          {/* Com els Acabats dels ambients: terra i paret de l'escena on es presenta (per defecte, les de Preferències). */}
          <FoldItem id="moble-scene" title="Acabats de l'escena" icon={LuLampFloor} badge={comp.scene?.floor || comp.scene?.wall ? "Propis" : undefined}>
            <Stack gap={0}>
              {(["floor", "wall"] as const).map((k) => (
                <FormRow key={k} label={k === "floor" ? "Terra" : "Paret"} help={k === "wall" ? "Es veuen en mode Presentació i a la miniatura de la targeta." : undefined} maxW="280px">
                  <MaterialSelect
                    label={k === "floor" ? "Terra" : "Paret"}
                    materials={settings.materials}
                    value={comp.scene?.[k] ?? ""}
                    emptyLabel="Com a Preferències"
                    hideLabel
                    onChange={(v) => setComp((c) => {
                      const next = { ...c.scene, [k]: v || undefined }
                      const { scene: _s, ...rest } = c
                      return next.floor || next.wall ? { ...rest, scene: next } : rest
                    })}
                  />
                </FormRow>
              ))}
            </Stack>
          </FoldItem>
          {!partsOnlyKind(kind) && comp.modules[0] && <FoldItem id="moble-materials" title="Materials de tot el moble" icon={LuPalette}>
            <MaterialsForm
              carcass={comp.modules[0].carcass}
              hasBack={comp.modules.some((m) => m.carcass.back !== "none")}
              hasDrawers={comp.modules.some((m) => hasDrawers(visibleModule(m).root))}
              mixed={comp.modules.some((m) => {
                const a = m.carcass
                const b = comp.modules[0]!.carcass
                return a.material !== b.material || (a.frontMaterial ?? "") !== (b.frontMaterial ?? "") || a.backMaterial !== b.backMaterial || a.thickness !== b.thickness || a.backThickness !== b.backThickness
              })}
              onPatch={(patch) => setComp((c) => ({ ...c, modules: c.modules.map((m) => ({ ...m, carcass: { ...m.carcass, ...patch } })) }))}
            />
          </FoldItem>}
        </Stack>
      ) : selection.kind === "model" ? (
        <ModelInspector comp={comp} id={selection.id} onChange={setComp} />
      ) : selection.kind === "hardware" ? (
        <PlacementInspector comp={comp} id={selection.id} panels={panels} library={settings.hardwareLibrary} warnings={warnings} onChange={setComp} />
      ) : selection.kind === "ref" ? (
        <RefInspector comp={comp} id={selection.id} onChange={setComp} />
      ) : selection.kind === "multi" ? (
        <MultiInspector
          comp={comp}
          items={selection.items}
          onChange={setComp}
          onSelect={(x) => select({ kind: x.kind, id: x.id })}
          onMove={(dx, dy, dz) => setComp((c) => moveMultiBy(c, selection.items, dx, dy, dz))}
          onGroup={() => {
            const g = newGroupName(comp)
            setComp(groupMulti(comp, selection.items, g))
            select({ kind: "group", id: g })
          }}
          onRemove={() => {
            setComp(removeMulti(comp, selection.items))
            select({ kind: "moble" })
          }}
        />
      ) : selection.kind === "group" ? (
        // Un grup té les mateixes propietats que una selecció múltiple (per decisió de l'usuari): els seus elements.
        (() => {
          const items: MultiItem[] = [...(comp.parts ?? []).filter((p) => p.group === selection.id).map((p) => ({ kind: "part" as const, id: p.id })), ...(comp.models ?? []).filter((m) => m.group === selection.id).map((m) => ({ kind: "model" as const, id: m.id }))]
          return (
            <MultiInspector
              comp={comp}
              items={items}
              onChange={setComp}
              onSelect={(x) => select({ kind: x.kind, id: x.id })}
              onMove={(dx, dy, dz) => moveGroup(selection.id, dx, dy, dz)}
              onGroup={() => {
                const g = newGroupName(comp)
                setComp(groupMulti(comp, items, g))
                select({ kind: "group", id: g })
              }}
              onRemove={() => {
                setComp(removeGroup(comp, selection.id))
                select({ kind: "moble" })
              }}
            />
          )
        })()
      ) : selection.kind === "part" ? (
        <Stack gap={0}>
          <PartInspector comp={comp} id={selection.id} joints={build?.joints ?? []} onChange={setComp} />
          {/* Ferratges col·locats a mà que ja porta la peça (ja no se n'afegeixen: treure ≠ esborrar). */}
          {(!partsOnlyKind(kind) || kind === "lliure") && scopePlacements(comp, { kind: "part", partId: selection.id }).length > 0 ? (
            <FoldItem id="part-hardware" title="Ferratges" icon={LuWrench} badge={scopePlacements(comp, { kind: "part", partId: selection.id }).length || undefined}>
              <HardwarePlacements comp={comp} scope={{ kind: "part", partId: selection.id }} panels={panels} warnings={warnings} actions={hardwareActions} />
            </FoldItem>
          ) : null}
        </Stack>
      ) : selection.kind === "zone" && zone && module ? (
        <Stack gap={3}>
          <ZonePanel
            root={module.root}
            zone={zone}
            bounds={zoneBounds(module, zone.id) ?? carcassBounds(module.carcass)}
            {...(() => {
              // Com es construeix: un front que no es fa (compartiment sense un costat, `zoneSupport.ts`) no tapa res.
              const cover = coveringZone(visibleModule(module).root, zone.id)
              return cover ? { coveredBy: zoneLabel(cover, { root: cover.id === module.root.id }), coveredByFixed: cover.front?.kind === "panel" } : {}
            })()}
            hardware={module.hardware}
            noHandles={module.fronts.handles === "none"}
            openRatio={moduleBuild?.openRatios[zone.id]}
            drawerHeights={moduleBuild?.drawerHeights[zone.id]}
            kits={moduleBuild?.hardwareKits.filter((k) => k.zoneId === zone.id)}
            onChange={(root) => updateModule({ ...module, root })}
            onSelect={selectZone}
            childSizes={moduleBuild ? splitChildSizes(moduleBuild.layout, zone) : undefined}
            // La filera System 32 del mòdul: als Prestatges o al Front d'aquest compartiment, si li toca (`system32RowPlace`).
            system32={(() => {
              const place = system32RowPlace(module)
              if (!place?.zones.has(zone.id)) return undefined
              return { at: place.at, row: <System32Pick current={moduleSlotItem(module.hardware, "system32")} what={place.what} onPick={(system32) => updateModule({ ...module, hardware: { ...module.hardware, system32 } })} /> }
            })()}
            // A l'«Interior» (l'arrel), a la Divisió: la folgança de les peces de dins, només amb l'arrel dividida (tots els
            // divisors i prestatges fixos; opcions en cascada).
            splitExtra={zone.id === module.root.id && moduleHasInnerPieces(module) ? <InnerClearanceRow module={module} onChange={updateModule} /> : null}
          />
        </Stack>
      ) : module ? (
        // Seccions plegables independents (com Figma o Fusion): es poden tenir diverses
        // obertes i cada una recorda el seu estat.
        // Ordre (per decisió de l'usuari, 2026-10-13): Posició · Mides · Caixa · Portes · Unió · Materials.
        <Stack gap={0}>
            {islandBack ? (
              // El de darrere d'una illa es col·loca sol (girat i enganxat al de davant): la seva posició no compta.
              <FoldItem id="mod-position" title="Posició" icon={LuMove} badge="Illa · darrere">
                <Text fontSize="sm" color="fg.muted">
                  És el mòdul de darrere de l'illa amb «{comp.modules.find((m) => m.id === islandBack.front)?.name}»: es gira 180° i es col·loca sol, enganxat al seu darrere. Es canvia al moble, a «Illes».
                </Text>
              </FoldItem>
            ) : (
            <FoldItem id="mod-position" title="Posició" icon={LuMove} badge={module.carcass.base.kind === "wall" ? `Penjat a ${module.carcass.base.height}` : mountOf(module) === "floor" ? `Lliure al terra · ${module.wallGap ?? 0} de la paret` : "Arrambat a la paret"}>
              {/* Dues files, com les cuines: a terra (baixos) i penjats (alts). Dins de cada
                  fila, l'ordre és el de l'arbre (d'esquerra a dreta) i cada mòdul va al costat
                  de l'anterior de la seva fila. */}
              <FormRow
                label="Fila"
                help={
                  mountOf(module) === "hung"
                    ? "Al 3D, arrossega la maneta del mòdul: es mou per la paret, de costat i amunt/avall (Maj: tot el moble)."
                    : mountOf(module) === "floor"
                      ? "Al 3D, arrossega la maneta del mòdul: es mou pel terra, de costat i endavant/enrere (Maj: tot el moble)."
                      : "Al 3D, arrossega la maneta del mòdul: llisca de costat tocant la paret (Maj: tot el moble)."
                }
              >
                {/* Com els altres botons d'opció: només la icona, el nom al tooltip i la triada a sota. */}
                <IconChoice
                  label="Fila"
                  hideLabel
                  value={mountOf(module)}
                  options={[
                    { value: "wall", label: "Arrambat a la paret", icon: LuBrickWall, hint: "Arrambat a la paret: a terra; es mou de costat" },
                    { value: "hung", label: "Penjat", icon: LuPanelTop, hint: "Penjat a la paret: es mou de costat i amunt/avall" },
                    { value: "floor", label: "Lliure al terra", icon: LuArrowDownToLine, hint: "Lliure al terra: es mou pel terra, també separat de la paret" },
                  ]}
                  // Al terra: surt de la fila i es queda on és (X pròpia). El mateix camí que l'assistent (`setModuleMount`).
                  onChange={(v) => updateModule(setModuleMount(module, v, Math.round(build?.modules[moduleIndex]?.x ?? 0)))}
                />
              </FormRow>
              {module.carcass.base.kind === "wall" && (
                <NumRow
                  label="Alçada del terra"
                  value={module.carcass.base.height}
                  min={0}
                  max={2800}
                  step={10}
                  onChange={(height) => updateModule({ ...module, carcass: { ...module.carcass, base: { kind: "wall", height } } })}
                  help="Fins a la part de baix del mòdul."
                />
              )}
              {mountOf(module) === "floor" && (
                <NumRow
                  label="Separació de la paret"
                  value={module.wallGap ?? 0}
                  min={0}
                  max={10000}
                  step={10}
                  onChange={(wallGap) => updateModule({ ...module, wallGap })}
                  help="Del darrere del mòdul a la paret."
                />
              )}
              {/* Girat 180° (una illa amb dos mòduls d'esquena, calaixos pels dos costats): només lliure al terra. */}
              {mountOf(module) === "floor" && (
                <FormRow label="Girat" help={module.turned ? "Els fronts miren enrere: posa'l d'esquena amb un altre mòdul per fer una illa amb calaixos pels dos costats." : undefined}>
                  <Switch.Root size="sm" pt="6px" checked={!!module.turned} onCheckedChange={(e) => updateModule(e.checked ? { ...module, turned: true } : (({ turned: _t, ...rest }) => rest)(module))}>
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label fontSize="sm">180° (fronts enrere)</Switch.Label>
                  </Switch.Root>
                </FormRow>
              )}
              {freeX(module) ? (
                <NumRow
                  label="De costat (X)"
                  value={module.x!}
                  min={-20000}
                  max={20000}
                  step={10}
                  onChange={(x) => Number.isFinite(x) && updateModule({ ...module, x })}
                  help="Des de l'inici del moble. Fora de la fila: no empeny els altres (una illa, un moble solt)."
                />
              ) : (
              <NumRow
                  label={rowIndex > 0 ? "Separació amb l'anterior" : "Separació des de l'inici"}
                  value={module.gapBefore}
                  min={0}
                  max={5000}
                  step={10}
                  onChange={(g) => updateModule({ ...module, gapBefore: g })}
                  help={rowIndex > 0 ? `Des de «${rowPrev!.name}», a l'esquerra en la mateixa fila.` : "És el primer de la fila: la distància des de l'esquerra del moble."}
                />
              )}
            </FoldItem>
            )}
          <FoldItem id="mod-dims" title="Mides" icon={LuMoveDiagonal} badge={`${module.carcass.width} × ${module.carcass.height}`}>
            <CarcassForm module={module} onChange={updateModule} section="dims" />
          </FoldItem>
          {/* Per decisió de l'usuari (2026-10-08) no hi ha secció «Acabats»: cada fila és a la secció del que toca, un sol
              lloc per decisió i només el que la construcció llegeix (`moduleRows`): el fons, l'estil, les folgances i el
              retranqueig a la Caixa; el material dels fronts a Materials; l'espiga a Unió. Els ferratges per defecte del
              mòdul no surten: cada compartiment tria el seu (o «Com el mòdul»). */}
          {(() => {
            const rows = moduleRows(module)
            return (
              <>
                <FoldItem id="mod-structure" title="Caixa" icon={LuFrame} badge={rows.style ? (module.fronts.style === "inset" ? "Encastats" : "Recobrents") : undefined}>
                  <CarcassForm module={module} onChange={updateModule} section="structure" rows={rows} />
                </FoldItem>
                {/* Portes de dalt a baix de tot el mòdul (armari), només amb l'Interior dividit: sense dividir, el Front és el
                    del compartiment. Després de la Caixa (els laterals diuen on hi caben) i abans dels Materials (Fronts). */}
                {module.root.split && (
                  <ModuleDoorsSection
                    root={module.root}
                    bounds={zoneBounds(module, module.root.id) ?? carcassBounds(module.carcass)}
                    hardware={module.hardware}
                    noHandles={module.fronts.handles === "none"}
                    onChange={(root) => updateModule({ ...module, root })}
                    // La filera System 32 del mòdul, després de la «Frontissa» si li toca a aquestes portes (`system32RowPlace`).
                    afterHinge={(() => {
                      const place = system32RowPlace(module)
                      if (place?.at !== "front" || !place.zones.has(module.root.id)) return undefined
                      return <System32Pick current={moduleSlotItem(module.hardware, "system32")} what={place.what} onPick={(system32) => updateModule({ ...module, hardware: { ...module.hardware, system32 } })} />
                    })()}
                  />
                )}
                {rows.dowel && (
                  <FoldItem id="mod-joint" title="Unió" icon={LuBolt}>
                    <JointForm module={module} onChange={updateModule} />
                  </FoldItem>
                )}
                <FoldItem id="mod-materials" title="Materials" icon={LuPalette}>
                  <MaterialsForm carcass={module.carcass} hasDrawers={hasDrawers(visibleModule(module).root)} hasFronts={rows.frontMaterial} onPatch={(patch) => updateModule({ ...module, carcass: { ...module.carcass, ...patch } })} />
                </FoldItem>
              </>
            )
          })()}
          {/* «Ferratges» (col·locats a mà i els de les regles) no surt a l'inspector del mòdul (per decisió de l'usuari,
              2026-10-08): els col·locats es conserven, es fabriquen i es veuen al 3D (on es trien i s'editen). */}
        </Stack>
      ) : null}

        {estimated.length > 0 && (
          <Alert.Root status="warning" size="sm" mt={3}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{ESTIMATED_WARNING}</Alert.Title>
              <Alert.Description>Basat en la foto: {estimated.map((a) => a.label).join(", ")}. Mesura-ho amb cinta abans de tallar.</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

        {collisions.length > 0 && (
          <FoldItem id="collisions" title="Amb l'obertura actual" icon={LuDoorOpen} defaultOpen badge={collisions.length} badgePalette="orange">
            {collisions.map((c) => (
              <Alert.Root key={c.groupId} status="warning" size="sm">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{c.message}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            ))}
          </FoldItem>
        )}

        {moduleWarnings.length > 0 && (
          <FoldItem id="warnings" title="Avisos de fusteria" icon={LuTriangleAlert} badge={moduleWarnings.length} badgePalette="orange">
            {moduleWarnings.map((w, i) => (
              <Alert.Root key={i} status={w.code === "material-heat" || w.code === "mitre" || w.code === "push" || (w.code === "inset" && w.message.startsWith("Fronts")) ? "info" : "warning"} size="sm">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>
                    {w.moduleId && comp.modules.length > 1 ? `${comp.modules.find((m) => m.id === w.moduleId)?.name ?? ""}: ` : ""}
                    {w.message}
                    {w.refId && selection.kind !== "ref" && (
                      <Button size="xs" variant="plain" ml={2} onClick={() => select({ kind: "ref", id: w.refId! })}>
                        Veure l'objecte
                      </Button>
                    )}
                    {w.zoneId && (
                      <Button
                        size="xs"
                        variant="plain"
                        ml={2}
                        onClick={() => {
                          const moduleId = w.moduleId ?? module?.id
                          if (moduleId) select({ kind: "zone", moduleId, zoneId: w.zoneId! })
                        }}
                      >
                        Anar-hi
                      </Button>
                    )}
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            ))}
          </FoldItem>
        )}
      </FoldGroup>
    </Stack>
  )


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
          newModule={(id, n) => applySettingsToModule(settings, kind === "taula" ? tableModule(id, n) : emptyModule(id, n))}
          partCenter={{ x: Math.round(size.width / 2), y: partsOnlyKind(kind) ? 0 : Math.round(size.height / 2), z: partsOnlyKind(kind) ? 0 : Math.round(size.depth + 50) }}
        />
        }
        right={inspector}
        // Mobles i objectes: el mateix xat amb les eines de cada tipus (un objecte només té peces lliures). Els `lliure`
        // d'abans (flat-pack que es fabrica) no en tenen.
        // Sense pestanya «Assistent» (per decisió de l'usuari, 2026-10-13): l'assistent personal és al menú principal
        // i fa servir aquest document pel `assistantHub`.
        center={(chrome) => (
      <Box
        ref={viewerBox}
        order={{ base: 0, md: 2 }}
        flex={{ md: 1 }}
        minW={{ base: 0, md: "320px" }}
        position="relative"
        h={formHidden ? { base: "calc(100dvh - 52px - 56px - 16px - 76px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))", md: "full" } : { base: "42vh", md: "full" }}
        // Amb els marges de la pàgina (no a tota l'amplada) i les quatre cantonades arrodonides, com el visor dels ambients.
        rounded="xl"
        overflow="hidden"
        borderWidth="1px"
        bg="bg.subtle"
      >
        {viewTab === "photo" ? (
          <Box position="absolute" inset={0} overflowY="auto" pt={14} px={3} pb={3}>
            <PhotoScreen
              projectId={projectId}
              panels={panels}
              embedded
              controlsTarget={photoControls}
              composition={comp}
              onApplyMeasure={applyMeasure}
              selectedModule={selection.kind === "module" || selection.kind === "zone" ? moduleIndex + 1 : null}
            />
          </Box>
        ) : viewTab === "elevation" ? (
          <Box position="absolute" inset={0} overflow="hidden" pt={14} px={4} pb={4} display="flex" flexDirection="column" alignItems="center" gap={2}>
            {moduleBuild && module && (
              <Box
                w="full"
                maxW="900px"
                flex={1}
                minH={0}
                display="flex"
                alignItems="center"
                // Alçada disponible per al dibuix: el visor menys la barra de pestanyes i el peu.
                css={{ "--elev-h": { base: formHidden ? "calc(100dvh - 20rem)" : "calc(42vh - 6rem)", md: "calc(100dvh - 48px - 0.75rem - 8rem)" } }}
              >
                <ElevationEditor
                  module={module}
                  build={moduleBuild}
                  selectedZoneId={selectedZone}
                  onSelectZone={(id) => select({ kind: "zone", moduleId: module.id, zoneId: id })}
                  references={comp.references}
                  moduleX={build?.modules[moduleIndex]?.x ?? 0}
                  moduleY={build?.modules[moduleIndex]?.y ?? 0}
                  neighbors={comp.modules
                    .filter((m) => m.id !== module.id)
                    .map((m) => {
                      const idx = comp.modules.indexOf(m) + 1
                      return { id: m.id, name: m.name, panels: panels.filter((p) => p.module === idx) }
                    })}
                  onSelectModule={selectModule}
                  maxH="var(--elev-h)"
                />
              </Box>
            )}
            {module ? (
              <Text fontSize="xs" color="fg.muted" textAlign="center" display={{ base: "none", md: "block" }}>
                Alçat de «{module.name}». Toca un compartiment per editar-lo; llums interiors en mm.
                {comp.modules.length > 1 && " Els mòduls del costat surten translúcids: clica'n un per passar-hi."}
              </Text>
            ) : (
              <Text fontSize="sm" color="fg.muted" textAlign="center" m="auto">
                {partsOnlyKind(kind) ? "L'alçat és dels mòduls: aquí no n'hi ha." : "Encara no hi ha cap mòdul: afegeix-ne un amb el + de «Mòduls» a l'estructura."}
              </Text>
            )}
          </Box>
        ) : (
          <CabinetViewer
            sceneFinish={comp.scene}
            panels={shownPanels}
            size={frameSize}
            exploded={exploded}
            // A la vista explosionada i amb les peces translúcides els forats i les ranures sempre es veuen.
            showHoles={showHoles || exploded || viewer.opacity < 1}
            seeThrough={viewer.opacity < 1 ? viewer.opacity : undefined}
            modules={viewerModules.filter((v) => !comp.modules.find((m) => m.id === v.id)?.hidden)}
            selectedModuleId={(selection.kind === "module" || selection.kind === "zone") && module ? module.id : null}
            onSelectModule={selectFrom3D}
            ghosts={ghosts}
            viewDir={viewDir}
            opening={viewer.opening}
            openOnly={openOnly}
            materialMode={viewerState.materialMode}
            materials={settings.materials}
            onCapture={registerCapture}
            quality={quality}
            onDeselect={() => select({ kind: "moble" })}
            selectedRefId={selection.kind === "ref" ? selection.id : selection.kind === "part" && cutPartIds.has(selection.id) ? `part:${selection.id}` : null}
            collidingRefIds={collidingRefs}
            cuttingRefIds={cuttingRefs}
            highlightZone={highlightZone}
            onSelectRef={(id) => pick(id.startsWith("part:") ? { kind: "part", id: id.slice(5) } : { kind: "ref", id })}
            fitKey={fitKey}
            onFramedChange={setFramed}
            initialCamera={cameraRef.current}
            onCameraChange={saveCamera}
            cameraGoto={cameraGoto}
            onMoveRef={selectionLocked ? undefined : (id, pos) => (id.startsWith("part:") ? movePart(id.slice(5), pos) : moveRef(id, pos))}
            hardware={hardware}
            onSceneAccess={registerScene}
            parts={solidParts}
            selectedPartId={selection.kind === "part" ? selection.id : null}
            onSelectPart={selectPartFrom3D}
            selectedGroup={selection.kind === "group" ? selection.id : null}
            onMoveGroup={selectionLocked ? undefined : (g, dx, dy, dz) => moveGroup(g, dx, dy, dz)}
            selectedSet={selection.kind === "multi" ? selection.items : undefined}
            onMoveSet={selectionLocked || selection.kind !== "multi" ? undefined : (dx, dy, dz) => setComp((c) => moveMultiBy(c, selection.items, dx, dy, dz))}
            onMovePart={selectionLocked ? undefined : movePart}
            models={comp.models?.filter((g) => !g.hidden)}
            selectedModelId={selection.kind === "model" ? selection.id : null}
            onSelectModel={(id) => {
              if (shiftRef.current) return pick({ kind: "model", id })
              // Com les peces: el primer clic a un model d'un grup tria el grup; el segon, el model.
              const g = comp.models?.find((m) => m.id === id)?.group
              const inside = g && ((selection.kind === "group" && selection.id === g) || (selection.kind === "model" && comp.models?.find((m) => m.id === selection.id)?.group === g))
              select(g && !inside ? { kind: "group", id: g } : { kind: "model", id })
            }}
            selectedHardwareId={selection.kind === "hardware" ? selection.id : null}
            onSelectHardware={(id) => select({ kind: "hardware", id })}
            onMoveModel={selectionLocked ? undefined : moveModel}
            onMoveModule={selectionLocked ? undefined : (id, dx, dy, all, dz) => setComp((c) => (all ? moveAllBy(c, dx) : moveModuleBy(c, id, dx, dy, dz)))}
          />
        )}
        {viewTab === "3d" && viewerState.materialMode === "role" && (
          <Box position="absolute" bottom={3} left={3} zIndex={2} display={{ base: "none", md: "block" }}>
            <RoleLegend panels={shownPanels} />
          </Box>
        )}
        {/* La recepta del SegmentGroup força position: relative; el posicionem amb un embolcall. */}
        <Box position="absolute" top={3} left="50%" transform="translateX(-50%)" zIndex={2}>
          <SegmentGroup.Root size="sm" bg="bg.panel" value={viewTab} onValueChange={(e) => e.value && setViewTab(e.value as ViewTab)}>
            <SegmentGroup.Indicator />
            {(
              [
                ["3d", "3D", LuBox, "Composició en 3D"],
                ["elevation", "Alçat", LuLayoutPanelLeft, "Alçat frontal del mòdul (compartiments)"],
                ["photo", "Foto", LuCamera, "Composició sobre la foto"],
              ] as const
            ).map(([v, label, Icon, aria]) => (
              <SegmentGroup.Item key={v} value={v} aria-label={aria}>
                <SegmentGroup.ItemText>
                  <HStack gap={1.5}>
                    <Icon /> {!viewerNarrow && <Box display={{ base: "none", sm: "inline" }}>{label}</Box>}
                  </HStack>
                </SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
            ))}
          </SegmentGroup.Root>
        </Box>
        {/* Mòbil: ampliar el visor (amaga les pestanyes de sota). */}
        <IconButton
          position="absolute"
          top={3}
          left={3}
          zIndex={2}
          display={{ base: "inline-flex", md: "none" }}
          aria-label={formHidden ? "Mostrar els panells" : "Ampliar el visor"}
          aria-expanded={!formHidden}
          size="sm"
          variant="surface"
          colorPalette="wood"
          onClick={() => setFormHidden((v) => !v)}
        >
          {formHidden ? <LuMinimize2 /> : <LuMaximize2 />}
        </IconButton>
        {/* Ordinador: plegar/desplegar l'arbre (esquerra) i les propietats (dreta). */}
        {chrome}
        {/* Botons del visor: en fila a dalt; si el visor és estret, en columna a la dreta
            (com les barres d'eines dels programes de CAD) perquè no tapin les pestanyes. */}
        <Stack
          position="absolute"
          top={3}
          right={{ base: 3, md: 14 }}
          gap={2}
          zIndex={2}
          direction="row"
          display={viewTab === "3d" ? "flex" : "none"}
        >
          <RenderDialog open={renderOpen} onClose={() => setRenderOpen(false)} getScene={() => sceneGetter.current?.() ?? null} name={name} saveKey={`moble:${projectId}`} />
          <ArDialog open={arOpen} onClose={() => setArOpen(false)} panels={viewerPanels} name={name} models={build?.models} />
          {/* Al mòbil, un calaix de baix amb el seu propi desplaçament; a l'ordinador, un popover. */}
          <ViewOptions lead={viewModes} tiles={viewTiles} open={viewOptsOpen} onOpenChange={setViewOptsOpen}>
            <Box pt={3} borderTopWidth="1px">
              <ViewerControls state={viewerState} onChange={setViewer} onView={(v) => frameFrom(v)} hasMoving={groups.length > 0} hasSelectedZone={!!zoneRect} onImage={() => void downloadImage()} />
            </Box>
          </ViewOptions>
        </Stack>
      </Box>
        )}
      />
    </>
  )
}

/**
 * Les potes d'un mòdul al visor: on van (`inset` de la pota triada, si n'hi ha) i si ja es dibuixen amb el model de la
 * pota importada (la base en porta els `fittings`): aleshores no es dibuixen les genèriques.
 */
function legsView(base: { height: number; hardware?: HardwareItem }, depth: number, panels: Panel[], bottom?: Panel): { height: number; depth: number; inset?: number; fitted?: boolean; points?: [number, number][] } {
  const inset = base.hardware?.engine === "leg" ? base.hardware.params.inset : undefined
  const fitted = panels.some((p) => p.fittings?.some((f) => f.kind === "leg"))
  // Base retallada per una columna: les potes a les cantonades que queden (no a l'osca).
  const points = bottom ? legPoints(bottom, inset ?? 50) : undefined
  return { height: base.height, depth, ...(inset !== undefined ? { inset } : {}), ...(fitted ? { fitted } : {}), ...(points ? { points } : {}) }
}

