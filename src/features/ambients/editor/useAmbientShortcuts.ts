import { useEffect } from "react"
import { newItemGroupName, setItemGroup, setWallGroup, type Ambient } from "../../../core/model"
import type { Tool } from "../planGeom"
import type { AmbientActions } from "./useAmbientActions"
import type { AmbientSelection } from "./useAmbientSelection"

/** Dreceres de teclat (com Figma): eines, Supr, fletxes, R, duplicar, copiar i enganxar, agrupar i Esc. */
export function useAmbientShortcuts({ amb, change, selection, actions, setTool }: { amb: Ambient; change: (next: Ambient, commit: boolean) => void; selection: AmbientSelection; actions: AmbientActions; setTool: (t: Tool) => void }) {
  const { sel, setSel, select, groupSel, selIds, selWallIds } = selection
  const { duplicate, copy, paste, remove, rotate, nudge } = actions
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
        const wallIds = sel?.kind === "wall" ? [sel.id] : selWallIds
        if (!selIds.length && !wallIds.length) return
        e.preventDefault()
        const all = [...selIds, ...wallIds]
        if (e.shiftKey) {
          change(setWallGroup(setItemGroup(amb, selIds, undefined), wallIds, undefined), true)
          if (sel?.kind === "group") select(all.length > 1 ? { kind: "multi", ids: all } : selIds.length ? { kind: "item", id: selIds[0]! } : { kind: "wall", id: wallIds[0]! })
        } else if (sel?.kind !== "group") {
          const name = newItemGroupName(amb)
          change(setWallGroup(setItemGroup(amb, selIds, name), wallIds, name), true)
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
}
