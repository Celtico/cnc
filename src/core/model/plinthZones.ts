import { compositionKind, newId, type Composition, type Module, type Zone } from "./composition"

/**
 * **Sòcols fets amb zones** (per decisió de l'usuari, 2026-10-20: «0 casos especials»; «el sòcol de moble és com una
 * divisió amb la caixa sense fons, sense base, laterals i front fixe amb folgança»). No hi ha cap peça especial: el sòcol
 * de baix és la primera zona d'una divisió horitzontal de l'«Interior» d'un mòdul «Sense base», amb un front fix retirat
 * (el divisor fa de base); el de dalt, l'última zona d'un mòdul «Sense tapa», amb un front fix (el divisor fa de tapa).
 * Aquestes funcions són les dreceres: creen o treuen aquesta estructura; la construcció només hi veu zones i fronts.
 */

/** Una zona sola amb un front fix i res més (ni divisió, ni prestatges, ni accessoris, ni aparell). */
const isPanelLeaf = (z: Zone | undefined): z is Zone & { front: { kind: "panel" } } =>
  !!z && z.front?.kind === "panel" && !z.split && !z.shelves?.n && !z.rail && !z.led && !z.appliance && !z.innerDrawers

interface PlinthZone {
  zone: Zone
  /** La llum de la zona (mm): l'alçada del sòcol. */
  height: number
  /** La retirada del front fix (mm). */
  setback: number
}

/** El sòcol de baix fet amb una zona, si el mòdul en té (la UI de la Base el mostra com a «Sòcol»). */
export function bottomPlinthZone(m: Pick<Module, "carcass" | "root">): PlinthZone | undefined {
  const s = m.root.split
  if (!m.carcass.noBottom || m.carcass.base.kind !== "none" || s?.dir !== "h") return undefined
  const z = s.children[0]
  const h = s.sizes[0]
  if (!isPanelLeaf(z) || typeof h !== "number") return undefined
  return { zone: z, height: h, setback: z.front.kind === "panel" ? (z.front.setback ?? 0) : 0 }
}

/** El sòcol de dalt fet amb una zona, si el mòdul en té. */
export function topPlinthZone(m: Pick<Module, "carcass" | "root">): PlinthZone | undefined {
  const s = m.root.split
  if (m.carcass.top.kind !== "none" || s?.dir !== "h") return undefined
  const i = s.children.length - 1
  const z = s.children[i]
  const h = s.sizes[i]
  if (!isPanelLeaf(z) || typeof h !== "number") return undefined
  return { zone: z, height: h, setback: z.front.kind === "panel" ? (z.front.setback ?? 0) : 0 }
}

/** Afegeix la zona del sòcol a un extrem de l'«Interior» (l'interior d'abans passa a ser l'altra zona). */
function wrap(root: Zone, plinth: Zone, height: number, at: "bottom" | "top"): Zone {
  return at === "bottom"
    ? { id: newId(), split: { dir: "h", sizes: [height, "auto"], children: [plinth, root] } }
    : { id: newId(), split: { dir: "h", sizes: ["auto", height], children: [root, plinth] } }
}

/** Treu una zona de l'extrem de l'«Interior»: si en queda una sola, l'«Interior» torna a ser aquesta. */
function unwrap(root: Zone, at: "bottom" | "top"): Zone {
  const s = root.split!
  const i = at === "bottom" ? 0 : s.children.length - 1
  const children = s.children.filter((_, k) => k !== i)
  const sizes = s.sizes.filter((_, k) => k !== i)
  if (children.length === 1) return children[0]!
  // L'última zona d'una divisió és la que sobra.
  return { ...root, split: { ...s, children, sizes: sizes.map((x, k) => (k === sizes.length - 1 ? "auto" : x)) } }
}

/**
 * **Sòcol** (drecera de Caixa › Base, moble normal): «Sense base» i, a baix de tot, una zona de `height` mm amb un front
 * fix retirat `setback` mm. El mòdul fa la mateixa alçada (el sòcol és part de la caixa, com sempre).
 */
export function addBottomPlinth(m: Module, height = 60, setback = 30): Module {
  if (bottomPlinthZone(m)) return m
  const plinth: Zone = { id: newId(), front: { kind: "panel", setback } }
  return { ...m, carcass: { ...m.carcass, base: { kind: "none" }, noBottom: true }, root: wrap(m.root, plinth, height, "bottom") }
}

/** Treu el sòcol de baix fet amb una zona: torna la base sencera, directe a terra. */
export function removeBottomPlinth(m: Module): Module {
  if (!bottomPlinthZone(m)) return m
  const { noBottom: _n, ...carcass } = m.carcass
  return { ...m, carcass: { ...carcass, base: { kind: "none" } }, root: unwrap(m.root, "bottom") }
}

/**
 * **Sòcol de dalt** (drecera de Caixa › Tapa): el mòdul creix `height` mm, la tapa passa a ser el divisor d'una zona de
 * dalt amb un front fix (el buit fins al sostre). «Sense tapa»: la zona de dalt toca el sostre.
 */
export function addTopPlinth(m: Module, height = 60, setback = 0): Module {
  if (topPlinthZone(m) || m.carcass.top.kind === "none") return m
  const plinth: Zone = { id: newId(), front: setback ? { kind: "panel", setback } : { kind: "panel" } }
  const { topFiller: _f, tableTop: _t, ...carcass } = m.carcass
  return { ...m, carcass: { ...carcass, height: Math.min(2800, carcass.height + height), top: { kind: "none" } }, root: wrap(m.root, plinth, height, "top") }
}

/** Treu el sòcol de dalt fet amb una zona: el mòdul torna a l'alçada d'abans, amb la tapa sencera. */
export function removeTopPlinth(m: Module): Module {
  const z = topPlinthZone(m)
  if (!z) return m
  return { ...m, carcass: { ...m.carcass, height: Math.max(100, m.carcass.height - z.height), top: { kind: "full" } }, root: unwrap(m.root, "top") }
}

/** Canvia l'alçada (la llum de la zona) o la retirada d'un sòcol fet amb una zona. Al de dalt, el mòdul creix o s'encongeix amb ell. */
export function setPlinthZone(m: Module, at: "bottom" | "top", patch: { height?: number; setback?: number }): Module {
  const z = at === "bottom" ? bottomPlinthZone(m) : topPlinthZone(m)
  const s = m.root.split
  if (!z || !s) return m
  const i = at === "bottom" ? 0 : s.children.length - 1
  const height = patch.height ?? z.height
  const setback = patch.setback ?? z.setback
  const children = s.children.map((c, k) => (k === i ? { ...c, front: setback ? { kind: "panel" as const, setback } : { kind: "panel" as const } } : c))
  const sizes = s.sizes.map((x, k) => (k === i ? height : x))
  const grow = at === "top" ? height - z.height : 0
  return { ...m, carcass: { ...m.carcass, height: Math.min(2800, Math.max(100, m.carcass.height + grow)) }, root: { ...m.root, split: { ...s, children, sizes } } }
}

/**
 * Moble nou d'una plantilla (galeries, ambients, assistent): fora de la cuina, els mòduls amb el sòcol de la caixa d'abans
 * (`base: plinth`) passen al sòcol fet amb una zona (`addBottomPlinth`), el mateix que fa la drecera de Caixa › Base. La
 * cuina (sòcol de tram, amb potes) no es toca.
 */
export function withZonePlinths<T extends Pick<Composition, "modules" | "kind" | "runs" | "support">>(comp: T): T {
  if (comp.support || compositionKind(comp) === "cuina" || !comp.modules.some((m) => m.carcass.base.kind === "plinth")) return comp
  return {
    ...comp,
    modules: comp.modules.map((m) => {
      const b = m.carcass.base
      return b.kind === "plinth" ? addBottomPlinth({ ...m, carcass: { ...m.carcass, base: { kind: "none" } } }, b.height, b.setback) : m
    }),
  }
}
