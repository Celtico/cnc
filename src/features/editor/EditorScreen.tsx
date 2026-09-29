import { Alert, Badge, Box, Button, Editable, CloseButton, Drawer, Field, Flex, HStack, IconButton, Popover, Portal, SegmentGroup, SimpleGrid, Stack, Text, useBreakpointValue } from "@chakra-ui/react"
import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  LuArrowDownToLine,
  LuBox,
  LuBrickWall,
  LuFrame,
  LuMove,
  LuChevronLeft,
  LuChevronRight,
  LuPalette,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPanelRightClose,
  LuPanelRightOpen,
  LuPanelTop,
  LuCamera,
  LuCircleDot,
  LuDoorOpen,
  LuExpand,
  LuHammer,
  LuLayoutPanelLeft,
  LuListTree,
  LuMaximize2,
  LuMinimize2,
  LuMoveDiagonal,
  LuRedo2,
  LuScan,
  LuShrink,
  LuSparkles,
  LuShapes,
  LuTrees,
  LuVideo,
  LuSlidersHorizontal,
  LuSlidersVertical,
  LuTriangleAlert,
  LuUndo2,
  LuView,
} from "react-icons/lu"
import { PanelSection } from "../../components/PanelSection"
import { ResizeHandle } from "../../components/ResizeHandle"
import { TopBarActions } from "../../components/TopBar"
import { toaster } from "../../components/ui/toaster"
import { CabinetViewer, type ViewerModule, type ZoneLight } from "../../components/viewer/CabinetViewer"
import { ArDialog } from "../../components/viewer/ArDialog"
import { useRenderQuality } from "../../components/viewer/renderQuality"
import { movingGroups, openingCollisions } from "../../components/viewer/opening"
import { panelBox } from "../../core/build/buildComposition"
import { applySettingsToModule, compositionHeight, compositionWidth, defaultModule, deleteZone, findZone, insertModuleCopy, moveAllBy, moveModuleBy, insertRefCopy, anchorRef, mountOf, compositionKind, tableModule, parentOf, pasteZone, rowOf, walkZones, newId, type Composition, type Module, type RefObject, type Zone } from "../../core/model"
import { updateProjectComposition } from "../../db/compositionStore"
import type { Project } from "../../db/db"
import { CarcassForm, JoineryForm, MaterialsForm } from "../composition/CarcassForm"
import { ElevationEditor } from "../composition/ElevationEditor"
import { RefActions, RefInspector } from "../composition/RefInspector"
import { StructureTree, type Selection } from "../composition/StructureTree"
import { Tooltip } from "../../components/ui/tooltip"
import { ZoneActions, ZonePanel } from "../composition/ZonePanel"
import { RunsForm } from "../composition/RunsForm"
import { zoneLabel } from "../composition/zoneLabel"
import { zoneIcon } from "../composition/zoneIcon"
import { downloadBlob, slugify } from "../download"
import { NumberField } from "./ParamsForm"
import { ESTIMATED_WARNING, estimatedApplied } from "../photo/appliedState"
import { PhotoScreen } from "../photo/PhotoScreen"
import { useSettings } from "../settings/SettingsContext"
import { usePersistentFlag } from "../usePersistentFlag"
import { usePersistentNumber } from "../usePersistentNumber"
import { useComposition, useCompositionBuild, useProject } from "../useProject"
import { RoleLegend } from "../../components/viewer/roleColors"
import { IconChoice } from "../../components/IconChoice"
import { KINDS } from "../composition/kinds"
import { ViewBar, ViewerControls, type ViewerState } from "./ViewerControls"

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
const VIEW_MODES: [ViewMode, string, string, typeof LuShapes][] = [
  ["pieces", "Per peça", "cada tipus de peça d'un color, ràpid i amb guies", LuShapes],
  ["texture", "Textura", "materials i veta, ràpid i amb guies", LuTrees],
  ["presentation", "Presentació", "ombres, terra i paret, sense guies", LuSparkles],
]

export function EditorScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const initial = useComposition(project)
  if (!project || !initial) return null
  return <Editor key={project.id} projectId={project.id} name={project.name} initial={initial} project={project} />
}

interface History {
  past: Composition[]
  present: Composition
  future: Composition[]
}

/** Porta-retalls de l'editor (mòdul, objecte o compartiment). */
type Clip = { kind: "module"; data: Module; label: string } | { kind: "ref"; data: RefObject; label: string } | { kind: "zone"; data: Zone; label: string }
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
    const raw = localStorage.getItem(CLIP_KEY)
    if (raw) return JSON.parse(raw) as Clip
  } catch {
    /* només en memòria */
  }
  return memClip
}

/** Símbol de la tecla de drecera: ⌘ al Mac/iPad, Ctrl a la resta. */
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl+"

function Editor({ projectId, name, initial, project }: { projectId: number; name: string; initial: Composition; project: Project }) {
  // Composició amb desfer/refer (fins a 50 passos).
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] })
  const comp = history.present
  // Canvis seguits (menys de 500 ms entre ells, p. ex. escriure "1180" o arrossegar)
  // compten com un sol pas de desfer.
  const lastEdit = useRef(0)
  const setComp = (next: Composition | ((c: Composition) => Composition)) =>
    setHistory((h) => {
      const n = typeof next === "function" ? next(h.present) : next
      if (n === h.present) return h
      const now = Date.now()
      const coalesce = now - lastEdit.current < 500 && h.past.length > 0
      lastEdit.current = now
      if (coalesce) return { past: h.past, present: n, future: [] }
      return { past: [...h.past.slice(-49), h.present], present: n, future: [] }
    })
  const undo = () => {
    lastEdit.current = 0
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h))
  }
  const redo = () => {
    lastEdit.current = 0
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) } : h))
  }

  // Dreceres: ⌘Z / Ctrl+Z desfer; ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y refer. Als camps de text
  // lliure (nom del moble, plantilla) es deixa el desfer propi del navegador; als
  // numèrics es desfà el moble.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const k = e.key.toLowerCase()
      if (k !== "z" && k !== "y") return
      const t = e.target as HTMLElement | null
      if (t) {
        const tag = t.tagName
        const numeric = tag === "INPUT" && /decimal|numeric/.test((t as HTMLInputElement).inputMode)
        if (tag === "TEXTAREA" || t.isContentEditable || (tag === "INPUT" && !numeric)) return
      }
      e.preventDefault()
      if (k === "y" || e.shiftKey) redo()
      else undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Selecció única (arbre, 3D i alçat van sincronitzats): moble, mòdul, compartiment o objecte.
  const [selectedModule, setSelectedModule] = useState<string>(initial.modules[0]!.id)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [selKind, setSelKind] = useState<"moble" | "module" | "zone" | "ref">("module")
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  // Mòbil: sota el visor, pestanyes Estructura / Propietats.
  const [mobilePane, setMobilePane] = useState<"tree" | "props">("props")
  const [exploded, setExploded] = useState(false)
  // Tornar a encuadrar la càmera (editar ja no la mou).
  const [fitKey, setFitKey] = useState(0)
  // El botó d'encuadrar surt marcat mentre la càmera és a l'encuadrament.
  const [framed, setFramed] = useState(true)
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false
  const [showHoles, setShowHoles] = useState(false)
  // «Veure a casa»: visor 3D amb el botó d'AR Quick Look (Safari a l'iPhone/iPad).
  const [arOpen, setArOpen] = useState(false)
  // Visor: vista, obertura de portes i calaixos, colors.
  // En mode Ràpida, per defecte colors per tipus de peça (més clar per treballar);
  // en mode Presentació sempre els materials reals.
  const [roleColors, setRoleColors] = usePersistentFlag("mobles:viewer-role-colors-fast", true)
  const [quality, setQuality] = useRenderQuality()
  const [viewer, setViewerState] = useState<Omit<ViewerState, "materialMode">>({ view: "3d", opening: 0, openOnlySelected: false })
  const viewerState: ViewerState = { ...viewer, materialMode: quality === "fast" && roleColors ? "role" : "material" }
  // Mode del visor: Per peça (ràpid, colors per tipus), Textura (ràpid, materials) o Presentació.
  const viewMode: ViewMode = quality === "presentation" ? "presentation" : roleColors ? "pieces" : "texture"
  const setViewMode = (m: ViewMode) => {
    setQuality(m === "presentation" ? "presentation" : "fast")
    if (m !== "presentation") setRoleColors(m === "pieces")
  }
  const setViewer = (patch: Partial<ViewerState>) => {
    const { materialMode, ...rest } = patch
    if (materialMode) setRoleColors(materialMode === "role")
    if (Object.keys(rest).length) setViewerState((v) => ({ ...v, ...rest }))
  }
  const capture = useRef<(() => Promise<Blob>) | null>(null)
  const registerCapture = useCallback((fn: () => Promise<Blob>) => {
    capture.current = fn
  }, [])
  // Amaga el panell de paràmetres perquè el 3D ocupi tot l'espai.
  const [formHidden, setFormHidden] = usePersistentFlag("mobles:editor-form-hidden")
  // A l'ordinador, cada panell lateral es plega pel seu compte (com les barres laterals
  // d'una app d'escriptori): l'arbre a l'esquerra i les propietats a la dreta.
  const [treeHidden, setTreeHidden] = usePersistentFlag("mobles:editor-tree-hidden")
  const [propsHidden, setPropsHidden] = usePersistentFlag("mobles:editor-props-hidden")
  // Amplades dels panells laterals: s'arrosseguen per la vora (com el separador de l'app de
  // Claude) i es recorden. Si la finestra és estreta, els panells s'encongeixen fins al seu
  // mínim abans que el visor es faci més petit que el seu mínim.
  const [formWidth, setFormWidth] = usePersistentNumber("mobles:editor-inspector-width", 340)
  const [treeWidth, setTreeWidth] = usePersistentNumber("mobles:editor-tree-width", 280)
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
  const panels = build?.panels ?? []
  const panelsRef = useRef(panels)
  panelsRef.current = panels

  // Desa amb retard quan la composició canvia. Si se surt de l'Editor (o es tanca
  // l'app) abans del retard, el canvi pendent es desa igualment: si no, Exportar
  // llegiria la versió anterior.
  const pendingSave = useRef<Composition | null>(null)
  useEffect(() => {
    if (comp === initial) return
    pendingSave.current = comp
    const t = setTimeout(() => {
      pendingSave.current = null
      void updateProjectComposition(projectId, comp)
    }, 350)
    return () => clearTimeout(t)
  }, [comp, projectId, initial])
  useEffect(() => {
    const flush = () => {
      const c = pendingSave.current
      if (!c) return
      pendingSave.current = null
      void updateProjectComposition(projectId, c)
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") flush()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
    window.addEventListener("mobles:flush-save", flush)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("mobles:flush-save", flush)
      flush() // en sortir de l'Editor
    }
  }, [projectId])

  const kind = compositionKind(comp)
  const module: Module = comp.modules.find((m) => m.id === selectedModule) ?? comp.modules[0]!
  const moduleIndex = comp.modules.indexOf(module)
  // Posició dins de la seva fila (a terra o penjats) i el mòdul anterior de la fila.
  const rowMates = comp.modules.filter((m) => rowOf(m) === rowOf(module))
  const rowIndex = rowMates.indexOf(module)
  const rowPrev = rowIndex > 0 ? rowMates[rowIndex - 1] : undefined
  const moduleBuild = build?.modules[moduleIndex]?.build
  const zone = selectedZone ? findZone(module.root, selectedZone) : undefined

  const size = useMemo(() => {
    let h = compositionHeight(comp)
    let d = 0
    for (const m of comp.modules) d = Math.max(d, (mountOf(m) === "floor" ? (m.wallGap ?? 0) : 0) + m.carcass.depth + m.carcass.thickness)
    for (const g of comp.references) {
      h = Math.max(h, g.y + g.h)
      d = Math.max(d, g.z + g.d)
    }
    return { width: Math.max(compositionWidth(comp), ...comp.references.map((g) => g.x + g.w)), height: h, depth: d }
  }, [comp])

  const viewerModules: ViewerModule[] = useMemo(
    () =>
      (build?.modules ?? []).map((m) => {
        const c = comp.modules[m.index - 1]!.carcass
        const mod = comp.modules[m.index - 1]!
        return { id: m.id, index: m.index, x: m.x, y: m.y, z: m.z, width: c.width, height: c.height, depth: c.depth + c.thickness, wall: c.base.kind === "wall", free: mountOf(mod) === "floor" }
      }),
    [build, comp],
  )

  const updateModule = (m: Module) => setComp((c) => ({ ...c, modules: c.modules.map((x) => (x.id === m.id ? m : x)) }))

  const selection: Selection =
    selKind === "moble"
      ? { kind: "moble" }
      : selKind === "ref" && selectedRef && comp.references.some((r) => r.id === selectedRef)
        ? { kind: "ref", id: selectedRef }
        : selectedZone && zone
          ? { kind: "zone", moduleId: module.id, zoneId: selectedZone }
          : { kind: "module", id: module.id }
  const select = (s: Selection, fromPanel = false) => {
    if (s.kind === "moble") setSelKind("moble")
    else if (s.kind === "ref") {
      setSelectedRef(s.id)
      setSelKind("ref")
    } else if (s.kind === "module") {
      setSelectedModule(s.id)
      setSelectedZone(null)
      setSelKind("module")
    } else {
      setSelectedModule(s.moduleId)
      setSelectedZone(s.zoneId)
      setSelKind("zone")
    }
    // Al mòbil, triar a l'arbre porta a les propietats.
    if (fromPanel) setMobilePane("props")
  }
  const selectModule = (id: string) => select({ kind: "module", id })
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
  const selectZone = (id: string) => select({ kind: "zone", moduleId: module.id, zoneId: id })

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
    const current = (): Clip | null => {
      if (selection.kind === "module") {
        const m = comp.modules.find((x) => x.id === selection.id)
        return m ? { kind: "module", data: m, label: m.name } : null
      }
      if (selection.kind === "ref") {
        const r = comp.references.find((x) => x.id === selection.id)
        return r ? { kind: "ref", data: r, label: r.name } : null
      }
      if (selection.kind === "zone" && zone) return { kind: "zone", data: zone, label: zoneLabel(zone) }
      return null
    }
    const paste = (clip: Clip) => {
      if (clip.kind === "module") {
        const res = insertModuleCopy(comp, clip.data, selection.kind === "module" ? selection.id : selection.kind === "zone" ? selection.moduleId : undefined)
        setComp(res.comp)
        select({ kind: "module", id: res.id })
      } else if (clip.kind === "ref") {
        const res = insertRefCopy(comp, clip.data)
        setComp(res.comp)
        select({ kind: "ref", id: res.id })
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
    if (mod && (key === "c" || key === "x")) {
      const clip = current()
      if (!clip) return
      e.preventDefault()
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
    if (mod && key === "d") {
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
    function remove() {
      if (selection.kind === "module") {
        if (comp.modules.length <= 1) {
          toaster.create({ title: "El moble ha de tenir almenys un mòdul", type: "info" })
          return
        }
        const i = comp.modules.findIndex((x) => x.id === selection.id)
        const modules = comp.modules.filter((x) => x.id !== selection.id)
        setComp({ ...comp, modules })
        select({ kind: "module", id: modules[Math.max(0, i - 1)]!.id })
      } else if (selection.kind === "ref") {
        setComp({ ...comp, references: comp.references.filter((r) => r.id !== selection.id) })
        select({ kind: "moble" })
      } else if (selection.kind === "zone") {
        const parent = parentOf(module.root, selection.zoneId)
        updateModule({ ...module, root: deleteZone(module.root, selection.zoneId) })
        if (parent && parent.id !== module.root.id) select({ kind: "zone", moduleId: module.id, zoneId: parent.id })
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
    if (selection.kind !== "ref" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
    const r = comp.references.find((o) => o.id === selection.id)
    if (!r) return
    const k = e.shiftKey ? 10 : 1
    const d = { ArrowLeft: [-k, 0, 0], ArrowRight: [k, 0, 0], ArrowUp: [0, k, 0], ArrowDown: [0, -k, 0], PageUp: [0, 0, k], PageDown: [0, 0, -k] }[e.key]
    if (!d) return
    e.preventDefault()
    moveRef(r.id, { x: r.x + d[0]!, y: Math.max(0, r.y + d[1]!), z: r.z + d[2]! })
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
    const inside = (selection.kind === "module" && selection.id === id) || (selection.kind === "zone" && selection.moduleId === id)
    const idx = comp.modules.findIndex((m) => m.id === id)
    const mb = build?.modules[idx]
    const mod = comp.modules[idx]
    if (!inside || !at || !mb || !mod) return selectModule(id)
    const lx = at[0] - mb.x
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
        return parent && parent.id !== mod.root.id ? select({ kind: "zone", moduleId: id, zoneId: parent.id }) : selectModule(id)
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
    if (selection.kind === "ref") return around(comp.references, comp.references.findIndex((r) => r.id === selection.id), (r) => ({ kind: "ref", id: r.id }))
    if (selection.kind === "zone" && zone && moduleBuild) {
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
  }, [selection, comp.modules, comp.references, zone, module, moduleBuild])

  /** Enganxa un mòdul nou al costat del seleccionat, amb la mateixa alçada i fondària. */
  const addModuleBeside = (side: "left" | "right") => {
    const fresh = applySettingsToModule(settings, defaultModule(newId("m"), `Mòdul ${comp.modules.length + 1}`))
    const m: Module = {
      ...fresh,
      carcass: {
        ...fresh.carcass,
        width: 600,
        height: module.carcass.height,
        depth: module.carcass.depth,
        material: module.carcass.material,
        thickness: module.carcass.thickness,
        base: module.carcass.base,
        back: module.carcass.back,
      },
    }
    const modules = [...comp.modules]
    modules.splice(side === "left" ? moduleIndex : moduleIndex + 1, 0, { ...m, gapBefore: 0 })
    setComp({ ...comp, modules })
    selectModule(m.id)
  }



  const warnings = build?.warnings ?? []
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
    if (!mod) return null
    const c = module.carcass
    // Mòdul seleccionat: només el contorn, sense vel (el mòdul ja es veu translúcid).
    if (selection.kind === "module")
      return { x0: mod.x, x1: mod.x + c.width, y0: mod.y, y1: mod.y + c.height, z0: mod.z, z1: mod.z + c.depth + c.thickness, veil: false }
    if (selection.kind !== "zone" || !zoneRect) return null
    return { x0: mod.x + zoneRect.x0, x1: mod.x + zoneRect.x1, y0: mod.y + zoneRect.y0, y1: mod.y + zoneRect.y1, z0: mod.z, z1: mod.z + c.depth + c.thickness }
  }, [selection.kind, zoneRect, build, moduleIndex, module.carcass, comp.modules.length])
  const openOnly = useMemo(() => {
    if (!viewer.openOnlySelected || !zoneRect || !build) return null
    const mod = build.modules[moduleIndex]
    if (!mod) return null
    const x0 = mod.x + zoneRect.x0
    const x1 = mod.x + zoneRect.x1
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
  const lights = useMemo<ZoneLight[]>(
    () => (build?.modules ?? []).flatMap((m) => m.build.layout.leaves.map((z) => {
      const r = m.build.layout.rects.get(z.id)!
      return { module: m.index, x0: m.x + r.x0, x1: m.x + r.x1, y0: m.y + r.y0, y1: m.y + r.y1 }
    })),
    [build],
  )
  const downloadImage = async () => {
    if (!capture.current) return
    try {
      downloadBlob(await capture.current(), `${slugify(name)}-${viewer.view}.png`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar la imatge", description: String(e), type: "error" })
    }
  }

  // Avisos de la selecció: del mòdul (inclosos els xocs d'objectes amb les seves peces),
  // de l'objecte de referència seleccionat, o tots si és el moble.
  const moduleWarnings =
    selection.kind === "module" || selection.kind === "zone"
      ? warnings.filter((w) => !w.moduleId || w.moduleId === module.id)
      : selection.kind === "ref"
        ? warnings.filter((w) => w.refId === selection.id)
        : warnings
  const collidingRefs = useMemo(() => new Set(warnings.flatMap((w) => (w.refId ? [w.refId] : []))), [warnings])

  // --- Inspector: propietats del que hi ha seleccionat ---------------------------
  // A la pestanya Foto, l'inspector mostra el calibratge quan no hi ha res seleccionat (el
  // moble sencer); si es tria un mòdul, un compartiment o un objecte, en mostra les propietats.
  const photoInspector = photoTab && selection.kind === "moble"
  // Títol en dues línies: on és (petit i apagat) i què és (el nom), perquè no es talli.
  const renameRef = (id: string, v: string) => setComp((c) => ({ ...c, references: c.references.map((r) => (r.id === id ? { ...r, name: v } : r)) }))
  const inspectorTitle: { icon: ReactNode; text: string; parent?: string; onRename?: (v: string) => void } = photoInspector
    ? { icon: <LuCamera />, text: "Foto del lloc" }
    : selection.kind === "moble"
      ? { icon: <LuBox />, text: name || "Moble" }
      : selection.kind === "ref"
        ? { icon: <LuScan />, text: comp.references.find((r) => r.id === selection.id)?.name ?? "Objecte", parent: "Objecte de referència", onRename: (v) => renameRef(selection.id, v) }
        : selection.kind === "zone" && zone
          ? { icon: createElement(zoneIcon(zone)), text: zoneLabel(zone), parent: module.name }
          : { icon: <LuBox />, text: module.name, parent: name || "Moble", onRename: (v) => updateModule({ ...module, name: v }) }

  // Accions ràpides del visor, a dalt de «Opcions de vista» (com el menú de visualització
  // de Fusion o Blender): el mode en un grup i la resta com a botons amb icona i nom.
  const tile = (key: string, label: string, icon: ReactNode, on: boolean, onClick: () => void, tip?: string) => (
    <Button key={key} size="xs" h="auto" py={2} px={1} flexDirection="column" gap={1} variant={on ? "solid" : "outline"} colorPalette={on ? "wood" : "gray"} aria-pressed={on} title={tip ?? label} onClick={onClick} fontSize="2xs" fontWeight="medium" whiteSpace="normal" lineHeight="1.1">
      {icon}
      {label}
    </Button>
  )
  const viewQuick = (
    <Stack gap={3} mb={4} pb={4} borderBottomWidth="1px">
      <SimpleGrid columns={3} gap={1.5}>
        {VIEW_MODES.map(([v, label, tip, Icon]) => tile(v, label, <Icon />, viewMode === v, () => setViewMode(v), `${label}: ${tip}`))}
      </SimpleGrid>
      <SimpleGrid columns={4} gap={1.5}>
        {tile("fit", "Encuadrar", <LuVideo />, framed, () => setFitKey((k) => k + 1), framed ? "Càmera encuadrada (no es mou sola en editar)" : "Encuadrar el moble")}
        {tile("holes", "Forats", <LuCircleDot />, showHoles, () => setShowHoles((v) => !v), showHoles ? "Amagar forats" : "Mostrar forats")}
        {tile("explode", "Explosió", exploded ? <LuShrink /> : <LuExpand />, exploded, () => setExploded((v) => !v), exploded ? "Vista muntada" : "Vista explosionada")}
        {tile("ar", "A casa (AR)", <LuView />, false, () => setArOpen(true), "Veure a casa (realitat augmentada)")}
      </SimpleGrid>
    </Stack>
  )

  // Sense separació entre blocs: les seccions plegables van enganxades (totes amb la
  // mateixa alçada de capçalera); els elements que no són secció porten el seu marge.
  const inspector = (
    <Stack gap={0}>
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
        {!photoInspector && selection.kind === "zone" && zone && (
          <ZoneActions root={module.root} zone={zone} onChange={(root) => updateModule({ ...module, root })} onSelect={selectZone} />
        )}
        {!photoInspector && selection.kind === "ref" && (
          <RefActions comp={comp} id={selection.id} onChange={setComp} onRemoved={() => select({ kind: "moble" })} onSelected={(id) => select({ kind: "ref", id })} />
        )}
      </HStack>

      {photoTab && !photoInspector && (
        <Button size="xs" variant="outline" alignSelf="flex-start" mb={2} onClick={() => select({ kind: "moble" })}>
          <LuCamera /> Tornar a la foto del lloc
        </Button>
      )}
      {photoInspector ? (
        <Box ref={setPhotoControls} />
      ) : selection.kind === "moble" ? (
        <Stack gap={0}>
          <PanelSection id="moble-summary" title="Resum" icon={LuBox}>
            <Text fontSize="sm" color="fg.muted">
              {comp.modules.length} {comp.modules.length === 1 ? "mòdul" : "mòduls"} · {size.width} × {size.height} × {size.depth} mm
            </Text>
            <HStack gap={2} wrap="wrap">
              <Badge variant="subtle">{panels.length} peces</Badge>
              <Badge variant="subtle">{totalHoles} forats</Badge>
              {comp.references.length > 0 && <Badge variant="subtle">{comp.references.length} objectes de referència</Badge>}
            </HStack>
            <Text fontSize="xs" color="fg.muted">
              Selecciona un mòdul, un compartiment o un objecte a l'estructura (o clica'l al 3D) per editar-lo.
            </Text>
          </PanelSection>
          {/* Tipus de moble: decideix les opcions de conjunt (taulell i sòcol només a la cuina). */}
          <PanelSection id="moble-kind" title="Tipus" icon={KINDS.find((k) => k.value === kind)!.icon} badge={KINDS.find((k) => k.value === kind)!.label}>
            <IconChoice label="Tipus de moble" value={kind} options={KINDS} onChange={(k) => setComp((c) => ({ ...c, kind: k }))} />
            <Text fontSize="xs" color="fg.muted">
              {kind !== "cuina" && comp.runs?.length
                ? `Aquest moble té ${comp.runs.length === 1 ? "un taulell o sòcol corregut" : `${comp.runs.length} taulells o sòcols correguts`}: només es fan a la Cuina. Es guarden per si hi tornes. `
                : ""}
              {kind === "cuina"
                ? "Cuina: baixos a terra i alts penjats, amb taulell i sòcol correguts per sobre i per sota de diversos mòduls."
                : kind === "armari"
                  ? "Armari: mòduls alts; les portes i els prestatges van a cada mòdul."
                  : kind === "taula"
                    ? "Taula o consola: cada mòdul és un tauler amb dos laterals de panell. Les mides, a Mides; les cantonades a inglet i els laterals, a Estructura."
                    : "Moble: mòduls lliures (TV, calaixera, prestatgeria…)."}
            </Text>
          </PanelSection>
          {kind === "cuina" && (
            <PanelSection id="moble-runs" title="Taulell i sòcol" icon={LuPanelTop} badge={comp.runs?.length || undefined}>
              <RunsForm comp={comp} onChange={setComp} />
            </PanelSection>
          )}
          <PanelSection id="moble-materials" title="Materials de tot el moble" icon={LuPalette}>
            <MaterialsForm
              carcass={comp.modules[0]!.carcass}
              mixed={comp.modules.some((m) => {
                const a = m.carcass
                const b = comp.modules[0]!.carcass
                return a.material !== b.material || (a.frontMaterial ?? "") !== (b.frontMaterial ?? "") || a.backMaterial !== b.backMaterial || a.thickness !== b.thickness || a.backThickness !== b.backThickness
              })}
              onPatch={(patch) => setComp((c) => ({ ...c, modules: c.modules.map((m) => ({ ...m, carcass: { ...m.carcass, ...patch } })) }))}
            />
          </PanelSection>
        </Stack>
      ) : selection.kind === "ref" ? (
        <RefInspector comp={comp} id={selection.id} onChange={setComp} />
      ) : selection.kind === "zone" && zone ? (
        <Stack gap={3}>
          <ZonePanel root={module.root} zone={zone} openRatio={moduleBuild?.openRatios[zone.id]} onChange={(root) => updateModule({ ...module, root })} />
        </Stack>
      ) : (
        // Seccions plegables independents (com Figma o Fusion): es poden tenir diverses
        // obertes i cada una recorda el seu estat.
        <Stack gap={0}>
          <PanelSection id="mod-dims" title="Mides" icon={LuMoveDiagonal} badge={`${module.carcass.width} × ${module.carcass.height}`}>
            <CarcassForm module={module} onChange={updateModule} section="dims" />
          </PanelSection>
            <PanelSection id="mod-position" title="Posició" icon={LuMove} badge={module.carcass.base.kind === "wall" ? `Penjat a ${module.carcass.base.height}` : mountOf(module) === "floor" ? `Al terra · ${module.wallGap ?? 0} de la paret` : "A la paret"}>
              {/* Dues files, com les cuines: a terra (baixos) i penjats (alts). Dins de cada
                  fila, l'ordre és el de l'arbre (d'esquerra a dreta) i cada mòdul va al costat
                  de l'anterior de la seva fila. */}
              <Field.Root>
                <Field.Label>Fila</Field.Label>
                <SimpleGrid columns={3} gap={1.5}>
                  {(
                    [
                      ["wall", "A la paret", LuBrickWall, "A terra, arrambat a la paret: es mou de costat"],
                      ["hung", "Penjat", LuPanelTop, "Penjat a la paret: es mou de costat i amunt/avall"],
                      ["floor", "Al terra", LuArrowDownToLine, "Al terra, lliure: es mou pel terra, també separat de la paret"],
                    ] as const
                  ).map(([v, label, Icon, tip]) => {
                    const on = mountOf(module) === v
                    return (
                      <Button
                        key={v}
                        size="sm"
                        px={2}
                        variant={on ? "solid" : "outline"}
                        colorPalette="wood"
                        aria-pressed={on}
                        title={tip}
                        onClick={() => {
                          if (on) return
                          const c = module.carcass
                          const wasHung = c.base.kind === "wall"
                          const { wallGap: _old, ...rest } = module
                          if (v === "hung") updateModule({ ...rest, gapBefore: 0, carcass: { ...c, base: { kind: "wall", height: 1450 } } })
                          else {
                            const base = wasHung ? ({ kind: "none" } as const) : c.base
                            updateModule({ ...rest, ...(v === "floor" ? { wallGap: 0 } : {}), gapBefore: wasHung ? 0 : module.gapBefore, carcass: { ...c, base } })
                          }
                        }}
                      >
                        <Icon /> {label}
                      </Button>
                    )
                  })}
                </SimpleGrid>
                <Field.HelperText>
                  {mountOf(module) === "hung"
                    ? "Al 3D, arrossega la maneta del mòdul: es mou per la paret, de costat i amunt/avall (Maj: tot el moble)."
                    : mountOf(module) === "floor"
                      ? "Al 3D, arrossega la maneta del mòdul: es mou pel terra, de costat i endavant/enrere (Maj: tot el moble)."
                      : "Al 3D, arrossega la maneta del mòdul: llisca de costat tocant la paret (Maj: tot el moble)."}
                </Field.HelperText>
              </Field.Root>
              {module.carcass.base.kind === "wall" && (
                <NumberField
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
                <NumberField
                  label="Separació de la paret"
                  value={module.wallGap ?? 0}
                  min={0}
                  max={10000}
                  step={10}
                  onChange={(wallGap) => updateModule({ ...module, wallGap })}
                  help="Del darrere del mòdul a la paret."
                />
              )}
              <NumberField
                label={rowIndex > 0 ? "Separació amb l'anterior" : "Separació des de l'inici"}
                value={module.gapBefore}
                min={0}
                max={5000}
                step={10}
                onChange={(g) => updateModule({ ...module, gapBefore: g })}
                help={rowIndex > 0 ? `Des de «${rowPrev!.name}», a l'esquerra en la mateixa fila.` : "És el primer de la fila: la distància des de l'esquerra del moble."}
              />
            </PanelSection>
          <PanelSection id="mod-structure" title="Estructura" icon={LuFrame}>
            <CarcassForm module={module} onChange={updateModule} section="structure" />
          </PanelSection>
          <PanelSection id="mod-materials" title="Materials" icon={LuPalette}>
            <MaterialsForm carcass={module.carcass} onPatch={(patch) => updateModule({ ...module, carcass: { ...module.carcass, ...patch } })} />
          </PanelSection>
          <PanelSection id="mod-joinery" title="Fusteria (avançat)" icon={LuHammer} defaultOpen={false}>
            <JoineryForm module={module} onChange={updateModule} />
          </PanelSection>
        </Stack>
      )}

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
          <Stack gap={2} mt={3}>
            <HStack gap={2} color="fg.muted">
              <LuDoorOpen />
              <Text fontSize="sm" fontWeight="semibold">
                Amb l'obertura actual
              </Text>
            </HStack>
            {collisions.map((c) => (
              <Alert.Root key={c.groupId} status="warning" size="sm">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{c.message}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            ))}
          </Stack>
        )}

        {moduleWarnings.length > 0 && (
          <PanelSection id="warnings" title="Avisos de fusteria" icon={LuTriangleAlert} badge={moduleWarnings.length} badgePalette="orange">
            {moduleWarnings.map((w, i) => (
              <Alert.Root key={i} status={w.code === "material-heat" || w.code === "mitre" || (w.code === "inset" && w.message.startsWith("Fronts")) ? "info" : "warning"} size="sm">
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
                        onClick={() => select({ kind: "zone", moduleId: w.moduleId ?? module.id, zoneId: w.zoneId! })}
                      >
                        Anar-hi
                      </Button>
                    )}
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            ))}
          </PanelSection>
        )}
    </Stack>
  )

  // L'editor omple l'espai de l'app (h de la finestra menys la barra superior): el visor va
  // de dalt a baix i l'arbre i les propietats tenen cadascun el seu desplaçament.
  const panelH = { md: "full" }

  return (
    <Flex direction={{ base: "column", md: "row" }} gap={{ base: 0, md: 1.5 }} minH={0} h={panelH} flex={{ md: 1 }}>
      <TopBarActions>
        <HStack gap={1}>
          <IconButton aria-label="Desfer" title={`Desfer (${MOD}Z)`} size="sm" variant="ghost" disabled={history.past.length === 0} onClick={undo}>
            <LuUndo2 />
          </IconButton>
          <IconButton aria-label="Refer" title={`Refer (⇧${MOD}Z)`} size="sm" variant="ghost" disabled={history.future.length === 0} onClick={redo}>
            <LuRedo2 />
          </IconButton>
        </HStack>
      </TopBarActions>

      {/* Esquerra: estructura */}
      <Box
        order={{ base: 3, md: 0 }}
        minW={0}
        flexShrink={{ md: 1 }}
        display={{ base: mobilePane === "tree" ? "block" : "none", md: treeHidden ? "none" : "block" }}
        w={{ md: `${treeWidth}px` }}
        overflowY={{ md: "auto" }}
        overflowX={{ md: "auto" }}
        // Barra de desplaçament fina i amb lloc reservat: l'arbre i les propietats es
        // desplacen cadascun pel seu compte i no «salten» quan apareix la barra.
        css={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
        pt={{ base: 3, md: 0 }}
        pr={{ md: 1 }}
      >
        {/* Sense límit per arrossegar (com IntelliJ): si el panell és més estret que el
            contingut, apareix la barra de desplaçament horitzontal. */}
        <Box minW="240px">
        <StructureTree
          name={name}
          comp={comp}
          selection={selection}
          onSelect={(s) => select(s, true)}
          onChange={setComp}
          newModule={(id, n) => (kind === "taula" ? tableModule(id, n) : applySettingsToModule(settings, defaultModule(id, n)))}
        />
        </Box>
      </Box>

      {!treeHidden && (
        <Box order={{ md: 1 }} display={{ base: "none", md: "flex" }}>
          <ResizeHandle width={treeWidth} onWidth={setTreeWidth} min={48} max={900} defaultWidth={280} panelSide="left" label="Amplada de l'estructura" />
        </Box>
      )}

      {/* Centre: visor amb pestanyes 3D · Alçat · Foto */}
      <Box
        ref={viewerBox}
        order={{ base: 0, md: 2 }}
        flex={{ md: 1 }}
        minW={{ base: 0, md: "320px" }}
        position="relative"
        h={formHidden ? { base: "calc(100dvh - 52px - 76px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))", md: "full" } : { base: "42vh", md: "full" }}
        // Al mòbil, amb els marges de la pàgina (no a tota l'amplada) i cantonades de baix
        // arrodonides: a dalt toca la barra.
        rounded={{ base: "0 0 var(--chakra-radii-xl) var(--chakra-radii-xl)", md: "xl" }}
        overflow="hidden"
        borderWidth="1px"
        borderTopWidth={{ base: 0, md: "1px" }}
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
            {moduleBuild && (
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
            <Text fontSize="xs" color="fg.muted" textAlign="center" display={{ base: "none", md: "block" }}>
              Alçat de «{module.name}». Toca un compartiment per editar-lo; llums interiors en mm.
              {comp.modules.length > 1 && " Els mòduls del costat surten translúcids: clica'n un per passar-hi."}
            </Text>
          </Box>
        ) : (
          <CabinetViewer
            panels={panels}
            size={size}
            exploded={exploded}
            showHoles={showHoles}
            modules={viewerModules}
            selectedModuleId={selection.kind === "module" || selection.kind === "zone" ? module.id : null}
            onSelectModule={selectFrom3D}
            onAddModule={addModuleBeside}
            ghosts={comp.references}
            view={viewer.view}
            opening={viewer.opening}
            openOnly={openOnly}
            materialMode={viewerState.materialMode}
            materials={settings.materials}
            lights={lights}
            onCapture={registerCapture}
            quality={quality}
            onDeselect={() => select({ kind: "moble" })}
            selectedRefId={selection.kind === "ref" ? selection.id : null}
            collidingRefIds={collidingRefs}
            highlightZone={highlightZone}
            onSelectRef={(id) => select({ kind: "ref", id })}
            fitKey={fitKey}
            onFramedChange={setFramed}
            onMoveRef={moveRef}
            onMoveModule={(id, dx, dy, all, dz) => setComp((c) => (all ? moveAllBy(c, dx) : moveModuleBy(c, id, dx, dy, dz)))}
          />
        )}
        {viewTab === "3d" && viewerState.materialMode === "role" && (
          <Box position="absolute" bottom={3} left={3} zIndex={2} display={{ base: "none", md: "block" }}>
            <RoleLegend panels={panels} />
          </Box>
        )}
        {/* Amb el visor estret, les vistes es trien a «Opcions de vista» (no hi caben a baix). */}
        {viewTab === "3d" && !viewerNarrow && (
          <Box position="absolute" bottom={3} left="50%" transform="translateX(-50%)" zIndex={2}>
            <ViewBar view={viewer.view} onChange={(view) => setViewer({ view })} />
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
        <Tooltip content={treeHidden ? "Mostrar l'estructura" : "Amagar l'estructura"}>
          <IconButton
            position="absolute"
            top={3}
            left={3}
            zIndex={2}
            display={{ base: "none", md: "inline-flex" }}
            aria-label={treeHidden ? "Mostrar l'estructura" : "Amagar l'estructura"}
            aria-expanded={!treeHidden}
            size="sm"
            variant="surface"
            colorPalette="wood"
            onClick={() => setTreeHidden((v) => !v)}
          >
            {treeHidden ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
          </IconButton>
        </Tooltip>
        <Tooltip content={propsHidden ? "Mostrar les propietats" : "Amagar les propietats"}>
          <IconButton
            position="absolute"
            top={3}
            right={3}
            zIndex={2}
            display={{ base: "none", md: "inline-flex" }}
            aria-label={propsHidden ? "Mostrar les propietats" : "Amagar les propietats"}
            aria-expanded={!propsHidden}
            size="sm"
            variant="surface"
            colorPalette="wood"
            onClick={() => setPropsHidden((v) => !v)}
          >
            {propsHidden ? <LuPanelRightOpen /> : <LuPanelRightClose />}
          </IconButton>
        </Tooltip>
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
          <ArDialog open={arOpen} onClose={() => setArOpen(false)} panels={panels} name={name} />
          {isMobile ? (
            // Al mòbil, les opcions surten en un calaix de baix amb el seu propi desplaçament
            // (el popover feia desplaçar tota la pàgina).
            <Drawer.Root placement="bottom">
              <Drawer.Trigger asChild>
                <IconButton aria-label="Opcions de vista" title="Opcions de vista" size="sm" variant="surface" colorPalette="wood">
                  <LuSlidersVertical />
                </IconButton>
              </Drawer.Trigger>
              <Portal>
                <Drawer.Backdrop />
                <Drawer.Positioner>
                  <Drawer.Content roundedTop="l3" maxH="75dvh">
                    <Drawer.Header>
                      <Drawer.Title>Opcions de vista</Drawer.Title>
                    </Drawer.Header>
                    <Drawer.Body overflowY="auto" pb={6}>
                      {viewQuick}
                      <ViewerControls state={viewerState} onChange={setViewer} hasMoving={groups.length > 0} hasSelectedZone={!!zoneRect} onImage={() => void downloadImage()} />
                    </Drawer.Body>
                    <Drawer.CloseTrigger asChild>
                      <CloseButton size="sm" />
                    </Drawer.CloseTrigger>
                  </Drawer.Content>
                </Drawer.Positioner>
              </Portal>
            </Drawer.Root>
          ) : (
          <Popover.Root positioning={{ placement: "bottom-end" }}>
              <Popover.Trigger asChild>
                <IconButton aria-label="Opcions de vista" title="Opcions de vista" size="sm" variant="surface" colorPalette="wood">
                  <LuSlidersVertical />
                </IconButton>
              </Popover.Trigger>
              <Portal>
                <Popover.Positioner>
                  <Popover.Content w="320px">
                    <Popover.Body>
                      {viewQuick}
                      <ViewerControls state={viewerState} onChange={setViewer} hasMoving={groups.length > 0} hasSelectedZone={!!zoneRect} onImage={() => void downloadImage()} />
                    </Popover.Body>
                  </Popover.Content>
                </Popover.Positioner>
              </Portal>
            </Popover.Root>
          )}
        </Stack>
      </Box>

      {/* Mòbil: pestanyes sota el visor */}
      <Box order={2} display={{ base: "block", md: "none" }} pt={3}>
        <SegmentGroup.Root size="sm" w="full" value={mobilePane} onValueChange={(e) => (e.value === "tree" || e.value === "props") && setMobilePane(e.value)}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Item value="tree" flex={1} justifyContent="center">
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <LuListTree /> Estructura
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
          <SegmentGroup.Item value="props" flex={1} justifyContent="center">
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <LuSlidersHorizontal /> Propietats
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        </SegmentGroup.Root>
      </Box>

      {!propsHidden && (
        <Box order={{ md: 3 }} display={{ base: "none", md: "flex" }}>
          <ResizeHandle width={formWidth} onWidth={setFormWidth} min={48} max={900} defaultWidth={340} panelSide="right" label="Amplada de les propietats" />
        </Box>
      )}

      {/* Dreta: propietats del que hi ha seleccionat */}
      <Box
        order={{ base: 4, md: 4 }}
        minW={0}
        flexShrink={{ md: 1 }}
        display={{ base: mobilePane === "props" ? "block" : "none", md: propsHidden ? "none" : "block" }}
        w={{ md: `${formWidth}px` }}
        overflowY={{ md: "auto" }}
        overflowX={{ md: "auto" }}
        css={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
        pt={{ base: 3, md: 0 }}
        pl={{ md: 3 }}
      >
        <Box minW="300px">{inspector}</Box>
      </Box>
    </Flex>
  )
}


