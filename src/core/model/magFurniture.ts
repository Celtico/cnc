import { storeBuilders as B } from "./storeCatalog"
import type { Template } from "./templates"
import type { Zone } from "./composition"

/**
 * Mobles de les escenes de revista (catàleg d'ambients) que no eren a les plantilles: cuines
 * de colors, armaris de paret, aparadors flotants… Són mobles de debò (es poden fabricar) fets
 * amb els mateixos constructors del catàleg de botiga. Referència als ambients: `mag:<id>`.
 */
const OAK = "Roure massís / xapat"
const WAL = "Noguera xapada"
const GREEN = "MDF lacat verd fosc"
const BLACK = "MDF lacat negre"
const GREIGE = "MDF lacat greige"
const LGREY = "MDF lacat gris clar"
const WHITE = "MDF lacat"

const RIFT = "Roure de fil"
const GLOSS = "Lacat negre brillant"
/** Compartiment de vitrina: portes de vidre amb marc, prestatges i llum LED. */
const vitrineZone = (): Zone => ({ ...B.doors(3), led: true, front: { kind: "door", mode: "double", hinge: "left", glass: true } })

export const MAG_FURNITURE: Template[] = [
  // --- Showroom (escena «Showroom»: ensenya el render — LED, vitrina, lacat brillant, marbre polit) ---
  {
    id: "show-vitrine",
    kind: "moble",
    name: "Vitrina de roure de fil",
    description: "1600 × 2100 × 420 · dues columnes amb portes de vidre, prestatges i llum LED, calaixos a baix.",
    make: () => B.one(B.box("Vitrina", { w: 1600, h: 2100, d: 420, mat: RIFT, base: B.plinth(60, 20) }, B.h([620, "auto"], [B.v(["auto", "auto"], [B.drawers(2), B.drawers(2)]), B.v(["auto", "auto"], [vitrineZone(), vitrineZone()])]))),
  },
  {
    id: "show-sideboard",
    kind: "moble",
    name: "Aparador lacat negre brillant",
    description: "2000 × 700 × 460 · lacat negre brillant sense tiradors, sobre de marbre blanc polit.",
    make: () =>
      B.one(B.box("Aparador", { w: 2000, h: 680, d: 450, mat: GLOSS, base: B.plinth(60, 40), push: true }, B.v(["auto", 700, "auto"], [B.doors(1), B.drawers(3), B.doors(1)])), {
        parts: [B.metal({ name: "Sobre de marbre", orient: "flat", material: "Marbre blanc", w: 2010, h: 460, thickness: 20, x: -5, y: 680, z: 0 })],
      }),
  },
  {
    id: "show-coffee",
    kind: "moble",
    name: "Taula de centre lacada negra",
    description: "1200 × 330 × 700 · cub lacat negre brillant a inglet.",
    make: () => B.one(B.box("Taula de centre", { w: 1200, h: 330, d: 700, mat: GLOSS, base: B.onFloor, joint: "mitre", back: "none" }, B.panel())),
  },
  {
    id: "green-kitchen",
    kind: "cuina",
    name: "Cuina verd fosc",
    description: "3600 mm de baixos lacats verd fosc amb taulell de roure, rebost i frigorífic.",
    make: () => B.kitchen({ mat: GREEN, front: GREEN, bases: [["drawers", 600], ["sink", 900], ["dish", 600], ["hob", 900], ["drawers", 600]], talls: ["fridge", "pantry"], top: { kind: "wood", mat: OAK }, shelves: { n: 1, mat: OAK } }),
  },
  {
    id: "oak-niche",
    kind: "moble",
    name: "Armari de roure amb fornícula",
    description: "800 × 2200 × 450 · portes a baix i a dalt i fornícula oberta al mig.",
    make: () => B.one(B.box("Armari de roure", { w: 800, h: 2200, d: 450, mat: OAK, base: B.plinth(60, 20) }, B.h([850, 420, "auto"], [B.doors(1), B.open(0), B.doors(2)]))),
  },
  {
    id: "farm-table",
    kind: "taula",
    name: "Taula de roure de pagès",
    description: "2200 × 760 × 950 · tauler gruixut i potes de roure.",
    make: () => B.legTable("Taula de pagès", { w: 2200, h: 760, d: 950, t: 40, mat: OAK, legs: "post", legMat: OAK }),
  },
  {
    id: "black-island",
    kind: "cuina",
    name: "Illa negra amb barra",
    description: "2600 × 1000 · lacat negre, calaixos i taulell de pedra volat per seure.",
    make: () => B.kitchen({ mat: BLACK, front: BLACK, island: { w: 2600, d: 900, kind: "seats", top: "stone" }, islandOnly: true }),
  },
  {
    id: "oak-run",
    kind: "cuina",
    name: "Cuina de roure amb prestatges",
    description: "Baixos de roure amb taulell de pedra i dos prestatges de paret.",
    make: () => B.kitchen({ mat: OAK, front: OAK, bases: [["drawers", 600], ["sink", 1000], ["dish", 600], ["hob", 800], ["drawers", 600]], top: { kind: "stone" }, shelves: { n: 2, mat: OAK } }),
  },
  {
    id: "black-talls",
    kind: "cuina",
    name: "Columnes negres",
    description: "Quatre columnes lacades negres: rebost, forn, frigorífic i rebost.",
    make: () => B.kitchen({ mat: BLACK, front: BLACK, talls: ["pantry", "oven", "fridge", "pantry"] }),
  },
  {
    id: "greige-kitchen",
    kind: "cuina",
    name: "Cuina greige amb illa",
    description: "Columnes i alts greige, taulell i illa de pedra.",
    make: () =>
      B.kitchen({
        mat: GREIGE,
        front: GREIGE,
        bases: [["drawers", 600], ["sink", 900], ["dish", 600], ["hob", 900], ["drawers", 800]],
        walls: [["doors", 800], ["door", 600], ["gap", 900], ["doors", 800]],
        talls: ["fridge", "oven"],
        tallsLeft: true,
        top: { kind: "stone" },
        island: { w: 2200, d: 900, kind: "drawers", top: "stone" },
      }),
  },
  {
    id: "white-closet",
    kind: "armari",
    name: "Armari de paret blanc",
    description: "2400 × 2200 × 450 · tres cossos de portes lacades blanques.",
    make: () => B.wardrobe("Armari de paret", { bodies: ["shelves", "shelves", "shelves"], bodyW: 800, h: 2200, d: 450, mat: WHITE, base: B.plinth(60, 20) }),
  },
  {
    id: "floating-grey",
    kind: "moble",
    name: "Aparador flotant gris",
    description: "2400 × 480 × 450 penjat a 350 del terra · tres cossos de portes.",
    make: () => B.sideboard("Aparador flotant", { w: 2400, h: 480, d: 450, mat: LGREY, base: B.hung(350) }, [["auto", B.doors(1)], ["auto", B.doors(1)], ["auto", B.doors(1)]]),
  },
  {
    id: "grey-wardrobe",
    kind: "armari",
    name: "Vestidor gris",
    description: "3200 × 2200 × 600 · penjador, calaixos, doble barra i prestatges.",
    make: () => B.wardrobe("Vestidor", { bodies: ["hang", "drawers", "hang2", "shelves"], bodyW: 800, h: 2200, mat: LGREY }),
  },
  {
    id: "outdoor-kitchen",
    kind: "cuina",
    name: "Cuina d'exterior",
    description: "Baixos de formigó clar amb portes de noguera i taulell de pedra.",
    make: () => B.kitchen({ mat: "Formigó clar", front: WAL, bases: [["doors", 800], ["sink", 900], ["drawers", 600], ["hob", 900], ["doors", 800]], top: { kind: "stone" } }),
  },
  {
    id: "walnut-cabinet",
    kind: "moble",
    name: "Armari de noguera",
    description: "1600 × 1900 × 450 · dues portes dobles.",
    make: () => B.sideboard("Armari de noguera", { w: 1600, h: 1900, d: 450, mat: WAL, base: B.plinth(60, 20) }, [["auto", B.doors(3)], ["auto", B.doors(3)]]),
  },
  {
    id: "attic-bookcase",
    kind: "moble",
    name: "Llibreria negra i noguera",
    description: "2400 × 2300 × 350 · prestatges negres i baixos de noguera.",
    make: () => B.bookcase("Llibreria", { cols: 3, colW: 800, h: 2300, d: 350, mat: BLACK, front: WAL, lower: "doors", shelves: 3 }),
  },
  {
    id: "tv-floating",
    kind: "moble",
    name: "Moble TV flotant de roure",
    description: "2400 × 400 × 420 penjat · calaixos i nínxol.",
    make: () => B.sideboard("Moble TV", { w: 2400, h: 400, d: 420, mat: OAK, base: B.hung(300) }, [["auto", B.drawers(1)], [800, B.open(0)], ["auto", B.drawers(1)]]),
  },
]
