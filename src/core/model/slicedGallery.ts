import { newId } from "./composition"
import type { FreePart } from "./freePart"
import { bump, category, ellipse, ends, face, fineRelief, GLASS, lips, OAK, ovalNodes, relief, ribbon, turn, wave, type Design, type P, type SlicedCategory } from "./slicedDesign"

/**
 * Galeria **Llistons** de la pàgina Mobles (per decisió de l'usuari, 2026-10-21: «fes tots aquests que es vegin igual o
 * millor, amb roure massís», a partir de les seves captures de mobles paramètrics). Els dissenys, per categories; les
 * eines (la secció, la forma i el moble), a `slicedDesign.ts`.
 */

// --- Sofàs i butaques -------------------------------------------------------------------------------------------------

const SOFAS: Design[] = [
  {
    id: "bressol",
    name: "Sofà «Bressol»",
    use: "Sofà de tres places amb els braços que s'alcen als extrems i el respatller baix i arrodonit",
    price: 2690,
    length: 2000,
    n: 13,
    section: (t) => {
      const lift = 260 * ends(t, 0.09)
      return { outer: [[0, 0], [880, 0], [930, 240], [840, 400 + lift], [360, 390 + lift], [190, 470 + 0.7 * lift], [120, 740 + 0.2 * lift], [30, 790], [-30, 620], [-10, 220]], sharp: [0] }
    },
  },
  {
    id: "ona",
    name: "Sofà «Ona»",
    use: "Sofà d'ona: el respatller puja i baixa, i un braç s'alça a l'extrem com una onada",
    price: 2890,
    length: 2100,
    n: 15,
    section: (t) => {
      const hb = 300 + 330 * bump(t, 0.22, 0.25)
      const arm = 380 * bump(t, 0.95, 0.08)
      return { outer: [[0, 0], [850, 0], [900, 230], [820, 390 + arm], [350, 380 + 0.3 * arm], [200, 400 + 0.45 * hb], [110, 400 + hb], [0, 400 + 0.9 * hb], [-40, 300]], sharp: [0] }
    },
  },
  {
    id: "plec",
    name: "Sofà «Plec»",
    use: "Sofà amb el respatller que creix i es plega endavant cap a un extrem, com un full de paper",
    price: 2490,
    length: 1900,
    n: 13,
    section: (t) => {
      const hb = 380 + 520 * t ** 1.5
      return { outer: [[0, 0], [820, 0], [870, 250], [780, 400], [320, 390], [180, 420 + 0.5 * hb], [120 + 260 * t, 400 + hb], [-20, 380 + 0.8 * hb], [-50, 300]], sharp: [0] }
    },
  },
  {
    id: "jardi",
    name: "Sofà «Jardí»",
    use: "Sofà baix amb el respatller ondulat i els braços que s'enfonsen cap al seient",
    price: 2390,
    length: 2200,
    n: 15,
    section: (t) => {
      const arm = ends(t, 0.1)
      const back = 650 + 90 * wave(t, 1.5)
      return { outer: [[0, 0], [850, 0], [900, 230], [810, 390 + 240 * arm], [340, 380 + 120 * arm], [170, Math.max(back * 0.7, 380 + 160 * arm)], [100, back], [10, back - 20], [-30, back * 0.5], [-10, 150]], sharp: [0] }
    },
  },
  {
    id: "costelles",
    name: "Sofà «Costelles»",
    use: "Sofà de llistons molt separats (l'estructura es veu, com unes costelles) per posar-hi coixins a sobre",
    price: 1690,
    length: 1900,
    n: 11,
    section: (t) => {
      const lift = 220 * ends(t, 0.08)
      return { outer: [[0, 0], [800, 0], [830, 200], [760, 380 + lift], [330, 370 + lift], [170, 430 + 0.7 * lift], [110, 720 + 0.2 * lift], [20, 760], [-30, 560], [-10, 180]], sharp: [0] }
    },
    opts: { gap: 45, rods: 3 },
  },
  {
    id: "bucle",
    name: "Butaca «Bucle»",
    use: "Butaca de bucle: seient, respatller i base fan un anell amb un forat de banda a banda",
    price: 1290,
    length: 700,
    n: 9,
    section: (t) => {
      const s = 1 - 0.1 * (2 * t - 1) ** 2
      return {
        outer: [[100, 0], [760, 0], [830, 150], [810, 390], [690, 460], [420, 430], [250, 480], [170, 690 * s], [150, 920 * s], [40, 900 * s], [0, 640 * s], [20, 230]],
        inner: [[210, 130], [650, 130], [700, 260], [620, 340], [390, 320], [260, 350], [170, 260]],
        sharp: [0],
      }
    },
  },
  {
    id: "cova",
    name: "Butaca «Cova»",
    use: "Butaca en forma d'ou amb el sostre que t'abraça per sobre",
    price: 1590,
    length: 900,
    n: 11,
    section: (t) => {
      const s = 0.55 + 0.45 * Math.sin(t * Math.PI)
      const ctrl: P[] = [[200, 0], [580, 0], [770, 200], [820, 500], [700, 620], [560, 560], [420, 430], [300, 470], [260, 700], [390, 900], [300, 1050], [100, 1000], [0, 700], [40, 300]]
      return { outer: ctrl.map(([z, y], i) => [400 + (z - 400) * s, i < 2 ? 0 : y * (0.8 + 0.2 * s)]), sharp: [0] }
    },
  },
  {
    id: "duna",
    name: "Chaise longue «Duna»",
    use: "Chaise longue en S: el cap alt, la cintura avall i els genolls doblegats",
    price: 1490,
    length: 650,
    n: 7,
    section: () => ({ outer: [[250, 0], [1150, 0], [1300, 110], [1280, 260], [1100, 340], [900, 300], [650, 360], [420, 430], [200, 630], [80, 820], [0, 780], [60, 500], [160, 200]], sharp: [0] }),
  },
  {
    id: "forat",
    name: "Chaise longue «Forat»",
    use: "Chaise longue en S amb un forat a sota dels genolls que la fa més lleugera",
    price: 1590,
    length: 650,
    n: 7,
    section: () => ({
      outer: [[250, 0], [1150, 0], [1300, 110], [1280, 260], [1100, 340], [900, 300], [650, 360], [420, 430], [200, 630], [80, 820], [0, 780], [60, 500], [160, 200]],
      inner: [[480, 120], [900, 120], [1060, 190], [880, 235], [520, 280]],
      sharp: [0],
    }),
  },
]

// --- Cadires, tamborets i escultures ---------------------------------------------------------------------------------

const CHAIRS: Design[] = [
  {
    id: "cigne",
    name: "Cadira «Cigne»",
    use: "Cadira d'una sola cinta: el respatller baixa al seient, el seient cau pel davant i torna enrere per terra com un balancí",
    price: 690,
    length: 450,
    n: 5,
    section: () => ribbon([[40, 900], [80, 680], [140, 500], [240, 440], [430, 440], [520, 400], [540, 300], [470, 170], [330, 50], [150, 25], [-10, 70]], (u) => 70 - 15 * u),
  },
  {
    id: "volada",
    name: "Cadira «Volada»",
    use: "Cadira volada d'una peça: el respatller baixa al seient i el seient cau en corba fins al peu de davant",
    price: 690,
    length: 450,
    n: 5,
    section: () => ribbon([[70, 880], [100, 650], [150, 500], [240, 440], [420, 440], [500, 390], [480, 280], [400, 170], [420, 60], [580, 30]], () => 60),
  },
  {
    id: "onada",
    name: "Cadira «Onada»",
    use: "Cadira amb el respatller alt que fa onades i el seient que s'hi fon",
    price: 790,
    length: 460,
    n: 9,
    section: (t) => {
      const w = 40 * wave(t, 1)
      return { outer: [[60, 0], [500, 0], [520, 80], [420, 200], [460, 420], [300, 440], [200 + w, 560], [150 + w, 900], [60 + w, 880], [40, 500], [120, 300]], sharp: [0] }
    },
  },
  {
    id: "origami",
    name: "Cadira «Origami»",
    use: "Cadira de cares planes com un paper plegat; llistons encolats sense aire",
    price: 590,
    length: 450,
    n: 3,
    section: () => ({ outer: [[0, 0], [120, 0], [500, 400], [500, 450], [110, 450], [60, 900], [0, 900], [40, 430]], sharp: [0, 1, 2, 3, 4, 5, 6, 7] }),
    opts: { gap: 0 },
  },
  {
    id: "arc",
    name: "Tamboret «Arc»",
    use: "Tamboret amb dues potes en arc i el seient ondulat",
    price: 390,
    length: 380,
    n: 7,
    section: (t) => {
      const top = 450 - 20 * wave(t, 1)
      return { outer: [[0, 0], [60, 0], [120, 250], [340, 250], [400, 0], [460, 0], [470, 380], [430, top], [30, top], [-10, 380]], sharp: [0, 4] }
    },
    opts: { gap: 10 },
  },
  {
    id: "zeta",
    name: "Tamboret «Zeta»",
    use: "Tamboret en Z d'una sola cinta: el peu i el seient paral·lels",
    price: 290,
    length: 380,
    n: 5,
    section: () => ribbon([[20, 25], [290, 25], [360, 50], [370, 110], [200, 340], [190, 400], [250, 425], [470, 425]], () => 50),
    opts: { gap: 10 },
  },
  {
    id: "torre",
    name: "Tamboret «Torre»",
    use: "Tamboret alt de bar que es cargola i s'estreny a la cintura, de llistons drets",
    price: 490,
    length: 760,
    n: 9,
    along: "y",
    section: (t) => {
      const s = 1 - 0.28 * bump(t, 0.45, 0.25)
      return { outer: turn([[0, 0], [380, 0], [400, 170], [380, 340], [0, 340], [-20, 170]], 0.7 * t, [190, 170], [s, s]), sharp: [0, 3] }
    },
    opts: { gap: 12 },
  },
  {
    id: "flama",
    name: "Escultura «Flama»",
    use: "Escultura dreta en S que s'aprima cap a dalt",
    price: 890,
    length: 300,
    n: 7,
    section: (t) => ribbon([[200 + 40 * wave(t, 0.5), 0], [260, 300], [120, 700], [220, 1100], [120 + 40 * wave(t, 0.5), 1500]], (u) => 160 - 120 * u),
    opts: { gap: 10, rods: 1, rodDiameter: 8 },
  },
]

// --- Bancs ------------------------------------------------------------------------------------------------------------

const BENCHES: Design[] = [
  {
    id: "nivorra",
    name: "Banc «Nivorra»",
    use: "Banc de dues cares amb dos respatllers que s'alcen a banda i banda, un a cada meitat",
    price: 2190,
    length: 2400,
    n: 15,
    section: (t) => {
      const hb = 480 * bump(t, 0.28, 0.17), hf = 480 * bump(t, 0.72, 0.17)
      return { outer: [[0, 0], [700, 0], [760, 200], [720, 380 + 0.8 * hf], [640, 380 + hf], [560, 400], [140, 400], [60, 380 + hb], [-20, 380 + 0.8 * hb], [-60, 200]], sharp: [0] }
    },
  },
  {
    id: "riera",
    name: "Banc «Riera»",
    use: "Banc de jardí d'ona que s'aixeca cap a un extrem per recolzar-s'hi",
    price: 1890,
    length: 2200,
    n: 13,
    section: (t) => {
      const s = 330 + 60 * wave(t, 0.8)
      const r = 280 * bump(t, 0.85, 0.2)
      return { outer: [[0, 0], [650, 0], [700, s * 0.8], [600, s], [100, s + r], [0, (s + r) * 0.85]], sharp: [0] }
    },
  },
  {
    id: "lobby",
    name: "Banc «Vestíbul»",
    use: "Banc llarg de vestíbul amb un respatller que neix al mig i s'esvaeix als extrems",
    price: 2590,
    length: 2800,
    n: 15,
    section: (t) => {
      const b = 350 * bump(t, 0.5, 0.25)
      return { outer: [[0, 0], [550, 0], [600, 220], [540, 400], [160, 410], [80, 400 + b], [0, 400 + 0.9 * b], [-40, 250]], sharp: [0] }
    },
  },
  {
    id: "ales",
    name: "Banc «Ales»",
    use: "Banc amb el respatller que s'alça com dues ales als dos extrems",
    price: 1990,
    length: 2000,
    n: 15,
    section: (t) => {
      const w = 120 + 520 * Math.max(bump(t, 0.08, 0.12), bump(t, 0.92, 0.12))
      return { outer: [[0, 0], [600, 0], [640, 250], [580, 420], [170, 420], [120, 420 + 0.55 * w], [90, 420 + w], [-10, 420 + 0.95 * w], [-30, 250]], sharp: [0] }
    },
  },
  {
    id: "capsula",
    name: "Banc «Càpsula»",
    use: "Banc arrodonit com un còdol, una mica més alt al mig",
    price: 1290,
    length: 1800,
    n: 9,
    section: (t) => {
      const f = 0.85 + 0.15 * Math.sin(t * Math.PI)
      return { outer: [[60, 0], [440, 0], [500, 120 * f], [500, 300 * f], [400, 420 * f], [100, 420 * f], [0, 300 * f], [0, 120 * f]], sharp: [0] }
    },
  },
  {
    id: "serp",
    name: "Banc «Serp»",
    use: "Banc corbat de jardí: la planta fa un arc i el seient s'hi gira",
    price: 1790,
    length: 2400,
    n: 15,
    section: (t) => {
      const dz = 300 * Math.sin(t * Math.PI)
      return { outer: ([[0, 0], [450, 0], [480, 300], [420, 420], [30, 420], [-30, 300]] as P[]).map(([z, y]) => [z + dz, y]), sharp: [0] }
    },
  },
  {
    id: "onada-vestibul",
    name: "Banc «Onada de vestíbul»",
    use: "Banc llarg de vestíbul: a un extrem el seient s'alça i es plega com una onada que trenca, a l'altre s'aprima",
    price: 2890,
    length: 2600,
    n: 17,
    section: (t) => {
      const c = 380 * bump(t, 0.16, 0.13)
      const f = 1 - 0.35 * bump(t, 1, 0.18)
      return {
        outer: [[30, 0], [520 * f, 0], [560 * f, 220 * f], [500 * f, 420 * f + 0.4 * c], [300, 440 * f + 1.1 * c], [120 - 0.25 * c, 430 * f + c], [-10 - 0.2 * c, 380 * f + 0.6 * c], [-10, 200 * f]],
        sharp: [0],
      }
    },
    opts: { rods: 3 },
  },
  {
    id: "os",
    name: "Banc «Os»",
    use: "Banc orgànic amb dos peus i el mig enlaire; els extrems s'eixamplen i s'alcen com un os",
    price: 2390,
    length: 2600,
    n: 17,
    section: (t) => {
      const D = 420 + 220 * ends(t, 0.13)
      const top = 430 + 70 * ends(t, 0.09) + 15 * wave(t, 2)
      const y0 = Math.max(0, 260 - 330 * Math.max(bump(t, 0.12, 0.09), bump(t, 0.86, 0.09)))
      const o = (640 - D) / 2
      return { outer: [[o + 60, y0], [o + D - 60, y0], [o + D, y0 + 90], [o + D - 10, top - 50], [o + D - 90, top], [o + 90, top], [o + 10, top - 50], [o, y0 + 90]], sharp: [0] }
    },
    opts: { rods: 3 },
  },
  {
    id: "taula-viva",
    name: "Taula «Viva»",
    use: "Taula llarga escultòrica: el sobre pla i a sota onades que baixen fins a terra als extrems, on fan de pota",
    price: 3490,
    length: 3000,
    n: 17,
    section: (t) => {
      const y0 = Math.max(0, 640 - 760 * Math.max(bump(t, 0.07, 0.07), bump(t, 0.93, 0.07)) - 220 * bump(t, 0.5, 0.12) + 50 * wave(t, 2.5))
      return { outer: [[60, y0], [840, y0], [900, y0 + 60], [900, 740], [860, 760], [40, 760], [0, 740], [0, y0 + 60]], sharp: [4] }
    },
    opts: { rods: 3 },
  },
]

// --- Taules i taulells ------------------------------------------------------------------------------------------------

const TABLES: Design[] = [
  {
    id: "lux",
    name: "Taulell «Lux»",
    use: "Taulell de recepció amb el davant en onades creuades; el sobre i el darrere plans",
    price: 3490,
    length: 2600,
    n: 15,
    section: (t) => {
      const a = wave(t, 1.7), b = wave(t, 2.6, 0.3)
      return { outer: [[0, 0], [520 + 60 * a, 0], [660 + 80 * b, 350], [600 + 60 * a, 700], [720 + 50 * b, 1050], [680, 1110], [0, 1110]], sharp: [0, 5, 6] }
    },
    opts: { rods: 3 },
  },
  {
    id: "dunes",
    name: "Taulell «Dunes»",
    use: "Taulell de recepció escultòric: el davant fa dunes que pugen per sobre del sobre de treball",
    price: 3690,
    length: 2800,
    n: 17,
    section: (t) => {
      const a = wave(t, 1.4), b = wave(t, 2.3, 0.2), c = wave(t, 2.2, 0.6)
      return { outer: [[0, 0], [600, 0], [700 + 90 * a, 400], [650 + 60 * b, 900 + 120 * c], [500, 1000 + 80 * c], [350, 1100], [0, 1100]], sharp: [0, 5, 6] }
    },
    opts: { rods: 3 },
  },
  {
    id: "voladis",
    name: "Escriptori «Voladís»",
    use: "Escriptori amb dues potes que neixen del sobre en corba, una d'ample i una d'estreta",
    price: 1990,
    length: 2400,
    n: 17,
    section: (t) => {
      const yb = Math.max(0, 690 - 760 * Math.max(bump(t, 0.1, 0.1), bump(t, 0.9, 0.06)))
      return { outer: [[40, yb], [660, yb], [700, yb + 30], [700, 720], [660, 750], [40, 750], [0, 720], [0, yb + 30]], sharp: [0, 4] }
    },
    opts: { rods: 3 },
  },
  {
    id: "animal",
    name: "Taula de centre «Animal»",
    use: "Taula de centre de dos nivells: cada llistó és un marc amb el buit del mig",
    price: 890,
    length: 1100,
    n: 9,
    section: (t) => {
      const h = 90 + 40 * wave(t, 1)
      return { outer: [[40, 0], [660, 0], [700, 40], [700, 360], [660, 400], [40, 400], [0, 360], [0, 40]], inner: [[110, h], [590, h], [590, 310], [110, 310]], sharp: [0, 4] }
    },
  },
  {
    id: "espiral",
    name: "Taula de menjador «Espiral»",
    use: "Peu de taula de capes horitzontals que es cargolen i s'estrenyen al mig, amb sobre de vidre",
    price: 1890,
    length: 720,
    n: 9,
    along: "y",
    section: (t) => {
      const s = 1 - 0.6 * bump(t, 0.5, 0.28)
      return { outer: turn(ellipse([0, 0], 480, 330, 10), 1.3 * t, [0, 0], [s, s]) }
    },
    opts: { axis: "y", gap: 12 },
    extra: (b) => [
      { id: newId("p"), name: "Sobre de vidre", orient: "flat", material: GLASS, nest: false, w: 1500, h: 1000, thickness: 10, x: b.x + b.w / 2 - 750, y: b.y + b.h, z: b.z + b.d / 2 - 500, shape: ovalNodes(1500, 1000) },
    ],
  },
  {
    id: "bufet",
    name: "Bufet «Plec»",
    use: "Bufet de llistons amb el davant pla que es plega en una onada en diagonal, sobre quatre potes",
    price: 2690,
    length: 2000,
    n: 21,
    section: (t) => {
      const yc = 80 + 480 * t
      const a = 90 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.05) / 0.9)))
      return fineRelief(620, 32, (y) => 450 - a * Math.exp(-(((y - yc) / 110) ** 2)) + 0.5 * a * Math.exp(-(((y - yc - 150) / 120) ** 2)))
    },
    lift: 160,
    opts: { thickness: 16, gap: 6, rods: 3, rodDiameter: 8 },
    extra: (b) =>
      [b.x + 120, b.x + b.w - 160].flatMap((x) =>
        [b.z + 60, b.z + b.d - 100].map((z): FreePart => ({ id: newId("p"), name: "Pota", orient: "front", material: OAK, w: 40, h: 160, thickness: 30, x, y: 0, z, group: "Bufet «Plec» · potes" })),
      ),
  },
  {
    id: "marea-tv",
    name: "Moble TV «Marea»",
    use: "Moble de TV amb el davant de llistons que fan onades; el sobre, el darrere i la base plans",
    price: 1490,
    length: 1800,
    n: 15,
    section: (t) => {
      const f = (y: number) => 400 + 35 * wave(y / 500 + t * 1.2, 1)
      return { outer: [[0, 0], [f(0), 0], [f(125), 125], [f(250), 250], [f(375), 375], [f(500), 500], [0, 500]], sharp: [0, 5, 6] }
    },
  },
]

// --- Murals i prestatges ------------------------------------------------------------------------------------------------

const WALL: Design[] = [
  {
    id: "rostre",
    name: "Mural «Rostre»",
    use: "Un rostre de cara que surt de la paret entre onades, com una escultura de llistons",
    price: 1890,
    length: 1600,
    n: 81,
    level: 1,
    section: (t) => {
      const x = (t * 1600 - 800) / 420
      return fineRelief(1800, 91, (y) => 45 + 18 * wave(y / 1800 + 0.4 * t, 1.2) + face(x, (y - 950) / 420))
    },
    lift: 400,
    opts: { thickness: 16, gap: 14, rodDiameter: 8 },
  },
  {
    id: "mirada",
    name: "Mural «Mirada»",
    use: "Paret sencera d'onades amb un rostre girat cap a un costat, per a un dormitori o un vestíbul",
    price: 2890,
    length: 2600,
    n: 91,
    level: 1,
    section: (t) => {
      const x = (t * 2600 - 1050) / 480
      return fineRelief(2400, 101, (y) => 50 + 30 * wave(y / 2400 * 1.3 + 0.8 * t, 1) + 12 * wave(y / 600 - t, 1) + face(x, (y - 1350) / 480, 0.7))
    },
    lift: 100,
    opts: { thickness: 19, gap: 15, rodDiameter: 8 },
  },
  {
    id: "vestibul",
    name: "Mural «Vestíbul»",
    use: "Revestiment de paret per a un vestíbul: feixos de llistons que es cargolen de dalt a baix",
    price: 3990,
    length: 3200,
    n: 49,
    section: (t) => {
      const x = t * 3200
      return relief(2600, 15, (y) => {
        let z = 40
        for (const [c, ph] of [[450, 0], [1200, 0.35], [2000, 0.7], [2750, 0.15]] as const) {
          const cx = c + 160 * Math.sin((y / 2600) * Math.PI * 1.6 + ph * Math.PI * 2)
          z += 110 * Math.exp(-(((x - cx) / 200) ** 2)) * (0.6 + 0.4 * Math.sin((y / 2600) * Math.PI))
        }
        return z
      })
    },
    lift: 0,
    opts: { thickness: 19, gap: 21, rodDiameter: 8 },
  },
  {
    id: "mural-banc",
    name: "Mural «Banc de paret»",
    use: "Mural d'onades que baixa fins a terra i al mig es plega endavant i fa de banc",
    price: 3290,
    length: 2400,
    n: 25,
    section: (t) => {
      const seat = 400 * Math.min(1, 1.6 * Math.max(0, 1 - Math.abs(2 * t - 1) * 1.15))
      return fineRelief(2200, 56, (y) => {
        const wall = 60 + 40 * wave(y / 2200 * 1.4 + 0.9 * t, 1) + 30 * Math.max(0, 1 - y / 300)
        return wall + seat * Math.exp(-(((y - 400) / 70) ** 8)) + 0.4 * seat * Math.exp(-(((y - 200) / 160) ** 2))
      })
    },
    opts: { thickness: 19, gap: 15, rods: 3 },
  },
  { id: "llavis", name: "Mural «Llavis»", use: "Llavis de llistons per penjar a la paret", price: 490, length: 900, n: 13, section: lips(1), lift: 1300, opts: { thickness: 16, gap: 10, rodDiameter: 8 } },
  { id: "peto", name: "Mural «Petó»", use: "Llavis grans amb més relleu, per a una paret buida", price: 790, length: 1400, n: 15, section: lips(1.5), lift: 1200, opts: { thickness: 19, gap: 12 } },
  {
    id: "ones",
    name: "Mural «Ones»",
    use: "Mural d'ones concèntriques, com una gota que cau a l'aigua",
    price: 990,
    length: 1600,
    n: 17,
    section: (t) => relief(1000, 11, (y) => 55 + 40 * Math.cos((Math.hypot(t * 1600 - 800, y - 500) / 300) * Math.PI * 2) * Math.exp(-Math.hypot(t * 1600 - 800, y - 500) / 900)),
    lift: 900,
    opts: { thickness: 16, gap: 14, rodDiameter: 8 },
  },
  {
    id: "sorra",
    name: "Mural «Dunes de sorra»",
    use: "Mural llarg de dues onades creuades, com la sorra que deixa el vent",
    price: 1190,
    length: 2400,
    n: 17,
    section: (t) => relief(1000, 9, (y) => 95 + 40 * wave(y / 1000 + 0.6 * t, 1) + 22 * wave(y / 1000 * 2.3 - 1.4 * t, 1)),
    lift: 900,
    opts: { thickness: 16, gap: 14, rodDiameter: 8 },
  },
  {
    id: "sol",
    name: "Mural «Sol»",
    use: "Panell rodó bombat per a la paret (els llistons van drets, no en raigs)",
    price: 690,
    length: 1000,
    n: 13,
    section: (t) => {
      const h = Math.max(30, 500 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)))
      const z = 40 + 90 * (h / 500)
      return { outer: [[0, -h], [30, -h], [z * 0.85, -h * 0.5], [z, 0], [z * 0.85, h * 0.5], [30, h], [0, h]], sharp: [6] }
    },
    lift: 1500,
    opts: { thickness: 16, gap: 12, rodDiameter: 8 },
  },
  {
    id: "riu",
    name: "Prestatge «Riu»",
    use: "Prestatge de paret de dos nivells units per un cos que flueix",
    price: 690,
    length: 1800,
    n: 13,
    section: (t) => {
      const a = wave(t, 1), b = wave(t, 1.3, 0.4)
      return { outer: [[0, 0], [260 + 40 * a, 30], [250, 60], [120, 200], [110, 330], [240 + 50 * b, 350], [250, 380], [0, 380]], sharp: [6, 7] }
    },
    lift: 1000,
    opts: { thickness: 16, gap: 12, rodDiameter: 8 },
  },
  {
    id: "cim",
    name: "Prestatge «Cim»",
    use: "Prestatge de paret amb el sobre pla i dos cims a sota",
    price: 590,
    length: 1700,
    n: 15,
    section: (t) => {
      const D = 230 + 30 * wave(t, 1)
      const H = 60 + 260 * bump(t, 0.3, 0.1) + 180 * bump(t, 0.75, 0.12)
      return { outer: [[0, 300 - H], [0.55 * D, 300 - 0.5 * H], [D, 280], [D, 300], [0, 300]], sharp: [3, 4] }
    },
    lift: 1150,
    opts: { thickness: 16, gap: 12, rodDiameter: 8 },
  },
]

/** Les categories de la galeria Llistons. */
export const SLICED_GALLERY: SlicedCategory[] = [
  category("sofas", "Sofàs i butaques", SOFAS),
  category("cadires", "Cadires, tamborets i escultures", CHAIRS),
  category("bancs", "Bancs", BENCHES),
  category("taules", "Taules, taulells i bufets", TABLES),
  category("paret", "Murals i prestatges", WALL),
]
