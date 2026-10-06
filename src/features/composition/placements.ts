import { applyGenOp, frameSpan, mirrorOpP, partFrame, placeAt, placeVars, refPoints } from "../../core/build/hardwarePlace"
import type { CompositionWarning } from "../../core/build/buildComposition"
import { AXIS_ENDS, AXIS_NAME, exprError, isPlaceable, machiningParts, newId, partKindForRole, PART_KINDS, type Composition, type HardwareItem, type HardwarePlacement, type Panel, type PartKind, type PlacePos, type PlacementTarget, type StepRule, type WorldAxis } from "../../core/model"

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

/** On cau la còpia d'un col·locat: 50 mm més cap a dins al llarg de P (no a sobre de l'original, com «Duplicar» d'un objecte). */
export const PLACEMENT_COPY_SHIFT = 50

/** Duplica un col·locat (Duplicar del 3D, de la llista i Ctrl/⌘ D): una còpia desplaçada al llarg de P, just després. */
export function duplicatePlacement(comp: Composition, id: string): { comp: Composition; id: string } | null {
  const list = comp.hardwarePlacements ?? []
  const i = list.findIndex((p) => p.id === id)
  if (i < 0) return null
  const src = list[i]!
  const p = src.p.expr ? { ...src.p, expr: `(${src.p.expr}) + ${PLACEMENT_COPY_SHIFT}` } : { ...src.p, at: src.p.at + PLACEMENT_COPY_SHIFT }
  const copy: HardwarePlacement = { ...structuredClone(src), id: newId("hp"), p }
  const next = [...list]
  next.splice(i + 1, 0, copy)
  return { comp: { ...comp, hardwarePlacements: next }, id: copy.id }
}

/** L'àmbit d'un col·locat (el mòdul o la peça lliure de la seva peça principal). */
export function placementScope(pl: HardwarePlacement): PlacementScope | null {
  const main = pl.targets[0]
  if (main?.module) return { kind: "module", moduleId: main.module }
  if (main?.freePart) return { kind: "part", partId: main.freePart }
  return null
}

/** Els avisos d'un col·locat (pel nom de l'item a l'avís `hardware`). */
export function placementWarnings(warnings: readonly CompositionWarning[], pl: HardwarePlacement): CompositionWarning[] {
  return warnings.filter((w) => w.code === "hardware" && w.message.includes(`«${pl.item.name}»`))
}

/**
 * El col·locat fa servir opcions **avançades** d'una versió anterior (repetició, mirall, gir del model, fórmula o
 * percentatge): es continuen llegint i fabricant igual, però ja no s'editen (la col·locació a mà és només la peça i la
 * posició; les repeticions i el mirall són cosa de les regles). L'inspector les mostra i deixa simplificar-les.
 */
export function placementAdvanced(pl: HardwarePlacement): string[] {
  const out: string[] = []
  if (pl.repeat) out.push(`repetició (${pl.repeat.layout ?? "des del punt"}, ${pl.repeat.rule ? "per mida" : `${pl.repeat.count} còpies`})`)
  if (pl.mirror) out.push("mirall esquerra/dreta")
  if (pl.turn) out.push(`gir del model ${pl.turn}°`)
  for (const k of ["p", "q"] as const) {
    if (pl[k].expr) out.push(`fórmula «${pl[k].expr}»`)
    else if (pl[k].from === "ratio") out.push(`${pl[k].pct ?? 50} % de la peça`)
  }
  return out
}

/**
 * **Simplifica** un col·locat avançat a la forma d'ara: una sola posició (la de la primera còpia, on cau avui, des de
 * l'inici de cada eix), sense repetició, mirall, gir ni fórmules. Si la fórmula no es pot avaluar, es queda la
 * distància que tenia. El mateix objecte si ja és simple.
 */
export function simplifyPlacement(pl: HardwarePlacement, panel: Panel | undefined): HardwarePlacement {
  if (!placementAdvanced(pl).length) return pl
  const { repeat: _r, mirror: _m, turn: _t, ...rest } = pl
  const pos = (k: "p" | "q"): PlacePos => {
    const cur = pl[k]
    const now = panel ? placePosValue(cur, panel, k) : null
    if (now !== null) return { from: "min", at: Math.round(now * 100) / 100 }
    const { expr: _e, pct: _p, ...keep } = cur
    return keep.from === "ratio" ? { from: "min", at: keep.at } : keep
  }
  return { ...rest, p: pos("p"), q: pos("q") }
}

/** La regla inicial de «Per mida» (com les frontisses: 2 fins a 900, 3 fins a 1600, 4 fins a 2100, si no 5). */
export const DEFAULT_REPEAT_RULE: StepRule = { steps: [{ upTo: 900, n: 2 }, { upTo: 1600, n: 3 }, { upTo: 2100, n: 4 }], else: 5 }

/** Error de la fórmula d'una posició amb la peça d'ara (`null` si és bona o no n'hi ha). */
export function placePosError(pos: PlacePos, panel: Panel, axis: "p" | "q"): string | null {
  if (!pos.expr) return null
  const [lo, hi] = frameSpan(partFrame(panel), axis)
  return exprError(pos.expr, placeVars(panel, hi - lo))
}

/** On cau ara una posició (mm des de l'inici de l'eix de la peça), o `null` si la fórmula no es pot avaluar. */
export function placePosValue(pos: PlacePos, panel: Panel, axis: "p" | "q"): number | null {
  const f = partFrame(panel)
  const v = placeAt(f, axis, pos)
  return typeof v === "number" ? v - frameSpan(f, axis)[0] : null
}

/** Una marca de la previsualització: la caixa (P, Q des de l'inici de la peça) d'una operació, rodona si és un forat. */
export interface PreviewMark {
  x0: number
  y0: number
  x1: number
  y1: number
  round: boolean
  mirror: boolean
}

/**
 * La previsualització d'un col·locat a la seva peça principal, amb el **mateix càlcul** que el moble (`refPoints`,
 * `applyGenOp`): la mida de la peça (P × Q), els punts de referència de cada còpia (i del mirall a la mateixa peça), les
 * marques de les operacions i, si n'hi ha, el problema (fórmula, fora de la peça). Coordenades des de l'inici de cada eix.
 */
export function placementPreview(pl: HardwarePlacement, panel: Panel): { size: [number, number]; refs: [number, number][]; mirrored: [number, number][]; marks: PreviewMark[]; error: string | null; otherSide: boolean } {
  const f = partFrame(panel)
  const [p0, p1] = frameSpan(f, "p")
  const [q0, q1] = frameSpan(f, "q")
  const size: [number, number] = [p1 - p0, q1 - q0]
  const pts = refPoints(pl, f)
  if ("error" in pts) return { size, refs: [], mirrored: [], marks: [], error: pts.error, otherSide: false }
  const ops = (pl.item.machining ?? []).filter((o) => o.part === pl.targets[0]!.part)
  const inPlane = !!pl.mirror && f.p === "x"
  const mirrored = inPlane ? pts.map(([p, q]) => [p0 + p1 - p, q] as [number, number]) : []
  const marks: PreviewMark[] = []
  let error: string | null = null
  const add = (refs: [number, number][], list: typeof ops, mirror: boolean) => {
    for (const [rp, rq] of refs)
      for (const op of list) {
        const res = applyGenOp(op, f, rp, rq)
        if ("error" in res) {
          error ??= res.error
          continue
        }
        const [a, b, c, d] = res.span
        marks.push({ x0: a - p0, y0: b - q0, x1: c - p0, y1: d - q0, round: op.kind === "drill" && op.face !== "edge", mirror })
      }
  }
  add(pts, ops, false)
  if (inPlane) add(mirrored, ops.map(mirrorOpP), true)
  const rel = (list: [number, number][]) => list.map(([p, q]) => [p - p0, q - q0] as [number, number])
  return { size, refs: rel(pts), mirrored: rel(mirrored), marks, error, otherSide: !!pl.mirror && !inPlane }
}
