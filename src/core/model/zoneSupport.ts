import type { Carcass, Front, Module, ZoneSide, Zone } from "./composition"

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
  /** A sota hi ha la base que el mòdul no té («Sense base»): per als fronts compta com a aguantat. */
  noBase: boolean
  /** A sobre hi ha la tapa que el mòdul no té («Sense tapa»): per als fronts compta com a aguantat. */
  noTop: boolean
  /**
   * A l'esquerra / a la dreta hi ha el lateral que el mòdul no té perquè hi toca un altre mòdul (`Carcass.corner`,
   * `withNeighbourSides`): el seu lateral l'aguanta i, per als fronts, compta com a aguantat (com `noBase`).
   */
  noLeft?: boolean
  noRight?: boolean
  /**
   * Els costats que són un divisor o un prestatge fix d'una divisió (no la caixa del mòdul): els que la zona pot treure
   * (`Zone.noWalls`). Sense: cap (l'Interior).
   */
  inner?: ZoneSide[]
}

/**
 * La caixa té la peça de baix (la base): no amb «Sense base» (`Carcass.noBottom`, o el `{ kind: "open" }` d'abans). Amb
 * potes, sempre: s'hi cargolen (el «Sense base» no compta, es conserva).
 */
export const hasBottom = (c: Pick<Carcass, "base" | "noBottom">): boolean => c.base.kind === "legs" || (c.base.kind !== "open" && !c.noBottom)

/** El que envolta l'«Interior» (l'arrel): la caixa del mòdul. */
export function carcassBounds(c: Pick<Carcass, "sides" | "base" | "top" | "noBottom" | "corner">): ZoneBounds {
  const noBase = !hasBottom(c)
  const noTop = c.top.kind === "none"
  const noLeft = !c.sides.left && (c.corner === "left" || c.corner === "both")
  const noRight = !c.sides.right && (c.corner === "right" || c.corner === "both")
  return { left: c.sides.left, right: c.sides.right, bottom: !noBase, top: !noTop, noBase, noTop, ...(noLeft ? { noLeft } : {}), ...(noRight ? { noRight } : {}) }
}

/**
 * Els costats de cada compartiment del mòdul, per id. En una divisió vertical (zones d'esquerra a dreta) els fills de
 * dins tenen un divisor a cada costat que no és el de fora; en una d'horitzontal (de baix a dalt), a sota i a sobre.
 */
export function zoneBoundsMap(m: Pick<Module, "carcass" | "root">): Map<string, ZoneBounds> {
  const out = new Map<string, ZoneBounds>()
  const visit = (z: Zone, given: ZoneBounds) => {
    const b = withNoWalls(given, z, z !== m.root)
    out.set(z.id, b)
    const s = z.split
    if (!s) return
    const n = s.children.length
    s.children.forEach((c, i) => {
      const first = i === 0
      const last = i === n - 1
      visit(c, childBounds(b, s.dir, first, last))
    })
  }
  visit(m.root, carcassBounds(m.carcass))
  return out
}

/**
 * Els costats d'un fill d'una divisió (`dir`: «v» d'esquerra a dreta, «h» de baix a dalt): els de dins tenen un divisor
 * al costat que no és el de fora (i llavors ja no és la base o la tapa que falta).
 */
export function childBounds(b: ZoneBounds, dir: "v" | "h", first: boolean, last: boolean): ZoneBounds {
  const inner = (sides: ZoneSide[]): Pick<ZoneBounds, "inner"> => {
    const all = [...new Set([...(b.inner ?? []), ...sides])]
    return all.length ? { inner: (["left", "right", "bottom", "top"] as const).filter((s) => all.includes(s)) } : {}
  }
  if (dir === "v") {
    const out: ZoneBounds = { ...b, left: b.left || !first, right: b.right || !last, ...inner([...(first ? [] : (["left"] as const)), ...(last ? [] : (["right"] as const))]) }
    if (!first) delete out.noLeft
    if (!last) delete out.noRight
    return out
  }
  return { ...b, bottom: b.bottom || !first, top: b.top || !last, noBase: b.noBase && first, noTop: b.noTop && last, ...inner([...(first ? [] : (["bottom"] as const)), ...(last ? [] : (["top"] as const))]) }
}

/**
 * Els costats que la zona treu (`Zone.noWalls`) ja no l'aguanten: ni a ella ni a les seves zones de dins que hi toquen (no
 * hi ha peça). Els d'una divisió (`inner`): la zona del costat la conserva, el divisor hi continua al seu tram. La tapa o
 * la base del mòdul (per decisió de l'usuari, 2026-10-21: «no pots ficar una tapa que surti de la seva divisió?»): la
 * zona en treu el seu tram (`outerSpans`) i, com un mòdul «Sense tapa» o «Sense base», per als fronts compta com a
 * aguantada; igual els laterals (com un mòdul sense aquell lateral). L'Interior no (`outer` fals): la seva tapa és la del mòdul.
 */
export function withNoWalls(b: ZoneBounds, z: Pick<Zone, "noWalls">, outer = true): ZoneBounds {
  const off = (z.noWalls ?? []).filter((s) => b.inner?.includes(s) || (outer && isOuterWall(b, s)))
  if (!off.length) return b
  const out = { ...b }
  for (const s of off) {
    out[s] = false
    if (!b.inner?.includes(s)) {
      if (s === "top") out.noTop = true
      if (s === "bottom") out.noBase = true
    }
  }
  return out
}

/** El costat és la caixa del mòdul (no un divisor) i hi és: la zona en pot treure el seu tram. */
export const isOuterWall = (b: ZoneBounds, s: ZoneSide): boolean => !b.inner?.includes(s) && b[s]

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

type FrontChoice = Front["kind"] | "none"

/**
 * Un front (porta, calaixos, abatible, reixeta o front fix) només es fa si el compartiment és **aguantat pels quatre
 * costats**: lateral o divisor a l'esquerra i a la dreta, i peça a sota i a sobre. Per decisió de l'usuari («si no té
 * tapa o no té base, es queda com està»), la tapa o la base que el mòdul no té («Sense tapa», «Sense base») compten com
 * a aguantades: els mòduls de cuina i de bany sense tapa i els cobreradiadors sense base no perden els fronts.
 */
export const frontHeld = (b: ZoneBounds): boolean => (b.left || !!b.noLeft) && (b.right || !!b.noRight) && (b.bottom || b.noBase) && (b.top || b.noTop)

/**
 * Continguts que es poden construir al compartiment: obert sempre; els fronts, només aguantats pels quatre costats
 * (`frontHeld`). A sobre, les regles de cada tipus: porta i abatible necessiten un lateral (o divisor) on van les
 * frontisses, les plaques o els braços; calaixos, els dos (una guia a cada costat); reixeta i front fix, alguna peça.
 */
export function canHoldFront(b: ZoneBounds, kind: FrontChoice): boolean {
  if (kind === "none") return true
  if (!frontHeld(b)) return false
  switch (kind) {
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

/** Els costats que falten per fer-hi un front (`frontHeld`), en català: «el lateral esquerre», «la peça de sota»… */
function missingForFront(b: ZoneBounds): string[] {
  return [
    ...(b.left ? [] : ["un lateral o un divisor a l'esquerra"]),
    ...(b.right ? [] : ["un lateral o un divisor a la dreta"]),
    ...(b.bottom || b.noBase ? [] : ["una peça a sota"]),
    ...(b.top || b.noTop ? [] : ["una peça a sobre"]),
  ]
}

/**
 * Per què no hi va un contingut (l'ajuda del «Contingut» quan se n'amaga algun): cap si tots hi poden anar. `current`: el
 * contingut triat, que surt igualment; si no s'hi pot fer, l'ajuda diu que no es construeix (es conserva).
 */
export function frontLimitsHelp(b: ZoneBounds, kinds: readonly FrontChoice[], current: FrontChoice = "none"): string | undefined {
  const fix = "Afegeix-ne a la Caixa del mòdul (laterals, base, tapa) o divideix el compartiment de més amunt."
  const fronts = kinds.filter((k) => k !== "none")
  if (!fronts.length) return undefined
  if (!frontHeld(b)) {
    const why = `els fronts només es fan amb el compartiment aguantat pels quatre costats i hi falta ${missingForFront(b).join(", ")}`
    return current !== "none" ? `El front triat no es fa (es conserva): ${why}. ${fix}` : `No hi pot anar cap front: ${why}. ${fix}`
  }
  const why: Partial<Record<FrontChoice, string>> = {
    door: "porta (les frontisses van a un lateral o a un divisor)",
    flap: "abatible (els braços van a un lateral o a un divisor)",
    drawers: "calaixos (cal un lateral o un divisor a cada costat per a les guies)",
    grille: "reixeta (no hi ha cap peça on fixar-la)",
    panel: "front fix (no hi ha cap peça on fixar-lo)",
  }
  const out = fronts.filter((k) => !canHoldFront(b, k)).map((k) => why[k]!)
  return out.length ? `No hi pot anar: ${out.join("; ")}. ${fix}` : undefined
}
