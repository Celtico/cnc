import { DEFAULT_GRILLE, defaultModule, newId, type Composition, type Module } from "./composition"

export interface Template {
  id: string
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
    id: "wardrobe-2-doors",
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
    name: "Moble TV 3 portes",
    description: "1850 × 480 × 420 amb sòcol, tres portes i un prestatge regulable per compartiment.",
    make: () => ({
      modules: [tvModule()],
      references: [],
    }),
  },
  {
    id: "radiator-cover",
    name: "Cobreradiador",
    description: "790 × 1390 × 420, sense base ni fons, tapa amb ranura d'aire i reixeta desmuntable amb trapa.",
    make: () => ({
      modules: [radiatorModule()],
      references: [],
    }),
  },
  {
    id: "tv-living-room",
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
