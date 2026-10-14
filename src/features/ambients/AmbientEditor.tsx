import { Alert, Badge, Box, Button, Dialog, Editable, Flex, HStack, IconButton, Menu, Portal, SegmentGroup, Slider, Stack, Switch, Text } from "@chakra-ui/react"
import { shrinkImage } from "../imageShrink"
import { blobToBase64 } from "../file/mobleIo"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  LuBox,
  LuMove,
  LuMoveDiagonal,
  LuPalette,
  LuBrickWall,
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuGrid3X3,
  LuGroup,
  LuHouse,
  LuImage,
  LuLayers,
  LuMagnet,
  LuRuler,
  LuSun,
  LuTag,
  LuUngroup,
  LuExternalLink,
  LuImageUp,
  LuMap,
  LuMousePointer2,
  LuPencilRuler,
  LuPenTool,
  LuPlus,
  LuRotate3D,
  LuRotateCcw,
  LuRotateCw,
  LuSofa,
  LuAperture,
  LuTrash2,
  LuVideo,
  LuEye,
  LuAppWindow,
  LuDoorOpen,
  LuPanelTop,
  LuLock,
  LuLockOpen,
  LuUndoDot,
  LuTriangleAlert,
  LuAlignCenterHorizontal,
  LuAlignCenterVertical,
  LuAlignEndHorizontal,
  LuAlignEndVertical,
  LuAlignHorizontalDistributeCenter,
  LuAlignHorizontalSpaceAround,
  LuAlignStartHorizontal,
  LuAlignStartVertical,
  LuAlignVerticalDistributeCenter,
  LuAlignVerticalSpaceAround,
} from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { RenderDialog, type SceneGetter } from "../../components/viewer/render/RenderDialog"
import { Tooltip } from "../../components/ui/tooltip"
import {
  BlockShapeSchema,
  OPENING_DEFAULTS,
  addOpening,
  clampOpening,
  type Opening,
  type Composition,
  CompositionSchema,
  duplicateItems,
  sameCameraPose,
  pasteItems,
  parseAmbientClip,
  type AmbientClip,
  groupIds,
  moveItems,
  newItemGroupName,
  removeItems,
  rotateItems,
  setItemGroup,
  newId,
  parseAmbient,
  resizeComposition,
  setWallEnds,
  wallLength,
  type Ambient,
  ambientSummary,
  type AmbientItemKind,
  type AmbientSummary,
  type CameraPose,
  type AmbientItem,
  type BlockItem,
  type MaterialPref,
  type PlanPt,
  type Wall,
  alignItems,
  distributeItems,
  footprintBox,
  keepLocked,
  mergeHidden,
  moveItemToGroup,
  reorderItems,
  withFlag,
  type ViewFlags,
} from "../../core/model"
import { compositionOf, updateProjectComposition } from "../../db/compositionStore"
import { createProject, db, saveAmbientCamera, updateAmbient, type Project } from "../../db/db"
import { TopBarActions } from "../../components/TopBar"
import { uniqueName } from "../../core/file/mobleFile"
import { AmbientPicker } from "./AmbientPicker"
import { isObject } from "../objects/isObject"
import { useLiveQuery } from "../../db/useLiveQuery"
import { NumRow } from "../../components/NumRow"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { FoldItem } from "../../components/Fold"
import { Workspace } from "../../components/Workspace"
import { ViewOptions, ViewTile } from "../../components/ViewOptions"
import { usePersistentFlag } from "../usePersistentFlag"
import { useWorkspace } from "../../components/useWorkspace"
import { MaterialSelect } from "../settings/MaterialSelect"
import { useSettings } from "../settings/SettingsContext"
import { formatLength, useUnit } from "../units"
import { useProjects } from "../useProject"
import { Ambient3D } from "./Ambient3D"
import { isEmptyGeometry, itemName, useItemGeometries, type ItemGeometry } from "./ambientData"
import { PlanCanvas } from "./PlanCanvas"
import { AMBIENT_TAB_KEY, ambientBox, type Selection, type Tool } from "./planGeom"
import { useDebouncedSave } from "../useDebouncedSave"
import { useHistory, useUndoKeys } from "../history/useHistory"
import { UndoRedo } from "../../components/UndoRedo"
import { TreeRow, TreeRowMenu, TreeSection, type TreeRowDnd, type TreeRowFlags } from "../../components/TreeRow"
import type { ChatTarget } from "../assistant/chatTarget"
import { registerDoc } from "../assistant/assistantHub"

/** Xat de l'assistent IA (docs/xat-ia.md): a demanda, el primer cop que s'obre la pestanya «Assistent». */

const AMBIENT_SUGGESTIONS = [
  "Fes-me una habitació de 4 × 3 m (per dins) amb una finestra de 1200 a la paret de dalt i una porta de 800 a la de la dreta.",
  "Posa el moble de TV arrambat a la paret de dalt, centrat.",
  "Afegeix un sofà de 3 places del catàleg davant de la TV, a 2,5 m, mirant-la.",
  "Llegeix aquest plànol i fes-ne les parets, les finestres i les portes.",
]

const TOOLS: { id: Tool; label: string; key: string; icon: typeof LuPenTool }[] = [
  { id: "select", label: "Seleccionar i moure", key: "V", icon: LuMousePointer2 },
  { id: "wall", label: "Paret (ploma)", key: "P", icon: LuPenTool },
  { id: "room", label: "Habitació (rectangle)", key: "H", icon: LuBrickWall },
  { id: "window", label: "Finestra (clic a una paret)", key: "F", icon: LuAppWindow },
  { id: "door", label: "Porta (clic a una paret)", key: "D", icon: LuDoorOpen },
]

const SHAPE_LABEL: Record<BlockItem["shape"], string> = { box: "Caixa", sofa: "Sofà", bed: "Llit", table: "Taula" }
/** Porta-retalls dels ambients (`AmbientClip`), compartit entre ambients. */
const AMBIENT_CLIP_KEY = "mobles:ambient-clipboard"

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
  const unit = useUnit()
  const projects = useProjects()
  // Ambient amb desfer/refer (`useHistory`, fins a 100 passos; la càmera es desa a part, fora del desfer).
  // Les mides generals d'un moble o objecte enllaçat també són un pas (per decisió de l'usuari: ⌘Z ho ha de desfer tot):
  // l'historial porta, a més de l'ambient, la composició de cada moble que s'hi ha canviat (`linked`).
  const history = useHistory<{ amb: Ambient; linked?: Record<number, Composition> }>({ amb: initial }, { limit: 100 })
  const { set: setDoc, undo, redo } = history
  const amb = history.value.amb
  const setAmb = useCallback((next: Ambient, opts?: { commit?: boolean }) => setDoc((h) => ({ ...h, amb: next }), opts), [setDoc])
  // La composició d'abans del primer canvi de cada moble (desfer fins al principi hi torna) i la que hi ha ara desada.
  const linkedOrig = useRef(new Map<number, Composition>())
  const linkedSaved = useRef(new Map<number, Composition>())
  const resizeLinked = useCallback((id: number, before: Composition, next: Composition) => {
    if (!linkedOrig.current.has(id)) linkedOrig.current.set(id, before)
    setDoc((h) => ({ ...h, linked: { ...h.linked, [id]: next } }))
  }, [setDoc])
  const linked = history.value.linked
  useEffect(() => {
    // Desfer o refer: cada moble tocat, a la composició del pas (o a la d'abans de tocar-lo).
    for (const [id, orig] of linkedOrig.current) {
      const want = linked?.[id] ?? orig
      if (linkedSaved.current.get(id) === want) continue
      linkedSaved.current.set(id, want)
      void updateProjectComposition(id, want)
    }
  }, [linked])
  const [sel, setSel] = useState<Selection>(null)
  const [tool, setTool] = useState<Tool>("select")
  // La vista (Plànol · 3D) es recorda; els ambients del catàleg s'obren al 3D.
  const [tab, setTabState] = useState<"plan" | "3d">(() => {
    try {
      return localStorage.getItem(AMBIENT_TAB_KEY) === "3d" ? "3d" : "plan"
    } catch {
      return "plan"
    }
  })
  const setTab = (t: "plan" | "3d") => {
    setTabState(t)
    try {
      localStorage.setItem(AMBIENT_TAB_KEY, t)
    } catch {
      /* sense emmagatzematge */
    }
  }
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
  // Opcions de vista (recordades), com a l'editor.
  const [showGrid, setShowGrid] = usePersistentFlag("mobles:ambient-grid", true)
  const [showDims, setShowDims] = usePersistentFlag("mobles:ambient-dims", true)
  const [showLabels, setShowLabels] = usePersistentFlag("mobles:ambient-labels", true)
  const [showDetail, setShowDetail] = usePersistentFlag("mobles:ambient-detail", true)
  const [snapOn, setSnapOn] = usePersistentFlag("mobles:ambient-snap", true)
  const [showPlan, setShowPlan] = usePersistentFlag("mobles:ambient-plan", true)
  const [dollhouse, setDollhouse] = usePersistentFlag("mobles:ambient-dollhouse", true)
  const [shadows, setShadows] = usePersistentFlag("mobles:ambient-shadows", true)
  const [ceiling, setCeiling] = usePersistentFlag("mobles:ambient-ceiling", true)
  // Seleccionar porta a Propietats al mòbil (com a l'editor).
  const select = (x: Selection) => {
    setSel(x)
    if (x) ws.setMobilePane("props")
  }
  const [objPicker, setObjPicker] = useState(false)
  // Render (path tracing per GPU o CPU), el mateix de l'editor.
  const [renderOpen, setRenderOpen] = useState(false)
  // «Opcions de vista» obert: es tanca en obrir el Render (si no, el popover o el calaix quedaven a sobre).
  const [viewOptsOpen, setViewOptsOpen] = useState(false)
  const sceneGetter = useRef<SceneGetter | null>(null)
  const onSceneAccess = useCallback((g: SceneGetter) => {
    sceneGetter.current = g
  }, [])

  // Desar (esperant una mica mentre s'arrossega; el que queda pendent, en sortir). Obrir-lo no el desa.
  useDebouncedSave(amb, (a) => void updateAmbient(ambientId, { data: a }))
  // Última càmera del 3D: es desa a part (sense tocar la data ni el desfer) i el 3D hi torna en obrir-se.
  const cameraRef = useRef(initial.camera)
  // Càmeres d'abans (per decisió de l'usuari: buscant l'enquadrament del render, un cop de ratolí la movia i es perdia):
  // «Càmera d'abans» hi torna; i es pot bloquejar (es recorda per ambient).
  const camPast = useRef<CameraPose[]>([])
  const [camBack, setCamBack] = useState(0)
  const [camGoto, setCamGoto] = useState<{ pose: CameraPose; n: number } | undefined>(undefined)
  const going = useRef(false)
  const [camLocked, setCamLocked] = usePersistentFlag(`mobles:ambient-camera-lock:${ambientId}`, false)
  const saveCamera = useCallback(
    (c: CameraPose) => {
      const prev = cameraRef.current
      if (prev && !going.current && !sameCameraPose(prev, c)) {
        camPast.current = [...camPast.current.slice(-29), prev]
        setCamBack(camPast.current.length)
      }
      going.current = false
      cameraRef.current = c
      void saveAmbientCamera(ambientId, c)
    },
    [ambientId],
  )
  const cameraBack = () => {
    const prev = camPast.current.pop()
    setCamBack(camPast.current.length)
    if (!prev) return
    going.current = true
    setCamGoto((g) => ({ pose: prev, n: (g?.n ?? 0) + 1 }))
  }

  // Canvi de l'ambient: `commit` = un pas de desfer (en deixar anar); si no, en viu (arrossegant).
  // El cadenat de l'arbre: els elements i les parets bloquejats no es mouen, vingui d'on vingui el canvi.
  const change = useCallback(
    (next: Ambient, commit: boolean) => {
      const prev = ambRef.current
      setAmb({ ...next, items: keepLocked(prev.items, next.items, ["x", "y", "rot", "elevation"]), walls: keepLocked(prev.walls, next.walls, ["a", "b"]) }, { commit })
    },
    [setAmb],
  )
  // Assistent IA: llegeix l'ambient d'ara i hi aplica els canvis en viu; en acabar el torn, un sol pas de desfer.
  const ambRef = useRef(amb)
  useEffect(() => {
    ambRef.current = amb
  })
  const getAmb = useCallback(() => ambRef.current, [])
  const applyLive = useCallback((next: Ambient) => setAmb(next, { commit: false }), [setAmb])
  const commitLive = history.commit
  const assistantTarget = useMemo(() => {
    const target: ChatTarget<Ambient> = {
      getDoc: getAmb,
      apply: applyLive,
      commit: commitLive,
      toolset: () => import("../assistant/ambientLibrary").then((m) => m.ambientAssistantToolSet(settings)),
      intro: "Demana-li que faci o canviï l'ambient obert: parets, finestres i portes, col·locar mobles i objectes (els teus o del catàleg), grups i materials (mides en mm). Pots adjuntar un plànol o una foto: llegirà les cotes i demanarà les que no es vegin.",
      suggestions: AMBIENT_SUGGESTIONS,
    }
    return target as unknown as ChatTarget<unknown>
  }, [settings, getAmb, applyLive, commitLive])
  // Dreceres de desfer/refer, les mateixes que a l'editor (`undoKeyAction`: no amb un diàleg modal obert).
  useUndoKeys(undo, redo)

  const geos = useItemGeometries(amb.items, projects)
  const names = useMemo(() => new Map(amb.items.map((it) => [it.id, itemName(it, projects)])), [amb.items, projects])
  const isObjItem = (it: AmbientItem) => it.kind === "block" || !!projects?.some((p) => p.id === it.projectId && isObject(p))
  // Assistent personal: aquest ambient s'hi registra amb les seves eines i què hi ha seleccionat (llegit en el moment).
  const describeSel = useRef<() => string | undefined>(() => undefined)
  describeSel.current = () => {
    if (sel?.kind === "item") {
      const it = amb.items.find((i) => i.id === sel.id)
      return it ? `element ${it.kind === "moble" ? `(moble enllaçat, project_id ${it.projectId})` : "(bloc)"} (id ${it.id})` : undefined
    }
    if (sel?.kind === "group") return `grup «${sel.id}»`
    if (sel?.kind === "multi") return `${sel.ids.length} elements (ids ${sel.ids.join(", ")})`
    if (sel?.kind === "wall") {
      const n = amb.walls.findIndex((w) => w.id === sel.id)
      return n >= 0 ? `Paret ${n + 1} (id ${sel.id})` : undefined
    }
    return undefined
  }
  useEffect(() => registerDoc({ key: `ambient:${ambientId}`, kind: "ambient", id: ambientId, name, target: assistantTarget, selection: () => describeSel.current() }), [assistantTarget, ambientId, name])
  const item = sel?.kind === "item" ? amb.items.find((i) => i.id === sel.id) : undefined
  const wall = sel?.kind === "wall" ? amb.walls.find((w) => w.id === sel.id) : undefined
  // Un moble enllaçat que ja no és a la llista surt com a absent (mentre la llista es llegeix, encara no).
  const kindOf = (it: AmbientItem): AmbientItemKind =>
    it.kind === "block" ? "object" : !projects ? "moble" : !projects.some((p) => p.id === it.projectId) ? "missing" : isObjItem(it) ? "object" : "moble"
  const summary = ambientSummary(amb, kindOf)
  // Parets: un grup plegable a l'arbre (com els grups de l'editor); s'obre sol en triar-ne una al plànol.
  const [wallsOpen, setWallsOpen] = useState(false)
  const [lastWall, setLastWall] = useState<string | undefined>(undefined)
  if (wall?.id !== lastWall) {
    setLastWall(wall?.id)
    if (wall) setWallsOpen(true)
  }

  const center = (): PlanPt => {
    const b = ambientBox({ ...amb, items: [] }, geos)
    return b ? [Math.round((b.x0 + b.x1) / 2), Math.round((b.y0 + b.y1) / 2)] : [2000, 1500]
  }
  const addItem = (raw: AmbientItem) => {
    // Cada element nou, una mica desplaçat perquè no quedin tots un sobre l'altre.
    const k = amb.items.length % 6
    const it = { ...raw, x: raw.x + k * 250, y: raw.y + k * 250 }
    change({ ...amb, items: [...amb.items, it] }, true)
    setSel({ kind: "item", id: it.id })
    setTool("select")
  }
  const addMoble = (p: Project) => {
    const [x, y] = center()
    addItem({ id: newId("i"), kind: "moble", projectId: p.id, x, y, rot: 0 })
  }

  const patchItem = (id: string, patch: Partial<AmbientItem>, commit = true) => change({ ...amb, items: amb.items.map((it) => (it.id === id ? ({ ...it, ...patch } as AmbientItem) : it)) }, commit)
  const patchWall = (id: string, patch: Partial<Wall>) => change({ ...amb, walls: amb.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) }, true)
  // Elements seleccionats: un, o tots els del grup (les accions valen per a tots dos casos).
  // Després de desfer, la selecció pot apuntar a un element que ja no hi és: llavors no es fa res (si no,
  // una fletxa o Supr afegien un pas buit de desfer i es perdia el refer).
  const selIds = sel?.kind === "item" ? (amb.items.some((i) => i.id === sel.id) ? [sel.id] : []) : sel?.kind === "group" ? groupIds(amb, sel.id) : sel?.kind === "multi" ? sel.ids.filter((id) => amb.items.some((i) => i.id === id)) : []
  // L'ambient és el seleccionat quan no n'hi ha cap altre (clic al buit, Esc, la fila de dalt de l'arbre): com el moble a
  // l'editor. Una selecció que ja no hi és (després de desfer) també torna a l'ambient.
  const ambientSel = !item && !((sel?.kind === "group" || sel?.kind === "multi") && selIds.length) && !wall
  const remove = () => {
    if (!sel) return
    if (sel.kind === "wall" ? !amb.walls.some((w) => w.id === sel.id) : !selIds.length) return setSel(null)
    if (sel.kind === "wall") change({ ...amb, walls: amb.walls.filter((w) => w.id !== sel.id) }, true)
    else change(removeItems(amb, selIds), true)
    setSel(null)
  }
  const duplicate = () => {
    if (!selIds.length) return
    const d = duplicateItems(amb, selIds)
    change(d.ambient, true)
    setSel(d.group ? { kind: "group", id: d.group } : { kind: "item", id: d.ids[0]! })
  }
  // Copiar · retallar · enganxar (Ctrl/⌘ C · X · V; també entre ambients: localStorage, validat en llegir-lo).
  const pastes = useRef(0)
  const copy = (cut: boolean) => {
    if (!selIds.length) return
    const clip: AmbientClip = { kind: "ambient-items", items: amb.items.filter((i) => selIds.includes(i.id)) }
    try {
      localStorage.setItem(AMBIENT_CLIP_KEY, JSON.stringify(clip))
    } catch {
      return
    }
    pastes.current = 0
    if (cut) {
      change(removeItems(amb, selIds), true)
      setSel(null)
    }
  }
  const paste = () => {
    let clip: AmbientClip | null = null
    try {
      clip = parseAmbientClip(JSON.parse(localStorage.getItem(AMBIENT_CLIP_KEY) ?? "null"))
    } catch {
      clip = null
    }
    if (!clip) return
    // Si els originals hi són (copiats d'aquí), la còpia es desplaça; d'un altre ambient o retallats, al mateix lloc.
    const here = clip.items.some((c) => amb.items.some((i) => i.id === c.id))
    const r = pasteItems(amb, clip.items, 300 * (pastes.current + (here ? 1 : 0)))
    pastes.current++
    change(r.ambient, true)
    setSel(r.group ? { kind: "group", id: r.group } : { kind: "item", id: r.ids[0]! })
  }
  const rotate = (deg: number) => selIds.length && change(rotateItems(amb, selIds, deg), true)
  const nudge = (dx: number, dy: number) => selIds.length && change(moveItems(amb, selIds, dx, dy), true)
  /** Clic a un element (plànol o 3D), com Figma: si és d'un grup, el primer clic tria el grup i el segon, l'element. */
  const pickItem = (id: string): string[] => {
    // Maj + clic: afegeix o treu l'element de la selecció (com a l'editor).
    if (shiftRef.current) return toggleSel(id)
    const it = amb.items.find((i) => i.id === id)
    if (it?.group && !(sel?.kind === "group" && sel.id === it.group) && !(sel?.kind === "item" && sel.id === id)) {
      select({ kind: "group", id: it.group })
      return groupIds(amb, it.group)
    }
    rangeAnchor.current = id
    select({ kind: "item", id })
    return [id]
  }
  const groupSel = (name: string) => select({ kind: "group", id: name })
  // La petjada de cada element al plànol (alinear i repartir la selecció múltiple): la del moble buit, 600 × 600.
  const boxOf = (i: AmbientItem) => {
    const g = geos.get(i.id)
    return g ? (isEmptyGeometry(g) ? footprintBox(i.x, i.y, 600, 600, i.rot) : footprintBox(i.x, i.y, g.w, g.d, i.rot)) : null
  }
  // Maj + clic (arbre, plànol o 3D): la tecla del clic (`pointerdown`), no cap estat desat.
  // `shiftRef` = afegir o treure (Maj o ⌘/Ctrl); `rangeRef` = Maj, que a l'arbre tria el tram (com el Finder).
  const shiftRef = useRef(false)
  const rangeRef = useRef(false)
  const rangeAnchor = useRef<string | null>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      shiftRef.current = e.shiftKey || e.metaKey || e.ctrlKey
      rangeRef.current = e.shiftKey && !e.metaKey && !e.ctrlKey
    }
    window.addEventListener("pointerdown", down, true)
    return () => window.removeEventListener("pointerdown", down, true)
  }, [])
  // Clic a una fila de l'arbre: Maj = del darrer triat a aquest (en l'ordre del seu apartat); ⌘/Ctrl = afegir o treure.
  const treeClick = (id: string, order: string[]) => {
    const a = rangeAnchor.current
    // Un que ja és a la selecció múltiple: Maj + clic el treu (només aquest).
    if (rangeRef.current && a && order.includes(a) && a !== id && !(sel?.kind === "multi" && selIds.includes(id))) {
      const i = order.indexOf(a), j = order.indexOf(id)
      const ids = order.slice(Math.min(i, j), Math.max(i, j) + 1)
      select({ kind: "multi", ids })
      return
    }
    rangeAnchor.current = id
    if (shiftRef.current) toggleSel(id)
    else select({ kind: "item", id })
  }
  const toggleSel = (id: string): string[] => {
    const next = selIds.includes(id) ? selIds.filter((x) => x !== id) : [...selIds, id]
    if (next.length > 1) select({ kind: "multi", ids: next })
    else if (next.length === 1) select({ kind: "item", id: next[0]! })
    else select(null)
    return next
  }

  // Arbre: dos apartats, **Mobles** i **Objectes** (com «Peces lliures» i «Models 3D» de l'editor), cadascun amb els seus
  // elements i els grups (en l'ordre del primer element) amb els seus a dins. Un grup amb mobles i objectes surt als dos
  // apartats, a cadascun amb els seus; triar-lo tria tot el grup. Els blocs d'abans van amb els objectes; un moble que ja no
  // hi és, amb els mobles.
  const [folded, setFolded] = useState<string[]>([])
  type ListRow = { kind: "group"; name: string; items: AmbientItem[] } | { kind: "item"; item: AmbientItem }
  const rowsOf = (list: AmbientItem[]): ListRow[] => {
    const out: ListRow[] = []
    for (const it of list) {
      if (!it.group) out.push({ kind: "item", item: it })
      else if (!out.some((r) => r.kind === "group" && r.name === it.group)) out.push({ kind: "group", name: it.group, items: list.filter((x) => x.group === it.group) })
    }
    return out
  }
  // L'ull i el cadenat (com Figma): de cada element, de cada paret i, als grups, de tots els seus.
  const flipItems = (ids: string[], flag: keyof ViewFlags, on: boolean) => change({ ...amb, items: amb.items.map((it) => (ids.includes(it.id) ? withFlag(it, flag, on) : it)) }, true)
  const itemFlags = (it: AmbientItem): TreeRowFlags => ({ hidden: it.hidden, locked: it.locked, onHide: () => flipItems([it.id], "hidden", !it.hidden), onLock: () => flipItems([it.id], "locked", !it.locked) })
  const groupFlagsOf = (name: string): TreeRowFlags => {
    const ids = groupIds(amb, name)
    const its = amb.items.filter((it) => ids.includes(it.id))
    const hidden = its.every((it) => it.hidden)
    const locked = its.every((it) => it.locked)
    return { hidden, locked, onHide: () => flipItems(ids, "hidden", !hidden), onLock: () => flipItems(ids, "locked", !locked) }
  }
  const flipWall = (id: string, flag: keyof ViewFlags, on: boolean) => change({ ...amb, walls: amb.walls.map((w) => (w.id === id ? withFlag(w, flag, on) : w)) }, true)
  // L'ull: el plànol i el 3D només veuen el que no està amagat; el que hi canvien es torna a ajuntar amb els amagats.
  const shownAmb = useMemo(() => (amb.items.some((it) => it.hidden) || amb.walls.some((w) => w.hidden) ? { ...amb, items: amb.items.filter((it) => !it.hidden), walls: amb.walls.filter((w) => !w.hidden) } : amb), [amb])
  const changeShown = useCallback(
    (next: Ambient, commit: boolean) => {
      const all = ambRef.current
      change({ ...next, items: mergeHidden(all.items, all.items.filter((it) => !it.hidden), next.items), walls: mergeHidden(all.walls, all.walls.filter((w) => !w.hidden), next.walls) }, commit)
    },
    [change],
  )
  // L'ordre de l'arbre de l'apartat d'un element (Mobles o Objectes; els grups, on surt el primer dels seus).
  const sectionOrder = (it: AmbientItem): string[] => {
    const obj = kindOf(it) === "object"
    return rowsOf(amb.items.filter((x) => (kindOf(x) === "object") === obj)).flatMap((r) => (r.kind === "item" ? [r.item.id] : r.items.map((x) => x.id)))
  }
  const objectItems = amb.items.filter((it) => kindOf(it) === "object")
  const mobleItems = amb.items.filter((it) => kindOf(it) !== "object")
  const groups = [...new Set(amb.items.map((i) => i.group).filter((g): g is string => !!g))]
  // Arrossegar per ordenar i per posar dins d'un grup (com les peces lliures de l'editor): una fila d'element o un grup
  // sencer; deixat al costat d'un element, n'agafa el grup; sobre la fila d'un grup, hi entra.
  const [drag, setDrag] = useState<{ ids: string[]; key: string } | null>(null)
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null)
  const endDrag = () => (setDrag(null), setOver(null))
  const itemDnd = (it: AmbientItem): TreeRowDnd => {
    const ok = () => !!drag && !drag.ids.includes(it.id)
    return {
      dragging: !!drag?.ids.includes(it.id),
      indicator: over?.id === it.id && ok() ? (over.after ? "after" : "before") : null,
      onStart: () => setDrag({ ids: [it.id], key: it.id }),
      onOver: (after) => {
        if (!ok()) return false
        if (over?.id !== it.id || over.after !== after) setOver({ id: it.id, after })
        return true
      },
      onDrop: (after) => {
        if (drag && ok()) change(reorderItems(amb, drag.ids, it.id, after), true)
        endDrag()
      },
      onEnd: endDrag,
    }
  }
  const groupDnd = (name: string): TreeRowDnd => {
    const key = `g:${name}`
    // Un element d'un altre grup (o solt) hi entra; el grup sencer s'arrossega des de la seva fila.
    const ok = () => !!drag && drag.ids.length === 1 && amb.items.find((i) => i.id === drag.ids[0])?.group !== name
    return {
      dragging: drag?.key === key,
      indicator: over?.id === key && ok() ? "inside" : null,
      onStart: () => setDrag({ ids: groupIds(amb, name), key }),
      onOver: () => {
        if (!ok()) return false
        if (over?.id !== key) setOver({ id: key, after: false })
        return true
      },
      onDrop: () => {
        if (drag && ok()) change(moveItemToGroup(amb, drag.ids[0]!, name), true)
        endDrag()
      },
      onEnd: endDrag,
    }
  }
  const dragOutOfGroup = drag && drag.ids.length === 1 ? amb.items.find((i) => i.id === drag.ids[0])?.group : undefined
  const itemRow = (it: AmbientItem, depth: number) => {
    const g = geos.get(it.id)
    const missing = kindOf(it) === "missing"
    const label = names.get(it.id) ?? ""
    return (
      <TreeRow
        key={it.id}
        depth={depth}
        icon={missing ? <LuTriangleAlert /> : isObjItem(it) ? <LuSofa /> : <LuBox />}
        iconColor={missing ? "fg.error" : isObjItem(it) ? "fg.muted" : "wood.fg"}
        label={label}
        hint={isEmptyGeometry(g) ? "Buit" : g ? `${Math.round(g.w)} × ${Math.round(g.d)}` : undefined}
        selected={(sel?.kind === "item" && sel.id === it.id) || (sel?.kind === "multi" && sel.ids.includes(it.id))}
        highlighted={sel?.kind === "group" && sel.id === it.group}
        onClick={() => (treeClick(it.id, sectionOrder(it)), setTool("select"))}
        flags={itemFlags(it)}
        dnd={itemDnd(it)}
        menu={
          <TreeRowMenu label={`Accions de «${label}»`}>
            <Menu.Item value="dup" onClick={() => {
              const d = duplicateItems(amb, [it.id])
              change(d.ambient, true)
              select({ kind: "item", id: d.ids[0]! })
            }}>
              <LuCopy /> Duplicar
            </Menu.Item>
            <Menu.Item value="new-group" onClick={() => {
              const name = newItemGroupName(amb)
              change(setItemGroup(amb, [it.id], name), true)
              groupSel(name)
            }}>
              <LuGroup /> Grup nou
            </Menu.Item>
            {groups.filter((gname) => gname !== it.group).map((gname) => (
              <Menu.Item key={gname} value={`to:${gname}`} onClick={() => change(setItemGroup(amb, [it.id], gname), true)}>
                <LuGroup /> Posar a «{gname}»
              </Menu.Item>
            ))}
            {it.group && (
              <Menu.Item value="out" onClick={() => change(setItemGroup(amb, [it.id], undefined), true)}>
                <LuUngroup /> Treure del grup
              </Menu.Item>
            )}
            {it.kind === "moble" && projects?.some((p) => p.id === it.projectId) && (
              <Menu.Item value="open" onClick={() => onOpenProject(it.projectId)}>
                <LuExternalLink /> Obrir a l'editor
              </Menu.Item>
            )}
            <Menu.Separator />
            <Menu.Item value="del" color="fg.error" onClick={() => {
              change(removeItems(amb, [it.id]), true)
              if (sel?.kind === "item" && sel.id === it.id) setSel(null)
            }}>
              <LuTrash2 /> Treure de l'ambient
            </Menu.Item>
          </TreeRowMenu>
        }
      />
    )
  }

  /** Fila de l'arbre: un element o un grup (plegable, amb els seus elements de l'apartat `section` a dins). */
  const listRow = (r: ListRow, section: "moble" | "object") => {
    if (r.kind === "item") return itemRow(r.item, 1)
    const fold = `${section}:${r.name}`
    const open = !folded.includes(fold)
    return (
      <Box key={`g:${section}:${r.name}`}>
        <TreeRow
          depth={1}
          icon={open ? <LuChevronDown /> : <LuChevronRight />}
          onToggle={() => setFolded(open ? [...folded, fold] : folded.filter((f) => f !== fold))}
          toggleLabel={open ? `Plegar «${r.name}»` : `Desplegar «${r.name}»`}
          label={r.name}
          hint={`${r.items.length} ${section === "moble" ? (r.items.length === 1 ? "moble" : "mobles") : r.items.length === 1 ? "objecte" : "objectes"}`}
          selected={sel?.kind === "group" && sel.id === r.name}
          onClick={() => (groupSel(r.name), setTool("select"))}
          flags={groupFlagsOf(r.name)}
          dnd={groupDnd(r.name)}
          menu={
            <TreeRowMenu label={`Accions de «${r.name}»`}>
              <Menu.Item value="dup" onClick={() => {
                const d = duplicateItems(amb, groupIds(amb, r.name))
                change(d.ambient, true)
                if (d.group) groupSel(d.group)
              }}>
                <LuCopy /> Duplicar el grup
              </Menu.Item>
              <Menu.Item value="ungroup" onClick={() => (change(setItemGroup(amb, groupIds(amb, r.name), undefined), true), setSel(null))}>
                <LuUngroup /> Desagrupar
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item value="del" color="fg.error" onClick={() => (change(removeItems(amb, groupIds(amb, r.name)), true), setSel(null))}>
                <LuTrash2 /> Eliminar el grup
              </Menu.Item>
            </TreeRowMenu>
          }
        />
        {open && r.items.map((it) => itemRow(it, 2))}
      </Box>
    )
  }

  // Dreceres de teclat.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable], [role=dialog]")) return
      const mod = e.metaKey || e.ctrlKey
      // Desfer/refer: `useUndoKeys`.
      if (mod && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) return
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault()
        duplicate()
        return
      }
      if (mod && (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "x")) {
        // Sense res seleccionat (o amb text triat), el del navegador.
        if (!selIds.length || window.getSelection()?.toString()) return
        e.preventDefault()
        copy(e.key.toLowerCase() === "x")
        return
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault()
        paste()
        return
      }
      // ⌘G / Ctrl+G: els triats en un grup nou; ⇧⌘G: fora del grup (com a l'editor i Figma).
      if (mod && e.key.toLowerCase() === "g") {
        if (!selIds.length) return
        e.preventDefault()
        if (e.shiftKey) {
          change(setItemGroup(amb, selIds, undefined), true)
          if (sel?.kind === "group") select(selIds.length > 1 ? { kind: "multi", ids: selIds } : { kind: "item", id: selIds[0]! })
        } else if (sel?.kind !== "group") {
          const name = newItemGroupName(amb)
          change(setItemGroup(amb, selIds, name), true)
          groupSel(name)
        }
        return
      }
      if (mod) return
      const k = e.key.toLowerCase()
      if (k === "v") setTool("select")
      else if (k === "p") setTool("wall")
      else if (k === "h") setTool("room")
      else if (k === "f") setTool("window")
      else if (k === "d") setTool("door")
      else if (k === "escape") {
        setTool("select")
        setSel(null)
      } else if ((k === "delete" || k === "backspace") && sel) {
        e.preventDefault()
        remove()
      } else if (k === "r" && selIds.length) rotate(e.shiftKey ? -90 : 90)
      else if (k.startsWith("arrow") && selIds.length) {
        e.preventDefault()
        const st = e.shiftKey ? 100 : 10
        nudge(k === "arrowleft" ? -st : k === "arrowright" ? st : 0, k === "arrowup" ? -st : k === "arrowdown" ? st : 0)
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  })

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
          // Com l'Estructura de l'editor (mateixes files, `TreeRow`): l'ambient a dalt (el selecciona), les parets en un
          // grup plegable i dos apartats, Mobles i Objectes, amb el + i els seus elements i grups.
          <Stack gap={0.5} role="tree" aria-label="Estructura de l'ambient" fontSize="sm">
            <TreeRow icon={<LuHouse />} label={name || "Ambient"} bold depth={0} selected={ambientSel} onClick={() => (select(null), ws.setMobilePane("props"), setTool("select"))} />
            {amb.walls.length > 0 && (
              <Box>
                <TreeRow
                  depth={1}
                  icon={wallsOpen ? <LuChevronDown /> : <LuChevronRight />}
                  onToggle={() => setWallsOpen((o) => !o)}
                  toggleLabel={wallsOpen ? "Plegar «Parets»" : "Desplegar «Parets»"}
                  label="Parets"
                  hint={`${amb.walls.length} · ${formatLength(Math.round(summary.wallLength), unit)}`}
                  selected={false}
                  highlighted={!!wall}
                  onClick={() => setWallsOpen((o) => !o)}
                />
                {wallsOpen &&
                  amb.walls.map((w, i) => (
                    <TreeRow
                      key={w.id}
                      depth={2}
                      icon={<LuBrickWall />}
                      label={`Paret ${i + 1}`}
                      hint={`${formatLength(Math.round(wallLength(w)), unit)}${w.openings?.length ? ` · ${w.openings.length} ${w.openings.length === 1 ? "obertura" : "obertures"}` : ""}`}
                      selected={sel?.kind === "wall" && sel.id === w.id}
                      onClick={() => (select({ kind: "wall", id: w.id }), setTool("select"))}
                      flags={{ hidden: w.hidden, locked: w.locked, onHide: () => flipWall(w.id, "hidden", !w.hidden), onLock: () => flipWall(w.id, "locked", !w.locked) }}
                      menu={
                        <TreeRowMenu label={`Accions de «Paret ${i + 1}»`}>
                          <Menu.Item
                            value="del"
                            color="fg.error"
                            onClick={() => {
                              change({ ...amb, walls: amb.walls.filter((x) => x.id !== w.id) }, true)
                              if (sel?.kind === "wall" && sel.id === w.id) setSel(null)
                            }}
                          >
                            <LuTrash2 /> Eliminar la paret
                          </Menu.Item>
                        </TreeRowMenu>
                      }
                    />
                  ))}
              </Box>
            )}
            {/* Com els grups de l'arbre de l'editor (Peces lliures +, Models 3D +): títol i el + que obre la galeria. */}
            <TreeSection onAdd={() => setPicker(true)} addLabel="Afegir moble">
              Mobles
            </TreeSection>
            {rowsOf(mobleItems).map((r) => listRow(r, "moble"))}
            <TreeSection onAdd={() => setObjPicker(true)} addLabel="Afegir objecte">
              Objectes
            </TreeSection>
            {rowsOf(objectItems).map((r) => listRow(r, "object"))}
            {/* Arrossegant un element d'un grup: zona per treure'l (queda solt), com a l'editor. */}
            {dragOutOfGroup && (
              <HStack
                mt={1}
                mx={1}
                px={2}
                py={1.5}
                gap={2}
                rounded="md"
                fontSize="xs"
                borderWidth="1px"
                borderStyle="dashed"
                borderColor={over?.id === "ungroup" ? "wood.solid" : "border.emphasized"}
                bg={over?.id === "ungroup" ? "wood.muted" : undefined}
                color={over?.id === "ungroup" ? "wood.fg" : "fg.muted"}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  if (over?.id !== "ungroup") setOver({ id: "ungroup", after: false })
                }}
                onDragLeave={() => over?.id === "ungroup" && setOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  if (drag) change(setItemGroup(amb, drag.ids, undefined), true)
                  endDrag()
                }}
              >
                <LuUngroup /> Deixa'l aquí per treure'l del grup
              </HStack>
            )}
          </Stack>
        }
        right={
          <Stack gap={4} pb={2}>
          {item ? (
              <ItemInspector
                key={item.id}
                item={item}
                geo={geos.get(item.id) ?? null}
                name={names.get(item.id) ?? ""}
                project={item.kind === "moble" ? projects?.find((p) => p.id === item.projectId) : undefined}
                materials={simMaterials}
                onPatch={(p) => patchItem(item.id, p)}
                onOpen={() => item.kind === "moble" && onOpenProject(item.projectId)}
                onDuplicate={duplicate}
                onDelete={remove}
                onResize={resizeLinked}
              />
            ) : sel?.kind === "multi" && selIds.length > 1 ? (
              <MultiInspector
                items={amb.items.filter((i) => selIds.includes(i.id))}
                names={names}
                groups={groups}
                onMove={(dx, dy) => nudge(dx, dy)}
                onRotate={rotate}
                onAlign={(axis, mode) => change(alignItems(amb, selIds, boxOf, axis, mode), true)}
                onDistribute={(axis, gap) => change(distributeItems(amb, selIds, boxOf, axis, gap), true)}
                onGroup={(g) => {
                  const name = g ?? newItemGroupName(amb)
                  change(setItemGroup(amb, selIds, name), true)
                  groupSel(name)
                }}
                onUngroup={() => change(setItemGroup(amb, selIds, undefined), true)}
                onDuplicate={duplicate}
                onDelete={remove}
                onPick={(id) => select({ kind: "item", id })}
              />
            ) : sel?.kind === "group" && selIds.length ? (
              // Un grup té les mateixes propietats que una selecció múltiple (per decisió de l'usuari), amb el nom.
              <MultiInspector
                key={sel.id}
                name={sel.id}
                onRename={(n) => {
                  change(setItemGroup(amb, selIds, n), true)
                  setSel({ kind: "group", id: n })
                }}
                items={amb.items.filter((i) => selIds.includes(i.id))}
                names={names}
                groups={groups}
                onMove={(dx, dy) => nudge(dx, dy)}
                onRotate={rotate}
                onAlign={(axis, mode) => change(alignItems(amb, selIds, boxOf, axis, mode), true)}
                onDistribute={(axis, gap) => change(distributeItems(amb, selIds, boxOf, axis, gap), true)}
                onGroup={(g) => {
                  const name = g ?? newItemGroupName(amb)
                  change(setItemGroup(amb, selIds, name), true)
                  groupSel(name)
                }}
                onUngroup={() => (change(setItemGroup(amb, selIds, undefined), true), setSel(null))}
                onDuplicate={duplicate}
                onDelete={remove}
                onPick={(id) => select({ kind: "item", id })}
              />
            ) : wall ? (
              <WallInspector key={wall.id} wall={wall} label={`Paret ${amb.walls.indexOf(wall) + 1}`}materials={settings.materials} onPatch={(p) => patchWall(wall.id, p)} onDelete={remove} />
            ) : (
              <AmbientInspector
                name={name}
                summary={summary}
                size={(() => {
                  const b = ambientBox({ ...amb, items: [], plan: undefined }, geos)
                  return b ? { w: b.x1 - b.x0, d: b.y1 - b.y0 } : null
                })()}
                onRemoveMissing={() => change(removeItems(amb, summary.missing), true)}
                amb={amb}
                materials={simMaterials}
                wallDefaults={wallDefaults}
                onWallDefaults={setWallDefaults}
                onChange={(a) => change(a, true)}
                onImportPlan={() => void importPlan()}
                onCalibrate={() => (setTab("plan"), setTool("calibrate"))}
              />
            )}
          </Stack>
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
              onSelect={select}
              tool={tool}
              onToolDone={toolDone}
              onChange={changeShown}
              wallDefaults={wallDefaults}
              onCalibrate={(a, b) => setCalib({ a, b })}
              fitSignal={fit}
              show={{ grid: showGrid, dims: showDims, labels: showLabels, detail: showDetail, snap: snapOn, plan: showPlan }}
              onFramedChange={setPlanFramed}
            />
          ) : (
            // Fons del 3D (el visor és transparent): el mateix gris que el plànol.
            <Box position="absolute" inset={0} rounded="md" overflow="hidden" borderWidth="1px" bg="bg.subtle">
              <Ambient3D ambient={shownAmb} geos={geos} materials={settings.materials} onSceneAccess={onSceneAccess} fitSignal={fit} eyeSignal={eye} selectedIds={selIds} onSelect={(id) => (id ? void pickItem(id) : select(null))} onPick={pickItem} onChange={changeShown} snap={snapOn} dollhouse={dollhouse} shadows={shadows} ceiling={ceiling} onPoseChange={setPose} initialCamera={cameraRef.current} onCameraChange={saveCamera} cameraLocked={camLocked} cameraGoto={camGoto} />
            </Box>
          )}
            {chrome}
          {/* Pestanyes del visor (com a l'editor): Plànol · 3D, a dalt al mig. */}
          <Box position="absolute" top={3} left="50%" transform="translateX(-50%)" zIndex={2}>
            <SegmentGroup.Root size="sm" bg="bg.panel" value={tab} onValueChange={(e) => e.value && setTab(e.value as "plan" | "3d")}>
              <SegmentGroup.Indicator />
              {(
                [
                  ["plan", "Plànol", LuMap, "Plànol (vista de dalt)"],
                  ["3d", "3D", LuRotate3D, "Ambient en 3D"],
                ] as const
              ).map(([v, label, Icon, aria]) => (
                <SegmentGroup.Item key={v} value={v} aria-label={aria}>
                  <SegmentGroup.ItemText>
                    <HStack gap={1.5}>
                      <Icon /> <Box as="span" display={{ base: "none", sm: "inline" }}>{label}</Box>
                    </HStack>
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              ))}
            </SegmentGroup.Root>
          </Box>
          {/* Eines de dibuix del plànol (com les barres d'eines dels CAD): en columna a l'esquerra. */}
          {tab === "plan" && (
            <Stack position="absolute" top={{ base: 3, md: 14 }} left={3} zIndex={2} gap={0.5} bg="bg.panel" rounded="md" borderWidth="1px" p={0.5} shadow="sm">
              {TOOLS.map((t) => (
                <Tooltip key={t.id} content={`${t.label} (${t.key})`} positioning={{ placement: "right" }}>
                  <IconButton aria-label={t.label} size="sm" variant={tool === t.id ? "solid" : "ghost"} colorPalette={tool === t.id ? "wood" : undefined} onClick={() => setTool(t.id)}>
                    <t.icon />
                  </IconButton>
                </Tooltip>
              ))}
            </Stack>
          )}
          {/* Càmera del 3D, a baix a l'esquerra: bloquejar-la i tornar a la d'abans. */}
          {tab === "3d" && (
            <HStack position="absolute" bottom={3} left={3} zIndex={2} gap={0.5} bg="bg.panel" rounded="md" borderWidth="1px" p={0.5} shadow="sm">
              <Tooltip content={camLocked ? "Càmera bloquejada: el ratolí no la mou (clic per desbloquejar)" : "Bloquejar la càmera (el ratolí no la mourà: per no perdre l'enquadrament del render)"}>
                <IconButton aria-label={camLocked ? "Desbloquejar la càmera" : "Bloquejar la càmera"} aria-pressed={camLocked} size="sm" variant={camLocked ? "solid" : "ghost"} colorPalette={camLocked ? "wood" : undefined} onClick={() => setCamLocked((v) => !v)}>
                  {camLocked ? <LuLock /> : <LuLockOpen />}
                </IconButton>
              </Tooltip>
              <Tooltip content="Tornar a la càmera d'abans">
                <IconButton aria-label="Càmera d'abans" size="sm" variant="ghost" disabled={!camBack} onClick={cameraBack}>
                  <LuUndoDot />
                </IconButton>
              </Tooltip>
            </HStack>
          )}
          {/* Opcions de vista (com a l'editor), a dalt a la dreta. */}
          <Box position="absolute" top={3} right={{ base: 3, md: 14 }} zIndex={2}>
            <ViewOptions
              open={viewOptsOpen}
              onOpenChange={setViewOptsOpen}
              tiles={
                tab === "plan" ? (
                  <>
                    <ViewTile label="Encabir" icon={<LuVideo />} on={planFramed} onClick={() => setFit((n) => n + 1)} tip="Encabir el plànol" />
                    <ViewTile label="Graella" icon={<LuGrid3X3 />} on={showGrid} onClick={() => setShowGrid((v) => !v)} />
                    <ViewTile label="Mides" icon={<LuRuler />} on={showDims} onClick={() => setShowDims((v) => !v)} tip="Mides de les parets" />
                    <ViewTile label="Noms" icon={<LuTag />} on={showLabels} onClick={() => setShowLabels((v) => !v)} tip="Noms i mides dels elements" />
                    <ViewTile label="Peces" icon={<LuLayers />} on={showDetail} onClick={() => setShowDetail((v) => !v)} tip="Les peces dels mobles vistes des de dalt" />
                    <ViewTile label="Imant" icon={<LuMagnet />} on={snapOn} onClick={() => setSnapOn((v) => !v)} tip="Imant a les parets i als extrems (Alt: sense, puntualment)" />
                    {amb.plan && <ViewTile label="Plànol de fons" icon={<LuImage />} on={showPlan} onClick={() => setShowPlan((v) => !v)} />}
                    <ViewTile label="Render" icon={<LuAperture />} on={false} onClick={() => (setViewOptsOpen(false), setTab("3d"), setRenderOpen(true))} tip="Render fotorealista (des del 3D)" />
                  </>
                ) : (
                  <>
                    <ViewTile label="Enquadrar" icon={<LuVideo />} on={pose === "home"} onClick={() => setFit((n) => n + 1)} />
                    <ViewTile label="Interior" icon={<LuEye />} on={pose === "eye"} onClick={() => setEye((n) => n + 1)} tip="Entrar a l'habitació: càmera anivellada a 1,35 m, mirant la paret del fons, com les fotos d'interiors" />
                    <ViewTile label="Casa de nines" icon={<LuHouse />} on={dollhouse} onClick={() => setDollhouse((v) => !v)} tip="Parets de davant transparents" />
                    <ViewTile label="Ombres" icon={<LuSun />} on={shadows} onClick={() => setShadows((v) => !v)} />
                    <ViewTile label="Sostre" icon={<LuPanelTop />} on={ceiling} onClick={() => setCeiling((v) => !v)} tip="Sostre a les habitacions tancades: es veu des de dins («Interior») i al render la llum entra per les finestres" />
                    <ViewTile label="Render" icon={<LuAperture />} on={false} onClick={() => (setViewOptsOpen(false), setRenderOpen(true))} tip="Render fotorealista (GPU o CPU, com Cinema 4D): es va afinant i es desa en PNG" />
                  </>
                )
              }
            />
          </Box>
          {tab === "plan" && tool !== "select" && (
            <Badge position="absolute" bottom={3} left="50%" transform="translateX(-50%)" colorPalette="wood" size="md" pointerEvents="none" maxW="90%" whiteSpace="normal" textAlign="center">
              {tool === "wall" ? "Paret: clica punt a punt · clica el primer per tancar · Retorn o Esc per acabar" : tool === "room" ? "Habitació: arrossega un rectangle" : tool === "window" ? "Finestra: clica sobre una paret (després la pots arrossegar i canviar-ne les mides)" : tool === "door" ? "Porta: clica sobre una paret (després la pots arrossegar i canviar-ne les mides)" : "Calibrar: clica dos punts d'una mida coneguda"}
            </Badge>
          )}
          </Box>
        )}
      />

      {/* Afegir un moble o un objecte: la mateixa galeria de la pàgina (Historial · Projectes · Catàleg) a pantalla completa. */}
      <AmbientPicker what="moble" open={picker} onClose={() => setPicker(false)} ambientId={ambientId} ambientName={name} projects={projects} onAdd={(p) => (addMoble(p), setPicker(false))} onCreate={(c, n) => createAndAdd(c, n, "moble")} />
      <AmbientPicker what="object" open={objPicker} onClose={() => setObjPicker(false)} ambientId={ambientId} ambientName={name} projects={projects} onAdd={(p) => (addMoble(p), setObjPicker(false))} onCreate={(c, n) => createAndAdd(c, n, "object")} />

      <RenderDialog open={renderOpen} onClose={() => setRenderOpen(false)} getScene={() => sceneGetter.current?.() ?? null} name={name} saveKey={`ambient:${ambientId}`} />

      <CalibrateDialog open={calib !== null} measured={calib ? Math.hypot(calib.b[0] - calib.a[0], calib.b[1] - calib.a[1]) : 0} onClose={() => (setCalib(null), setTool("select"))} onApply={applyCalibration} />
    </Flex>
  )
}

// --- Inspectors ------------------------------------------------------------------------------


/** Material de les preferències, agrupat per categories (el mateix selector que a Preferències). */
function MaterialPick({ label, value, materials, onChange, emptyLabel }: { label: string; value: string; materials: MaterialPref[]; onChange: (v: string) => void; onlySim?: boolean; emptyLabel?: string }) {
  return (
    <FormRow label={label} maxW="280px">
      <MaterialSelect label={label} materials={materials} value={value} onChange={onChange} emptyLabel={emptyLabel} hideLabel />
    </FormRow>
  )
}

function Placement({ item, onPatch }: { item: AmbientItem; onPatch: (p: Partial<AmbientItem>) => void }) {
  return (
    <FoldItem id="amb-place" title="Posició" icon={LuMove}>
      <NumRow label="X (centre)" value={item.x} step={10} onChange={(x) => Number.isFinite(x) && onPatch({ x })} />
      <NumRow label="Y (centre)" value={item.y} step={10} onChange={(y) => Number.isFinite(y) && onPatch({ y })} />
      <NumRow label="Gir" suffix="°" value={item.rot} step={15} onChange={(rot) => Number.isFinite(rot) && onPatch({ rot: ((rot % 360) + 360) % 360 })} />
      <NumRow label="Del terra" value={item.elevation ?? 0} min={0} step={10} onChange={(elevation) => Number.isFinite(elevation) && onPatch({ elevation: elevation || undefined })} />
      <HStack gap={2}>
        <Button size="xs" variant="outline" onClick={() => onPatch({ rot: (item.rot + 270) % 360 })}>
          <LuRotateCcw /> −90°
        </Button>
        <Button size="xs" variant="outline" onClick={() => onPatch({ rot: (item.rot + 90) % 360 })}>
          <LuRotateCw /> +90° (R)
        </Button>
      </HStack>
    </FoldItem>
  )
}

function ItemInspector({
  item,
  geo,
  name,
  project,
  materials,
  onPatch,
  onOpen,
  onDuplicate,
  onDelete,
  onResize,
}: {
  /** Les mides generals d'un moble enllaçat, com un pas del desfer de l'ambient. */
  onResize?: (id: number, before: Composition, next: Composition) => void
  item: AmbientItem
  geo: ItemGeometry | null
  name: string
  project?: Project
  materials: MaterialPref[]
  onPatch: (p: Partial<AmbientItem>) => void
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <Stack gap={0}>
      <HStack gap={2} pb={2}>
        {/* La mateixa icona que a l'arbre: moble o objecte. */}
        <Box color={item.kind === "moble" && !(project && isObject(project)) ? "wood.fg" : "fg.muted"}>{item.kind === "moble" && !(project && isObject(project)) ? <LuBox /> : <LuSofa />}</Box>
        {item.kind === "block" ? (
          <Editable.Root value={item.name} onValueChange={(e) => onPatch({ name: e.value })} fontWeight="semibold" flex={1} minW={0} aria-label="Nom del bloc">
            <Editable.Preview truncate />
            <Editable.Input />
          </Editable.Root>
        ) : (
          <Text fontWeight="semibold" truncate flex={1}>
            {name}
          </Text>
        )}
        <Tooltip content="Duplicar (Ctrl/⌘ D)">
          <IconButton aria-label="Duplicar" size="xs" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
        </Tooltip>
        <Tooltip content="Treure de l'ambient (Supr)">
          <IconButton aria-label="Treure de l'ambient" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </Tooltip>
      </HStack>

      {item.kind === "moble" ? (
        project && geo ? (
          <>
            {isEmptyGeometry(geo) ? (
              // Un moble nou és buit (sense mòduls ni peces): no hi ha mides per escalar; es fa a l'editor.
              <Text fontSize="sm" color="fg.muted" pt={1}>
                És buit: encara no té mòduls ni peces. Obre'l a l'editor per fer-lo; al plànol surt com un requadre discontinu.
              </Text>
            ) : (
              <MobleDims project={project} geo={geo} onResize={onResize} />
            )}
            <Button size="sm" variant="outline" alignSelf="flex-start" my={3} onClick={onOpen}>
              <LuExternalLink /> Obrir a l'editor
            </Button>
          </>
        ) : (
          <Text fontSize="sm" color="fg.error">
            Aquest moble s'ha esborrat de la llista.
          </Text>
        )
      ) : (
        <FoldItem id="amb-block" title="Bloc" icon={LuSofa}>
          <FormRow label="Forma">
            <ChoiceChips label="Forma" options={BlockShapeSchema.options.map((s) => ({ id: s, label: SHAPE_LABEL[s] }))} value={item.shape} onChange={(shape) => onPatch({ shape })} />
          </FormRow>
          <NumRow label="Ample" value={item.w} min={10} step={10} onChange={(w) => w >= 10 && onPatch({ w })} />
          <NumRow label="Alt" value={item.h} min={5} step={10} onChange={(h) => h >= 5 && onPatch({ h })} />
          <NumRow label="Fondària" value={item.d} min={10} step={10} onChange={(d) => d >= 10 && onPatch({ d })} />
          <MaterialPick label="Material" value={item.material} materials={materials} onChange={(material) => onPatch({ material })} />
          {(item.shape === "bed" || item.shape === "sofa") && (
            <MaterialPick label={item.shape === "bed" ? "Matalàs" : "Coixins"} value={item.material2 ?? item.material} materials={materials} onChange={(material2) => onPatch({ material2 })} onlySim />
          )}
          <Text fontSize="xs" color="fg.muted">
            Els blocs només es veuen: no es fabriquen ni surten a les peces.
          </Text>
        </FoldItem>
      )}
      <Placement item={item} onPatch={onPatch} />
    </Stack>
  )
}

/**
 * Mides generals d'un moble: s'escriuen i s'apliquen amb «Aplicar» (o Retorn); el moble de la
 * llista canvia (l'enllaç és el mateix moble), amb la distribució escalada.
 */
function MobleDims({ project, geo, onResize }: { project: Project; geo: ItemGeometry; onResize?: (id: number, before: Composition, next: Composition) => void }) {
  const cur = { w: Math.round(geo.w), h: Math.round(geo.h), d: Math.round(geo.d) }
  const [draft, setDraft] = useState(cur)
  const key = `${cur.w}|${cur.h}|${cur.d}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setDraft(cur)
  }
  const dirty = draft.w !== cur.w || draft.h !== cur.h || draft.d !== cur.d
  const apply = async () => {
    if (!dirty || !(draft.w >= 100 && draft.h >= 100 && draft.d >= 100)) return
    const before = compositionOf(project)
    const next = resizeComposition(before, cur, draft)
    const ok = CompositionSchema.safeParse(next)
    if (!ok.success) {
      toaster.create({ title: "No s'ha pogut canviar la mida", description: "Amb aquestes mides alguna part del moble queda fora de límits. Prova-ho a l'editor.", type: "error" })
      return
    }
    // Un pas del desfer de l'ambient: el desa l'efecte de `linked` (i ⌘Z el torna a la d'abans).
    if (onResize) return onResize(project.id, before, next)
    if (!(await updateProjectComposition(project.id, next))) {
      toaster.create({ title: "No s'ha pogut canviar la mida", description: "Aquest moble no s'ha pogut llegir bé; obre'l a l'editor.", type: "error" })
    }
  }
  return (
    <FoldItem id="amb-dims" title="Mides generals" icon={LuMoveDiagonal} badge={`${cur.w} × ${cur.h} × ${cur.d}`}>
      {/* S'aplica en sortir dels camps (com els altres de l'app), amb Retorn o amb «Aplicar»; mentre s'escriu, no
          (escrivint «1200» s'hauria aplicat 120). */}
      <Stack
        gap={4}
        onKeyDown={(e) => e.key === "Enter" && void apply()}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void apply()
        }}
      >
      <NumRow label="Ample" value={draft.w} min={100} step={10} onChange={(w) => setDraft({ ...draft, w })} />
      <NumRow label="Alt" value={draft.h} min={100} step={10} onChange={(h) => setDraft({ ...draft, h })} />
      <NumRow label="Fondària" value={draft.d} min={100} step={10} onChange={(d) => setDraft({ ...draft, d })} />
      {dirty && (
        <HStack gap={2}>
          <Button size="xs" colorPalette="wood" onClick={() => void apply()}>
            Aplicar les mides
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setDraft(cur)}>
            Desfer
          </Button>
        </HStack>
      )}
      <Text fontSize="xs" color="fg.muted">
        És el mateix moble de la llista: canviar-ne les mides el canvia a tot arreu. L'interior (compartiments, portes, calaixos) es toca a l'editor.
      </Text>
      </Stack>
    </FoldItem>
  )
}

function WallInspector({ wall, label, materials, onPatch, onDelete }: { wall: Wall; label: string;materials: MaterialPref[]; onPatch: (p: Partial<Wall>) => void; onDelete: () => void }) {
  const L = Math.round(wallLength(wall))
  return (
    <Stack gap={0}>
      <HStack pb={2}>
        <Box color="fg.muted">
          <LuBrickWall />
        </Box>
        <Text fontWeight="semibold" flex={1}>
          {label}
        </Text>
        <IconButton aria-label="Eliminar la paret" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
          <LuTrash2 />
        </IconButton>
      </HStack>
      <FoldItem id="amb-wall" title="Mides i material" icon={LuRuler} badge={`${L} mm`}>
      {/* Recta o corba (Bézier, com la ploma amb clic i arrossegar): en fer-la corba, els punts de control a un terç i dos
          terços, cap a fora un quart del llarg; s'arrosseguen al plànol. Una corba no porta finestres ni portes. */}
      <FormRow label="Forma" help={wall.curve ? "Arrossega els rombes del plànol per canviar la corba. Una paret corba no porta finestres ni portes." : undefined}>
        <ChoiceChips
          label="Forma"
          value={wall.curve ? "curve" : "line"}
          options={[{ id: "line", label: "Recta" }, { id: "curve", label: "Corba" }]}
          onChange={(v) => {
            if (v === "line") return onPatch({ curve: undefined })
            const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1]
            const k = 0.25
            const n: [number, number] = [-dy * k, dx * k]
            onPatch({ curve: { c1: [Math.round(wall.a[0] + dx / 3 + n[0]), Math.round(wall.a[1] + dy / 3 + n[1])], c2: [Math.round(wall.a[0] + (2 * dx) / 3 + n[0]), Math.round(wall.a[1] + (2 * dy) / 3 + n[1])] }, openings: undefined })
          }}
        />
      </FormRow>
      {!wall.curve && <NumRow
        label="Llarg"
        value={L}
        min={50}
        step={10}
        onChange={(len) => {
          if (!(len >= 50) || L < 1) return
          // S'allarga cap al final (b), en la mateixa direcció.
          const k = len / L
          const b: [number, number] = [Math.round(wall.a[0] + (wall.b[0] - wall.a[0]) * k), Math.round(wall.a[1] + (wall.b[1] - wall.a[1]) * k)]
          // Les obertures es queden on eren i, si s'escurça, s'ajusten perquè hi càpiguen.
          onPatch({ b, ...(wall.openings ? { openings: setWallEnds(wall, wall.a, b).openings } : {}) })
        }}
      />}
      <NumRow label="Gruix" value={wall.thickness} min={20} max={1000} step={10} onChange={(thickness) => thickness >= 20 && onPatch({ thickness })} />
      <NumRow label="Alt" value={wall.height} min={200} max={10000} step={10} onChange={(height) => height >= 200 && onPatch({ height })} />
      <MaterialPick label="Material d'aquesta paret" value={wall.material ?? ""} materials={materials} onChange={(material) => onPatch({ material: material || undefined })} onlySim emptyLabel="El de totes les parets" />
      <Text fontSize="xs" color="fg.muted">
        Arrossega-la per moure-la (les parets enganxades la segueixen) o arrossega'n els extrems. Maj: sense angles · Alt: sense imant.
      </Text>
      </FoldItem>
      {!wall.curve && <FoldItem id="amb-openings" title="Finestres i portes" icon={LuAppWindow} badge={wall.openings?.length || undefined}>
        {(wall.openings ?? []).map((o, i) => {
          const set = (patch: Partial<Opening>) => onPatch({ openings: wall.openings!.map((q, j) => (j === i ? clampOpening(wall, { ...q, ...patch }) : q)) })
          return (
            <Stack key={i} gap={2} borderWidth="1px" rounded="md" p={2}>
              <HStack align="flex-start" gap={1}>
                <Box flex={1} minW={0}>
                <FormRow label="Tipus" help={o.kind === "glazing" ? "De terra a sostre." : undefined}>
                  <ChoiceChips<Opening["kind"]>
                    label="Tipus d'obertura"
                    options={[
                      { id: "window", label: "Finestra" },
                      { id: "door", label: "Porta" },
                      { id: "glazing", label: "Vidriera" },
                    ]}
                    value={o.kind}
                    onChange={(kind) => set({ kind, ...OPENING_DEFAULTS[kind] })}
                  />
                </FormRow>
                </Box>
                <IconButton aria-label="Treure l'obertura" size="xs" variant="ghost" colorPalette="red" onClick={() => onPatch({ openings: wall.openings!.filter((_, j) => j !== i) })}>
                  <LuTrash2 />
                </IconButton>
              </HStack>
              <NumRow label="Centre (des de l'inici)" value={Math.round(o.at)} step={10} onChange={(at) => Number.isFinite(at) && set({ at })} />
              <NumRow label="Ample" value={o.w} min={200} step={10} onChange={(w) => w >= 200 && set({ w })} />
              <NumRow label="Alt" value={o.h} min={200} step={10} onChange={(h) => h >= 200 && set({ h })} />
              {o.kind === "window" && <NumRow label="Ampit (del terra)" value={o.sill} min={0} step={10} onChange={(sill) => sill >= 0 && set({ sill })} />}
              {o.kind !== "door" && <NumRow label="Fulles" value={o.panes ?? Math.max(1, Math.round(o.w / (o.kind === "glazing" ? 1200 : 900)))} min={1} max={12} step={1} onChange={(panes) => panes >= 1 && set({ panes: Math.round(panes) })} />}
            </Stack>
          )
        })}
        <HStack gap={2} wrap="wrap">
          {(["window", "door", "glazing"] as const).map((k) => (
            <Button
              key={k}
              size="xs"
              variant="outline"
              onClick={() => {
                const next = addOpening(wall, k, L / 2)
                if (next) onPatch({ openings: next.openings })
                else toaster.create({ title: "No hi cap", description: "Aquesta paret no té cap tros lliure prou ample.", type: "info" })
              }}
            >
              {k === "window" ? <LuAppWindow /> : k === "door" ? <LuDoorOpen /> : <LuPanelTop />} {k === "window" ? "Finestra" : k === "door" ? "Porta" : "Vidriera"}
            </Button>
          ))}
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          També amb les eines Finestra (F) i Porta (D): clic sobre la paret. Al plànol s'arrosseguen al llarg de la paret.
        </Text>
      </FoldItem>}
    </Stack>
  )
}

function AmbientInspector({
  name,
  summary: s,
  size,
  onRemoveMissing,
  amb,
  materials,
  wallDefaults,
  onWallDefaults,
  onChange,
  onImportPlan,
  onCalibrate,
}: {
  name: string
  summary: AmbientSummary
  /** Caixa de les parets (mm), si n'hi ha. */
  size: { w: number; d: number } | null
  onRemoveMissing: () => void
  amb: Ambient
  materials: MaterialPref[]
  wallDefaults: { thickness: number; height: number }
  onWallDefaults: (v: { thickness: number; height: number }) => void
  onChange: (a: Ambient) => void
  onImportPlan: () => void
  onCalibrate: () => void
}) {
  const plan = amb.plan
  const m = (mm: number) => (mm / 1000).toLocaleString("ca-ES", { maximumFractionDigits: 2 })
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  const line = [
    n(s.walls, "paret", "parets"),
    s.area > 0 && `${(s.area / 1e6).toLocaleString("ca-ES", { maximumFractionDigits: 1 })} m² de terra`,
    size && `${m(size.w)} × ${m(size.d)} m`,
  ].filter(Boolean)
  return (
    <Stack gap={0}>
      <HStack gap={2} pb={2}>
        <Box color="wood.fg">
          <LuHouse />
        </Box>
        <Text fontWeight="semibold" truncate flex={1} data-truncate="">
          {name || "Ambient"}
        </Text>
      </HStack>
      {/* Resum, com el del moble a l'editor (mateix `FoldItem`): què hi ha a l'ambient. */}
      <FoldItem id="amb-summary" title="Resum" icon={LuHouse} badge={s.missing.length ? `${s.missing.length} ⚠` : undefined} badgePalette={s.missing.length ? "red" : undefined}>
        <Text fontSize="sm" color="fg.muted">
          {line.join(" · ")}
        </Text>
        <HStack gap={2} wrap="wrap">
          <Badge variant="subtle">{n(s.mobles, "moble", "mobles")}</Badge>
          <Badge variant="subtle">{n(s.objects, "objecte", "objectes")}</Badge>
          {s.windows > 0 && <Badge variant="subtle">{n(s.windows, "finestra", "finestres")}</Badge>}
          {s.doors > 0 && <Badge variant="subtle">{n(s.doors, "porta", "portes")}</Badge>}
          {s.glazing > 0 && <Badge variant="subtle">{n(s.glazing, "vidriera", "vidrieres")}</Badge>}
          {s.groups > 0 && <Badge variant="subtle">{n(s.groups, "grup", "grups")}</Badge>}
        </HStack>
        {s.missing.length > 0 && (
          <Alert.Root status="warning" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{s.missing.length === 1 ? "Un moble ja no hi és" : `${s.missing.length} mobles ja no hi són`}</Alert.Title>
              <Alert.Description>
                <Stack gap={2} align="flex-start">
                  <Text>S'han esborrat de la llista de Mobles o d'Objectes: a l'ambient no es veuen.</Text>
                  <Button size="xs" variant="outline" onClick={onRemoveMissing}>
                    <LuTrash2 /> Treure'ls de l'ambient
                  </Button>
                </Stack>
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        <Text fontSize="xs" color="fg.muted">
          Selecciona una paret o un element a l'esquerra (o clica'l al plànol o al 3D) per editar-lo.
        </Text>
      </FoldItem>
      <FoldItem id="amb-newwalls" title="Parets noves" icon={LuBrickWall} badge={`${wallDefaults.thickness} · ${wallDefaults.height}`}>
        <NumRow label="Gruix" value={wallDefaults.thickness} min={20} max={1000} step={10} onChange={(thickness) => thickness >= 20 && onWallDefaults({ ...wallDefaults, thickness })} />
        <NumRow label="Alçada" value={wallDefaults.height} min={200} max={10000} step={10} onChange={(height) => height >= 200 && onWallDefaults({ ...wallDefaults, height })} />
      </FoldItem>

      <FoldItem id="amb-finish" title="Acabats" icon={LuPalette}>
        <MaterialPick label="Terra" value={amb.floorMaterial ?? "Parquet de roure"} materials={materials} onChange={(floorMaterial) => onChange({ ...amb, floorMaterial })} onlySim />
        <MaterialPick label="Terra de fora" value={amb.outsideFloorMaterial ?? "Gespa"} materials={materials} onChange={(outsideFloorMaterial) => onChange({ ...amb, outsideFloorMaterial })} onlySim />
        <MaterialPick label="Parets" value={amb.wallMaterial ?? "Pintura blanca"} materials={materials} onChange={(wallMaterial) => onChange({ ...amb, wallMaterial })} onlySim />
        <MaterialPick label="Sostre" value={amb.ceilingMaterial ?? "Pintura blanca"} materials={materials} onChange={(ceilingMaterial) => onChange({ ...amb, ceilingMaterial })} onlySim />
      </FoldItem>

      <FoldItem id="amb-plan" title="Plànol de fons" icon={LuImageUp} badge={plan ? "Sí" : undefined}>
        {plan ? (
          <>
            <HStack gap={3}>
              <Box w="72px" h="52px" rounded="sm" borderWidth="1px" bgImage={`url(${plan.src})`} bgSize="cover" backgroundPosition="center" flexShrink={0} />
              <Text fontSize="xs" color="fg.muted">
                {Math.round((plan.pxW * plan.mmPerPx) / 10) / 100} × {Math.round((plan.pxH * plan.mmPerPx) / 10) / 100} m
              </Text>
            </HStack>
            <HStack gap={2} wrap="wrap">
              <Button size="xs" variant="outline" onClick={onCalibrate}>
                <LuPencilRuler /> Calibrar
              </Button>
              <Button size="xs" variant="outline" onClick={onImportPlan}>
                <LuImageUp /> Canviar
              </Button>
              <Button size="xs" variant="ghost" colorPalette="red" onClick={() => onChange({ ...amb, plan: undefined })}>
                <LuTrash2 /> Treure'l
              </Button>
            </HStack>
            <FormRow label="Opacitat">
              <Slider.Root size="sm" w="full" pt="10px" aria-label={["Opacitat"]} min={0.1} max={1} step={0.05} value={[plan.opacity]} onValueChange={(e) => onChange({ ...amb, plan: { ...plan, opacity: e.value[0]! } })}>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumbs />
                </Slider.Control>
              </Slider.Root>
            </FormRow>
            <FormRow label="Bloqueig">
              <Switch.Root size="sm" pt="6px" checked={plan.locked !== false} onCheckedChange={(e) => onChange({ ...amb, plan: { ...plan, locked: e.checked } })}>
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label fontSize="sm">Bloquejat (desbloquejat, s'arrossega)</Switch.Label>
              </Switch.Root>
            </FormRow>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" alignSelf="flex-start" onClick={onImportPlan}>
              <LuImageUp /> Posar un plànol (imatge)
            </Button>
            <Text fontSize="xs" color="fg.muted">
              Una foto o captura del plànol de la casa. Després marques dos punts d'una mida coneguda i queda a escala; a sobre hi dibuixes les parets.
            </Text>
          </>
        )}
      </FoldItem>
      <Text fontSize="xs" color="fg.muted" pt={4}>
        <LuPlus style={{ display: "inline" }} /> Afegeix mobles i objectes des de l'esquerra. Selecciona'ls per moure'ls, girar-los (R) o canviar-ne les mides.
      </Text>
    </Stack>
  )
}

function CalibrateDialog({ open, measured, onClose, onApply }: { open: boolean; measured: number; onClose: () => void; onApply: (real: number) => void }) {
  const [real, setReal] = useState(1000)
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xs">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Mida real</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <Text fontSize="sm" color="fg.muted">
                  Ara fa {Math.round(measured)} mm al plànol. Quant fa de debò?
                </Text>
                <NumRow label="Distància real" value={real} min={10} step={10} onChange={setReal} />
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" onClick={() => onApply(real)}>
                Posar a escala
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

/** Tria una imatge de plànol i la redueix (2400 px de costat llarg, JPEG; `shrinkImage`, la de tota l'app). */
function pickPlanImage(): Promise<{ src: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      shrinkImage(file, 2400, { jpeg: true, quality: 0.85 })
        .then(async ({ blob, width, height }) => resolve({ src: `data:image/jpeg;base64,${await blobToBase64(blob)}`, w: width, h: height }))
        .catch(() => resolve(null))
    }
    input.click()
  })
}


/**
 * Selecció múltiple (Maj + clic, com a l'editor): moure i girar tots junts, alinear i repartir al plànol, el grup de tots,
 * la llista (tocar-ne un el tria sol), duplicar i eliminar.
 */
function MultiInspector({
  name,
  onRename,
  items,
  names,
  groups,
  onMove,
  onRotate,
  onAlign,
  onDistribute,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onPick,
}: {
  /** Un grup: el nom (es canvia clicant-lo). Sense, una selecció múltiple («N elements»). */
  name?: string
  onRename?: (n: string) => void
  items: AmbientItem[]
  names: Map<string, string>
  groups: string[]
  onMove: (dx: number, dy: number) => void
  onRotate: (deg: number) => void
  onAlign: (axis: "x" | "y", mode: "min" | "mid" | "max") => void
  onDistribute: (axis: "x" | "y", gap?: number) => void
  onGroup: (g?: string) => void
  onUngroup: () => void
  onDuplicate: () => void
  onDelete: () => void
  onPick: (id: string) => void
}) {
  const [gap, setGap] = useState(0)
  const cx = Math.round((Math.min(...items.map((i) => i.x)) + Math.max(...items.map((i) => i.x))) / 2)
  const cy = Math.round((Math.min(...items.map((i) => i.y)) + Math.max(...items.map((i) => i.y))) / 2)
  const group = items.every((i) => i.group === items[0]!.group) ? (items[0]!.group ?? "") : undefined
  return (
    <Stack gap={0}>
      <HStack gap={2} pb={2}>
        <Box color="wood.fg">
          <LuGroup />
        </Box>
        {name !== undefined && onRename ? (
          <Editable.Root key={name} defaultValue={name} onValueCommit={(e) => e.value.trim() && e.value.trim() !== name && onRename(e.value.trim())} fontWeight="semibold" flex={1} minW={0} aria-label="Nom del grup">
            <Editable.Preview truncate title="Clica per canviar el nom" />
            <Editable.Input />
          </Editable.Root>
        ) : (
          <Text fontWeight="semibold" flex={1} minW={0} truncate>
            {items.length} elements
          </Text>
        )}
        <Tooltip content="Duplicar (Ctrl/⌘ D)">
          <IconButton aria-label="Duplicar els triats" size="xs" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
        </Tooltip>
        <Tooltip content="Eliminar (Supr)">
          <IconButton aria-label="Eliminar els triats" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </Tooltip>
      </HStack>
      <FoldItem id="amb-multi-place" title="Posició" icon={LuMove}>
        <NumRow label="X (centre)" value={cx} step={10} onChange={(x) => Number.isFinite(x) && onMove(x - cx, 0)} />
        <NumRow label="Y (centre)" value={cy} step={10} onChange={(y) => Number.isFinite(y) && onMove(0, y - cy)} />
        <HStack gap={2}>
          <Button size="xs" variant="outline" onClick={() => onRotate(-90)}>
            <LuRotateCcw /> −90°
          </Button>
          <Button size="xs" variant="outline" onClick={() => onRotate(90)}>
            <LuRotateCw /> +90° (R)
          </Button>
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          Es mouen tots junts: arrossegant-los al plànol, amb les fletxes del 3D o del teclat, o aquí. Maj + clic n'afegeix o en treu.
        </Text>
      </FoldItem>
      <FoldItem id="amb-multi-align" title="Alineació" icon={LuAlignCenterVertical}>
        <NumRow label="Espai entre ells" value={gap} min={-5000} max={20000} step={5} help="Per al darrer botó de cada fila: el primer es queda i els altres es posen a aquest espai de l'anterior (0 = tocant-se)." onChange={(n) => Number.isFinite(n) && setGap(n)} />
        {([
          { axis: "x", label: "De costat (X)", opts: [["min", "A l'esquerra", LuAlignStartVertical], ["mid", "Al centre", LuAlignCenterVertical], ["max", "A la dreta", LuAlignEndVertical]] },
          { axis: "y", label: "Fondària (Y del plànol)", opts: [["min", "A dalt del plànol", LuAlignStartHorizontal], ["mid", "Al mig", LuAlignCenterHorizontal], ["max", "A baix del plànol", LuAlignEndHorizontal]] },
        ] as const).map(({ axis, label, opts }) => (
          <FormRow key={axis} label={label}>
            <HStack gap={1}>
              {opts.map(([mode, name, Icon]) => (
                <Tooltip key={mode} content={name}>
                  <IconButton aria-label={`${label}: ${name}`} size="xs" variant="outline" onClick={() => onAlign(axis, mode)}>
                    <Icon />
                  </IconButton>
                </Tooltip>
              ))}
              {items.length > 2 && (
                <Tooltip content="Repartir (el mateix espai entre ells)">
                  <IconButton aria-label={`${label}: repartir`} size="xs" variant="outline" onClick={() => onDistribute(axis)}>
                    {axis === "y" ? <LuAlignVerticalDistributeCenter /> : <LuAlignHorizontalDistributeCenter />}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip content={`Repartir amb ${gap} mm entre ells`}>
                <IconButton aria-label={`${label}: repartir amb ${gap} mm`} size="xs" variant="outline" onClick={() => onDistribute(axis, gap)}>
                  {axis === "y" ? <LuAlignVerticalSpaceAround /> : <LuAlignHorizontalSpaceAround />}
                </IconButton>
              </Tooltip>
            </HStack>
          </FormRow>
        ))}
        <Text fontSize="xs" color="fg.muted">
          Respecte de la caixa de tots els triats al plànol. «Repartir», amb tres o més: el primer i l'últim es queden i els del mig es posen amb el mateix espai entre ells.
        </Text>
      </FoldItem>
      <FoldItem id="amb-multi-group" title="Grup" icon={LuGroup} badge={group === undefined ? "Diversos" : group || "Sense grup"} badgePalette={group ? "wood" : "gray"}>
        <FormRow label="Grup" help={group === undefined ? "Diversos: el grup que triïs va a tots." : "El grup de tots els triats."}>
          <ChoiceChips
            label="Grup"
            options={[{ id: "", label: "Sense grup" }, ...groups.map((g) => ({ id: g, label: g })), { id: "__new__", label: "+ Grup nou" }]}
            value={group ?? "__diversos__"}
            onChange={(v) => (v === "__new__" ? onGroup() : v ? onGroup(v) : onUngroup())}
          />
        </FormRow>
      </FoldItem>
      <FoldItem id="amb-multi-items" title="Triats" icon={LuGroup} badge={items.length}>
        <Stack gap={1}>
          {items.map((i) => (
            <Button key={i.id} size="xs" variant="ghost" justifyContent="flex-start" onClick={() => onPick(i.id)}>
              {names.get(i.id)}
            </Button>
          ))}
        </Stack>
      </FoldItem>
    </Stack>
  )
}
