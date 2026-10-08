import type { Carcass, Front, Module, Zone } from "./composition"

/**
 * Què aguanta un compartiment pels quatre costats (opcions en cascada, per decisió de l'usuari: «no són possibles les
 * opcions de prestatges ni accessoris ni Dividir» en un mòdul sense caixa). La mateixa geometria que fa servir la
 * construcció (`buildModule`: `derive().interior`, `layoutZones`, `findLeft/Right/Below/Above`): a cada costat del
 * compartiment hi ha una peça si és la caixa (lateral, base o tapa) o un divisor d'una divisió de més amunt.
 */
export interface ZoneBounds {
  /** Lateral esquerre o divisor a l'esquerra. */
  left: boolean
  /** Lateral dret o divisor a la dreta. */
  right: boolean
  /** Base (qualsevol menys «Sense base») o divisor (travesser) a sota. */
  bottom: boolean
  /** Tapa (qualsevol menys «Sense tapa») o divisor (travesser) a sobre. */
  top: boolean
}

/** El que envolta l'«Interior» (l'arrel): la caixa del mòdul. */
export function carcassBounds(c: Pick<Carcass, "sides" | "base" | "top">): ZoneBounds {
  return { left: c.sides.left, right: c.sides.right, bottom: c.base.kind !== "open", top: c.top.kind !== "none" }
}

/**
 * Els costats de cada compartiment del mòdul, per id. En una divisió vertical (zones d'esquerra a dreta) els fills de
 * dins tenen un divisor a cada costat que no és el de fora; en una d'horitzontal (de baix a dalt), a sota i a sobre.
 */
export function zoneBoundsMap(m: Pick<Module, "carcass" | "root">): Map<string, ZoneBounds> {
  const out = new Map<string, ZoneBounds>()
  const visit = (z: Zone, b: ZoneBounds) => {
    out.set(z.id, b)
    const s = z.split
    if (!s) return
    const n = s.children.length
    s.children.forEach((c, i) => {
      const first = i === 0
      const last = i === n - 1
      visit(c, s.dir === "v" ? { ...b, left: b.left || !first, right: b.right || !last } : { ...b, bottom: b.bottom || !first, top: b.top || !last })
    })
  }
  visit(m.root, carcassBounds(m.carcass))
  return out
}

/** Els costats d'un compartiment (cap si no és del mòdul). */
export function zoneBounds(m: Pick<Module, "carcass" | "root">, zoneId: string): ZoneBounds | undefined {
  return zoneBoundsMap(m).get(zoneId)
}

/** Prestatges (també les fileres System 32 dels regulables): van d'un costat a l'altre, cal una peça a cada costat. */
export const canHoldShelves = (b: ZoneBounds): boolean => b.left && b.right

/** Accessoris (barra de penjar, tira LED): de costat a costat, com els prestatges. */
export const canHoldAccessories = (b: ZoneBounds): boolean => b.left && b.right

/**
 * Direccions en què es pot dividir: un divisor vertical s'uneix a sota i a sobre (base, tapa o travessers); un travesser
 * (divisió horitzontal), a l'esquerra i a la dreta (com un prestatge fix).
 */
export function splitDirsFor(b: ZoneBounds): ("v" | "h")[] {
  return [...(b.bottom && b.top ? (["v"] as const) : []), ...(b.left && b.right ? (["h"] as const) : [])]
}

export type FrontChoice = Front["kind"] | "none"

/**
 * Continguts que es poden construir al compartiment: obert sempre; porta i abatible necessiten un lateral (o divisor) on
 * van les frontisses, les plaques o els braços; calaixos, els dos (una guia a cada costat); reixeta i front fix, alguna
 * peça on fixar-los.
 */
export function canHoldFront(b: ZoneBounds, kind: FrontChoice): boolean {
  switch (kind) {
    case "none":
      return true
    case "door":
    case "flap":
      return b.left || b.right
    case "drawers":
      return b.left && b.right
    case "grille":
    case "panel":
      return b.left || b.right || b.bottom || b.top
  }
}

/**
 * Per què no hi va un contingut (l'ajuda del «Contingut» quan se n'amaga algun): cap si tots hi poden anar.
 */
export function frontLimitsHelp(b: ZoneBounds, kinds: readonly FrontChoice[]): string | undefined {
  const why: Partial<Record<FrontChoice, string>> = {
    door: "porta (les frontisses van a un lateral o a un divisor)",
    flap: "abatible (els braços van a un lateral o a un divisor)",
    drawers: "calaixos (cal un lateral o un divisor a cada costat per a les guies)",
    grille: "reixeta (no hi ha cap peça on fixar-la)",
    panel: "front fix (no hi ha cap peça on fixar-lo)",
  }
  const out = kinds.filter((k) => !canHoldFront(b, k)).map((k) => why[k]!)
  return out.length ? `No hi pot anar: ${out.join("; ")}. Afegeix-ne a la Caixa del mòdul (laterals, base, tapa) o divideix el compartiment de més amunt.` : undefined
}
