import { lightSystemOf, type LightSystem } from "../model"
import type { KitOrderLine } from "./drawerKit"
import type { KitGroup } from "./kitOrders"

/** Un compartiment amb un joc de llum: què s'hi posa i què demana (la comanda la fa `lightGroups`, per mòdul). */
export interface LightOrder {
  zoneId: string
  /** Nom de l'item de la biblioteca i del joc («Häfele Loox LED 3038»). */
  item: string
  kit: string
  maker: string
  lamps: number
  /** Potència de les làmpades del compartiment i el pic en encendre (el que compta per a l'alimentador). */
  watts: number
  peakWatts: number
  /** L'interruptor del mòdul: sensor de porta (forat al lateral), de proximitat (per cargolar) o cap (sense sistema). */
  switch: "door" | "touch" | "none"
  lines: KitOrderLine[]
}

const r1 = (v: number) => Math.round(v * 10) / 10
const fmt = (v: number) => String(r1(v)).replace(".", ",")

/**
 * El sistema elèctric d'un mòdul: l'alimentador més petit que arriba a la potència de totes les làmpades (amb el pic en
 * encendre), més d'un si cap no hi arriba; un distribuïdor per cada 5 làmpades de més de les 6 ranures; l'interruptor
 * amb el seu cable; i la nota dels cables d'extensió. Pur.
 */
export function electricalLines(sys: LightSystem, lamps: number, peakWatts: number, sw: LightOrder["switch"]): KitOrderLine[] {
  const out: KitOrderLine[] = []
  if (lamps <= 0) return out
  const drivers = sys.drivers.slice().sort((a, b) => a.watts - b.watts)
  const cap = (d: LightSystem["drivers"][number]) => d.perSlot ?? d.watts
  const one = drivers.find((d) => cap(d) >= peakWatts)
  const biggest = drivers[drivers.length - 1]!
  const n = one ? 1 : Math.max(1, Math.ceil(peakWatts / cap(biggest)))
  const driver = one ?? biggest
  const perDriver = Math.ceil(lamps / n)
  const ext = sys.extensions.map((e) => `${e.article} (${fmt(e.length / 1000)} m)`).join(" · ")
  out.push({ component: `driver:${driver.article}`, name: driver.name, qty: n, item: driver.article, note: `${fmt(peakWatts)} W de làmpades${n > 1 ? `, ${perDriver} per alimentador` : ""} · ${driver.size} mm · si és lluny, cables d'extensió ${ext}; màx. ${fmt(sys.maxCable / 1000)} m fins a la làmpada` })
  const extra = perDriver - driver.slots
  const dist = extra > 0 ? Math.ceil(extra / (sys.distributor.ways - 1)) : 0
  if (dist > 0) out.push({ component: `distributor:${sys.distributor.article}`, name: sys.distributor.name, qty: dist * n, item: sys.distributor.article, note: `${perDriver} làmpades i ${driver.slots} ranures per alimentador` })
  // El cable de dins del moble (de les làmpades i de l'interruptor a l'alimentador), amagat: la tapa del catàleg, tallada a mida.
  if (sys.cableCover) out.push({ component: `cable-cover:${sys.cableCover.article}`, name: sys.cableCover.name, qty: n, item: sys.cableCover.article, note: "per amagar els cables dins del moble (s'encaixa, es talla a mida); el catàleg no dona cap forat al fons: el cable de xarxa de l'alimentador surt per darrere fins a l'endoll" })
  if (sw === "door") {
    out.push({ component: `switch:${sys.doorSwitch.article}`, name: sys.doorSwitch.name, qty: n, item: sys.doorSwitch.article, note: `forat Ø${fmt(sys.doorSwitch.bore)} × ${fmt(sys.doorSwitch.depth)} al cantell de davant del lateral; porta oberta = llum encesa` })
    out.push({ component: `switch-cable:${sys.switchCable.article}`, name: sys.switchCable.name, qty: n, item: sys.switchCable.article })
  } else if (sw === "touch") {
    out.push({ component: `switch:${sys.touchSwitch.article}`, name: sys.touchSwitch.name, qty: n, item: sys.touchSwitch.article, note: "per cargolar on es vulgui (sense mecanitzat)" })
    out.push({ component: `switch-cable:${sys.switchCable.article}`, name: sys.switchCable.name, qty: n, item: sys.switchCable.article })
  }
  return out
}

function mergeLines(into: KitOrderLine[], lines: readonly KitOrderLine[]): void {
  for (const l of lines) {
    const hit = into.find((x) => x.component === l.component && x.cutLength === l.cutLength && x.note === l.note)
    if (hit) hit.qty += l.qty
    else into.push({ ...l })
  }
}

/**
 * La comanda dels llums d'un moble, **un grup per mòdul** (cada mòdul té el seu alimentador i el seu interruptor): les
 * làmpades de tots els compartiments (iguals sumades; les barres amb la llargada de tall) i el sistema elèctric.
 */
export function lightGroups(orders: readonly (LightOrder & { module?: number })[]): KitGroup[] {
  const byModule = new Map<number, (LightOrder & { module?: number })[]>()
  for (const o of orders) {
    const key = o.module ?? 0
    byModule.set(key, [...(byModule.get(key) ?? []), o])
  }
  const out: KitGroup[] = []
  for (const [mod, list] of [...byModule.entries()].sort((a, b) => a[0] - b[0])) {
    const lines: KitOrderLine[] = []
    for (const o of list) mergeLines(lines, o.lines)
    const lamps = list.reduce((a, o) => a + o.lamps, 0)
    const watts = r1(list.reduce((a, o) => a + o.watts, 0))
    const peak = r1(list.reduce((a, o) => a + o.peakWatts, 0))
    const makers = [...new Set(list.map((o) => o.maker))]
    const sys = makers.length === 1 ? lightSystemOf(makers[0]!) : undefined
    const sw = list.find((o) => o.switch !== "none")?.switch ?? "none"
    if (sys) mergeLines(lines, electricalLines(sys, lamps, peak, sw))
    const where = mod > 0 ? ` (mòdul ${mod})` : ""
    const title = `${sys ? sys.name : [...new Set(list.map((o) => o.kit))].join(", ")} · ${lamps} ${lamps === 1 ? "làmpada" : "làmpades"} · ${fmt(watts)} W${peak > watts ? ` (${fmt(peak)} W en encendre)` : ""}${where}`
    const notes = sys ? sys.notes.join(" ") : ""
    out.push({ key: `light:${mod}`, title, drawers: 0, lines, wood: notes })
  }
  return out
}

/** Les línies del LLEGEIX-ME del taller (text pla). */
export function lightReadmeLines(orders: readonly (LightOrder & { module?: number })[]): string[] {
  const out: string[] = []
  for (const g of lightGroups(orders)) {
    out.push(g.title)
    for (const l of g.lines) out.push(`  - ${l.qty} x ${l.name}${l.item ? ` · ${l.item}` : ""}${l.cutLength !== undefined ? ` · tallar a ${l.cutLength} mm` : ""}${l.note ? ` · ${l.note}` : ""}`)
    if (g.wood) out.push(`  ${g.wood}`)
  }
  return out
}
