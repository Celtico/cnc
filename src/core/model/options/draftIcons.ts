import { OPTION_ICON_IDS, type OptionControl } from "./optionTypes"

/**
 * Les icones dels nodes del dibuix de la cascada: les de les seccions de l'inspector, les de les parts del moble
 * (interior, base, calaixos, tirador, frontissa, sòcol, potes…), les de les mides, les del control de cada fila i les genèriques
 * d'opció i de tria. La UI les tradueix a `react-icons/lu` (`features/settings/cascade/cascadeIcons.ts`).
 */
export const DRAFT_ICONS = [
  ...OPTION_ICON_IDS,
  "interior", "base", "noBase", "feet", "none", "drawers", "handle", "hinge", "light", "plinth", "back", "legs", "hanger", "flap", "grille", "edge", "drill",
  "open", "height", "width", "depth", "name",
  "fridge", "dishwasher", "oven", "cooktop", "hood", "sink",
  "list", "toggle", "number", "text", "buttons", "option", "choice",
] as const
export type DraftIcon = (typeof DRAFT_ICONS)[number]

/** La icona d'una fila segons el seu control. */
export const CONTROL_ICON: Record<OptionControl, DraftIcon> = { choice: "list", switch: "toggle", number: "number", material: "materials", hardware: "hardware", text: "text", buttons: "buttons" }

/**
 * La icona que toca pel nom (en català, sense accents ni majúscules): la primera regla que hi surt. Primer les peces
 * concretes (tirador, frontissa, guia), després les mides i després les parts grans, perquè «Opcions del tirador» sigui
 * un tirador i «Alçada dels calaixos», una alçada.
 */
const RULES: [RegExp, DraftIcon][] = [
  [/^sense base/, "noBase"],
  [/^sense\b|^(cap|res|ningu)$/, "none"],
  [/tirador|pom\b|gola/, "handle"],
  [/frontiss|bisagr|cassolet/, "hinge"],
  [/guia|ferratge|corredera/, "hardware"],
  [/alcada|\balt\b/, "height"],
  [/amplada|\bample\b/, "width"],
  [/fondaria|profunditat/, "depth"],
  [/\bmides\b|\bmida\b/, "dims"],
  [/posicio|lloc/, "position"],
  [/interior/, "interior"],
  [/calaix/, "drawers"],
  [/abatible/, "flap"],
  [/reixeta/, "grille"],
  [/porta|front/, "doors"],
  [/prestatge|accessori/, "shelves"],
  [/llum|\bled\b|il.?lumin/, "light"],
  [/socol|zocal/, "plinth"],
  [/\bfons\b|trasera/, "back"],
  [/\bterra\b/, "legs"],
  [/\bpota|\bpotes\b|\bpeus?\b|regulador/, "feet"],
  [/penja|\brail\b/, "hanger"],
  [/cantell|cantonera/, "edge"],
  [/forat|mecanitz|cnc/, "drill"],
  [/obertura|obrir/, "open"],
  [/frigor|nevera|congelador/, "fridge"],
  [/rentaplats|rentavaixella|rentadora/, "dishwasher"],
  [/forn|microones/, "oven"],
  [/placa|vitro|induccio|fogons/, "cooktop"],
  [/campana|extractor/, "hood"],
  [/aiguera|\bpica\b/, "sink"],
  [/electrodom/, "appliance"],
  [/unio|espiga|encaix|ferrament/, "joinery"],
  [/dividi|divisio/, "divide"],
  [/\bbase\b/, "base"],
  [/caixa|lateral|\btapa\b/, "carcass"],
  [/material|acabat|color|textura|xapa|lacat/, "materials"],
  [/\bmodul/, "module"],
  [/compartiment/, "zone"],
  [/\bgrup/, "group"],
  [/\bnom\b|etiqueta/, "name"],
]

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** La icona que fa pensar el nom d'un node (cap si no n'hi ha cap regla). */
export function guessIcon(label: string): DraftIcon | undefined {
  const l = fold(label)
  return RULES.find(([re]) => re.test(l))?.[1]
}
