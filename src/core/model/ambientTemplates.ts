import { OBJECT_TEMPLATES } from "./ambient"
import { STORE_CATALOG } from "./storeCatalog"
import { BUILTIN_TEMPLATES, type Template } from "./templates"

/**
 * Catàleg d'ambients «de revista»: habitacions moblades amb mobles de les plantilles (de l'app i
 * de botiga) i objectes, pensades per fer-ne renders (ray tracing) per a la web i el catàleg.
 * En crear-ne un, cada moble i objecte es crea a Mobles / Objectes (un per plantilla, encara que
 * surti diverses vegades) i es col·loca a l'ambient.
 *
 * Referències: `store:<categoria>:<Tipus «Nom»>`, `app:<id>` o `object:<id>`.
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

export interface AmbientTemplate {
  id: string
  name: string
  description: string
  /** Mides interiors de l'habitació (mm). */
  w: number
  d: number
  floor: string
  wall: string
  items: AmbientTemplateItem[]
}

/** Gruix de les parets de les plantilles: les cares de dins són a 50 mm de l'eix. */
export const TEMPLATE_WALL = 100

export function resolveTemplateRef(ref: string): Template | undefined {
  const [kind, a, ...rest] = ref.split(":")
  if (kind === "app") return BUILTIN_TEMPLATES.find((t) => t.id === a)
  if (kind === "object") return OBJECT_TEMPLATES.find((t) => t.id === a)
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

const chairsAround = (cx: number, cy: number, len: number, depth: number, n: number, group: string): AmbientTemplateItem[] => {
  const xs = Array.from({ length: n }, (_, i) => cx - len / 2 + (len / n) * (i + 0.5))
  return [
    ...xs.map((x) => ({ ref: "object:object-chair", x, y: cy - depth / 2 - 300, rot: 0, group })),
    ...xs.map((x) => ({ ref: "object:object-chair", x, y: cy + depth / 2 + 300, rot: 180, group })),
  ]
}

export const AMBIENT_TEMPLATES: AmbientTemplate[] = [
  {
    id: "amb-nordic-living",
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
