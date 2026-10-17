import type { CompositionBuild, CompositionWarning } from "../../core/build/buildComposition"
import { moduleBoxToWorld } from "../../core/build/buildComposition"
import { panelBox } from "../../core/build/geometry"
import type { BuildWarning, FixPlaceKey } from "../../core/build/buildModule"
import type { Composition } from "../../core/model"
import type { Selection } from "../composition/StructureTree"

type Code = BuildWarning["code"]

/** On s'arregla un avís: a quin nivell (mòdul o compartiment) i quines seccions de l'inspector cal obrir (de fora a dins). */
interface FixPlace {
  level: "module" | "zone" | "moble" | "ref" | "part"
  folds: string[]
  /** Com ho diu el botó: «Caixa › Fons». */
  label: string
}

const MODULE = (folds: string[], label: string): FixPlace => ({ level: "module", folds, label })
const ZONE = (folds: string[], label: string): FixPlace => ({ level: "zone", folds, label })

/** Els llocs on porten les opcions d'un avís que no es pot arreglar sol (`BuildWarning.options`). */
const FIX_PLACES: Record<FixPlaceKey, FixPlace> = {
  position: MODULE(["mod-position"], "Posició"),
  dims: MODULE(["mod-dims"], "Mides"),
  support: { level: "moble", folds: ["moble-support"], label: "Suport general" },
  back: MODULE(["mod-structure", "mod-carcass-back"], "Caixa › Fons"),
  sides: MODULE(["mod-structure", "mod-carcass-sides"], "Caixa › Laterals"),
  materials: MODULE(["mod-materials"], "Materials"),
  front: ZONE(["zone-front"], "Front"),
  shelves: ZONE(["zone-shelves", "zone-shelves-shelves"], "Interior › Prestatges"),
  appliance: ZONE(["zone-appliance"], "Electrodomèstic"),
  refPosition: { level: "ref", folds: ["ref-position"], label: "Posició de l'objecte" },
  partPosition: { level: "part", folds: ["part-position"], label: "Posició de la peça" },
}

/**
 * Per a cada codi d'avís, la secció de l'inspector on es corregeix (per decisió de l'usuari, 2026-10-17: «mostrar al lloc
 * on està el fallo què cal tocar»). Els que no tenen un sol lloc (un xoc de forats, un ferratge) no en porten.
 */
const FIX: Partial<Record<Code, FixPlace>> = {
  "door-too-wide": ZONE(["zone-front"], "Front"),
  "door-too-tall": ZONE(["zone-front"], "Front"),
  hinge: ZONE(["zone-front"], "Front"),
  "grille-open-ratio": ZONE(["zone-front"], "Front"),
  "drawer-no-slide": ZONE(["zone-front"], "Front"),
  "drawer-box": ZONE(["zone-front"], "Front"),
  handle: ZONE(["zone-handle"], "Tirador"),
  push: ZONE(["zone-handle"], "Tirador"),
  "shelf-span": ZONE(["zone-shelves", "zone-shelves-shelves"], "Interior › Prestatges"),
  shelves: ZONE(["zone-shelves", "zone-shelves-shelves"], "Interior › Prestatges"),
  hollow: ZONE(["zone-shelves", "zone-shelves-shelves"], "Interior › Prestatges"),
  "shelf-strut": ZONE(["zone-shelves", "zone-shelves-shelves"], "Interior › Prestatges"),
  rail: ZONE(["zone-shelves", "zone-shelves-accessories"], "Interior › Accessoris"),
  light: ZONE(["zone-shelves", "zone-shelves-accessories"], "Interior › Accessoris"),
  "inner-drawers": ZONE(["zone-shelves", "zone-shelves-drawers"], "Interior › Calaixos interiors"),
  appliance: ZONE(["zone-appliance"], "Electrodomèstic"),
  layout: ZONE(["zone-split"], "Divisió"),
  "back-groove": MODULE(["mod-structure", "mod-carcass-back"], "Caixa › Fons"),
  "back-inset": MODULE(["mod-structure", "mod-carcass-back"], "Caixa › Fons"),
  hanging: MODULE(["mod-structure", "mod-carcass-back"], "Caixa › Fons"),
  "no-side": MODULE(["mod-structure", "mod-carcass-sides"], "Caixa › Laterals"),
  table: MODULE(["mod-structure", "mod-carcass-top"], "Caixa › Tapa"),
  inset: MODULE(["mod-structure", "mod-carcass-fronts"], "Caixa › Fronts"),
  mitre: MODULE(["mod-structure", "mod-carcass-fronts"], "Caixa › Fronts"),
  "drawer-bottom": MODULE(["mod-materials"], "Materials › Fons del calaix"),
  "material-heat": MODULE(["mod-materials"], "Materials"),
  "unknown-material": MODULE(["mod-materials"], "Materials"),
  "thickness-not-listed": MODULE(["mod-materials"], "Materials"),
  "invalid-part": MODULE(["mod-dims"], "Mides"),
  overlap: MODULE(["mod-position"], "Posició"),
}

/** On s'arregla un avís, com ho diu el botó («Caixa › Fons»), o res si no té un lloc. */
export function fixLabel(w: Pick<CompositionWarning, "code" | "zoneId" | "moduleId" | "options">): string | null {
  // Amb opcions, cada una porta el seu lloc.
  if (w.options?.length) return null
  const p = FIX[w.code]
  if (!p) return null
  if (p.level === "zone" && !(w.zoneId && w.moduleId)) return null
  if (p.level === "module" && !w.moduleId) return null
  return p.label
}

/** De quines peces parla un avís del mòdul que no en porta cap. */
const ROLE_HINT: Partial<Record<Code, string[]>> = {
  "back-groove": ["back"],
  "back-inset": ["back"],
  hanging: ["back"],
  "drawer-bottom": ["drawerBottom"],
  "no-side": ["side"],
  table: ["top", "worktop"],
  "material-heat": ["grille"],
  mitre: ["drawerFront", "side"],
}

/** Com ho diu el botó d'una opció («Posició»), o res si no té lloc. */
export function placeLabel(where: FixPlaceKey | undefined): string | null {
  return where ? FIX_PLACES[where].label : null
}

/** Les mides del moble per centrar l'escena (les mateixes que el visor: `frameSize`). */
type Size = { width: number; height: number; depth: number }

interface WarningTarget {
  /** Què seleccionar (l'objecte, la peça, el compartiment o el mòdul). */
  select: Selection | null
  /** Les peces on és el problema (ids de la composició) i la caixa on enquadrar-les (mm de la composició). */
  panels: string[]
  box: { min: [number, number, number]; max: [number, number, number] } | null
  /** On s'arregla, si en té un lloc. */
  fix: FixPlace | null
}

/** On és i on s'arregla un avís (només el que se'n pot saber: les peces, el compartiment, el mòdul o l'objecte). */
export function warningTarget(w: CompositionWarning, comp: Composition, build: CompositionBuild | undefined, where?: FixPlaceKey): WarningTarget {
  const place = where ? FIX_PLACES[where] : w.options?.length ? null : (FIX[w.code] ?? null)
  const mb = w.moduleId ? build?.modules.find((m) => m.id === w.moduleId) : undefined
  // Les peces: la de l'avís (local del mòdul o ja de la composició), les del compartiment, les del mòdul o les de la peça lliure.
  let panels: string[] = []
  if (w.panelId) {
    const id = build?.panels.some((p) => p.id === w.panelId) ? w.panelId : w.moduleId ? `${w.moduleId}:${w.panelId}` : w.panelId
    if (build?.panels.some((p) => p.id === id)) panels = [id]
  }
  let box: WarningTarget["box"] = null
  if (!panels.length && w.zoneId && mb) {
    const rect = mb.build.layout.rects.get(w.zoneId)
    const m = comp.modules.find((x) => x.id === w.moduleId)
    if (rect && m) {
      const z = moduleBoxToWorld(mb, { x0: rect.x0, x1: rect.x1, y0: rect.y0, y1: rect.y1, z0: 0, z1: m.carcass.depth + m.carcass.thickness })
      box = { min: [z.x0, z.y0, z.z0], max: [z.x1, z.y1, z.z1] }
      // Les peces del mòdul que hi cauen (el front, els prestatges…), per marcar-les.
      panels = (build?.panels ?? []).filter((p) => p.module === mb.index && inside(center(panelBox(p)), box!)).map((p) => p.id)
    }
  }
  if (!panels.length && !box && w.partId) panels = (build?.panels ?? []).filter((p) => p.id === `part:${w.partId}` || p.id.startsWith(`part:${w.partId}-`)).map((p) => p.id)
  // Del mòdul sense peça: les del tipus de què parla l'avís (el fons, els laterals…); si no, cap de marcada i la càmera
  // a tot el mòdul (marcar-les totes no diu res).
  if (!panels.length && !box && mb) {
    const own = (build?.panels ?? []).filter((p) => p.module === mb.index)
    const roles = ROLE_HINT[w.code]
    if (roles) panels = own.filter((p) => roles.includes(p.role)).map((p) => p.id)
    if (!panels.length && own.length) box = union(own.map(panelBox))
  }
  if (!box && panels.length) box = union(panels.map((id) => panelBox(build!.panels.find((p) => p.id === id)!)))
  if (w.refId && !w.refId.startsWith("part:")) {
    const r = comp.references.find((o) => o.id === w.refId)
    if (r) box = union([...(box ? [box] : []), { min: [r.x, r.y, r.z], max: [r.x + r.w, r.y + r.h, r.z + r.d] }])
  }

  // Què seleccionar: el que té la secció on s'arregla; si no, el més concret que hi ha.
  let select: Selection | null = null
  if (place?.level === "moble") select = { kind: "moble" }
  else if (place?.level === "ref" && w.refId && !w.refId.startsWith("part:")) select = { kind: "ref", id: w.refId }
  else if (place?.level === "part" && (w.partId || w.refId?.startsWith("part:"))) select = { kind: "part", id: w.partId ?? w.refId!.slice(5) }
  else if (place?.level === "zone" && w.zoneId && w.moduleId) select = { kind: "zone", moduleId: w.moduleId, zoneId: w.zoneId }
  else if (place?.level === "module" && w.moduleId) select = { kind: "module", id: w.moduleId }
  else if (w.refId && !w.refId.startsWith("part:")) select = { kind: "ref", id: w.refId }
  else if (w.partId) select = { kind: "part", id: w.partId }
  else if (w.zoneId && w.moduleId) select = { kind: "zone", moduleId: w.moduleId, zoneId: w.zoneId }
  else if (w.moduleId) select = { kind: "module", id: w.moduleId }
  // Una secció de compartiment sense compartiment, o de mòdul sense mòdul: no es pot obrir.
  const fix = place && select && place.level === (select.kind === "moble" ? "moble" : select.kind) ? place : null
  return { select, panels, box, fix }
}

type Box = NonNullable<WarningTarget["box"]>
const center = (b: Box): [number, number, number] => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
const inside = (c: [number, number, number], b: Box) => [0, 1, 2].every((k) => c[k]! >= b.min[k]! - 0.5 && c[k]! <= b.max[k]! + 0.5)
function union(bs: Box[]): Box {
  return {
    min: [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k]!))) as [number, number, number],
    max: [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k]!))) as [number, number, number],
  }
}

/** La càmera que enquadra una caixa de la composició (mm) des del 3/4 de davant, en metres de l'escena del visor. */
export function framePose(box: Box, size: Size, fov = 38): { position: [number, number, number]; target: [number, number, number]; fov: number } {
  const S = 0.001
  // L'escena del visor és centrada en X i Z (`CabinetViewer`: el grup es desplaça mig moble).
  const off: [number, number, number] = [-size.width * S * 0.5, 0, -size.depth * S * 0.5]
  const c = center(box)
  const target: [number, number, number] = [c[0] * S + off[0], c[1] * S + off[1], c[2] * S + off[2]]
  const r = 0.5 * Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) * S
  const dist = Math.max(0.35, (r / Math.sin((fov * Math.PI) / 360)) * 1.6)
  const dir = [0.55, 0.42, 1]
  const len = Math.hypot(dir[0]!, dir[1]!, dir[2]!)
  const position: [number, number, number] = [target[0] + (dir[0]! / len) * dist, target[1] + (dir[1]! / len) * dist, target[2] + (dir[2]! / len) * dist]
  return { position, target, fov }
}
