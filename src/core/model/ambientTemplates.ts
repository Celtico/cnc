import { OBJECT_TEMPLATES, roomWalls, type Opening, type Wall } from "./ambient"
import { MAG_FURNITURE } from "./magFurniture"
import { STORE_CATALOG } from "./storeCatalog"
import { BUILTIN_TEMPLATES, type Template } from "./templates"

/**
 * Catàleg d'ambients «de revista»: habitacions moblades amb mobles de les plantilles (de l'app i
 * de botiga) i objectes, pensades per fer-ne renders (ray tracing) per a la web i el catàleg.
 * En crear-ne un, cada moble i objecte es crea a Mobles / Objectes (un per plantilla, encara que
 * surti diverses vegades) i es col·loca a l'ambient.
 *
 * Referències: `store:<categoria>:<Tipus «Nom»>`, `app:<id>`, `object:<id>` o `mag:<id>` (mobles de les
 * escenes de revista, `MAG_FURNITURE`).
 * Col·locació: arrambat a una paret (`wall` N/S/E/O, amb el darrere a la paret; `at` = centre al
 * llarg de la paret, `gap` = separació) o lliure (`x`, `y` = centre, `rot`).
 */
export type WallSide = "N" | "S" | "E" | "W"

export interface AmbientTemplateItem {
  ref: string
  wall?: WallSide
  at?: number
  gap?: number
  x?: number
  y?: number
  rot?: number
  elevation?: number
  group?: string
}

/** Categories del catàleg d'ambients (acordions de la pàgina Ambients). */
export const AMBIENT_CATEGORIES = [
  { id: "salo", label: "Salons" },
  { id: "cuina", label: "Cuines" },
  { id: "menjador", label: "Menjadors" },
  { id: "dormitori", label: "Dormitoris" },
  { id: "infantil", label: "Habitacions infantils i juvenils" },
  { id: "vestidor", label: "Vestidors" },
  { id: "entrada", label: "Rebedors" },
  { id: "despatx", label: "Despatxos" },
  { id: "bany", label: "Banys" },
  { id: "exterior", label: "Exteriors: terrasses i patis" },
] as const
export type AmbientCategory = (typeof AMBIENT_CATEGORIES)[number]["id"]

export interface AmbientTemplate {
  id: string
  category: AmbientCategory
  name: string
  description: string
  /** Mides interiors de l'habitació (mm). */
  w: number
  d: number
  floor: string
  wall: string
  /** Alçada de les parets (per defecte 2600). */
  height?: number
  /** Material d'una paret concreta (la del fons de pedra, la negra de les golfes…). */
  walls?: Partial<Record<WallSide, string>>
  /** Parets baixes (ampit d'una terrassa): alçada en mm. */
  low?: Partial<Record<WallSide, number>>
  /** Costats sense paret (pati obert). */
  open?: WallSide[]
  /** Finestres, portes i vidrieres: `at` = centre, en x (N, S) o en y (E, O) de l'habitació. */
  openings?: (Omit<Opening, "at"> & { side: WallSide; at: number })[]
  items: AmbientTemplateItem[]
}

/** Parets d'una plantilla: les quatre de l'habitació amb els materials, alçades i obertures. */
export function templateWalls(t: AmbientTemplate): Wall[] {
  const sides: WallSide[] = ["N", "E", "S", "W"] // ordre de `roomWalls`
  return roomWalls(0, 0, t.w, t.d, TEMPLATE_WALL, t.height ?? 2600).flatMap((w, i) => {
    const side = sides[i]!
    if (t.open?.includes(side)) return []
    // `at` de la paret: des de l'extrem a (N: x, E: y, S: w − x, O: d − y).
    const along = (at: number) => (side === "N" ? at : side === "E" ? at : side === "S" ? t.w - at : t.d - at)
    const openings = (t.openings ?? []).filter((o) => o.side === side).map(({ side: _s, at, ...o }) => ({ ...o, at: along(at) }))
    return [{ ...w, ...(t.low?.[side] ? { height: t.low[side]! } : {}), ...(t.walls?.[side] ? { material: t.walls[side] } : {}), ...(openings.length ? { openings } : {}) }]
  })
}

/** Gruix de les parets de les plantilles: les cares de dins són a 50 mm de l'eix. */
export const TEMPLATE_WALL = 100

export function resolveTemplateRef(ref: string): Template | undefined {
  const [kind, a, ...rest] = ref.split(":")
  if (kind === "app") return BUILTIN_TEMPLATES.find((t) => t.id === a)
  if (kind === "object") return OBJECT_TEMPLATES.find((t) => t.id === a)
  if (kind === "mag") return MAG_FURNITURE.find((t) => t.id === a)
  if (kind === "store") {
    const name = rest.join(":")
    return STORE_CATALOG.find((c) => c.id === a)?.types.flatMap((t) => t.items).find((t) => t.name === name)
  }
  return undefined
}

/** Centre i gir d'un element (de petjada w × d) a l'habitació (eixos de les parets a 0 i a w/d). */
export function placeTemplateItem(t: Pick<AmbientTemplate, "w" | "d">, it: AmbientTemplateItem, size: { w: number; d: number }): { x: number; y: number; rot: number } {
  const face = TEMPLATE_WALL / 2
  const g = it.gap ?? 0
  const half = size.d / 2
  switch (it.wall) {
    case "N":
      return { x: it.at ?? t.w / 2, y: face + g + half, rot: 0 }
    case "S":
      return { x: it.at ?? t.w / 2, y: t.d - face - g - half, rot: 180 }
    case "E":
      return { x: t.w - face - g - half, y: it.at ?? t.d / 2, rot: 90 }
    case "W":
      return { x: face + g + half, y: it.at ?? t.d / 2, rot: 270 }
    default:
      return { x: it.x ?? t.w / 2, y: it.y ?? t.d / 2, rot: it.rot ?? 0 }
  }
}

const chairsAround = (cx: number, cy: number, len: number, depth: number, n: number, group: string, ref = "object:object-chair"): AmbientTemplateItem[] => {
  const xs = Array.from({ length: n }, (_, i) => cx - len / 2 + (len / n) * (i + 0.5))
  return [
    ...xs.map((x) => ({ ref, x, y: cy - depth / 2 - 300, rot: 0, group })),
    ...xs.map((x) => ({ ref, x, y: cy + depth / 2 + 300, rot: 180, group })),
  ]
}

const O = (id: string) => `object:object-${id}`
/** Llum de sostre penjat perquè toqui el sostre (objectes de 1100 d'alt). */
const pendant = (id: string, x: number, y: number, group: string, ceiling = 2600, h = 1100): AmbientTemplateItem => ({ ref: O(id), x, y, elevation: ceiling - h, group })

/**
 * Escenes de revista (fetes a partir de fotos d'interiors): materials de paret per costat,
 * finestres, vidrieres i portes, cortines, coixins, plantes i llums.
 */
const MAG_SCENES: AmbientTemplate[] = [
  {
    id: "amb-mag-stucco",
    category: "salo",
    name: "Saló d'estuc",
    description: "5,6 × 4,6 m · parets d'estuc greige: sofà en L de bouclé, taula cub de noguera, moble penjat amb quadre, finestra amb cortines de lli.",
    w: 5600,
    d: 4600,
    floor: "Parquet de roure",
    wall: "Estuc greige",
    openings: [{ side: "E", kind: "window", at: 2300, w: 1500, h: 1700, sill: 600 }],
    items: [
      { ref: O("rug-jute"), x: 2800, y: 2500 },
      { ref: "app:walnut-floating", wall: "N", at: 2600 },
      { ref: O("art-abstract"), wall: "N", at: 2600, elevation: 1050 },
      { ref: O("plant-small"), wall: "N", at: 3150, gap: 60, elevation: 730 },
      { ref: O("sofa-l"), wall: "S", at: 2700, gap: 150 },
      { ref: O("cube-walnut"), x: 2700, y: 2350 },
      { ref: O("books"), x: 2550, y: 2300, elevation: 400 },
      { ref: O("floor-lamp-arc"), wall: "S", at: 900, gap: 200 },
      { ref: O("plant-tropical"), wall: "N", at: 4900, gap: 150 },
      { ref: O("lounge-chair"), x: 4500, y: 3000, rot: 90 },
      { ref: O("curtain-linen"), wall: "E", at: 950, group: "Cortines" },
      { ref: O("curtain-linen"), wall: "E", at: 3650, group: "Cortines" },
    ],
  },
  {
    id: "amb-mag-attic",
    category: "salo",
    name: "Golfes amb daybeds",
    description: "5 × 4 m · paret del fons negra i terra de fusta rentada: llibreria negra i noguera, dos daybeds amb coixins rodons, catifa de jute i puf.",
    w: 5000,
    d: 4000,
    height: 2500,
    floor: "Fusta rentada",
    wall: "Pintura blanca",
    walls: { N: "Pintura negra" },
    openings: [{ side: "W", kind: "window", at: 2000, w: 1200, h: 900, sill: 1100 }],
    items: [
      { ref: "mag:attic-bookcase", wall: "N", at: 2500 },
      { ref: O("daybed"), wall: "W", at: 2100 },
      { ref: O("daybed"), wall: "E", at: 2100 },
      { ref: O("rug-jute"), x: 2500, y: 2300 },
      { ref: O("pouf"), x: 2500, y: 2400 },
      { ref: O("floor-lamp-arc"), wall: "S", at: 4500, gap: 150 },
      { ref: O("plant-tropical-small"), wall: "N", at: 4200, gap: 100 },
    ],
  },
  {
    id: "amb-mag-hall",
    category: "entrada",
    name: "Rebedor amb consola de noguera",
    description: "3,2 × 2,4 m · terra de porcellànic negre i estuc gris: consola de noguera a inglet, mirall d'arc de llautó, gerro amb branques, butaca i catifa blanca.",
    w: 3200,
    d: 2400,
    floor: "Porcellànic negre",
    wall: "Estuc gris clar",
    openings: [{ side: "E", kind: "door", at: 1300, w: 900, h: 2100, sill: 0 }],
    items: [
      { ref: O("rug-white"), x: 1500, y: 1450, rot: 90 },
      { ref: "app:walnut-console", wall: "N", at: 1500 },
      { ref: O("mirror-arch"), wall: "N", at: 1500, elevation: 900 },
      { ref: O("branches-vase"), wall: "N", at: 1000, gap: 60, elevation: 760 },
      { ref: O("table-lamp"), wall: "N", at: 2000, gap: 30, elevation: 760 },
      { ref: O("armchair-grey"), x: 600, y: 1650, rot: 60 },
    ],
  },
  {
    id: "amb-mag-patio",
    category: "exterior",
    name: "Pati amb cuina exterior",
    description: "7 × 5 m obert per davant · formigó clar: cuina d'exterior amb portes de noguera, armari de noguera, taula oval blanca amb vuit cadires de cuir, pi i plantes tropicals.",
    w: 7000,
    d: 5000,
    height: 2800,
    floor: "Formigó clar",
    wall: "Estuc gris clar",
    open: ["S"],
    items: [
      { ref: "mag:outdoor-kitchen", wall: "N", at: 2600 },
      { ref: "mag:walnut-cabinet", wall: "N", at: 5800 },
      { ref: O("oval-white"), x: 3200, y: 2900 },
      ...chairsAround(3200, 2900, 2400, 1100, 4, "Cadires", O("chair-leather")),
      { ref: O("plant-tropical"), wall: "W", at: 1200, gap: 150 },
      { ref: O("plant-tropical-small"), wall: "W", at: 1800, gap: 150 },
      { ref: O("pine"), x: 5500, y: 3600 },
      { ref: O("olive"), wall: "E", at: 1500, gap: 100 },
    ],
  },
  {
    id: "amb-mag-kilim",
    category: "salo",
    name: "Saló amb kilim",
    description: "6 × 4,8 m · sofà de vellut oliva en L, catifa kilim, taula de llautó, moble TV flotant de roure, butaca lounge i finestra amb cortines.",
    w: 6000,
    d: 4800,
    floor: "Parquet de roure",
    wall: "Pintura blanca",
    openings: [{ side: "W", kind: "window", at: 2400, w: 2000, h: 1800, sill: 500 }],
    items: [
      { ref: O("rug-kilim"), x: 3000, y: 2600, rot: 90 },
      { ref: "mag:tv-floating", wall: "N", at: 3000 },
      { ref: O("tv-65"), wall: "N", at: 3000, elevation: 1000 },
      { ref: O("sofa-olive"), wall: "S", at: 3000, gap: 150 },
      { ref: O("coffee-brass"), x: 3000, y: 2450 },
      { ref: O("lounge-chair"), x: 5000, y: 2300, rot: 90 },
      { ref: O("floor-lamp-arc"), wall: "S", at: 1000, gap: 200 },
      { ref: O("plant-tropical"), wall: "N", at: 5400, gap: 150 },
      { ref: O("curtain-linen"), wall: "W", at: 850, group: "Cortines" },
      { ref: O("curtain-linen"), wall: "W", at: 3950, group: "Cortines" },
    ],
  },
  {
    id: "amb-mag-terrace",
    category: "exterior",
    name: "Terrassa amb vistes",
    description: "7 × 4,2 m · travertí i ampit baix: banc d'obra amb coixins blaus, taula baixa negra, pufs, pi pinyoner i jardineres; vidriera cap a casa.",
    w: 7000,
    d: 4200,
    height: 2800,
    floor: "Travertí",
    wall: "Estuc gris clar",
    low: { E: 1000, S: 1000 },
    open: ["W"],
    openings: [{ side: "N", kind: "glazing", at: 4600, w: 2800, h: 2400, sill: 0, panes: 3 }],
    items: [
      { ref: O("bench-builtin"), wall: "E", at: 2100 },
      { ref: O("low-table-black"), x: 5700, y: 2100, rot: 90 },
      { ref: O("pouf"), x: 4700, y: 1500 },
      { ref: O("pouf"), x: 4700, y: 2700 },
      { ref: O("pine"), x: 1600, y: 2700 },
      { ref: O("planter"), wall: "S", at: 4200 },
      { ref: O("planter"), wall: "S", at: 5700 },
      { ref: O("olive"), wall: "N", at: 2200, gap: 100 },
    ],
  },
  {
    id: "amb-mag-green-kitchen",
    category: "cuina",
    name: "Cuina verd fosc i roure",
    description: "5,4 × 4,2 m · cuina lacada verd fosc amb taulell de roure, armari de roure amb fornícula, taula de pagès amb cadires de corda i llum de lli.",
    w: 5400,
    d: 4200,
    floor: "Parquet de roure",
    wall: "Pintura blanca",
    openings: [{ side: "E", kind: "window", at: 2700, w: 1200, h: 1300, sill: 1000 }],
    items: [
      { ref: "mag:green-kitchen", wall: "N", at: 2700 },
      { ref: "mag:oak-niche", wall: "W", at: 2700 },
      { ref: "mag:farm-table", x: 2900, y: 2800 },
      ...chairsAround(2900, 2800, 2200, 950, 3, "Cadires", O("chair-oak")),
      pendant("pendant-drum", 2900, 2800, "Llums", 2600, 1000),
      { ref: O("plant-small"), x: 2600, y: 2800, elevation: 760 },
      { ref: O("stool"), wall: "E", at: 1500, gap: 200 },
    ],
  },
  {
    id: "amb-mag-black-island",
    category: "cuina",
    name: "Cuina oberta amb illa negra",
    description: "7 × 5,2 m · paret de pedra: cuina de roure amb prestatges, columnes negres, illa negra amb barra i tamborets, llums negres, taula rodona i vidriera.",
    w: 7000,
    d: 5200,
    floor: "Parquet de roure",
    wall: "Pintura blanca",
    walls: { N: "Pedra de paret" },
    openings: [{ side: "E", kind: "glazing", at: 2800, w: 3000, h: 2400, sill: 0, panes: 3 }],
    items: [
      { ref: "mag:oak-run", wall: "N", at: 3200 },
      { ref: "mag:black-talls", wall: "W", at: 2100 },
      { ref: "mag:black-island", x: 3200, y: 2500 },
      { ref: O("stool"), x: 2500, y: 1650, group: "Tamborets" },
      { ref: O("stool"), x: 3200, y: 1650, group: "Tamborets" },
      { ref: O("stool"), x: 3900, y: 1650, group: "Tamborets" },
      pendant("pendant-black", 2600, 2600, "Llums"),
      pendant("pendant-black", 3800, 2600, "Llums"),
      { ref: O("round-table"), x: 5600, y: 4000 },
      { ref: O("chair-oak"), x: 5600, y: 3200, rot: 0, group: "Cadires" },
      { ref: O("chair-oak"), x: 4800, y: 4000, rot: 270, group: "Cadires" },
      { ref: O("plant-tropical"), wall: "S", at: 1000, gap: 150 },
    ],
  },
  {
    id: "amb-mag-greige-kitchen",
    category: "cuina",
    name: "Cuina greige",
    description: "5,8 × 5 m · estuc greige i pedra calcària: cuina greige amb columnes i alts, illa de pedra, llums de cúpula sàlvia i cadires de cuir.",
    w: 5800,
    d: 5000,
    floor: "Pedra calcària",
    wall: "Estuc greige",
    openings: [{ side: "W", kind: "window", at: 3600, w: 1400, h: 1500, sill: 900 }],
    items: [
      { ref: "mag:greige-kitchen", wall: "N", at: 2900 },
      pendant("pendant-dome", 2500, 2150, "Llums"),
      pendant("pendant-dome", 3300, 2150, "Llums"),
      { ref: O("chair-leather"), x: 2200, y: 3000, rot: 180, group: "Cadires" },
      { ref: O("chair-leather"), x: 2900, y: 3000, rot: 180, group: "Cadires" },
      { ref: O("chair-leather"), x: 3600, y: 3000, rot: 180, group: "Cadires" },
      { ref: O("branches-vase"), x: 3300, y: 2200, elevation: 900 },
      { ref: O("plant-tropical"), wall: "E", at: 4200, gap: 150 },
    ],
  },
  {
    id: "amb-mag-stone-dining",
    category: "menjador",
    name: "Menjador de pedra",
    description: "6,4 × 5 m · taula de pedra calcària amb vuit cadires de cuir verd, armari de paret blanc, aparador flotant gris amb quadre, llums negres i planta.",
    w: 6400,
    d: 5000,
    floor: "Pedra calcària",
    wall: "Pintura blanca",
    openings: [{ side: "E", kind: "window", at: 2400, w: 1600, h: 1700, sill: 700 }],
    items: [
      { ref: "mag:white-closet", wall: "N", at: 3200 },
      { ref: O("stone-table"), x: 3300, y: 2800 },
      ...chairsAround(3300, 2800, 2600, 1000, 4, "Cadires", O("chair-leather")),
      { ref: "mag:floating-grey", wall: "W", at: 2800 },
      { ref: O("art-dark"), wall: "W", at: 2800, elevation: 1150 },
      { ref: O("plant-tropical"), wall: "E", at: 4300, gap: 150 },
      pendant("pendant-black", 2800, 2800, "Llums"),
      pendant("pendant-black", 3800, 2800, "Llums"),
      { ref: O("branches-vase"), x: 3300, y: 2800, elevation: 750 },
    ],
  },
  {
    id: "amb-mag-wardrobe",
    category: "vestidor",
    name: "Vestidor gris",
    description: "4,4 × 3,6 m · vestidor lacat gris de quatre cossos, butaca, taula de formigó amb rodes, catifa rodona i mirall de noguera.",
    w: 4400,
    d: 3600,
    floor: "Parquet de roure",
    wall: "Pintura blanca",
    openings: [{ side: "W", kind: "window", at: 2300, w: 1000, h: 1400, sill: 900 }],
    items: [
      { ref: "mag:grey-wardrobe", wall: "N", at: 2200 },
      { ref: O("rug-round"), x: 2200, y: 2300 },
      { ref: O("armchair-grey"), x: 1200, y: 2600, rot: 30 },
      { ref: O("concrete-cart"), x: 2400, y: 2350 },
      { ref: O("mirror-rect"), wall: "E", at: 2000, elevation: 250 },
      { ref: O("floor-lamp-arc"), wall: "S", at: 3800, gap: 150 },
      { ref: O("plant-small"), x: 2500, y: 2350, elevation: 320 },
    ],
  },
  {
    id: "amb-mag-bunks",
    category: "infantil",
    name: "Habitació de lliteres",
    description: "4,8 × 3,8 m · parets rosa pàl·lid: lliteres encastades de noguera, pufs de lona, catifa rodona i quadre.",
    w: 4800,
    d: 3800,
    floor: "Parquet de roure",
    wall: "Pintura rosa pàl·lid",
    openings: [{ side: "E", kind: "window", at: 2500, w: 1000, h: 1200, sill: 900 }],
    items: [
      { ref: "app:bunk-beds", wall: "N", at: 2400 },
      { ref: O("rug-round"), x: 2400, y: 2600 },
      { ref: O("pouf-bean"), x: 1600, y: 2700 },
      { ref: O("pouf-bean"), x: 3000, y: 3000 },
      { ref: O("art-abstract"), wall: "W", at: 2700, elevation: 900 },
      { ref: O("plant-tropical-small"), wall: "S", at: 4300, gap: 100 },
    ],
  },
  {
    id: "amb-mag-oak-kitchen",
    category: "cuina",
    name: "Cuina de roure amb illa",
    description: "6 × 5,2 m · paret revestida de roure: cuina de roure amb illa de calaixos, taula amb estovalles de lli, cadires de corda, llums sàlvia i vidriera.",
    w: 6000,
    d: 5200,
    floor: "Parquet de roure",
    wall: "Pintura blanca",
    walls: { N: "Revestiment de roure" },
    openings: [{ side: "W", kind: "glazing", at: 2600, w: 2400, h: 2300, sill: 0, panes: 2 }],
    items: [
      { ref: "app:oak-kitchen", wall: "N", at: 3000 },
      pendant("pendant-dome", 3000, 2000, "Llums"),
      { ref: O("table-cloth"), x: 3000, y: 3950 },
      ...chairsAround(3000, 3950, 2040, 990, 3, "Cadires", O("chair-oak")),
      pendant("pendant-dome", 3000, 3950, "Llums"),
      { ref: O("plant-small"), x: 3000, y: 3950, elevation: 762 },
      { ref: O("plant-tropical"), wall: "E", at: 4500, gap: 150 },
    ],
  },
  {
    id: "amb-mag-curtains",
    category: "menjador",
    name: "Menjador amb cortines",
    description: "6,2 × 5 m · vidriera de terra a sostre amb cortines de lli i tul, taula amb estovalles i sis cadires, llums de lli, llibreria i sofà.",
    w: 6200,
    d: 5000,
    floor: "Parquet de roure",
    wall: "Pintura blanca",
    openings: [{ side: "E", kind: "glazing", at: 2500, w: 4400, h: 2500, sill: 0, panes: 4 }],
    items: [
      { ref: "store:salo:Llibreria «Grid»", wall: "N", at: 2500 },
      { ref: O("plant-tropical"), wall: "N", at: 4500, gap: 150 },
      { ref: O("table-cloth"), x: 3200, y: 2600 },
      ...chairsAround(3200, 2600, 2040, 990, 3, "Cadires", O("chair-oak")),
      pendant("pendant-drum", 2700, 2600, "Llums", 2600, 1000),
      pendant("pendant-drum", 3700, 2600, "Llums", 2600, 1000),
      { ref: O("sofa-linen"), wall: "W", at: 2600 },
      { ref: O("curtain-linen"), wall: "E", at: 850, group: "Cortines" },
      { ref: O("curtain-tulle"), wall: "E", at: 2500, group: "Cortines" },
      { ref: O("curtain-linen"), wall: "E", at: 4150, group: "Cortines" },
    ],
  },
]

/**
 * Escenes amb les plantes de debò (models 3D de Poly Haven: falgueres, xicranda i avet), primer al catàleg.
 * Exteriors oberts per a l'arbre; interiors verds amb falgueres en test.
 */
const F = (id: string) => O(`model-${id}`)
const PLANT_SCENES: AmbientTemplate[] = [
  {
    id: "amb-plant-jacaranda",
    category: "exterior",
    name: "Jardí amb xicranda",
    description: "10 × 8 m obert per davant i per un costat · rajola de fang: xicranda al mig, taula de pedra amb sis cadires de roure a l'ombra, banc d'obra i falgueres al peu de la paret de pedra.",
    w: 10000,
    d: 8000,
    height: 2400,
    floor: "Rajola de fang 300",
    wall: "Pedra de paret",
    open: ["S", "E"],
    items: [
      { ref: F("jacaranda"), x: 5600, y: 4100 },
      { ref: O("stone-table"), x: 5600, y: 4300 },
      ...chairsAround(5600, 4300, 2200, 1000, 3, "Cadires", O("chair-oak")),
      { ref: O("bench-builtin"), wall: "W", at: 4000 },
      { ref: F("fern-02-b"), wall: "N", at: 1300, gap: 100, group: "Falgueres" },
      { ref: F("fern-02-c"), wall: "N", at: 2400, gap: 150, group: "Falgueres" },
      { ref: F("fern-02-a"), wall: "N", at: 3300, gap: 100, group: "Falgueres" },
      { ref: F("fern-02-b"), wall: "N", at: 8200, gap: 100, group: "Falgueres" },
      { ref: F("fern-02-d"), wall: "N", at: 9200, gap: 100, group: "Falgueres" },
      { ref: F("fern-pot"), wall: "W", at: 1200, gap: 150 },
      { ref: F("fern-pot"), wall: "W", at: 6800, gap: 150 },
      { ref: O("rug-jute"), x: 1700, y: 4000, rot: 90 },
    ],
  },
  {
    id: "amb-plant-firs",
    category: "exterior",
    name: "Terrassa entre avets",
    description: "8 × 5 m · fusta rentada i ampit baix: tres avets al fons, daybed amb coixins, taula baixa negra, pufs i falgueres en test als racons.",
    w: 8000,
    d: 5000,
    height: 2600,
    floor: "Fusta rentada",
    wall: "Estuc gris clar",
    low: { E: 900, S: 900 },
    open: ["W"],
    items: [
      { ref: F("fir-01"), wall: "N", at: 1300, gap: 150, group: "Avets" },
      { ref: F("fir-01"), wall: "N", at: 4000, gap: 400, group: "Avets" },
      { ref: F("fir-01"), wall: "N", at: 6700, gap: 150, group: "Avets" },
      { ref: O("daybed"), wall: "S", at: 4000, gap: 200 },
      { ref: O("low-table-black"), x: 4000, y: 2600 },
      { ref: O("pouf"), x: 2700, y: 2500 },
      { ref: O("pouf-bean"), x: 5300, y: 2600 },
      { ref: F("fern-pot"), wall: "E", at: 600, gap: 100 },
      { ref: F("fern-pot"), wall: "E", at: 4400, gap: 100 },
      { ref: F("fern-02-c"), wall: "S", at: 900, gap: 100 },
      { ref: O("rug-round"), x: 4000, y: 2600 },
    ],
  },
  {
    id: "amb-plant-living",
    category: "salo",
    name: "Saló de falgueres",
    description: "6 × 4,8 m · parquet de roure i parets verd sàlvia: sofà de lli, taula de centre cub, butaca de teixit, catifa rodona i falgueres en test al costat de la vidriera.",
    w: 6000,
    d: 4800,
    floor: "Parquet de roure",
    wall: "Pintura verd sàlvia",
    openings: [{ side: "E", kind: "glazing", at: 2400, w: 2600, h: 2300, sill: 0, panes: 3 }],
    items: [
      { ref: O("rug-round"), x: 2700, y: 2500 },
      { ref: O("sofa-linen"), wall: "W", at: 2400, gap: 150 },
      { ref: O("cube-walnut"), x: 2700, y: 2400 },
      { ref: O("armchair-grey"), x: 3900, y: 1300, rot: 220 },
      { ref: F("fern-pot"), wall: "E", at: 700, gap: 150, group: "Falgueres" },
      { ref: F("fern-pot"), wall: "E", at: 4100, gap: 150, group: "Falgueres" },
      { ref: F("fern-02-a"), wall: "N", at: 5300, gap: 100, group: "Falgueres" },
      { ref: O("floor-lamp-arc"), wall: "N", at: 800, gap: 200 },
      { ref: O("art-abstract"), wall: "W", at: 2400, elevation: 1300 },
      { ref: O("books"), x: 2650, y: 2450, elevation: 380 },
    ],
  },
  {
    id: "amb-plant-hall",
    category: "entrada",
    name: "Rebedor verd",
    description: "4 × 2,4 m · terra de rajola de fang i parets verd fosc: mirall d'arc, banc d'obra, catifa de jute i falgueres en test a banda i banda.",
    w: 4000,
    d: 2400,
    floor: "Rajola de fang 300",
    wall: "Pintura verd fosc",
    items: [
      { ref: O("mirror-arch"), wall: "N", at: 2000, elevation: 900 },
      { ref: O("bench-builtin"), wall: "N", at: 2000 },
      { ref: O("rug-jute"), x: 2000, y: 1500 },
      { ref: F("fern-pot"), wall: "N", at: 450, gap: 60 },
      { ref: F("fern-pot"), wall: "N", at: 3550, gap: 60 },
    ],
  },
]

export const AMBIENT_TEMPLATES: AmbientTemplate[] = [
  ...PLANT_SCENES,
  ...MAG_SCENES,
  {
    id: "amb-nordic-living",
    category: "salo",
    name: "Saló nòrdic",
    description: "5,2 × 4,2 m · parquet de roure i parets blanques: moble TV «Oslo», sofà de tres places, taula de centre oval, llibreria i làmpada de peu.",
    w: 5200,
    d: 4200,
    floor: "Parquet de roure",
    wall: "Pintura blanca",
    items: [
      { ref: "object:object-rug", x: 2600, y: 2300, rot: 90 },
      { ref: "store:salo:Moble TV «Oslo»", wall: "N", at: 2600 },
      { ref: "object:object-sofa-3", wall: "S", at: 2600, gap: 150 },
      { ref: "store:salo:Taula de centre «Nube»", x: 2600, y: 2350 },
      { ref: "store:salo:Llibreria «Grid»", wall: "W", at: 2100 },
      { ref: "object:object-floor-lamp", wall: "S", at: 1150, gap: 150 },
      { ref: "object:object-plant", wall: "N", at: 4500, gap: 100 },
    ],
  },
  {
    id: "amb-walnut-living",
    category: "salo",
    name: "Saló de noguera",
    description: "5,6 × 4 m · parquet de noguera i parets verd sàlvia: moble TV «Monolit» a inglet, aparador sobre ferro, sofà, butaca i taula auxiliar.",
    w: 5600,
    d: 4000,
    floor: "Parquet de noguera",
    wall: "Pintura verd sàlvia",
    items: [
      { ref: "object:object-rug", x: 2800, y: 2100 },
      { ref: "store:salo:Moble TV «Monolit»", wall: "N", at: 2800 },
      { ref: "object:object-sofa-2", wall: "S", at: 2500, gap: 150 },
      { ref: "object:object-armchair", x: 4300, y: 2400, rot: 240 },
      { ref: "store:salo:Aparador «Forja»", wall: "W", at: 2000 },
      { ref: "store:salo:Taula auxiliar «Nansa»", x: 3700, y: 3350 },
      { ref: "object:object-plant", wall: "N", at: 4900, gap: 100 },
      { ref: "object:object-floor-lamp", wall: "E", at: 3300, gap: 150 },
    ],
  },
  {
    id: "amb-dining",
    category: "menjador",
    name: "Menjador obert",
    description: "5 × 4 m · microciment: taula «Cascada» de roure a inglet amb sis cadires, aparador lacat i planta.",
    w: 5000,
    d: 4000,
    floor: "Microciment gris",
    wall: "Pintura blanca",
    items: [
      { ref: "store:menjador:Taula de menjador «Cascada»", x: 2500, y: 2150 },
      ...chairsAround(2500, 2150, 2000, 950, 3, "Cadires"),
      { ref: "store:menjador:Aparador «Llarg»", wall: "N", at: 2500 },
      { ref: "object:object-plant", wall: "S", at: 600, gap: 100 },
      { ref: "object:object-mirror", wall: "N", at: 2500, elevation: 1150 },
    ],
  },
  {
    id: "amb-kitchen",
    category: "cuina",
    name: "Cuina amb illa",
    description: "5,6 × 4,6 m · rajola gris: cuina «Àgora» amb columnes, alts i illa de pedra, i taula rodona d'esmorzar.",
    w: 5600,
    d: 4600,
    floor: "Rajola gris 600",
    wall: "Pintura blanca",
    items: [
      { ref: "store:cuina:Cuina amb illa «Àgora»", wall: "N", at: 2900 },
      { ref: "object:object-round-table", x: 4600, y: 3700 },
      { ref: "object:object-chair", x: 4600, y: 3000, rot: 0, group: "Esmorzar" },
      { ref: "object:object-chair", x: 3900, y: 3700, rot: 270, group: "Esmorzar" },
      { ref: "object:object-plant", wall: "S", at: 700, gap: 100 },
    ],
  },
  {
    id: "amb-bedroom",
    category: "dormitori",
    name: "Dormitori suite",
    description: "4,6 × 4,2 m · parquet de roure i parets terracota: llit «Serena» amb capçal ample, armari, còmoda de noguera i catifa.",
    w: 4600,
    d: 4200,
    floor: "Parquet de roure",
    wall: "Pintura terracota",
    items: [
      { ref: "object:object-rug", x: 2300, y: 2500, rot: 90 },
      { ref: "store:dormitori:Llit «Serena»", wall: "N", at: 2300 },
      { ref: "store:dormitori:Armari «Essencial»", wall: "W", at: 2500 },
      { ref: "store:dormitori:Còmoda «Línia»", wall: "S", at: 2900 },
      { ref: "object:object-plant", wall: "E", at: 3500, gap: 100 },
      { ref: "object:object-mirror", wall: "S", at: 2900, elevation: 1200 },
    ],
  },
  {
    id: "amb-kids",
    category: "infantil",
    name: "Habitació juvenil",
    description: "3,8 × 3,6 m · lliteres de freixe amb calaixos i escala, escriptori amb cadira i prestatgeria de cubs.",
    w: 3800,
    d: 3600,
    floor: "Parquet de roure",
    wall: "Pintura blanca",
    items: [
      { ref: "store:juvenil:Lliteres «Nit»", wall: "N", at: 1450 },
      { ref: "store:juvenil:Escriptori «Deures»", wall: "S", at: 1200 },
      { ref: "object:object-chair", x: 1000, y: 2550, rot: 0 },
      { ref: "store:juvenil:Prestatgeria «Cubs»", wall: "E", at: 2300 },
      { ref: "object:object-rug", x: 2250, y: 2050, rot: 90 },
    ],
  },
  {
    id: "amb-office",
    category: "despatx",
    name: "Despatx",
    description: "4,4 × 3,8 m · parquet de noguera: llibreria de despatx amb portes, escriptori directiu, calaixera i cadira.",
    w: 4400,
    d: 3800,
    floor: "Parquet de noguera",
    wall: "Pintura blanca",
    items: [
      { ref: "store:despatx:Llibreria «Bufet»", wall: "N", at: 2200 },
      { ref: "store:despatx:Escriptori «Directiu»", x: 2200, y: 2200 },
      { ref: "object:object-chair", x: 2200, y: 2900, rot: 180 },
      { ref: "object:object-plant", wall: "E", at: 3100, gap: 100 },
      { ref: "object:object-floor-lamp", wall: "W", at: 3100, gap: 150 },
    ],
  },
  {
    id: "amb-hall",
    category: "entrada",
    name: "Rebedor",
    description: "3 × 2,4 m · rajola de fang: consola «Tall» amb mirall rodó, penjador obert i sabater prim.",
    w: 3000,
    d: 2400,
    floor: "Rajola de fang 300",
    wall: "Pintura blanca",
    items: [
      { ref: "store:salo:Consola «Tall»", wall: "N", at: 1500 },
      { ref: "object:object-mirror", wall: "N", at: 1500, elevation: 1050 },
      { ref: "store:entrada:Penjador «Rebedor»", wall: "W", at: 1200 },
      { ref: "store:entrada:Sabater «Pas»", wall: "E", at: 1300 },
      { ref: "object:object-plant", wall: "S", at: 2400, gap: 100 },
    ],
  },
  {
    id: "amb-bath",
    category: "bany",
    name: "Bany",
    description: "3 × 2,6 m · rajola blanca i microciment: moble de lavabo amb pedra, armari de mirall penjat, columna i tovalloler.",
    w: 3000,
    d: 2600,
    floor: "Rajola blanca 600",
    wall: "Microciment gris",
    items: [
      { ref: "store:bany:Moble de bany «Pedra»", wall: "N", at: 1100 },
      { ref: "store:bany:Armari de bany «Mirall»", wall: "N", at: 1100 },
      { ref: "store:bany:Columna «Alta»", wall: "N", at: 2000 },
      { ref: "store:bany:Moble auxiliar «Tovalloler»", wall: "E", at: 1800 },
      { ref: "object:object-plant", wall: "S", at: 500, gap: 100 },
    ],
  },
]

/** Posicions de tots els elements d'una plantilla (amb la mida de cada referència). */
export function layoutTemplate(t: AmbientTemplate, sizeOf: (ref: string) => { w: number; d: number }): (AmbientTemplateItem & { x: number; y: number; rot: number })[] {
  return t.items.map((it) => ({ ...it, ...placeTemplateItem(t, it, sizeOf(it.ref)) }))
}
