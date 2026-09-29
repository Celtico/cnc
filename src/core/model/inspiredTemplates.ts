import type { FreePart } from "./freePart"
import { defaultModule, newId, type Composition, type Module, type RefObject, type Zone } from "./composition"
import type { Template } from "./templates"

/**
 * Plantilles inspirades en interiors reals (fotos de referència de l'usuari): mobles de
 * dissenyador fets amb les eines de l'app. Coordenades en mm; files de mòduls des de x = 0.
 */

const withRoot = (m: Module, root: Zone): Module => ({ ...m, root })
const part = (p: Omit<FreePart, "id">): FreePart => ({ id: newId("p"), ...p })
const stone = (p: Omit<FreePart, "id" | "material" | "nest">): FreePart => part({ material: "Pedra", nest: false, ...p })
const drawers = (n: number): Zone => ({ id: newId(), front: { kind: "drawers", n, heights: Array.from({ length: n }, () => "auto" as const) } })

/** Moble TV llarg penjat, lacat, amb nínxol obert i prestatges flotants a la paret. */
function longTv(): Composition {
  const W = 2800, H = 480, D = 450, Y = 220
  const m = withRoot(
    defaultModule(newId("m"), "Moble TV", {
      width: W,
      height: H,
      depth: D,
      material: "MDF lacat",
      thickness: 19,
      back: "screwed",
      backMaterial: "DM (fons)",
      backThickness: 10,
      base: { kind: "wall", height: Y },
    }),
    {
      id: newId(),
      split: {
        dir: "v",
        sizes: [600, 700, "auto", "auto", "auto"],
        children: [
          drawers(2),
          // Nínxol obert per als aparells, sense porta.
          { id: newId(), shelves: { n: 0, adjustable: false } },
          ...(["left", "left", "right"] as const).map((hinge): Zone => ({ id: newId(), shelves: { n: 1, adjustable: true }, front: { kind: "door", mode: "single", hinge } })),
        ],
      },
    },
  )
  // Prestatges flotants de lacat a l'esquerra (quadres i llibres), fora del moble.
  const shelves = [1250, 1600, 1950].map((y) => part({ name: "Prestatge flotant", orient: "flat", material: "MDF lacat", w: 1100, h: 260, thickness: 19, x: 0, y, z: 0, group: "Prestatges de paret" }))
  const tvW = 1450
  const refs: RefObject[] = [
    { id: newId("r"), name: "TV 65\"", w: tvW, h: 830, d: 30, x: W - tvW - 150, y: Y + H + 250, z: 0, onWall: true },
    { id: newId("r"), name: "Passacables Ø80", w: 80, h: 80, d: 40, x: 600 + 350 - 40, y: Y + H - 140, z: -10, effect: "cut", shape: "cylinder", axis: "z" },
  ]
  return { kind: "moble", modules: [m], references: refs, parts: shelves }
}

/** Llibreria de noguera de terra a sostre amb els baixos negres de portes. */
function blackBookcase(): Composition {
  const body = {
    height: 2300,
    depth: 400,
    material: "Noguera xapada",
    frontMaterial: "Melamina negra",
    thickness: 19,
    back: "screwed" as const,
    backMaterial: "Melamina negra",
    backThickness: 16,
    base: { kind: "plinth" as const, height: 80, setback: 20 },
  }
  const col = (name: string, width: number, door: Zone["front"]) =>
    withRoot(defaultModule(newId("m"), name, { ...body, width }), {
      id: newId(),
      split: {
        dir: "h",
        sizes: [720, "auto"],
        children: [
          { id: newId(), shelves: { n: 1, adjustable: true }, front: door },
          { id: newId(), shelves: { n: 3, adjustable: true } },
        ],
      },
    })
  return {
    kind: "moble",
    modules: [
      col("Esquerra", 600, { kind: "door", mode: "single", hinge: "left" }),
      col("Centre", 800, { kind: "door", mode: "double", hinge: "left" }),
      col("Dreta", 600, { kind: "door", mode: "single", hinge: "right" }),
    ],
    references: [],
  }
}

/** Lliteres encastades: dues lliteres de parets gruixudes i, al mig, una escala de prestatges. */
function bunkBeds(): Composition {
  const body = {
    height: 2300,
    depth: 950,
    material: "Noguera xapada",
    thickness: 19,
    hollow: { thickness: 50 },
    back: "screwed" as const,
    backMaterial: "Contraxapat (fons)",
    backThickness: 10,
    base: { kind: "plinth" as const, height: 250, setback: 0 },
  }
  // Llit de sota sobre la base (a 300) i llit de dalt sobre el travesser (a 1300): 2000 × 900.
  const bunk = (name: string) =>
    withRoot(defaultModule(newId("m"), name, { ...body, width: 2100 }), {
      id: newId(),
      split: { dir: "h", sizes: [1000, "auto"], children: [{ id: newId() }, { id: newId() }] },
    })
  const a = bunk("Llitera 1")
  const b = bunk("Llitera 2")
  const stairs = withRoot(defaultModule(newId("m"), "Escala", { ...body, width: 500, hollow: undefined, depth: 600 }), {
    id: newId(),
    // Graons: prestatges gruixuts fixos, oberts i a ras del davant.
    shelves: { n: 5, adjustable: false, thickness: 50, flush: true },
  })
  // Barana del llit de dalt (deixa l'entrada a la banda de l'escala), enganxada a cada llitera.
  const rail = (m: Module, fromRight: boolean): FreePart =>
    part({ name: "Barana", orient: "front", material: "Noguera xapada", w: 1350, h: 160, thickness: 19, module: m.id, x: fromRight ? 2100 - 50 - 1350 : 50, y: 1560, z: 950 - 19, group: `Barana ${m.name}` })
  // Matalassos de 2000 × 900 × 150 (objectes de referència): el de sota sobre la base (a 300) i
  // el de dalt sobre el travesser (a 1319). Llitera 2 comença a 2100 + 500.
  const mattress = (x: number, y: number, n: string): RefObject => ({ id: newId("r"), name: `Matalàs ${n}`, w: 1990, h: 150, d: 900, x: x + 55, y, z: 30 })
  const refs = [mattress(0, 301, "1 baix"), mattress(0, 1320, "1 dalt"), mattress(2600, 301, "2 baix"), mattress(2600, 1320, "2 dalt")]
  return { kind: "armari", modules: [a, stairs, b], references: refs, parts: [rail(a, false), rail(b, true)] }
}

/** Consola de noguera: caixa a inglet amb tres calaixos a inglet sobre dues potes de tauler. */
function walnutConsole(): Composition {
  const W = 1400, H = 180, D = 420, LEG = 580
  const m = withRoot(
    defaultModule(newId("m"), "Consola", {
      width: W,
      height: H,
      depth: D,
      material: "Noguera xapada",
      thickness: 19,
      joint: "mitre",
      back: "screwed",
      backMaterial: "Contraxapat (fons)",
      backThickness: 10,
      base: { kind: "wall", height: LEG },
    }),
    { id: newId(), split: { dir: "v", sizes: [360, "auto", 360], children: [drawers(1), drawers(1), drawers(1)] } },
  )
  // Pota en U de tauler (davant + dos costats), sota cada calaix de la punta.
  const legW = 200, legD = 360, z1 = D - 30
  const leg = (x: number, g: string): FreePart[] => [
    part({ name: "Pota · davant", orient: "front", material: "Noguera xapada", w: legW, h: LEG, thickness: 19, x, y: 0, z: z1 - 19, group: g }),
    part({ name: "Pota · costat", orient: "side", material: "Noguera xapada", w: legD - 19, h: LEG, thickness: 19, x, y: 0, z: z1 - legD, group: g }),
    part({ name: "Pota · costat", orient: "side", material: "Noguera xapada", w: legD - 19, h: LEG, thickness: 19, x: x + legW - 19, y: 0, z: z1 - legD, group: g }),
  ]
  return { kind: "moble", modules: [m], references: [], parts: [...leg(170, "Pota esquerra"), ...leg(W - 170 - legW, "Pota dreta")] }
}

/** Moble penjat de noguera: calaixos de punta a punta, tot a inglet. */
function walnutFloating(): Composition {
  const m = withRoot(
    defaultModule(newId("m"), "Moble penjat", {
      width: 1600,
      height: 330,
      depth: 420,
      material: "Noguera xapada",
      thickness: 19,
      joint: "mitre",
      back: "screwed",
      backMaterial: "Contraxapat (fons)",
      backThickness: 10,
      base: { kind: "wall", height: 380 },
    }),
    { id: newId(), split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [drawers(1), drawers(1), drawers(1)] } },
  )
  return { kind: "moble", modules: [m], references: [] }
}

/** Tauleta de centre: cub de noguera a inglet (tapa, base i laterals), al mig de la sala. */
function coffeeCube(): Composition {
  const m: Module = {
    ...withRoot(
      defaultModule(newId("m"), "Tauleta", {
        width: 900,
        height: 340,
        depth: 900,
        material: "Noguera xapada",
        thickness: 19,
        joint: "mitre",
        back: "screwed",
        backMaterial: "Noguera xapada",
        backThickness: 19,
        base: { kind: "none" },
      }),
      { id: newId(), front: { kind: "panel" } },
    ),
    wallGap: 1200,
    x: 600,
  }
  return { kind: "taula", modules: [m], references: [] }
}

/** Cuina de roure de calaixos (sense tiradors vistos), columna de rebost, prestatges i illa, amb pedra. */
function oakKitchen(): Composition {
  const body = { material: "Melamina blanca", frontMaterial: "Roure massís / xapat", thickness: 19, depth: 600 }
  const base = (name: string, width: number, root: Zone, open = false): Module =>
    withRoot(defaultModule(newId("m"), name, { ...body, width, height: 770, base: { kind: "legs", height: 100 }, ...(open ? { top: { kind: "none" as const } } : {}) }), root)
  const d1 = base("Calaixos", 600, drawers(3))
  const sink = base("Fregadera", 900, drawers(2), true)
  const hob = base("Fogons", 900, drawers(2), true)
  const pantry = withRoot(defaultModule(newId("m"), "Rebost", { ...body, width: 600, height: 2200, base: { kind: "legs", height: 100 } }), {
    id: newId(),
    shelves: { n: 5, adjustable: true },
    front: { kind: "door", mode: "single", hinge: "right" },
  })
  const IW = 2400, ID = 1000
  const island: Module = {
    ...withRoot(defaultModule(newId("m"), "Illa", { ...body, width: IW, height: 770, depth: ID, base: { kind: "legs", height: 100 } }), {
      id: newId(),
      split: { dir: "v", sizes: ["auto", "auto", "auto", "auto"], children: [drawers(3), drawers(3), drawers(3), drawers(3)] },
    }),
    wallGap: 1500,
    x: 150,
  }
  const rowW = 600 + 900 + 900
  const top = stone({ name: "Taulell de pedra", orient: "flat", w: rowW, h: 620, thickness: 30, x: 0, y: 870, z: 0 })
  // Taulell de l'illa, enganxat a l'illa (la segueix si es mou): coordenades relatives.
  const itop = stone({ name: "Taulell de l'illa", orient: "flat", w: IW + 40, h: ID + 40, thickness: 30, module: island.id, x: -20, y: 870, z: -20 })
  // Prestatges de roure a la paret, sobre la placa i la pica.
  const shelves = [1350, 1700].map((y) => part({ name: "Prestatge de paret", orient: "flat", material: "Roure massís / xapat", w: 1500, h: 250, thickness: 30, x: 0, y, z: 0, group: "Prestatges de paret" }))
  // Pica i placa: tallen el taulell de pedra (només la pedra: a sota, els mòduls no tenen tapa).
  const refs: RefObject[] = [
    { id: newId("r"), name: "Pica", w: 740, h: 60, d: 440, x: 600 + 80, y: 855, z: 80, effect: "cut", axis: "y" },
    { id: newId("r"), name: "Placa", w: 780, h: 60, d: 500, x: 1500 + 60, y: 855, z: 60, effect: "cut", axis: "y" },
  ]
  return {
    kind: "cuina",
    modules: [d1, sink, hob, pantry, island],
    references: refs,
    parts: [top, itop, ...shelves],
    runs: [{ id: newId("run"), kind: "plinth", from: d1.id, to: pantry.id, material: "Roure massís / xapat", thickness: 19, setback: 40 }],
  }
}

export const INSPIRED_TEMPLATES: Template[] = [
  { id: "tv-long", kind: "moble", name: "Moble TV llarg amb prestatges", description: "2800 × 480 penjat, lacat: calaixos, nínxol obert per als aparells i portes; prestatges flotants a la paret i tele.", make: longTv },
  { id: "bookcase-black", kind: "moble", name: "Llibreria amb baixos negres", description: "2000 × 2300 × 400 de noguera, de terra a sostre: prestatges a dalt i portes negres a baix, fons negre.", make: blackBookcase },
  { id: "bunk-beds", kind: "armari", name: "Lliteres encastades", description: "Dues lliteres de 2000 × 900 amb parets gruixudes (buides) de noguera, barana al llit de dalt i escala de graons gruixuts al mig.", make: bunkBeds },
  { id: "walnut-console", kind: "moble", name: "Consola de noguera a inglet", description: "1400 × 760 × 420: caixa i calaixos a inglet (sense cap cantell vist) sobre dues potes de tauler en U.", make: walnutConsole },
  { id: "walnut-floating", kind: "moble", name: "Moble penjat de noguera", description: "1600 × 330 × 420 penjat: tres calaixos de punta a punta, fronts i caixa a inglet.", make: walnutFloating },
  { id: "coffee-cube", kind: "taula", name: "Tauleta cub de noguera", description: "900 × 340 × 900 al mig de la sala: cub tancat, totes les cantonades a inglet.", make: coffeeCube },
  { id: "oak-kitchen", kind: "cuina", name: "Cuina de roure amb illa de calaixos", description: "Calaixos de roure, columna de rebost, prestatges de paret i illa de 2400 × 1000; taulells de pedra tallats per la pica i la placa.", make: oakKitchen },
]
