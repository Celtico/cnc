import { DEFAULT_JOINERY, type FreePart } from "./freePart"
import { defaultModule, newId, type Composition } from "./composition"
import { MAG_OBJECTS } from "./magObjects"
import { cyl, ellipse, objectComposition, tube } from "./objectShapes"
import { MODEL_ASSETS, newModelObject } from "./models"
import type { Template } from "./templates"
import type { z } from "zod"
import type { BlockItem, BlockShapeSchema } from "./ambientSchema"

type BlockShape = z.infer<typeof BlockShapeSchema>

// --- Blocs --------------------------------------------------------------------------------

interface BlockPreset {
  id: string
  name: string
  shape: BlockShape
  w: number
  h: number
  d: number
  material: string
  material2?: string
}

/** Blocs habituals (mides de catàleg) per veure si hi cap tot. */
export const BLOCK_PRESETS: BlockPreset[] = [
  { id: "sofa-3", name: "Sofà de 3 places", shape: "sofa", w: 2100, h: 850, d: 950, material: "Teixit gris" },
  { id: "sofa-2", name: "Sofà de 2 places", shape: "sofa", w: 1600, h: 850, d: 900, material: "Teixit beix" },
  { id: "armchair", name: "Butaca", shape: "sofa", w: 850, h: 850, d: 850, material: "Vellut verd" },
  { id: "bed-150", name: "Llit de 150", shape: "bed", w: 1600, h: 1000, d: 2100, material: "Teixit gris", material2: "Lli blanc" },
  { id: "bed-90", name: "Llit de 90", shape: "bed", w: 1000, h: 900, d: 2050, material: "Teixit beix", material2: "Lli blanc" },
  { id: "dining", name: "Taula de menjador", shape: "table", w: 1800, h: 750, d: 900, material: "Roure massís / xapat" },
  { id: "desk", name: "Taula d'escriptori", shape: "table", w: 1400, h: 750, d: 700, material: "Melamina blanca" },
  { id: "fridge", name: "Nevera", shape: "box", w: 600, h: 1850, d: 650, material: "Electrodomèstic inox" },
  { id: "washer", name: "Rentadora", shape: "box", w: 600, h: 850, d: 600, material: "Electrodomèstic blanc" },
  { id: "rug", name: "Catifa", shape: "box", w: 2000, h: 10, d: 3000, material: "Catifa beix" },
  { id: "tv", name: "Televisió 55\"", shape: "box", w: 1230, h: 720, d: 60, material: "Ferro negre" },
  { id: "box", name: "Bloc", shape: "box", w: 600, h: 600, d: 600, material: "Microciment gris" },
]

/** Composició (peces lliures sense nesting) que dibuixa un bloc, a la seva petjada (0..w, 0..d). */
export function blockComposition(b: Pick<BlockItem, "shape" | "w" | "h" | "d" | "material" | "material2" | "name">): Composition {
  const p = (q: Omit<FreePart, "id" | "nest" | "joints">): FreePart => ({ id: newId("p"), nest: false, ...q })
  const { w, h, d } = b
  const m = b.material
  const m2 = b.material2 ?? b.material
  let parts: FreePart[]
  if (b.shape === "sofa") {
    const arm = Math.min(180, w * 0.12)
    const back = Math.min(220, d * 0.25)
    const seat = Math.min(430, h * 0.5)
    parts = [
      p({ name: "Base", orient: "flat", material: m, w: w - 2 * arm, h: d - back, thickness: seat - 150, x: arm, y: 0, z: back }),
      p({ name: "Seient", orient: "flat", material: m2, w: w - 2 * arm, h: d - back - 20, thickness: 150, x: arm, y: seat - 150, z: back }),
      p({ name: "Respatller", orient: "front", material: m, w, h, thickness: back, x: 0, y: 0, z: 0 }),
      p({ name: "Braç", orient: "side", material: m, w: d - back, h: Math.min(h, seat + 200), thickness: arm, x: 0, y: 0, z: back }),
      p({ name: "Braç", orient: "side", material: m, w: d - back, h: Math.min(h, seat + 200), thickness: arm, x: w - arm, y: 0, z: back }),
    ]
  } else if (b.shape === "bed") {
    const head = 80
    const frame = Math.min(320, h * 0.35)
    parts = [
      p({ name: "Capçal", orient: "front", material: m, w, h, thickness: head, x: 0, y: 0, z: 0 }),
      p({ name: "Bastidor", orient: "flat", material: m, w, h: d - head, thickness: frame, x: 0, y: 0, z: head }),
      p({ name: "Matalàs", orient: "flat", material: m2, w: w - 40, h: d - head - 40, thickness: 220, x: 20, y: frame, z: head + 20 }),
    ]
  } else if (b.shape === "table") {
    const t = 30, leg = 60
    const legs = [
      [40, 40],
      [w - 40 - leg, 40],
      [40, d - 40 - leg],
      [w - 40 - leg, d - 40 - leg],
    ].map(([x, z]) => p({ name: "Pota", orient: "flat", material: m, w: leg, h: leg, thickness: h - t, x: x!, y: 0, z: z! }))
    parts = [p({ name: "Tauler", orient: "flat", material: m, w, h: d, thickness: t, x: 0, y: h - t, z: 0 }), ...legs]
  } else parts = [p({ name: b.name, orient: "flat", material: m, w, h: d, thickness: h, x: 0, y: 0, z: 0 })]
  return { kind: "objecte", modules: [defaultModule(newId("m"), "Mòdul 1")], references: [], parts, joinery: { ...DEFAULT_JOINERY } }
}

// --- Plantilles d'objectes ------------------------------------------------------------------

const obj = objectComposition

/**
 * Plantilles d'objectes per als ambients: els blocs habituals (sofà, llit, nevera…) i alguns
 * de peces amb forma (cadira, làmpada, planta, mirall, taula rodona). Es fan com els mobles
 * flat-pack (peces lliures, forma, booleanes) però amb materials de simulació i sense fabricar.
 */
export const OBJECT_TEMPLATES: Template[] = [
  ...BLOCK_PRESETS.map((b) => ({ id: `object-${b.id}`, kind: "objecte" as const, name: b.name, description: `${b.w} × ${b.h} × ${b.d} mm · ${b.material}${b.material2 ? ` i ${b.material2}` : ""}.`, make: () => blockComposition(b) })),
  {
    id: "object-chair",
    kind: "objecte",
    name: "Cadira",
    description: "450 × 850 × 500 mm · roure i seient de teixit.",
    make: () =>
      obj([
        ...[
          [20, 20],
          [395, 20],
          [20, 445],
          [395, 445],
        ].map(([x, z]) => ({ name: "Pota", orient: "flat" as const, material: "Roure massís / xapat", w: 35, h: 35, thickness: 430, x: x!, y: 0, z: z! })),
        { name: "Seient", orient: "flat", material: "Teixit beix", w: 450, h: 500, thickness: 40, x: 0, y: 430, z: 0 },
        { name: "Respatller", orient: "front", material: "Roure massís / xapat", w: 450, h: 380, thickness: 25, x: 0, y: 470, z: 0 },
      ]),
  },
  {
    id: "object-floor-lamp",
    kind: "objecte",
    name: "Làmpada de peu",
    description: "Ø 400 × 1750 mm · peu de ferro i pantalla de lli oberta amb la bombeta a dins.",
    make: () =>
      obj([
        { name: "Base", orient: "flat", material: "Ferro negre", w: 300, h: 300, thickness: 20, x: 50, y: 0, z: 50, shape: ellipse(300, 300) },
        { name: "Pal", orient: "flat", material: "Ferro negre", w: 20, h: 20, thickness: 1500, x: 190, y: 20, z: 190, shape: ellipse(20, 20) },
        cyl("Bombeta", "Bombeta", 200, 1520, 200, 65, 100),
        ...tube("Pantalla", "Lli blanc", 200, 1450, 200, 400, 300),
      ]),
  },
  {
    id: "object-plant",
    kind: "objecte",
    name: "Planta en test",
    description: "Ø 600 × 1200 mm · test de terracota i capçada en tres pisos.",
    make: () =>
      obj([
        { name: "Test", orient: "flat", material: "Pintura terracota", w: 380, h: 380, thickness: 400, x: 110, y: 0, z: 110, shape: ellipse(380, 380) },
        // Capçada en tres pisos cada cop més petits (silueta d'arbust).
        { name: "Tronc", orient: "flat", material: "Roure massís / xapat", w: 40, h: 40, thickness: 250, x: 280, y: 400, z: 280, shape: ellipse(40, 40) },
        { name: "Fulles", orient: "flat", material: "Vellut verd", w: 600, h: 600, thickness: 260, x: 0, y: 560, z: 0, shape: ellipse(600, 600) },
        { name: "Fulles", orient: "flat", material: "Vellut verd", w: 460, h: 460, thickness: 220, x: 70, y: 820, z: 70, shape: ellipse(460, 460) },
        { name: "Fulles", orient: "flat", material: "Vellut verd", w: 280, h: 280, thickness: 160, x: 160, y: 1040, z: 160, shape: ellipse(280, 280) },
      ]),
  },
  {
    id: "object-mirror",
    kind: "objecte",
    name: "Mirall rodó",
    description: "Ø 800 mm · per penjar (posa'l a l'alçada amb «Del terra»).",
    make: () => obj([{ name: "Mirall", orient: "front", material: "Mirall", w: 800, h: 800, thickness: 20, x: 0, y: 0, z: 0, shape: ellipse(800, 800) }]),
  },
  {
    id: "object-round-table",
    kind: "objecte",
    name: "Taula rodona",
    description: "Ø 1100 × 750 mm · tauler de roure sobre peu central.",
    make: () =>
      obj([
        { name: "Tauler", orient: "flat", material: "Roure massís / xapat", w: 1100, h: 1100, thickness: 30, x: 0, y: 720, z: 0, shape: ellipse(1100, 1100) },
        { name: "Peu", orient: "flat", material: "Ferro negre", w: 120, h: 120, thickness: 700, x: 490, y: 20, z: 490, shape: ellipse(120, 120) },
        { name: "Base", orient: "flat", material: "Ferro negre", w: 550, h: 550, thickness: 20, x: 275, y: 0, z: 275, shape: ellipse(550, 550) },
      ]),
  },
  ...MAG_OBJECTS,
  // Models 3D de debò (Poly Haven, CC0): les falgueres soles i una en un test de ceràmica.
  ...MODEL_ASSETS.map((a) => ({
    id: `object-model-${a.id}`,
    kind: "objecte" as const,
    name: a.name,
    description: `${a.size[0]} × ${a.size[1]} × ${a.size[2]} mm · model 3D (fulles de debò).`,
    make: () => ({ ...obj([]), models: [newModelObject(newId("g"), a, { x: 0, y: 0, z: 0 })] }),
  })),
  {
    id: "object-model-fern-pot",
    kind: "objecte",
    name: "Falguera en test",
    description: "Ø 380 × 530 mm · test de ceràmica blanca i falguera (model 3D).",
    make: () => {
      const a = MODEL_ASSETS.find((m) => m.id === "fern-02-c")!
      const k = 600 / a.size[0]
      const [w, h, d] = [Math.round(a.size[0] * k), Math.round(a.size[1] * k), Math.round(a.size[2] * k)]
      return { ...obj([cyl("Test", "Ceràmica blanca", 300, 0, 300, 380, 320)]), models: [{ ...newModelObject(newId("g"), a, { x: 300 - w / 2, y: 290, z: 300 - d / 2 }, "Falguera"), w, h, d }] }
    },
  },
]
