import { newId, type Carcass, type Composition, type Module, type Zone } from "./composition"
import { addCorner } from "./cornerModule"
import { zoneBoundsMap } from "./zoneSupport"
import { storeBuilders } from "./storeCatalog"
import type { Template } from "./templates"
import type { ComboCategory } from "./modelCombos"

/**
 * **Formes a l'atzar** (per decisió de l'usuari, 2026-10-21: «fem un munt de variacions, després les reviso i fem la tria;
 * fes més random amb totes les opcions possibles, no pateixis pels errors»): mobles fets a l'atzar amb totes les opcions de
 * la caixa i de les zones (parets de zona, fons per zona, laterals i tapa, contingut, base, cantonada en L, diversos
 * mòduls). No es miren els avisos: són per triar idees. Sempre el mateix moble per a cada número.
 */
const { box, open, fixed, drawers, door, doors, flap, grille, v, h, onFloor, plinth, legs, hung } = storeBuilders

type Rnd = () => number
function rng(seed: number): Rnd {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(r: Rnd, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
const int = (r: Rnd, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const step = (r: Rnd, lo: number, hi: number, s: number) => lo + s * int(r, 0, Math.floor((hi - lo) / s))
const chance = (r: Rnd, p: number) => r() < p

const BACKS: Carcass["back"][] = ["groove", "screwed", "inset", "none"]
const SIDES = ["left", "right", "top", "bottom"] as const

/** El contingut d'una zona plena segons la seva mida (mm). */
function content(r: Rnd, w: number, hh: number): Zone {
  const shelves = Math.max(0, Math.min(4, Math.floor(hh / 350)))
  const k = r()
  if (k < 0.22) return open(shelves)
  if (k < 0.32) return fixed(Math.max(1, shelves))
  if (k < 0.5) return drawers(Math.max(1, Math.min(5, Math.floor(hh / 170))))
  if (k < 0.72) return w > 560 ? doors(shelves) : door(pick(r, ["left", "right"] as const), shelves)
  if (k < 0.8) return flap(pick(r, ["down", "up"] as const), 0)
  if (k < 0.86) return grille(pick(r, ["left", "right"] as const))
  if (k < 0.9) return { ...doors(shelves), front: { kind: "door", mode: "double", hinge: "left", glass: true } }
  return open(0)
}

/** Una zona buida: treu algunes de les seves parets (`noWalls`) i, a vegades, el fons. */
function hole(r: Rnd): Zone {
  const walls = SIDES.filter(() => chance(r, 0.5))
  return { id: newId(), ...(walls.length ? { noWalls: walls } : {}), ...(chance(r, 0.35) ? { back: "none" as const } : {}) }
}

/** Una zona a l'atzar: una divisió (fins a `depth` nivells), un buit o contingut. */
function zone(r: Rnd, w: number, hh: number, depth: number): Zone {
  const canSplit = depth > 0 && (w > 500 || hh > 500)
  if (canSplit && chance(r, depth > 1 ? 0.85 : 0.55)) {
    const dir = w > hh * 1.3 ? (chance(r, 0.75) ? "v" : "h") : hh > w * 1.3 ? (chance(r, 0.75) ? "h" : "v") : pick(r, ["v", "h"] as const)
    const len = dir === "v" ? w : hh
    const n = Math.max(2, Math.min(5, int(r, 2, Math.max(2, Math.floor(len / 300)))))
    const sizes = Array.from({ length: n }, (_, i) => (i === n - 1 || chance(r, 0.6) ? ("auto" as const) : step(r, 150, Math.max(150, Math.floor((len / n) * 1.4)), 10)))
    const each = len / n
    const children = sizes.map(() => (dir === "v" ? zone(r, each, hh, depth - 1) : zone(r, w, each, depth - 1)))
    const split: Zone = dir === "v" ? v(sizes, children) : h(sizes, children)
    // A vegades un front que tapa tota la divisió (regla 3).
    return chance(r, 0.08) ? { ...split, front: { kind: "door", mode: "double", hinge: "left" } } : split
  }
  return chance(r, 0.38) ? hole(r) : content(r, w, hh)
}

function randomModule(r: Rnd, name: string, o: { h?: number; base?: Carcass["base"] } = {}): Module {
  const size = pick(r, ["petit", "mitjà", "gran", "alt", "llarg"] as const)
  const [w, hh, d] =
    size === "petit" ? [step(r, 500, 900, 50), step(r, 400, 900, 50), step(r, 300, 400, 10)]
    : size === "mitjà" ? [step(r, 900, 1400, 50), step(r, 700, 1300, 50), step(r, 350, 500, 10)]
    : size === "gran" ? [step(r, 1400, 2200, 50), step(r, 1600, 2300, 50), step(r, 400, 600, 10)]
    : size === "alt" ? [step(r, 500, 900, 50), step(r, 1800, 2300, 50), step(r, 350, 600, 10)]
    : [step(r, 1600, 2600, 50), step(r, 350, 700, 50), step(r, 300, 500, 10)]
  const H = o.h ?? hh
  const base = o.base ?? (H <= 1000 && chance(r, 0.25) ? hung(step(r, 1300, 2000, 50)) : pick(r, [onFloor, onFloor, plinth(step(r, 60, 150, 10), step(r, 0, 80, 10)), legs(step(r, 100, 250, 10))]))
  const back = pick(r, BACKS)
  const top: Carcass["top"] | undefined = chance(r, 0.12) ? { kind: "none" } : undefined
  const sides = chance(r, 0.25) ? { left: chance(r, 0.5), right: chance(r, 0.5) } : undefined
  const m = box(name, {
    w, h: H, d: base.kind === "wall" ? Math.min(d, 400) : d,
    // Els materials, els de Preferències (per decisió de l'usuari, 2026-10-21: «materials a l'atzar no»): els posa la galeria.
    mat: "Melamina blanca",
    base,
    back,
    ...(top ? { top } : {}),
    ...(sides && (!sides.left || !sides.right) ? { sides } : {}),
    ...(chance(r, 0.08) ? { joint: "mitre" as const } : {}),
    ...(chance(r, 0.06) ? { hollow: 50 } : {}),
    ...(chance(r, 0.15) ? { inset: true } : {}),
    ...(chance(r, 0.15) ? { push: true } : {}),
  }, zone(r, w - 38, H - 38, int(r, 1, 3)))
  // A vegades els divisors i prestatges fixos de l'Interior, gruixuts.
  if (m.root.split && chance(r, 0.08)) return innerWallsOnly({ ...m, root: { ...m.root, split: { ...m.root.split, thickness: 50 } } })
  return innerWallsOnly(m)
}

/**
 * Els buits només treuen els divisors (`ZoneBounds.inner`), no el tram de la caixa del mòdul: les formes són les mateixes
 * que l'usuari ja ha mirat d'abans que les zones poguessin treure el seu tram de la caixa (2026-10-21).
 */
function innerWallsOnly(m: Module): Module {
  const bounds = zoneBoundsMap(m)
  const fix = (z: Zone): Zone => {
    const out: Zone = { ...z }
    const inner = z.noWalls?.filter((s) => bounds.get(z.id)?.inner?.includes(s))
    if (inner?.length) out.noWalls = inner
    else delete out.noWalls
    if (z.split) out.split = { ...z.split, children: z.split.children.map(fix) }
    return out
  }
  return { ...m, root: fix(m.root) }
}

/** Un moble a l'atzar: un mòdul, una fila de dos o tres (d'alçades diferents o un penjat a sobre) i, a vegades, una cantonada en L. */
function randomShapeComposition(seed: number): Composition {
  const r = rng(seed)
  const k = r()
  let modules: Module[]
  if (k < 0.6) modules = [randomModule(r, "Moble")]
  else if (k < 0.85) {
    const base = pick(r, [onFloor, plinth(80, 30), legs(150)])
    modules = Array.from({ length: int(r, 2, 3) }, (_, i) => randomModule(r, `Mòdul ${i + 1}`, { base, h: step(r, 500, 2200, 100) }))
  } else {
    const low = randomModule(r, "Baix", { base: pick(r, [onFloor, plinth(80, 30), legs(150)]), h: step(r, 700, 900, 10) })
    modules = [low, { ...randomModule(r, "Penjat", { base: hung(step(r, 1900, 2200, 50)), h: step(r, 350, 800, 50) }), gapBefore: 0 }]
  }
  let comp: Composition = { kind: "moble", modules, references: [] }
  if (chance(r, 0.2)) {
    const m = modules[0]!
    if (m.carcass.base.kind !== "wall") comp = addCorner(comp, m.id, pick(r, ["left", "right"] as const))?.comp ?? comp
  }
  return comp
}

export const RANDOM_SHAPES = 120

/** La categoria de les formes a l'atzar (a la secció Proves). */
export function randomShapesCategory(): ComboCategory {
  return {
    id: "random-shapes",
    name: "Formes a l'atzar",
    description: "Mobles fets a l'atzar amb totes les opcions (els materials, els de Preferències): parets i fons de zona, laterals, tapa, contingut, base, cantonada en L i diversos mòduls. Per triar idees; poden tenir avisos.",
    items: Array.from({ length: RANDOM_SHAPES }, (_, i): Template => ({
      id: `random-shape-${i + 1}`,
      kind: "moble",
      name: `Forma ${i + 1}`,
      description: `Forma a l'atzar número ${i + 1} (sempre la mateixa).`,
      make: () => randomShapeComposition(i + 1),
    })),
  }
}
