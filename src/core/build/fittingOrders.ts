import type { KitOrderLine } from "./drawerKit"
import type { KitGroup } from "./kitOrders"

/**
 * La comanda dels ferratges col·locats d'un moble (frontisses, tiradors, pistons de gas, potes; `ModuleBuild.fittingOrders`)
 * per al taller (Peces › «Ferratges» i el LLEGEIX-ME): un grup per mòdul amb els iguals sumats i el número d'article.
 * Els calaixos de doble paret i els llums tenen la seva (`kitGroups`, `lightGroups`). Pur.
 */
export function fittingGroups(orders: readonly (KitOrderLine & { module?: number })[]): KitGroup[] {
  const byModule = new Map<number, KitOrderLine[]>()
  for (const o of orders) {
    const key = o.module ?? 0
    const lines = byModule.get(key) ?? []
    const { module: _m, ...line } = o
    void _m
    const hit = lines.find((l) => l.component === line.component && l.name === line.name && l.note === line.note)
    if (hit) hit.qty += line.qty
    else lines.push({ ...line })
    byModule.set(key, lines)
  }
  return [...byModule.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([mod, lines]) => ({ key: `fit:${mod}`, title: mod > 0 ? `Mòdul ${mod}` : "Moble", drawers: 0, lines, wood: "" }))
}

/** Les línies del LLEGEIX-ME del taller (text pla). */
export function fittingReadmeLines(orders: readonly (KitOrderLine & { module?: number })[]): string[] {
  const out: string[] = []
  for (const g of fittingGroups(orders)) {
    out.push(g.title)
    for (const l of g.lines) out.push(`  - ${l.qty} x ${l.name}${l.item ? ` · ${l.item}` : ""}${l.note ? ` · ${l.note}` : ""}`)
  }
  return out
}
