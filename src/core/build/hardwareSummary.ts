import type { Panel } from "../model"

/** Un tipus de ferratge que posen les regles del mòdul, amb quants n'hi ha (Editor › mòdul › «Ferratges»). */
export interface RuleHardwareCount {
  id: "hinge" | "handle" | "slide" | "flap" | "leg" | "push" | "magnet" | "dowel"
  label: string
  count: number
  /** Unitat del nombre si no és «un per ferratge» («parells», «forats»). */
  unit?: string
}

const FRONT_ROLES = new Set(["door", "drawerFront", "flap"])

/**
 * **Ferratges de les regles d'un mòdul** (els que no es col·loquen a mà: frontisses a les portes, tiradors, guies dels
 * calaixos, braços dels abatibles, potes, push, imants, espigues), comptats de les peces construïdes (`panels` del
 * mòdul) i de la base: el resum de la secció «Ferratges» de l'inspector, com la llista de ferratges d'un configurador
 * de fabricant. Només els que hi són. Pur.
 */
export function ruleHardwareCounts(panels: readonly Panel[], legs = 0): RuleHardwareCount[] {
  let hinge = 0, handle = 0, drawerSides = 0, flap = 0, push = 0, magnet = 0, dowel = 0
  // Calaixos amb joc paramètric: cap lateral de fusta; un fons de calaix sense lateral és un calaix amb joc (un parell de guies).
  const boxes = new Set<string>()
  const sided = new Set<string>()
  for (const p of panels) {
    const m = /^(.*drawer-\d+)-(bottom|side-left)$/.exec(p.id)
    if (m) (m[2] === "bottom" ? boxes : sided).add(m[1]!)
    for (const h of p.holes) {
      if (h.tag === "hinge") hinge++
      else if (h.tag === "magnet") magnet++
      else if (h.tag === "dowel") dowel++
    }
    if (FRONT_ROLES.has(p.role)) {
      if (p.push) push++
      else if ((p.cutouts ?? []).some((c) => c.tag === "handle") || (p.fittings ?? []).some((f) => f.kind === "handle")) handle++
    }
    if (p.role === "drawerSide") drawerSides++
    if (p.role === "flap") flap++
  }
  const out: RuleHardwareCount[] = [
    { id: "hinge", label: "Frontisses", count: hinge },
    { id: "handle", label: "Tiradors", count: handle },
    { id: "slide", label: "Guies de calaix", count: Math.floor(drawerSides / 2) + [...boxes].filter((k) => !sided.has(k)).length, unit: "parells" },
    { id: "flap", label: "Braços d'abatible", count: flap * 2 },
    { id: "leg", label: "Potes", count: legs },
    { id: "push", label: "Push (Tip-On)", count: push },
    { id: "magnet", label: "Imants", count: magnet },
    { id: "dowel", label: "Espigues", count: dowel, unit: "forats" },
  ]
  return out.filter((c) => c.count > 0)
}

/** Etiqueta dels forats de cada lloc de ferratge del mòdul (`HARDWARE_SLOTS`). */
const SLOT_TAGS: Record<string, string> = { hinge: "hinge", system32: "system32", dowel: "dowel", slide: "slide", flap: "flap", magnet: "magnet", handle: "handle" }

/**
 * Llocs de ferratge que el mòdul **fa servir de debò** (hi ha algun forat o tall amb la seva etiqueta a les seves peces):
 * La Fusteria del mòdul i «Fronts i calaixos» de l'Interior només ensenyen aquests, no els set. Un mòdul amb un calaix i un compartiment obert no té frontissa,
 * braç ni imant. Un calaix amb joc paramètric (prebroques `kit-*`) compta com a guia.
 */
export function usedHardwareSlots(panels: readonly Panel[]): Set<string> {
  const used = new Set<string>()
  for (const p of panels) {
    for (const h of p.holes) {
      if (!h.tag) continue
      if (h.tag.startsWith("kit-")) used.add("slide")
      for (const [slot, tag] of Object.entries(SLOT_TAGS)) if (h.tag === tag) used.add(slot)
    }
    if ((p.cutouts ?? []).some((c) => c.tag === "handle") || (p.fittings ?? []).some((f) => f.kind === "handle")) used.add("handle")
    if (p.role === "drawerSide") used.add("slide")
  }
  return used
}
