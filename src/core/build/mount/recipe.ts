import { DEFAULT_GRILLE, DEFAULT_MODULE_HARDWARE, isPendingImport, type Front, type HardwareItem, type Module, type Panel, type Vec3 } from "../../model"
import { kitHeight } from "../drawerKit"
import { builtinSolids, fixedSolids, shelfPins, solidBox } from "../hardwareSolids"
import { toWorld } from "../geometry"
import { addBox, addPoint, boxDistance, boxGap, boxHas, boxOf, builtinHandleBox, emptyBox, fittingBox, holeEntry, localBox, mountHoles, worldDir } from "./box"
import type { Box } from "./types"

/** La recepta del mòdul d'exemple de cada ferratge i el tros que ha de sortir a la imatge (`mountRegion`). */

/** Marge de peça al voltant del ferratge a la imatge (mm). */
const REGION_MARGIN = 40
/** Ferratges que es miren a prop del forat principal (la frontissa de baix, una pota, uns forats de la filera). */
const NEAR_RADIUS = 120

/** Etiquetes dels mecanitzats d'un item (els de la placa aparellada, «plate»). */
export function itemTags(item: HardwareItem): string[] {
  const tags = new Set<string>()
  for (const t of item.targets) for (const op of t.ops) if (op.tag) tags.add(op.tag)
  if (item.engine === "cup" && item.targets.some((t) => t.key === "side")) tags.add("plate")
  if (item.engine === "plate") tags.add("plate")
  // Un joc de llum: també el recorregut del cable (el forat per dins del tauler, els passants), com al moble.
  if (item.light) for (const t of ["cable-run", "cable-mains"]) tags.add(t)
  return [...tags]
}

/** Frontissa de base per veure una placa: la del mòdul si no és un importat pendent; si no, la d'inici de l'app. */
export function hostHinge(base: Module): HardwareItem {
  const h = base.hardware.hinge
  return h.engine === "cup" && !isPendingImport(h) ? h : DEFAULT_MODULE_HARDWARE.hinge
}

interface Recipe {
  size: { width: number; height: number; depth: number }
  /** Base del mòdul (per defecte, cap: el muntatge només mira les peces del ferratge). */
  base?: Module["carcass"]["base"]
  front?: Front
  shelves?: { n: number; adjustable: boolean }
  /** Accessoris del compartiment (barra, llum): hi són amb l'item. */
  rail?: boolean
  led?: boolean
  /** Peces que sempre hi són (a més de les que porten forats del ferratge). */
  keep: (p: Panel) => boolean
  /** Peces que no hi són encara que portin forats del ferratge (taparien els que importen: la caixa del calaix davant dels forats de la guia al lateral). */
  drop?: (p: Panel) => boolean
  /** Peces apartades (mm del mòdul) perquè es vegi el ferratge que tapen: la reixeta d'un imant, separada del cantell del lateral. */
  shift?: (p: Panel) => Vec3 | null
  /** Fins a quina distància del forat principal es mira (`NEAR_RADIUS` si no es diu): les espigues, tota la filera de la unió. */
  near?: number
  /** Elements sense nesting (`extras`) que es veuen muntats (la barra, els perfils, el marc i el vidre). */
  extras?: (p: Panel) => boolean
}

export const isLeftSide = (p: Panel) => p.id === "side-left"

export function recipe(item: HardwareItem): Recipe | null {
  const small = { width: 400, height: 450, depth: 320 }
  switch (item.engine) {
    case "cup":
    case "plate":
      return { size: small, front: { kind: "door", mode: "single", hinge: "left" }, keep: (p) => p.role === "door" || isLeftSide(p) }
    case "system32":
      return { size: small, shelves: { n: 1, adjustable: true }, keep: (p) => isLeftSide(p) || p.role === "shelf" }
    case "dowel":
      // Només el lateral: la base i la tapa taparien els forats de les espigues (queden dins la unió).
      return { size: small, keep: isLeftSide, drop: (p) => p.role === "bottom" || p.role === "top", near: 260 }
    case "slide":
      // El lateral (els forats de la guia) i el front: la caixa del calaix taparia els forats del lateral.
      return { size: { width: 450, height: 300, depth: 450 }, front: { kind: "drawers", n: 1, heights: ["auto"] }, keep: (p) => isLeftSide(p) || p.role === "drawerFront", drop: (p) => p.role === "drawerSide" || p.role === "drawerBack" || p.role === "drawerBottom" }
    case "flapArm":
      return { size: small, front: { kind: "flap", dir: "down" }, keep: (p) => isLeftSide(p) || p.role === "flap" }
    case "magnet":
      // La reixeta, apartada 60 mm del davant del moble: tancada taparia l'imant del cantell del lateral (i la seva placa).
      return { size: small, front: { kind: "grille", pattern: DEFAULT_GRILLE, mount: "removable", hinge: "left" }, keep: (p) => isLeftSide(p) || p.role === "grille", shift: (p) => (p.role === "grille" ? [0, 0, 60] : null) }
    case "barHandle":
      return { size: { width: 450, height: 300, depth: 450 }, front: { kind: "drawers", n: 1, heights: ["auto"] }, keep: (p) => p.role === "drawerFront" || isLeftSide(p) }
    case "leg":
      // Mòdul baix sobre potes: la base (amb els forats de les quatre potes) i el lateral esquerre.
      return { size: { width: 500, height: 300, depth: 450 }, base: { kind: "legs", height: Math.max(20, item.imported?.bbox?.max[2] ?? 100), hardware: item }, keep: (p) => p.role === "bottom" || isLeftSide(p) }
    case "model":
      return null
    case "drawerKit":
      // Calaix amb joc: el lateral esquerre (prebroques de la guia), el front, el fons i el darrere de fusta i els components.
      // Prou alt perquè hi càpiga el joc (la F fa 248).
      return { size: { width: 450, height: Math.max(300, (item.kit ? kitHeight(item.kit) : 0) + 140), depth: 500 }, front: { kind: "drawers", n: 1, heights: ["auto"] }, keep: (p) => isLeftSide(p) || p.role === "drawerFront" || p.role === "drawerBottom" || p.role === "drawerBack" }
    case "rail":
      // Compartiment de penjar: els dos laterals, la tapa i la barra.
      return { size: { width: 600, height: 1000, depth: 500 }, rail: true, keep: (p) => p.role === "side" || p.role === "top", extras: (p) => p.id.startsWith("rail-") }
    case "ledProfile":
      // Prestatge amb la llum a sota: lateral esquerre, tapa, prestatge i els perfils.
      return { size: { width: 600, height: 600, depth: 350 }, shelves: { n: 1, adjustable: false }, led: true, keep: (p) => isLeftSide(p) || p.role === "shelf" || p.role === "top", extras: (p) => p.id.startsWith("led-") || p.id.startsWith("light-") || p.id.startsWith("wiring-") }
    case "glassFrame":
      // Porta de vidre: el lateral esquerre i el marc amb el vidre.
      return { size: small, front: { kind: "door", mode: "single", hinge: "left", glass: true }, keep: isLeftSide, extras: (p) => /-(left|right|top|bottom|glass)$/.test(p.id) }
  }
}

/**
 * El que ha de sortir a la imatge de «Com va muntat»: el ferratge (el GLB o la caixa d'un importat, el volum de la
 * frontissa o del tirador de l'app, els components d'un joc i els perfils d'un accessori), els forats que fa (sencers, amb
 * la fondària) i `REGION_MARGIN` de peça al voltant. Els que es repeteixen al llarg del mòdul (frontisses, filera System
 * 32, espigues, imants, potes) es miren només a prop del forat principal (`NEAR_RADIUS`): la frontissa de baix amb la seva
 * placa, una pota amb la seva cantonada de la base; els que són un sol tros (guia, braç, tirador, joc, barra, perfil
 * LED, marc) sencers.
 */
export function mountRegion(engine: HardwareItem["engine"], panels: Panel[], tags: string[], at: Vec3 | null, rc: Recipe): Box {
  const near = at && ["cup", "plate", "system32", "dowel", "magnet", "leg"].includes(engine) ? (b: Box) => boxDistance(b, at) <= (rc.near ?? NEAR_RADIUS) : () => true
  const own = (h: { tag?: string }) => !!h.tag && tags.includes(h.tag)
  const region = emptyBox()
  const take = (b: Box) => {
    if (near(b)) addBox(region, b)
  }
  for (const p of panels) {
    // Els components d'un joc i els perfils d'un accessori: sencers.
    // (El recorregut dels cables dels llums, no: l'alimentador és lluny de la làmpada i la càmera no la veuria.)
    if (p.id.startsWith("wiring-")) continue
    if (p.role === "hardware" || rc.extras?.(p)) {
      addBox(region, boxOf(p))
      continue
    }
    for (const h of mountHoles(p)) {
      if (!own(h) && !(engine === "plate" && h.tag === "hinge")) continue
      const e = holeEntry(p, h)
      const E = toWorld(p, e.at)
      const n = worldDir(p, e.normal)
      const hb = emptyBox()
      addPoint(hb, E, h.diameter / 2)
      addPoint(hb, [E[0] - n[0] * h.depth, E[1] - n[1] * h.depth, E[2] - n[2] * h.depth], h.diameter / 2)
      take(hb)
    }
    for (const f of p.fittings ?? []) if (f.bbox) take(fittingBox(p, f, f.bbox))
    if (engine === "barHandle") {
      const hb = builtinHandleBox(p)
      if (hb) take(localBox(p, hb))
    }
  }
  // El dibuix 3D dels ferratges de sèrie (frontissa amb braç i placa, guia, suports de prestatge, braç, barra, perfil…):
  // el mateix que pinten el visor i la miniatura (`builtinSolids`), només el que toca el ferratge (no les espigues de la
  // caixa d'un lateral que hi surt per a una altra cosa).
  if (boxHas(region)) {
    const base: Box = { min: [...region.min], max: [...region.max] }
    const pins = shelfPins(panels)
    const fixed = fixedSolids(panels)
    for (const p of panels) for (const s of builtinSolids(p, pins.get(p.id), fixed.get(p.id))) {
      const b = solidBox(p, s)
      if (boxGap(b, base) <= 30) addBox(region, b)
    }
  }
  if (!boxHas(region)) {
    // Res del ferratge (un motor que ha fallat a mig camí): el forat principal, o les peces que hi ha.
    if (at) addPoint(region, at, 60)
    else for (const p of panels) addBox(region, boxOf(p))
    if (!boxHas(region)) return { min: [0, 0, 0], max: [rc.size.width, rc.size.height, rc.size.depth] }
  }
  for (const k of [0, 1, 2] as const) {
    region.min[k] -= REGION_MARGIN
    region.max[k] += REGION_MARGIN
  }
  return region
}
