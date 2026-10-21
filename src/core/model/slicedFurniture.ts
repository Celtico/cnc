import { defaultModule, newId, type Composition, type RefObject } from "./composition"
import { DEFAULT_JOINERY } from "./freePart"
import { loftCage } from "./meshShape"
import { applySlices, DEFAULT_SLICES, type SliceOptions } from "./slices"
import type { Template } from "./templates"

/**
 * Catàleg «Llistons» (per decisió de l'usuari, 2026-10-21: «mobles com aquests», bancs, sofàs, taulells i murals de
 * llistons): cada moble és una **forma lliure** (estirada al llarg de X amb `loftCage`, amagada al seu grup) tallada amb
 * la drecera «Tallar en llistons» (`slices.ts`). Es pot mostrar la forma, editar-la a l'editor de malla i tornar-la a
 * tallar amb un altre gruix, separació o barres.
 */

type Ring = [number, number][]

const OAK = "Roure massís / xapat"
const WAL = "Noguera xapada"
const ASH = "Freixe xapat"

interface SlicedDesign {
  name: string
  style: string
  use: string
  price: number
  /** Llarg (X) i seccions `[z, y]` (mm) en `n` punts del llarg (t de 0 a 1). */
  length: number
  n: number
  ring: (t: number) => Ring
  /** Costats de la secció que queden plans (terra, paret, sobre). */
  sharp: number[]
  /** On va (alçada del punt més baix). */
  y?: number
  opts: Partial<SliceOptions>
}

/** La forma lliure del disseny (mm) a la composició. */
function designShape(d: SlicedDesign): RefObject {
  const xs = Array.from({ length: d.n }, (_, i) => (i * d.length) / (d.n - 1))
  const { cage, box } = loftCage(xs.map((x) => d.ring(x / d.length)), xs, d.sharp)
  return { id: newId("r"), name: d.name, shape: "mesh", mesh: cage, ...box, y: box.y + (d.y ?? 0) }
}

/** El moble: la forma i els llistons, en una composició de peces lliures. */
function slicedComposition(d: SlicedDesign): Composition {
  const shape = designShape(d)
  const comp: Composition = { kind: "lliure", modules: [defaultModule(newId("m"), "Mòdul 1")], references: [shape], parts: [], joinery: { ...DEFAULT_JOINERY } }
  return applySlices(comp, shape.id, { ...DEFAULT_SLICES, ...d.opts }).comp
}

const wave = (t: number, cycles: number, phase = 0) => Math.sin((t * cycles + phase) * Math.PI * 2)
const bump = (t: number, at: number, width: number) => Math.exp(-(((t - at) / width) ** 2))

const SEATS: SlicedDesign[] = [
  {
    name: "Ona",
    style: "Paramètric",
    use: "Banc d'ona de 2 m: el seient puja i baixa al llarg, llistons de costat amb dues barres roscades",
    price: 1490,
    length: 2000,
    n: 11,
    ring: (t) => {
      const H = 420 + 110 * wave(t, 1.25)
      return [[0, 0], [450, 0], [470, H * 0.8], [380, H], [70, H], [-20, H * 0.8]]
    },
    sharp: [0],
    opts: { thickness: 19, gap: 15, material: OAK },
  },
  {
    name: "Duna",
    style: "Paramètric",
    use: "Sofà amb el respatller que creix cap a un extrem (com una duna), de llistons de noguera",
    price: 2390,
    length: 2200,
    n: 11,
    ring: (t) => {
      const B = 150 + 650 * (1 - t) ** 1.4
      return [[0, 0], [850, 0], [880, 320], [760, 410], [280, 400], [150, 400 + 0.45 * B], [70, 400 + B], [-20, 400 + 0.55 * B]]
    },
    sharp: [0],
    opts: { thickness: 19, gap: 19, material: WAL },
  },
  {
    name: "Còdol",
    style: "Orgànic",
    use: "Tamboret de llistons amb la cintura estreta i el seient pla",
    price: 390,
    length: 420,
    n: 7,
    ring: (t) => {
      const f = 0.55 + 0.45 * Math.sin(t * Math.PI)
      const z = (v: number) => 190 + (v - 190) * f
      return [[z(60), 0], [z(320), 0], [z(380), 230], [z(340), 450], [z(40), 450], [z(0), 230]]
    },
    sharp: [0, 3],
    opts: { thickness: 19, gap: 10, material: OAK },
  },
]

const COUNTERS: SlicedDesign[] = [
  {
    name: "Recepció",
    style: "Paramètric",
    use: "Taulell de recepció d'ona: el davant fa onades, el sobre i el darrere plans per treballar-hi",
    price: 3290,
    length: 2400,
    n: 13,
    ring: (t) => {
      const s = wave(t, 1.5)
      return [[0, 0], [480 + 60 * s, 0], [620 + 90 * s, 450], [700 + 70 * s, 1060], [650, 1100], [0, 1100]]
    },
    sharp: [0, 4, 5],
    opts: { thickness: 19, gap: 12, material: ASH, rods: 3 },
  },
  {
    name: "Cala",
    style: "Paramètric",
    use: "Barra de bar amb el davant que es buida i s'infla, i el sobre pla",
    price: 2490,
    length: 1600,
    n: 9,
    ring: (t) => {
      const s = 0.5 + 0.5 * wave(t, 1, 0.25)
      return [[0, 0], [380 - 80 * s, 0], [430 - 120 * s, 500], [560, 1000], [560, 1050], [0, 1050]]
    },
    sharp: [0, 4, 5],
    opts: { thickness: 19, gap: 19, material: WAL, rods: 3 },
  },
  {
    name: "Riera",
    style: "Orgànic",
    use: "Taula de centre amb un pont a sota (cada llistó és un arc) i el sobre pla",
    price: 690,
    length: 1100,
    n: 9,
    ring: (t) => {
      const a = 170 + 60 * wave(t, 1)
      return [[0, 0], [130, 0], [190, a], [410, a], [470, 0], [600, 0], [620, 330], [600, 380], [0, 380], [-20, 330]]
    },
    sharp: [0, 4, 7],
    opts: { thickness: 19, gap: 12, material: OAK, rods: 2 },
  },
]

const WALL: SlicedDesign[] = [
  {
    name: "Onada",
    style: "Paramètric",
    use: "Prestatge de paret: el sobre pla i a sota una onada que creix cap a un costat",
    price: 490,
    length: 1600,
    n: 13,
    ring: (t) => {
      const D = 230 + 40 * wave(t, 1)
      const H = 70 + 230 * bump(t, 0.62, 0.16)
      return [[0, 300 - H], [0.55 * D, 300 - 0.5 * H], [D, 280], [D, 300], [0, 300]]
    },
    sharp: [3, 4],
    y: 1150,
    opts: { thickness: 16, gap: 12, material: WAL, rodDiameter: 8 },
  },
  {
    name: "Marea",
    style: "Escultòric",
    use: "Mural de paret de llistons: les onades corren en diagonal",
    price: 790,
    length: 1800,
    n: 13,
    ring: (t) => {
      const ys = [0, 150, 300, 450, 600, 750, 900]
      return [[0, 0], ...ys.map((y): [number, number] => [70 + 50 * wave(y / 900, 1.2, t * 0.8), y]), [0, 900]]
    },
    sharp: [8],
    y: 900,
    opts: { thickness: 16, gap: 14, material: ASH, rodDiameter: 8 },
  },
  {
    name: "Dunes",
    style: "Orgànic",
    use: "Capçal de llit a terra contra la paret, amb el cim fent dunes",
    price: 990,
    length: 1800,
    n: 13,
    ring: (t) => {
      const H = 1000 + 180 * wave(t, 1.3)
      return [[0, 0], [70, 0], [110, 0.6 * H], [80, H], [0, H + 60]]
    },
    sharp: [0, 4],
    opts: { thickness: 19, gap: 15, material: OAK },
  },
]

const LABEL: Record<string, string> = { [OAK]: "roure", [WAL]: "noguera", [ASH]: "freixe" }

function slicedType(type: string, designs: SlicedDesign[]): { name: string; items: Template[] } {
  return {
    name: type,
    items: designs.map((d, i) => {
      // La mida, de la forma (sense tallar: el catàleg no fa els llistons fins que no es tria).
      const s = designShape(d)
      const o = { ...DEFAULT_SLICES, ...d.opts }
      return {
        id: `store-llistons-${type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i + 1}`,
        kind: "lliure" as const,
        name: `${type} «${d.name}»`,
        description: `${d.style} · ${Math.round(s.w)} × ${Math.round(s.h + s.y)} × ${Math.round(s.d)} mm · llistons de ${LABEL[o.material] ?? o.material} de ${o.thickness} mm cada ${o.thickness + o.gap} mm. ${d.use}.`,
        price: d.price,
        make: () => slicedComposition(d),
      }
    }),
  }
}

/** Els tipus del catàleg «Llistons». */
export const SLICED_TYPES = [slicedType("Seients", SEATS), slicedType("Taulells i taules", COUNTERS), slicedType("Paret", WALL)]
