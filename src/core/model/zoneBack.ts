import type { Carcass, Module, Zone } from "./moduleSchema"

/**
 * **Fons per zona** (per decisió de l'usuari, 2026-10-21): cada zona, a qualsevol nivell (regla 1), té els mateixos 4
 * valors que el Fons del mòdul, tots sempre. Una zona sense valor propi fa el de la zona de més amunt; l'Interior, el del mòdul.
 */
export type BackKind = Carcass["back"]

/** El fons que fa una zona: el tipus i, encastat, la retirada (mm des del cantell posterior de la caixa). */
export interface ZoneBack {
  kind: BackKind
  setback: number
}

/** El fons del mòdul, com el d'una zona (el punt de partida de l'Interior). */
export function moduleBack(c: Pick<Carcass, "back" | "backInsetSetback">): ZoneBack {
  return { kind: c.back, setback: c.back === "inset" ? (c.backInsetSetback ?? 0) : 0 }
}

/**
 * El fons d'una zona a partir del de la zona de més amunt (`parent`): el propi o, sense, el que hereta. Qualsevol dels 4 a
 * qualsevol zona (per decisió de l'usuari, 2026-10-21, «com la columna»): en ranura, cargolat o encastat, la zona porta el
 * seu fons, unit a les peces que la tanquen, sigui quin sigui el del mòdul.
 */
export function childBack(parent: ZoneBack, z: Pick<Zone, "back" | "backInsetSetback">): ZoneBack {
  const kind = z.back ?? parent.kind
  if (kind !== "inset") return { kind, setback: 0 }
  return { kind, setback: z.backInsetSetback ?? (parent.kind === "inset" ? parent.setback : 0) }
}

/** El fons que fa cada zona del mòdul, per id. */
export function zoneBacks(m: Pick<Module, "carcass" | "root">): Map<string, ZoneBack> {
  const out = new Map<string, ZoneBack>()
  const walk = (z: Zone, parent: ZoneBack) => {
    const b = childBack(parent, z)
    out.set(z.id, b)
    z.split?.children.forEach((ch) => walk(ch, b))
  }
  walk(m.root, moduleBack(m.carcass))
  return out
}

const same = (a: ZoneBack, b: ZoneBack) => a.kind === b.kind && (a.kind !== "inset" || a.setback === b.setback)

/**
 * Les zones on el fons no és el del mòdul: cada una, la més gran on totes les zones de dins fan el mateix (així el
 * divisor entre dues zones sense fons no deixa una tira de fons al mig). Amb `kind` «none», el fons del mòdul s'hi
 * talla; «inset», a més, la zona porta el seu fons encastat.
 */
export function zoneBackRegions(m: Pick<Module, "carcass" | "root">): { zone: Zone; back: ZoneBack }[] {
  const backs = zoneBacks(m)
  const base = moduleBack(m.carcass)
  const out: { zone: Zone; back: ZoneBack }[] = []
  // El fons comú de totes les fulles de la zona, o null si no és el mateix a totes.
  const uniform = (z: Zone): ZoneBack | null => {
    if (!z.split) return backs.get(z.id)!
    let first: ZoneBack | null = null
    for (const ch of z.split.children) {
      const b = uniform(ch)
      if (!b || (first && !same(first, b))) return null
      first ??= b
    }
    return first
  }
  const walk = (z: Zone) => {
    const u = uniform(z)
    if (u) {
      if (!same(u, base)) out.push({ zone: z, back: u })
      return
    }
    z.split?.children.forEach(walk)
  }
  walk(m.root)
  return out
}
