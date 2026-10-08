import type { Front, Module, Zone } from "./composition"
import { visibleModule, walkBuiltZones } from "./composition"
import { HARDWARE_SLOTS, isDrawerKit, moduleSlotItem, type HardwareItem, type HardwareSlot } from "./hardware"
import { isPushClosing, kitOptionsOf, type HardwareKit } from "./hardwareKit"

type SlotUse = Map<HardwareSlot, { count: number; what: string }>

/** Comptador per lloc amb el «què» de cada ús (portes, calaixos…), per dir-ho a la fila. */
function slotCounter(): { out: SlotUse; add: (slot: HardwareSlot, n: number, what: string) => void } {
  const out: SlotUse = new Map()
  const add = (slot: HardwareSlot, n: number, what: string) => {
    if (n <= 0) return
    const cur = out.get(slot)
    out.set(slot, { count: (cur?.count ?? 0) + n, what: cur && cur.what !== what ? `${cur.what}, ${what}` : what })
  }
  return { out, add }
}

/**
 * **Quins ferratges fa servir un mòdul**, segons el que té (res amagat compta: es mira el mòdul tal com es veu). És el
 * que l'inspector ensenya («Acabats i ferratges» del mòdul i «Acabats» de l'Interior): en una tauleta amb un calaix no hi
 * pinten res la frontissa, el braç d'abatible ni l'imant. Per a cada lloc, quants elements el fan servir (portes,
 * calaixos…), per dir-ho a la fila. **L'única font** (abans n'hi havia una altra que mirava les peces construïdes: amb un
 * joc de calaix que no hi cap no hi ha cap forat de guia i la fila «Guia de calaix» desapareixia justament quan cal
 * canviar el joc): declarativa, del model, no del resultat; el constructor només resol els llocs que fa servir
 * (`resolveKit` a demanda), que són aquests.
 * - frontissa i System 32: portes (no de vidre) i reixetes amb frontisses; System 32 també amb prestatges regulables;
 * - guia: compartiments de calaixos; braç: abatibles; imant: reixetes desmuntables;
 * - tirador: fronts (portes, calaixos, abatibles) que en porten (el seu o el per defecte del mòdul; un joc push-open, no);
 * - barra i llum: compartiments que en tenen; marc de vitrina: portes de vidre;
 * - espiga: les unions a topar de la caixa (`carcassDowels`: a inglet i amb tauler de taula no n'hi ha), els divisors i
 *   prestatges fixos i el fons encastat; System 32 també amb el fons encastat (la fondària que cal davant del fons).
 * Els fronts **tapats** pel front d'un compartiment de més amunt no es fan (`walkBuiltZones`): no compten.
 */
export function usedHardwareSlots(module: Module): SlotUse {
  const m = visibleModule(module)
  const { out, add } = slotCounter()
  for (const what of carcassDowels(m)) add("dowel", 1, what)
  // El fons encastat comprova que davant seu hi càpiguen les dues fileres System 32 (`buildInsetBack`): llegeix els números del lloc.
  if (m.carcass.back === "inset") add("system32", 1, "fons encastat")
  walkBuiltZones(m.root, (z, { covered }) => {
    // «Regulables» compta també sense cap prestatge (les fileres es fan per posar-n'hi després).
    if (z.shelves?.adjustable) add("system32", 1, "prestatges regulables")
    if (z.rail) add("rail", 1, "barres de penjar")
    if (z.led) add("led", 1, "llums")
    if (!z.front || covered) return
    frontSlots(m, z.front, add, false)
  })
  return out
}

/**
 * Els llocs de cada front: tots (`inheritedOnly = false`, el que el mòdul fa servir) o només els que llegeixen el **per
 * defecte del mòdul** (`true`: el front no en té un de propi; «Com el mòdul»).
 */
function frontSlots(m: Module, f: Front, add: (slot: HardwareSlot, n: number, what: string) => void, inheritedOnly: boolean): void {
  const own = (x: unknown) => inheritedOnly && x !== undefined
  if (f.kind === "door" && f.glass) {
    if (!own(f.frame)) add("glassFrame", f.mode === "double" ? 2 : 1, "vitrines")
  } else if (f.kind === "door") {
    const doors = f.mode === "double" ? 2 : 1
    if (!own(f.hardware)) add("hinge", doors, "portes")
    // La filera System 32 és de la caixa (Acabats i ferratges): no té per defecte als fronts.
    if (!inheritedOnly) add("system32", doors, "portes")
    if (frontHasHandle(m, f) && !own(f.handle)) add("handle", doors, "portes")
  } else if (f.kind === "drawers") {
    if (!own(f.hardware)) add("slide", f.n, "calaixos")
    const moduleKit = isDrawerKit(moduleSlotItem(m.hardware, "slide"))
    const kit = f.hardware ? (isDrawerKit(f.hardware) ? f.hardware : undefined) : moduleKit ? (moduleSlotItem(m.hardware, "slide") as HardwareItem & { kit: HardwareKit }) : undefined
    // El tancament del joc mana: push-open ⇒ cap tirador.
    if (frontHasHandle(m, f) && !own(f.handle) && !(kit && isPushClosing(kitOptionsOf(kit.kit, f.kit).closing))) add("handle", f.n, "calaixos")
  } else if (f.kind === "flap") {
    if (!own(f.hardware)) add("flap", 1, "abatibles")
    if (frontHasHandle(m, f) && !own(f.handle)) add("handle", 1, "abatibles")
  } else if (f.kind === "grille") {
    // L'imant d'una reixeta (desmuntable o trapa) pot ser propi; les frontisses d'una reixeta són sempre les del mòdul.
    const magnets = (f.mount === "removable" ? 1 : 0) + (f.hatch ? 1 : 0)
    if (magnets && !own(f.hardware)) {
      if (f.mount === "removable") add("magnet", 1, "reixetes")
      if (f.hatch) add("magnet", 1, "trapes")
    }
    if (f.mount !== "removable") {
      add("hinge", 1, "reixetes")
      if (!inheritedOnly) add("system32", 1, "reixetes")
    }
  }
  // Front fix: cap ferratge (ni tirador, ni frontissa).
}

/**
 * Els llocs on el **per defecte del mòdul** fa de debò de per defecte: algun compartiment (un front o un accessori, no
 * tapat) no en té un de propi i el llegeix («Com el mòdul»). `exclude`: compartiments que ja ensenyen la seva tria a la
 * mateixa pantalla (a l'«Interior», l'arrel: el seu Front i els seus Accessoris), perquè no surti dues vegades. És el que
 * ensenya «Acabats › Per defecte dels compartiments» (un sol lloc per decisió).
 */
export function inheritedSlots(module: Module, exclude: ReadonlySet<string> = new Set()): SlotUse {
  const m = visibleModule(module)
  const { out, add } = slotCounter()
  walkBuiltZones(m.root, (z, { covered }) => {
    if (exclude.has(z.id)) return
    if (z.rail && !z.rail.hardware) add("rail", 1, "barres de penjar")
    if (z.led && !z.led.hardware) add("led", 1, "llums")
    if (!z.front || covered) return
    frontSlots(m, z.front, add, true)
  })
  return out
}

/** Quines opcions de tots els fronts del mòdul (Interior › Acabats) llegeix la construcció. */
export interface FrontOptionsUse {
  /** Recobrents / Encastats i la folgança front–cos: hi ha algun front que es fa (també un front fix o una reixeta). */
  style: boolean
  outerGap: boolean
  /** Folgança entre fronts: dues portes, dos calaixos o més, o un front recobrent al costat d'un divisor o un prestatge fix. */
  betweenGap: boolean
  /** Retranqueig dels prestatges: algun prestatge que no va a ras del davant, o una tira LED (es mesura des del prestatge). */
  shelfSetback: boolean
}

/**
 * Les opcions de «Acabats» que la construcció llegeix per a aquest mòdul (la UI només ensenya aquestes; les
 * altres es conserven i no compten). La mateixa lògica que `frontTerritory`, `buildShelves` i `buildLed` de `buildModule`.
 */
export function frontOptionsUse(module: Module): FrontOptionsUse {
  const m = visibleModule(module)
  const inset = m.fronts.style === "inset"
  const use: FrontOptionsUse = { style: false, outerGap: false, betweenGap: false, shelfSetback: false }
  walkBuiltZones(m.root, (z, { covered, isRoot }) => {
    const f = covered ? undefined : z.front
    if (f) {
      use.style = use.outerGap = true
      if ((f.kind === "door" && f.mode === "double") || (f.kind === "drawers" && f.n >= 2) || (!inset && !isRoot)) use.betweenGap = true
    }
    if (z.split) return
    if (z.led) use.shelfSetback = true
    const s = z.shelves
    if (s && s.n > 0 && z.front?.kind !== "drawers") {
      // A ras del davant: sense retranqueig, llevat que un front encastat ho impedeixi (`buildShelves`).
      const blocked = inset && (!!z.front || covered)
      if (!s.flush || blocked) use.shelfSetback = true
    }
  })
  return use
}

/**
 * On fa espigues la caixa (`buildModule`: `buildHorizontal`, `buildInsetBack`, `joinDivider`, `joinFixedShelf`). Les
 * cantonades a inglet (tapa i base a 45°, s'encolen amb lamel·les o Clamex), el tauler de taula (cargolat per sota) i les
 * parets buides (encolades) no en porten: un mòdul tot a inglet, sense divisions ni fons encastat, no fa servir l'espiga.
 * Les caixes dels calaixos de fusta porten les seves (Ø segons el gruix de la caixa), no les del mòdul.
 */
export function carcassDowels(m: Module): string[] {
  const c = m.carcass
  const out: string[] = []
  const sides = c.sides.left || c.sides.right
  const hollow = !!c.hollow && c.hollow.thickness >= 2 * c.thickness + 6
  const tableTop = !!c.tableTop && c.top.kind === "full"
  const hasTop = c.top.kind !== "none"
  const hasBase = c.base.kind !== "open"
  const mitre = c.joint === "mitre"
  const mitreTop = !hollow && !tableTop && mitre && hasTop && sides
  const mitreBottom = !hollow && mitre && hasBase && c.base.kind !== "plinth" && sides
  // Paret buida: la tapa sencera i la base són de dues pells (sense espigues); una tapa amb ranura d'aire o reixeta no.
  const hollowTop = hollow && c.top.kind === "full" && !tableTop
  if (sides && hasTop && !tableTop && !hollowTop && !mitreTop) out.push("tapa")
  if (sides && hasBase && !hollow && !mitreBottom) out.push("base")
  // Fons encastat: amb espigues si fa 15 mm o més; la tapa de reixeta deixa la franja de les espigues sense ranures.
  if (c.back === "inset" && (c.backThickness >= 15 || c.top.kind === "grille")) out.push("fons encastat")
  if (hasSplit(m.root)) out.push("divisions")
  return out
}

const hasSplit = (z: Zone): boolean => !!z.split

/** El front porta tirador: el seu («Cap (push)» = no) o, sense dir res, el per defecte del mòdul. */
function frontHasHandle(m: Module, f: Extract<Front, { kind: "door" | "drawers" | "flap" }>): boolean {
  if (f.handle === "none") return false
  if (f.handle) return true
  return m.fronts.handles !== "none"
}

/** Llocs de ferratge de la **caixa** (laterals, unions, fons): surten a «Acabats i ferratges» del mòdul. La resta són dels fronts. */
export const BOX_SLOTS: ReadonlySet<HardwareSlot> = new Set<HardwareSlot>(["dowel", "system32"])

/** El que ensenya Interior › «Acabats»: les opcions de tots els fronts que es llegeixen i els per defecte que algú hereta. */
export interface FrontsSection extends FrontOptionsUse {
  /** «Per defecte dels compartiments»: el tirador primer i després en l'ordre de `HARDWARE_SLOTS`. */
  defaults: { slot: HardwareSlot; count: number; what: string }[]
}

/**
 * Les files de «Acabats» (Interior, l'arrel del mòdul), **un sol lloc per decisió**: l'estil, les folgances i
 * el retranqueig només si la construcció els llegeix (`frontOptionsUse`); els ferratges per defecte del mòdul només si
 * algun compartiment els hereta («Com el mòdul») i no és a la mateixa pantalla (`shown`: l'arrel, que ja ensenya el seu
 * Front i els seus Accessoris). Sense res, la secció no surt.
 */
export function frontsSection(module: Module, shown: ReadonlySet<string> = new Set([module.root.id])): FrontsSection {
  const inherited = inheritedSlots(module, shown)
  const order: HardwareSlot[] = ["handle", ...HARDWARE_SLOTS.map((x) => x.slot).filter((x) => x !== "handle")]
  const defaults = order.filter((slot) => !BOX_SLOTS.has(slot) && inherited.has(slot)).map((slot) => ({ slot, ...inherited.get(slot)! }))
  return { ...frontOptionsUse(module), defaults }
}

/** La secció «Acabats» no té res a ensenyar. */
export const frontsSectionEmpty = (s: FrontsSection): boolean => !s.style && !s.outerGap && !s.betweenGap && !s.shelfSetback && !s.defaults.length

/** Els llocs que fa servir el mòdul, com a conjunt (per filtrar els selectors de l'inspector). */
export const usedSlotSet = (module: Module): ReadonlySet<HardwareSlot> => new Set(usedHardwareSlots(module).keys())
