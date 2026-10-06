import { partFrame } from "../../core/build/hardwarePlace"
import { AXIS_ENDS, AXIS_NAME, isPlaceable, machiningParts, newId, partKindForRole, PART_KINDS, type Composition, type HardwareItem, type HardwarePlacement, type Panel, type PartKind, type PlacementTarget, type WorldAxis } from "../../core/model"

/**
 * Ferratges col·locats a mà (Editor › mòdul o peça lliure › «Ferratges»): utilitats sense React per a
 * `HardwarePlacements.tsx` (Fast Refresh: un `.tsx` només exporta components).
 */

/** On es col·loquen: les peces d'un mòdul (amb l'id local) o una peça lliure. */
export type PlacementScope = { kind: "module"; moduleId: string } | { kind: "part"; partId: string }

/** Una peça on es pot col·locar un ferratge: l'id local (al mòdul) o el de la peça lliure, el nom i el grup. */
export interface PlaceablePanel {
  key: string
  label: string
  part: PartKind
  panel: Panel
  target: Omit<PlacementTarget, "part">
}

/** Les peces del mòdul (o la peça lliure) on es pot col·locar un ferratge. */
export function scopePanels(scope: PlacementScope, panels: readonly Panel[]): PlaceablePanel[] {
  if (scope.kind === "part") {
    const p = panels.find((x) => x.id === `part:${scope.partId}`)
    return p ? [{ key: p.id, label: p.label, part: "part", panel: p, target: { freePart: scope.partId } }] : []
  }
  const prefix = `${scope.moduleId}:`
  return panels.flatMap((p) => {
    if (!p.id.startsWith(prefix)) return []
    const part = partKindForRole(p.role)
    return part ? [{ key: p.id, label: p.label, part, panel: p, target: { module: scope.moduleId, panel: p.id.slice(prefix.length) } }] : []
  })
}

/** Els ferratges de la biblioteca que es poden col·locar a mà (amb mecanitzats o «només 3D»). */
export const placeableItems = (library: readonly HardwareItem[]) => library.filter(isPlaceable)

/** Els col·locats d'aquest àmbit (la peça principal és d'aquest mòdul o és aquesta peça lliure). */
export function scopePlacements(comp: Composition, scope: PlacementScope): HardwarePlacement[] {
  return (comp.hardwarePlacements ?? []).filter((p) => (scope.kind === "module" ? p.targets[0]!.module === scope.moduleId : p.targets[0]!.freePart === scope.partId))
}

/** El grup de l'item que va a una peça: el seu (si l'item en té), si no el primer. */
export function roleFor(item: HardwareItem, panelPart: PartKind): PartKind {
  const parts = machiningParts(item.machining ?? [])
  return parts.includes(panelPart) ? panelPart : (parts[0] ?? panelPart)
}

/** Un ferratge nou a la peça `on` amb el punt de referència al mig. */
export function newPlacement(item: HardwareItem, on: PlaceablePanel): HardwarePlacement {
  return { id: newId("hp"), item: structuredClone(item), targets: [{ part: roleFor(item, on.part), ...on.target }], p: { from: "center", at: 0 }, q: { from: "center", at: 0 } }
}

/** Noms dels eixos de la peça (P i Q del moble al seu pla): «De costat» (esquerra/dreta), «Fondària» (darrere/davant)… */
export function panelAxes(panel: Panel): { p: { name: string; ends: [string, string]; axis: WorldAxis }; q: { name: string; ends: [string, string]; axis: WorldAxis } } {
  const f = partFrame(panel)
  return { p: { name: AXIS_NAME[f.p], ends: AXIS_ENDS[f.p], axis: f.p }, q: { name: AXIS_NAME[f.q], ends: AXIS_ENDS[f.q], axis: f.q } }
}

/** Canvia un col·locat a la composició. */
export function updatePlacement(comp: Composition, next: HardwarePlacement): Composition {
  return { ...comp, hardwarePlacements: (comp.hardwarePlacements ?? []).map((p) => (p.id === next.id ? next : p)) }
}

/** Treu un col·locat (sense cap, el camp fora: el `.moble` torna a la versió d'abans). */
export function removePlacement(comp: Composition, id: string): Composition {
  const rest = (comp.hardwarePlacements ?? []).filter((p) => p.id !== id)
  const { hardwarePlacements: _old, ...base } = comp
  return rest.length ? { ...base, hardwarePlacements: rest } : base
}

export const partLabel = (k: PartKind) => PART_KINDS.find((p) => p.id === k)!.label
