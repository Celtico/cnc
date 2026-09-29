import { defaultModule, newId, tableModule, type Carcass, type CompositionKind, type Module } from "./composition"
import { BUILTIN_TEMPLATES } from "./templates"

/**
 * Mòduls especials de cada tipus de moble, per a «Afegir mòdul». Mides estàndard: baixos
 * de cuina 770 sobre potes de 100 (+ taulell = 900) × 560; alts 720 × 330 penjats a 1450;
 * columnes de 2100; armari de 2400 × 600 amb sòcol.
 */
export interface ModulePreset {
  id: string
  kind: CompositionKind
  name: string
  make: () => Module
}

const mod = (name: string, c: Partial<Carcass>, root: Omit<Module["root"], "id">): Module => ({ ...defaultModule(newId("m"), name, c), root: { id: newId(), ...root } })

const kBase = (w: number): Partial<Carcass> => ({ width: w, height: 770, depth: 560, base: { kind: "legs", height: 100 } })
const kWall = (w: number): Partial<Carcass> => ({ width: w, height: 720, depth: 330, back: "screwed", backThickness: 10, base: { kind: "wall", height: 1450 } })
const kTall = (w: number): Partial<Carcass> => ({ width: w, height: 2100, depth: 560, base: { kind: "legs", height: 100 } })
const wardrobe = (w: number): Partial<Carcass> => ({ width: w, height: 2400, depth: 600, base: { kind: "plinth", height: 80, setback: 30 } })
const door = (hinge: "left" | "right" = "left") => ({ kind: "door" as const, mode: "single" as const, hinge })
const doors = { kind: "door" as const, mode: "double" as const, hinge: "left" as const }

export const MODULE_PRESETS: ModulePreset[] = [
  // Cuina
  { id: "k-drawers", kind: "cuina", name: "Baix calaixos 600", make: () => mod("Calaixos", kBase(600), { front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } }) },
  { id: "k-door", kind: "cuina", name: "Baix porta 600", make: () => mod("Baix", kBase(600), { shelves: { n: 1, adjustable: true }, front: door() }) },
  { id: "k-sink", kind: "cuina", name: "Baix fregadera 800", make: () => mod("Fregadera", { ...kBase(800), top: { kind: "none" } }, { front: doors }) },
  { id: "k-hob", kind: "cuina", name: "Baix fogons 600", make: () => mod("Fogons", { ...kBase(600), top: { kind: "none" } }, { front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } }) },
  {
    id: "k-oven",
    kind: "cuina",
    name: "Baix forn 600",
    make: () => mod("Forn", kBase(600), { split: { dir: "h", sizes: ["auto", 595], children: [{ id: newId(), front: { kind: "drawers", n: 1, heights: ["auto"] } }, { id: newId() }] } }),
  },
  {
    id: "k-tall-oven",
    kind: "cuina",
    name: "Columna forn i microones",
    make: () =>
      mod("Columna forn", kTall(600), {
        split: {
          dir: "h",
          sizes: ["auto", 595, 380, "auto"],
          children: [{ id: newId(), front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } }, { id: newId() }, { id: newId() }, { id: newId(), front: door() }],
        },
      }),
  },
  { id: "k-pantry", kind: "cuina", name: "Columna rebost 600", make: () => mod("Rebost", kTall(600), { shelves: { n: 5, adjustable: true }, front: door("right") }) },
  { id: "k-wall", kind: "cuina", name: "Alt porta 600", make: () => mod("Alt", kWall(600), { shelves: { n: 1, adjustable: true }, front: door() }) },
  { id: "k-wall-flap", kind: "cuina", name: "Alt abatible 800", make: () => mod("Alt abatible", kWall(800), { shelves: { n: 1, adjustable: true }, front: { kind: "flap", dir: "up" } }) },
  // Armari
  { id: "w-shelves", kind: "armari", name: "Prestatges 2 portes", make: () => mod("Prestatges", wardrobe(1000), { shelves: { n: 5, adjustable: true }, front: doors }) },
  {
    id: "w-hanging",
    kind: "armari",
    name: "Penjador (maleter a dalt)",
    make: () => mod("Penjador", wardrobe(1000), { split: { dir: "h", sizes: ["auto", 400], children: [{ id: newId() }, { id: newId() }] }, front: doors }),
  },
  {
    id: "w-drawers",
    kind: "armari",
    name: "Calaixos i prestatges",
    make: () =>
      mod("Calaixos i prestatges", wardrobe(600), {
        split: { dir: "h", sizes: [700, "auto"], children: [{ id: newId(), front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } }, { id: newId(), shelves: { n: 4, adjustable: true }, front: door() }] },
      }),
  },
  // Taula
  { id: "t-console", kind: "taula", name: "Consola", make: () => tableModule(newId("m"), "Consola") },
  { id: "t-dining", kind: "taula", name: "Taula de menjador", make: () => tableModule(newId("m"), "Taula", { width: 2000, height: 750, depth: 900, thickness: 30 }) },
  { id: "t-coffee", kind: "taula", name: "Taula de centre", make: () => tableModule(newId("m"), "Taula de centre", { width: 1100, height: 400, depth: 600, thickness: 30 }) },
  { id: "t-bench", kind: "taula", name: "Banc", make: () => tableModule(newId("m"), "Banc", { width: 1400, height: 450, depth: 380, thickness: 30 }) },
]

/** Mòduls per afegir a un moble d'aquest tipus: els especials i, al Moble, les plantilles d'un sol mòdul. */
export function modulePresetsFor(kind: CompositionKind): ModulePreset[] {
  if (kind !== "moble") return MODULE_PRESETS.filter((p) => p.kind === kind)
  return BUILTIN_TEMPLATES.filter((t) => t.kind === "moble" && t.make().modules.length === 1).map((t) => ({ id: t.id, kind: "moble", name: t.name, make: () => ({ ...t.make().modules[0]!, id: newId("m") }) }))
}
