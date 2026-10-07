import type { Module } from "./composition"
import { visibleModule, walkZones } from "./composition"
import type { HardwareSlot } from "./hardware"

/**
 * **Quins ferratges fa servir un mòdul**, segons el que té (res amagat compta: es mira el mòdul tal com es veu). És el
 * que l'inspector ensenya a «Fusteria (avançat)»: en una tauleta amb un calaix no hi pinten res la frontissa, el braç
 * d'abatible ni l'imant. Per a cada lloc, quants elements el fan servir (portes, calaixos…), per dir-ho a la fila.
 * - frontissa i System 32: portes (no de vidre) i reixetes amb frontisses; System 32 també amb prestatges regulables;
 * - guia: compartiments de calaixos; braç: abatibles; imant: reixetes desmuntables;
 * - tirador: fronts (portes, calaixos, abatibles) si el mòdul porta tiradors;
 * - espiga: sempre (unions de la caixa).
 */
export function usedHardwareSlots(module: Module): Map<HardwareSlot, { count: number; what: string }> {
  const m = visibleModule(module)
  const out = new Map<HardwareSlot, { count: number; what: string }>()
  const add = (slot: HardwareSlot, n: number, what: string) => {
    if (n <= 0) return
    const cur = out.get(slot)
    out.set(slot, { count: (cur?.count ?? 0) + n, what: cur && cur.what !== what ? `${cur.what}, ${what}` : what })
  }
  add("dowel", 1, "caixa")
  walkZones(m.root, (z) => {
    if (z.shelves?.adjustable && z.shelves.n > 0) add("system32", 1, "prestatges regulables")
    const f = z.front
    if (!f) return
    if (f.kind === "door" && !f.glass) {
      const doors = f.mode === "double" ? 2 : 1
      add("hinge", doors, "portes")
      add("system32", doors, "portes")
      if (m.fronts.handles !== "none") add("handle", doors, "portes")
    } else if (f.kind === "drawers") {
      add("slide", f.n, "calaixos")
      if (m.fronts.handles !== "none") add("handle", f.n, "calaixos")
    } else if (f.kind === "flap") {
      add("flap", 1, "abatibles")
      if (m.fronts.handles !== "none") add("handle", 1, "abatibles")
    } else if (f.kind === "grille") {
      if (f.mount === "removable") add("magnet", 1, "reixetes")
      else {
        add("hinge", 1, "reixetes")
        add("system32", 1, "reixetes")
      }
    }
  })
  return out
}
