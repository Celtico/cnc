import { useState, type DragEvent } from "react"
import { groupMulti, movePartToGroup, reorderModel, reorderModule, reorderPart, reorderRef, rowOf, setModelGroup, ungroupMulti, type Composition, type MultiItem } from "../../../core/model"
import type { TreeRowDnd } from "../../../components/TreeRow"
import type { Selection } from "../StructureTree"

type DragKind = "module" | "ref" | "part" | "model"
type TreeDrag = { kind: DragKind; id: string; multi?: MultiItem[] }

/**
 * Arrossegar per ordenar (mòduls dins de la seva fila, i objectes), deixar dins d'un grup o treure'n.
 * `openGroup`: desplega el grup on es deixa un element.
 */
export function useTreeDnd({ comp, selection, onChange, openGroup }: { comp: Composition; selection: Selection; onChange: (c: Composition) => void; openGroup: (g: string) => void }) {
  const parts = comp.parts ?? []
  const models = comp.models ?? []
  // Arrossegar per ordenar (mòduls dins de la seva fila, i objectes).
  // Arrossegar una fila de la selecció múltiple arrossega tots els triats (`multi`).
  const [drag, setDrag] = useState<TreeDrag | null>(null)
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null)
  // El grup d'un element de l'arbre (mòdul, peça, model o objecte de referència).
  const groupOf = (kind: DragKind, id: string): string | undefined =>
    (kind === "part" ? parts : kind === "model" ? models : kind === "module" ? comp.modules : comp.references).find((q) => q.id === id)?.group
  const inDrag = (kind: DragKind, id: string) => (drag?.multi ? drag.multi.some((x) => x.kind === kind && x.id === id) : drag?.id === id)
  const canDrop = (kind: DragKind, id: string) => {
    if (drag?.multi) return kind !== "module" && !inDrag(kind, id)
    if (!drag || drag.kind !== kind || drag.id === id) return false
    if (kind !== "module") return true
    const a = comp.modules.find((m) => m.id === drag.id)
    const b = comp.modules.find((m) => m.id === id)
    return !!a && !!b && rowOf(a) === rowOf(b)
  }
  // Deixar els triats al costat d'un element: els del seu tipus s'hi posen en ordre i tots n'agafen el grup (com un sol).
  const dropMulti = (items: MultiItem[], kind: DragKind, id: string, after: boolean): Composition => {
    let c = comp
    const same = items.filter((x) => x.kind === kind)
    for (const x of after ? [...same].reverse() : same) c = kind === "part" ? reorderPart(c, x.id, id, after) : kind === "model" ? reorderModel(c, x.id, id, after) : reorderRef(c, x.id, id, after)
    const target = kind === "part" ? parts.find((q) => q.id === id) : kind === "model" ? models.find((q) => q.id === id) : kind === "ref" ? comp.references.find((q) => q.id === id) : undefined
    const others = items.filter((x) => x.kind !== kind)
    if (others.length) c = target?.group ? groupMulti(c, others, target.group) : ungroupMulti(c, others)
    return c
  }
  const dnd = (kind: DragKind, id: string): TreeRowDnd => ({
    dragging: inDrag(kind, id),
    indicator: over?.id === id && canDrop(kind, id) ? (over.after ? "after" : "before") : null,
    onStart: () => {
      const multi = selection.kind === "multi" && selection.items.some((x) => x.kind === kind && x.id === id) ? selection.items : undefined
      setDrag({ kind, id, ...(multi ? { multi } : {}) })
    },
    onOver: (after) => {
      if (!canDrop(kind, id)) return false
      if (over?.id !== id || over.after !== after) setOver({ id, after })
      return true
    },
    onDrop: (after) => {
      if (drag?.multi && canDrop(kind, id)) onChange(dropMulti(drag.multi, kind, id, after))
      else if (drag && canDrop(kind, id)) onChange(kind === "module" ? reorderModule(comp, drag.id, id, after) : kind === "part" ? reorderPart(comp, drag.id, id, after) : kind === "model" ? reorderModel(comp, drag.id, id, after) : reorderRef(comp, drag.id, id, after))
      setDrag(null)
      setOver(null)
    },
    onEnd: () => {
      setDrag(null)
      setOver(null)
    },
  })
  // La fila d'un grup: s'hi pot deixar una peça (entra al grup).
  const groupDnd = (g: string): TreeRowDnd => {
    const grouped = (x: MultiItem) => groupOf(x.kind, x.id)
    const ok = () => (drag?.multi ? drag.multi.some((x) => grouped(x) !== g) : !!drag && groupOf(drag.kind, drag.id) !== g)
    return {
      noDrag: true,
      dragging: false,
      indicator: over?.id === `g:${g}` && ok() ? "inside" : null,
      onStart: () => {},
      onOver: () => {
        if (!ok()) return false
        if (over?.id !== `g:${g}`) setOver({ id: `g:${g}`, after: false })
        return true
      },
      onDrop: () => {
        if (drag && ok()) {
          onChange(drag.multi ? groupMulti(comp, drag.multi, g) : drag.kind === "model" ? setModelGroup(comp, drag.id, g) : drag.kind === "module" || drag.kind === "ref" ? groupMulti(comp, [{ kind: drag.kind, id: drag.id }], g) : movePartToGroup(comp, drag.id, g))
          openGroup(g)
        }
        setDrag(null)
        setOver(null)
      },
      onEnd: () => {
        setDrag(null)
        setOver(null)
      },
    }
  }
  // El grup de la fila que s'arrossega: a sota dels seus elements surt la zona «Treure del grup» (`UngroupDropZone`).
  const dragGroup = drag ? groupOf(drag.kind, drag.id) : undefined
  // La zona per treure del grup l'element arrossegat (`UngroupDropZone`): `result`, la composició en deixar-l'hi.
  const ungroupZone = (result: () => Composition) => ({
    active: over?.id === "ungroup",
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      if (over?.id !== "ungroup") setOver({ id: "ungroup", after: false })
    },
    onDragLeave: () => over?.id === "ungroup" && setOver(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      onChange(result())
      setDrag(null)
      setOver(null)
    },
  })
  return { drag, dragGroup, dnd, groupDnd, ungroupZone }
}

export type TreeDnd = ReturnType<typeof useTreeDnd>
