import type { Front, Module, Zone } from "./composition"
import { visibleModule, walkBuiltZones } from "./composition"
import { isDrawerKit, moduleSlotItem, type HardwareItem, type HardwareSlot } from "./hardware"
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
 * que l'inspector ensenya (l'Espiga a Mòdul › Unió, la filera System 32 al compartiment): en una tauleta amb un calaix no hi
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
    frontSlots(m, z.front, add)
  })
  return out
}

/** Els llocs de ferratge de cada front (el seu o, «Com el mòdul», el del mòdul: tots dos compten). */
function frontSlots(m: Module, f: Front, add: (slot: HardwareSlot, n: number, what: string) => void): void {
  if (f.kind === "door" && f.glass) {
    add("glassFrame", f.mode === "double" ? 2 : 1, "vitrines")
  } else if (f.kind === "door") {
    const doors = f.mode === "double" ? 2 : 1
    add("hinge", doors, "portes")
    add("system32", doors, "portes")
    if (frontHasHandle(m, f)) add("handle", doors, "portes")
  } else if (f.kind === "drawers") {
    add("slide", f.n, "calaixos")
    const moduleKit = isDrawerKit(moduleSlotItem(m.hardware, "slide"))
    const kit = f.hardware ? (isDrawerKit(f.hardware) ? f.hardware : undefined) : moduleKit ? (moduleSlotItem(m.hardware, "slide") as HardwareItem & { kit: HardwareKit }) : undefined
    // El tancament del joc mana: push-open ⇒ cap tirador.
    if (frontHasHandle(m, f) && !(kit && isPushClosing(kitOptionsOf(kit.kit, f.kit).closing))) add("handle", f.n, "calaixos")
  } else if (f.kind === "flap") {
    add("flap", 1, "abatibles")
    if (frontHasHandle(m, f)) add("handle", 1, "abatibles")
  } else if (f.kind === "grille") {
    if (f.mount === "removable") add("magnet", 1, "reixetes")
    if (f.hatch) add("magnet", 1, "trapes")
    if (f.mount !== "removable") {
      add("hinge", 1, "reixetes")
      add("system32", 1, "reixetes")
    }
  }
  // Front fix: cap ferratge (ni tirador, ni frontissa).
}

/** Quines opcions de tots els fronts del mòdul (Mòdul › Caixa) llegeix la construcció. */
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
 * Les opcions dels fronts (Mòdul › Caixa) que la construcció llegeix per a aquest mòdul (la UI només ensenya aquestes; les
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

/**
 * Les files de l'inspector del mòdul que no són sempre a la vista, **un sol lloc per decisió** i **només el que la
 * construcció llegeix** (per decisió de l'usuari, 2026-10-08, ja no hi ha secció «Acabats»: cada fila és a la secció del
 * que toca):
 * - **Caixa**: Ranura o Retirada del fons (fons en ranura o encastat), l'Estil dels fronts, les folgances i el
 *   Retranqueig dels prestatges (`frontOptionsUse`);
 * - **Materials**: «Fronts» (`frontMaterial`) amb algun front que es fa (com l'Estil);
 * - **Unió**: l'Espiga si la caixa en fa (`usedHardwareSlots`, `carcassDowels`); sense, la secció no surt.
 * Els ferratges per defecte del mòdul (`module.hardware`, `module.fronts.handles`) no surten enlloc: cada compartiment
 * tria el seu al Front o a «Prestatges i accessoris» i els que diuen «Com el mòdul» els hereten (res amagat compta).
 */
export interface ModuleRows extends FrontOptionsUse {
  /** Caixa: «Ranura del fons» (fons en ranura) o «Retirada del fons» (fons encastat). */
  back?: "groove" | "inset"
  /** Materials › «Fronts». */
  frontMaterial: boolean
  /** Unió › «Espiga». */
  dowel: boolean
}

export function moduleRows(module: Module): ModuleRows {
  const use = frontOptionsUse(module)
  const b = module.carcass.back
  return { ...use, back: b === "groove" || b === "inset" ? b : undefined, frontMaterial: use.style, dowel: usedHardwareSlots(module).has("dowel") }
}

/** On surt la «Filera System 32» del mòdul a l'inspector del compartiment (`system32RowPlace`). */
export interface System32RowPlace {
  /** «Prestatges i accessoris» (al costat de «Regulables») o «Front» (després de la «Frontissa»). */
  at: "shelves" | "front"
  /** Els compartiments que l'ensenyen (cada un a la seva pantalla: mai dos llocs a la mateixa). */
  zones: ReadonlySet<string>
  /** Qui la fa servir (tot el mòdul), per dir-ho a l'ajuda. */
  what: string
}

/**
 * **On s'edita la filera System 32** (una per mòdul, `module.hardware.system32`): no és de la caixa sinó de qui fa les
 * fileres (opcions en cascada, un sol lloc per decisió). Als **Prestatges** dels compartiments amb prestatges regulables
 * que es fan; si no n'hi ha cap, al **Front** dels compartiments amb una porta (o una reixeta amb frontisses) que la fa
 * servir per a la placa de la frontissa (també les portes de tota una zona). Si el mòdul no la fa servir per a cap
 * d'aquests (`usedHardwareSlots`; el fons encastat només en llegeix els números per a un avís), enlloc.
 */
export function system32RowPlace(module: Module): System32RowPlace | undefined {
  const used = usedHardwareSlots(module).get("system32")
  if (!used) return undefined
  const m = visibleModule(module)
  const shelves = new Set<string>()
  const doors = new Set<string>()
  walkBuiltZones(m.root, (z, { covered }) => {
    if (z.shelves?.adjustable) shelves.add(z.id)
    const f = covered ? undefined : z.front
    if ((f?.kind === "door" && !f.glass) || (f?.kind === "grille" && f.mount !== "removable")) doors.add(z.id)
  })
  if (shelves.size) return { at: "shelves", zones: shelves, what: used.what }
  if (doors.size) return { at: "front", zones: doors, what: used.what }
  return undefined
}
