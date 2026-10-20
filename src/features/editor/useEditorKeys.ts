import { useEffect } from "react"
import { toaster } from "../../components/ui/toaster"
import { deleteZone, duplicateZone, pasteModuleProps, groupItems, groupMulti, moveMultiBy, newGroupName, parentOf, removeGroup, removeModule, removeMulti, ungroupMulti, type Composition, type Module, type MultiItem, type Zone } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { useLatest } from "../../lib/useLatest"
import { readClip, writeClip, type Clip } from "./clipboard"
import { clipOf, pasteClip } from "./pasteClip"
import type { CompositionEdits } from "./editorCommands"
import type { SetComp } from "./useEditorDoc"
import { keyInDialog, modalOpen } from "../../lib/keyTarget"

/**
 * Dreceres de teclat de l'editor: copiar, enganxar, duplicar, esborrar i agrupar, i moure el triat amb les fletxes.
 * Els escoltadors es posen un cop; cada tecla llegeix l'estat d'ara (`useLatest`).
 */
export function useEditorKeys({
  comp,
  setComp,
  selection,
  select,
  module,
  zone,
  selectionLocked,
  absParts,
  edits,
  duplicateHardware,
  removeHardware,
}: {
  comp: Composition
  setComp: SetComp
  selection: Selection
  select: (s: Selection, fromPanel?: boolean) => void
  module: Module | undefined
  zone: Zone | undefined
  selectionLocked: boolean
  absParts: { id: string; x: number; y: number; z: number }[]
  edits: Pick<CompositionEdits, "updateModule" | "moveGroup" | "movePart" | "moveModel" | "moveRef">
  duplicateHardware: (id: string) => void
  removeHardware: (id: string) => void
}) {
  const { updateModule, moveGroup, movePart, moveModel, moveRef } = edits
  // Fletxes amb un objecte seleccionat: ←→ X, ↑↓ Y, Re Pàg / Av Pàg Z. 1 mm; amb Maj, 10 mm.
  // Copiar, enganxar, duplicar i esborrar amb el teclat (mòduls, objectes, compartiments, grups i la selecció múltiple).
  // El porta-retalls es desa a localStorage: es pot enganxar en un altre moble.
  const editKeysRef = useLatest((e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
    // Dins d'una finestra o d'un diàleg, o amb una confirmació oberta, no (amb una finestra oberta i el focus aquí, sí).
    if (keyInDialog(t) || modalOpen()) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    // ⌘G / Ctrl+G: els triats en un grup nou; ⇧⌘G: fora del grup (com Figma). Peces lliures i models 3D.
    if (mod && key === "g" && (selection.kind === "multi" || selection.kind === "part" || selection.kind === "ref" || selection.kind === "model" || selection.kind === "module" || selection.kind === "group")) {
      e.preventDefault()
      const items: MultiItem[] = selection.kind === "multi" ? selection.items : selection.kind === "group" ? groupItems(comp, selection.id) : [{ kind: selection.kind, id: selection.id }]
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
    const current = () => clipOf(comp, selection, zone)
    const paste = (clip: Clip, duplicate = false) => pasteClip({ comp, setComp, select, selection, module, updateModule }, clip, duplicate)
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
    // Amb ⌥ (Mac), `e.key` no és «v»: també pel codi de la tecla.
    if (mod && (key === "v" || e.code === "KeyV")) {
      const clip = readClip()
      if (!clip) return
      e.preventDefault()
      // ⌥⌘V amb un mòdul triat: enganxa les propietats del mòdul copiat (es queda on és i amb les seves mides).
      if (e.altKey && clip.kind === "module" && selection.kind === "module") {
        const target = comp.modules.find((x) => x.id === selection.id)
        if (target && target.id !== clip.data.id) setComp({ ...comp, modules: comp.modules.map((x) => (x.id === target.id ? pasteModuleProps(x, clip.data) : x)) })
        return
      }
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
      paste(clip, true)
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
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => editKeysRef.current(e)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editKeysRef])

  const nudgeRef = useLatest((e: KeyboardEvent) => {
    if ((selection.kind !== "ref" && selection.kind !== "part" && selection.kind !== "group" && selection.kind !== "model" && selection.kind !== "multi") || selectionLocked || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
    if (keyInDialog(t) || modalOpen()) return
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
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => nudgeRef.current(e)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [nudgeRef])
}
