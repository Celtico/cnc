import { flatPackDesk, flatPackShelf, flatPackStool } from "./flatPack"
import { INSPIRED_TEMPLATES } from "./inspiredTemplates"
import type { FreePart } from "./freePart"
import type { PNode } from "./polygon"
import { DEFAULT_GRILLE, defaultModule, moduleOrigins3, newId, tableModule, type Composition, type CompositionKind, type Module, type Zone } from "./composition"

export interface Template {
  id: string
  /** Tipus de moble (per filtrar la galeria i fixar-lo a la composició nova). */
  kind: CompositionKind
  name: string
  description: string
  /** Genera una composició nova amb ids únics. */
  make: () => Composition
}

function withRoot(m: Module, root: Module["root"]): Module {
  return { ...m, root }
}

/**
 * Plantilles «vitrina»: mobles reals que combinen les eines de l'app (parets buides, inglet,
 * tauler amb forma, fronts encastats, prestatges a sang, reixeta, objectes que tallen,
 * peces lliures de CNC i de ferro/pedra, encaixos…). Van primer a la galeria.
 */
const SHOWCASE: Template[] = [
  {
    id: "wave-console",
    kind: "taula",
    name: "Consola ona sobre inox",
    description: "1400 × 760 × 400: tauler ondulat (forma de Bézier) sobre dues potes ovals d'acer inox (peces lliures sense nesting).",
    make: waveConsole,
  },
  {
    id: "sideboard-iron",
    kind: "moble",
    name: "Aparador sobre ferro",
    description: "1800 × 700 × 450 de noguera, cantonades a inglet, portes i calaixos encastats, prestatges gruixuts a ras, passacables i bastidor de ferro negre (sense nesting).",
    make: sideboardIron,
  },
  {
    id: "floating-tv",
    kind: "moble",
    name: "Moble TV flotant",
    description: "2000 × 450 × 400 penjat, parets buides de 50 (gruix aparent), calaixos, obert amb prestatge gruixut a ras, reixeta desmuntable per als aparells, tele i passacables.",
    make: floatingTv,
  },
  {
    id: "bath-vanity",
    kind: "moble",
    name: "Moble de bany amb pedra",
    description: "1200 × 480 × 480 penjat, calaixos encastats de freixe, taulell de pedra (sense nesting), pica i desguàs que talla el fons.",
    make: bathVanity,
  },
  {
    id: "kitchen-island",
    kind: "cuina",
    name: "Cuina amb illa de pedra",
    description: "La cuina moderna (taulell amb pica i vitro, sòcol corregut, alts) i, davant, una illa de calaixos al terra (X pròpia) amb taulell de pedra sense nesting.",
    make: kitchenIsland,
  },
  {
    id: "walk-in-wardrobe",
    kind: "armari",
    name: "Vestidor amb barres",
    description: "2800 × 2400 × 600: penjador llarg amb maleter, calaixos i prestatges, i doble barra per a camises; barres d'inox (sense nesting).",
    make: walkInWardrobe,
  },
  {
    id: "flatpack-desk",
    kind: "lliure",
    name: "Escriptori flat-pack",
    description: "1200 × 740 × 600: laterals amb arc que travessen el tauler amb pestanyes, travesser i prestatge encaixats, sense cargols.",
    make: flatPackDesk,
  },
]

export const BUILTIN_TEMPLATES: Template[] = [
  ...SHOWCASE,
  ...INSPIRED_TEMPLATES,
  {
    id: "flatpack-shelf",
    kind: "lliure",
    name: "Prestatgeria d'encaix",
    description: "800 × 900 × 300: prestatges amb pestanyes passants als laterals i travesser, sense cargols.",
    make: flatPackShelf,
  },
  {
    id: "flatpack-stool",
    kind: "lliure",
    name: "Tamboret flat-pack",
    description: "Dues potes encreuades a mitja fusta i seient rodó amb pestanyes passants.",
    make: flatPackStool,
  },
  {
    id: "console",
    kind: "taula",
    name: "Consola",
    description: "1400 × 760 × 400: tauler i dos laterals de panell a inglet, com un bloc massís.",
    make: () => ({ kind: "taula", modules: [tableModule(newId("m"), "Consola")], references: [] }),
  },
  {
    id: "dining-table",
    kind: "taula",
    name: "Taula de menjador",
    description: "2000 × 750 × 900: tauler gruixut i laterals de panell a inglet (waterfall).",
    make: () => ({ kind: "taula", modules: [tableModule(newId("m"), "Taula", { width: 2000, height: 750, depth: 900, thickness: 30 })], references: [] }),
  },
  {
    id: "modern-kitchen",
    kind: "cuina",
    name: "Cuina moderna",
    description: "3000 mm lineal: baixos sobre potes (calaixos, fregadera, fogons, forn i rebost) amb taulell de roure d'una peça (forats de pica i vitro) i sòcol corregut; alts penjats a 1450. Cos blanc, fronts de roure.",
    make: () => kitchen(),
  },
  {
    id: "wardrobe-2-doors",
    kind: "armari",
    name: "Armari 2 portes",
    description: "1000 × 2000 × 600, 4 prestatges regulables, dues portes.",
    make: () => ({
      modules: [
        withRoot(defaultModule(newId("m"), "Armari", { width: 1000, height: 2000, depth: 600, base: { kind: "plinth", height: 80, setback: 30 } }), {
          id: newId(),
          shelves: { n: 4, adjustable: true },
          front: { kind: "door", mode: "double", hinge: "left" },
        }),
      ],
      references: [],
    }),
  },
  {
    id: "drawers-4",
    kind: "moble",
    name: "Calaixera 4 calaixos",
    description: "600 × 800 × 500, quatre calaixos d'alçada automàtica.",
    make: () => ({
      modules: [
        withRoot(defaultModule(newId("m"), "Calaixera", { width: 600, height: 800, depth: 500, base: { kind: "plinth", height: 60, setback: 30 } }), {
          id: newId(),
          front: { kind: "drawers", n: 4, heights: ["auto", "auto", "auto", "auto"] },
        }),
      ],
      references: [],
    }),
  },
  {
    id: "open-shelving",
    kind: "moble",
    name: "Prestatgeria oberta",
    description: "800 × 1800 × 300, sense portes, 4 prestatges fixos.",
    make: () => ({
      modules: [
        withRoot(defaultModule(newId("m"), "Prestatgeria", { width: 800, height: 1800, depth: 300, back: "screwed" }), {
          id: newId(),
          split: {
            dir: "h",
            sizes: ["auto", "auto", "auto", "auto", "auto"],
            children: Array.from({ length: 5 }, () => ({ id: newId() })),
          },
        }),
      ],
      references: [],
    }),
  },
  {
    id: "tv-3-doors",
    kind: "moble",
    name: "Moble TV 3 portes",
    description: "1850 × 480 × 420 amb sòcol, tres portes i un prestatge regulable per compartiment.",
    make: () => ({
      modules: [tvModule()],
      references: [],
    }),
  },
  {
    id: "radiator-cover",
    kind: "moble",
    name: "Cobreradiador",
    description: "790 × 1390 × 420, sense base ni fons, tapa amb ranura d'aire i reixeta desmuntable amb trapa.",
    make: () => ({
      modules: [radiatorModule()],
      references: [],
    }),
  },
  {
    id: "tv-living-room",
    kind: "moble",
    name: "Moble TV menjador (TV + cobreradiador)",
    description: "El moble de TV de 3 portes amb el cobreradiador al costat, radiador i tele com a objectes fantasma.",
    make: () => {
      const tv = tvModule()
      const rad = { ...radiatorModule(), gapBefore: 50 }
      return {
        modules: [tv, rad],
        references: [
          { id: newId("r"), name: "Radiador 650 × 1100 × 110", w: 650, h: 1100, d: 110, x: 1850 + 50 + (790 - 650) / 2, y: 175, z: 60 },
          { id: newId("r"), name: "TV 1231 × 717", w: 1231, h: 717, d: 44, x: (1850 - 1231) / 2, y: 480, z: 200 },
        ],
      }
    },
  },
]

export function tvModule(): Module {
  const m = defaultModule(newId("m"), "Moble TV", {
    width: 1850,
    height: 480,
    depth: 420,
    base: { kind: "plinth", height: 60, setback: 30 },
    back: "screwed",
    top: { kind: "full" },
  })
  const zone = (hinge: "left" | "right") => ({
    id: newId(),
    shelves: { n: 1, adjustable: true },
    front: { kind: "door" as const, mode: "single" as const, hinge },
  })
  return {
    ...withRoot(m, {
      id: newId(),
      split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [zone("left"), zone("left"), zone("right")] },
    }),
    extras: { cableHoles: [{ panel: "back", x: 925, y: 300, diameter: 60 }] },
  }
}

export function radiatorModule(): Module {
  const m = defaultModule(newId("m"), "Cobreradiador", {
    width: 790,
    height: 1390,
    depth: 420,
    base: { kind: "open" },
    back: "none",
    top: { kind: "ventSlot", gap: 60 },
  })
  return withRoot(m, {
    id: newId(),
    front: {
      kind: "grille",
      pattern: { ...DEFAULT_GRILLE, margin: 40, slotWidth: 10, slotGap: 6 },
      mount: "removable",
      hinge: "left",
      // Trapa davant de la clau del radiador (costat dret, a mitja alçada del radiador).
      hatch: { x: 790 - 2 * 19 - 200, y: 900, w: 150, h: 150 },
    },
  })
}

/**
 * Cuina lineal moderna (calaixos · fregadera · fogons · forn · rebost). Mides estàndard: baixos de
 * 770 sobre potes de 100 (+ taulell de 30 = 900), fondària 560, sòcol corregut; alts de 720 × 330 penjats a 1450 (deixen 540 sobre el
 * taulell), a la fila dels penjats, cadascun sobre el seu baix. Fons de 10 mm cargolat als alts (per penjar-los).
 */
function kitchen(): Composition {
  const body = { material: "Melamina blanca", thickness: 19, frontMaterial: "Melamina roure" }
  // Baixos sobre potes regulables de 100: el sòcol és una sola peça correguda (runs).
  const base = (name: string, width: number) => defaultModule(newId("m"), name, { ...body, width, height: 770, depth: 560, base: { kind: "legs", height: 100 } })
  // Alts: fila dels penjats, cadascun a sobre del seu baix (la separació salta el forat de
  // la campana).
  const wall = (name: string, width: number, gapBefore = 0): Module => ({
    ...defaultModule(newId("m"), name, { ...body, width, height: 720, depth: 330, back: "screwed", backThickness: 10, base: { kind: "wall", height: 1450 } }),
    gapBefore,
  })

  const drawers = withRoot(base("Calaixos", 600), { id: newId(), front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } })
  // Fregadera i fogons sense tapa: la pica i la placa van encastades al taulell i ocupen
  // l'espai de sota; la tapa del mòdul hi xocaria.
  const open = (m: Module): Module => ({ ...m, carcass: { ...m.carcass, top: { kind: "none" } } })
  const sink = withRoot(open(base("Fregadera", 800)), { id: newId(), front: { kind: "door", mode: "double", hinge: "left" } })
  // Forn: calaix a baix i el buit del forn a sobre (595 mm, estàndard d'encastar).
  const oven = withRoot(base("Forn", 600), {
    id: newId(),
    split: {
      dir: "h",
      sizes: ["auto", 595],
      children: [{ id: newId(), front: { kind: "drawers", n: 1, heights: ["auto"] } }, { id: newId() }],
    },
  })
  // Fogons: la placa va encastada al taulell; a sota, dos calaixos grans per a cassoles.
  const hob = withRoot(open(base("Fogons", 600)), { id: newId(), front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } })
  const pantry = withRoot(base("Rebost", 400), { id: newId(), shelves: { n: 2, adjustable: true }, front: { kind: "door", mode: "single", hinge: "right" } })

  const w1 = withRoot(wall("Alt 1", 600), { id: newId(), shelves: { n: 1, adjustable: true }, front: { kind: "door", mode: "single", hinge: "left" } })
  const w2 = withRoot(wall("Alt escorreplats", 800), { id: newId(), shelves: { n: 1, adjustable: true }, front: { kind: "flap", dir: "up" } })
  const w3 = withRoot(wall("Alt 3", 600, 600), { id: newId(), shelves: { n: 1, adjustable: true }, front: { kind: "door", mode: "single", hinge: "right" } })
  const w4 = withRoot(wall("Alt 4", 400), { id: newId(), shelves: { n: 1, adjustable: true }, front: { kind: "door", mode: "single", hinge: "right" } })

  // Sobre els fogons no hi ha alt: hi va la campana (≥ 650 mm per sobre de la placa).
  // Taulell de roure de 30 d'una peça, amb el forat de la pica i el de la placa, i sòcol
  // corregut de punta a punta retranquejat 50 mm.
  const runs: Composition["runs"] = [
    {
      id: newId("run"),
      kind: "worktop",
      from: drawers.id,
      to: pantry.id,
      material: "Roure massís / xapat",
      thickness: 30,
      overhangFront: 20,
      overhangLeft: 0,
      overhangRight: 0,
      cutouts: [
        { id: newId("cut"), kind: "sink", module: sink.id, w: 740, d: 440, dx: 0 },
        { id: newId("cut"), kind: "hob", module: hob.id, w: 560, d: 490, dx: 0 },
      ],
    },
    { id: newId("run"), kind: "plinth", from: drawers.id, to: pantry.id, material: "Melamina roure", thickness: 16, setback: 50 },
  ]
  return { modules: [drawers, sink, hob, oven, pantry, w1, w2, w3, w4], references: [], runs }
}

const inox = (p: Omit<FreePart, "id" | "material" | "nest">): FreePart => ({ id: newId("p"), material: "Acer inox", nest: false, ...p })
const iron = (p: Omit<FreePart, "id" | "material" | "nest">): FreePart => ({ id: newId("p"), material: "Ferro negre", nest: false, ...p })

/** El·lipse de w × h (secció de les potes ovals). */
function oval(w: number, h: number): PNode[] {
  const K = 0.5522847498
  const a = w / 2, b = h / 2
  return [
    { x: w, y: b, in: [0, -K * b], out: [0, K * b], t: "smooth" },
    { x: a, y: h, in: [K * a, 0], out: [-K * a, 0], t: "smooth" },
    { x: 0, y: b, in: [0, K * b], out: [0, -K * b], t: "smooth" },
    { x: a, y: 0, in: [-K * a, 0], out: [K * a, 0], t: "smooth" },
  ]
}

/** Consola: tauler ondulat (sense laterals) sobre dues potes ovals d'inox. */
function waveConsole(): Composition {
  const wave: PNode[] = [
    { x: 930, y: 52.8, in: [0, -127.03], out: [0, 127.03], t: "smooth" },
    { x: 430, y: 167.86, in: [403.17, 0], out: [-403.17, 0], t: "smooth" },
    { x: 0, y: 202.8, in: [0, 127.03], out: [0, -127.03], t: "smooth" },
    { x: 430, y: 67.86, in: [-403.17, 0], out: [403.17, 0], t: "smooth" },
  ]
  const gap = 150
  const m: Module = {
    ...tableModule(newId("m"), "Consola", { thickness: 30, material: "Noguera xapada", sides: { left: false, right: false }, tableTop: { overhang: 30, shape: wave } }),
    wallGap: gap,
  }
  // Les potes arriben just a sota del tauler (760 − 30).
  const legH = 760 - 30
  const leg = (x: number, z: number): FreePart => inox({ name: "Pota d'inox", orient: "flat", w: 50, h: 100, thickness: legH, x, y: 0, z: gap + z, shape: oval(50, 100) })
  return { kind: "taula", modules: [m], references: [], parts: [leg(150, 190), leg(1200, 40)] }
}

/** Aparador de noguera sobre bastidor de ferro. */
function sideboardIron(): Composition {
  const W = 1800, H = 700, D = 450, LEG = 300, gap = 30
  const m = withRoot(
    {
      ...defaultModule(newId("m"), "Aparador", {
        width: W,
        height: H,
        depth: D,
        material: "Noguera xapada",
        thickness: 19,
        joint: "mitre",
        back: "screwed",
        backMaterial: "Contraxapat (fons)",
        backThickness: 10,
        base: { kind: "legs", height: LEG },
      }),
      wallGap: gap,
    },
    {
      id: newId(),
      split: {
        dir: "v",
        sizes: ["auto", 500, "auto"],
        children: [
          { id: newId(), shelves: { n: 1, adjustable: true }, front: { kind: "door", mode: "double", hinge: "left" } },
          { id: newId(), front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } },
          // Obert: prestatges gruixuts a ras del davant (els fronts encastats són als altres).
          { id: newId(), shelves: { n: 2, adjustable: false, thickness: 50, flush: true } },
        ],
      },
    },
  )
  const fm: Module = { ...m, fronts: { ...m.fronts, style: "inset" } }
  const T = 30
  const z0 = gap + 20, z1 = gap + D - 20 - T
  const legs = [20, W - 20 - T].flatMap((x) => [z0, z1].map((z) => iron({ name: "Pota de ferro", orient: "front", w: T, h: LEG, thickness: T, x, y: 0, z })))
  const bars = [z0, z1].map((z) => iron({ name: "Travesser de ferro", orient: "flat", w: W - 40, h: T, thickness: 10, x: 20, y: LEG - 10, z }))
  return {
    kind: "moble",
    modules: [fm],
    references: [{ id: newId("r"), name: "Passacables Ø60", w: 60, h: 60, d: 40, x: 350, y: LEG + 120, z: gap - 10, effect: "cut", shape: "cylinder", axis: "z" }],
    parts: [...legs, ...bars],
  }
}

/** Moble TV penjat de parets buides amb reixeta per als aparells. */
function floatingTv(): Composition {
  const W = 2000, H = 450, D = 400, Y = 350
  const m = withRoot(
    defaultModule(newId("m"), "Moble TV", {
      width: W,
      height: H,
      depth: D,
      material: "Melamina blanca",
      frontMaterial: "Melamina roure",
      thickness: 19,
      hollow: { thickness: 50 },
      back: "screwed",
      backThickness: 10,
      base: { kind: "wall", height: Y },
    }),
    {
      id: newId(),
      split: {
        dir: "v",
        sizes: [500, "auto", 600],
        children: [
          { id: newId(), front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } },
          // Obert al mig, amb un prestatge gruixut com les parets i a ras del davant.
          { id: newId(), shelves: { n: 1, adjustable: false, thickness: 50, flush: true } },
          { id: newId(), shelves: { n: 1, adjustable: true }, front: { kind: "grille", pattern: { ...DEFAULT_GRILLE, margin: 40, slotWidth: 12, slotGap: 6 }, mount: "removable", hinge: "left" } },
        ],
      },
    },
  )
  return {
    kind: "moble",
    modules: [m],
    references: [
      { id: newId("r"), name: "TV 65\"", w: 1450, h: 830, d: 30, x: (W - 1450) / 2, y: Y + H + 200, z: 0, onWall: true },
      { id: newId("r"), name: "Passacables Ø80", w: 80, h: 80, d: 40, x: W / 2 - 40, y: Y + H - 120, z: -10, effect: "cut", shape: "cylinder", axis: "z" },
    ],
  }
}

/** Moble de lavabo penjat, fronts encastats, amb taulell de pedra i la pica a sobre. */
function bathVanity(): Composition {
  const W = 1200, H = 480, D = 480, Y = 380
  const m = withRoot(
    defaultModule(newId("m"), "Lavabo", {
      width: W,
      height: H,
      depth: D,
      material: "Melamina blanca",
      frontMaterial: "Freixe xapat",
      thickness: 19,
      back: "screwed",
      backThickness: 10,
      top: { kind: "none" },
      base: { kind: "wall", height: Y },
    }),
    {
      id: newId(),
      split: {
        dir: "v",
        sizes: ["auto", "auto"],
        children: [
          { id: newId(), front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } },
          { id: newId(), front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } },
        ],
      },
    },
  )
  const fm: Module = { ...m, fronts: { ...m.fronts, style: "inset" } }
  const stone: FreePart = { id: newId("p"), name: "Taulell de pedra", material: "Pedra", nest: false, orient: "flat", w: W, h: D + 20, thickness: 20, x: 0, y: Y + H, z: 0 }
  return {
    kind: "moble",
    modules: [fm],
    references: [
      { id: newId("r"), name: "Pica sobre taulell", w: 500, h: 150, d: 380, x: (W - 500) / 2, y: Y + H + 20, z: 60 },
      { id: newId("r"), name: "Desguàs Ø50", w: 50, h: 50, d: 40, x: W / 2 - 25, y: Y + 250, z: -10, effect: "cut", shape: "cylinder", axis: "z" },
    ],
    parts: [stone],
  }
}

/** Cuina moderna amb una illa de calaixos davant (al terra, X pròpia) i taulell de pedra. */
function kitchenIsland(): Composition {
  const k = kitchen()
  const IW = 1800, ID = 900, gap = 1560, X = 600
  const drawers = (): Zone => ({ id: newId(), front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } })
  const island: Module = {
    ...withRoot(defaultModule(newId("m"), "Illa", { material: "Melamina blanca", frontMaterial: "Melamina roure", thickness: 19, width: IW, height: 770, depth: ID, base: { kind: "legs", height: 100 } }), {
      id: newId(),
      split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [drawers(), drawers(), drawers()] },
    }),
    wallGap: gap,
    x: X,
  }
  // Enganxat a l'illa (coordenades relatives): si l'illa es mou, el taulell la segueix.
  const modules = [...k.modules, island]
  const o = moduleOrigins3({ ...k, modules }).get(island.id)!
  const stone: FreePart = { id: newId("p"), name: "Taulell de pedra", material: "Pedra", nest: false, orient: "flat", w: IW + 100, h: ID + 60, thickness: 30, module: island.id, x: -50, y: 870 - o[1], z: -20 }
  return { ...k, kind: "cuina", modules, parts: [stone] }
}

/** Vestidor de tres cossos amb barres de penjar (tubs d'inox, fora del nesting). */
function walkInWardrobe(): Composition {
  const body = { height: 2400, depth: 600, material: "Melamina blanca", frontMaterial: "Melamina roure", thickness: 19, base: { kind: "plinth" as const, height: 80, setback: 30 } }
  const long = withRoot(defaultModule(newId("m"), "Penjador llarg", { ...body, width: 1000 }), {
    id: newId(),
    front: { kind: "door", mode: "double", hinge: "left" },
    split: { dir: "h", sizes: ["auto", 400], children: [{ id: newId(), rail: true }, { id: newId() }] },
  })
  const mid = withRoot(defaultModule(newId("m"), "Calaixos i prestatges", { ...body, width: 800 }), {
    id: newId(),
    split: {
      dir: "h",
      sizes: [700, "auto"],
      children: [
        { id: newId(), front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } },
        { id: newId(), shelves: { n: 4, adjustable: true }, front: { kind: "door", mode: "single", hinge: "right" } },
      ],
    },
  })
  const double = withRoot(defaultModule(newId("m"), "Doble barra", { ...body, width: 1000 }), {
    id: newId(),
    front: { kind: "door", mode: "double", hinge: "left" },
    split: { dir: "h", sizes: ["auto", "auto", 400], children: [{ id: newId(), rail: true }, { id: newId(), rail: true }, { id: newId() }] },
  })
  return { kind: "armari", modules: [long, mid, double], references: [] }
}
