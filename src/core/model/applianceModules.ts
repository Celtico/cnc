import { APPLIANCE_ITEMS } from "./appliances/applianceCatalog"
import { defaultModule, newId, type Carcass, type Composition, type Module, type Zone } from "./composition"
import type { FreePart } from "./freePart"
import type { HardwareItem } from "./hardwareSchema"

/**
 * Mòduls d'exemple amb electrodomèstics (v46): per a les plantilles i els mòduls de cuina. Les mides són les de la cuina
 * de l'app (baixos de 770 sobre potes de 100: taulell a 870 + 30; columnes de 2100).
 */

/** Una còpia de l'electrodomèstic del catàleg (com les dels mòduls: el moble no canvia si la biblioteca canvia). */
export function applianceById(id: string): HardwareItem {
  const it = APPLIANCE_ITEMS.find((x) => x.id === id)
  if (!it) throw new Error(`Electrodomèstic desconegut: ${id}`)
  return structuredClone(it)
}

/**
 * **Mòdul sense res** per a un aparell de terra (rentaplats, frigorífic sota taulell, rentadora): sense laterals, sense
 * base, sense tapa i sense fons (el nínxol entre els mòduls del costat), amb l'aparell i el seu front de moble. 870 d'alt
 * (fins a sota del taulell dels baixos sobre potes de 100) i el sòcol que es doni (`plinth`, del terra al front).
 */
export function nicheModule(name: string, applianceId: string, plinth: number, c: Partial<Carcass> = {}): Module {
  const m = defaultModule(newId("m"), name, { width: 600, height: 870, depth: 560, sides: { left: false, right: false }, base: { kind: "open" }, top: { kind: "none" }, back: "none", ...c })
  return { ...m, root: { id: newId(), appliance: { hardware: applianceById(applianceId), plinth } } }
}

/**
 * Rentaplats integrable de 60 de porta lliscant (Bosch SMH6YCX02E) en un mòdul sense res: amb el taulell a 870, la porta
 * lliscant admet el front de 765 sobre un sòcol de 103 (el de porta fixa, com a molt 725, demanaria un sòcol de 143).
 */
export const dishwasherModule = (): Module => nicheModule("Rentaplats", "appliance-bosch-smh6ycx02e", 103)

/**
 * Columna del frigorífic combi integrable de porta fixa (Bosch KIN86ADD0, nínxol de 1775): la columna de 600 × 2100 sobre
 * potes de 100, el frigorífic a baix (els dos fronts del catàleg) i un altell amb porta a dalt.
 */
export function fridgeColumn(): Module {
  const m = defaultModule(newId("m"), "Columna frigorífic", { width: 600, height: 2100, depth: 580, base: { kind: "legs", height: 100 } })
  const fridge: Zone = { id: newId(), appliance: { hardware: applianceById("appliance-bosch-kin86add0"), hinge: "right" } }
  return { ...m, root: { id: newId(), split: { dir: "h", sizes: [1775, "auto"], children: [fridge, { id: newId(), front: { kind: "door", mode: "single", hinge: "right" } }] } } }
}

/**
 * Columna de forn i microones (Bosch HBA514ES4 i BFL7221B1): calaixos a baix, el forn (nínxol de 590), el microones (380)
 * i un altell amb porta a dalt.
 */
export function ovenColumn(): Module {
  const m = defaultModule(newId("m"), "Columna forn", { width: 600, height: 2100, depth: 580, base: { kind: "legs", height: 100 } })
  const z = (x: Partial<Zone> = {}): Zone => ({ id: newId(), ...x })
  return {
    ...m,
    root: z({
      split: {
        dir: "h",
        sizes: ["auto", 590, 380, 420],
        children: [z({ front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } }), z({ appliance: { hardware: applianceById("appliance-bosch-hba514es4") } }), z({ appliance: { hardware: applianceById("appliance-bosch-bfl7221b1") } }), z({ front: { kind: "door", mode: "single", hinge: "left" } })],
      },
    }),
  }
}

/**
 * Plantilla «Cuina amb electrodomèstics» (v46): les columnes del frigorífic i del forn amb microones, calaixos, fregadera,
 * el rentaplats en un mòdul sense res i els fogons amb la placa d'inducció sobre dos calaixos; a dalt, alts i el moble de
 * la campana (grup filtrant amb el retall a la base). Taulell de pedra de 30 (sense nesting) sobre els baixos. Cos blanc,
 * fronts de roure (també els dels electrodomèstics).
 */
export function applianceKitchen(): Composition {
  const body = { material: "Melamina blanca", thickness: 19, frontMaterial: "Melamina roure" }
  // Potes de 100 amb el sòcol de fusta davant (a 5 del davant: les potes genèriques són a 50, el peu fa Ø48).
  const legs = { kind: "legs" as const, height: 100, plinth: { setback: 5 } }
  const dress = (m: Module, c: Partial<Carcass> = {}): Module => ({ ...m, carcass: { ...m.carcass, ...body, ...c } })
  const base = (name: string, width: number, root: Omit<Zone, "id">, c: Partial<Carcass> = {}): Module => ({ ...defaultModule(newId("m"), name, { ...body, width, height: 770, depth: 560, base: legs, ...c }), root: { id: newId(), ...root } })
  const wall = (name: string, width: number, root: Omit<Zone, "id">, gapBefore = 0): Module => ({
    ...defaultModule(newId("m"), name, { ...body, width, height: 720, depth: 330, back: "groove", backSetback: 20, backThickness: 10, base: { kind: "wall", height: 1450 } }),
    gapBefore,
    root: { id: newId(), ...root },
  })
  const door = (hinge: "left" | "right") => ({ kind: "door" as const, mode: "single" as const, hinge })
  const fridge = dress(fridgeColumn(), { base: legs })
  const oven = dress(ovenColumn(), { base: legs })
  const drawers = base("Calaixos", 600, { front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } })
  const sink = base("Fregadera", 800, { front: { kind: "door", mode: "double", hinge: "left" } }, { top: { kind: "none" } })
  const dishwasher = dress(dishwasherModule(), { sides: { left: false, right: false }, base: { kind: "open" }, top: { kind: "none" }, back: "none" })
  // La placa va al taulell (no al mòdul, sense tapa): l'avís diu el retall; a sota, dos calaixos.
  const hob = base("Fogons", 600, { front: { kind: "drawers", n: 2, heights: ["auto", "auto"] }, appliance: { hardware: applianceById("appliance-bosch-pie631hc1e") } }, { top: { kind: "none" } })
  const walls = [
    wall("Alt 1", 600, { shelves: { n: 1, adjustable: true }, front: door("left") }, 1200),
    wall("Alt escorreplats", 800, { shelves: { n: 1, adjustable: true }, front: { kind: "flap", dir: "up" } }),
    wall("Alt 3", 600, { shelves: { n: 1, adjustable: true }, front: door("right") }),
    // Fons en ranura retirat 20: hi caben la regleta i els penjadors. A 550 de la placa d'inducció (el grup filtrant en demana 500): el retall a la base i la porta del moble.
    wall("Campana", 600, { front: door("left"), appliance: { hardware: applianceById("appliance-bosch-dln57pc60") } }),
  ]
  const stone: FreePart = { id: newId("p"), name: "Taulell de pedra", material: "Pedra", nest: false, orient: "flat", w: 2600, h: 620, thickness: 30, x: 1200, y: 870, z: 0 }
  return { kind: "cuina", modules: [fridge, oven, drawers, sink, dishwasher, hob, ...walls], references: [], parts: [stone] }
}
