/**
 * Només per als tests (propietat «res amagat compta» i proves d'or): el corpus de mobles —totes les plantilles del
 * catàleg i variacions aleatòries amb llavor— amb ids estables (les plantilles fan ids amb `Date.now()`).
 */
import {
  BUILTIN_TEMPLATES,
  COLLECTION_PIECES,
  DEFAULT_CABINET,
  DEFAULT_GRILLE,
  DEFAULT_HARDWARE_KITS,
  DEFAULT_MODULE_HARDWARE,
  STORE_TEMPLATES,
  defaultModule,
  TV_LIVING_ROOM,
  type Base,
  type Carcass,
  type Composition,
  type Front,
  type Module,
  type Top,
  type Zone,
} from "../model"
import { MAG_FURNITURE } from "../model/magFurniture"

/** Generador pseudoaleatori determinista (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rnd = () => number
export const pick = <T>(r: Rnd, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
export const int = (r: Rnd, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1))
/** Múltiple de `step` entre lo i hi. */
export const step = (r: Rnd, lo: number, hi: number, s: number): number => lo + s * int(r, 0, Math.floor((hi - lo) / s))

export const MATERIALS = ["Melamina blanca", "Melamina 19", "Roure massís / xapat", "Noguera xapada", "MDF lacat", "DM (fons)", "DM 10", "Contraxapat 4mm"] as const

function randomFront(r: Rnd): Front | undefined {
  const k = pick(r, ["none", "none", "door", "drawers", "drawers", "flap", "grille", "panel"] as const)
  switch (k) {
    case "none":
      return undefined
    case "door":
      return { kind: "door", mode: pick(r, ["single", "double"] as const), hinge: pick(r, ["left", "right"] as const) }
    case "drawers": {
      const n = int(r, 1, 5)
      return { kind: "drawers", n, heights: Array.from({ length: n }, () => (r() < 0.8 ? "auto" : step(r, 80, 300, 10))) }
    }
    case "flap":
      return { kind: "flap", dir: pick(r, ["down", "up"] as const) }
    case "grille":
      return {
        kind: "grille",
        pattern: { ...DEFAULT_GRILLE, kind: pick(r, ["slotsV", "slotsH", "holes"] as const), slotWidth: pick(r, [6, 8, 10]), slotGap: pick(r, [6, 8, 12]), holeDiameter: pick(r, [8, 10]), holePitch: pick(r, [14, 16, 20]), margin: pick(r, [40, 60]) },
        mount: pick(r, ["removable", "hinged"] as const),
        hinge: pick(r, ["left", "right"] as const),
        ...(r() < 0.2 ? { hatch: { x: 80, y: 80, w: 150, h: 150 } } : {}),
      }
    case "panel":
      return { kind: "panel" }
  }
}

function randomLeaf(r: Rnd, id: string): Zone {
  const front = randomFront(r)
  const z: Zone = { id, ...(front ? { front } : {}) }
  if (front?.kind !== "drawers" && r() < 0.6) {
    const n = int(r, 0, 4)
    z.shelves = { n, adjustable: r() < 0.6, ...(r() < 0.15 ? { thickness: pick(r, [40, 50, 60]) } : {}), ...(r() < 0.15 ? { flush: true } : {}) }
  }
  if (front?.kind !== "drawers" && r() < 0.1) z.rail = {}
  return z
}

function randomZone(r: Rnd, id: string, depth: number): Zone {
  if (depth < 2 && r() < 0.4) {
    const n = int(r, 2, 3)
    const children = Array.from({ length: n }, (_, i) => randomZone(r, `${id}.${i}`, depth + 1))
    const z: Zone = { id, split: { dir: pick(r, ["v", "h"] as const), sizes: children.map(() => "auto" as const), children } }
    if (r() < 0.15) z.front = { kind: "door", mode: pick(r, ["single", "double"] as const), hinge: "left" }
    return z
  }
  return randomLeaf(r, id)
}

/** Un mòdul aleatori (mides i opcions raonables: el que es pot fer des de la UI). */
export function randomModule(r: Rnd, id: string): Module {
  const thickness = pick(r, [16, 19, 19, 19, 30])
  const material = pick(r, MATERIALS.slice(0, 5))
  const base: Base = pick(r, [{ kind: "none" }, { kind: "plinth", height: 80, setback: 30 }, { kind: "legs", height: 100 }, { kind: "open" }, { kind: "wall", height: 1450 }] as Base[])
  const top: Top = pick(r, [{ kind: "full" }, { kind: "full" }, { kind: "ventSlot", gap: 60 }, { kind: "grille", pattern: DEFAULT_GRILLE }, { kind: "none" }] as Top[])
  const back = pick(r, ["groove", "screwed", "inset", "none"] as const)
  const backThickness = pick(r, [3, 8, 10, 16, 19])
  const carcass: Carcass = {
    width: step(r, 300, 1200, 10),
    height: step(r, 300, 2200, 10),
    depth: step(r, 250, 650, 10),
    material,
    thickness,
    backMaterial: backThickness === thickness && r() < 0.5 ? material : pick(r, MATERIALS),
    backThickness,
    base,
    back,
    top,
    sides: r() < 0.85 ? { left: true, right: true } : { left: r() < 0.5, right: r() < 0.5 },
    backSetback: DEFAULT_CABINET.backSetback,
    grooveDepth: DEFAULT_CABINET.grooveDepth,
    backClearance: DEFAULT_CABINET.backClearance,
    shelfSetback: pick(r, [0, 20, 20, 30]),
    shelfClearance: DEFAULT_CABINET.shelfClearance,
    ...(back === "inset" && r() < 0.5 ? { backInsetSetback: pick(r, [0, 10, 20]) } : {}),
    ...(r() < 0.3 ? { joint: "mitre" as const } : {}),
    ...(r() < 0.1 ? { hollow: { thickness: pick(r, [50, 60, 80]) } } : {}),
    ...(top.kind === "full" && r() < 0.15 ? { tableTop: { overhang: pick(r, [0, 20, 30, 100]) } } : {}),
    ...(r() < 0.3 ? { frontMaterial: pick(r, MATERIALS.slice(0, 5)) } : {}),
  }
  return {
    id,
    name: `Mòdul ${id}`,
    gapBefore: 0,
    carcass,
    root: randomZone(r, `${id}.r`, 0),
    fronts: { outerGap: 2, betweenGap: 3, ...(r() < 0.25 ? { style: "inset" as const } : {}), ...(r() < 0.2 ? { handles: "none" as const } : {}) },
    hardware: structuredClone(DEFAULT_MODULE_HARDWARE),
    extras: { cableHoles: [] },
  }
}

/** Composició aleatòria d'un a tres mòduls. */
export function randomComposition(seed: number): Composition {
  const r = rng(seed)
  const n = r() < 0.7 ? 1 : int(r, 2, 3)
  return { kind: "moble", modules: Array.from({ length: n }, (_, i) => randomModule(r, `m${i + 1}`)), references: [] }
}

/**
 * Ids estables: mòduls `M1…`, compartiments `M1/0`, `M1/0.1`… (per posició a l'arbre), objectes `R1…`, peces `P1…`,
 * models `G1…`, peces corregudes `U1…` i forats del taulell `C1…`, amb totes les referències entre ells.
 */
export function stableIds(comp: Composition): Composition {
  const mods = new Map(comp.modules.map((m, i) => [m.id, `M${i + 1}`]))
  const refs = new Map(comp.references.map((x, i) => [x.id, `R${i + 1}`]))
  const parts = new Map((comp.parts ?? []).map((x, i) => [x.id, `P${i + 1}`]))
  const mod = (id: string) => mods.get(id) ?? id
  const zone = (z: Zone, id: string): Zone => ({ ...z, id, ...(z.split ? { split: { ...z.split, children: z.split.children.map((c, i) => zone(c, `${id}.${i}`)) } } : {}) })
  let cut = 0
  return {
    ...comp,
    modules: comp.modules.map((m) => ({
      ...m,
      id: mod(m.id),
      root: zone(m.root, `${mod(m.id)}/0`),
      extras: { ...m.extras, cableHoles: m.extras.cableHoles.map((h) => (h.ref ? { ...h, ref: refs.get(h.ref) ?? h.ref } : h)) },
      ...(m.anchor ? { anchor: { ...m.anchor, module: mod(m.anchor.module) } } : {}),
    })),
    references: comp.references.map((x) => ({ ...x, id: refs.get(x.id)! })),
    ...(comp.parts ? { parts: comp.parts.map((p) => ({ ...p, id: parts.get(p.id)!, ...(p.module ? { module: mod(p.module) } : {}) })) } : {}),
    ...(comp.models ? { models: comp.models.map((g, i) => ({ ...g, id: `G${i + 1}` })) } : {}),
    ...(comp.runs
      ? {
          runs: comp.runs.map((u, i) =>
            u.kind === "worktop"
              ? { ...u, id: `U${i + 1}`, from: mod(u.from), to: mod(u.to), cutouts: u.cutouts.map((c) => ({ ...c, id: `C${++cut}`, module: mod(c.module) })) }
              : { ...u, id: `U${i + 1}`, from: mod(u.from), to: mod(u.to) },
          ),
        }
      : {}),
  }
}

export interface CorpusItem {
  id: string
  make: () => Composition
}

/**
 * Calaixos amb joc paramètric de doble paret (DTC MAGIC-PRO HT11 M): un mòdul de 732 × 720 × 500 amb tauler de 16 (LW
 * 700 → NL 450, fons 681 × 421, darrere 660 × 63) amb tres calaixos de tancament suau i darrere de fusta, i un altre de
 * 600 × 500 × 450 amb dos de push-open i darrere metàl·lic (barra de sincronització). Fix al corpus: cap plantilla fa
 * servir jocs.
 */
export function kitDrawerComposition(): Composition {
  const ht11 = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-ht11")!
  const a = defaultModule("kit-a", "Calaixos DTC", { width: 732, height: 720, depth: 500, thickness: 16 })
  const b = defaultModule("kit-b", "Calaixos push", { width: 600, height: 500, depth: 450, thickness: 16 })
  const drawers = (n: number, kit?: { closing: "soft" | "push" | "pushSoft"; back: "wood" | "metal" }): Zone => ({ id: "root", front: { kind: "drawers", n, heights: Array.from({ length: n }, () => "auto"), hardware: structuredClone(ht11), ...(kit ? { kit } : {}) } })
  return {
    kind: "moble",
    modules: [
      { ...a, root: drawers(3) },
      { ...b, gapBefore: 20, root: drawers(2, { closing: "push", back: "metal" }) },
    ],
    references: [],
  }
}

/**
 * Folgança de les peces de dins (`Carcass.innerClearance`): un moble de dues columnes amb divisors i prestatges fixos a
 * la primera divisió (sencers) i a la segona i la tercera (1 mm menys, centrats), prestatges fixos i regulables, una porta
 * i calaixos; i un d'encastat amb les portes de tota la zona i 2 mm. Fix al corpus: cap plantilla porta el camp.
 */
export function innerClearanceComposition(): Composition {
  const a = defaultModule("in-a", "Dues columnes", { width: 900, height: 1800, depth: 560, innerClearance: 1 })
  const b = defaultModule("in-b", "Encastat", { width: 800, height: 1200, depth: 500, innerClearance: 2 })
  const two = (id: string, dir: "v" | "h", x: Zone, y: Zone): Zone => ({ id, split: { dir, sizes: ["auto", "auto"], children: [x, y] } })
  return {
    kind: "moble",
    modules: [
      {
        ...a,
        root: two("root", "v",
          two("a", "h", { id: "a1", front: { kind: "door", mode: "single", hinge: "left" } }, { id: "a2", shelves: { n: 2, adjustable: false } }),
          two("b", "h", { id: "b1", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } }, two("b2", "v", { id: "b21", shelves: { n: 3, adjustable: true } }, { id: "b22", shelves: { n: 1, adjustable: false, thickness: 50 } }))),
      },
      {
        ...b,
        gapBefore: 20,
        fronts: { ...b.fronts, style: "inset" },
        root: { ...two("root", "h", { id: "c1", shelves: { n: 1, adjustable: false } }, two("c2", "v", { id: "c21" }, two("c22", "h", { id: "c221" }, { id: "c222" }))), front: { kind: "door", mode: "double", hinge: "left" } },
      },
    ],
    references: [],
  }
}

/** Totes les plantilles del catàleg: les de l'app, les de botiga, les col·leccions i els mobles de revista, i els mobles fixos dels jocs de calaix i de la folgança de les peces de dins. */
export function catalogCorpus(): CorpusItem[] {
  const all = [...BUILTIN_TEMPLATES, TV_LIVING_ROOM, ...STORE_TEMPLATES, ...COLLECTION_PIECES.map((p) => ({ ...p, id: `col:${p.id}` })), ...MAG_FURNITURE.map((t) => ({ ...t, id: `mag:${t.id}` })), { id: "kit-dtc-ht11", make: kitDrawerComposition }, { id: "inner-clearance", make: innerClearanceComposition }]
  return all.map((t) => ({ id: t.id, make: () => stableIds(t.make()) }))
}
