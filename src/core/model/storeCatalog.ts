import { DEFAULT_JOINERY, type FreePart } from "./freePart"
import type { PNode } from "./polygon"
import { defaultModule, modulePlacements, DEFAULT_GRILLE, newId, partsOnlyKind, tableModule, type Carcass, type Composition, type CompositionKind, type Module, type RefObject, type Zone } from "./composition"
import type { Template } from "./templates"

/**
 * Plantilles per a botigues de mobles (catàleg de `cad-mobles-cataleg.md`, més la categoria Cuina): per a cada tipus de
 * moble que l'app sap fer (mobles de cos, taules, llits de tauler…), tres dissenys diferents en
 * forma, materials i funció, amb nom comercial, estil, materials, colors, públic i preu orientatiu.
 * No hi ha sofàs, butaques, cadires ni miralls: no són mobles de tauler.
 */

export interface StoreType {
  name: string
  items: Template[]
}
export interface StoreCategory {
  id: string
  name: string
  types: StoreType[]
}

// --- Materials i colors -------------------------------------------------------------------------

const WHITE = "Melamina blanca"
const GREY = "Melamina gris"
const BLACK = "Melamina negra"
const OAKM = "Melamina roure"
const LAC = "MDF lacat"
const ANTH = "MDF lacat antracita"
const OLIVE = "MDF lacat verd oliva"
const TERRA = "MDF lacat terracota"
const NAVY = "MDF lacat blau fosc"
const GREIGE = "MDF lacat greige"
const OAK = "Roure massís / xapat"
const WAL = "Noguera xapada"
const ASH = "Freixe xapat"
const IRON = "Ferro negre"
const INOX = "Acer inox"
const STONE = "Pedra"
const GLASS = "Vidre"

// --- Zones -----------------------------------------------------------------------------------

const id = () => newId()
const open = (n = 0, adjustable = true): Zone => ({ id: id(), shelves: { n, adjustable } })
const fixed = (n: number, extra: { thickness?: number; flush?: boolean } = {}): Zone => ({ id: id(), shelves: { n, adjustable: false, ...extra } })
const drawers = (n: number): Zone => ({ id: id(), front: { kind: "drawers", n, heights: Array.from({ length: n }, () => "auto" as const) } })
const door = (hinge: "left" | "right" = "left", shelves = 1): Zone => ({ id: id(), shelves: { n: shelves, adjustable: true }, front: { kind: "door", mode: "single", hinge } })
const doors = (shelves = 1): Zone => ({ id: id(), shelves: { n: shelves, adjustable: true }, front: { kind: "door", mode: "double", hinge: "left" } })
const flap = (dir: "down" | "up" = "down", shelves = 0): Zone => ({ id: id(), shelves: { n: shelves, adjustable: true }, front: { kind: "flap", dir } })
const panel = (): Zone => ({ id: id(), front: { kind: "panel" } })
const grille = (hinge: "left" | "right" = "left"): Zone => ({ id: id(), shelves: { n: 1, adjustable: true }, front: { kind: "grille", pattern: { ...DEFAULT_GRILLE, margin: 40, slotWidth: 10, slotGap: 8 }, mount: "hinged", hinge } })
const rail = (): Zone => ({ id: id(), rail: {} })
const v = (sizes: (number | "auto")[], children: Zone[]): Zone => ({ id: id(), split: { dir: "v", sizes, children } })
/** Divisió horitzontal: els fills van de baix a dalt. */
const h = (sizes: (number | "auto")[], children: Zone[]): Zone => ({ id: id(), split: { dir: "h", sizes, children } })
const auto = (n: number) => Array.from({ length: n }, () => "auto" as const)

// --- Bases ---------------------------------------------------------------------------------

const onFloor = { kind: "none" as const }
const plinth = (height = 80, setback = 30) => ({ kind: "plinth" as const, height, setback })
const legs = (height = 120) => ({ kind: "legs" as const, height })
const hung = (height: number) => ({ kind: "wall" as const, height })

interface BoxOpts {
  w: number
  h: number
  d: number
  mat: string
  front?: string
  base?: Carcass["base"]
  joint?: "mitre"
  inset?: boolean
  /** Fronts sense tirador (obertura per pressió). */
  push?: boolean
  hollow?: number
  top?: Carcass["top"]
  back?: Carcass["back"]
  sides?: Carcass["sides"]
  gapBefore?: number
}

/** Mòdul de cos: fons cargolat de DM (o del mateix material si és un moble que es veu per darrere). */
function box(name: string, o: BoxOpts, root: Zone): Module {
  const m = defaultModule(newId("m"), name, {
    width: o.w,
    height: o.h,
    depth: o.d,
    material: o.mat,
    thickness: 19,
    ...(o.front ? { frontMaterial: o.front } : {}),
    back: o.back ?? "screwed",
    backMaterial: "DM (fons)",
    backThickness: 10,
    base: o.base ?? onFloor,
    ...(o.joint ? { joint: o.joint } : {}),
    ...(o.hollow ? { hollow: { thickness: o.hollow } } : {}),
    ...(o.top ? { top: o.top } : {}),
    ...(o.sides ? { sides: o.sides } : {}),
  })
  const withRoot = { ...m, root, gapBefore: o.gapBefore ?? 0 }
  if (!o.inset && !o.push) return withRoot
  return { ...withRoot, fronts: { ...withRoot.fronts, ...(o.inset ? { style: "inset" as const } : {}), ...(o.push ? { handles: "none" as const } : {}) } }
}

const part = (p: Omit<FreePart, "id">): FreePart => ({ id: newId("p"), ...p })
const metal = (p: Omit<FreePart, "id" | "nest">): FreePart => part({ nest: false, ...p })

/** El·lipse de w × h (seccions rodones i taulers ovals). */
function oval(w: number, hh: number): PNode[] {
  const K = 0.5522847498
  const a = w / 2, b = hh / 2
  return [
    { x: w, y: b, in: [0, -K * b], out: [0, K * b], t: "smooth" },
    { x: a, y: hh, in: [K * a, 0], out: [-K * a, 0], t: "smooth" },
    { x: 0, y: b, in: [0, K * b], out: [0, -K * b], t: "smooth" },
    { x: a, y: 0, in: [-K * a, 0], out: [K * a, 0], t: "smooth" },
  ]
}

/** Rectangle amb les cantonades arrodonides (radi r): dos nodes per cantonada amb manegadors d'arc. */
function rounded(w: number, hh: number, r: number): PNode[] {
  const K = 0.5522847498 * r
  return [
    { x: r, y: 0, in: [-K, 0], t: "corner" },
    { x: w - r, y: 0, out: [K, 0], t: "corner" },
    { x: w, y: r, in: [0, -K], t: "corner" },
    { x: w, y: hh - r, out: [0, K], t: "corner" },
    { x: w - r, y: hh, in: [K, 0], t: "corner" },
    { x: r, y: hh, out: [-K, 0], t: "corner" },
    { x: 0, y: hh - r, in: [0, K], t: "corner" },
    { x: 0, y: r, out: [0, -K], t: "corner" },
  ]
}

/** Moble només de peces lliures (llits, capçals, taules de pedra): tipus Flat-pack. */
const loose = (parts: FreePart[], references: RefObject[] = []): Composition => ({
  kind: "lliure",
  modules: [defaultModule(newId("m"), "Mòdul 1")],
  references,
  parts,
  joinery: { ...DEFAULT_JOINERY },
})

/** Potes de ferro sota un moble de x0..x0+W, fondària D (z0..z0+D) i alçada H. */
function ironLegs(x0: number, W: number, z0: number, D: number, H: number, style: "post" | "sled" | "round" = "post", mat = IRON): FreePart[] {
  const T = 30
  const xs = [x0 + 20, x0 + W - 20 - T]
  const zs = [z0 + 20, z0 + D - 20 - T]
  if (style === "round") return xs.flatMap((x) => zs.map((z) => metal({ name: "Pota", orient: "flat", material: mat, w: T, h: T, thickness: H, x, y: 0, z, shape: oval(T, T) })))
  if (style === "sled")
    return xs.flatMap((x) => [
      metal({ name: "Pota patí", orient: "side", material: mat, w: D - 40, h: 20, thickness: T, x, y: 0, z: z0 + 20 }),
      ...zs.map((z) => metal({ name: "Pota patí", orient: "flat", material: mat, w: T, h: T, thickness: H - 20, x, y: 20, z })),
    ])
  return xs.flatMap((x) => zs.map((z) => metal({ name: "Pota", orient: "flat", material: mat, w: T, h: T, thickness: H, x, y: 0, z })))
}

// --- Taules --------------------------------------------------------------------------------

/** Taula de tauler i dos laterals de panell a inglet (waterfall). */
function waterfall(name: string, o: { w: number; h: number; d: number; t?: number; mat: string }): Composition {
  return { kind: "taula", modules: [tableModule(newId("m"), name, { width: o.w, height: o.h, depth: o.d, thickness: o.t ?? 30, material: o.mat })], references: [] }
}

/** Taula de tauler (amb forma o rectangular) sobre potes lliures. */
function legTable(name: string, o: { w: number; h: number; d: number; t?: number; mat: string; legs: "post" | "sled" | "round" | "pedestal" | "trestle" | "cross"; legMat?: string; shape?: PNode[]; overhang?: number; stone?: boolean }): Composition {
  const t = o.stone ? 20 : (o.t ?? 30)
  const m = tableModule(newId("m"), name, { width: o.w, height: o.h, depth: o.d, thickness: t, material: o.mat, sides: { left: false, right: false }, tableTop: { overhang: o.overhang ?? 0, ...(o.shape ? { shape: o.shape } : {}) } })
  const H = o.h - t
  const legMat = o.legMat ?? IRON
  let parts: FreePart[]
  if (o.legs === "pedestal") {
    const c = Math.min(o.w, o.d) * 0.3
    const base = Math.min(o.w, o.d) * 0.6
    parts = [
      metal({ name: "Peu central", orient: "flat", material: legMat, w: c, h: c, thickness: H - 20, x: o.w / 2 - c / 2, y: 20, z: o.d / 2 - c / 2, shape: oval(c, c) }),
      metal({ name: "Base", orient: "flat", material: legMat, w: base, h: base, thickness: 20, x: o.w / 2 - base / 2, y: 0, z: o.d / 2 - base / 2, shape: oval(base, base) }),
    ]
  } else if (o.legs === "trestle") {
    // Dos laterals de tauler retirats dels extrems i un travesser (de CNC, del material de la taula).
    const inset = Math.min(250, o.w * 0.15)
    const leg = (x: number) => part({ name: "Pota de tauler", orient: "side", material: o.mat, w: o.d - 160, h: H, thickness: 30, x, y: 0, z: 80 })
    parts = [leg(inset), leg(o.w - inset - 30), part({ name: "Travesser", orient: "front", material: o.mat, w: o.w - 2 * inset - 60, h: 120, thickness: 19, x: inset + 30, y: H - 200, z: o.d / 2 - 10 })]
  } else if (o.legs === "cross") {
    // Pota en X: dues planxes creuades al centre (ferro), per a taules rodones.
    const s = Math.min(o.w, o.d) * 0.55
    parts = [
      metal({ name: "Pota en X", orient: "front", material: legMat, w: s, h: H, thickness: 12, x: o.w / 2 - s / 2, y: 0, z: o.d / 2 - 6 }),
      metal({ name: "Pota en X", orient: "side", material: legMat, w: s / 2 - 6, h: H, thickness: 12, x: o.w / 2 - 6, y: 0, z: o.d / 2 + 6 }),
      metal({ name: "Pota en X", orient: "side", material: legMat, w: s / 2 - 6, h: H, thickness: 12, x: o.w / 2 - 6, y: 0, z: o.d / 2 - s / 2 }),
    ]
  } else {
    const inset = o.shape ? Math.min(o.w, o.d) * 0.18 : 0
    parts = ironLegs(inset, o.w - 2 * inset, inset, o.d - 2 * inset, H, o.legs, legMat)
  }
  // Tauler de pedra: no és de CNC, va com a peça lliure sobre les potes.
  if (o.stone) return loose([metal({ name: "Tauler de pedra", orient: "flat", material: STONE, w: o.w, h: o.d, thickness: t, x: 0, y: H, z: 0, ...(o.shape ? { shape: o.shape } : {}) }), ...parts])
  return { kind: "taula", modules: [m], references: [], parts }
}

/** Escriptori: tauler lliure sobre una calaixera i un lateral de panell (o potes de ferro). */
function desk(_name: string, o: { w: number; d: number; mat: string; front?: string; side: "panel" | "iron" | "cabinet"; drawersW?: number; drawerN?: number; h?: number }): Composition {
  const H = o.h ?? 750
  const t = 30
  const dw = o.drawersW ?? 420
  const unit = box("Calaixera", { w: dw, h: H - t, d: o.d - 20, mat: o.mat, front: o.front, base: onFloor }, drawers(o.drawerN ?? 3))
  const top = part({ name: "Tauler", orient: "flat", material: o.mat, w: o.w, h: o.d, thickness: t, x: 0, y: H - t, z: 0 })
  const parts: FreePart[] = [top]
  const modules: Module[] = [unit]
  if (o.side === "panel") parts.push(part({ name: "Lateral", orient: "side", material: o.mat, w: o.d - 20, h: H - t, thickness: 30, x: o.w - 30, y: 0, z: 0 }))
  else if (o.side === "iron") parts.push(...ironLegs(o.w - 260, 240, 0, o.d, H - t, "sled"))
  else modules.push(box("Armariet", { w: dw, h: H - t, d: o.d - 20, mat: o.mat, front: o.front, base: onFloor, gapBefore: o.w - 2 * dw }, door("right", 1)))
  return { kind: "moble", modules, references: [], parts }
}

// --- Llits ----------------------------------------------------------------------------------

/** Llit de matrimoni amb el capçal a la paret: bastidor de tauler, capçal i (opcional) calaixos als peus. */
function bed(_name: string, o: { w: number; l?: number; mat: string; head: "tall" | "low" | "wide"; headMat?: string; footDrawers?: boolean; legsIron?: boolean }): Composition {
  const L = o.l ?? 2000
  const W = o.w
  const Hf = 320
  const headH = o.head === "tall" ? 1200 : o.head === "low" ? 900 : 1000
  const headW = o.head === "wide" ? W + 700 : W + 60
  const hx = (W - headW) / 2
  const x0 = Math.max(0, -hx)
  const parts: FreePart[] = [
    part({ name: "Capçal", orient: "front", material: o.headMat ?? o.mat, w: headW, h: headH, thickness: 30, x: x0 + hx, y: 0, z: 0 }),
    part({ name: "Travesser lateral", orient: "side", material: o.mat, w: L, h: Hf - 60, thickness: 30, x: x0, y: 60, z: 30 }),
    part({ name: "Travesser lateral", orient: "side", material: o.mat, w: L, h: Hf - 60, thickness: 30, x: x0 + W - 30, y: 60, z: 30 }),
    part({ name: "Somier (base)", orient: "flat", material: o.mat, w: W - 60, h: L - 30, thickness: 19, x: x0 + 30, y: Hf - 19 - 40, z: 30 }),
  ]
  const modules: Module[] = []
  if (o.footDrawers) {
    // Calaixos als peus del llit, mirant endavant.
    modules.push({ ...box("Calaixos als peus", { w: W, h: Hf, d: 500, mat: o.mat, base: onFloor }, v(auto(2), [drawers(1), drawers(1)])), wallGap: 30 + L, x: x0 })
  } else parts.push(part({ name: "Peus", orient: "front", material: o.mat, w: W, h: Hf - 60, thickness: 30, x: x0, y: 60, z: 30 + L }))
  if (o.legsIron) parts.push(...ironLegs(x0, W, 30, L, 60, "post"))
  else parts.push(part({ name: "Sòcol", orient: "front", material: o.mat, w: W - 200, h: 60, thickness: 19, x: x0 + 100, y: 0, z: 30 + L - 150 }))
  const mattress: RefObject = { id: newId("r"), name: `Matalàs ${W - 60} × ${L - 30}`, w: W - 70, h: 220, d: L - 40, x: x0 + 35, y: Hf - 40 + 1, z: 35 }
  return modules.length ? { kind: "moble", modules, references: [mattress], parts } : loose(parts, [mattress])
}

/** Llit individual (o compacte) arrambat a la paret pel costat llarg: base de calaixos de 2000. */
function singleBed(_name: string, o: { mat: string; front?: string; drawers: 2 | 3; head?: boolean; trundle?: boolean; w?: number }): Composition {
  const W = 2000
  const D = o.w ?? 950
  const Hb = o.trundle ? 420 : 380
  const root = o.trundle ? v([1000, "auto"], [drawers(1), drawers(1)]) : v(auto(o.drawers), Array.from({ length: o.drawers }, () => drawers(1)))
  const base = box("Base amb calaixos", { w: W, h: Hb, d: D, mat: o.mat, front: o.front, base: plinth(60, 20) }, root)
  const parts: FreePart[] = o.head
    ? [part({ name: "Capçal", orient: "side", material: o.mat, w: D, h: 900, thickness: 30, x: -30, y: 0, z: 0 }), part({ name: "Respatller", orient: "front", material: o.mat, w: W, h: 500, thickness: 19, x: 0, y: Hb, z: 0 })]
    : []
  const mattress: RefObject = { id: newId("r"), name: "Matalàs 900 × 1900", w: 1900, h: 180, d: D - 60, x: 50, y: Hb + 1, z: 40 }
  return { kind: "moble", modules: [base], references: [mattress], parts }
}

/** Lliteres de parets gruixudes (o normals), amb escala de graons i matalassos de referència. */
function bunk(_name: string, o: { mat: string; hollow?: number; drawers?: boolean; stairs: boolean }): Composition {
  const W = 2100, D = 950, H = 2300
  const bottom: Zone = o.drawers ? h([240, "auto"], [v(auto(2), [drawers(1), drawers(1)]), open()]) : open()
  const bunkM = box("Llitera", { w: W, h: H, d: D, mat: o.mat, base: plinth(o.drawers ? 20 : 250, 0), hollow: o.hollow }, h([o.drawers ? 1230 : 1000, "auto"], [bottom, open()]))
  const modules: Module[] = [bunkM]
  if (o.stairs) modules.push(box("Escala", { w: 500, h: H, d: 600, mat: o.mat, base: plinth(80, 0) }, fixed(5, { thickness: 50, flush: true })))
  const wall = o.hollow ?? 19
  const baseY = o.drawers ? 20 + wall + 240 + 19 : 250 + wall
  const upperY = (o.drawers ? 20 : 250) + wall + (o.drawers ? 1230 : 1000) + 19
  const refs: RefObject[] = [
    { id: newId("r"), name: "Matalàs de baix", w: W - 2 * wall - 20, h: 150, d: 900, x: wall + 10, y: baseY + 1, z: 30 },
    { id: newId("r"), name: "Matalàs de dalt", w: W - 2 * wall - 20, h: 150, d: 900, x: wall + 10, y: upperY + 1, z: 30 },
  ]
  // Barana per sobre del matalàs de dalt (220 mm sobre el sostre de la llitera): no pot entrar dins del sostre.
  const railPart = part({ name: "Barana", orient: "front", material: o.mat, w: 1350, h: 160, thickness: 19, module: bunkM.id, x: wall, y: upperY + 220, z: D - 19 })
  return { kind: "armari", modules, references: refs, parts: [railPart] }
}

// --- Cuines --------------------------------------------------------------------------------

type KBase = "drawers" | "door" | "doors" | "sink" | "hob" | "oven" | "dish"
type KWall = "door" | "doors" | "flap" | "open" | "gap"
type KTall = "oven" | "pantry" | "fridge"

interface KitchenOpts {
  mat: string
  front: string
  /** Baixos d'esquerra a dreta: [tipus, amplada]. */
  bases?: [KBase, number][]
  /** Alts penjats sobre els baixos: [tipus, amplada]; «gap» deixa el forat (campana). */
  walls?: [KWall, number][]
  /** Columnes de 2100 a la dreta dels baixos (o a l'esquerra amb `tallsLeft`). */
  talls?: KTall[]
  tallsLeft?: boolean
  /** Taulell: fusta de CNC (correguda, amb els forats de pica i placa) o pedra (peça lliure tallada). */
  top?: { kind: "wood"; mat: string } | { kind: "stone" }
  /** Prestatges de paret en lloc d'alts: nombre i material. */
  shelves?: { n: number; mat: string }
  /** Illa al terra, davant dels baixos. */
  island?: { w: number; d: number; kind: "drawers" | "seats" | "mixed"; top: "stone" | string }
  /** Sense fila de paret: només l'illa (plantilla «Illa de cuina»). */
  islandOnly?: boolean
}

const K_H = 770, K_LEGS = 100, K_D = 560, K_TOP = 30

function kitchenBase(kind: KBase, w: number, o: KitchenOpts): Module {
  const names: Record<KBase, string> = { drawers: "Calaixos", door: "Baix", doors: "Baix", sink: "Fregadera", hob: "Placa", oven: "Forn", dish: "Rentaplats" }
  const zone: Record<KBase, () => Zone> = {
    drawers: () => drawers(3),
    door: () => door("left", 1),
    doors: () => doors(1),
    sink: () => (w > 600 ? doors(0) : door("left", 0)),
    hob: () => drawers(2),
    oven: () => h(["auto", 595], [drawers(1), open()]),
    dish: () => panel(),
  }
  const noTop = kind === "sink" || kind === "hob" || kind === "dish"
  return box(`${names[kind]} ${w}`, { w, h: K_H, d: K_D, mat: o.mat, front: o.front, base: legs(K_LEGS), ...(noTop ? { top: { kind: "none" as const } } : {}) }, zone[kind]())
}

function kitchenTall(kind: KTall, o: KitchenOpts): Module {
  const W = 600
  if (kind === "oven")
    return box("Columna forn", { w: W, h: 2100, d: K_D, mat: o.mat, front: o.front, base: legs(K_LEGS) }, h(["auto", 595, 380, "auto"], [drawers(2), open(), open(), door("left", 1)]))
  if (kind === "fridge") return box("Columna frigorífic", { w: W, h: 2100, d: K_D, mat: o.mat, front: o.front, base: legs(K_LEGS) }, h(["auto", 400], [door("left", 0), door("left", 1)]))
  return box("Columna rebost", { w: W, h: 2100, d: K_D, mat: o.mat, front: o.front, base: legs(K_LEGS) }, door("right", 5))
}

/** Cuina: fila de baixos amb taulell i sòcol correguts, alts penjats o prestatges, columnes i illa. */
function kitchen(o: KitchenOpts): Composition {
  const bases = (o.bases ?? []).map(([k, w]) => ({ k, m: kitchenBase(k, w, o) }))
  const talls = (o.talls ?? []).map((k) => kitchenTall(k, o))
  const floor = o.tallsLeft ? [...talls, ...bases.map((b) => b.m)] : [...bases.map((b) => b.m), ...talls]
  const x0 = o.tallsLeft ? talls.length * 600 : 0
  const baseW = bases.reduce((n, b) => n + b.m.carcass.width, 0)
  const modules: Module[] = [...floor]
  const parts: FreePart[] = []
  const references: RefObject[] = []
  const runs: NonNullable<Composition["runs"]> = []

  // Alts penjats alineats amb els baixos.
  let gap = x0
  for (const [k, w] of o.walls ?? []) {
    if (k === "gap") {
      gap += w
      continue
    }
    const zone = k === "door" ? door("left", 1) : k === "doors" ? doors(1) : k === "flap" ? flap("up", 1) : open(1)
    modules.push(box(k === "flap" ? "Alt abatible" : "Alt", { w, h: 720, d: 330, mat: o.mat, front: o.front, base: hung(1450), gapBefore: gap }, zone))
    gap = 0
  }
  if (o.shelves)
    for (let i = 0; i < o.shelves.n; i++)
      parts.push(part({ name: "Prestatge de paret", orient: "flat", material: o.shelves.mat, w: Math.min(baseW, 1800), h: 250, thickness: 30, x: x0, y: 1350 + i * 350, z: 0, group: "Prestatges de paret" }))

  // Taulell corregut.
  if (bases.length && o.top) {
    const sink = bases.find((b) => b.k === "sink")
    const hob = bases.find((b) => b.k === "hob")
    if (o.top.kind === "wood")
      runs.push({
        id: newId("run"),
        kind: "worktop",
        from: bases[0]!.m.id,
        to: bases.at(-1)!.m.id,
        material: o.top.mat,
        thickness: K_TOP,
        overhangFront: 20,
        overhangLeft: 0,
        overhangRight: 0,
        cutouts: [
          ...(sink ? [{ id: newId(), kind: "sink" as const, module: sink.m.id, w: Math.min(740, sink.m.carcass.width - 120), d: 440, dx: 0 }] : []),
          ...(hob ? [{ id: newId(), kind: "hob" as const, module: hob.m.id, w: 560, d: 490, dx: 0 }] : []),
        ],
      })
    else {
      parts.push(stoneTop(x0, baseW, K_D + 60, K_H + K_LEGS, K_TOP))
      // Pica i placa: tallen la pedra (a sota no hi ha tapa).
      const xOf = (m: Module) => x0 + bases.slice(0, bases.findIndex((b) => b.m === m)).reduce((n, b) => n + b.m.carcass.width, 0)
      if (sink) {
        const w = Math.min(740, sink.m.carcass.width - 120)
        references.push({ id: newId("r"), name: "Pica", w, h: 60, d: 440, x: xOf(sink.m) + (sink.m.carcass.width - w) / 2, y: K_H + K_LEGS - 15, z: 80, effect: "cut", axis: "y" })
      }
      if (hob) references.push({ id: newId("r"), name: "Placa", w: 560, h: 60, d: 490, x: xOf(hob.m) + (hob.m.carcass.width - 560) / 2, y: K_H + K_LEGS - 15, z: 70, effect: "cut", axis: "y" })
    }
  }
  if (floor.length > 1) runs.push({ id: newId("run"), kind: "plinth", from: floor[0]!.id, to: floor.at(-1)!.id, material: o.front, thickness: 19, setback: 40 })

  // Illa al terra (X pròpia) amb el taulell enganxat.
  if (o.island) {
    const I = o.island
    const cols = Math.max(2, Math.round(I.w / 600))
    const root = I.kind === "mixed" ? v(auto(cols), Array.from({ length: cols }, (_, i) => (i % 2 ? doors(1) : drawers(3)))) : v(auto(cols), Array.from({ length: cols }, () => drawers(3)))
    const rowW = Math.max(baseW + x0 + talls.length * (o.tallsLeft ? 0 : 600), I.w)
    const island: Module = { ...box("Illa", { w: I.w, h: K_H, d: I.d, mat: o.mat, front: o.front, base: legs(K_LEGS) }, root), wallGap: o.islandOnly ? 0 : K_D + 1100, x: o.islandOnly ? 0 : Math.max(0, (rowW - I.w) / 2) }
    modules.push(island)
    // Barra: el taulell volat 300 per la banda de darrere per seure-hi.
    const back = I.kind === "seats" ? 320 : 20
    const top = { name: "Taulell de l'illa", orient: "flat" as const, w: I.w + 40, h: I.d + 20 + back, thickness: K_TOP, module: island.id, x: -20, y: K_H + K_LEGS, z: -back }
    parts.push(I.top === "stone" ? metal({ ...top, material: STONE }) : part({ ...top, material: I.top }))
  }
  return { kind: "cuina", modules, references, parts, runs }
}

// --- Plantilla --------------------------------------------------------------------------------

interface Variant {
  name: string
  style: string
  materials: string
  colors: string
  use: string
  audience: string
  price: number
  kind?: CompositionKind
  make: () => Composition
}

/**
 * Mides exteriors «A × H × F» d'una composició (mòduls i peces lliures): la caixa que ocupa el moble, no la distància a
 * la paret ni a l'origen (una tauleta a 1200 de la paret fa 900 de fons, no 2100). L'alçada compta des de terra (potes i
 * sòcol inclosos), menys si tot va penjat: llavors des de sota del mòdul.
 */
export const compositionDims = (c: Composition): string => {
  // Flat-pack i objectes: el mòdul que porten no es fa (no compta per a les mides).
  const mods = partsOnlyKind(c.kind ?? "moble") ? [] : c.modules
  const ps = modulePlacements({ ...c, modules: mods })
  const xs: [number, number][] = [], ys: [number, number][] = [], zs: [number, number][] = []
  mods.forEach((m, i) => {
    const pl = ps[i]!
    xs.push([pl.x, pl.x + m.carcass.width])
    ys.push([m.carcass.base.kind === "wall" ? pl.y : 0, pl.y + m.carcass.height])
    zs.push([pl.z ?? 0, (pl.z ?? 0) + m.carcass.depth])
  })
  for (const p of c.parts ?? []) {
    xs.push([p.x, p.x + (p.orient === "side" ? p.thickness : p.w)])
    ys.push([p.y, p.y + (p.orient === "flat" ? p.thickness : p.h)])
    zs.push([p.z, p.z + (p.orient === "flat" ? p.h : p.orient === "side" ? p.w : p.thickness)])
  }
  const span = (r: [number, number][]) => (r.length ? Math.max(...r.map((x) => x[1])) - Math.min(...r.map((x) => x[0])) : 0)
  return `${Math.round(span(xs))} × ${Math.round(span(ys))} × ${Math.round(span(zs))}`
}

function items(cat: string, type: string, vs: Variant[]): StoreType {
  return {
    name: type,
    items: vs.map((x, i) => {
      const sample = x.make()
      const kind = x.kind ?? sample.kind ?? "moble"
      return {
        id: `store-${cat}-${type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i + 1}`,
        kind,
        name: `${type} «${x.name}»`,
        description: `${x.style} · ${compositionDims(sample)} mm · ${x.materials}. ${x.use}. Colors: ${x.colors}. Per a ${x.audience}.`,
        price: x.price,
        make: () => ({ ...x.make(), kind }),
      }
    }),
  }
}

const one = (m: Module, extra: Partial<Composition> = {}): Composition => ({ kind: "moble", modules: [m], references: [], ...extra })
const row = (ms: Module[], extra: Partial<Composition> = {}): Composition => ({ kind: "moble", modules: ms, references: [], ...extra })

// --- Famílies reutilitzables -------------------------------------------------------------------

/**
 * Aparador / moble baix: columnes definides per zones. Amb potes de peces lliures (ferro, fusta
 * torneada), la caixa va «penjada» a l'alçada de les potes (com la consola de noguera): així no
 * surten també les potes regulables.
 */
const sideboard = (name: string, o: BoxOpts, cols: [number | "auto", Zone][], parts?: (o: BoxOpts) => FreePart[]) =>
  one(box(name, parts && o.base?.kind === "legs" ? { ...o, base: hung(o.base.height) } : o, cols.length === 1 ? cols[0]![1] : v(cols.map((c) => c[0]), cols.map((c) => c[1]))), parts ? { parts: parts(o) } : {})

/** Llibreria / prestatgeria de columnes de `colW`, amb baixos opcionals de portes. */
function bookcase(name: string, o: { cols: number; colW: number; h: number; d: number; mat: string; front?: string; lower?: "doors" | "drawers" | "none"; shelves: number; base?: Carcass["base"]; back?: Carcass["back"]; hollow?: number }): Composition {
  const lowerZone = (): Zone => (o.lower === "drawers" ? drawers(2) : o.colW > 600 ? doors(1) : door("left", 1))
  const ms = Array.from({ length: o.cols }, (_, i) =>
    box(o.cols > 1 ? `${name} ${i + 1}` : name, { w: o.colW, h: o.h, d: o.d, mat: o.mat, front: o.front, base: o.base ?? plinth(60, 20), back: o.back, hollow: o.hollow }, o.lower && o.lower !== "none" ? h([720, "auto"], [lowerZone(), open(o.shelves)]) : open(o.shelves, false)),
  )
  return row(ms)
}

/** Armari de cossos (penjador, doble barra, calaixos i prestatges). */
function wardrobe(name: string, o: { bodies: ("hang" | "hang2" | "drawers" | "shelves")[]; bodyW?: number; h?: number; d?: number; mat: string; front?: string; base?: Carcass["base"]; inset?: boolean; push?: boolean }): Composition {
  const H = o.h ?? 2200
  const W = o.bodyW ?? 800
  const zone = (k: string): Zone => {
    const doorsFront = { kind: "door" as const, mode: "double" as const, hinge: "left" as const }
    if (k === "hang") return { id: id(), front: doorsFront, split: { dir: "h", sizes: ["auto", 380], children: [rail(), open()] } }
    if (k === "hang2") return { id: id(), front: doorsFront, split: { dir: "h", sizes: [950, "auto"], children: [rail(), rail()] } }
    if (k === "drawers") return h([700, "auto"], [drawers(3), doors(3)])
    return doors(5)
  }
  const ms = o.bodies.map((k, i) => box(o.bodies.length > 1 ? `${name} ${i + 1}` : name, { w: W, h: H, d: o.d ?? 600, mat: o.mat, front: o.front, base: o.base ?? plinth(80, 30), inset: o.inset, push: o.push }, zone(k)))
  return { kind: "armari", modules: ms, references: [] }
}

/** Taulell de pedra (sense nesting) sobre un moble de x0, amplada W i fondària D, a l'alçada y. */
const stoneTop = (x: number, W: number, D: number, y: number, t = 20): FreePart => metal({ name: "Taulell de pedra", orient: "flat", material: STONE, w: W, h: D, thickness: t, x, y, z: 0 })
const glassShelf = (x: number, W: number, D: number, y: number): FreePart => metal({ name: "Prestatge de vidre", orient: "flat", material: GLASS, w: W, h: D, thickness: 8, x, y, z: 10 })

// --- Catàleg --------------------------------------------------------------------------------------

export const STORE_CATALOG: StoreCategory[] = [
  {
    id: "salo",
    name: "Saló",
    types: [
      items("salo", "Taula de centre", [
        { name: "Bloc", style: "Minimalista", materials: "noguera xapada, cantonades a inglet", colors: "noguera, roure natural", use: "Cub tancat de tauler, sense cap cantell vist", audience: "salons contemporanis petits", price: 490, make: () => one({ ...box("Tauleta", { w: 900, h: 340, d: 900, mat: WAL, base: onFloor, joint: "mitre" }, panel()), wallGap: 1200, x: 600 }) },
        { name: "Nube", style: "Organic modern", materials: "roure massís sobre pota central de ferro", colors: "roure natural, negre", use: "Tauler oval sobre peu rodó", audience: "salons oberts de línies suaus", price: 620, make: () => legTable("Tauleta", { w: 1200, h: 380, d: 700, mat: OAK, legs: "pedestal", shape: oval(1200, 700) }) },
        { name: "Duo", style: "Industrial elegant", materials: "MDF lacat antracita sobre potes de ferro", colors: "antracita, negre", use: "Tauler amb calaix de cada costat per als comandaments", audience: "pisos urbans", price: 540, make: () => sideboard("Tauleta", { w: 1100, h: 400, d: 600, mat: ANTH, base: legs(120) }, [["auto", drawers(1)], ["auto", drawers(1)]], (o) => ironLegs(0, o.w, 0, o.d, 120, "sled")) },
      ]),
      items("salo", "Moble TV", [
        { name: "Horitzó", style: "Minimalista", materials: "MDF lacat penjat, prestatges flotants", colors: "blanc trencat, greige", use: "Calaixos, nínxol per als aparells i portes, amb passacables", audience: "salons amb la TV penjada", price: 890, make: () => one(box("Moble TV", { w: 2400, h: 420, d: 420, mat: LAC, base: hung(250) }, v([600, 600, "auto", "auto"], [drawers(2), open(), door("left"), door("right")])), { parts: [part({ name: "Prestatge flotant", orient: "flat", material: LAC, w: 1000, h: 250, thickness: 30, x: 0, y: 1300, z: 0 })] }) },
        { name: "Oslo", style: "Escandinau", materials: "roure xapat sobre potes, reixeta de ventilació", colors: "roure natural, blanc", use: "Reixeta per als aparells amb el comandament a distància i dos calaixos", audience: "famílies", price: 760, make: () => sideboard("Moble TV", { w: 1800, h: 500, d: 420, mat: OAK, base: legs(160) }, [["auto", drawers(2)], [600, grille()], ["auto", drawers(2)]], (o) => ironLegs(0, o.w, 0, o.d, 160, "round", OAK)) },
        { name: "Monolit", style: "Modern luxe", materials: "noguera a inglet i parets buides de 50", colors: "noguera, negre", use: "Tres calaixos de punta a punta, a inglet, sense tiradors vistos", audience: "salons de disseny", price: 1290, make: () => one(box("Moble TV", { w: 2000, h: 380, d: 450, mat: WAL, base: onFloor, joint: "mitre" }, v(auto(3), [drawers(1), drawers(1), drawers(1)]))) },
      ]),
      items("salo", "Aparador", [
        { name: "Lisboa", style: "Mediterrani contemporani", materials: "MDF lacat terracota amb fronts encastats", colors: "terracota, greige, verd oliva", use: "Portes i calaixos encastats, prestatges regulables", audience: "cases de colors càlids", price: 980, make: () => sideboard("Aparador", { w: 1800, h: 780, d: 450, mat: TERRA, base: plinth(60, 20), inset: true }, [["auto", doors(1)], [500, drawers(3)], ["auto", doors(1)]]) },
        { name: "Forja", style: "Industrial elegant", materials: "noguera sobre bastidor de ferro", colors: "noguera, negre", use: "Obert amb prestatge gruixut a ras i dues portes", audience: "lofts", price: 1150, make: () => sideboard("Aparador", { w: 1600, h: 650, d: 450, mat: WAL, base: legs(250), joint: "mitre" }, [["auto", doors(1)], [800, fixed(1, { thickness: 50, flush: true })]], (o) => ironLegs(0, o.w, 0, o.d, 250, "post")) },
        { name: "Nord", style: "Escandinau", materials: "freixe xapat amb potes de fusta", colors: "freixe, blanc", use: "Quatre portes amb un prestatge per cos", audience: "menjadors familiars", price: 820, make: () => sideboard("Aparador", { w: 1600, h: 750, d: 430, mat: ASH, base: legs(180) }, [["auto", doors(1)], ["auto", doors(1)]], (o) => ironLegs(0, o.w, 0, o.d, 180, "round", ASH)) },
      ]),
      items("salo", "Vitrina", [
        { name: "Cristall", style: "Contemporani", materials: "MDF lacat amb prestatges de vidre", colors: "blanc, greige", use: "Part de dalt oberta amb prestatges de vidre i portes a baix", audience: "col·leccionistes", price: 890, make: () => one(box("Vitrina", { w: 800, h: 1900, d: 400, mat: LAC, base: plinth(60, 20) }, h([720, "auto"], [doors(1), open()])), { parts: [1100, 1450].map((y) => glassShelf(19, 762, 360, y)) }) },
        { name: "Galeria", style: "Modern luxe", materials: "noguera amb fons negre i prestatges de vidre", colors: "noguera, negre", use: "Dues columnes obertes amb llum LED sota cada prestatge i calaixos a baix", audience: "salons elegants", price: 1340, make: () => row([0, 1].map((i) => box(`Vitrina ${i + 1}`, { w: 700, h: 2000, d: 420, mat: WAL, base: plinth(60, 20) }, h([500, "auto"], [drawers(2), { ...open(3), led: {} }])))) },
        { name: "Pilar", style: "Minimalista", materials: "roure xapat, alta i estreta", colors: "roure natural", use: "Columna oberta amb calaix inferior", audience: "racons i entrades", price: 560, make: () => one(box("Vitrina", { w: 500, h: 1800, d: 380, mat: OAK, base: plinth(60, 20) }, h([250, "auto"], [drawers(1), open(4)]))) },
      ]),
      items("salo", "Llibreria", [
        { name: "Biblio", style: "Contemporani", materials: "noguera amb baixos negres", colors: "noguera, negre", use: "De terra a sostre amb portes a baix", audience: "lectors", price: 1590, make: () => bookcase("Llibreria", { cols: 3, colW: 700, h: 2300, d: 380, mat: WAL, front: BLACK, lower: "doors", shelves: 3 }) },
        { name: "Grid", style: "Modular", materials: "melamina blanca", colors: "blanc, gris", use: "Quatre columnes obertes de prestatges fixos", audience: "estudis i despatxos", price: 690, make: () => bookcase("Llibreria", { cols: 4, colW: 600, h: 2000, d: 330, mat: WHITE, shelves: 4, lower: "none" }) },
        { name: "Nit", style: "Minimalista", materials: "MDF lacat blau fosc amb calaixos", colors: "blau fosc, roure", use: "Dues columnes amb calaixos a baix", audience: "salons amb caràcter", price: 1120, make: () => bookcase("Llibreria", { cols: 2, colW: 800, h: 2100, d: 380, mat: NAVY, lower: "drawers", shelves: 3 }) },
      ]),
      items("salo", "Prestatgeria", [
        { name: "Escala", style: "Escandinau", materials: "roure massís", colors: "roure natural", use: "Oberta per davant i per darrere, per separar ambients", audience: "espais oberts", price: 540, make: () => bookcase("Prestatgeria", { cols: 2, colW: 800, h: 1800, d: 350, mat: OAK, shelves: 4, lower: "none", back: "none" }) },
        { name: "Gruix", style: "Modern luxe", materials: "prestatges i parets buides de 50", colors: "blanc, greige", use: "Prestatges gruixuts a ras amb aspecte massís", audience: "salons de disseny", price: 990, make: () => one(box("Prestatgeria", { w: 900, h: 1800, d: 350, mat: GREIGE, base: onFloor, hollow: 50 }, fixed(3, { thickness: 50, flush: true }))) },
        { name: "Baixa", style: "Japandi", materials: "freixe xapat", colors: "freixe, negre", use: "Prestatgeria baixa sota la finestra", audience: "dormitoris i salons", price: 420, make: () => bookcase("Prestatgeria", { cols: 2, colW: 800, h: 900, d: 350, mat: ASH, shelves: 1, lower: "none", base: legs(100) }) },
      ]),
      items("salo", "Consola", [
        { name: "Tall", style: "Minimalista", materials: "noguera a inglet (waterfall)", colors: "noguera, roure", use: "Tauler i laterals de panell com un bloc", audience: "rebedors i salons", price: 520, make: () => waterfall("Consola", { w: 1300, h: 780, d: 380, mat: WAL }) },
        { name: "Llum", style: "Contemporani", materials: "caixa amb calaixos sobre potes de ferro", colors: "roure natural, negre", use: "Dos calaixos per a claus i correu", audience: "entrades", price: 460, make: () => sideboard("Consola", { w: 1200, h: 180, d: 380, mat: OAK, base: legs(600) }, [["auto", drawers(1)], ["auto", drawers(1)]], (o) => ironLegs(0, o.w, 0, o.d, 600, "post")) },
        { name: "Arc", style: "Organic modern", materials: "roure massís sobre potes rodones de ferro", colors: "roure natural, negre", use: "Tauler ovalat", audience: "salons moderns", price: 480, make: () => legTable("Consola", { w: 1300, h: 780, d: 380, mat: OAK, legs: "round", shape: oval(1300, 380), t: 30 }) },
      ]),
      items("salo", "Taula auxiliar", [
        { name: "Cub", style: "Minimalista", materials: "MDF lacat verd oliva a inglet", colors: "verd oliva, terracota, antracita", use: "Cub petit amb una cara oberta", audience: "al costat del sofà", price: 220, make: () => one(box("Auxiliar", { w: 450, h: 450, d: 450, mat: OLIVE, base: onFloor, joint: "mitre" }, open())) },
        { name: "Pedra", style: "Modern luxe", materials: "pedra sobre peu de ferro", colors: "marbre blanc, negre", use: "Tauler rodó de pedra", audience: "salons elegants", price: 340, make: () => legTable("Auxiliar", { w: 500, h: 520, d: 500, mat: STONE, legs: "pedestal", shape: oval(500, 500), stone: true }) },
        { name: "Nansa", style: "Escandinau", materials: "freixe amb calaix", colors: "freixe, blanc", use: "Calaix i prestatge sobre potes", audience: "salons i dormitoris", price: 260, make: () => one(box("Auxiliar", { w: 500, h: 400, d: 400, mat: ASH, base: legs(150) }, h(["auto", 150], [open(), drawers(1)]))) },
      ]),
    ],
  },
  {
    id: "menjador",
    name: "Menjador",
    types: [
      items("menjador", "Taula de menjador", [
        { name: "Cascada", style: "Minimalista", materials: "roure massís a inglet (waterfall)", colors: "roure natural, noguera", use: "Tauler de 30 i laterals de panell, 8 comensals", audience: "menjadors amplis", price: 1450, make: () => waterfall("Taula", { w: 2200, h: 750, d: 950, mat: OAK }) },
        { name: "Roda", style: "Organic modern", materials: "roure sobre pota en X de ferro", colors: "roure natural, negre", use: "Taula rodona per a 4–5 comensals", audience: "cuines obertes", price: 990, make: () => legTable("Taula", { w: 1200, h: 750, d: 1200, mat: OAK, legs: "cross", shape: oval(1200, 1200) }) },
        { name: "Refugi", style: "Rústic contemporani", materials: "noguera amb potes de tauler i travesser", colors: "noguera, roure", use: "Taula de cavallets per a 6 comensals", audience: "cases de camp", price: 1180, make: () => legTable("Taula", { w: 2000, h: 750, d: 900, mat: WAL, legs: "trestle" }) },
      ]),
      items("menjador", "Banc", [
        { name: "Pont", style: "Minimalista", materials: "roure a inglet", colors: "roure natural", use: "Banc de panell per a la taula de menjador", audience: "menjadors familiars", price: 390, make: () => waterfall("Banc", { w: 1600, h: 450, d: 380, mat: OAK }) },
        { name: "Bagul", style: "Escandinau", materials: "freixe amb calaixos", colors: "freixe, blanc", use: "Banc amb dos calaixos a sota", audience: "cuines i entrades", price: 520, make: () => sideboard("Banc", { w: 1400, h: 450, d: 400, mat: ASH, base: plinth(60, 20) }, [["auto", drawers(1)], ["auto", drawers(1)]]) },
        { name: "Ferro", style: "Industrial elegant", materials: "noguera sobre potes de ferro", colors: "noguera, negre", use: "Seient de 30 mm sobre patins", audience: "lofts", price: 360, make: () => legTable("Banc", { w: 1500, h: 450, d: 380, mat: WAL, legs: "sled" }) },
      ]),
      items("menjador", "Aparador", [
        { name: "Llarg", style: "Contemporani", materials: "MDF lacat greige", colors: "greige, blanc", use: "Quatre portes i calaixos al mig", audience: "menjadors amplis", price: 1180, make: () => sideboard("Aparador", { w: 2200, h: 800, d: 480, mat: GREIGE, base: plinth(60, 20) }, [["auto", doors(1)], [600, drawers(3)], ["auto", doors(1)]]) },
        { name: "Penjat", style: "Minimalista", materials: "roure xapat penjat", colors: "roure natural, blanc", use: "Aparador flotant amb portes abatibles", audience: "pisos moderns", price: 780, make: () => sideboard("Aparador", { w: 1600, h: 450, d: 420, mat: OAK, base: hung(400) }, [["auto", door("left")], ["auto", door("right")], ["auto", drawers(2)]]) },
        { name: "Duna", style: "Japandi", materials: "freixe amb fronts encastats", colors: "freixe, negre", use: "Calaixos i portes encastades sobre potes", audience: "cases serenes", price: 1060, make: () => sideboard("Aparador", { w: 1600, h: 700, d: 450, mat: ASH, base: legs(200), inset: true }, [["auto", doors(1)], ["auto", drawers(3)]], (o) => ironLegs(0, o.w, 0, o.d, 200, "round", ASH)) },
      ]),
      items("menjador", "Vitrina", [
        { name: "Vaixella", style: "Clàssic modern", materials: "melamina blanca, vidre", colors: "blanc", use: "Vitrina alta amb portes a baix i vidre a dalt", audience: "menjadors familiars", price: 690, make: () => one(box("Vitrina", { w: 800, h: 2000, d: 420, mat: WHITE, base: plinth(80, 30) }, h([800, "auto"], [doors(1), open()])), { parts: [1250, 1600].map((y) => glassShelf(19, 762, 380, y)) }) },
        { name: "Bar", style: "Modern luxe", materials: "noguera amb abatible", colors: "noguera, negre", use: "Moble bar amb abatible i ampolles a baix", audience: "amants del vi", price: 980, make: () => one(box("Vitrina", { w: 800, h: 1500, d: 420, mat: WAL, base: legs(150) }, h([600, 400, "auto"], [doors(1), flap("down"), open(1)]))) },
        { name: "Doble", style: "Contemporani", materials: "roure i vidre", colors: "roure natural", use: "Dues vitrines baixes oberts amb calaix", audience: "menjadors mitjans", price: 740, make: () => row([0, 1].map((i) => box(`Vitrina ${i + 1}`, { w: 600, h: 1400, d: 400, mat: OAK, base: plinth(60, 20) }, h([220, "auto"], [drawers(1), open(2)])))) },
      ]),
      items("menjador", "Moble auxiliar", [
        { name: "Buffet", style: "Contemporani", materials: "MDF lacat antracita amb taulell de pedra", colors: "antracita, marbre", use: "Moble de servei amb calaixos i taulell de pedra", audience: "menjadors amb cuina oberta", price: 890, make: () => one(box("Buffet", { w: 1200, h: 880, d: 500, mat: ANTH, base: plinth(80, 30), top: { kind: "none" } }, v(auto(2), [drawers(3), doors(1)])), { parts: [stoneTop(0, 1200, 520, 880)] }) },
        { name: "Cava", style: "Industrial elegant", materials: "roure amb reixeta", colors: "roure natural, negre", use: "Botellers darrere reixeta i calaix", audience: "amants del vi", price: 620, make: () => one(box("Cava", { w: 600, h: 900, d: 450, mat: OAK, base: legs(150) }, h(["auto", 180], [grille(), drawers(1)]))) },
        { name: "Racó", style: "Escandinau", materials: "freixe", colors: "freixe, blanc", use: "Moble estret amb calaixos per a estovalles", audience: "menjadors petits", price: 390, make: () => one(box("Auxiliar", { w: 500, h: 900, d: 420, mat: ASH, base: plinth(60, 20) }, drawers(4))) },
      ]),
    ],
  },
  {
    id: "cuina",
    name: "Cuina",
    types: [
      items("cuina", "Cuina lineal", [
        { name: "Nívia", style: "Minimalista", materials: "caixes de melamina blanca, fronts d'MDF lacat, taulell de roure", colors: "blanc, greige", use: "Calaixos, pica, rentaplats i placa en línia, alts de porta i abatible", audience: "pisos i primeres cases", price: 4900, make: () => kitchen({ mat: WHITE, front: LAC, bases: [["drawers", 600], ["sink", 800], ["dish", 600], ["hob", 600], ["drawers", 600]], walls: [["door", 600], ["door", 600], ["door", 600], ["gap", 600], ["flap", 600]], top: { kind: "wood", mat: OAK } }) },
        { name: "Bosc", style: "Escandinau", materials: "melamina blanca i fronts de roure, taulell de pedra", colors: "roure natural, blanc", use: "Baixos amb columnes de forn i rebost i prestatges de paret de roure", audience: "famílies", price: 7200, make: () => kitchen({ mat: WHITE, front: OAKM, bases: [["drawers", 600], ["sink", 800], ["dish", 600], ["hob", 800]], talls: ["oven", "pantry"], shelves: { n: 2, mat: OAK }, top: { kind: "stone" } }) },
        { name: "Grafit", style: "Industrial elegant", materials: "fronts d'MDF lacat antracita, taulell de noguera", colors: "antracita, noguera", use: "Cinc baixos i alts de porta, amb forn sota la placa", audience: "lofts i cuines obertes", price: 6400, make: () => kitchen({ mat: GREY, front: ANTH, bases: [["door", 600], ["sink", 800], ["dish", 600], ["oven", 600], ["drawers", 600]], walls: [["door", 600], ["doors", 800], ["door", 600], ["gap", 600], ["door", 600]], top: { kind: "wood", mat: WAL } }) },
      ]),
      items("cuina", "Cuina amb illa", [
        { name: "Àgora", style: "Contemporani", materials: "fronts lacats greige, illa amb taulell de pedra", colors: "greige, pedra", use: "Fila de baixos amb frigorífic i forn en columna, illa de calaixos de 2400", audience: "cases amb cuina oberta al menjador", price: 11900, make: () => kitchen({ mat: WHITE, front: GREIGE, bases: [["drawers", 600], ["sink", 800], ["dish", 600], ["hob", 800], ["drawers", 600]], talls: ["fridge", "oven"], tallsLeft: true, walls: [["door", 600], ["door", 600], ["door", 600], ["gap", 800], ["door", 600]], top: { kind: "stone" }, island: { w: 2400, d: 900, kind: "drawers", top: "stone" } }) },
        { name: "Fiord", style: "Escandinau", materials: "fronts de roure i barra de roure", colors: "roure natural, blanc", use: "Baixos i illa amb barra per a tres tamborets", audience: "famílies joves", price: 8900, make: () => kitchen({ mat: WHITE, front: OAKM, bases: [["drawers", 600], ["sink", 800], ["dish", 600], ["hob", 800]], shelves: { n: 2, mat: OAK }, top: { kind: "wood", mat: OAK }, island: { w: 1800, d: 600, kind: "seats", top: OAK } }) },
        { name: "Olivera", style: "Mediterrani contemporani", materials: "fronts lacats verd oliva, pedra", colors: "verd oliva, pedra, roure", use: "Illa de calaixos i portes amb taulell de pedra i alts de porta", audience: "cases de poble reformades", price: 9800, make: () => kitchen({ mat: WHITE, front: OLIVE, bases: [["drawers", 600], ["sink", 800], ["dish", 600], ["hob", 600], ["door", 600]], walls: [["door", 600], ["door", 600], ["door", 600], ["gap", 600], ["door", 600]], top: { kind: "stone" }, island: { w: 2000, d: 900, kind: "mixed", top: "stone" } }) },
      ]),
      items("cuina", "Kitchenette", [
        { name: "Estudi", style: "Minimalista", materials: "melamina blanca, taulell de roure", colors: "blanc, roure", use: "Cuina de 1800 amb calaixos, placa i pica, alts de porta i abatible", audience: "estudis i apartaments turístics", price: 2290, make: () => kitchen({ mat: WHITE, front: WHITE, bases: [["drawers", 600], ["hob", 600], ["sink", 600]], walls: [["door", 600], ["gap", 600], ["flap", 600]], top: { kind: "wood", mat: OAK } }) },
        { name: "Loft", style: "Industrial elegant", materials: "fronts antracita, taulell de noguera", colors: "antracita, noguera", use: "Cuina de 2600 amb columna de frigorífic i prestatges de paret", audience: "lofts", price: 3490, make: () => kitchen({ mat: GREY, front: ANTH, bases: [["sink", 800], ["hob", 600], ["drawers", 600]], talls: ["fridge"], shelves: { n: 2, mat: WAL }, top: { kind: "wood", mat: WAL } }) },
        { name: "Office", style: "Contemporani", materials: "melamina gris, taulell de roure", colors: "gris, roure", use: "Office d'oficina amb pica, armari i calaixos", audience: "oficines i sales de descans", price: 1890, make: () => kitchen({ mat: GREY, front: GREY, bases: [["sink", 600], ["door", 600], ["drawers", 400]], walls: [["door", 600], ["door", 600], ["door", 400]], top: { kind: "wood", mat: OAK } }) },
      ]),
      items("cuina", "Illa de cuina", [
        { name: "Bloc", style: "Modern luxe", materials: "fronts de noguera, taulell de pedra", colors: "noguera, marbre", use: "Illa de 1800 × 900 de calaixos per les dues bandes de treball", audience: "cuines amples", price: 3900, make: () => kitchen({ mat: WHITE, front: WAL, island: { w: 1800, d: 900, kind: "drawers", top: "stone" }, islandOnly: true }) },
        { name: "Barra", style: "Escandinau", materials: "fronts de roure, barra de roure", colors: "roure natural", use: "Illa de 1600 amb barra volada per seure", audience: "cuines obertes al saló", price: 2600, make: () => kitchen({ mat: WHITE, front: OAKM, island: { w: 1600, d: 600, kind: "seats", top: OAK }, islandOnly: true }) },
        { name: "Taller", style: "Industrial elegant", materials: "fronts lacats blau fosc, taulell de noguera", colors: "blau fosc, noguera", use: "Illa de 2400 × 1000 de calaixos i portes", audience: "cuiners de casa", price: 4600, make: () => kitchen({ mat: WHITE, front: NAVY, island: { w: 2400, d: 1000, kind: "mixed", top: WAL }, islandOnly: true }) },
      ]),
      items("cuina", "Columnes de cuina", [
        { name: "Forn i rebost", style: "Contemporani", materials: "melamina blanca, fronts lacats", colors: "blanc, greige", use: "Columna de forn i microones i dues de rebost", audience: "cuines amb paret lliure", price: 2400, make: () => kitchen({ mat: WHITE, front: LAC, talls: ["oven", "pantry", "pantry"] }) },
        { name: "Nevera", style: "Minimalista", materials: "fronts de roure", colors: "roure natural", use: "Columnes de frigorífic integrat, forn i rebost", audience: "reformes de cuina", price: 2900, make: () => kitchen({ mat: WHITE, front: OAKM, talls: ["fridge", "oven", "pantry"] }) },
        { name: "Rebost", style: "Funcional", materials: "melamina gris", colors: "gris", use: "Dues columnes de rebost de prestatges", audience: "cuines amb poc armari", price: 1290, make: () => kitchen({ mat: GREY, front: GREY, talls: ["pantry", "pantry"] }) },
      ]),
      items("cuina", "Racó de cafè", [
        { name: "Barista", style: "Contemporani", materials: "fronts antracita, taulell de pedra, prestatges de roure", colors: "antracita, roure, marbre", use: "Moble de cafè amb calaixos i porta i prestatges a sobre", audience: "menjadors i despatxos", price: 1490, make: () => kitchen({ mat: GREY, front: ANTH, bases: [["drawers", 600], ["door", 600]], shelves: { n: 2, mat: OAK }, top: { kind: "stone" } }) },
        { name: "Celler", style: "Modern luxe", materials: "fronts de noguera, taulell de noguera", colors: "noguera", use: "Baix de portes, calaixos i columna de rebost per a les ampolles", audience: "amants del vi", price: 2190, make: () => kitchen({ mat: WHITE, front: WAL, bases: [["doors", 800], ["drawers", 600]], talls: ["pantry"], top: { kind: "wood", mat: WAL } }) },
        { name: "Esmorzar", style: "Escandinau", materials: "fronts de roure, taulell de roure", colors: "roure natural, blanc", use: "Baixos amb pica petita i alts de porta", audience: "cases amb cuina tancada", price: 1690, make: () => kitchen({ mat: WHITE, front: OAKM, bases: [["sink", 600], ["drawers", 600]], walls: [["door", 600], ["door", 600]], top: { kind: "wood", mat: OAK } }) },
      ]),
    ],
  },
  {
    id: "dormitori",
    name: "Dormitori",
    types: [
      items("dormitori", "Llit", [
        { name: "Serena", style: "Japandi", materials: "roure xapat amb capçal ample", colors: "roure natural, lli", use: "Llit de 160 amb capçal que fa de tauletes", audience: "parelles", price: 1290, make: () => bed("Llit", { w: 1660, mat: OAK, head: "wide" }) },
        { name: "Estiba", style: "Contemporani", materials: "melamina gris amb calaixos als peus", colors: "gris, blanc", use: "Llit de 150 amb dos calaixos grans als peus", audience: "pisos petits", price: 890, make: () => bed("Llit", { w: 1560, mat: GREY, head: "low", footDrawers: true }) },
        { name: "Nit", style: "Modern luxe", materials: "noguera amb capçal alt i potes de ferro", colors: "noguera, negre", use: "Llit de 180 amb capçal de 1200", audience: "suites", price: 1690, make: () => bed("Llit", { w: 1860, mat: WAL, head: "tall", legsIron: true }) },
      ]),
      items("dormitori", "Capçal", [
        { name: "Panell", style: "Minimalista", materials: "roure xapat", colors: "roure natural", use: "Panell de paret amb prestatge", audience: "llits de 150–180", price: 390, make: () => loose([part({ name: "Capçal", orient: "front", material: OAK, w: 2000, h: 1100, thickness: 30, x: 0, y: 0, z: 0 }), part({ name: "Prestatge", orient: "flat", material: OAK, w: 2000, h: 150, thickness: 30, x: 0, y: 1100, z: 0 })]) },
        { name: "Suite", style: "Modern luxe", materials: "noguera penjada amb nínxols", colors: "noguera, negre", use: "Capçal penjat amb nínxols que fan de tauletes", audience: "suites", price: 890, make: () => one(box("Capçal", { w: 2600, h: 450, d: 320, mat: WAL, base: hung(600) }, v([500, "auto", 500], [drawers(1), panel(), drawers(1)]))) },
        { name: "Ona", style: "Organic modern", materials: "MDF lacat greige amb cantonades rodones", colors: "greige, terracota", use: "Capçal de forma suau", audience: "dormitoris de colors càlids", price: 340, make: () => loose([part({ name: "Capçal", orient: "front", material: GREIGE, w: 1800, h: 1000, thickness: 30, x: 0, y: 0, z: 0, shape: rounded(1800, 1000, 250) })]) },
      ]),
      items("dormitori", "Mesita de nit", [
        { name: "Flotant", style: "Minimalista", materials: "roure xapat penjat", colors: "roure natural, blanc", use: "Un calaix, penjada a la paret", audience: "dormitoris petits", price: 190, make: () => one(box("Mesita", { w: 450, h: 180, d: 350, mat: OAK, base: hung(450) }, drawers(1))) },
        { name: "Clàssica", style: "Contemporani", materials: "MDF lacat blanc", colors: "blanc, greige", use: "Dos calaixos sobre potes", audience: "tots els dormitoris", price: 240, make: () => one(box("Mesita", { w: 500, h: 450, d: 400, mat: LAC, base: legs(150) }, drawers(2))) },
        { name: "Bloc", style: "Modern luxe", materials: "noguera a inglet", colors: "noguera", use: "Calaix i nínxol obert, tot a inglet", audience: "suites", price: 320, make: () => one(box("Mesita", { w: 500, h: 500, d: 420, mat: WAL, base: onFloor, joint: "mitre" }, h(["auto", 180], [open(), drawers(1)]))) },
      ]),
      items("dormitori", "Còmoda", [
        { name: "Sis", style: "Escandinau", materials: "freixe", colors: "freixe, blanc", use: "Sis calaixos en dues columnes", audience: "dormitoris de matrimoni", price: 690, make: () => sideboard("Còmoda", { w: 1200, h: 850, d: 480, mat: ASH, base: legs(150) }, [["auto", drawers(3)], ["auto", drawers(3)]]) },
        { name: "Línia", style: "Modern luxe", materials: "noguera, calaixos a inglet", colors: "noguera", use: "Tres calaixos grans de punta a punta", audience: "suites", price: 890, make: () => one(box("Còmoda", { w: 1000, h: 800, d: 480, mat: WAL, base: onFloor, joint: "mitre" }, drawers(3))) },
        { name: "Blanca", style: "Minimalista", materials: "melamina blanca amb fronts encastats", colors: "blanc", use: "Quatre calaixos encastats", audience: "dormitoris juvenils i adults", price: 420, make: () => one(box("Còmoda", { w: 900, h: 850, d: 450, mat: WHITE, base: plinth(80, 30), inset: true }, drawers(4))) },
      ]),
      items("dormitori", "Sinfonier", [
        { name: "Torre", style: "Contemporani", materials: "MDF lacat antracita", colors: "antracita, blanc", use: "Sis calaixos alts i estrets", audience: "dormitoris petits", price: 520, make: () => one(box("Sinfonier", { w: 550, h: 1250, d: 450, mat: ANTH, base: plinth(80, 30) }, drawers(6))) },
        { name: "Roure", style: "Escandinau", materials: "roure xapat sobre potes", colors: "roure natural", use: "Cinc calaixos", audience: "dormitoris lluminosos", price: 590, make: () => one(box("Sinfonier", { w: 600, h: 1150, d: 450, mat: OAK, base: legs(150) }, drawers(5))) },
        { name: "Mixt", style: "Japandi", materials: "freixe i MDF lacat verd oliva", colors: "freixe, verd oliva", use: "Porta a dalt i calaixos a baix", audience: "dormitoris amb caràcter", price: 560, make: () => one(box("Sinfonier", { w: 600, h: 1300, d: 450, mat: ASH, front: OLIVE, base: plinth(60, 20) }, h([700, "auto"], [drawers(3), door("left", 1)]))) },
      ]),
      items("dormitori", "Armari", [
        { name: "Essencial", style: "Minimalista", materials: "melamina blanca", colors: "blanc", use: "Dos cossos: penjador llarg i calaixos amb prestatges", audience: "tots els dormitoris", price: 990, make: () => wardrobe("Armari", { bodies: ["hang", "drawers"], mat: WHITE }) },
        { name: "Vestidor", style: "Contemporani", materials: "melamina gris amb fronts de roure", colors: "roure natural, gris", use: "Tres cossos amb doble barra per a camises", audience: "parelles", price: 1690, make: () => wardrobe("Armari", { bodies: ["hang", "hang2", "drawers"], mat: GREY, front: OAKM }) },
        { name: "Nocturn", style: "Modern luxe", materials: "noguera amb fronts encastats", colors: "noguera, negre", use: "Tres cossos de portes encastades", audience: "suites", price: 2390, make: () => wardrobe("Armari", { bodies: ["hang", "shelves", "hang"], mat: WAL, inset: true, base: plinth(60, 20) }) },
      ]),
      items("dormitori", "Sabater", [
        { name: "Estret", style: "Minimalista", materials: "melamina blanca", colors: "blanc, gris", use: "Tres abatibles per a sabates, només 300 de fons", audience: "passadissos", price: 290, make: () => one(box("Sabater", { w: 800, h: 1100, d: 300, mat: WHITE, base: plinth(60, 20) }, h(auto(3), [flap("down", 1), flap("down", 1), flap("down", 1)]))) },
        { name: "Banc", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Sabater baix per seure a calçar-se", audience: "dormitoris i entrades", price: 340, make: () => one(box("Sabater", { w: 1000, h: 480, d: 380, mat: ASH, base: legs(100) }, v(auto(2), [open(1), open(1)]))) },
        { name: "Columna", style: "Contemporani", materials: "MDF lacat greige", colors: "greige, blanc", use: "Columna amb portes i sis prestatges", audience: "vestidors", price: 490, make: () => one(box("Sabater", { w: 600, h: 1800, d: 380, mat: GREIGE, base: plinth(80, 30) }, door("left", 6))) },
      ]),
      items("dormitori", "Banc de llit", [
        { name: "Peus", style: "Japandi", materials: "roure a inglet", colors: "roure natural", use: "Banc per als peus del llit", audience: "dormitoris de matrimoni", price: 320, make: () => waterfall("Banc", { w: 1400, h: 450, d: 400, mat: OAK }) },
        { name: "Bagul", style: "Contemporani", materials: "MDF lacat blau fosc amb abatible", colors: "blau fosc, greige", use: "Banc bagul amb tapa abatible per a les mantes", audience: "dormitoris amb poc armari", price: 460, make: () => one(box("Bagul", { w: 1200, h: 450, d: 420, mat: NAVY, base: plinth(60, 20) }, flap("up"))) },
        { name: "Ferro", style: "Industrial elegant", materials: "noguera sobre ferro", colors: "noguera, negre", use: "Seient sobre potes de ferro", audience: "lofts", price: 290, make: () => legTable("Banc", { w: 1300, h: 450, d: 380, mat: WAL, legs: "post" }) },
      ]),
      items("dormitori", "Tocador", [
        { name: "Mirall", style: "Contemporani", materials: "MDF lacat blanc", colors: "blanc, greige", use: "Tocador amb calaix central i dos laterals", audience: "dormitoris amplis", price: 540, make: () => desk("Tocador", { w: 1100, d: 450, mat: LAC, side: "cabinet", drawersW: 350, drawerN: 2 }) },
        { name: "Penjat", style: "Minimalista", materials: "roure xapat penjat", colors: "roure natural", use: "Tocador flotant amb un calaix", audience: "dormitoris petits", price: 290, make: () => one(box("Tocador", { w: 1000, h: 160, d: 400, mat: OAK, base: hung(760) }, drawers(1))) },
        { name: "Belle", style: "Modern luxe", materials: "noguera sobre potes de ferro", colors: "noguera, negre", use: "Tocador amb calaixera i pota de ferro", audience: "suites", price: 620, make: () => desk("Tocador", { w: 1100, d: 450, mat: WAL, side: "iron", drawersW: 400, drawerN: 3 }) },
      ]),
    ],
  },
  {
    id: "juvenil",
    name: "Dormitori juvenil i infantil",
    types: [
      items("juvenil", "Llit individual", [
        { name: "Estudi", style: "Escandinau", materials: "melamina blanca amb capçal de roure", colors: "blanc, roure", use: "Llit de 90 arrambat a la paret, amb tres calaixos", audience: "infants i joves", price: 590, make: () => singleBed("Llit", { mat: WHITE, front: OAKM, drawers: 3, head: true }) },
        { name: "Color", style: "Contemporani", materials: "MDF lacat verd oliva", colors: "verd oliva, terracota, blau fosc", use: "Llit de 90 amb dos calaixos grans", audience: "joves", price: 520, make: () => singleBed("Llit", { mat: OLIVE, drawers: 2 }) },
        { name: "Nido", style: "Minimalista", materials: "roure xapat", colors: "roure natural", use: "Llit de 90 amb capçal i respatller", audience: "infants", price: 640, make: () => singleBed("Llit", { mat: OAK, drawers: 2, head: true }) },
      ]),
      items("juvenil", "Lliteres", [
        { name: "Cabana", style: "Contemporani", materials: "noguera amb parets buides", colors: "noguera, blanc", use: "Lliteres encastades amb escala de graons", audience: "germans", price: 2490, make: () => bunk("Lliteres", { mat: WAL, hollow: 50, stairs: true }) },
        { name: "Nit", style: "Escandinau", materials: "freixe", colors: "freixe, blanc", use: "Lliteres amb calaixos a baix i escala", audience: "habitacions compartides", price: 1890, make: () => bunk("Lliteres", { mat: ASH, drawers: true, stairs: true }) },
        { name: "Refugi", style: "Minimalista", materials: "melamina blanca", colors: "blanc", use: "Lliteres senzilles de tauler", audience: "cases d'estiueig", price: 1190, make: () => bunk("Lliteres", { mat: WHITE, stairs: false }) },
      ]),
      items("juvenil", "Llit compacte", [
        { name: "Niu", style: "Contemporani", materials: "melamina blanca amb fronts roure", colors: "blanc, roure", use: "Llit alt amb llit niu de sota i calaix", audience: "habitacions petites", price: 790, make: () => singleBed("Llit compacte", { mat: WHITE, front: OAKM, drawers: 2, trundle: true, head: true }) },
        { name: "Tren", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Base amb tres calaixos grans", audience: "infants", price: 690, make: () => singleBed("Llit compacte", { mat: ASH, drawers: 3 }) },
        { name: "Urban", style: "Industrial elegant", materials: "MDF lacat antracita", colors: "antracita, roure", use: "Base amb calaixos i capçal lateral", audience: "joves", price: 720, make: () => singleBed("Llit compacte", { mat: ANTH, drawers: 3, head: true }) },
      ]),
      items("juvenil", "Escriptori", [
        { name: "Deures", style: "Escandinau", materials: "melamina blanca i roure", colors: "blanc, roure", use: "Escriptori de 1200 amb calaixera i lateral", audience: "estudiants", price: 390, make: () => desk("Escriptori", { w: 1200, d: 600, mat: WHITE, front: OAKM, side: "panel" }) },
        { name: "Doble", style: "Contemporani", materials: "melamina gris", colors: "gris, blanc", use: "Escriptori de 1600 per a dos amb calaixera i armariet", audience: "germans", price: 520, make: () => desk("Escriptori", { w: 1600, d: 600, mat: GREY, side: "cabinet" }) },
        { name: "Taller", style: "Industrial elegant", materials: "roure sobre ferro", colors: "roure natural, negre", use: "Calaixera i pota de ferro", audience: "joves creatius", price: 460, make: () => desk("Escriptori", { w: 1300, d: 650, mat: OAK, side: "iron" }) },
      ]),
      items("juvenil", "Armari", [
        { name: "Petit", style: "Escandinau", materials: "melamina blanca amb fronts de roure", colors: "blanc, roure", use: "Un cos de penjador i un de calaixos", audience: "infants", price: 790, make: () => wardrobe("Armari", { bodies: ["hang", "drawers"], mat: WHITE, front: OAKM, h: 2000 }) },
        { name: "Color", style: "Contemporani", materials: "MDF lacat blau fosc", colors: "blau fosc, blanc", use: "Dos cossos de penjador", audience: "joves", price: 890, make: () => wardrobe("Armari", { bodies: ["hang", "hang"], mat: NAVY, h: 2000 }) },
        { name: "Estanteria", style: "Minimalista", materials: "melamina gris", colors: "gris", use: "Prestatges i doble barra", audience: "habitacions compartides", price: 940, make: () => wardrobe("Armari", { bodies: ["shelves", "hang2"], mat: GREY, h: 2000 }) },
      ]),
      items("juvenil", "Còmoda", [
        { name: "Joc", style: "Contemporani", materials: "MDF lacat terracota i blanc", colors: "terracota, blanc", use: "Quatre calaixos de colors", audience: "infants", price: 390, make: () => one(box("Còmoda", { w: 800, h: 850, d: 450, mat: WHITE, front: TERRA, base: legs(120) }, drawers(4))) },
        { name: "Canviador", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Tres calaixos amples (ara canviador, després còmoda)", audience: "nadons", price: 460, make: () => one(box("Còmoda", { w: 1000, h: 900, d: 520, mat: ASH, base: plinth(80, 30) }, drawers(3))) },
        { name: "Mixta", style: "Minimalista", materials: "melamina blanca", colors: "blanc", use: "Calaixos i porta", audience: "juvenils", price: 360, make: () => sideboard("Còmoda", { w: 1000, h: 850, d: 450, mat: WHITE, base: plinth(60, 20) }, [["auto", drawers(3)], ["auto", door("right", 2)]]) },
      ]),
      items("juvenil", "Prestatgeria", [
        { name: "Cubs", style: "Modular", materials: "melamina blanca", colors: "blanc, roure", use: "Nou cubs oberts (3 × 3)", audience: "joguines i llibres", price: 290, make: () => one(box("Prestatgeria", { w: 1150, h: 1150, d: 350, mat: WHITE, base: onFloor }, v(auto(3), [0, 1, 2].map(() => h(auto(3), [open(), open(), open()]))))) },
        { name: "Paret", style: "Contemporani", materials: "roure xapat penjat", colors: "roure natural", use: "Prestatgeria penjada sobre l'escriptori", audience: "estudiants", price: 240, make: () => one(box("Prestatgeria", { w: 1200, h: 350, d: 250, mat: OAK, base: hung(1200) }, v(auto(3), [open(), open(), open()]))) },
        { name: "Alta", style: "Escandinau", materials: "freixe", colors: "freixe, blanc", use: "Dues columnes amb calaixos a baix", audience: "juvenils", price: 590, make: () => bookcase("Prestatgeria", { cols: 2, colW: 600, h: 1800, d: 350, mat: ASH, lower: "drawers", shelves: 2 }) },
      ]),
      items("juvenil", "Moble auxiliar", [
        { name: "Joguines", style: "Contemporani", materials: "MDF lacat verd oliva amb abatible", colors: "verd oliva, blanc", use: "Caixa per a joguines amb tapa", audience: "infants", price: 260, make: () => one(box("Joguinera", { w: 800, h: 450, d: 450, mat: OLIVE, base: plinth(60, 20) }, flap("up"))) },
        { name: "Nit", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Tauleta de nit amb calaix i nínxol", audience: "infants", price: 160, make: () => one(box("Tauleta", { w: 400, h: 450, d: 350, mat: ASH, base: legs(120) }, h(["auto", 150], [open(), drawers(1)]))) },
        { name: "Racó", style: "Minimalista", materials: "melamina blanca", colors: "blanc", use: "Armariet baix amb porta", audience: "juvenils", price: 180, make: () => one(box("Armariet", { w: 500, h: 700, d: 400, mat: WHITE, base: plinth(60, 20) }, door("left", 1))) },
      ]),
    ],
  },
  {
    id: "despatx",
    name: "Despatx / oficina",
    types: [
      items("despatx", "Escriptori", [
        { name: "Directiu", style: "Modern luxe", materials: "noguera amb calaixera i lateral de 30", colors: "noguera, negre", use: "Escriptori de 1800 × 800", audience: "despatxos de direcció", price: 1190, make: () => desk("Escriptori", { w: 1800, d: 800, mat: WAL, side: "panel" }) },
        { name: "Home office", style: "Escandinau", materials: "roure sobre ferro", colors: "roure natural, negre", use: "Escriptori de 1400 amb calaixera", audience: "teletreball", price: 590, make: () => desk("Escriptori", { w: 1400, d: 700, mat: OAK, side: "iron" }) },
        { name: "Flotant", style: "Minimalista", materials: "MDF lacat penjat", colors: "blanc, antracita", use: "Escriptori penjat amb dos calaixos", audience: "pisos petits", price: 420, make: () => one(box("Escriptori", { w: 1200, h: 180, d: 550, mat: LAC, base: hung(570) }, v(auto(2), [drawers(1), drawers(1)]))) },
      ]),
      items("despatx", "Taula de treball", [
        { name: "Bench", style: "Industrial elegant", materials: "melamina roure sobre ferro", colors: "roure, negre", use: "Taula compartida de 2400 per a quatre llocs", audience: "oficines", price: 890, make: () => legTable("Taula", { w: 2400, h: 740, d: 1200, mat: OAKM, legs: "sled", t: 30 }) },
        { name: "Taller", style: "Contemporani", materials: "melamina gris a inglet", colors: "gris, blanc", use: "Taula de 1600 × 800 de panells", audience: "estudis creatius", price: 590, make: () => waterfall("Taula", { w: 1600, h: 740, d: 800, mat: GREY }) },
        { name: "Estudi", style: "Escandinau", materials: "freixe amb potes de tauler", colors: "freixe", use: "Taula de cavallets de 1800", audience: "arquitectes i dissenyadors", price: 690, make: () => legTable("Taula", { w: 1800, h: 740, d: 800, mat: ASH, legs: "trestle" }) },
      ]),
      items("despatx", "Calaixera", [
        { name: "Rodant", style: "Contemporani", materials: "melamina blanca", colors: "blanc, gris", use: "Tres calaixos sota l'escriptori", audience: "oficines", price: 240, make: () => one(box("Calaixera", { w: 420, h: 600, d: 550, mat: WHITE, base: legs(60) }, drawers(3))) },
        { name: "Arxiu", style: "Minimalista", materials: "MDF lacat antracita", colors: "antracita", use: "Dos calaixos alts per a arxiu", audience: "despatxos", price: 320, make: () => one(box("Calaixera", { w: 450, h: 720, d: 600, mat: ANTH, base: plinth(60, 20) }, drawers(2))) },
        { name: "Alta", style: "Escandinau", materials: "roure xapat", colors: "roure natural", use: "Cinc calaixos", audience: "estudis", price: 390, make: () => one(box("Calaixera", { w: 450, h: 1000, d: 500, mat: OAK, base: plinth(60, 20) }, drawers(5))) },
      ]),
      items("despatx", "Armari", [
        { name: "Arxiu", style: "Contemporani", materials: "melamina gris amb portes", colors: "gris, blanc", use: "Dos cossos de prestatges amb portes", audience: "oficines", price: 890, make: () => row([0, 1].map((i) => box(`Armari ${i + 1}`, { w: 800, h: 2000, d: 450, mat: GREY, base: plinth(80, 30) }, doors(4)))) },
        { name: "Mixt", style: "Minimalista", materials: "melamina blanca", colors: "blanc", use: "Portes a baix i prestatges oberts a dalt", audience: "despatxos", price: 690, make: () => bookcase("Armari", { cols: 2, colW: 800, h: 2000, d: 450, mat: WHITE, lower: "doors", shelves: 3 }) },
        { name: "Direcció", style: "Modern luxe", materials: "noguera amb fronts encastats", colors: "noguera", use: "Armari baix amb portes encastades", audience: "direcció", price: 1190, make: () => sideboard("Armari", { w: 1600, h: 800, d: 480, mat: WAL, base: plinth(60, 20), inset: true }, [["auto", doors(1)], ["auto", doors(1)]]) },
      ]),
      items("despatx", "Prestatgeria", [
        { name: "Industrial", style: "Industrial elegant", materials: "roure i ferro", colors: "roure, negre", use: "Prestatgeria oberta sense fons", audience: "lofts i estudis", price: 590, make: () => bookcase("Prestatgeria", { cols: 2, colW: 800, h: 1900, d: 380, mat: OAK, shelves: 4, lower: "none", back: "none", base: onFloor }) },
        { name: "Mur", style: "Modular", materials: "melamina blanca", colors: "blanc", use: "Cinc columnes de paret a paret", audience: "despatxos", price: 890, make: () => bookcase("Prestatgeria", { cols: 5, colW: 600, h: 2000, d: 330, mat: WHITE, shelves: 4, lower: "none" }) },
        { name: "Baixa", style: "Contemporani", materials: "melamina gris", colors: "gris", use: "Prestatgeria baixa de 3 cossos", audience: "sales de reunió", price: 490, make: () => bookcase("Prestatgeria", { cols: 3, colW: 800, h: 800, d: 400, mat: GREY, shelves: 1, lower: "none" }) },
      ]),
      items("despatx", "Llibreria", [
        { name: "Bufet", style: "Clàssic modern", materials: "noguera", colors: "noguera", use: "Llibreria de despatx amb portes a baix", audience: "advocats i notaries", price: 1690, make: () => bookcase("Llibreria", { cols: 3, colW: 800, h: 2200, d: 400, mat: WAL, lower: "doors", shelves: 4 }) },
        { name: "Blanca", style: "Minimalista", materials: "MDF lacat blanc", colors: "blanc", use: "Dues columnes amb calaixos", audience: "estudis", price: 890, make: () => bookcase("Llibreria", { cols: 2, colW: 800, h: 2100, d: 380, mat: LAC, lower: "drawers", shelves: 3 }) },
        { name: "Gruixuda", style: "Modern luxe", materials: "parets buides de 50 en greige", colors: "greige", use: "Llibreria de parets gruixudes", audience: "despatxos de disseny", price: 1490, make: () => bookcase("Llibreria", { cols: 2, colW: 800, h: 2100, d: 380, mat: GREIGE, lower: "none", shelves: 4, hollow: 50, base: onFloor }) },
      ]),
      items("despatx", "Taula de reunió", [
        { name: "Consell", style: "Modern luxe", materials: "noguera a inglet", colors: "noguera", use: "Taula de 2800 × 1100 per a 10", audience: "sales de juntes", price: 2290, make: () => waterfall("Taula", { w: 2800, h: 740, d: 1100, mat: WAL }) },
        { name: "Rodona", style: "Contemporani", materials: "roure sobre peu central", colors: "roure, negre", use: "Taula rodona de 1200 per a 4", audience: "despatxos", price: 890, make: () => legTable("Taula", { w: 1200, h: 740, d: 1200, mat: OAK, legs: "pedestal", shape: oval(1200, 1200) }) },
        { name: "Oval", style: "Organic modern", materials: "melamina roure sobre ferro", colors: "roure, negre", use: "Taula oval de 2400 per a 8", audience: "oficines", price: 1390, make: () => legTable("Taula", { w: 2400, h: 740, d: 1100, mat: OAKM, legs: "round", shape: oval(2400, 1100) }) },
      ]),
      items("despatx", "Moble auxiliar", [
        { name: "Impressora", style: "Minimalista", materials: "melamina gris", colors: "gris", use: "Moble baix amb nínxol per a la impressora i calaixos", audience: "oficines", price: 320, make: () => sideboard("Auxiliar", { w: 900, h: 700, d: 500, mat: GREY, base: legs(60) }, [["auto", open()], [420, drawers(3)]]) },
        { name: "Cafè", style: "Contemporani", materials: "MDF lacat antracita amb pedra", colors: "antracita, marbre", use: "Moble de cafè amb portes i taulell de pedra", audience: "sales d'espera", price: 690, make: () => one(box("Cafè", { w: 1200, h: 880, d: 500, mat: ANTH, base: plinth(80, 30), top: { kind: "none" } }, v(auto(2), [doors(1), doors(1)])), { parts: [stoneTop(0, 1200, 520, 880)] }) },
        { name: "Credença", style: "Modern luxe", materials: "noguera sobre ferro", colors: "noguera, negre", use: "Credença baixa amb portes", audience: "direcció", price: 990, make: () => sideboard("Credença", { w: 1600, h: 600, d: 450, mat: WAL, base: legs(150) }, [["auto", doors(1)], ["auto", doors(1)]], (o) => ironLegs(0, o.w, 0, o.d, 150, "post")) },
      ]),
    ],
  },
  {
    id: "entrada",
    name: "Entrada",
    types: [
      items("entrada", "Consola", [
        { name: "Fina", style: "Minimalista", materials: "roure xapat penjat", colors: "roure natural", use: "Consola penjada amb un calaix", audience: "rebedors estrets", price: 260, make: () => one(box("Consola", { w: 1000, h: 150, d: 300, mat: OAK, base: hung(850) }, drawers(1))) },
        { name: "Marbre", style: "Modern luxe", materials: "pedra sobre potes de ferro", colors: "marbre, negre", use: "Tauler de pedra sobre potes de ferro", audience: "entrades amples", price: 590, make: () => legTable("Consola", { w: 1200, h: 800, d: 350, mat: STONE, legs: "post", stone: true }) },
        { name: "Ona", style: "Organic modern", materials: "MDF lacat terracota a inglet", colors: "terracota, greige", use: "Consola waterfall de color", audience: "entrades amb caràcter", price: 390, make: () => waterfall("Consola", { w: 1100, h: 800, d: 320, mat: TERRA, t: 30 }) },
      ]),
      items("entrada", "Sabater", [
        { name: "Pas", style: "Minimalista", materials: "melamina blanca", colors: "blanc, gris", use: "Sabater de 250 de fons amb dos abatibles", audience: "passadissos estrets", price: 240, make: () => one(box("Sabater", { w: 800, h: 850, d: 250, mat: WHITE, base: plinth(60, 20) }, h(auto(2), [flap("down", 1), flap("down", 1)]))) },
        { name: "Bancal", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Banc sabater obert", audience: "famílies", price: 320, make: () => one(box("Sabater", { w: 1100, h: 480, d: 380, mat: ASH, base: legs(100) }, v(auto(3), [open(1), open(1), open(1)]))) },
        { name: "Penjat", style: "Contemporani", materials: "MDF lacat antracita", colors: "antracita, roure", use: "Sabater penjat amb portes", audience: "pisos moderns", price: 360, make: () => one(box("Sabater", { w: 1000, h: 600, d: 350, mat: ANTH, base: hung(250) }, v(auto(2), [door("left", 2), door("right", 2)]))) },
      ]),
      items("entrada", "Penjador", [
        { name: "Rebedor", style: "Escandinau", materials: "roure xapat", colors: "roure natural", use: "Penjador obert amb barra, prestatge de dalt i banc", audience: "entrades", price: 490, make: () => one(box("Penjador", { w: 800, h: 1900, d: 380, mat: OAK, base: onFloor }, h([450, "auto", 250], [open(1), rail(), open()]))) },
        { name: "Negre", style: "Industrial elegant", materials: "melamina negra", colors: "negre", use: "Penjador amb barra i calaixos a baix", audience: "lofts", price: 520, make: () => one(box("Penjador", { w: 800, h: 1900, d: 380, mat: BLACK, base: onFloor }, h([500, "auto", 250], [drawers(2), rail(), open()]))) },
        { name: "Duo", style: "Contemporani", materials: "melamina blanca", colors: "blanc, roure", use: "Penjador obert i armari de porta", audience: "famílies", price: 640, make: () => row([box("Penjador", { w: 800, h: 1900, d: 380, mat: WHITE, base: onFloor }, h([450, "auto", 250], [open(1), rail(), open()])), box("Armari", { w: 500, h: 1900, d: 380, mat: WHITE, base: onFloor }, door("right", 5))]) },
      ]),
      items("entrada", "Banc", [
        { name: "Seient", style: "Minimalista", materials: "roure a inglet", colors: "roure natural", use: "Banc d'entrada de panells", audience: "rebedors", price: 290, make: () => waterfall("Banc", { w: 1200, h: 450, d: 380, mat: OAK }) },
        { name: "Calaix", style: "Contemporani", materials: "MDF lacat greige", colors: "greige, blanc", use: "Banc amb calaixos per a guants i bufandes", audience: "famílies", price: 390, make: () => sideboard("Banc", { w: 1200, h: 450, d: 400, mat: GREIGE, base: plinth(60, 20) }, [["auto", drawers(1)], ["auto", drawers(1)]]) },
        { name: "Ferro", style: "Industrial elegant", materials: "noguera sobre ferro", colors: "noguera, negre", use: "Banc amb prestatge per a sabates", audience: "lofts", price: 340, make: () => sideboard("Banc", { w: 1200, h: 280, d: 380, mat: WAL, base: legs(170), back: "none" }, [["auto", open()]], (o) => ironLegs(0, o.w, 0, o.d, 170, "post")) },
      ]),
      items("entrada", "Moble d'entrada", [
        { name: "Rebuda", style: "Contemporani", materials: "melamina roure amb portes lacades", colors: "roure, blanc", use: "Moble d'entrada amb portes i calaixos", audience: "pisos", price: 590, make: () => sideboard("Entrada", { w: 1200, h: 900, d: 400, mat: OAKM, front: LAC, base: plinth(60, 20) }, [["auto", doors(1)], [400, drawers(3)]]) },
        { name: "Flotant", style: "Minimalista", materials: "noguera penjada", colors: "noguera", use: "Moble d'entrada penjat amb calaixos a inglet", audience: "pisos moderns", price: 490, make: () => one(box("Entrada", { w: 1200, h: 330, d: 380, mat: WAL, base: hung(500), joint: "mitre" }, v(auto(2), [drawers(1), drawers(1)]))) },
        { name: "Alt", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Columna d'entrada amb portes i calaixos", audience: "entrades estretes", price: 690, make: () => one(box("Entrada", { w: 600, h: 1800, d: 380, mat: ASH, base: plinth(60, 20) }, h([500, "auto"], [drawers(2), door("left", 3)]))) },
      ]),
    ],
  },
  {
    id: "emmagatzematge",
    name: "Emmagatzematge",
    types: [
      items("emmagatzematge", "Armari", [
        { name: "Bàsic", style: "Minimalista", materials: "melamina blanca", colors: "blanc", use: "Armari de dues portes amb prestatges", audience: "trasters i dormitoris", price: 490, make: () => wardrobe("Armari", { bodies: ["shelves"], mat: WHITE }) },
        { name: "Rebost", style: "Contemporani", materials: "melamina gris", colors: "gris, blanc", use: "Armari de rebost de dos cossos", audience: "cuines i safarejos", price: 790, make: () => wardrobe("Armari", { bodies: ["shelves", "shelves"], mat: GREY, d: 450 }) },
        { name: "Penjador", style: "Escandinau", materials: "melamina blanca amb fronts de roure", colors: "blanc, roure", use: "Penjador amb maleter", audience: "habitacions d'hostes", price: 590, make: () => wardrobe("Armari", { bodies: ["hang"], mat: WHITE, front: OAKM }) },
      ]),
      items("emmagatzematge", "Llibreria", [
        { name: "Arxiu", style: "Contemporani", materials: "melamina gris", colors: "gris", use: "Llibreria amb portes a baix", audience: "trasters i despatxos", price: 590, make: () => bookcase("Llibreria", { cols: 2, colW: 800, h: 2000, d: 380, mat: GREY, lower: "doors", shelves: 3 }) },
        { name: "Pilar", style: "Minimalista", materials: "melamina blanca", colors: "blanc", use: "Llibreria estreta de 600", audience: "racons", price: 240, make: () => bookcase("Llibreria", { cols: 1, colW: 600, h: 2000, d: 330, mat: WHITE, lower: "none", shelves: 5 }) },
        { name: "Noguera", style: "Modern luxe", materials: "noguera", colors: "noguera", use: "Llibreria de tres cossos", audience: "salons", price: 1390, make: () => bookcase("Llibreria", { cols: 3, colW: 700, h: 2100, d: 350, mat: WAL, lower: "none", shelves: 4 }) },
      ]),
      items("emmagatzematge", "Prestatgeria", [
        { name: "Traster", style: "Funcional", materials: "melamina blanca", colors: "blanc", use: "Prestatgeria de 5 prestatges", audience: "trasters i garatges", price: 190, make: () => bookcase("Prestatgeria", { cols: 1, colW: 800, h: 1900, d: 450, mat: WHITE, lower: "none", shelves: 4, base: onFloor }) },
        { name: "Doble", style: "Modular", materials: "melamina gris", colors: "gris", use: "Dos cossos de prestatges fondos", audience: "rebosts", price: 340, make: () => bookcase("Prestatgeria", { cols: 2, colW: 800, h: 1900, d: 500, mat: GREY, lower: "none", shelves: 4, base: onFloor }) },
        { name: "Cubs", style: "Modular", materials: "roure xapat", colors: "roure natural", use: "Cubs oberts de 2 × 4", audience: "salons i estudis", price: 490, make: () => one(box("Prestatgeria", { w: 780, h: 1520, d: 380, mat: OAK, base: onFloor }, v(auto(2), [0, 1].map(() => h(auto(4), [open(), open(), open(), open()]))))) },
      ]),
      items("emmagatzematge", "Vitrina", [
        { name: "Exposició", style: "Contemporani", materials: "melamina blanca amb vidre", colors: "blanc", use: "Vitrina de prestatges de vidre", audience: "botigues i col·leccions", price: 590, make: () => one(box("Vitrina", { w: 800, h: 1800, d: 400, mat: WHITE, base: plinth(60, 20) }, h([400, "auto"], [drawers(1), open()])), { parts: [900, 1250, 1550].map((y) => glassShelf(19, 762, 360, y)) }) },
        { name: "Baixa", style: "Minimalista", materials: "roure xapat amb vidre", colors: "roure natural", use: "Vitrina baixa amb prestatge de vidre", audience: "salons", price: 490, make: () => one(box("Vitrina", { w: 1200, h: 800, d: 400, mat: OAK, base: legs(150) }, v(auto(2), [open(), open()])), { parts: [glassShelf(19, 572, 360, 150 + 400), glassShelf(19 + 572 + 19, 572, 360, 150 + 400)] }) },
        { name: "Torre", style: "Modern luxe", materials: "noguera", colors: "noguera, negre", use: "Vitrina alta estreta amb calaixos", audience: "salons elegants", price: 690, make: () => one(box("Vitrina", { w: 500, h: 2000, d: 400, mat: WAL, base: plinth(60, 20) }, h([500, "auto"], [drawers(2), open(4)]))) },
      ]),
      items("emmagatzematge", "Còmoda", [
        { name: "Gran", style: "Contemporani", materials: "melamina roure", colors: "roure", use: "Còmoda de vuit calaixos", audience: "dormitoris", price: 590, make: () => sideboard("Còmoda", { w: 1400, h: 850, d: 480, mat: OAKM, base: plinth(60, 20) }, [["auto", drawers(4)], ["auto", drawers(4)]]) },
        { name: "Llisa", style: "Minimalista", materials: "MDF lacat blanc", colors: "blanc", use: "Còmoda de tres calaixos", audience: "tots els dormitoris", price: 390, make: () => one(box("Còmoda", { w: 900, h: 750, d: 450, mat: LAC, base: legs(120) }, drawers(3))) },
        { name: "Olivera", style: "Mediterrani contemporani", materials: "MDF lacat verd oliva", colors: "verd oliva, terracota", use: "Còmoda de calaixos amb porta", audience: "cases de colors", price: 560, make: () => sideboard("Còmoda", { w: 1200, h: 850, d: 450, mat: OLIVE, base: plinth(60, 20) }, [["auto", drawers(3)], ["auto", doors(1)]]) },
      ]),
      items("emmagatzematge", "Calaixera", [
        { name: "Deu", style: "Funcional", materials: "melamina blanca", colors: "blanc", use: "Calaixera de deu calaixos petits", audience: "tallers i manualitats", price: 390, make: () => sideboard("Calaixera", { w: 800, h: 1000, d: 450, mat: WHITE, base: plinth(60, 20) }, [["auto", drawers(5)], ["auto", drawers(5)]]) },
        { name: "Plans", style: "Contemporani", materials: "melamina gris", colors: "gris", use: "Calaixera baixa de calaixos amples per a plànols", audience: "arquitectes", price: 690, make: () => one(box("Calaixera", { w: 1200, h: 700, d: 800, mat: GREY, base: plinth(60, 20) }, drawers(4))) },
        { name: "Torre", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Calaixera alta de sis calaixos", audience: "dormitoris", price: 520, make: () => one(box("Calaixera", { w: 500, h: 1200, d: 450, mat: ASH, base: legs(120) }, drawers(6))) },
      ]),
      items("emmagatzematge", "Moble modular", [
        { name: "Sistema", style: "Modular", materials: "melamina blanca amb fronts lacats", colors: "blanc, greige", use: "Tres mòduls baixos combinables i dos penjats", audience: "salons i despatxos", price: 1290, make: () => row([box("Baix 1", { w: 800, h: 720, d: 450, mat: WHITE, front: GREIGE, base: plinth(80, 30) }, doors(1)), box("Baix 2", { w: 800, h: 720, d: 450, mat: WHITE, front: GREIGE, base: plinth(80, 30) }, drawers(3)), box("Baix 3", { w: 800, h: 720, d: 450, mat: WHITE, front: GREIGE, base: plinth(80, 30) }, doors(1)), box("Alt 1", { w: 800, h: 400, d: 300, mat: WHITE, front: GREIGE, base: hung(1400) }, flap("up")), box("Alt 2", { w: 800, h: 400, d: 300, mat: WHITE, front: GREIGE, base: hung(1400), gapBefore: 800 }, flap("up"))]) },
        { name: "Paret", style: "Contemporani", materials: "roure xapat i antracita", colors: "roure, antracita", use: "Composició de paret amb vitrina central", audience: "salons", price: 1890, make: () => row([box("Columna", { w: 600, h: 2000, d: 400, mat: OAK, front: ANTH, base: plinth(60, 20) }, door("left", 4)), box("Baix", { w: 1200, h: 600, d: 450, mat: OAK, front: ANTH, base: plinth(60, 20) }, v(auto(2), [drawers(2), drawers(2)])), box("Columna", { w: 600, h: 2000, d: 400, mat: OAK, front: ANTH, base: plinth(60, 20) }, door("right", 4))]) },
        { name: "Cubs", style: "Modular", materials: "MDF lacat de colors", colors: "terracota, verd oliva, blau fosc", use: "Cubs apilables de 400 amb porta o calaix", audience: "joves", price: 690, make: () => row([TERRA, OLIVE, NAVY].map((c, i) => box(`Cub ${i + 1}`, { w: 400, h: 400, d: 380, mat: c, base: onFloor, joint: "mitre" }, i === 1 ? drawers(1) : door(i ? "right" : "left", 0)))) },
      ]),
      items("emmagatzematge", "Moble auxiliar", [
        { name: "Safareig", style: "Funcional", materials: "melamina blanca", colors: "blanc", use: "Moble alt de safareig amb portes", audience: "safarejos", price: 390, make: () => one(box("Safareig", { w: 600, h: 1800, d: 450, mat: WHITE, base: plinth(60, 20) }, door("left", 4))) },
        { name: "Estreta", style: "Minimalista", materials: "melamina gris", colors: "gris", use: "Columna estreta de 300 per a racons", audience: "cuines i banys", price: 190, make: () => one(box("Columna", { w: 300, h: 1600, d: 400, mat: GREY, base: plinth(60, 20) }, door("left", 4))) },
        { name: "Arcó", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Moble baix de dues portes batents sobre potes", audience: "salons", price: 420, make: () => one(box("Auxiliar", { w: 800, h: 600, d: 400, mat: ASH, base: legs(150) }, doors(1))) },
      ]),
    ],
  },
  {
    id: "bany",
    name: "Bany",
    types: [
      items("bany", "Moble de bany", [
        { name: "Pedra", style: "Contemporani", materials: "freixe amb taulell de pedra", colors: "freixe, marbre", use: "Moble de lavabo a terra amb calaixos", audience: "banys familiars", price: 890, make: () => one(box("Lavabo", { w: 1000, h: 830, d: 480, mat: ASH, base: plinth(80, 30), top: { kind: "none" } }, v(auto(2), [drawers(2), drawers(2)])), { parts: [stoneTop(0, 1000, 500, 830)] }) },
        { name: "Doble", style: "Modern luxe", materials: "noguera amb pedra", colors: "noguera, marbre", use: "Moble de dues piques amb quatre calaixos", audience: "banys de suite", price: 1490, make: () => one(box("Lavabo", { w: 1600, h: 830, d: 500, mat: WAL, base: plinth(80, 30), top: { kind: "none" } }, v(auto(4), [drawers(2), drawers(2), drawers(2), drawers(2)])), { parts: [stoneTop(0, 1600, 520, 830)] }) },
        { name: "Blanc", style: "Minimalista", materials: "MDF lacat blanc", colors: "blanc", use: "Moble de lavabo de dues portes", audience: "banys petits", price: 490, make: () => one(box("Lavabo", { w: 800, h: 850, d: 450, mat: LAC, base: legs(150), top: { kind: "none" } }, doors(1)), { parts: [stoneTop(0, 800, 470, 850)] }) },
      ]),
      items("bany", "Moble suspès", [
        { name: "Flotant", style: "Minimalista", materials: "freixe amb fronts encastats", colors: "freixe", use: "Moble penjat de dos calaixos encastats", audience: "banys moderns", price: 690, make: () => one(box("Lavabo", { w: 1000, h: 450, d: 470, mat: ASH, base: hung(400), top: { kind: "none" }, inset: true }, v(auto(2), [drawers(2), drawers(2)])), { parts: [stoneTop(0, 1000, 490, 850)] }) },
        { name: "Pissarra", style: "Industrial elegant", materials: "MDF lacat antracita", colors: "antracita, pedra", use: "Moble penjat d'un calaix gran", audience: "lofts", price: 590, make: () => one(box("Lavabo", { w: 900, h: 400, d: 460, mat: ANTH, base: hung(450), top: { kind: "none" } }, drawers(1)), { parts: [stoneTop(0, 900, 480, 850)] }) },
        { name: "Roure", style: "Escandinau", materials: "roure xapat", colors: "roure natural, blanc", use: "Moble penjat amb nínxol obert", audience: "banys lluminosos", price: 640, make: () => one(box("Lavabo", { w: 1000, h: 500, d: 460, mat: OAK, base: hung(350), top: { kind: "none" } }, h(["auto", 250], [open(), drawers(1)])), { parts: [stoneTop(0, 1000, 480, 850)] }) },
      ]),
      items("bany", "Columna", [
        { name: "Alta", style: "Minimalista", materials: "MDF lacat blanc", colors: "blanc", use: "Columna penjada amb porta", audience: "banys", price: 390, make: () => one(box("Columna", { w: 350, h: 1500, d: 300, mat: LAC, base: hung(300) }, door("left", 4))) },
        { name: "Roba", style: "Contemporani", materials: "freixe", colors: "freixe", use: "Columna a terra amb calaixos i porta", audience: "banys familiars", price: 490, make: () => one(box("Columna", { w: 400, h: 1700, d: 350, mat: ASH, base: plinth(60, 20) }, h([450, "auto"], [drawers(2), door("right", 3)]))) },
        { name: "Nínxol", style: "Modern luxe", materials: "noguera", colors: "noguera", use: "Columna amb nínxol obert al mig", audience: "suites", price: 560, make: () => one(box("Columna", { w: 400, h: 1600, d: 320, mat: WAL, base: hung(300) }, h(["auto", 300, "auto"], [door("left", 1), open(), door("left", 1)]))) },
      ]),
      items("bany", "Armari de bany", [
        { name: "Mirall", style: "Minimalista", materials: "MDF lacat blanc", colors: "blanc", use: "Armari penjat de dues portes sobre el lavabo", audience: "banys", price: 290, make: () => one(box("Armari", { w: 800, h: 650, d: 160, mat: LAC, base: hung(1250) }, doors(2))) },
        { name: "Obert", style: "Escandinau", materials: "roure xapat", colors: "roure natural", use: "Armari de paret amb nínxol i porta", audience: "banys petits", price: 260, make: () => one(box("Armari", { w: 800, h: 600, d: 180, mat: OAK, base: hung(1250) }, v(auto(2), [open(1), door("right", 1)]))) },
        { name: "Abatible", style: "Contemporani", materials: "MDF lacat greige", colors: "greige", use: "Armari de paret amb abatible", audience: "banys moderns", price: 280, make: () => one(box("Armari", { w: 800, h: 400, d: 200, mat: GREIGE, base: hung(1400) }, flap("up", 1))) },
      ]),
      items("bany", "Moble auxiliar", [
        { name: "Tovalloler", style: "Escandinau", materials: "freixe", colors: "freixe", use: "Prestatgeria oberta per a tovalloles", audience: "banys", price: 190, make: () => one(box("Tovalloler", { w: 450, h: 1200, d: 300, mat: ASH, base: legs(100), back: "none" }, fixed(3))) },
        { name: "Roba bruta", style: "Minimalista", materials: "melamina blanca", colors: "blanc", use: "Moble amb abatible per a la roba bruta", audience: "banys familiars", price: 220, make: () => one(box("Auxiliar", { w: 500, h: 900, d: 380, mat: WHITE, base: plinth(60, 20) }, h(["auto", 200], [flap("down"), drawers(1)]))) },
        { name: "Tamboret", style: "Organic modern", materials: "roure", colors: "roure natural", use: "Tamboret de bany de panells", audience: "banys amb dutxa", price: 120, make: () => waterfall("Tamboret", { w: 450, h: 450, d: 300, mat: OAK, t: 30 }) },
      ]),
    ],
  },
  {
    id: "exterior",
    name: "Exterior / jardí",
    types: [
      items("exterior", "Taula exterior", [
        { name: "Porxo", style: "Mediterrani contemporani", materials: "roure massís (acabat exterior) i ferro", colors: "roure, negre", use: "Taula de 2000 per a 8 sobre potes de ferro", audience: "terrasses", price: 1290, make: () => legTable("Taula", { w: 2000, h: 750, d: 950, mat: OAK, legs: "post" }) },
        { name: "Illa", style: "Minimalista", materials: "pedra sobre peu d'inox", colors: "pedra, inox", use: "Taula rodona de 1100", audience: "àtics", price: 990, make: () => legTable("Taula", { w: 1100, h: 750, d: 1100, mat: STONE, legs: "pedestal", legMat: INOX, shape: oval(1100, 1100), stone: true }) },
        { name: "Riu", style: "Organic modern", materials: "roure i inox", colors: "roure, inox", use: "Taula ovalada per a 6", audience: "jardins", price: 1190, make: () => legTable("Taula", { w: 1800, h: 750, d: 950, mat: OAK, legs: "round", legMat: INOX, shape: oval(1800, 950) }) },
      ]),
      items("exterior", "Banc exterior", [
        { name: "Mur", style: "Minimalista", materials: "roure massís a inglet", colors: "roure", use: "Banc de panells", audience: "terrasses", price: 490, make: () => waterfall("Banc", { w: 1800, h: 450, d: 420, mat: OAK }) },
        { name: "Bagul", style: "Mediterrani contemporani", materials: "roure amb abatible", colors: "roure", use: "Banc amb tapa per guardar coixins", audience: "jardins", price: 690, make: () => one(box("Bagul", { w: 1400, h: 450, d: 480, mat: OAK, base: plinth(60, 20) }, flap("up"))) },
        { name: "Forja", style: "Industrial elegant", materials: "roure sobre ferro", colors: "roure, negre", use: "Banc sobre patins de ferro", audience: "patis", price: 420, make: () => legTable("Banc", { w: 1600, h: 450, d: 400, mat: OAK, legs: "sled" }) },
      ]),
      items("exterior", "Moble auxiliar exterior", [
        { name: "Barbacoa", style: "Contemporani", materials: "roure amb pedra", colors: "roure, pedra", use: "Moble de barbacoa amb portes i taulell de pedra", audience: "terrasses", price: 1290, make: () => one(box("Barbacoa", { w: 1400, h: 880, d: 600, mat: OAK, base: plinth(80, 30), top: { kind: "none" } }, v(auto(2), [doors(1), drawers(3)])), { parts: [stoneTop(0, 1400, 620, 880)] }) },
        { name: "Carro", style: "Minimalista", materials: "roure", colors: "roure", use: "Auxiliar baix amb prestatges oberts", audience: "piscines", price: 390, make: () => one(box("Auxiliar", { w: 800, h: 700, d: 450, mat: OAK, base: legs(120), back: "none" }, fixed(1))) },
        { name: "Test", style: "Organic modern", materials: "MDF lacat terracota", colors: "terracota", use: "Jardinera cub a inglet", audience: "balcons", price: 190, make: () => one(box("Jardinera", { w: 500, h: 500, d: 500, mat: TERRA, base: onFloor, joint: "mitre", top: { kind: "none" } }, open())) },
      ]),
      items("exterior", "Emmagatzematge exterior", [
        { name: "Caseta", style: "Funcional", materials: "roure amb reixeta", colors: "roure", use: "Armari d'eines amb portes de reixeta", audience: "jardins", price: 890, make: () => row([0, 1].map((i) => box(`Armari ${i + 1}`, { w: 600, h: 1600, d: 500, mat: OAK, base: legs(80) }, grille(i ? "right" : "left")))) },
        { name: "Coixins", style: "Minimalista", materials: "roure", colors: "roure", use: "Bagul gran amb tapa per a coixins", audience: "terrasses", price: 590, make: () => one(box("Bagul", { w: 1200, h: 650, d: 600, mat: OAK, base: plinth(60, 20) }, flap("up"))) },
        { name: "Paret", style: "Contemporani", materials: "melamina gris", colors: "gris", use: "Armari de terrassa amb portes i prestatges", audience: "àtics", price: 690, make: () => wardrobe("Armari", { bodies: ["shelves"], mat: GREY, h: 1800, d: 450 }) },
      ]),
    ],
  },
]

/** Totes les plantilles de botiga en una llista (per als tests i la cerca). */
export const STORE_TEMPLATES: Template[] = STORE_CATALOG.flatMap((c) => c.types.flatMap((t) => t.items))

/** Constructors del catàleg, per a altres plantilles (mobles de les escenes de revista). */
export const storeBuilders = { box, drawers, door, doors, flap, open, fixed, panel, grille, v, h, auto, onFloor, plinth, legs, hung, part, metal, kitchen, bookcase, wardrobe, sideboard, one, row, stoneTop, legTable, loose, waterfall, ironLegs, oval, glassShelf }
