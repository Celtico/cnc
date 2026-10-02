import { DEFAULT_GRILLE, newId, tableModule, type Composition, type RefObject, type Zone } from "./composition"
import type { FreePart } from "./freePart"
import { compositionDims, storeBuilders as B } from "./storeCatalog"
import type { Template } from "./templates"

/**
 * Col·leccions de mobles: biblioteca de referències i inspiració per dissenyar una col·lecció pròpia de mobiliari
 * contemporani d'alta gamma (anàlisi a `docs/colleccions-mobles.md`). Dues col·leccions —Minimalisme arquitectònic i
 * Minimalisme comercial— i, a cada una, peces **paramètriques** fetes amb els mateixos constructors del catàleg de
 * botiga (es creen com qualsevol moble i es poden fabricar). Cada peça porta una **fitxa d'estudi** (`study`) amb els
 * criteris de la biblioteca: referència, llenguatge formal, geometria, proporcions, materials, acabats, gruixos,
 * ferratges, sensació, relació amb l'arquitectura, graus (1–5) i elements de qualitat. No són còpies de cap producte:
 * són interpretacions del llenguatge de les referències amb les capacitats de l'app.
 * Referència als ambients: `col:<id>`.
 */

/** Graus de la fitxa, d'1 (poc) a 5 (molt). */
export type Grade = 1 | 2 | 3 | 4 | 5

export interface PieceStudy {
  /** Dissenyador o marca de referència (d'estudi, no de procedència). */
  reference: string
  language: string
  geometry: string
  proportions: string
  materials: string
  finishes: string
  combination: string
  surfaces: string
  /** Relació entre gruixos i volums. */
  thickness: string
  /** Presència o absència de ferratges visibles. */
  hardware: string
  feeling: string
  /** Relació amb l'espai arquitectònic. */
  architecture: string
  /** Elements que contribueixen a la percepció de qualitat. */
  quality: string
  minimalism: Grade
  sophistication: Grade
  warmth: Grade
  functionality: Grade
  /** Família de productes (col·lecció comercial). */
  family?: string
  /** Mides de la família (variants). */
  sizes?: string
  /** Acabats possibles. */
  finishOptions?: string
  /** Fotos de referència (camins dins de la carpeta `referencies` de l'usuari). */
  photos?: string[]
}

export interface CollectionPiece extends Template {
  /** Tipus de moble (taula, banc, aparador…). */
  type: string
  study: PieceStudy
}

export interface CollectionRef {
  name: string
  url: string
  note: string
}

export interface FurnitureCollection {
  id: "arquitectonic" | "comercial"
  name: string
  description: string
  /** Principis del llenguatge (què s'hi observa). */
  principles: string[]
  references: CollectionRef[]
  pieces: CollectionPiece[]
}

// --- Materials ----------------------------------------------------------------------------------

const OAK = "Roure massís / xapat"
const WAL = "Noguera xapada"
const ASH = "Freixe xapat"
const GREIGE = "MDF lacat greige"
const ANTH = "MDF lacat antracita"
const TRAV = "Travertí"
const LINEN = "Lli blanc"
const SAND = "Teixit sorra"
const LEATHER = "Cuir conyac"
const GLASS = "Vidre"

// --- Constructors propis --------------------------------------------------------------------------

type Orient = FreePart["orient"]
/** Peça de CNC (tauler) a la posició (x, y, z) de la seva cantonada mínima; cantejada (no es veu l'ànima del tauler). */
const P = (name: string, orient: Orient, material: string, w: number, h: number, t: number, x: number, y: number, z: number, group?: string): FreePart =>
  B.part({ name, orient, material, w, h, thickness: t, x, y, z, edged: true, ...(group ? { group } : {}) })
/** Peça que no és de CNC (pedra, tapisseria, fusta massissa torneada…). */
const M = (name: string, orient: Orient, material: string, w: number, h: number, t: number, x: number, y: number, z: number, group?: string): FreePart =>
  B.metal({ name, orient, material, w, h, thickness: t, x, y, z, ...(group ? { group } : {}) })
const ref = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material?: string): RefObject => ({ id: newId("r"), name, w, h, d, x, y, z, ...(material ? { material } : {}) })

/** Taula: tauler de CNC (mòdul de taula sense laterals) i el que l'aguanta (peces lliures, fins a H − t). */
function slabTable(name: string, o: { w: number; h: number; d: number; t?: number; mat: string }, support: (H: number) => FreePart[]): Composition {
  const t = o.t ?? 30
  const m = tableModule(newId("m"), name, { width: o.w, height: o.h, depth: o.d, thickness: t, material: o.mat, sides: { left: false, right: false }, tableTop: { overhang: 0 } })
  return { kind: "taula", modules: [m], references: [], parts: support(o.h - t) }
}

/** Sòcol enretirat (caixa de quatre taulers) que fa flotar una llosa: x0, z0 = cantonada, w × d, alçada H. */
function recessedPlinth(mat: string, x0: number, z0: number, w: number, d: number, H: number, t = 30, group = "Sòcol"): FreePart[] {
  return [
    P("Sòcol davant", "front", mat, w, H, t, x0, 0, z0 + d - t, group),
    P("Sòcol darrere", "front", mat, w, H, t, x0, 0, z0, group),
    P("Sòcol lateral", "side", mat, d - 2 * t, H, t, x0, 0, z0 + t, group),
    P("Sòcol lateral", "side", mat, d - 2 * t, H, t, x0 + w - t, 0, z0 + t, group),
  ]
}

/** Llarg útil del tauler més gran (2800 − 2 × 10 de marge). */
const MAX_BOARD_LENGTH = 2780

/**
 * Llit de plataforma: capçal (CNC o entapissat) a la paret, plataforma de tauler sobre un sòcol enretirat (flota) i
 * matalàs de referència. Opcionalment, prestatges volats al capçal com a tauletes.
 */
function platformBed(o: { matW: number; matL: number; mat: string; headMat: string; headW: number; headH: number; headT: number; upholstered?: boolean; shelves?: boolean; plinthH?: number }): Composition {
  const W = o.matW + 100
  const L = o.matL + 60
  const H = o.plinthH ?? 260
  const x0 = (o.headW - W) / 2
  const z0 = o.headT
  // Capçal de CNC més llarg que el tauler útil (2780): dues fulles amb junta al centre.
  const leaves = !o.upholstered && o.headW > MAX_BOARD_LENGTH ? 2 : 1
  const leafW = o.headW / leaves
  const head = o.upholstered
    ? [M("Capçal entapissat", "front", o.headMat, o.headW, o.headH, o.headT, 0, 0, 0)]
    : leaves === 1
      ? [P("Capçal", "front", o.headMat, o.headW, o.headH, o.headT, 0, 0, 0)]
      : [P("Capçal esquerre", "front", o.headMat, leafW, o.headH, o.headT, 0, 0, 0, "Capçal"), P("Capçal dret", "front", o.headMat, leafW, o.headH, o.headT, leafW, 0, 0, "Capçal")]
  const parts: FreePart[] = [
    ...head,
    // Veta al llarg del llit (v): així els 2060 van pel costat de 2800 del tauler.
    { ...P("Plataforma", "flat", o.mat, W, L, 30, x0, H, z0), grain: "v" },
    ...recessedPlinth(o.mat, x0 + 180, z0 + 150, W - 360, L - 330, H),
  ]
  if (o.shelves)
    for (const x of [x0 - 560, x0 + W + 60]) parts.push(P("Prestatge de capçal", "flat", o.mat, 500, 380, 30, x, 480, z0, "Tauletes"))
  const mattress = ref(`Matalàs ${o.matW} × ${o.matL}`, o.matW, 200, o.matL, x0 + 50, H + 31, z0 + 30, LINEN)
  return B.loose(parts, [mattress])
}

/** Cadira de taulers: respatller sencer al darrere, dos laterals i seient (i coixí, si n'hi ha). */
function slabChair(o: { w: number; d: number; h: number; seat: number; mat: string; cushion?: string }): Composition {
  const t = 30
  const parts: FreePart[] = [
    P("Respatller", "front", o.mat, o.w, o.h, t, 0, 0, 0),
    P("Lateral", "side", o.mat, o.d - t, o.seat, t, 0, 0, t),
    P("Lateral", "side", o.mat, o.d - t, o.seat, t, o.w - t, 0, t),
    P("Seient", "flat", o.mat, o.w - 2 * t, o.d - t, t, t, o.seat - t, t),
  ]
  if (o.cushion) parts.push(M("Coixí", "flat", o.cushion, o.w - 2 * t - 20, o.d - t - 40, 40, t + 10, o.seat, t + 20))
  return B.loose(parts)
}

/** Porta estriada: reixeta de ranures verticals fresades (passants) amb marge llis; obre amb frontisses. */
const fluted = (hinge: "left" | "right"): Zone => ({ ...B.grille(hinge), front: { kind: "grille", pattern: { ...DEFAULT_GRILLE, kind: "slotsV", slotWidth: 14, slotGap: 10, margin: 40 }, mount: "hinged", hinge } })

// --- Fitxes ---------------------------------------------------------------------------------------

type Study = Omit<PieceStudy, "hardware" | "architecture"> & Partial<Pick<PieceStudy, "hardware" | "architecture">>

interface PieceDef {
  id: string
  type: string
  name: string
  /** Una línia: què és i què l'identifica. */
  summary: string
  study: Study
  make: () => Composition
}

function pieces(collection: FurnitureCollection["id"], defaults: Pick<PieceStudy, "hardware" | "architecture">, defs: PieceDef[]): CollectionPiece[] {
  return defs.map((d) => {
    const sample = d.make()
    const kind = sample.kind ?? "moble"
    const study: PieceStudy = { ...defaults, ...d.study }
    return {
      id: `col-${collection}-${d.id}`,
      kind,
      type: d.type,
      name: `${d.type} «${d.name}»`,
      description: `${d.summary} · ${compositionDims(sample)} mm · ${study.materials}. Ref.: ${study.reference}.`,
      study,
      make: () => ({ ...d.make(), kind }),
    }
  })
}

const F = (f: string) => `fofomobles_files/${f}`

// --- 1. Minimalisme arquitectònic -----------------------------------------------------------------

const ARQ: PieceDef[] = [
  {
    id: "llosa-table",
    type: "Taula de menjador",
    name: "Llosa",
    summary: "Tauler prim volat sobre dos taulers verticals i una ànima central",
    study: {
      reference: "John Pawson × Dinesen (taula de Home Farm), De La Espada",
      language: "Arquitectura de taulers: tres plans que es toquen i res més",
      geometry: "Ortogonal; un pla horitzontal i tres verticals en H",
      proportions: "2600 × 950: proporció 1:2,7, voladís de 420 als extrems (≈ 1/6 de la llargada)",
      materials: "Roure massís o xapat de tauló ample",
      finishes: "Oli invisible o sabó: color de fusta crua, mat",
      combination: "Un sol material",
      surfaces: "Llises, veta llarga i contínua del tauler a les potes",
      thickness: "Tot a 30: el gruix del tauler és el mateix que el de les potes; l'ànima fa la rigidesa",
      feeling: "Calma, pes ben repartit, taula de refectori",
      quality: "Continuïtat de la veta, cantells vius i nets, unions sense ferratges a la vista",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
      photos: [F("01-Dinesen-x-Pawson0696-Edit.jpg"), F("01-Dining-Douglas-Classic-Home-Farm-UK-John-Pawson-Photographer-Claus-Troelsgaard-John-Pawson-Furniture-Collection-02-PR.jpg")],
    },
    make: () =>
      slabTable("Taula", { w: 2600, h: 740, d: 950, mat: OAK }, (H) => [
        P("Pota", "side", OAK, 700, H, 30, 420, 0, 125),
        P("Pota", "side", OAK, 700, H, 30, 2600 - 420 - 30, 0, 125),
        P("Ànima", "front", OAK, 2600 - 2 * 450, 220, 30, 450, H - 220, 950 / 2 - 15),
      ]),
  },
  {
    id: "box-bench",
    type: "Banc",
    name: "Caixa",
    summary: "Tub obert de quatre taulers: banc, prestatge o tauleta",
    study: {
      reference: "John Pawson × Dinesen (banc de caixa oberta)",
      language: "Caixa oberta pels dos caps: el buit forma part de la peça",
      geometry: "Prisma rectangular buidat; secció en O",
      proportions: "1600 × 440 × 380: baix i llarg (1:3,6), alçada de seient",
      materials: "Roure o avet Douglas massís",
      finishes: "Oli blanc o sabó",
      combination: "Un sol material",
      surfaces: "Llises; la veta fa la volta a la caixa",
      thickness: "Taulers de 30 iguals: el gruix es llegeix a la boca oberta",
      feeling: "Peça arquitectònica petita, robusta i serena",
      quality: "Cantonades netes, veta que continua, proporció exacta de la boca",
      minimalism: 5,
      sophistication: 3,
      warmth: 4,
      functionality: 3,
      photos: [F("02-Dinesen-x-Pawson0875-Edit.jpg"), F("02-Dining-Douglas-Classic-Home-Farm-UK-John-Pawson-Photographer-Claus-Troelsgaard-John-Pawson-Furniture-Collection-01-PR.jpg")],
    },
    make: () =>
      B.loose([
        P("Lateral", "side", OAK, 380, 440, 30, 0, 0, 0),
        P("Lateral", "side", OAK, 380, 440, 30, 1570, 0, 0),
        P("Seient", "flat", OAK, 1540, 380, 30, 30, 410, 0),
        P("Base", "flat", OAK, 1540, 380, 30, 30, 0, 0),
      ]),
  },
  {
    id: "open-cube",
    type: "Taula auxiliar",
    name: "Cub obert",
    summary: "Cub a inglet obert per davant i per darrere",
    study: {
      reference: "John Pawson × Dinesen (tamboret cub)",
      language: "Un sol volum amb el buit travessant",
      geometry: "Cub de 450; secció quadrada",
      proportions: "1:1:1, la mesura d'un seient",
      materials: "Roure xapat a inglet",
      finishes: "Oli mat",
      combination: "Un sol material",
      surfaces: "Llises, cap cantell vist",
      thickness: "19 amb inglet: sembla un bloc buidat, no una caixa de taulers",
      feeling: "Objecte silenciós, polivalent (tamboret, tauleta, peu de llit)",
      quality: "Inglets perfectes, veta que dona la volta",
      minimalism: 5,
      sophistication: 3,
      warmth: 4,
      functionality: 3,
      photos: [F("03-Dinesen-x-Pawson0838-Edit.jpg")],
    },
    make: () => B.one(B.box("Cub", { w: 450, h: 450, d: 450, mat: OAK, base: B.onFloor, joint: "mitre", back: "none" }, B.open(0))),
  },
  {
    id: "platform-daybed",
    type: "Daybed",
    name: "Plataforma",
    summary: "Llosa de tauler sobre un sòcol enretirat, amb matalàs de lli",
    study: {
      reference: "John Pawson × Dinesen (daybed), Vincent Van Duysen",
      language: "Plataforma que flota: el sòcol desapareix a l'ombra",
      geometry: "Llosa horitzontal sobre un prisma enretirat",
      proportions: "2000 × 380 × 800; el sòcol enretirat 250 a cada cap i 150 als costats",
      materials: "Roure o avet Douglas, matalàs de lli",
      finishes: "Oli blanc, lli rentat",
      combination: "Fusta i tèxtil cru",
      surfaces: "Llosa llisa, matalàs de cantell recte",
      thickness: "Llosa de 30 sobre una ombra de 350: el gruix sembla més prim",
      feeling: "Repòs, horitzontalitat, llum rasant",
      quality: "L'ombra del sòcol, la proporció de la llosa i del matalàs",
      minimalism: 5,
      sophistication: 4,
      warmth: 5,
      functionality: 3,
      photos: [F("06-Dinesen-x-Pawson0818-Edit.jpg"), F("08-Daybed-Douglas-Classic-Home-Farm-UK-John-Pawson-Photographer-Claus-Troelsgaard-John-Pawson-Furniture-Collection-04-PR.jpg")],
    },
    make: () =>
      B.loose(
        [P("Llosa", "flat", OAK, 2000, 800, 30, 0, 350, 0), ...recessedPlinth(OAK, 250, 150, 1500, 500, 350)],
        [ref("Matalàs de lli", 1900, 120, 740, 50, 381, 30, LINEN), ref("Coixí de rotlle", 600, 150, 160, 1350, 502, 40, LINEN)],
      ),
  },
  {
    id: "low-slab",
    type: "Taula de centre",
    name: "Llosa baixa",
    summary: "Llosa ampla sobre un sòcol enretirat",
    study: {
      reference: "John Pawson (Drift, Home Farm)",
      language: "Llosa i ombra: la taula com un esglaó del terra",
      geometry: "Prisma pla sobre prisma enretirat",
      proportions: "1400 × 300 × 900; sòcol enretirat 180",
      materials: "Roure; versió en pedra calcària o travertí",
      finishes: "Oli mat / pedra apomassada",
      combination: "Un sol material",
      surfaces: "Llises; la pedra amb porus vist",
      thickness: "Llosa de 30 que vola 180: horitzontalitat",
      feeling: "Ancorada al terra, serena",
      quality: "Relació llosa/ombra, cantells vius",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 3,
      photos: [F("07-Dinesen-x-Pawson0825-Edit.jpg"), F("01-jp-pawson-drift-collection.jpg")],
    },
    make: () => B.loose([P("Llosa", "flat", OAK, 1400, 900, 30, 0, 270, 0), ...recessedPlinth(OAK, 180, 180, 1040, 540, 270)]),
  },
  {
    id: "frame-low",
    type: "Taula de centre",
    name: "Marc",
    summary: "Marc de fusta massissa de secció quadrada amb prestatge baix",
    study: {
      reference: "John Pawson per Nikari (Frame)",
      language: "Estructura de barres: el contorn dibuixa el volum",
      geometry: "Cub de línies; secció de 60 × 60",
      proportions: "1100 × 380 × 1100: quadrada, baixa",
      materials: "Roure massís (potes) i tauler de roure",
      finishes: "Oli natural",
      combination: "Massís i tauler del mateix roure",
      surfaces: "Llises, arestes lleugerament trencades",
      thickness: "Secció de pota igual al doble del tauler: el marc mana",
      feeling: "Lleugera però ferma, artesana",
      quality: "Encaixos de fusteria (a la referència, a mitja fusta i espiga)",
      minimalism: 4,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
      photos: [F("01-nikari-john-pawson-frame-low.jpg"), F("06-nikari-john-pawson-frame-low.jpg")],
    },
    make: () =>
      B.loose([
        P("Tauler", "flat", OAK, 1100, 1100, 30, 0, 350, 0),
        P("Prestatge", "flat", OAK, 980, 980, 19, 60, 80, 60),
        ...[0, 1040].flatMap((x) => [0, 1040].map((z) => M("Pota massissa", "flat", OAK, 60, 60, 350, x, 0, z, "Marc"))),
      ]),
  },
  {
    id: "monolith-sideboard",
    type: "Aparador",
    name: "Monòlit",
    summary: "Volum a inglet de parets buides, fronts encastats i sòcol en ombra",
    study: {
      reference: "Vincent Van Duysen (Molteni&C), Obumex × John Pawson",
      language: "Monòlit: un bloc tallat per juntes, sense tiradors",
      geometry: "Prisma pur; juntes verticals com a únic dibuix",
      proportions: "2400 × 720 × 500; tres cossos (800 · auto · 800); sòcol enretirat 60",
      materials: "Noguera xapada",
      finishes: "Oli o vernís mat 5 gloss",
      combination: "Un sol material, interior igual",
      surfaces: "Continuïtat de veta de front a front (xapa casada)",
      thickness: "Parets buides de 50 i inglet: el moble llegeix com a massís",
      hardware: "Cap a la vista: obertura per pressió (push) o per la junta",
      feeling: "Pes, permanència, silenci",
      quality: "Juntes de 3 mm regulars, veta casada, inglet net",
      minimalism: 5,
      sophistication: 5,
      warmth: 4,
      functionality: 4,
      photos: [F("01_WOW_JP_Obumex_Kitchen_System_II.jpg"), F("4327907705202-a1.webp")],
    },
    make: () =>
      B.one(B.box("Aparador", { w: 2400, h: 720, d: 500, mat: WAL, base: B.plinth(80, 60), joint: "mitre", inset: true, push: true, hollow: 50 }, B.v([800, "auto", 800], [B.doors(1), B.drawers(3), B.doors(1)]))),
  },
  {
    id: "wall-bench-tv",
    type: "Moble TV",
    name: "Banc de paret",
    summary: "Banc baix i llarg que continua la paret: calaixos i nínxol",
    study: {
      reference: "John Pawson (bancs d'obra), Vincent Van Duysen",
      language: "Moble com a part de l'arquitectura: un sòcol habitable",
      geometry: "Prisma llarg i baix",
      proportions: "2700 × 420 × 450 (1:6,4): horitzontal pur; la tapa d'una peça cap al tauler de 2800",
      materials: "Roure; també estuc o pedra a joc amb la paret",
      finishes: "Oli blanc",
      combination: "Un sol material",
      surfaces: "Front continu, nínxol central obert",
      thickness: "Parets de 50 a inglet: gruix arquitectònic",
      hardware: "Calaixos push sense tirador",
      feeling: "Integrat, calmat, de terra a terra",
      quality: "Llargada sense interrupcions, ombra del sòcol",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
      photos: [F("03-Lounge-Douglas-Classic-Home-Farm-UK-John-Pawson-Photographer-Claus-Troelsgaard-John-Pawson-Furniture-Collection-04-PR.jpg")],
    },
    make: () =>
      B.one(B.box("Moble TV", { w: 2700, h: 420, d: 450, mat: OAK, base: B.plinth(80, 60), joint: "mitre", inset: true, push: true, hollow: 50 }, B.v([800, "auto", 800], [B.drawers(1), B.open(0), B.drawers(1)]))),
  },
  {
    id: "niche-library",
    type: "Llibreria",
    name: "Nínxol",
    summary: "Volum de terra a sostre de parets i prestatges gruixuts a ras",
    study: {
      reference: "David Thulstrup × Dinesen, Vincent Van Duysen",
      language: "Paret excavada: nínxols en lloc de prestatges",
      geometry: "Retícula de buits dins d'un volum",
      proportions: "2700 × 2400 × 400; nínxols de 800 × ≈ 400",
      materials: "Roure xapat",
      finishes: "Oli invisible",
      combination: "Un sol material",
      surfaces: "Planes, prestatges a ras del davant",
      thickness: "Laterals i prestatges de 50: el gruix fa l'arquitectura",
      hardware: "Cap",
      feeling: "Massa, ordre, biblioteca de pedra",
      quality: "Gruix constant, juntes alineades",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
      photos: ["links/dinesean/dinesen-apartment-by-david-thulstrup-layers-oak-and-heartoak-invisible-oil-2-4m-300mm-19mm-interior-design-david-thulstrup-photo-eric-petschek-24.webp"],
    },
    make: () => B.row([1, 2, 3].map((i) => B.box(`Nínxol ${i}`, { w: 900, h: 2400, d: 400, mat: OAK, base: B.onFloor, hollow: 50 }, B.fixed(4, { thickness: 50, flush: true })))),
  },
  {
    id: "floating-desk",
    type: "Escriptori",
    name: "Taulell volat",
    summary: "Tauler sobre un bloc de calaixos i un tauler vertical enretirat",
    study: {
      reference: "Obumex × John Pawson (illa), De La Espada",
      language: "Volums que s'interpenetren: bloc, llosa i pla",
      geometry: "Composició asimètrica de prismes",
      proportions: "1800 × 740 × 800; bloc de 500, voladís de 150",
      materials: "Noguera xapada",
      finishes: "Oli mat",
      combination: "Un sol material",
      surfaces: "Llises; fronts encastats",
      thickness: "Tauler de 30, bloc a inglet",
      hardware: "Calaixos push",
      feeling: "Escultòric, de despatx d'arquitecte",
      quality: "Composició, inglets, juntes encastades",
      minimalism: 4,
      sophistication: 5,
      warmth: 4,
      functionality: 4,
      photos: [F("01_WOW_JP_Obumex_Kitchen_System_II (1).jpg")],
    },
    make: () => ({
      kind: "moble",
      modules: [B.box("Bloc", { w: 500, h: 710, d: 760, mat: WAL, base: B.onFloor, joint: "mitre", inset: true, push: true, gapBefore: 150 }, B.drawers(3))],
      references: [],
      parts: [P("Tauler", "flat", WAL, 1800, 800, 30, 0, 710, 0), P("Pla", "side", WAL, 740, 710, 30, 1620, 0, 30)],
    }),
  },
  {
    id: "wall-head-bed",
    type: "Llit",
    name: "Capçal mur",
    summary: "Plataforma flotant amb un capçal ample que fa de tauletes",
    study: {
      reference: "John Pawson (Home Farm), Vincent Van Duysen",
      language: "El capçal és una paret; el llit, una plataforma",
      geometry: "Pla vertical llarg i llosa horitzontal",
      proportions: "Capçal 2900 × 900 (dues fulles de 1450 amb junta al centre: no cap al tauler de 2800) per a matalàs de 1600 × 2000; plataforma a 290",
      materials: "Roure, lli",
      finishes: "Oli blanc, lli rentat",
      combination: "Fusta i tèxtil",
      surfaces: "Llises",
      thickness: "Taulers de 30; prestatges volats de 30",
      hardware: "Cap",
      feeling: "Refugi, horitzontal, lent",
      quality: "Proporció capçal/llit, ombra del sòcol",
      minimalism: 5,
      sophistication: 4,
      warmth: 5,
      functionality: 4,
      photos: [F("07-Daybed-Douglas-Classic-Home-Farm-UK-John-Pawson-Photographer-Claus-Troelsgaard-John-Pawson-Furniture-Collection-02-PR.jpg")],
    },
    make: () => platformBed({ matW: 1600, matL: 2000, mat: OAK, headMat: OAK, headW: 2900, headH: 900, headT: 30, shelves: true }),
  },
  {
    id: "floating-drawer",
    type: "Tauleta de nit",
    name: "Calaix volat",
    summary: "Un sol calaix penjat a la paret, a inglet",
    study: {
      reference: "Vincent Van Duysen, Molteni&C",
      language: "Volum mínim suspès",
      geometry: "Prisma pla",
      proportions: "500 × 180 × 380, a 450 del terra",
      materials: "Noguera xapada",
      finishes: "Oli mat",
      combination: "Un sol material",
      surfaces: "Front encastat",
      thickness: "Inglet: bloc sense cantells",
      hardware: "Push; fixació oculta",
      feeling: "Lleuger, net, el terra lliure",
      quality: "Junta encastada regular",
      minimalism: 5,
      sophistication: 4,
      warmth: 3,
      functionality: 3,
    },
    make: () => B.one(B.box("Tauleta", { w: 500, h: 180, d: 380, mat: WAL, base: B.hung(450), joint: "mitre", inset: true, push: true }, B.drawers(1))),
  },
  {
    id: "wall-wardrobe",
    type: "Armari",
    name: "Paret",
    summary: "Armari de paret a paret amb portes encastades sense tiradors",
    study: {
      reference: "John Pawson, Obumex, Poliform (portes a ras)",
      language: "L'armari desapareix: és una paret de fusta",
      geometry: "Pla vertical modulat per juntes",
      proportions: "2400 × 2300 × 620; tres cossos de 800 (penjador · prestatges · doble barra) tancats de dalt a baix: sis portes iguals (porta màxima de 2200)",
      materials: "Roure xapat",
      finishes: "Oli invisible",
      combination: "Un sol material",
      surfaces: "Veta vertical contínua, casada entre portes",
      thickness: "Fronts encastats: el gruix no es veu",
      hardware: "Push o junta de 3 mm per agafar; frontisses ocultes",
      feeling: "Ordre absolut, revestiment",
      quality: "Juntes i veta alineades de dalt a baix",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 5,
      photos: ["links/dinesean/dinesen-apartment-by-david-thulstrup-layers-oak-and-heartoak-invisible-oil-2-4m-300mm-19mm-interior-design-david-thulstrup-photo-eric-petschek-26.webp"],
    },
    make: () => B.wardrobe("Armari", { bodies: ["hang", "shelves", "hang2"], bodyW: 800, h: 2300, d: 620, mat: OAK, base: B.plinth(60, 40), inset: true, push: true }),
  },
  {
    id: "stone-console",
    type: "Consola",
    name: "Llosa i pedra",
    summary: "Llosa de travertí sobre dos taulers de roure i un prestatge baix",
    study: {
      reference: "John Pawson per Salvatori (Span), De La Espada",
      language: "Pedra i fusta, cadascuna amb el seu gruix",
      geometry: "Pòrtic: dos plans i una llosa",
      proportions: "1600 × 780 × 400",
      materials: "Travertí, roure",
      finishes: "Travertí apomassat, roure oliat",
      combination: "Pedra freda i fusta càlida",
      surfaces: "La porositat de la pedra contra la veta",
      thickness: "Pedra de 40 sobre taulers de 30",
      hardware: "Cap",
      feeling: "Material, mineral, de rebedor de casa d'arquitecte",
      quality: "Qualitat de la pedra i del tall",
      minimalism: 4,
      sophistication: 5,
      warmth: 3,
      functionality: 3,
      photos: [F("01_JP_Salvatori_Span_Indoor.jpg")],
    },
    make: () =>
      B.loose([
        M("Llosa de travertí", "flat", TRAV, 1600, 400, 40, 0, 740, 0),
        P("Pota", "side", OAK, 360, 740, 30, 200, 0, 20),
        P("Pota", "side", OAK, 360, 740, 30, 1370, 0, 20),
        P("Prestatge", "flat", OAK, 1140, 340, 30, 230, 150, 30),
      ]),
  },
  {
    id: "slab-chair",
    type: "Cadira",
    name: "Bloc",
    summary: "Cadira de taulers gruixuts: respatller sencer, laterals i seient",
    study: {
      reference: "John Pawson (Banlan), Donald Judd com a antecedent",
      language: "Cadira construïda com una caixa: plans, no barres",
      geometry: "Ortogonal",
      proportions: "460 × 780 × 500; seient a 440",
      materials: "Noguera o roure massís",
      finishes: "Oli fosc",
      combination: "Un sol material",
      surfaces: "Llises",
      thickness: "Tot a 30",
      hardware: "Cap",
      feeling: "Severa, escultòrica",
      quality: "Encaixos a la vista com a detall de fusteria",
      minimalism: 5,
      sophistication: 3,
      warmth: 3,
      functionality: 3,
      photos: [F("04-jp-banlan-series-chair-01.jpg")],
    },
    make: () => slabChair({ w: 460, d: 500, h: 780, seat: 440, mat: WAL }),
  },
  {
    id: "stone-block",
    type: "Taula auxiliar",
    name: "Bloc de pedra",
    summary: "Bloc de travertí sobre un sòcol de roure enretirat",
    study: {
      reference: "John Pawson (objectes de pedra), Salvatori",
      language: "Un sol bloc mineral",
      geometry: "Cub",
      proportions: "450 × 480 × 450",
      materials: "Travertí, roure",
      finishes: "Apomassat",
      combination: "Pedra sobre fusta",
      surfaces: "Porus vist",
      thickness: "Massís",
      hardware: "Cap",
      feeling: "Pes i permanència",
      quality: "Pedra sense juntes",
      minimalism: 5,
      sophistication: 4,
      warmth: 2,
      functionality: 2,
    },
    make: () => B.loose([M("Bloc de travertí", "flat", TRAV, 450, 450, 450, 0, 30, 0), P("Sòcol", "flat", OAK, 390, 390, 30, 30, 0, 30)]),
  },
  {
    id: "fluted-sideboard",
    type: "Aparador",
    name: "Estria",
    summary: "Volum de noguera amb quatre portes estriades (ranures verticals fresades) sobre un sòcol en ombra",
    study: {
      reference: "Vincent Van Duysen (Molteni&C), De La Espada",
      language: "Monòlit amb textura: el ritme vertical de les estries és l'únic ornament, i fa de reixeta",
      geometry: "Prisma pur; quatre fronts iguals ratllats de dalt a baix",
      proportions: "2200 × 700 × 480 (≈ 3:1); fronts de 550, ranures de 14 cada 24 (≈ 50 % obert); sòcol de 100 enretirat 60",
      materials: "Noguera xapada",
      finishes: "Oli o vernís mat",
      combination: "Un sol material; la llum rasant dibuixa les estries",
      surfaces: "Fresat vertical continu (ranures passants de la CNC), interior de noguera",
      thickness: "Tapa a inglet amb els laterals; fronts de 19 amb 40 de marge llis a tot el voltant",
      hardware: "Cap: obertura per pressió (push)",
      feeling: "Calma rítmica, artesania de precisió",
      quality: "Estries regulars i alineades d'un front a l'altre, junta de 3 mm, inglet net",
      minimalism: 4,
      sophistication: 5,
      warmth: 5,
      functionality: 4,
    },
    make: () => B.one(B.box("Aparador", { w: 2200, h: 700, d: 480, mat: WAL, base: B.plinth(100, 60), joint: "mitre", push: true }, B.v(B.auto(4), [fluted("left"), fluted("right"), fluted("left"), fluted("right")]))),
  },
  {
    id: "hung-console",
    type: "Escriptori",
    name: "Volada",
    summary: "Consola-escriptori penjada: un tauler gruixut de calaixos que surt de la paret",
    study: {
      reference: "John Pawson, Vincent Van Duysen (escriptoris penjats)",
      language: "Una llosa volada: res toca el terra",
      geometry: "Prisma prim i llarg penjat a la paret",
      proportions: "1600 × 180 × 450; a 750 del terra (alçada d'escriptori), dos calaixos de 800",
      materials: "Roure xapat",
      finishes: "Oli blanc mat",
      combination: "Un sol material",
      surfaces: "Front continu partit per una sola junta",
      thickness: "Caixa a inglet de 19: es llegeix com una llosa de 180",
      hardware: "Cap: calaixos amb guies push i fixació oculta a la paret",
      feeling: "Lleugeresa, ordre, espai lliure a sota",
      quality: "Inglets, junta central, ombra sota la llosa",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
    },
    make: () => B.one(B.box("Consola", { w: 1600, h: 180, d: 450, mat: OAK, base: B.hung(570), joint: "mitre", inset: true, push: true }, B.v(B.auto(2), [B.drawers(1), B.drawers(1)]))),
  },
  {
    id: "bench-library",
    type: "Banc",
    name: "Sòcol llibreria",
    summary: "Banc baix de parets gruixudes amb quatre nínxols per a llibres",
    study: {
      reference: "John Pawson (bancs d'obra), Dinesen",
      language: "Sòcol habitable: s'hi seu a sobre i s'hi guarden llibres a sota",
      geometry: "Prisma llarg i baix buidat en quatre nínxols iguals",
      proportions: "2400 × 450 × 400 (1:5,3); nínxols de ≈ 560, sòcol enretirat 60",
      materials: "Roure massís / xapat",
      finishes: "Oli blanc o sabó",
      combination: "Un sol material",
      surfaces: "Parets llises; el buit dels nínxols fa el dibuix",
      thickness: "Parets buides de 50 (sempre a inglet): gruix arquitectònic i seient ferm",
      feeling: "Robust, càlid, part de la paret",
      quality: "Gruix constant de totes les parets, ombra del sòcol",
      minimalism: 5,
      sophistication: 3,
      warmth: 5,
      functionality: 5,
    },
    make: () => B.one(B.box("Banc", { w: 2400, h: 450, d: 400, mat: OAK, base: B.plinth(80, 60), hollow: 50 }, B.v(B.auto(4), [B.open(0), B.open(0), B.open(0), B.open(0)]))),
  },
  {
    id: "tall-column",
    type: "Armari",
    name: "Columna",
    summary: "Armari alt de dues portes encastades de dalt a baix, sense tiradors, sobre un sòcol en ombra",
    study: {
      reference: "Obumex × John Pawson, Vincent Van Duysen",
      language: "Un pany de paret que s'obre: dues juntes verticals i res més",
      geometry: "Prisma vertical; fronts a nivell amb la caixa",
      proportions: "1000 × 2200 × 450 (1:2,2); portes de ≈ 480 × 2070; sòcol de 100 enretirat 60",
      materials: "Roure xapat",
      finishes: "Oli mat",
      combination: "Un sol material, interior igual",
      surfaces: "Fronts encastats amb veta vertical casada",
      thickness: "Caixa de 19 a inglet a dalt; els cantells no es veuen",
      hardware: "Cap: frontisses ocultes i obertura per pressió",
      feeling: "Vertical, silenciós, arquitectura",
      quality: "Juntes regulars al voltant de les portes, veta casada",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
    },
    make: () => B.one(B.box("Armari", { w: 1000, h: 2200, d: 450, mat: OAK, base: B.plinth(100, 60), joint: "mitre", inset: true, push: true }, B.v(B.auto(2), [B.door("left", 4), B.door("right", 4)]))),
  },
  {
    id: "waterfall-table",
    type: "Taula de menjador",
    name: "Pla",
    summary: "Tauler i dues potes de tauler sencer a inglet: la veta baixa fins a terra",
    study: {
      reference: "John Pawson × Dinesen, De La Espada",
      language: "Un sol pla plegat dues vegades",
      geometry: "U invertida; tres plans del mateix gruix",
      proportions: "2400 × 740 × 950; potes de fondària sencera",
      materials: "Roure massís / xapat",
      finishes: "Oli invisible",
      combination: "Un sol material",
      surfaces: "Veta contínua del tauler a les potes",
      thickness: "Tot a 30 i a inglet: cap cantell a la vista",
      feeling: "Monumental i serè, de refectori",
      quality: "Inglets perfectes, veta que dona la volta",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
    },
    make: () => B.waterfall("Taula", { w: 2400, h: 740, d: 950, mat: OAK }),
  },
  {
    id: "strata-wall",
    type: "Sistema de paret",
    name: "Estrat",
    summary: "Llosa de calaixos penjada i dos prestatges volats de roure, desplaçats com estrats",
    study: {
      reference: "Vincent Van Duysen (Molteni&C 505), John Pawson (prestatges volats), De La Espada",
      language: "Plans horitzontals que suren a la paret: un de gruixut (calaixos) i dos de prims (prestatges)",
      geometry: "Tres franges horitzontals desplaçades; composició asimètrica equilibrada",
      proportions: "2400 × 1670 × 400: llosa de 2400 × 300 a 420 del terra; prestatges de 1500 i 1200 a 1180 i 1640 (pas de 460), solapats al terç central",
      materials: "Roure massís / xapat",
      finishes: "Oli invisible",
      combination: "Un sol material",
      surfaces: "Llosa de parets buides a inglet amb tres calaixos encastats; prestatges de 30 amb el cantell a la vista",
      thickness: "Contrast de gruixos: llosa de 300 (parets de 50) contra prestatges de 30",
      hardware: "Calaixos push; prestatges amb ferros ocults encastats a la paret (no es veuen)",
      feeling: "Lleugeresa, ritme, paret habitada",
      quality: "Gruix constant de la llosa, juntes de calaix regulars, ombra sota cada pla",
      minimalism: 5,
      sophistication: 5,
      warmth: 4,
      functionality: 4,
    },
    make: () =>
      B.one(B.box("Llosa de calaixos", { w: 2400, h: 300, d: 400, mat: OAK, base: B.hung(420), joint: "mitre", inset: true, push: true, hollow: 50 }, B.v(B.auto(3), [B.drawers(1), B.drawers(1), B.drawers(1)])), {
        parts: [P("Prestatge volat", "flat", OAK, 1500, 260, 30, 0, 1180, 0, "Prestatges"), P("Prestatge volat", "flat", OAK, 1200, 260, 30, 1200, 1640, 0, "Prestatges")],
      }),
  },
  {
    id: "block-slab-island",
    type: "Illa de cuina",
    name: "Bloc i llosa",
    summary: "Bloc monolític de noguera travessat per una llosa de roure que fa de taula",
    study: {
      reference: "Obumex × John Pawson (Kitchen System II), Vincent Van Duysen",
      language: "Volums que s'interpenetren: un bloc alt de treball i una llosa baixa per seure",
      geometry: "Prisma pur de 2400 × 900 × 1000 i un pla horitzontal que en surt pel cap, sostingut per un sol pla vertical",
      proportions: "3600 en total (2:1 entre bloc i llosa); bloc a 900, llosa a 750: la diferència de 150 dibuixa l'encreuament",
      materials: "Noguera xapada (bloc), roure massís (llosa); variant amb el bloc de travertí",
      finishes: "Oli mat; noguera i roure del mateix to",
      combination: "Dues fustes, una fosca i massiva i una clara i prima",
      surfaces: "Bloc de parets buides a inglet; fronts encastats amb juntes de 3 mm; llosa llisa",
      thickness: "Parets de 50 contra llosa de 30: el bloc pesa, la llosa vola",
      hardware: "Cap a la vista: calaixos i portes push",
      feeling: "Arquitectura domèstica, cuina com a escultura",
      quality: "L'encreuament exacte dels dos volums, inglets i veta casada als fronts",
      minimalism: 5,
      sophistication: 5,
      warmth: 4,
      functionality: 5,
      photos: [F("01_WOW_JP_Obumex_Kitchen_System_II.jpg")],
    },
    make: () =>
      B.one(B.box("Bloc", { w: 2400, h: 900, d: 1000, mat: WAL, base: B.plinth(100, 80), joint: "mitre", inset: true, push: true, hollow: 50 }, B.v([800, "auto", 800], [B.drawers(3), B.doors(1), B.drawers(3)])), {
        parts: [P("Llosa", "flat", OAK, 1200, 900, 30, 2400, 720, 50, "Llosa"), P("Pota", "side", OAK, 800, 720, 30, 3570, 0, 100, "Llosa")],
      }),
  },
  {
    id: "thread-desk",
    type: "Escriptori",
    name: "Fil",
    summary: "Tauler de roure sobre dues potes de tauler, amb un calaix prim penjat a sota",
    study: {
      reference: "De La Espada, John Pawson, Vincent Van Duysen",
      language: "Pòrtic de tres plans i un calaix que gairebé no hi és",
      geometry: "U invertida oberta; un prisma prim enretirat sota el tauler",
      proportions: "1600 × 740 × 750; calaix de 1000 × 170 a 150 del cantell (ombra), potes enretirades 80",
      materials: "Roure massís / xapat",
      finishes: "Oli blanc",
      combination: "Un sol material",
      surfaces: "Llises; el calaix a inglet i el front encastat",
      thickness: "Tauler i potes de 30; calaix de 170 que es llegeix com una línia d'ombra",
      hardware: "Calaix push",
      feeling: "Lleuger, precís, d'estudi",
      quality: "El calaix enretirat que desapareix a l'ombra, proporció tauler/potes",
      minimalism: 5,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
    },
    make: () => ({
      kind: "moble",
      modules: [B.box("Calaix", { w: 1000, h: 170, d: 600, mat: OAK, base: B.hung(540), joint: "mitre", inset: true, push: true, gapBefore: 300 }, B.drawers(1))],
      references: [],
      parts: [P("Tauler", "flat", OAK, 1600, 750, 30, 0, 710, 0), P("Pota", "side", OAK, 650, 710, 30, 80, 0, 50), P("Pota", "side", OAK, 650, 710, 30, 1490, 0, 50)],
    }),
  },
  {
    id: "chamber-wardrobe",
    type: "Armari",
    name: "Cambra",
    summary: "Paret d'armaris de dalt a baix amb un nínxol obert al mig que trenca la superfície",
    study: {
      reference: "John Pawson (cases de Home Farm), Obumex, Poliform (portes a ras)",
      language: "Revestiment de fusta excavat: el buit és l'únic dibuix d'una paret contínua",
      geometry: "Pla vertical de 2700; tres cossos i, al central, un nínxol horitzontal",
      proportions: "2700 × 2300 × 620; cossos de 850 · 1000 · 850; nínxol de 600 a 900 del terra (alçada de tocador)",
      materials: "Roure xapat",
      finishes: "Oli invisible",
      combination: "Un sol material, interior del nínxol igual",
      surfaces: "Fronts encastats, veta vertical; nínxol amb un prestatge gruixut a ras; a dalt, prestatges buits de 50 (1000 de llum)",
      thickness: "Fronts a nivell de la caixa; prestatge de 50 al nínxol",
      hardware: "Push i frontisses ocultes",
      feeling: "Ordre, calma, el buit com a lloc",
      quality: "Juntes alineades amb el nínxol, veta casada de dalt a baix",
      minimalism: 5,
      sophistication: 5,
      warmth: 4,
      functionality: 5,
    },
    make: () => {
      const o = { h: 2300, d: 620, mat: OAK, base: B.plinth(60, 40), inset: true, push: true }
      const [left, right] = B.wardrobe("Armari", { bodies: ["hang", "hang2"], bodyW: 850, ...o }).modules
      const mid = B.box("Nínxol", { ...o, w: 1000 }, B.h([900, 600, "auto"], [B.drawers(2), B.fixed(1, { thickness: 50, flush: true }), { ...B.doors(0), shelves: { n: 2, adjustable: false, thickness: 50 } }]))
      return { kind: "armari", modules: [{ ...left!, name: "Cos 1" }, mid, { ...right!, name: "Cos 3" }], references: [] }
    },
  },
]

// --- 2. Minimalisme comercial -------------------------------------------------------------------

const M330 = "Mòdul 330"
const GAL = "Galeria"
const DU = "Doble U"
const LIN = "Línia"

const COM: PieceDef[] = [
  {
    id: "m330-library",
    type: "Llibreria",
    name: `${M330} paret`,
    summary: "Sistema de paret sobre la retícula de 330: portes, calaixos i prestatges",
    study: {
      family: M330,
      reference: "Porro System (Piero Lissoni), Poliform Wall System",
      language: "Sistema modular: tot surt d'una retícula",
      geometry: "Retícula ortogonal de 330 mm",
      proportions: "Columnes de 660 i 990; alçades de 330 en 330 (+ 30 de sòcol); fondàries 346 / 474",
      materials: "Lacat antracita i noguera",
      finishes: "Lacat mat, noguera oliada",
      combination: "Estructura fosca i fronts de fusta",
      surfaces: "Llises; prestatges prims",
      thickness: "19 arreu: lleugeresa de sistema",
      hardware: "Frontisses ocultes, push o gola",
      feeling: "Ordre, flexibilitat, catàleg",
      quality: "Modulació exacta, alineació de juntes",
      minimalism: 4,
      sophistication: 4,
      warmth: 3,
      functionality: 5,
      sizes: "Amplades 330 · 495 · 660 · 990 · 1320; alçades 360 … 3000 (pas 330)",
      finishOptions: "Lacats mats de la carta, roure, noguera, freixe tenyit",
    },
    make: () => {
      const o = { h: 2010, d: 346, mat: ANTH, front: WAL, base: B.plinth(30, 0), push: true }
      return B.row([
        B.box("Columna 1", { ...o, w: 660 }, B.h([690, "auto"], [B.doors(1), B.open(3)])),
        B.box("Columna 2", { ...o, w: 990 }, B.h([360, "auto"], [B.drawers(1), B.fixed(4, { thickness: 50 })])),
        B.box("Columna 3", { ...o, w: 990 }, B.h([690, 330, "auto"], [{ ...B.doors(0), shelves: { n: 1, adjustable: false, thickness: 50 } }, B.open(0), B.fixed(2, { thickness: 50 })])),
        B.box("Columna 4", { ...o, w: 660 }, B.h([690, "auto"], [B.doors(1), B.open(3)])),
      ])
    },
  },
  {
    id: "m330-tv",
    type: "Moble TV",
    name: `${M330} baix`,
    summary: "Tres mòduls de 990 sobre sòcol: calaixos i nínxol per als aparells",
    study: {
      family: M330,
      reference: "Porro System, Poliform",
      language: "Modular, baix i llarg",
      geometry: "Prisma baix dividit en tres",
      proportions: "2970 × 420 × 474",
      materials: "Lacat antracita, noguera",
      finishes: "Mat",
      combination: "Bicolor",
      surfaces: "Fronts llisos",
      thickness: "19",
      hardware: "Push",
      feeling: "Ordenat, tecnològic",
      quality: "Retícula, passacables ocults",
      minimalism: 4,
      sophistication: 3,
      warmth: 3,
      functionality: 5,
      sizes: "1980 · 2640 · 2970 · 3300 (2 a 4 mòduls de 660 / 990)",
      finishOptions: "Lacats, roure, noguera",
    },
    make: () => {
      const o = { w: 990, h: 390, d: 474, mat: ANTH, front: WAL, base: B.plinth(30, 0), push: true }
      return B.row([B.box("Mòdul 1", o, B.drawers(1)), B.box("Mòdul 2", o, B.open(0)), B.box("Mòdul 3", o, B.drawers(1))])
    },
  },
  {
    id: "m330-sideboard",
    type: "Aparador",
    name: `${M330} bufet`,
    summary: "1980 de tres cossos de 660 sobre potes primes de ferro",
    study: {
      family: M330,
      reference: "Porro, MDF Italia",
      language: "Caixa neta sobre potes",
      geometry: "Prisma elevat",
      proportions: "1980 × 720 × 474; potes de 150",
      materials: "Lacat greige, roure, ferro",
      finishes: "Lacat mat, ferro pintat",
      combination: "Lacat i fusta",
      surfaces: "Llises",
      thickness: "19, potes de 30 × 30",
      hardware: "Push; potes a la vista",
      feeling: "Lleuger, versàtil",
      quality: "Proporció cos/potes",
      minimalism: 4,
      sophistication: 3,
      warmth: 3,
      functionality: 5,
      sizes: "1320 · 1980 · 2640",
      finishOptions: "Lacats, roure, noguera; potes ferro o bronze",
    },
    make: () =>
      B.sideboard("Aparador", { w: 1980, h: 570, d: 474, mat: GREIGE, front: OAK, base: B.legs(150), push: true }, [["auto", B.doors(1)], [660, B.drawers(3)], ["auto", B.doors(1)]], (o) => B.ironLegs(0, o.w, 0, o.d, 150, "post")),
  },
  {
    id: "m330-divider",
    type: "Prestatgeria",
    name: `${M330} doble cara`,
    summary: "Prestatgeria sense fons per separar espais",
    study: {
      family: M330,
      reference: "Porro System, Living Divani",
      language: "Retícula transparent",
      geometry: "Quadrícula oberta",
      proportions: "1980 × 1350 × 346",
      materials: "Roure",
      finishes: "Oli",
      combination: "Un sol material",
      surfaces: "Llises",
      thickness: "19",
      hardware: "Cap",
      feeling: "Lleugera, permeable",
      quality: "Retícula exacta",
      minimalism: 4,
      sophistication: 3,
      warmth: 4,
      functionality: 4,
      sizes: "Alçades 1020 · 1350 · 2010; amplades 990 · 1320",
      finishOptions: "Roure, noguera, lacats",
    },
    make: () => B.row([1, 2].map((i) => B.box(`Prestatgeria ${i}`, { w: 990, h: 1350, d: 346, mat: OAK, base: B.plinth(30, 0), back: "none" }, B.fixed(3, { thickness: 50 })))),
  },
  {
    id: "gallery-tall",
    type: "Aparador",
    name: `${GAL} alt`,
    summary: "Madia alta lacada amb llosa de travertí i potes de ferro",
    study: {
      family: GAL,
      reference: "Porro Gallery Low Cupboard (Buratti), Minotti",
      language: "Volum arquitectònic racional sobre un peu mínim",
      geometry: "Prisma alt elevat",
      proportions: "2480 × 1154 × 471 (com la referència); variant de 3000",
      materials: "MDF lacat greige, travertí, ferro",
      finishes: "Lacat mat, pedra apomassada",
      combination: "Lacat + pedra + metall",
      surfaces: "Fronts llisos, tapa de pedra",
      thickness: "Pedra de 30 sobre caixa de 19",
      hardware: "Potes a la vista; fronts push sense tirador",
      feeling: "Elegància comercial, hotel de luxe",
      quality: "Combinació de materials, llum interior (a la referència: LED i mirall)",
      minimalism: 4,
      sophistication: 5,
      warmth: 3,
      functionality: 4,
      sizes: "2480 · 3000",
      finishOptions: "Lacats mats o brillants, fustes, tapa de marbre / travertí / fusta; potes ferro o llautó brunyit",
      photos: ["pdf/20250929-33828-PORRO_schede-tecniche_GALLERY-LOW-CUPBOARD.pdf"],
    },
    make: () => {
      const c = B.sideboard("Aparador", { w: 2480, h: 974, d: 471, mat: GREIGE, base: B.legs(150), top: { kind: "none" }, push: true }, [["auto", B.door("left", 2)], ["auto", B.door("right", 2)], [760, B.drawers(3)], ["auto", B.door("left", 2)], ["auto", B.door("right", 2)]], (o) => B.ironLegs(0, o.w, 0, o.d, 150, "sled"))
      return { ...c, parts: [...(c.parts ?? []), M("Tapa de travertí", "flat", TRAV, 2480, 471, 30, 0, 150 + 974, 0)] }
    },
  },
  {
    id: "gallery-console",
    type: "Consola",
    name: `${GAL} consola`,
    summary: "Caixa de dos calaixos sobre potes, tapa de travertí",
    study: {
      family: GAL,
      reference: "Porro, Poliform",
      language: "Família Galeria a escala de rebedor",
      geometry: "Prisma pla elevat",
      proportions: "1400 × 780 × 400",
      materials: "Lacat greige, travertí, ferro",
      finishes: "Mat",
      combination: "Lacat + pedra + metall",
      surfaces: "Llises",
      thickness: "Pedra de 30",
      hardware: "Potes a la vista; calaixos push",
      feeling: "Elegant, lleugera",
      quality: "Coherència amb la família",
      minimalism: 4,
      sophistication: 4,
      warmth: 3,
      functionality: 3,
      sizes: "1200 · 1400 · 1800",
      finishOptions: "Com Galeria",
    },
    make: () => {
      const c = B.sideboard("Consola", { w: 1400, h: 330, d: 400, mat: GREIGE, base: B.legs(420), top: { kind: "none" }, push: true }, [["auto", B.drawers(1)], ["auto", B.drawers(1)]], (o) => B.ironLegs(0, o.w, 0, o.d, 420, "post"))
      return { ...c, parts: [...(c.parts ?? []), M("Tapa de travertí", "flat", TRAV, 1400, 400, 30, 0, 750, 0)] }
    },
  },
  {
    id: "gallery-night",
    type: "Tauleta de nit",
    name: `${GAL} nit`,
    summary: "Dos calaixos sobre potes amb tapa de travertí",
    study: {
      family: GAL,
      reference: "Poliform Night Collection, Porro",
      language: "Família Galeria a escala de dormitori",
      geometry: "Cub elevat",
      proportions: "550 × 520 × 420",
      materials: "Lacat greige, travertí, ferro",
      finishes: "Mat",
      combination: "Lacat + pedra + metall",
      surfaces: "Llises",
      thickness: "Pedra de 20",
      hardware: "Push",
      feeling: "Hotel",
      quality: "Coherència amb la família",
      minimalism: 4,
      sophistication: 4,
      warmth: 3,
      functionality: 4,
      sizes: "450 · 550 · 650",
      finishOptions: "Com Galeria",
    },
    make: () => {
      const c = B.sideboard("Tauleta", { w: 550, h: 300, d: 420, mat: GREIGE, base: B.legs(200), top: { kind: "none" }, push: true }, [["auto", B.drawers(2)]], (o) => B.ironLegs(0, o.w, 0, o.d, 200, "post"))
      return { ...c, parts: [...(c.parts ?? []), M("Tapa de travertí", "flat", TRAV, 550, 420, 20, 0, 500, 0)] }
    },
  },
  {
    id: "twin-sideboard",
    type: "Aparador",
    name: `${DU} baix`,
    summary: "Dos volums en U a 45°: un de calaixos i un d'obert",
    study: {
      family: DU,
      reference: "Porro Twin (Dordoni Studio), Molteni&C",
      language: "Intersecció de dos volums en U",
      geometry: "Dos prismes juxtaposats, un ple i un buit",
      proportions: "2520 × 495 × 550 (com la referència)",
      materials: "Freixe xapat (tenyit bru o negre a la referència)",
      finishes: "Tenyit mat",
      combination: "Fusta i buit; a la referència, miralls",
      surfaces: "Veta que dona la volta pels inglets",
      thickness: "Construcció a 45°: sense cantells",
      hardware: "Push",
      feeling: "Escultòric però vendible",
      quality: "Inglets, veta continuada",
      minimalism: 4,
      sophistication: 5,
      warmth: 3,
      functionality: 3,
      sizes: "2520 (fix) · variant 1800",
      finishOptions: "Freixe bru, freixe negre, roure",
      photos: ["pdf/20250930-33861-PORRO_schede-tecniche_TWIN.pdf"],
    },
    make: () =>
      B.row([
        B.box("Volum ple", { w: 1300, h: 495, d: 550, mat: ASH, base: B.onFloor, joint: "mitre", inset: true, push: true }, B.v(B.auto(2), [B.drawers(1), B.drawers(1)])),
        B.box("Volum obert", { w: 1220, h: 495, d: 550, mat: ASH, base: B.onFloor, joint: "mitre" }, B.open(0)),
      ]),
  },
  {
    id: "twin-coffee",
    type: "Taula de centre",
    name: `${DU} centre`,
    summary: "U a inglet, oberta per davant i per darrere",
    study: {
      family: DU,
      reference: "Porro Twin, B&B Italia",
      language: "Volum en U",
      geometry: "Prisma buidat",
      proportions: "1200 × 350 × 700",
      materials: "Freixe xapat",
      finishes: "Tenyit mat",
      combination: "Un sol material",
      surfaces: "Inglets",
      thickness: "19 a 45°",
      hardware: "Cap",
      feeling: "Net, de saló de revista",
      quality: "Inglets",
      minimalism: 4,
      sophistication: 4,
      warmth: 3,
      functionality: 3,
      sizes: "1000 · 1200 · 1400",
      finishOptions: "Freixe bru, negre, roure",
    },
    make: () => B.one(B.box("Taula", { w: 1200, h: 350, d: 700, mat: ASH, base: B.onFloor, joint: "mitre", back: "none" }, B.open(0))),
  },
  {
    id: "twin-tv",
    type: "Moble TV",
    name: `${DU} penjat`,
    summary: "Volum penjat a inglet amb nínxol central",
    study: {
      family: DU,
      reference: "Porro Twin, Molteni&C",
      language: "Volum en U suspès",
      geometry: "Prisma pla",
      proportions: "2200 × 400 × 450, a 300 del terra",
      materials: "Freixe xapat",
      finishes: "Tenyit mat",
      combination: "Un sol material",
      surfaces: "Inglets, fronts encastats",
      thickness: "19 a 45°",
      hardware: "Push, fixació oculta",
      feeling: "Lleuger",
      quality: "Juntes",
      minimalism: 4,
      sophistication: 4,
      warmth: 3,
      functionality: 4,
      sizes: "1800 · 2200 · 2600",
      finishOptions: "Freixe bru, negre, roure",
    },
    make: () => B.one(B.box("Moble TV", { w: 2200, h: 400, d: 450, mat: ASH, base: B.hung(300), joint: "mitre", inset: true, push: true }, B.v(B.auto(3), [B.drawers(1), B.open(0), B.drawers(1)]))),
  },
  {
    id: "linea-table",
    type: "Taula de menjador",
    name: `${LIN} 240`,
    summary: "Tauler de noguera sobre dues columnes de tauler",
    study: {
      family: LIN,
      reference: "Poliform (taules de menjador), Minotti",
      language: "Peus escultòrics de volum, tauler prim",
      geometry: "Llosa i dues columnes",
      proportions: "2400 × 750 × 1050; columnes de 300 × 600",
      materials: "Noguera",
      finishes: "Oli o vernís mat",
      combination: "Un sol material; variant amb tauler de pedra o ceràmica",
      surfaces: "Llises",
      thickness: "Tauler de 30, columnes buides",
      hardware: "Cap",
      feeling: "Representativa, càlida",
      quality: "Proporció i acabat",
      minimalism: 4,
      sophistication: 4,
      warmth: 4,
      functionality: 5,
      sizes: "2000 · 2400 · 2800 × 1050",
      finishOptions: "Noguera, roure, lacats; tauler de marbre o porcellànic",
    },
    make: () =>
      slabTable("Taula", { w: 2400, h: 750, d: 1050, mat: WAL }, (H) =>
        [450, 2400 - 450 - 300].flatMap((x) => [
          P("Columna", "side", WAL, 600, H, 30, x, 0, 225, "Columna"),
          P("Columna", "side", WAL, 600, H, 30, x + 270, 0, 225, "Columna"),
          P("Columna", "front", WAL, 240, H, 30, x + 30, 0, 225, "Columna"),
          P("Columna", "front", WAL, 240, H, 30, x + 30, 0, 795, "Columna"),
        ]),
      ),
  },
  {
    id: "linea-round",
    type: "Taula de menjador",
    name: `${LIN} rodona`,
    summary: "Taula rodona de noguera sobre peu central",
    study: {
      family: LIN,
      reference: "Poliform, B&B Italia",
      language: "Cercle sobre columna",
      geometry: "Circular",
      proportions: "Ø1200 × 750",
      materials: "Noguera, ferro",
      finishes: "Mat",
      combination: "Fusta i metall",
      surfaces: "Llises",
      thickness: "Tauler de 30",
      hardware: "Peu de metall a la vista",
      feeling: "Convivial",
      quality: "Equilibri del peu",
      minimalism: 4,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
      sizes: "Ø1000 · Ø1100 · Ø1200",
      finishOptions: "Noguera, roure, marbre",
    },
    make: () => B.legTable("Taula", { w: 1200, h: 750, d: 1200, mat: WAL, legs: "pedestal", shape: B.oval(1200, 1200) }),
  },
  {
    id: "linea-chair",
    type: "Cadira",
    name: `${LIN} cadira`,
    summary: "Cadira de noguera de plans amb coixí de cuir",
    study: {
      family: LIN,
      reference: "Poliform, Molteni&C, De La Espada",
      language: "Plans de fusta i un coixí",
      geometry: "Ortogonal",
      proportions: "500 × 800 × 520; seient a 450",
      materials: "Noguera, cuir",
      finishes: "Oli, cuir anilina",
      combination: "Fusta i pell",
      surfaces: "Llises",
      thickness: "30",
      hardware: "Cap",
      feeling: "Confortable i sobri",
      quality: "Pell, encaixos",
      minimalism: 4,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
      sizes: "Cadira · amb braços",
      finishOptions: "Noguera, roure; cuir, teixit",
    },
    make: () => slabChair({ w: 500, d: 520, h: 800, seat: 420, mat: WAL, cushion: LEATHER }),
  },
  {
    id: "linea-bench",
    type: "Banc",
    name: `${LIN} banc`,
    summary: "Banc de noguera sobre patins de ferro amb coixí de cuir",
    study: {
      family: LIN,
      reference: "Poliform, Minotti",
      language: "Llosa i coixí",
      geometry: "Prisma pla",
      proportions: "1600 × 490 × 400",
      materials: "Noguera, ferro, cuir",
      finishes: "Mat",
      combination: "Fusta, metall i pell",
      surfaces: "Llises",
      thickness: "Seient de 30",
      hardware: "Patins a la vista",
      feeling: "Peu de llit d'hotel",
      quality: "Combinació de materials",
      minimalism: 4,
      sophistication: 4,
      warmth: 4,
      functionality: 3,
      sizes: "1200 · 1600 · 2000",
      finishOptions: "Noguera, roure; cuir o teixit",
    },
    make: () => {
      const c = B.legTable("Banc", { w: 1600, h: 450, d: 400, mat: WAL, legs: "sled" })
      return { ...c, parts: [...(c.parts ?? []), M("Coixí", "flat", LEATHER, 1560, 360, 40, 20, 450, 20)] }
    },
  },
  {
    id: "linea-desk",
    type: "Escriptori",
    name: `${LIN} estudi`,
    summary: "Tauler de noguera sobre dos laterals i faldó",
    study: {
      family: LIN,
      reference: "Poliform (despatx), MDF Italia",
      language: "Pòrtic net",
      geometry: "Ortogonal",
      proportions: "1600 × 750 × 700",
      materials: "Noguera",
      finishes: "Mat",
      combination: "Un sol material",
      surfaces: "Llises",
      thickness: "30",
      hardware: "Cap",
      feeling: "Despatx domèstic",
      quality: "Proporció",
      minimalism: 4,
      sophistication: 3,
      warmth: 4,
      functionality: 4,
      sizes: "1400 · 1600 · 1800",
      finishOptions: "Noguera, roure, lacats",
    },
    make: () =>
      slabTable("Escriptori", { w: 1600, h: 750, d: 700, mat: WAL }, (H) => [
        P("Lateral", "side", WAL, 600, H, 30, 100, 0, 50),
        P("Lateral", "side", WAL, 600, H, 30, 1470, 0, 50),
        P("Faldó", "front", WAL, 1340, 300, 30, 130, H - 300, 80),
      ]),
  },
  {
    id: "linea-bed",
    type: "Llit",
    name: `${LIN} 160`,
    summary: "Llit amb capçal entapissat i plataforma de noguera flotant",
    study: {
      family: LIN,
      reference: "Poliform Night Collection, Minotti",
      language: "Capçal tou i base de fusta",
      geometry: "Pla vertical entapissat i plataforma",
      proportions: "Capçal 2000 × 1100 per a matalàs de 1600 × 2000",
      materials: "Noguera, teixit sorra",
      finishes: "Mat",
      combination: "Fusta i tèxtil",
      surfaces: "Entapissat llis",
      thickness: "Capçal de 80",
      hardware: "Cap",
      feeling: "Hotel, confort",
      quality: "Tapisseria, ombra del sòcol",
      minimalism: 3,
      sophistication: 4,
      warmth: 5,
      functionality: 4,
      sizes: "Matalàs 1400 · 1600 · 1800 · 2000",
      finishOptions: "Noguera, roure; teixits i pells de la carta",
    },
    make: () => platformBed({ matW: 1600, matL: 2000, mat: WAL, headMat: SAND, headW: 2000, headH: 1100, headT: 80, upholstered: true }),
  },
  {
    id: "linea-chest",
    type: "Calaixera",
    name: `${LIN} sis`,
    summary: "Calaixera de sis calaixos sobre patins",
    study: {
      family: LIN,
      reference: "Poliform (Night storage), De La Espada",
      language: "Caixa de calaixos sobre potes",
      geometry: "Prisma elevat",
      proportions: "1200 × 750 × 500",
      materials: "Noguera, ferro",
      finishes: "Mat",
      combination: "Fusta i metall",
      surfaces: "Fronts llisos",
      thickness: "19",
      hardware: "Push",
      feeling: "Dormitori de suite",
      quality: "Juntes regulars",
      minimalism: 4,
      sophistication: 4,
      warmth: 4,
      functionality: 5,
      sizes: "900 · 1200 · 1600",
      finishOptions: "Noguera, roure, lacats",
    },
    make: () => B.sideboard("Calaixera", { w: 1200, h: 550, d: 500, mat: WAL, base: B.legs(200), push: true }, [["auto", B.drawers(3)], ["auto", B.drawers(3)]], (o) => B.ironLegs(0, o.w, 0, o.d, 200, "sled")),
  },
  {
    id: "linea-wardrobe",
    type: "Armari",
    name: `${LIN} armari`,
    summary: "Armari de quatre cossos lacat greige",
    study: {
      family: LIN,
      reference: "Poliform (Senzafine, Ubik), Molteni&C Gliss",
      language: "Sistema d'armari: pell contínua",
      geometry: "Pla vertical modulat",
      proportions: "3200 × 2280 × 600; cossos de 800",
      materials: "Lacat greige",
      finishes: "Lacat mat",
      combination: "Exterior lacat, interior de fusta (opció)",
      surfaces: "Portes llises",
      thickness: "19",
      hardware: "Tirador vertical llarg o gola (a la referència, metàl·lic)",
      feeling: "Ordenat, comercial",
      quality: "Interiors equipats",
      minimalism: 4,
      sophistication: 3,
      warmth: 3,
      functionality: 5,
      sizes: "Cossos de 400 · 600 · 800 · 1000; alçades 2400 · 2600 · 2800",
      finishOptions: "Lacats, fustes, vidre fumat",
    },
    make: () => B.wardrobe("Armari", { bodies: ["hang", "drawers", "shelves", "hang2"], bodyW: 800, h: 2280, d: 600, mat: GREIGE, base: B.plinth(80, 30) }),
  },
  {
    id: "linea-vitrine",
    type: "Vitrina",
    name: `${LIN} vitrina`,
    summary: "Vitrina de noguera amb prestatges de vidre i portes a baix",
    study: {
      family: LIN,
      reference: "Poliform (vitrines), Porro",
      language: "Volum alt amb buit il·luminat",
      geometry: "Prisma vertical",
      proportions: "800 × 1900 × 450",
      materials: "Noguera, vidre",
      finishes: "Mat",
      combination: "Fusta i vidre",
      surfaces: "Llises",
      thickness: "19, vidre de 8",
      hardware: "Push; LED (opció)",
      feeling: "Menjador de representació",
      quality: "Llum i vidre",
      minimalism: 3,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
      sizes: "600 · 800 (dues per a 1600)",
      finishOptions: "Noguera, roure, lacats",
    },
    make: () => B.one(B.box("Vitrina", { w: 800, h: 1900, d: 450, mat: WAL, base: B.plinth(60, 20), push: true }, B.h([800, "auto"], [B.doors(1), B.open()])), { parts: [1250, 1580].map((y) => B.glassShelf(19, 762, 400, y)) }),
  },
  {
    id: "linea-side",
    type: "Taula auxiliar",
    name: `${LIN} pedra`,
    summary: "Auxiliar rodona de pedra sobre peu",
    study: {
      family: LIN,
      reference: "Minotti, B&B Italia",
      language: "Disc sobre columna",
      geometry: "Circular",
      proportions: "Ø500 × 520",
      materials: "Pedra, ferro",
      finishes: "Pedra polida",
      combination: "Pedra i metall",
      surfaces: "Llises",
      thickness: "Pedra de 20",
      hardware: "Peu a la vista",
      feeling: "Complement",
      quality: "Pedra",
      minimalism: 4,
      sophistication: 4,
      warmth: 2,
      functionality: 3,
      sizes: "Ø400 · Ø500 · Ø600",
      finishOptions: "Marbres, travertí; peu ferro o bronze",
    },
    make: () => B.legTable("Auxiliar", { w: 500, h: 520, d: 500, mat: TRAV, legs: "pedestal", shape: B.oval(500, 500), stone: true }),
  },
  {
    id: "m330-media",
    type: "Moble TV",
    name: `${M330} mur`,
    summary: "Paret de TV de la retícula de 330: dues columnes, baix de calaixos i un prestatge pont que emmarca la tele",
    study: {
      family: M330,
      reference: "Porro System (Piero Lissoni), Poliform Wall System, Molteni&C 505",
      language: "Composició de sistema: columnes que emmarquen el buit de la tele",
      geometry: "Retícula ortogonal; dos volums verticals i un d'horitzontal",
      proportions: "2970 × 2010 × 474: columnes de 660, baix de 1650 × 360 (calaix · nínxol · calaix de 550) i prestatge pont a 1880: la tele (fins a 65″) queda emmarcada",
      materials: "Lacat antracita i noguera",
      finishes: "Lacat mat, noguera oliada",
      combination: "Estructura fosca, fronts i prestatges de fusta",
      surfaces: "Llises; nínxol central per als aparells",
      thickness: "Caixes de 19, prestatge pont de 30",
      hardware: "Frontisses ocultes i fronts push, com tota la família",
      feeling: "Ordre, tot al seu lloc, de catàleg",
      quality: "Alineació de juntes i de prestatges amb la retícula",
      minimalism: 4,
      sophistication: 4,
      warmth: 3,
      functionality: 5,
      sizes: "Amplada 2640 · 2970 · 3300 (columnes de 660 o 990); alçada 2010 o 2340",
      finishOptions: "Lacats mats de la carta, roure, noguera, freixe tenyit",
    },
    make: () => {
      const o = { h: 2010, d: 346, mat: ANTH, front: WAL, base: B.plinth(30, 0), push: true }
      const col = (n: number) => B.box(`Columna ${n}`, { ...o, w: 660 }, B.h([690, "auto"], [B.doors(1), B.open(3)]))
      return B.row([col(1), B.box("Baix", { ...o, w: 1650, h: 360, d: 474 }, B.v(B.auto(3), [B.drawers(1), B.open(0), B.drawers(1)])), col(2)], {
        parts: [P("Prestatge pont", "flat", WAL, 1610, 250, 30, 680, 1880, 0)],
      })
    },
  },
  {
    id: "twin-night",
    type: "Tauleta de nit",
    name: `${DU} nit`,
    summary: "Tauleta penjada a inglet: calaix push a baix i nínxol obert a dalt",
    study: {
      family: DU,
      reference: "Porro Twin (Dordoni Studio), Molteni&C",
      language: "La U de la família en petit: ple a baix, buit a dalt",
      geometry: "Cub allargat penjat, partit per un pla horitzontal",
      proportions: "500 × 360 × 400; a 300 del terra; calaix i nínxol de la mateixa alçada",
      materials: "Freixe xapat",
      finishes: "Tenyit mat",
      combination: "Un sol material",
      surfaces: "Veta que dona la volta pels inglets; front encastat",
      thickness: "19 a inglet: sense cantells",
      hardware: "Push",
      feeling: "Lleuger, net, de terra lliure",
      quality: "Inglets, junta regular del calaix",
      minimalism: 5,
      sophistication: 4,
      warmth: 3,
      functionality: 4,
      sizes: "500 · 600 d'amplada; penjada o sobre el terra",
      finishOptions: "Freixe bru, freixe negre, roure",
    },
    make: () => B.one(B.box("Tauleta", { w: 500, h: 360, d: 400, mat: ASH, base: B.hung(300), joint: "mitre", inset: true, push: true }, B.h(B.auto(2), [B.drawers(1), B.open(0)]))),
  },
  {
    id: "linea-fluted",
    type: "Aparador",
    name: `${LIN} estria`,
    summary: "Aparador de noguera sobre patins de ferro: dues portes estriades i tres calaixos",
    study: {
      family: LIN,
      reference: "Poliform (Jean-Marie Massaud), Minotti, Molteni&C",
      language: "La família Línia amb textura: estries verticals que fan de reixeta",
      geometry: "Prisma horitzontal sobre una base de ferro prima",
      proportions: "1800 × 750 × 480 sobre potes de 200: tres cossos de 600",
      materials: "Noguera xapada i ferro negre",
      finishes: "Noguera oliada, ferro pintat mat",
      combination: "Fusta càlida i metall fosc",
      surfaces: "Fronts estriats (ranures passants de la CNC) i fronts llisos de calaix",
      thickness: "Caixa de 19, patins de 30 × 20",
      hardware: "Push als fronts",
      feeling: "Elegant, contemporani, càlid",
      quality: "Estries regulars, juntes alineades, potes primes",
      minimalism: 4,
      sophistication: 4,
      warmth: 4,
      functionality: 4,
      sizes: "1800 · 2400 (quatre cossos)",
      finishOptions: "Noguera, roure fumat, lacat de la carta; potes negres o bronze",
    },
    make: () => B.sideboard("Aparador", { w: 1800, h: 750, d: 480, mat: WAL, base: B.legs(200), push: true }, [["auto", fluted("left")], ["auto", fluted("right")], ["auto", B.drawers(3)]], (o) => B.ironLegs(0, o.w, 0, o.d, 200, "sled")),
  },
  {
    id: "gallery-tv",
    type: "Moble TV",
    name: `${GAL} TV`,
    summary: "Moble TV baix lacat sobre patins de ferro, amb tapa de travertí i nínxol central",
    study: {
      family: GAL,
      reference: "Porro Gallery (Buratti), Minotti, Molteni&C",
      language: "La família Galeria a escala de saló: horitzontal, sobre un peu mínim",
      geometry: "Prisma baix elevat; nínxol central i dos calaixos",
      proportions: "2400 × 580 × 471 (la fondària de la família): calaixos de 800, nínxol de 800 i patins de 150",
      materials: "MDF lacat greige, travertí, ferro negre",
      finishes: "Lacat mat, pedra apomassada, ferro pintat",
      combination: "Lacat + pedra + metall",
      surfaces: "Fronts llisos push, tapa de pedra a ras",
      thickness: "Pedra de 30 sobre caixa de 19; patins de 30 × 20",
      hardware: "Push; patins a la vista",
      feeling: "Elegància de hotel, lleuger",
      quality: "Coherència amb la família, pedra a ras, potes primes",
      minimalism: 4,
      sophistication: 5,
      warmth: 3,
      functionality: 4,
      sizes: "1800 · 2400 · 3000",
      finishOptions: "Com Galeria: lacats, fustes; tapa de marbre, travertí o fusta",
    },
    make: () => {
      const c = B.sideboard("Moble TV", { w: 2400, h: 400, d: 471, mat: GREIGE, base: B.legs(150), top: { kind: "none" }, push: true }, [["auto", B.drawers(1)], [800, B.open(0)], ["auto", B.drawers(1)]], (o) => B.ironLegs(0, o.w, 0, o.d, 150, "sled"))
      return { ...c, parts: [...(c.parts ?? []), M("Tapa de travertí", "flat", TRAV, 2400, 471, 30, 0, 550, 0)] }
    },
  },
  {
    id: "linea-island",
    type: "Illa de vestidor",
    name: `${LIN} illa`,
    summary: "Illa de vestidor de noguera: dotze calaixos push sota una tapa de vidre",
    study: {
      family: LIN,
      reference: "Poliform (Senzafine, illes de vestidor), Molteni&C Gliss Master",
      language: "Bloc de calaixos com a peça central del vestidor",
      geometry: "Prisma baix de quatre cares iguals, tres columnes de quatre calaixos",
      proportions: "1800 × 940 × 600; calaixos de 600 × ≈ 200; sòcol de 80 enretirat 40",
      materials: "Noguera xapada, vidre",
      finishes: "Noguera oliada, vidre fumat (a la referència)",
      combination: "Fusta i vidre",
      surfaces: "Fronts encastats a inglet, tapa de vidre de 10",
      thickness: "Caixa de 19 a inglet; vidre de 10 que deixa veure la fusta",
      hardware: "Push",
      feeling: "Suite d'hotel, ordre",
      quality: "Juntes regulars a les tres columnes, inglets",
      minimalism: 4,
      sophistication: 5,
      warmth: 4,
      functionality: 5,
      sizes: "1200 · 1800 · 2400 (dues a quatre columnes)",
      finishOptions: "Noguera, roure fumat, lacats; tapa de vidre, cuir o pedra",
    },
    make: () =>
      B.one(B.box("Illa", { w: 1800, h: 860, d: 600, mat: WAL, base: B.plinth(80, 40), joint: "mitre", inset: true, push: true }, B.v(B.auto(3), [B.drawers(4), B.drawers(4), B.drawers(4)])), {
        parts: [M("Tapa de vidre", "flat", GLASS, 1800, 600, 10, 0, 940, 0)],
      }),
  },
]

// --- Col·leccions -----------------------------------------------------------------------------------

const ARQ_DEFAULTS = {
  hardware: "Cap a la vista: obertura per pressió, juntes o ombres",
  architecture: "Forma part de l'arquitectura: s'arramba, continua la paret o es posa al centre com un volum",
}
const COM_DEFAULTS = {
  hardware: "Pocs i discrets (push, gola o tirador prim)",
  architecture: "S'integra en interiors diversos; la família es combina en salons, menjadors i dormitoris",
}

export const FURNITURE_COLLECTIONS: FurnitureCollection[] = [
  {
    id: "arquitectonic",
    name: "Minimalisme arquitectònic",
    description: "Peces que transmeten arquitectura, serenitat, precisió, proporció i qualitat: volums purs, gruixos honestos, cap element sobrer.",
    principles: [
      "Simplicitat formal extrema: volums purs i geometries essencials",
      "Sensació monolítica: inglets, parets buides i juntes en lloc de cantells",
      "L'espai buit forma part de la peça (caixes obertes, nínxols, ombres)",
      "Mobiliari com a arquitectura: bancs que continuen la paret, armaris que són paret",
      "Fusta natural i materials nobles (roure, noguera, travertí) usats amb contenció",
      "Unions, ferratges i tiradors que desapareixen",
      "Llum, ombra i volum: sòcols enretirats que fan flotar les lloses",
      "Artesania amb precisió industrial; caràcter atemporal",
    ],
    references: [
      { name: "John Pawson", url: "https://www.johnpawson.com/", note: "Taules, bancs, daybeds i objectes amb Dinesen, Nikari, Viccarbe, Salvatori i Obumex" },
      { name: "Vincent Van Duysen", url: "https://www.vincentvanduysen.com/", note: "Volums monolítics i calidesa; direcció creativa de Molteni&C" },
      { name: "De La Espada", url: "https://delaespada.com/", note: "Fusta massissa, proporcions lentes" },
      { name: "Nikari", url: "https://nikari.fi/", note: "Frame (John Pawson): marc de fusta massissa" },
      { name: "Molteni&C", url: "https://www.molteni.it/es/es", note: "Peces d'autor amb fabricació industrial" },
      { name: "Dinesen", url: "https://www.dinesen.com/en/inspiration", note: "Taulons amples; col·lecció amb Pawson; interiors de Thulstrup" },
      { name: "Obumex", url: "https://www.obumex.be/", note: "Kitchen System II (John Pawson): monòlits de noguera" },
    ],
    pieces: pieces("arquitectonic", ARQ_DEFAULTS, ARQ),
  },
  {
    id: "comercial",
    name: "Minimalisme comercial",
    description: "Com el minimalisme es converteix en una col·lecció de productes coherent: famílies, mòduls, mides i acabats, sense perdre elegància.",
    principles: [
      "Famílies de productes coherents (Mòdul 330, Galeria, Doble U, Línia)",
      "Retícula modular: el mòdul de 330 mm i les seves fondàries (346 · 474)",
      "Varietat de mides i d'acabats dins de cada família",
      "Combinació de materials: lacats, fusta, pedra, metall, vidre i tèxtil",
      "Funcionalitat: emmagatzematge, interiors equipats, passacables",
      "Capacitat d'integrar-se en interiors diferents (saló, menjador, dormitori, despatx)",
      "Elegància comercial: proporcions atractives, peus prims, tapes de pedra",
    ],
    references: [
      { name: "Poliform", url: "https://www.poliform.it/", note: "Day, Night i Kitchen: sistemes de paret, armaris i vestidors" },
      { name: "Minotti", url: "https://www.minotti.com/", note: "Mobles d'acompanyament i taules" },
      { name: "B&B Italia", url: "https://www.bebitalia.com/", note: "Taules i aparadors" },
      { name: "MDF Italia", url: "https://www.mdfitalia.com/", note: "Sistemes i prestatgeries lleugeres" },
      { name: "Living Divani", url: "https://www.livingdivani.it/", note: "Composicions de saló i exterior" },
      { name: "Porro", url: "https://www.porro.com/", note: "System (mòdul de 330), Gallery Low Cupboard, Twin" },
      { name: "Molteni&C", url: "https://www.molteni.it/es/es", note: "Sistemes de dia i nit" },
      { name: "De La Espada", url: "https://delaespada.com/", note: "Famílies de fusta massissa" },
      { name: "MIRSA", url: "https://www.mirsa.es/", note: "Interiorisme i mobiliari" },
      { name: "Gunni & Trentino", url: "https://www.gunnitrentino.es/collections/mobiliario", note: "Mobiliari de disseny per a projectes" },
      { name: "La Maison Barcelona", url: "https://lamaisonbarcelona.com/muebles/", note: "Botiga de mobles de disseny" },
      { name: "SKLUM", url: "https://www.sklum.com/es/524-comprar-mobiliario", note: "Gamma mitjana: com es tradueix el llenguatge al preu" },
    ],
    pieces: pieces("comercial", COM_DEFAULTS, COM),
  },
]

/** Totes les peces de les col·leccions (per a la cerca, els tests i els ambients). */
export const COLLECTION_PIECES: CollectionPiece[] = FURNITURE_COLLECTIONS.flatMap((c) => c.pieces)
