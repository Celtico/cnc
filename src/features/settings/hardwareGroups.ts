import { itemSeries } from "../../core/import/hettich"
import { useMemo } from "react"
import { applianceSeries, applySettingsToModule, defaultModule, isPlaceable, machiningParts, type HardwareItem, type Module, type PartKind, type Settings } from "../../core/model"
import { fold } from "../projects/galleryGrid"

/**
 * Agrupació i cerca dels ferratges, la mateixa a Preferències › Ferratges (`HardwareList`) i al selector del moble
 * (`HardwareSelect`): per categoria i, dins, per sèrie. Pur (Fast Refresh: fora dels `.tsx`).
 */

/** El ferratge coincideix amb la cerca `q` (ja passada per `fold`): nom, fabricant, referència, article o sèrie. */
export function hardwareMatches(x: HardwareItem, q: string): boolean {
  return fold(`${x.name} ${x.maker ?? ""} ${x.ref ?? ""} ${x.imported?.article ?? ""} ${itemSeries(x)?.label ?? ""}`).includes(q)
}

/**
 * Els items d'una categoria per sèrie (`itemSeries`: la carpeta del fabricant, «Sensys», «Classic», «SlideLine 55»; als
 * electrodomèstics, la família, `applianceSeries`),
 * per nom de la sèrie; els que no en tenen (els de l'app, els fitxers solts) van a dalt, sense grup.
 */
export function seriesGroups(category: string, list: HardwareItem[]): { loose: HardwareItem[]; series: { key: string; label: string; items: HardwareItem[] }[] } {
  const loose: HardwareItem[] = []
  const by = new Map<string, { key: string; label: string; items: HardwareItem[] }>()
  for (const x of list) {
    // Els electrodomèstics, per família (rentaplats 60, frigorífics de columna…).
    const s = itemSeries(x) ?? applianceSeries(x)
    if (!s) {
      loose.push(x)
      continue
    }
    const key = `${category}/${s.id}`
    let g = by.get(key)
    if (!g) by.set(key, (g = { key, label: s.label, items: [] }))
    g.items.push(x)
  }
  return { loose, series: [...by.values()].sort((a, b) => a.label.localeCompare(b.label, "ca")) }
}

/**
 * Es pot col·locar a mà en alguna d'aquestes peces (`kinds`, les del mòdul o la peça lliure): té mecanitzats per a una
 * d'elles (o «sense assignar»), o és «només 3D» sense mecanitzats (només el model). A una peça lliure hi va qualsevol.
 */
export function placeableOn(item: HardwareItem, kinds: readonly PartKind[]): boolean {
  if (!isPlaceable(item)) return false
  const parts = machiningParts(item.machining ?? [])
  if (!parts.length || parts.includes("any") || kinds.includes("part")) return true
  return parts.some((p) => kinds.includes(p))
}

/**
 * El mòdul d'exemple de les miniatures dels ferratges (com un de nou: tauler, gruix, jocs i ferratges per defecte de les
 * preferències), el mateix que fa servir Preferències › Ferratges: les miniatures desades serveixen a tots dos llocs.
 */
export function useMountBase(settings: Settings | undefined): Module | undefined {
  return useMemo(() => (settings ? applySettingsToModule(settings, defaultModule("mount", "Muntatge")) : undefined), [settings])
}
