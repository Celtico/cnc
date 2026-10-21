import { modulePlacements, newId, type Carcass, type Composition, type Module, type RefObject, type Zone } from "./composition"
import { applianceById } from "./applianceModules"
import { addTopPlinth } from "./plinthZones"
import { storeBuilders } from "./storeCatalog"
import type { Template } from "./templates"

/**
 * **Models constructius** (per decisió de l'usuari, 2026-10-21: «crear categories que quedin més o menys grups de 25, fiques
 * totes les possibles combinacions; així a partir de combinacions surten idees per crear un moble»): a la pàgina Mobles,
 * després del Catàleg i les Col·leccions. Cada categoria creua dues regles del model (files × columnes, unes 25
 * combinacions) sobre el mateix moble de mostra, perquè es vegi què canvia cada opció. Tot són zones, divisions i fronts
 * (el model únic): cap peça especial.
 */
export interface ComboCategory {
  id: string
  name: string
  description: string
  items: Template[]
  /** El text de sobre de cada targeta (id de la plantilla): sense, el de davant de « · » al nom. */
  kickers?: Record<string, string>
}

const { box, open, fixed, drawers, door, doors, flap, grille, v, h, auto, onFloor, plinth, legs, hung, one, row } = storeBuilders
const WHITE = "Melamina blanca"
const OAK = "Roure massís / xapat"
const GREIGE = "MDF lacat greige"

type Axis<T> = { label: string; value: T }[]

/** Les combinacions de dues regles (`rows` × `cols`): una plantilla per parella, «fila · columna». */
function cross<A, B>(cat: string, name: string, description: string, rows: Axis<A>, cols: Axis<B>, make: (a: A, b: B) => Composition): ComboCategory {
  return {
    id: cat,
    name,
    description,
    items: rows.flatMap((a, i) =>
      cols.map((b, j) => ({
        id: `combo-${cat}-${i + 1}-${j + 1}`,
        kind: "moble" as const,
        name: `${a.label} · ${b.label}`,
        description: `${name}: ${a.label.toLowerCase()} amb ${b.label.toLowerCase()}.`,
        make: () => ({ ...make(a.value, b.value), kind: "moble" as const }),
      })),
    ),
  }
}

const id = () => newId()
/** El front d'una zona dividida, que tapa les de dins (regla 3). */
const covering = (front: NonNullable<Zone["front"]>, z: Zone): Zone => ({ ...z, front })
const drawersBack = (n: number): Zone => ({ id: id(), front: { kind: "drawers", n, heights: auto(n), setback: 60 } })
const appliance = (ref: string): Zone => ({ id: id(), appliance: { hardware: applianceById(`appliance-${ref}`) } })
const rail = (): Zone => ({ id: id(), rail: {} })
const led = (n: number): Zone => ({ ...open(n), led: {} })
const withBack = (z: Zone, back: NonNullable<Zone["back"]>): Zone => ({ ...z, back })

// --- 1. Base × fons ---------------------------------------------------------------------------------------------------

const BASES: Axis<Carcass["base"]> = [
  { label: "Directe a terra", value: onFloor },
  { label: "Sòcol", value: plinth(80, 30) },
  { label: "Sòcol retirat", value: plinth(120, 80) },
  { label: "Potes", value: legs(150) },
  { label: "Penjat", value: hung(1450) },
]
const BACKS: Axis<Carcass["back"]> = [
  { label: "Fons cargolat", value: "screwed" },
  { label: "Fons en ranura", value: "groove" },
  { label: "Fons encastat", value: "inset" },
  { label: "Sense fons", value: "none" },
]

// --- 2. Fronts × divisions --------------------------------------------------------------------------------------------

const FRONTS: Axis<NonNullable<Zone["front"]>> = [
  { label: "Una porta", value: { kind: "door", mode: "single", hinge: "left" } },
  { label: "Dues portes", value: { kind: "door", mode: "double", hinge: "left" } },
  { label: "Portes de vidre", value: { kind: "door", mode: "double", hinge: "left", glass: true } },
  { label: "Abatible", value: { kind: "flap", dir: "down" } },
  { label: "Reixeta", value: grille().front! },
]
const LAYOUTS: Axis<() => Zone> = [
  { label: "Una zona", value: () => open(2) },
  { label: "Dues zones de dalt a baix", value: () => h(auto(2), [open(1), open(1)]) },
  { label: "Dues columnes", value: () => v(auto(2), [open(2), open(2)]) },
  { label: "Tres columnes", value: () => v(auto(3), [open(2), open(2), open(2)]) },
  { label: "Graella 2 × 2", value: () => v(auto(2), [h(auto(2), [open(), open()]), h(auto(2), [open(), open()])]) },
]

// --- 3. Contingut × front ---------------------------------------------------------------------------------------------

const CONTENTS: Axis<() => Zone> = [
  { label: "Prestatges regulables", value: () => open(3) },
  { label: "Prestatges fixos", value: () => fixed(3) },
  { label: "Barra de penjar", value: () => h([600, "auto"], [open(1), rail()]) },
  { label: "Calaixos a dins", value: () => h([560, "auto"], [drawersBack(3), open(2)]) },
  { label: "Llum LED", value: () => led(3) },
]
const COVERS: Axis<{ front?: NonNullable<Zone["front"]>; inset?: boolean }> = [
  { label: "Obert", value: {} },
  { label: "Una porta", value: { front: { kind: "door", mode: "single", hinge: "right" } } },
  { label: "Dues portes", value: { front: { kind: "door", mode: "double", hinge: "left" } } },
  { label: "Portes de vidre", value: { front: { kind: "door", mode: "double", hinge: "left", glass: true } } },
  { label: "Portes encastades", value: { front: { kind: "door", mode: "double", hinge: "left" }, inset: true } },
]

// --- 4. Caixa × estil dels fronts ---------------------------------------------------------------------------------------

type BoxStyle = { joint?: "mitre"; hollow?: number; top?: Carcass["top"]; sides?: Carcass["sides"]; thick?: number }
const CARCASSES: Axis<BoxStyle> = [
  { label: "Caixa normal", value: {} },
  { label: "Inglet", value: { joint: "mitre" } },
  { label: "Parets buides de 50", value: { hollow: 50 } },
  { label: "Sense tapa", value: { top: { kind: "none" } } },
  { label: "Divisors de 50", value: { thick: 50 } },
]
type FrontStyle = { inset?: boolean; push?: boolean; front?: string }
const FRONT_STYLES: Axis<FrontStyle> = [
  { label: "Fronts recobrents", value: {} },
  { label: "Fronts encastats", value: { inset: true } },
  { label: "Sense tirador", value: { push: true } },
  { label: "Fronts de roure", value: { front: "Melamina roure" } },
  { label: "Encastats sense tirador", value: { inset: true, push: true } },
]

// --- 5. Sòcols de zona ------------------------------------------------------------------------------------------------

const BOTTOM_PLINTHS: Axis<Carcass["base"]> = [
  { label: "Sense sòcol", value: onFloor },
  { label: "Sòcol a ras", value: plinth(80, 0) },
  { label: "Sòcol de 30", value: plinth(80, 30) },
  { label: "Sòcol alt", value: plinth(150, 30) },
  { label: "Sòcol molt retirat", value: plinth(120, 100) },
]
const TOP_PLINTHS: Axis<{ height: number; setback: number } | null> = [
  { label: "Sense sòcol de dalt", value: null },
  { label: "Sòcol de dalt de 60", value: { height: 60, setback: 0 } },
  { label: "Sòcol de dalt de 150", value: { height: 150, setback: 0 } },
  { label: "Sòcol de dalt retirat", value: { height: 100, setback: 40 } },
  { label: "Fins al sostre (300)", value: { height: 300, setback: 0 } },
]

// --- 6. Electrodomèstic × lloc -----------------------------------------------------------------------------------------

const APPLIANCES: Axis<string> = [
  { label: "Forn", value: "bosch-hba514es4" },
  { label: "Microones", value: "bosch-bfl7221b1" },
]
const PLACES: Axis<{ w: number; place: (a: Zone) => Zone }> = [
  { label: "A baix", value: { w: 600, place: (a) => h([600, "auto"], [a, doors(2)]) } },
  { label: "Al mig", value: { w: 600, place: (a) => h([700, 600, "auto"], [drawers(2), a, doors(2)]) } },
  { label: "A dalt", value: { w: 600, place: (a) => h(["auto", 600], [doors(2), a]) } },
  { label: "Al costat d'una porta", value: { w: 1100, place: (a) => v([600, "auto"], [h(["auto", 600, "auto"], [drawers(2), a, open(1)]), door("right", 3)]) } },
  { label: "Darrere de portes", value: { w: 600, place: (a) => covering({ kind: "door", mode: "double", hinge: "left" }, h(["auto", 600, "auto"], [open(1), a, open(1)])) } },
]

// --- 7. Columna de la casa × fons --------------------------------------------------------------------------------------

const PILLARS: Axis<(w: number) => RefObject[]> = [
  { label: "Columna a l'esquerra", value: () => [pillar(-60, 250)] },
  { label: "Columna al mig", value: (w) => [pillar(w / 2 - 125, 250)] },
  { label: "Columna a la dreta", value: (w) => [pillar(w - 190, 250)] },
  { label: "Dues columnes", value: (w) => [pillar(150, 200), pillar(w - 350, 200)] },
  { label: "Columna estreta", value: (w) => [pillar(w / 2 - 60, 120)] },
]
const PILLAR_BACKS: Axis<{ back: Carcass["back"]; zones?: NonNullable<Zone["back"]> }> = [
  { label: "Fons en ranura", value: { back: "groove" } },
  { label: "Fons cargolat", value: { back: "screwed" } },
  { label: "Fons encastat", value: { back: "inset" } },
  { label: "Fons cargolat a la zona", value: { back: "none", zones: "screwed" } },
  { label: "Zona de dalt sense fons", value: { back: "groove", zones: "none" } },
]
function pillar(x: number, w: number): RefObject {
  return { id: newId("r"), name: "Columna", effect: "cut", axis: "y", x, y: 0, z: -60, w, h: 2600, d: 250 }
}

// --- 8. Mòduls × muntatge --------------------------------------------------------------------------------------------

const MOUNTS: Axis<Carcass["base"]> = [
  { label: "A terra", value: plinth(80, 30) },
  { label: "Amb potes", value: legs(150) },
  { label: "Penjats", value: hung(400) },
]
const SETS: Axis<(base: Carcass["base"]) => Module[]> = [
  { label: "Dos iguals", value: (b) => [mod("A", 600, b, doors(1)), mod("B", 600, b, doors(1))] },
  { label: "Calaixos i porta", value: (b) => [mod("A", 600, b, drawers(3)), mod("B", 600, b, door("right", 1))] },
  { label: "Tres de mides diferents", value: (b) => [mod("A", 400, b, drawers(4)), mod("B", 800, b, doors(1)), mod("C", 400, b, open(2))] },
  { label: "Obert al mig", value: (b) => [mod("A", 500, b, door("left", 1)), mod("B", 600, b, open(1)), mod("C", 500, b, door("right", 1))] },
  { label: "Girat a l'extrem", value: (b) => [mod("A", 800, b, doors(1)), { ...mod("B", 600, b, open(2)), rot: 90 }] },
  { label: "Escala d'alçades", value: (b) => [mod("A", 500, b, open(2), 500), mod("B", 500, b, open(2), 720), mod("C", 500, b, open(3), 940)] },
  { label: "Penjat a sobre", value: (b) => [mod("A", 1200, b, v(auto(2), [drawers(2), doors(1)])), mod("B", 1200, hung(1450), flap("up", 0), 400)] },
  { label: "Cantonada a dos nivells", value: (b) => [mod("A", 900, b, v(auto(2), [door("left", 1), door("right", 1)])), mod("B", 900, hung(1450), v(auto(2), [door("left", 1), door("right", 1)]), 600)] },
]
function mod(name: string, w: number, base: Carcass["base"], root: Zone, hh = 720): Module {
  return box(name, { w, h: hh, d: base.kind === "wall" ? 350 : 500, mat: WHITE, base }, root)
}

// --- 9. Formes × mida i contingut ------------------------------------------------------------------------------------

/**
 * Formes fetes amb la Caixa de la zona (per decisió de l'usuari, 2026-10-21: «ara que tenim control de totes les parets,
 * pots fer formes guapes»): unes zones obertes que treuen les parets que les separen (`Zone.noWalls`) fan un buit en L, en
 * U, en T, en escala, en creu o en Z; la resta de zones porten el contingut de la variant.
 */
type Fill = (i: number, w: number, hh: number) => Zone
type Shape = (fill: Fill, W: number, H: number) => Zone
const hole = (...walls: NonNullable<Zone["noWalls"]>): Zone => ({ id: id(), ...(walls.length ? { noWalls: walls } : {}) })
const third = (n: number) => Math.round(n / 3)
/** Graella de 3 × 3 (files de baix a dalt): `cell(fila, columna)` fa cada zona. */
const grid3 = (W: number, H: number, cell: (r: number, c: number) => Zone): Zone =>
  h([third(H), third(H), "auto"], [0, 1, 2].map((r) => v([third(W), third(W), "auto"], [0, 1, 2].map((c) => cell(r, c)))))

const SHAPES: Axis<Shape> = [
  // Buit en L: tota la fila de baix i la columna de la dreta.
  { label: "Forma en L", value: (fill, W, H) => h([third(H), "auto"], [hole(), v(["auto", third(W)], [fill(0, W - third(W), H - third(H)), hole("bottom")])]) },
  // Buit en U: la fila de baix i les dues columnes dels costats; el bloc del mig, ple.
  { label: "Forma en U", value: (fill, W, H) => h([third(H), "auto"], [hole(), v([third(W), third(W), "auto"], [hole("bottom"), fill(0, third(W), H - third(H)), hole("bottom")])]) },
  // Buit en T: la fila de dalt i la columna del mig; els dos blocs de baix, plens.
  { label: "Forma en T", value: (fill, W, H) => h(["auto", third(H)], [v([third(W), third(W), "auto"], [fill(0, third(W), H - third(H)), hole("top"), fill(1, W - 2 * third(W), H - third(H))]), hole()]) },
  // Escala: quatre columnes amb el contingut cada vegada més alt; els buits de dalt, junts.
  {
    label: "Escala",
    value: (fill, W, H) => {
      const cw = Math.round(W / 4)
      return v([cw, cw, cw, "auto"], [1, 2, 3, 4].map((k, i) => h([Math.round((H * k) / 5), "auto"], [fill(i, cw, Math.round((H * k) / 5)), i === 0 ? hole() : hole("left")])))
    },
  },
  // Creu: la fila i la columna del mig, juntes; les quatre cantonades, plenes.
  {
    label: "Creu",
    value: (fill, W, H) => grid3(W, H, (r, c) => (r === 1 && c === 1 ? hole() : r === 1 ? hole(c === 0 ? "right" : "left") : c === 1 ? hole(r === 0 ? "top" : "bottom") : fill(r * 3 + c, third(W), third(H)))),
  },
  // Caixa penjada de la tapa: tot buit menys una caixa al mig de dalt (la del mig conserva les seves parets).
  { label: "Caixa penjada", value: (fill, W, H) => h(["auto", third(H)], [hole(), v([third(W), third(W), "auto"], [hole("bottom"), fill(0, third(W), third(H)), hole("bottom")])]) },
  // Piràmide: cinc columnes que pugen i baixen; els buits de dalt, junts.
  {
    label: "Piràmide",
    value: (fill, W, H) => {
      const cw = Math.round(W / 5)
      const ks = [1, 2, 3, 2, 1]
      // Cada buit treu la paret del costat on el contingut és més baix (la del costat més alt aguanta el contingut).
      const walls = (i: number) => [...(i > 0 && ks[i]! >= ks[i - 1]! ? ["left" as const] : []), ...(i < ks.length - 1 && ks[i + 1]! < ks[i]! ? ["right" as const] : [])]
      return v([cw, cw, cw, cw, "auto"], ks.map((k, i) => h([Math.round((H * k) / 4), "auto"], [fill(i, cw, Math.round((H * k) / 4)), hole(...walls(i))])))
    },
  },
  // Pont: dues torres als costats i una caixa de dalt a dalt; el pas de sota, buit.
  { label: "Pont", value: (fill, W, H) => v([third(W), third(W), "auto"], [fill(0, third(W), H), h(["auto", third(H)], [hole(), fill(1, third(W), third(H))]), fill(2, W - 2 * third(W), H)]) },
  // Z: dalt a l'esquerra, el mig i baix a la dreta, juntes; la resta, plena.
  {
    label: "Forma en Z",
    value: (fill, W, H) =>
      grid3(W, H, (r, c) => {
        if (r === 2 && c === 0) return hole()
        if (r === 2 && c === 1) return hole("left", "bottom")
        if (r === 1 && c === 1) return hole()
        if (r === 0 && c === 1) return hole("top")
        if (r === 0 && c === 2) return hole("left")
        return fill(r * 3 + c, third(W), third(H))
      }),
  },
]

type Variant = { w: number; h: number; d: number; base: Carcass["base"]; back?: Carcass["back"]; fill: Fill }
const shelvesFor = (hh: number) => Math.max(0, Math.min(3, Math.floor(hh / 350)))
const drawersFor = (hh: number) => Math.max(1, Math.min(4, Math.floor(hh / 180)))
/** Una porta, dues si és ample i un abatible si és baix (les frontisses no hi caben). */
const doorFor = (i: number, w: number, hh: number): Zone => (hh < 320 ? flap("down", 0) : w > 560 ? doors(shelvesFor(hh)) : door(i % 2 ? "right" : "left", shelvesFor(hh)))
/** Una zona plena massa ampla es parteix en dues (prestatges i portes no s'hi vinclen). */
const wide = (f: Fill): Fill => (i, w, hh) => (w > 900 ? v(auto(2), [f(i, Math.round(w / 2), hh), f(i + 1, Math.round(w / 2), hh)]) : f(i, w, hh))
const VARIANTS: Axis<Variant> = [
  { label: "Petit obert a terra", value: { w: 900, h: 900, d: 350, base: onFloor, fill: (_i, _w, hh) => open(shelvesFor(hh)) } },
  { label: "Mitjà amb calaixos", value: { w: 1200, h: 1200, d: 450, base: plinth(80, 30), fill: (_i, _w, hh) => drawers(drawersFor(hh)) } },
  { label: "Gran amb portes", value: { w: 1800, h: 2100, d: 450, base: legs(150), fill: (i, w, hh) => doorFor(i, w, hh) } },
  { label: "Penjat amb portes", value: { w: 1200, h: 750, d: 350, base: hung(1900), fill: (i, w, hh) => doorFor(i, w, hh) } },
  { label: "Prestatgeria sense fons", value: { w: 1600, h: 1200, d: 300, base: onFloor, back: "none", fill: (_i, _w, hh) => open(shelvesFor(hh)) } },
  { label: "Mitjà amb calaixos i portes", value: { w: 1400, h: 1300, d: 450, base: legs(120), fill: (i, w, hh) => (i % 2 ? doorFor(i, w, hh) : drawers(drawersFor(hh))) } },
]

export const MODEL_COMBOS: ComboCategory[] = [
  cross("base-fons", "Base i fons", "Les quatre maneres de fer el fons amb cada base: a terra, sòcol, potes o penjat.", BASES, BACKS, (base, back) =>
    one(box("Moble", { w: 800, h: 720, d: base.kind === "wall" ? 350 : 500, mat: WHITE, base, back }, v(auto(2), [door("left", 1), door("right", 1)])))),
  cross("fronts-divisions", "Fronts que tapen divisions", "Un front a la zona de fora tapa totes les de dins (regla 3): cada front amb cada divisió.", FRONTS, LAYOUTS, (front, layout) =>
    one(box("Moble", { w: 600, h: 900, d: 450, mat: GREIGE, base: plinth(80, 30) }, covering(front, layout())))),
  cross("contingut", "Contingut i front", "Què hi ha a dins (prestatges, barra, calaixos darrere de la porta, llum) i com es tanca.", CONTENTS, COVERS, (content, cover) =>
    one(box("Armari", { w: 600, h: 1800, d: 550, mat: WHITE, front: "Melamina roure", base: plinth(80, 30), ...(cover.inset ? { inset: true } : {}) }, cover.front ? covering(cover.front, content()) : content()))),
  cross("caixa-fronts", "Caixa i estil dels fronts", "Com és la caixa (inglet, parets buides, sense tapa, divisors gruixuts) amb cada estil de front.", CARCASSES, FRONT_STYLES, (c, f) => {
    const cols = v(auto(3), [drawers(3), doors(1), open(2)])
    const root = c.thick ? { ...cols, split: { ...cols.split!, thickness: c.thick } } : cols
    return one(box("Aparador", { w: 1500, h: 750, d: 450, mat: OAK, base: legs(150), ...(c.joint ? { joint: c.joint } : {}), ...(c.hollow ? { hollow: c.hollow } : {}), ...(c.top ? { top: c.top } : {}), ...f }, root))
  }),
  cross("socols", "Sòcols de baix i de dalt", "El sòcol de baix i el de dalt són zones amb un front fix: cada parella.", BOTTOM_PLINTHS, TOP_PLINTHS, (base, top) => {
    const m = box("Armari", { w: 800, h: 2200, d: 600, mat: GREIGE, base }, covering({ kind: "door", mode: "double", hinge: "left" }, h([900, "auto"], [open(2), rail()])))
    return one(top ? addTopPlinth(m, top.height, top.setback) : m)
  }),
  cross("electrodomestic", "Electrodomèstic a qualsevol zona", "Un aparell és el Contingut d'una zona: a baix, al mig, a dalt, al costat o darrere de portes.", APPLIANCES, PLACES, (ref, p) =>
    one(box("Columna", { w: p.w, h: 2200, d: 580, mat: WHITE, front: GREIGE, base: plinth(80, 30) }, p.place(appliance(ref))))),
  cross("columna", "Columna de la casa", "Una columna que entra pel darrere: el moble s'hi tanca amb els fons que falten, de cada tipus.", PILLARS, PILLAR_BACKS, (cols, b) => {
    const w = 800
    const lower = open(1), upper = open(2)
    const root = b.zones === "screwed" ? withBack(h([400, "auto"], [lower, upper]), "screwed") : b.zones === "none" ? h([400, "auto"], [lower, withBack(upper, "none")]) : h([400, "auto"], [lower, upper])
    return { ...one(box("Moble", { w, h: 800, d: 500, mat: WHITE, base: onFloor, back: b.back }, root)), references: cols(w) }
  }),
  cross("moduls", "Mòduls junts", "Com es combinen diversos mòduls: iguals, de mides diferents, girats, a dos nivells.", MOUNTS, SETS, (base, set) => row(set(base))),
]

/**
 * **Formes** (per decisió de l'usuari, 2026-10-21: «separa les que són a l'atzar de les que fas tu, que són una llista
 * concreta»): una secció pròpia de la pàgina Mobles, una categoria per forma amb les seves variants. Tot amb els materials
 * de Preferències (cap front d'un altre material).
 */
const SHAPE_CATEGORIES: ComboCategory[] = SHAPES.map((shape, i) => {
  const c = cross(`formes-${i + 1}`, shape.label, `${shape.label}, feta amb zones obertes que treuen les parets del mig: petit, mitjà, gran, penjat, sense fons; amb calaixos o portes.`, [shape], VARIANTS, (sh, o) =>
    one(box("Moble", { w: o.w, h: o.h, d: o.d, mat: WHITE, ...(o.back ? { back: o.back } : {}), base: o.base }, sh(wide(o.fill), o.w - 38, o.h - 38))),
  )
  return { ...c, items: c.items.map((t, j) => ({ ...t, id: `combo-formes-${i + 1}-${j + 1}` })) }
})

/**
 * **Abecedari** (per decisió de l'usuari, 2026-10-21: «podries fer una de lletres de l'abecedari?»): una graella de 5 × 5
 * zones on la lletra és buida (les zones de la lletra treuen les parets que les separen, `Zone.noWalls`) i la resta,
 * tancada amb un plafó fix; o al revés, la lletra de plafons i la resta buida.
 */
const FONT: Record<string, string> = {
  A: ".###.|#...#|#####|#...#|#...#", B: "####.|#...#|####.|#...#|####.", C: ".####|#....|#....|#....|.####", D: "####.|#...#|#...#|#...#|####.",
  E: "#####|#....|####.|#....|#####", F: "#####|#....|####.|#....|#....", G: ".####|#....|#..##|#...#|.####", H: "#...#|#...#|#####|#...#|#...#",
  I: "#####|..#..|..#..|..#..|#####", J: "..###|...#.|...#.|#..#.|.##..", K: "#...#|#..#.|###..|#..#.|#...#", L: "#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#...#|#...#", N: "#...#|##..#|#.#.#|#..##|#...#", O: ".###.|#...#|#...#|#...#|.###.", P: "####.|#...#|####.|#....|#....",
  Q: ".###.|#...#|#.#.#|#..#.|.##.#", R: "####.|#...#|####.|#..#.|#...#", S: ".####|#....|.###.|....#|####.", T: "#####|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|.###.", V: "#...#|#...#|#...#|.#.#.|..#..", W: "#...#|#...#|#.#.#|##.##|#...#", X: "#...#|.#.#.|..#..|.#.#.|#...#",
  Y: "#...#|.#.#.|..#..|..#..|..#..", Z: "#####|...#.|..#..|.#...|#####",
}
/**
 * Les lletres boniques (per decisió de l'usuari, 2026-10-21: «lletres guapes, de la A a la Z»): la font clàssica de 5 × 7,
 * amb les rodones (C, G, O, S…) tallades a les cantonades.
 */
const FONT7: Record<string, string> = {
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#", B: "####.|#...#|#...#|####.|#...#|#...#|####.", C: ".###.|#...#|#....|#....|#....|#...#|.###.",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.", E: "#####|#....|#....|####.|#....|#....|#####", F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.###.", H: "#...#|#...#|#...#|#####|#...#|#...#|#...#", I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
  J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..", K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", N: "#...#|#...#|##..#|#.#.#|#..##|#...#|#...#", O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  P: "####.|#...#|#...#|####.|#....|#....|#....", Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#", R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".###.|#...#|#....|.###.|....#|#...#|.###.", T: "#####|..#..|..#..|..#..|..#..|..#..|..#..", U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
  V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..", W: "#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.", X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", Z: "#####|....#|...#.|..#..|.#...|#....|#####",
}
/** La graella d'una lletra (`rows`, de dalt a baix): `hollowLetter` = les zones de la lletra buides (si no, les del voltant). */
function letterZone(rows: string[], hollowLetter: boolean, openLetter = false): Zone {
  const R = rows.length, C = rows[0]!.length
  const isHole = (r: number, c: number) => r >= 0 && r < R && c >= 0 && c < C && (rows[r]![c] === "#") === hollowLetter
  const cell = (r: number, c: number): Zone => {
    // La lletra oberta (per decisió de l'usuari, 2026-10-21: «fes-ne una com la meva»): les cel·les de la lletra, compartiments
    // oberts sense plafó.
    if (!isHole(r, c)) return openLetter ? { id: id() } : { id: id(), front: { kind: "panel" } }
    // Fila r de dalt a baix: la de sobre és r − 1. La lletra plena: els buits de la vora treuen també el seu tram de la caixa
    // del mòdul, i la caixa segueix la forma de la lletra (per decisió de l'usuari, 2026-10-21: «pots arreglar les lletres?»).
    const out = (rr: number, cc: number) => !hollowLetter && (rr < 0 || rr >= R || cc < 0 || cc >= C)
    const open = (rr: number, cc: number) => isHole(rr, cc) || out(rr, cc)
    const walls = [...(open(r, c - 1) ? ["left" as const] : []), ...(open(r, c + 1) ? ["right" as const] : []), ...(open(r - 1, c) ? ["top" as const] : []), ...(open(r + 1, c) ? ["bottom" as const] : [])]
    // I sense fons: el fons també segueix la lletra.
    return hollowLetter ? hole(...walls) : { ...hole(...walls), back: "none" }
  }
  // Files de baix a dalt.
  const order = Array.from({ length: R }, (_, k) => R - 1 - k)
  return h(auto(R), order.map((r) => v(auto(C), Array.from({ length: C }, (_, c) => cell(r, c)))))
}
const LETTER_SETS = [
  { key: "buida", name: "Abecedari · lletra buida", description: "Cada lletra, buida dins d'un moble tancat amb plafons (5 × 5 zones).", font: FONT, cell: 180, hollow: true },
  { key: "plena", name: "Abecedari · lletra plena", description: "Cada lletra, de plafons, dins d'un moble obert (5 × 5 zones).", font: FONT, cell: 180, hollow: false },
  { key: "fina-buida", name: "Abecedari fi · lletra buida", description: "Les lletres boniques (la font de 5 × 7): cada lletra buida dins d'un moble tancat amb plafons.", font: FONT7, cell: 130, hollow: true },
  { key: "fina-plena", name: "Abecedari fi · lletra plena", description: "Les lletres boniques (la font de 5 × 7): cada lletra de plafons dins d'un moble obert.", font: FONT7, cell: 130, hollow: false },
  { key: "oberta", name: "Abecedari · lletra oberta", description: "Cada lletra, de compartiments oberts (5 × 5 zones): la caixa i els laterals només on hi ha lletra.", font: FONT, cell: 180, hollow: false, open: true },
  { key: "fina-oberta", name: "Abecedari fi · lletra oberta", description: "Les lletres boniques (la font de 5 × 7), de compartiments oberts: la caixa i els laterals només on hi ha lletra.", font: FONT7, cell: 130, hollow: false, open: true },
]
const LETTER_CATEGORIES: ComboCategory[] = LETTER_SETS.map((lv) => ({
  id: `abecedari-${lv.key}`,
  name: lv.name,
  description: lv.description,
  items: Object.entries(lv.font).map(([ch, font]): Template => {
    const rows = font.split("|")
    return {
      id: `combo-abecedari-${lv.key}-${ch}`,
      kind: "moble",
      name: `Lletra ${ch}`,
      description: `La lletra ${ch} ${lv.hollow ? "buida" : "open" in lv ? "oberta" : "plena"}, amb zones de ${lv.cell} mm (${rows[0]!.length} × ${rows.length}).`,
      make: () => one(box(`Lletra ${ch}`, { w: rows[0]!.length * lv.cell + 38, h: rows.length * lv.cell + 38, d: 350, mat: WHITE, base: onFloor }, letterZone(rows, lv.hollow, "open" in lv))),
    }
  }),
}))

export const SHAPE_COMBOS: ComboCategory[] = [...SHAPE_CATEGORIES, ...LETTER_CATEGORIES]

/**
 * **Mobles junts** (per decisió de l'usuari, 2026-10-21: «fes un apartat de mobles junts amb formes modernes»): composicions
 * de diversos mòduls que es toquen, de mides diferents, on el mòdul més baix (o el penjat entre dues columnes) no porta el
 * lateral del costat on toca: el del veí fa de lateral dels dos (`withNeighbourSides`).
 */
type Block = { w: number; h: number; wall?: { bottom: number }; gap?: number }
type Layout = Block[]

/**
 * Treu el lateral que toca un veí que el cobreix de dalt a baix i és almenys igual de fondo (el veí l'aguanta). Amb dos
 * iguals, el de la dreta.
 */
export function joinTouchingSides(comp: Composition): Composition {
  const places = modulePlacements(comp)
  const box3 = comp.modules.map((m, i) => ({ x0: places[i]!.x, x1: places[i]!.x + m.carcass.width, y0: places[i]!.y, y1: places[i]!.y + m.carcass.height, d: m.carcass.depth }))
  const E = 1
  const covers = (a: (typeof box3)[number], b: (typeof box3)[number]) => a.y0 <= b.y0 + E && a.y1 >= b.y1 - E && a.d >= b.d
  const drop = comp.modules.map(() => ({ left: false, right: false }))
  box3.forEach((a, i) =>
    box3.forEach((b, j) => {
      // `a` a l'esquerra de `b`, tocant.
      if (i === j || Math.abs(a.x1 - b.x0) > E) return
      if (covers(a, b)) drop[j]!.left = true
      else if (covers(b, a)) drop[i]!.right = true
    }),
  )
  return {
    ...comp,
    modules: comp.modules.map((m, i) => (drop[i]!.left || drop[i]!.right ? { ...m, carcass: { ...m.carcass, sides: { ...m.carcass.sides, left: !drop[i]!.left, right: !drop[i]!.right } } } : m)),
  }
}

const LAYOUTS_JOINED: Axis<Layout> = [
  { label: "Escala", value: [{ w: 450, h: 1800 }, { w: 450, h: 1400 }, { w: 450, h: 1000 }, { w: 450, h: 600 }] },
  { label: "Piràmide", value: [{ w: 400, h: 700 }, { w: 400, h: 1300 }, { w: 400, h: 1900 }, { w: 400, h: 1300 }, { w: 400, h: 700 }] },
  { label: "Escacs", value: [{ w: 500, h: 1600 }, { w: 500, h: 800 }, { w: 500, h: 1600 }, { w: 500, h: 800 }, { w: 500, h: 1600 }] },
  { label: "Ciutat", value: [{ w: 400, h: 2000 }, { w: 600, h: 1200 }, { w: 400, h: 1700 }, { w: 500, h: 900 }, { w: 400, h: 2100 }, { w: 600, h: 1400 }] },
  { label: "Torres i aparador", value: [{ w: 500, h: 2000 }, { w: 1600, h: 750 }, { w: 500, h: 2000 }] },
  { label: "Pont de TV", value: [{ w: 500, h: 2000 }, { w: 1800, h: 500 }, { w: 500, h: 2000 }, { w: 1800, h: 400, gap: 500, wall: { bottom: 1600 } }] },
  { label: "Rebedor", value: [{ w: 700, h: 2100 }, { w: 1000, h: 450 }, { w: 1000, h: 500, gap: 700, wall: { bottom: 1500 } }] },
  { label: "Penjats en cascada", value: [{ w: 600, h: 900, wall: { bottom: 1100 } }, { w: 600, h: 600, wall: { bottom: 1400 } }, { w: 600, h: 400, wall: { bottom: 1600 } }, { w: 600, h: 300, wall: { bottom: 1700 } }] },
]

/** Els laterals que falten (el del veí fa de lateral): les portes hi han de penjar del costat que en té. */
type Missing = { left: boolean; right: boolean }
type JoinedFill = (i: number, w: number, hh: number, miss: Missing) => Zone
/** Com `doorFor`, amb les frontisses al costat que té lateral (o el divisor del mig); amb dos laterals, la de sempre. */
const doorJoined: JoinedFill = (i, w, hh, miss) => {
  if (hh < 320 || (!miss.left && !miss.right)) return doorFor(i, w, hh)
  // Una columna estreta amb un lateral: una porta d'aquell costat.
  if (w <= 560 && miss.left !== miss.right) return door(miss.left ? "right" : "left", shelvesFor(hh))
  // Si no, dues columnes: cadascuna penja del lateral que té, o del divisor del mig.
  return v(auto(2), [door(miss.left ? "right" : "left", shelvesFor(hh)), door(miss.right ? "left" : "right", shelvesFor(hh))])
}
/** `wide` amb els laterals que falten: cada meitat només té el de fora. */
const wideJoined = (f: JoinedFill): JoinedFill => (i, w, hh, miss) =>
  w > 900 ? v(auto(2), [f(i, Math.round(w / 2), hh, { left: miss.left, right: false }), f(i + 1, Math.round(w / 2), hh, { left: false, right: miss.right })]) : f(i, w, hh, miss)

type JoinedVariant = { d: number; base: Carcass["base"]; back?: Carcass["back"]; fill: JoinedFill }
const JOINED_VARIANTS: Axis<JoinedVariant> = [
  { label: "Oberta", value: { d: 350, base: onFloor, fill: (_i, _w, hh) => open(shelvesFor(hh)) } },
  { label: "Amb portes", value: { d: 400, base: plinth(80, 30), fill: doorJoined } },
  // Els calaixos necessiten un lateral a cada costat (`canHoldFront`): al mòdul que en treu un, prestatges.
  { label: "Calaixos i prestatges", value: { d: 450, base: legs(120), fill: (_i, _w, hh, miss) => (miss.left || miss.right ? open(shelvesFor(hh)) : hh > 900 ? h([400, "auto"], [drawers(2), open(shelvesFor(hh - 400))]) : drawers(drawersFor(hh))) } },
  { label: "Portes i obert", value: { d: 400, base: onFloor, fill: (i, w, hh, miss) => (i % 2 ? open(shelvesFor(hh)) : doorJoined(i, w, hh, miss)) } },
  { label: "Sense fons", value: { d: 300, base: onFloor, back: "none", fill: (_i, _w, hh) => open(shelvesFor(hh)) } },
]

export const JOINED_COMBOS: ComboCategory[] = LAYOUTS_JOINED.map((layout, i) => {
  const c = cross(`junts-${i + 1}`, layout.label, `${layout.label}: mòduls de mides diferents que es toquen; el més baix no porta el lateral del costat del veí, que fa de lateral dels dos.`, [layout], JOINED_VARIANTS, (blocks, o) => {
    // Primer els mòduls buits i els laterals que es treuen; després el contingut, que en depèn (les frontisses).
    const joined = joinTouchingSides(
      row(blocks.map((b, k) => box(`Mòdul ${k + 1}`, { w: b.w, h: b.h, d: b.wall ? Math.min(350, o.d) : o.d, mat: WHITE, base: b.wall ? hung(b.wall.bottom) : o.base, ...(o.back ? { back: o.back } : {}), ...(b.gap ? { gapBefore: b.gap } : {}) }, open()))),
    )
    return {
      ...joined,
      modules: joined.modules.map((m, k) => ({ ...m, root: wideJoined(o.fill)(k, m.carcass.width - 38, m.carcass.height - 38, { left: !m.carcass.sides.left, right: !m.carcass.sides.right }) })),
    }
  })
  return { ...c, items: c.items.map((t, j) => ({ ...t, id: `combo-junts-${i + 1}-${j + 1}` })) }
})

/** Totes les plantilles dels models constructius, de les formes i dels mobles junts (per als tests i la cerca). */
export const COMBO_TEMPLATES: Template[] = [...MODEL_COMBOS, ...SHAPE_COMBOS, ...JOINED_COMBOS].flatMap((c) => c.items)
