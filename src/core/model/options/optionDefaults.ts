import { DEFAULT_GRILLE, type Base, type Front, type Module, type Top, type Zone } from "../composition"
import type { FreePart } from "../freePart"
import type { RefObject } from "../compositionSchema"
import { defaultFront } from "../zoneOps"
import { optionDefault, userOptionDefault, type OptionPrefs } from "./optionCascade"

/**
 * Els **valors per defecte de l'usuari** (Preferències › Opcions en cascada) als elements nous: el mòdul del «+», els
 * compartiments nous d'una divisió, el front que es posa per primer cop, la peça lliure i l'objecte nous. Només els que
 * l'usuari ha canviat (`userOptionDefault`): sense cap preferència, res no canvia. Els mobles fets no es toquen.
 */

const num = (prefs: OptionPrefs | undefined, id: string): number | undefined => {
  const v = optionDefault(prefs, id)
  return typeof v === "number" ? v : undefined
}

/** Un mòdul nou (el + de «Mòduls», després de `applySettingsToModule`). */
export function applyModuleOptionDefaults(m: Module, prefs: OptionPrefs | undefined): Module {
  if (!prefs || !Object.keys(prefs).length) return m
  const u = (id: string) => userOptionDefault(prefs, id)
  let c = { ...m.carcass }
  const w = u("module.dims.width"), h = u("module.dims.height"), d = u("module.dims.depth")
  if (typeof w === "number") c.width = w
  if (typeof h === "number") c.height = h
  if (typeof d === "number") c.depth = d
  const support = u("module.carcass.support")
  if (c.base.kind !== "wall" && (support === "none" || support === "plinth" || support === "legs")) c.base = baseWithDefaults(support, prefs)
  const bottom = u("module.carcass.bottom")
  if (bottom === "none") c.noBottom = true
  else if (bottom === "full") {
    const { noBottom: _n, ...rest } = c
    c = rest
  }
  const back = u("module.carcass.back")
  if (back === "groove" || back === "screwed" || back === "none") c.back = back
  else if (back === "inset") c = { ...c, back, ...(c.backThickness < 15 ? { backMaterial: c.material, backThickness: c.thickness } : {}) }
  const top = u("module.carcass.top")
  if (typeof top === "string") c.top = (top === "ventSlot" ? { kind: "ventSlot", gap: 60 } : top === "grille" ? { kind: "grille", pattern: DEFAULT_GRILLE } : { kind: top }) as Top
  if (u("module.carcass.tableTop") === true && c.top.kind === "full") c.tableTop = { overhang: 30 }
  const sides = u("module.carcass.sides")
  if (typeof sides === "string") c.sides = { left: sides === "left" || sides === "both", right: sides === "right" || sides === "both" }
  if (u("module.carcass.hollow") === true) c.hollow = { thickness: Math.max(60, 2 * c.thickness + 20) }
  if (u("module.carcass.joint") === "mitre") c.joint = "mitre"
  const style = u("module.carcass.frontStyle")
  const fronts = style === "inset" ? { ...m.fronts, style: "inset" as const } : m.fronts
  return { ...m, carcass: c, fronts, root: applyZoneOptionDefaults(m.root, prefs) }
}

/** El suport triat (Mòdul › Caixa › Suport) amb les mides per defecte de l'usuari (sòcol de 60 × 30, potes de 100). */
export function baseWithDefaults(kind: "none" | "plinth" | "legs", prefs: OptionPrefs | undefined): Base {
  if (kind === "plinth") return { kind, height: num(prefs, "module.carcass.plinthHeight") ?? 60, setback: num(prefs, "module.carcass.plinthSetback") ?? 30 }
  if (kind === "legs") return { kind, height: num(prefs, "module.carcass.legHeight") ?? 100 }
  return { kind }
}

/** Un compartiment nou (sense divisió): contingut, prestatges i accessoris de l'usuari. */
function applyZoneOptionDefaults(z: Zone, prefs: OptionPrefs | undefined): Zone {
  if (!prefs || z.split) return z
  const u = (id: string) => userOptionDefault(prefs, id)
  let out = z
  const n = u("zone.shelves.count"), adjustable = u("zone.shelves.adjustable"), flush = u("zone.shelves.flush")
  if (n !== undefined || adjustable !== undefined || flush !== undefined) {
    const cur = z.shelves ?? { n: 0, adjustable: optionDefault(prefs, "zone.shelves.adjustable") === true }
    const { flush: _f, ...rest } = cur
    const isFlush = flush === undefined ? !!cur.flush : flush === true
    out = { ...out, shelves: { ...rest, ...(typeof n === "number" ? { n } : {}), ...(typeof adjustable === "boolean" ? { adjustable } : {}), ...(isFlush ? { flush: true } : {}) } }
  }
  if (u("zone.shelves.rail") === true && !out.rail) out = { ...out, rail: {} }
  if (u("zone.shelves.led") === true && !out.led) out = { ...out, led: {} }
  const kind = u("zone.front.kind")
  if (typeof kind === "string" && kind !== "none" && !out.front) out = { ...out, front: frontWithDefaults(kind as Front["kind"], prefs) }
  return out
}

/** El front en blanc d'un tipus (`defaultFront`) amb els per defecte de l'usuari (una porta, quants calaixos…). */
export function frontWithDefaults(kind: Front["kind"], prefs: OptionPrefs | undefined): Front {
  const f = defaultFront(kind)
  if (!prefs) return f
  const u = (id: string) => userOptionDefault(prefs, id)
  switch (f.kind) {
    case "door": {
      const mode = u("zone.front.door.mode"), hinge = u("zone.front.door.hingeSide")
      return { ...f, ...(mode === "single" || mode === "double" ? { mode } : {}), ...(hinge === "left" || hinge === "right" ? { hinge } : {}), ...(u("zone.front.door.glass") === true ? { glass: true } : {}) }
    }
    case "drawers": {
      const n = u("zone.front.drawers.count")
      return typeof n === "number" ? { ...f, n, heights: Array.from({ length: n }, () => "auto" as const) } : f
    }
    case "flap": {
      const dir = u("zone.front.flap.dir")
      return dir === "up" || dir === "down" ? { ...f, dir } : f
    }
    case "grille": {
      const kind = u("zone.front.grille.pattern"), mount = u("zone.front.grille.mount")
      return { ...f, ...(kind === "slotsV" || kind === "slotsH" || kind === "holes" ? { pattern: { ...f.pattern, kind } } : {}), ...(mount === "removable" || mount === "hinged" ? { mount } : {}) }
    }
    default:
      return f
  }
}

/** Després de dividir o d'afegir una zona: els compartiments nous en blanc (només l'id) reben els per defecte. */
export function withNewZoneDefaults(before: Zone, after: Zone, prefs: OptionPrefs | undefined): Zone {
  if (!prefs || !Object.keys(prefs).length) return after
  const old = new Set<string>()
  const collect = (z: Zone) => {
    old.add(z.id)
    for (const c of z.split?.children ?? []) collect(c)
  }
  collect(before)
  const visit = (z: Zone): Zone => {
    if (z.split) return { ...z, split: { ...z.split, children: z.split.children.map(visit) } }
    return !old.has(z.id) && Object.keys(z).length === 1 ? applyZoneOptionDefaults(z, prefs) : z
  }
  return visit(after)
}

/** Una peça lliure nova: efecte, veta i cantell de l'usuari (l'orientació la tria qui la crea, `optionDefault`). */
export function applyPartOptionDefaults(p: FreePart, prefs: OptionPrefs | undefined): FreePart {
  const u = (id: string) => userOptionDefault(prefs, id)
  const grain = u("part.material.grain")
  return {
    ...p,
    ...(u("part.effect") === "cut" ? { effect: "cut" as const } : {}),
    ...(grain === "v" || grain === "none" ? { grain } : {}),
    ...(u("part.cnc.edge") === true ? { edged: true } : {}),
  }
}

/** Un objecte de referència nou: l'efecte de l'usuari. */
export function applyRefOptionDefaults(r: RefObject, prefs: OptionPrefs | undefined): RefObject {
  return userOptionDefault(prefs, "ref.effect") === "cut" ? { ...r, effect: "cut" } : r
}
