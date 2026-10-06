import { Badge, Box, Button, CloseButton, Dialog, Drawer, Editable, Flex, HStack, IconButton, Menu, Portal, SegmentGroup, SimpleGrid, Slider, Stack, Switch, Text } from "@chakra-ui/react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  LuBox,
  LuMove,
  LuMoveDiagonal,
  LuPalette,
  LuBrickWall,
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuEllipsis,
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
  LuRedo2,
  LuRotate3D,
  LuRotateCcw,
  LuRotateCw,
  LuSofa,
  LuAperture,
  LuTrash2,
  LuUndo2,
  LuVideo,
  LuEye,
  LuAppWindow,
  LuDoorOpen,
  LuPanelTop,
  LuLock,
  LuLockOpen,
  LuUndoDot,
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
  type CameraPose,
  type AmbientItem,
  type BlockItem,
  type MaterialPref,
  type PlanPt,
  type Wall,
} from "../../core/model"
import { compositionOf, updateProjectComposition } from "../../db/compositionStore"
import { createProject, db, saveAmbientCamera, updateAmbient, type Project } from "../../db/db"
import { TopBarActions } from "../../components/TopBar"
import { uniqueName } from "../../core/file/mobleFile"
import { NewMobleGallery } from "../projects/NewMobleGallery"
import { ProjectCard } from "../projects/ProjectCard"
import { GALLERY_COLS } from "../projects/galleryGrid"
import { projectSearchText } from "../projects/searchText"
import { useAmbientMembership } from "./useAmbientMembership"
import { ObjectsGallery } from "../objects/ObjectsGallery"
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
import { itemName, useItemGeometries, type ItemGeometry } from "./ambientData"
import { PlanCanvas } from "./PlanCanvas"
import { AMBIENT_TAB_KEY, ambientBox, type Selection, type Tool } from "./planGeom"
import { useDebouncedSave } from "../useDebouncedSave"
import { SectionLabel } from "../../components/SectionLabel"

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
  const [amb, setAmbState] = useState<Ambient>(initial)
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
  const membership = useAmbientMembership()
  const past = useRef<Ambient[]>([])
  const future = useRef<Ambient[]>([])
  const committed = useRef<Ambient>(initial)
  const [hist, setHist] = useState({ undo: 0, redo: 0 })
  const syncHist = () => setHist({ undo: past.current.length, redo: future.current.length })

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

  const change = useCallback((next: Ambient, commit: boolean) => {
    setAmbState(next)
    if (commit) {
      past.current = [...past.current.slice(-99), committed.current]
      future.current = []
      committed.current = next
      syncHist()
    }
  }, [])
  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(committed.current)
    committed.current = prev
    setAmbState(prev)
    syncHist()
  }, [])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(committed.current)
    committed.current = next
    setAmbState(next)
    syncHist()
  }, [])

  const geos = useItemGeometries(amb.items, projects)
  const names = useMemo(() => new Map(amb.items.map((it) => [it.id, itemName(it, projects)])), [amb.items, projects])
  const isObjItem = (it: AmbientItem) => it.kind === "block" || !!projects?.some((p) => p.id === it.projectId && isObject(p))
  const item = sel?.kind === "item" ? amb.items.find((i) => i.id === sel.id) : undefined
  const wall = sel?.kind === "wall" ? amb.walls.find((w) => w.id === sel.id) : undefined

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
  const selIds = sel?.kind === "item" ? (amb.items.some((i) => i.id === sel.id) ? [sel.id] : []) : sel?.kind === "group" ? groupIds(amb, sel.id) : []
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
    const it = amb.items.find((i) => i.id === id)
    if (it?.group && !(sel?.kind === "group" && sel.id === it.group) && !(sel?.kind === "item" && sel.id === id)) {
      select({ kind: "group", id: it.group })
      return groupIds(amb, it.group)
    }
    select({ kind: "item", id })
    return [id]
  }
  const groupSel = (name: string) => select({ kind: "group", id: name })

  // Llista d'elements: els grups (en l'ordre del primer element) amb els seus a dins.
  const [folded, setFolded] = useState<string[]>([])
  const listRows: ({ kind: "group"; name: string; items: AmbientItem[] } | { kind: "item"; item: AmbientItem })[] = []
  for (const it of amb.items) {
    if (!it.group) listRows.push({ kind: "item", item: it })
    else if (!listRows.some((r) => r.kind === "group" && r.name === it.group)) listRows.push({ kind: "group", name: it.group, items: amb.items.filter((x) => x.group === it.group) })
  }
  const groups = [...new Set(amb.items.map((i) => i.group).filter((g): g is string => !!g))]
  const itemRow = (it: AmbientItem, depth: number) => {
    const g = geos.get(it.id)
    return (
      <ElementRow
        key={it.id}
        depth={depth}
        icon={isObjItem(it) ? <LuSofa /> : <LuBox />}
        iconColor={isObjItem(it) ? "fg.muted" : "wood.fg"}
        label={names.get(it.id) ?? ""}
        right={g ? `${Math.round(g.w)} × ${Math.round(g.d)}` : undefined}
        active={sel?.kind === "item" && sel.id === it.id}
        inGroup={sel?.kind === "group" && sel.id === it.group}
        onClick={() => (select({ kind: "item", id: it.id }), setTool("select"))}
        menu={
          <>
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
          </>
        }
      />
    )
  }

  // Dreceres de teclat.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable], [role=dialog]")) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
        return
      }
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
        <Tooltip content="Desfer (Ctrl/⌘ Z)">
          <IconButton aria-label="Desfer" size="sm" variant="ghost" disabled={!hist.undo} onClick={undo}>
            <LuUndo2 />
          </IconButton>
        </Tooltip>
        <Tooltip content="Refer (Maj Ctrl/⌘ Z)">
          <IconButton aria-label="Refer" size="sm" variant="ghost" disabled={!hist.redo} onClick={redo}>
            <LuRedo2 />
          </IconButton>
        </Tooltip>
      </TopBarActions>

      <Workspace
        ws={ws}
        left={
          <Stack gap={3}>
            <Stack gap={0.5}>
              {/* Com els grups de l'arbre de l'editor: títol i, a la dreta, què s'hi pot afegir. */}
              <HStack justify="space-between" pb={1} px={1}>
                <SectionLabel>
                  Elements
                </SectionLabel>
                <HStack gap={0.5}>
                  <Button size="2xs" variant="ghost" onClick={() => setPicker(true)}>
                    <LuPlus /> Moble
                  </Button>
                  <Button size="2xs" variant="ghost" onClick={() => setObjPicker(true)}>
                    <LuPlus /> Objecte
                  </Button>
                </HStack>
              </HStack>
              {/* Elements i grups (plegables), amb el menú ⋯ de cada fila, com l'arbre de l'editor. */}
              {listRows.map((r) =>
                r.kind === "group" ? (
                  <Box key={`g:${r.name}`}>
                    <ElementRow
                      icon={<LuGroup />}
                      label={r.name}
                      right={`${r.items.length}`}
                      active={sel?.kind === "group" && sel.id === r.name}
                      folded={folded.includes(r.name)}
                      onFold={() => setFolded(folded.includes(r.name) ? folded.filter((f) => f !== r.name) : [...folded, r.name])}
                      onClick={() => (groupSel(r.name), setTool("select"))}
                      menu={
                        <>
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
                        </>
                      }
                    />
                    {!folded.includes(r.name) && r.items.map((it) => itemRow(it, 1))}
                  </Box>
                ) : (
                  itemRow(r.item, 0)
                ),
              )}
              {amb.walls.length > 0 && (
                <Text fontSize="xs" color="fg.muted" mt={2}>
                  {amb.walls.length} {amb.walls.length === 1 ? "paret" : "parets"} · {formatLength(Math.round(amb.walls.reduce((n, w) => n + wallLength(w), 0)), unit)}
                </Text>
              )}
            </Stack>
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
              />
            ) : sel?.kind === "group" && selIds.length ? (
              <GroupInspector
                key={sel.id}
                name={sel.id}
                items={amb.items.filter((i) => selIds.includes(i.id))}
                names={names}
                onRename={(n) => {
                  change(setItemGroup(amb, selIds, n), true)
                  setSel({ kind: "group", id: n })
                }}
                onMove={(dx, dy) => nudge(dx, dy)}
                onRotate={rotate}
                onDuplicate={duplicate}
                onUngroup={() => (change(setItemGroup(amb, selIds, undefined), true), setSel(null))}
                onDelete={remove}
                onPick={(id) => select({ kind: "item", id })}
              />
            ) : wall ? (
              <WallInspector key={wall.id} wall={wall} materials={settings.materials} onPatch={(p) => patchWall(wall.id, p)} onDelete={remove} />
            ) : (
              <AmbientInspector
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
        center={(chrome) => (
          // Centre: plànol o 3D, amb la barra d'eines flotant (com Figma) i els botons de plegar.
          <Box order={{ base: 0, md: 2 }} flex={{ md: 1 }} minW={0} minH={{ base: "56vh", md: 0 }} h={{ base: "56vh", md: "full" }} position="relative">
          {tab === "plan" ? (
            <PlanCanvas
              ambient={amb}
              geos={geos}
              names={names}
              selection={sel}
              selectedIds={selIds}
              onPickItem={pickItem}
              onSelect={select}
              tool={tool}
              onToolDone={toolDone}
              onChange={change}
              wallDefaults={wallDefaults}
              onCalibrate={(a, b) => setCalib({ a, b })}
              fitSignal={fit}
              show={{ grid: showGrid, dims: showDims, labels: showLabels, detail: showDetail, snap: snapOn, plan: showPlan }}
              onFramedChange={setPlanFramed}
            />
          ) : (
            // Fons del 3D (el visor és transparent): el mateix gris que el plànol.
            <Box position="absolute" inset={0} rounded="md" overflow="hidden" borderWidth="1px" bg="bg.subtle">
              <Ambient3D ambient={amb} geos={geos} materials={settings.materials} onSceneAccess={onSceneAccess} fitSignal={fit} eyeSignal={eye} selectedIds={selIds} onSelect={(id) => (id ? void pickItem(id) : select(null))} onPick={pickItem} onChange={change} snap={snapOn} dollhouse={dollhouse} shadows={shadows} ceiling={ceiling} onPoseChange={setPose} initialCamera={cameraRef.current} onCameraChange={saveCamera} cameraLocked={camLocked} cameraGoto={camGoto} />
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

      {/* Afegir un moble: la mateixa pàgina de Mobles (historial i plantilles) a pantalla completa. */}
      <Drawer.Root open={picker} onOpenChange={(e) => setPicker(e.open)} size="full" placement="bottom">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            {/* A pantalla completa: fora de la barra d'estat del telèfon (zona segura). */}
            <Drawer.Content pt="env(safe-area-inset-top, 0px)" pb="env(safe-area-inset-bottom, 0px)">
              <Drawer.Header>
                <Drawer.Title flex={1}>Afegir un moble a «{name}»</Drawer.Title>
                <Drawer.CloseTrigger asChild top="calc(env(safe-area-inset-top, 0px) + 8px)">
                  <CloseButton size="sm" aria-label="Tancar" />
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body>
                {picker && (
                  <NewMobleGallery
                    storageKey="mobles:ambient-picker"
                    onCreate={(c, n) => createAndAdd(c, n, "moble")}
                    history={(matches, searching) => {
                      const shown = (projects ?? []).filter((p) => !isObject(p) && (!searching || matches(projectSearchText(p))))
                      return {
                        count: shown.length,
                        node: shown.length ? (
                          <SimpleGrid columns={GALLERY_COLS} gap={3}>
                            {shown.map((p) => (
                              <ProjectCard key={p.id} project={p} ambients={membership.get(p.id)} currentAmbient={ambientId} onAdd={() => (addMoble(p), setPicker(false))} />
                            ))}
                          </SimpleGrid>
                        ) : (
                          <Text fontSize="sm" color="fg.muted">
                            {projects?.length ? "Cap moble no coincideix amb la cerca." : "Encara no tens cap moble: comença en blanc o des del catàleg."}
                          </Text>
                        ),
                      }
                    }}
                  />
                )}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* Afegir un objecte: la galeria d'objectes (els teus i les plantilles) a pantalla completa. */}
      <Drawer.Root open={objPicker} onOpenChange={(e) => setObjPicker(e.open)} size="full" placement="bottom">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            {/* A pantalla completa: fora de la barra d'estat del telèfon (zona segura). */}
            <Drawer.Content pt="env(safe-area-inset-top, 0px)" pb="env(safe-area-inset-bottom, 0px)">
              <Drawer.Header>
                <Drawer.Title flex={1}>Afegir un objecte a «{name}»</Drawer.Title>
                <Drawer.CloseTrigger asChild top="calc(env(safe-area-inset-top, 0px) + 8px)">
                  <CloseButton size="sm" aria-label="Tancar" />
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body>
                {objPicker && (
                  <ObjectsGallery
                    storageKey="mobles:ambient-objects"
                    onCreate={(c, n) => createAndAdd(c, n, "object")}
                    history={(matches, searching) => {
                      const shown = (projects ?? []).filter((p) => isObject(p) && (!searching || matches(projectSearchText(p))))
                      return {
                        count: shown.length,
                        node: shown.length ? (
                          <SimpleGrid columns={GALLERY_COLS} gap={3}>
                            {shown.map((p) => (
                              <ProjectCard key={p.id} project={p} ambients={membership.get(p.id)} currentAmbient={ambientId} onAdd={() => (addMoble(p), setObjPicker(false))} />
                            ))}
                          </SimpleGrid>
                        ) : (
                          <Text fontSize="sm" color="fg.muted">
                            {projects?.some(isObject) ? "Cap objecte no coincideix amb la cerca." : "Encara no tens cap objecte: tria'n un de les plantilles o comença en blanc."}
                          </Text>
                        ),
                      }
                    }}
                  />
                )}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

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
}: {
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
        <Box color={item.kind === "moble" ? "wood.fg" : "fg.muted"}>{item.kind === "moble" ? <LuBox /> : <LuSofa />}</Box>
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
            <MobleDims project={project} geo={geo} />
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
          <NumRow label="Fons" value={item.d} min={10} step={10} onChange={(d) => d >= 10 && onPatch({ d })} />
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
function MobleDims({ project, geo }: { project: Project; geo: ItemGeometry }) {
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
    const next = resizeComposition(compositionOf(project), cur, draft)
    const ok = CompositionSchema.safeParse(next)
    if (!ok.success) {
      toaster.create({ title: "No s'ha pogut canviar la mida", description: "Amb aquestes mides alguna part del moble queda fora de límits. Prova-ho a l'editor.", type: "error" })
      return
    }
    if (!(await updateProjectComposition(project.id, next))) {
      toaster.create({ title: "No s'ha pogut canviar la mida", description: "Aquest moble no s'ha pogut llegir bé; obre'l a l'editor.", type: "error" })
    }
  }
  return (
    <FoldItem id="amb-dims" title="Mides generals" icon={LuMoveDiagonal} badge={`${cur.w} × ${cur.h} × ${cur.d}`}>
      <Stack gap={4} onKeyDown={(e) => e.key === "Enter" && void apply()}>
      <NumRow label="Ample" value={draft.w} min={100} step={10} onChange={(w) => setDraft({ ...draft, w })} />
      <NumRow label="Alt" value={draft.h} min={100} step={10} onChange={(h) => setDraft({ ...draft, h })} />
      <NumRow label="Fons" value={draft.d} min={100} step={10} onChange={(d) => setDraft({ ...draft, d })} />
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

function WallInspector({ wall, materials, onPatch, onDelete }: { wall: Wall; materials: MaterialPref[]; onPatch: (p: Partial<Wall>) => void; onDelete: () => void }) {
  const L = Math.round(wallLength(wall))
  return (
    <Stack gap={0}>
      <HStack pb={2}>
        <Box color="fg.muted">
          <LuBrickWall />
        </Box>
        <Text fontWeight="semibold" flex={1}>
          Paret
        </Text>
        <IconButton aria-label="Eliminar la paret" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
          <LuTrash2 />
        </IconButton>
      </HStack>
      <FoldItem id="amb-wall" title="Mides i material" icon={LuRuler} badge={`${L} mm`}>
      <NumRow
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
      />
      <NumRow label="Gruix" value={wall.thickness} min={20} max={1000} step={10} onChange={(thickness) => thickness >= 20 && onPatch({ thickness })} />
      <NumRow label="Alt" value={wall.height} min={200} max={10000} step={10} onChange={(height) => height >= 200 && onPatch({ height })} />
      <MaterialPick label="Material d'aquesta paret" value={wall.material ?? ""} materials={materials} onChange={(material) => onPatch({ material: material || undefined })} onlySim emptyLabel="El de totes les parets" />
      <Text fontSize="xs" color="fg.muted">
        Arrossega-la per moure-la (les parets enganxades la segueixen) o arrossega'n els extrems. Maj: sense angles · Alt: sense imant.
      </Text>
      </FoldItem>
      <FoldItem id="amb-openings" title="Finestres i portes" icon={LuAppWindow} badge={wall.openings?.length || undefined}>
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
      </FoldItem>
    </Stack>
  )
}

function AmbientInspector({
  amb,
  materials,
  wallDefaults,
  onWallDefaults,
  onChange,
  onImportPlan,
  onCalibrate,
}: {
  amb: Ambient
  materials: MaterialPref[]
  wallDefaults: { thickness: number; height: number }
  onWallDefaults: (v: { thickness: number; height: number }) => void
  onChange: (a: Ambient) => void
  onImportPlan: () => void
  onCalibrate: () => void
}) {
  const plan = amb.plan
  return (
    <Stack gap={0}>
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

/** Tria una imatge de plànol i la redueix (2400 px de costat llarg, JPEG). */
function pickPlanImage(): Promise<{ src: string; w: number; h: number } | null> {
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
        const k = Math.min(1, 2400 / Math.max(img.width, img.height))
        const c = document.createElement("canvas")
        c.width = Math.round(img.width * k)
        c.height = Math.round(img.height * k)
        const g = c.getContext("2d")!
        g.fillStyle = "#ffffff"
        g.fillRect(0, 0, c.width, c.height)
        g.drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        resolve({ src: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height })
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

/** Fila de la llista d'elements (com les de l'arbre de l'editor): icona, nom, mida i menú ⋯. */
function ElementRow({
  icon,
  iconColor = "wood.fg",
  label,
  right,
  active,
  inGroup,
  depth = 0,
  folded,
  onFold,
  onClick,
  menu,
}: {
  icon: ReactNode
  iconColor?: string
  label: string
  right?: string
  active: boolean
  inGroup?: boolean
  depth?: number
  folded?: boolean
  onFold?: () => void
  onClick: () => void
  menu: ReactNode
}) {
  return (
    <HStack gap={1} pl={1 + depth * 4} pr={1} py={1} rounded="md" bg={active ? "wood.subtle" : inGroup ? "bg.muted" : undefined} _hover={{ bg: active ? "wood.subtle" : "bg.muted" }}>
      {onFold && (
        <IconButton aria-label={folded ? "Desplegar el grup" : "Plegar el grup"} size="2xs" variant="ghost" onClick={onFold}>
          {folded ? <LuChevronRight /> : <LuChevronDown />}
        </IconButton>
      )}
      <HStack as="button" gap={2} flex={1} minW={0} textAlign="left" onClick={onClick}>
        <Box color={iconColor} flexShrink={0}>
          {icon}
        </Box>
        {/* El nom sencer a la primera línia i la mida a sota (no li treu lloc al nom); els grups, el
            nombre d'elements al costat. */}
        {onFold ? (
          <>
            <Text fontSize="sm" truncate flex={1} fontWeight="semibold" title={label}>
              {label}
            </Text>
            {right && (
              <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                {right}
              </Text>
            )}
          </>
        ) : (
          <Stack gap={0} flex={1} minW={0}>
            <Text fontSize="sm" truncate title={label}>
              {label}
            </Text>
            {right && (
              <Text fontSize="xs" color="fg.muted" truncate>
                {right}
              </Text>
            )}
          </Stack>
        )}
      </HStack>
      <Menu.Root positioning={{ placement: "bottom-end" }}>
        <Menu.Trigger asChild>
          <IconButton aria-label={`Accions de «${label}»`} size="2xs" variant="ghost">
            <LuEllipsis />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>{menu}</Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </HStack>
  )
}

/** Propietats d'un grup: nom, moure i girar el grup sencer, duplicar, desagrupar i eliminar. */
function GroupInspector({
  name,
  items,
  names,
  onRename,
  onMove,
  onRotate,
  onDuplicate,
  onUngroup,
  onDelete,
  onPick,
}: {
  name: string
  items: AmbientItem[]
  names: Map<string, string>
  onRename: (n: string) => void
  onMove: (dx: number, dy: number) => void
  onRotate: (deg: number) => void
  onDuplicate: () => void
  onUngroup: () => void
  onDelete: () => void
  onPick: (id: string) => void
}) {
  const cx = Math.round((Math.min(...items.map((i) => i.x)) + Math.max(...items.map((i) => i.x))) / 2)
  const cy = Math.round((Math.min(...items.map((i) => i.y)) + Math.max(...items.map((i) => i.y))) / 2)
  return (
    <Stack gap={0}>
      <HStack gap={2} pb={2}>
        <Box color="wood.fg">
          <LuGroup />
        </Box>
        <Editable.Root key={name} defaultValue={name} onValueCommit={(e) => e.value.trim() && e.value.trim() !== name && onRename(e.value.trim())} fontWeight="semibold" flex={1} minW={0} aria-label="Nom del grup">
          <Editable.Preview truncate title="Clica per canviar el nom" />
          <Editable.Input />
        </Editable.Root>
        <Tooltip content="Duplicar el grup (Ctrl/⌘ D)">
          <IconButton aria-label="Duplicar el grup" size="xs" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
        </Tooltip>
        <Tooltip content="Desagrupar">
          <IconButton aria-label="Desagrupar" size="xs" variant="ghost" onClick={onUngroup}>
            <LuUngroup />
          </IconButton>
        </Tooltip>
        <Tooltip content="Eliminar el grup (Supr)">
          <IconButton aria-label="Eliminar el grup" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </Tooltip>
      </HStack>
      <FoldItem id="amb-group-place" title="Posició del grup" icon={LuMove}>
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
      </FoldItem>
      <FoldItem id="amb-group-items" title="Elements" icon={LuGroup} badge={items.length}>
        <Stack gap={1}>
        {items.map((i) => (
          <Button key={i.id} size="xs" variant="ghost" justifyContent="flex-start" onClick={() => onPick(i.id)}>
            {names.get(i.id)}
          </Button>
        ))}
        <Text fontSize="xs" color="fg.muted">
          Com a l'editor: el primer clic a un element agrupat tria el grup; el segon, l'element.
        </Text>
        </Stack>
      </FoldItem>
    </Stack>
  )
}
