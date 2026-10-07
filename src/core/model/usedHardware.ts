import type { Module } from "./composition"
import { visibleModule, walkZones } from "./composition"
import type { HardwareSlot } from "./hardware"

/**
 * **Quins ferratges fa servir un mòdul**, segons el que té (res amagat compta: es mira el mòdul tal com es veu). És el
 * que l'inspector ensenya (Fusteria del mòdul i «Fronts i calaixos» de l'Interior): en una tauleta amb un calaix no hi
 * pinten res la frontissa, el braç d'abatible ni l'imant. Per a cada lloc, quants elements el fan servir (portes,
 * calaixos…), per dir-ho a la fila. **L'única font** (abans n'hi havia una altra que mirava les peces construïdes: amb un
 * joc de calaix que no hi cap no hi ha cap forat de guia i la fila «Guia de calaix» desapareixia justament quan cal
 * canviar el joc): declarativa, del model, no del resultat; el constructor només resol els llocs que fa servir
 * (`resolveKit` a demanda), que són aquests.
 * - frontissa i System 32: portes (no de vidre) i reixetes amb frontisses; System 32 també amb prestatges regulables;
 * - guia: compartiments de calaixos; braç: abatibles; imant: reixetes desmuntables;
 * - tirador: fronts (portes, calaixos, abatibles) si el mòdul porta tiradors;
 * - espiga: sempre (unions de la caixa); System 32 també amb el fons encastat (la fondària que cal davant del fons).
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
  // El fons encastat comprova que davant seu hi càpiguen les dues fileres System 32 (`buildInsetBack`): llegeix els números del lloc.
  if (m.carcass.back === "inset") add("system32", 1, "fons encastat")
  walkZones(m.root, (z) => {
    // «Regulables» compta també sense cap prestatge (les fileres es fan per posar-n'hi després).
    if (z.shelves?.adjustable) add("system32", 1, "prestatges regulables")
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
      // La trapa d'una reixeta va sempre amb imants.
      if (f.hatch) add("magnet", 1, "trapes")
    }
  })
  return out
}

/** Els llocs que fa servir el mòdul, com a conjunt (per filtrar els selectors de l'inspector). */
export const usedSlotSet = (module: Module): ReadonlySet<HardwareSlot> => new Set(usedHardwareSlots(module).keys())
