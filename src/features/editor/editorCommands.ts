import { anchorRef, moveGroupBy, partOffset, type Composition, type Module } from "../../core/model"
import type { PlacementActions } from "../composition/HardwarePlacements"
import { duplicatePlacement, placementScope, removePlacement } from "../composition/placements"
import type { Selection } from "../composition/StructureTree"
import type { SetComp } from "./useEditorDoc"

/** Canvis de la composició que fan servir l'inspector, el 3D, el teclat i la foto (un pas de desfer cadascun). */
export function compositionEdits(setComp: SetComp) {
  const updateModule = (m: Module) => setComp((c) => ({ ...c, modules: c.modules.map((x) => (x.id === m.id ? m : x)) }))
  /** Mou un grup de peces lliures (desplaçament en mm). */
  const moveGroup = (group: string, dx: number, dy: number, dz: number) => setComp((c) => moveGroupBy(c, group, dx, dy, dz))
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
  /** Mou un model 3D (gizmo al 3D o fletxes): no s'enfonsa al terra. */
  const moveModel = (id: string, pos: { x: number; y: number; z: number }) =>
    setComp((c) => ({ ...c, models: (c.models ?? []).map((g) => (g.id === id ? { ...g, x: pos.x, y: Math.max(0, pos.y), z: pos.z } : g)) }))
  /** Mou un objecte de referència (arrossegat al 3D o amb les fletxes). */
  const moveRef = (id: string, pos: { x: number; y: number; z: number }) =>
    setComp((c) => ({ ...c, references: c.references.map((r) => (r.id === id ? anchorRef({ ...r, ...pos }) : r)) }))
  const renamePart = (id: string, v: string) => setComp((c) => ({ ...c, parts: (c.parts ?? []).map((r) => (r.id === id ? { ...r, name: v } : r)) }))
  const renameModel = (id: string, v: string) => setComp((c) => ({ ...c, models: (c.models ?? []).map((g) => (g.id === id ? { ...g, name: v } : g)) }))
  const renameRef = (id: string, v: string) => setComp((c) => ({ ...c, references: c.references.map((r) => (r.id === id ? { ...r, name: v } : r)) }))
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
  return { updateModule, moveGroup, movePart, moveModel, moveRef, renamePart, renameModel, renameRef, applyMeasure }
}

export type CompositionEdits = ReturnType<typeof compositionEdits>

/** Ferratges col·locats a mà (llista de l'inspector, barra flotant del 3D i teclat): un sol camí, un pas de desfer. */
export function hardwareCommands({
  comp,
  setComp,
  selection,
  select,
  openInspector,
}: {
  comp: Composition
  setComp: SetComp
  selection: Selection
  select: (s: Selection, fromPanel?: boolean) => void
  /** Obre la secció del ferratge col·locat a l'inspector (i l'inspector, si és plegat). */
  openInspector: () => void
}) {
  const duplicateHardware = (id: string) => {
    const r = duplicatePlacement(comp, id)
    if (!r) return
    setComp(r.comp)
    select({ kind: "hardware", id: r.id })
  }
  const editHardware = (id: string) => {
    openInspector()
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
  return { duplicateHardware, removeHardware, hardwareActions }
}
