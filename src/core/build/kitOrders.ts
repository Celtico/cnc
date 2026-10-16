import type { KitOrder } from "./buildModule"
import { kitOptionsText, kitWoodText, type KitOrderLine, type KitWoodSize } from "./drawerKit"

/**
 * La comanda dels jocs de calaix d'un moble, agrupada per al taller (Peces › «Ferratges dels jocs» i el LLEGEIX-ME):
 * un grup per joc, NL i opcions, amb les quantitats dels calaixos iguals sumades i la fusta que demana cada calaix.
 */
export interface KitGroup {
  key: string
  /** «DTC MAGIC-PRO HT11 M · NL 450 · Tancament suau · darrere de fusta · 3 calaixos (mòdul 1)». */
  title: string
  drawers: number
  lines: KitOrderLine[]
  /** «Per calaix: Fons del calaix (A) · 681 × 421 × 16 · Darrere del calaix (B) · 660 × 63 × 16». */
  wood: string
  /** Les peces de fusta d'un calaix (les de `wood`), per pintar-les com a taula a la UI. */
  woodParts?: KitWoodSize[]
}

export function kitGroups(orders: readonly (KitOrder & { module?: number })[]): KitGroup[] {
  const groups = new Map<string, KitGroup & { modules: Set<number> }>()
  for (const o of orders) {
    const key = `${o.kit}|${o.nl}|${o.options.closing}|${o.options.back}|${o.syncRod ?? ""}`
    let g = groups.get(key)
    if (!g) {
      g = { key, title: "", drawers: 0, lines: o.lines.map((l) => ({ ...l, qty: 0 })), wood: o.wood.length ? `Per calaix: ${o.wood.map(kitWoodText).join(" · ")}` : "Sense peces de fusta.", woodParts: o.wood, modules: new Set() }
      groups.set(key, g)
    }
    g.drawers += 1
    if (o.module !== undefined) g.modules.add(o.module)
    for (const l of o.lines) {
      const hit = g.lines.find((x) => x.component === l.component)
      if (hit) hit.qty += l.qty
      else g.lines.push({ ...l })
    }
  }
  return [...groups.values()].map(({ modules, ...g }) => {
    const first = orders.find((o) => `${o.kit}|${o.nl}|${o.options.closing}|${o.options.back}|${o.syncRod ?? ""}` === g.key)!
    const mods = [...modules].sort((a, b) => a - b)
    const where = mods.length ? ` (${mods.length === 1 ? "mòdul" : "mòduls"} ${mods.join(", ")})` : ""
    return { ...g, title: `${first.kit} · NL ${first.nl} · ${kitOptionsText(first.options)} · ${g.drawers} ${g.drawers === 1 ? "calaix" : "calaixos"}${where}` }
  })
}

/** Les línies del LLEGEIX-ME del taller (text pla, ASCII no cal: el LLEGEIX-ME va amb BOM). */
export function kitReadmeLines(orders: readonly (KitOrder & { module?: number })[]): string[] {
  const out: string[] = []
  for (const g of kitGroups(orders)) {
    out.push(g.title)
    for (const l of g.lines) out.push(`  - ${l.qty} x ${l.name}${l.item ? ` · ${l.item}` : ""}${l.cutLength !== undefined ? ` · tallar a ${l.cutLength} mm` : ""}${l.note ? ` · ${l.note}` : ""}`)
    out.push(`  ${g.wood}`)
  }
  return out
}
