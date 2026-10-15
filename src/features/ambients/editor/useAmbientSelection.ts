import { useEffect, useRef, useState } from "react"
import { groupIds, groupWallIds, type Ambient } from "../../../core/model"
import type { Selection } from "../planGeom"

/**
 * La selecció de l'ambient: què hi ha triat, els elements i les parets que hi entren i els clics (plànol, 3D i arbre)
 * amb Maj o ⌘/Ctrl, com Figma i el Finder.
 */
export function useAmbientSelection(amb: Ambient, setMobilePane: (pane: "props") => void) {
  const [sel, setSel] = useState<Selection>(null)
  // Seleccionar porta a Propietats al mòbil (com a l'editor).
  const select = (x: Selection) => {
    setSel(x)
    if (x) setMobilePane("props")
  }
  const item = sel?.kind === "item" ? amb.items.find((i) => i.id === sel.id) : undefined
  const wall = sel?.kind === "wall" ? amb.walls.find((w) => w.id === sel.id) : undefined
  // Elements seleccionats: un, o tots els del grup (les accions valen per a tots dos casos).
  // Després de desfer, la selecció pot apuntar a un element que ja no hi és: llavors no es fa res (si no,
  // una fletxa o Supr afegien un pas buit de desfer i es perdia el refer).
  const selIds = sel?.kind === "item" ? (amb.items.some((i) => i.id === sel.id) ? [sel.id] : []) : sel?.kind === "group" ? groupIds(amb, sel.id) : sel?.kind === "multi" ? sel.ids.filter((id) => amb.items.some((i) => i.id === id)) : []
  // Les parets de la selecció múltiple o del grup (una paret sola és `wall`).
  const selWallIds = sel?.kind === "group" ? groupWallIds(amb, sel.id) : sel?.kind === "multi" ? sel.ids.filter((id) => amb.walls.some((w) => w.id === id)) : []
  // L'ambient és el seleccionat quan no n'hi ha cap altre (clic al buit, Esc, la fila de dalt de l'arbre): com el moble a
  // l'editor. Una selecció que ja no hi és (després de desfer) també torna a l'ambient.
  const ambientSel = !item && !((sel?.kind === "group" || sel?.kind === "multi") && selIds.length + selWallIds.length) && !wall

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

  /** Clic a un element (plànol o 3D), com Figma: si és d'un grup, el primer clic tria el grup i el segon, l'element. */
  const pickItem = (id: string): string[] => {
    // Maj + clic: afegeix o treu l'element de la selecció (com a l'editor).
    if (shiftRef.current) return toggleSel(id)
    const it = amb.items.find((i) => i.id === id)
    if (it?.group && !(sel?.kind === "group" && sel.id === it.group) && !(sel?.kind === "item" && sel.id === id)) {
      select({ kind: "group", id: it.group })
      return [...groupIds(amb, it.group), ...groupWallIds(amb, it.group)]
    }
    // Ja és a la selecció múltiple: s'arrosseguen tots els triats (també les parets).
    if (sel?.kind === "multi" && selIds.includes(id)) return [...selIds, ...selWallIds]
    rangeAnchor.current = id
    select({ kind: "item", id })
    return [id]
  }
  const groupSel = (name: string) => select({ kind: "group", id: name })
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
    // Elements i parets alhora (una paret sola triada també compta).
    const cur = sel?.kind === "wall" ? [sel.id] : [...selIds, ...selWallIds]
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    const isWall = (x: string) => amb.walls.some((w) => w.id === x)
    if (next.length > 1) select({ kind: "multi", ids: next })
    else if (next.length === 1) select({ kind: isWall(next[0]!) ? "wall" : "item", id: next[0]! })
    else select(null)
    return next
  }
  // Clic a una paret (plànol): Maj o ⌘ = afegir o treure; d'un grup, el primer clic tria el grup (com els elements).
  const pickWall = (id: string): string[] => {
    if (shiftRef.current) return toggleSel(id)
    const w = amb.walls.find((x) => x.id === id)
    if (w?.group && !(sel?.kind === "group" && sel.id === w.group) && !(sel?.kind === "wall" && sel.id === id)) {
      select({ kind: "group", id: w.group })
      return [...groupIds(amb, w.group), ...groupWallIds(amb, w.group)]
    }
    if ((sel?.kind === "multi" || sel?.kind === "group") && selWallIds.includes(id)) return [...selIds, ...selWallIds]
    rangeAnchor.current = id
    select({ kind: "wall", id })
    return [id]
  }

  return { sel, setSel, select, item, wall, selIds, selWallIds, ambientSel, pickItem, pickWall, groupSel, treeClick, shiftRef, rangeAnchor }
}

export type AmbientSelection = ReturnType<typeof useAmbientSelection>
