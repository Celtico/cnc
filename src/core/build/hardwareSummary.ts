import type { Panel } from "../model"
import type { KitOrder } from "./buildModule"

/** Un tipus de ferratge que posen les regles del mòdul, amb quants n'hi ha (Editor › mòdul › «Ferratges»). */
export interface RuleHardwareCount {
  id: "hinge" | "handle" | "slide" | "kit" | "flap" | "leg" | "push" | "magnet" | "dowel" | "rail" | "led" | "glassFrame"
  label: string
  count: number
  /** Unitat del nombre si no és «un per ferratge» («parells», «forats»). */
  unit?: string
  /** Detall («12,4 m de perfil»). */
  detail?: string
}

const FRONT_ROLES = new Set(["door", "drawerFront", "flap"])

/**
 * **Ferratges de les regles d'un mòdul** (els que no es col·loquen a mà: frontisses a les portes, tiradors, guies dels
 * calaixos, jocs de calaix, braços dels abatibles, potes, push, imants, espigues, barres, perfils LED, marcs de vitrina),
 * comptats **del que s'ha construït de debò** (`panels` i `extras` del mòdul, la comanda dels jocs `kits`) i de la base
 * (`legs`: les potes genèriques; una pota importada compta pels seus models a la base): el resum de la secció «Ferratges»
 * de l'inspector, com la llista de ferratges d'un configurador de fabricant. Només els que hi són. Pur.
 */
export function ruleHardwareCounts(panels: readonly Panel[], legs = 0, extras: readonly Panel[] = [], kits: readonly KitOrder[] = []): RuleHardwareCount[] {
  let hinge = 0, handle = 0, drawerSides = 0, flapArms = 0, push = 0, magnet = 0, dowel = 0, legFittings = 0
  // Accessoris (elements sense nesting): barres de penjar, perfils LED (amb el llarg) i marcs de vitrina.
  let rail = 0, led = 0, ledLen = 0, glass = 0
  for (const p of extras) {
    // Els ids d'una composició porten el mòdul al davant (`m1:rail-…`).
    const id = p.id.slice(p.id.indexOf(":") + 1)
    if (id.startsWith("rail-")) rail++
    else if (id.startsWith("led-")) {
      led++
      ledLen += p.length
    } else if (id.endsWith("-glass")) glass++
  }
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
      // Un forat per braç (dos per abatible; en un d'estret, cap).
      else if (h.tag === "flap") flapArms++
    }
    if (FRONT_ROLES.has(p.role)) {
      if (p.push) push++
      else if ((p.cutouts ?? []).some((c) => c.tag === "handle") || (p.fittings ?? []).some((f) => f.kind === "handle")) handle++
    }
    if (p.role === "drawerSide") drawerSides++
    for (const f of p.fittings ?? []) if (f.kind === "leg") legFittings++
  }
  // Calaixos amb joc: la comanda (un joc per calaix), amb el nom i la NL del primer.
  const kitDetail = kits.length ? [...new Set(kits.map((k) => `${k.kit} · NL ${k.nl}`))].join(" · ") : undefined
  const out: RuleHardwareCount[] = [
    { id: "hinge", label: "Frontisses", count: hinge },
    { id: "handle", label: "Tiradors", count: handle },
    { id: "slide", label: "Guies de calaix", count: Math.floor(drawerSides / 2), unit: "parells" },
    { id: "kit", label: "Jocs de calaix", count: kits.length || [...boxes].filter((k) => !sided.has(k)).length, ...(kitDetail ? { detail: kitDetail } : {}) },
    { id: "flap", label: "Braços d'abatible", count: flapArms },
    { id: "leg", label: "Potes", count: legFittings || legs },
    { id: "push", label: "Push (Tip-On)", count: push },
    { id: "magnet", label: "Imants", count: magnet },
    { id: "dowel", label: "Espigues", count: dowel, unit: "forats" },
    { id: "rail", label: "Barres de penjar", count: rail },
    { id: "led", label: "Perfils LED", count: led, ...(led ? { detail: `${(ledLen / 1000).toFixed(2).replace(".", ",")} m de perfil` } : {}) },
    { id: "glassFrame", label: "Marcs de vitrina", count: glass },
  ]
  return out.filter((c) => c.count > 0)
}
