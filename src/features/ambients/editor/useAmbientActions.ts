import { useRef } from "react"
import {
  duplicateItems,
  footprintBox,
  moveItems,
  moveWalls,
  newId,
  parseAmbientClip,
  pasteItems,
  removeItems,
  rotateItems,
  type Ambient,
  type AmbientClip,
  type AmbientItem,
  type PlanPt,
  type Wall,
} from "../../../core/model"
import type { Project } from "../../../db/db"
import { isEmptyGeometry, type ItemGeometry } from "../ambientData"
import { ambientBox, type Selection, type Tool } from "../planGeom"

/** Porta-retalls dels ambients (`AmbientClip`), compartit entre ambients. */
const AMBIENT_CLIP_KEY = "mobles:ambient-clipboard"

/** Les accions sobre l'ambient i la selecció: afegir, canviar, eliminar, duplicar, copiar i enganxar, girar i moure. */
export function useAmbientActions({
  amb,
  change,
  sel,
  setSel,
  selIds,
  selWallIds,
  geos,
  setTool,
}: {
  amb: Ambient
  change: (next: Ambient, commit: boolean) => void
  sel: Selection
  setSel: (s: Selection) => void
  selIds: string[]
  selWallIds: string[]
  geos: Map<string, ItemGeometry | null>
  setTool: (t: Tool) => void
}) {
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
  const remove = () => {
    if (!sel) return
    if (sel.kind === "wall" ? !amb.walls.some((w) => w.id === sel.id) : !selIds.length && !selWallIds.length) return setSel(null)
    if (sel.kind === "wall") change({ ...amb, walls: amb.walls.filter((w) => w.id !== sel.id) }, true)
    else change({ ...removeItems(amb, selIds), walls: amb.walls.filter((w) => !selWallIds.includes(w.id)) }, true)
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
  const nudge = (dx: number, dy: number) => (selIds.length || selWallIds.length) && change(moveWalls(moveItems(amb, selIds, dx, dy), selWallIds, dx, dy), true)
  // La petjada de cada element al plànol (alinear i repartir la selecció múltiple): la del moble buit, 600 × 600.
  const boxOf = (i: AmbientItem) => {
    const g = geos.get(i.id)
    return g ? (isEmptyGeometry(g) ? footprintBox(i.x, i.y, 600, 600, i.rot) : footprintBox(i.x, i.y, g.w, g.d, i.rot)) : null
  }

  return { addMoble, patchItem, patchWall, remove, duplicate, copy, paste, rotate, nudge, boxOf }
}

export type AmbientActions = ReturnType<typeof useAmbientActions>
