import { DEFAULT_GRILLE, defaultModule, newId, tableModule, type Composition, type CompositionKind, type Module } from "./composition"

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

export const BUILTIN_TEMPLATES: Template[] = [
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
