import type { HardwareItem } from "../hardware"
import type { StepRule } from "../hardwareOps"

/**
 * Ferratges del **catàleg general Häfele** (`docs/blaetterkatalog.pdf`, no es puja al repo) que un motor de l'app col·loca i
 * mecanitza (per decisió de l'usuari, 2026-10-14: «només els que es puguin mecanitzar, els més moderns i fàcils»; les
 * categories amb més de 20 —frontisses, guies, calaixos— no s'hi toquen). Preferències v35.
 */

const SRC = (page: string) => `Catàleg general Häfele, p. FF ${page}`

// --- Perfils d'alumini per a portes de vidre (p. FF 4.269–4.273) -----------------------------------------------------

/** Quantitat de frontisses per alçada (la de les frontisses de cassoleta de l'app). */
const HINGES_BY_HEIGHT: StepRule = { steps: [{ upTo: 900, n: 2 }, { upTo: 1600, n: 3 }, { upTo: 2100, n: 4 }], else: 5 }

/**
 * La placa en creu Metallamat A amb cargols Euro premuntats (316.51.526, D = 6, la que diu la p. 4.272 per a aquests
 * marcs): dos forats a la filera System 32 (a 37 del davant), un a 16 per sobre i l'altre a 16 per sota de la frontissa.
 */
const METALLAMAT_PLATE = [
  { kind: "drill" as const, face: "A" as const, u: -16, v: 0, d: 5, depth: 12, tag: "plate" },
  { kind: "drill" as const, face: "A" as const, u: 16, v: 0, d: 5, depth: 12, tag: "plate" },
]

const glassFrame = (id: string, name: string, ref: string, frame: number, glass: number, page: string, notes: string[]): HardwareItem => ({
  id,
  name,
  category: "profile",
  engine: "glassFrame",
  maker: "Häfele",
  ref,
  tags: [...notes, SRC(page)],
  params: { frame, glass, plateSetback: 37, plateOffset: 0, endOffset: 100 },
  count: structuredClone(HINGES_BY_HEIGHT),
  targets: [
    { key: "frame", label: "Marc d'alumini (no es mecanitza: la frontissa Metallamat A s'hi clava)", ops: [] },
    { key: "side", label: "Lateral de les frontisses: placa en creu Metallamat A (316.51.526), a la filera System 32", ops: structuredClone(METALLAMAT_PLATE) },
  ],
  version: 1,
  builtin: true,
})

const METALLAMAT = "Frontissa Metallamat A 110° per al perfil (563.25.940 angular · .941 intermèdia · .942 enrasada) i placa en creu 316.51.526 (D = 6, cargols Euro): la placa al lateral, a la filera System 32."
const HYP_PLATE = "Hipòtesi: la placa es cargola als dos forats Ø5 × 12 de la filera System 32, a 16 per sobre i per sota de la frontissa (el catàleg dona el patró 37/32, no el Ø)."

export const HAFELE_GLASS_FRAMES: HardwareItem[] = [
  glassFrame("frame-hafele-23x14", "Marc d'alumini Häfele 23 × 14 recte", "563.25.902", 23, 4, "4.270", [
    "Perfil d'alumini per a marc de vidre 23 × 14, recte, vidre de 4: plata anoditzat 563.25.902 · color inox 563.25.002 (2.500 mm). Tall a inglet de 45° i escaires d'unió 563.25.910 (marc fins a 1.200) / .911 (1.200–2.000).",
    METALLAMAT,
    HYP_PLATE,
  ]),
  glassFrame("frame-hafele-38x14", "Marc d'alumini Häfele 38 × 14 recte", "563.26.902", 38, 4, "4.270", [
    "Perfil d'alumini per a marc de vidre 38 × 14, recte, vidre de 4: plata anoditzat 563.26.902 · color inox 563.26.002 (2.500 mm). Tall a inglet de 45° i escaires d'unió 563.25.910 / .911.",
    METALLAMAT,
    HYP_PLATE,
  ]),
  glassFrame("frame-hafele-26x14", "Marc d'alumini Häfele 26 × 14 de marc reduït", "563.26.922", 26, 4, "4.270", [
    "Perfil d'alumini per a marc de vidre 26 × 14 amb marc reduït, plata anoditzat 563.26.922 (2.500 mm): el vidre s'enganxa al davant (vidre lacat o amb passepartout).",
    METALLAMAT,
    HYP_PLATE,
  ]),
  glassFrame("frame-hafele-20x19", "Marc d'alumini Häfele 20,6 × 19", "563.32.902", 19, 5, "4.269", [
    "Perfil d'alumini per a marc de vidre 20,6 × 19, vidre de 5 (de 4 amb el perfil de seguretat): plata anoditzat 563.32.902 · color inox 563.32.002 (2.500 mm). Marc com a molt de 600 × 1.600; vidre = marc − 31 per costat. Joc de muntatge 563.32.999.",
    "Hipòtesi: frontissa de cassoleta Duomatic (p. 4.16 / 4.34) amb la placa en creu a la filera System 32 com la Metallamat A; els forats del perfil (unió angular) no són de la CNC de fusta.",
  ]),
]

// --- Tiradors (p. FF 1.29–1.103) ---------------------------------------------------------------------------------------

/**
 * La distància entre forats segons el front: la més gran que hi cap amb 40 mm de marge (llargada A del tirador + 40 ≤ el
 * costat del front); al més petit, la més petita de la sèrie.
 */
function handlePitch(sizes: [a: number, c: number][]): StepRule {
  const s = [...sizes].sort((x, y) => x[1] - y[1])
  return { steps: s.slice(0, -1).map(([, c], i) => ({ upTo: s[i + 1]![0] + 40, n: c })), else: s[s.length - 1]![1], strict: true }
}

const handle = (id: string, name: string, ref: string, sizes: [number, number][], page: string, notes: string[]): HardwareItem => ({
  id,
  name,
  category: "handle",
  engine: "barHandle",
  maker: "Häfele",
  ref,
  tags: [...notes, "Cargols M4 (FF 1.260): forats passants Ø5.", SRC(page)],
  params: { diameter: 5, margin: 3, inset: 40 },
  pitch: handlePitch(sizes),
  targets: [
    {
      key: "front",
      label: "Front: dos forats passants a la distància entre centres",
      ops: [
        { kind: "through", u: "-pitch/2", v: 0, d: "diameter", tag: "handle" },
        { kind: "through", u: "pitch/2", v: 0, d: "diameter", tag: "handle" },
      ],
    },
  ],
  version: 1,
  builtin: true,
})

export const HAFELE_HANDLES: HardwareItem[] = [
  handle("handle-hafele-h1935", "Tirador en D d'alumini Häfele H1935", "106.70.031", [[142, 128], [174, 160], [206, 192]], "1.29", [
    "Llargades 142 / 174 / 206 (entre centres 128 / 160 / 192), sortint 34. Níquel raspallat 106.70.030–.032 · gris anoditzat .050–.052 · negre anoditzat .040–.042 · negre rugós .060–.062.",
  ]),
  handle("handle-hafele-h1535", "Tirador de perfil d'alumini Häfele H1535", "106.60.934", [[150, 128], [182, 160], [214, 192]], "1.70", [
    "Llargades 150 / 182 / 214 (entre centres 128 / 160 / 192), sortint 50. Plata anoditzat 106.60.933 / .934 / .936 · inox 106.60.033 / .034 / .036.",
  ]),
  handle("handle-hafele-h1540", "Tirador d'alumini amb nansa horitzontal Häfele H1540", "106.60.944", [[69, 32], [197, 160]], "1.72", [
    "Llargades 69 / 197 (entre centres 32 / 160), sortint 25. Plata anoditzat 106.60.941 / .944 · inox 106.60.041 / .044.",
  ]),
  handle("handle-hafele-h1545", "Tirador d'inox Häfele H1545", "106.60.023", [[200, 160], [350, 320]], "1.72", [
    "Llargades 200 / 350 (entre centres 160 / 320; també 128 / 256), sortint 34. Inox 106.60.023 / .027.",
  ]),
  handle("handle-hafele-alu12", "Tirador corbat d'alumini Ø12 Häfele", "155.01.001", [[120, 96], [155, 128], [196, 160], [230, 192]], "1.92", [
    "Llargades 120 / 155 / 196 / 230 (entre centres 96 / 128 / 160 / 192), plata anoditzat 155.01.000–.003.",
  ]),
  handle("handle-hafele-alu-arc", "Tirador corbat d'alumini Häfele (fins a 224)", "100.87.902", [[113, 96], [151, 128], [188, 160], [227, 192], [262, 224]], "1.92", [
    "Llargades 113 / 151 / 188 / 227 / 262 (entre centres 96 / 128 / 160 / 192 / 224), sortint 34, plata anoditzat 100.87.901–.905.",
  ]),
  handle("handle-hafele-d8", "Tirador en D d'inox Ø8 Häfele", "155.01.224", [[72, 64], [104, 96], [136, 128], [168, 160], [200, 192]], "1.102", [
    "Inox AISI 304 mat raspallat, Ø8, sortint 32: 155.01.220 (64) · .222 (96) · .224 (128) · .225 (160) · .226 (192); també 82 i 112.",
  ]),
  handle("handle-hafele-d10", "Tirador en D d'inox Ø10 Häfele", "155.01.232", [[74, 64], [106, 96], [138, 128], [170, 160], [202, 192], [234, 224], [298, 288], [362, 352]], "1.102", [
    "Inox AISI 304 mat raspallat, Ø10, sortint 35: 155.01.230 (64) · .231 (96) · .232 (128) · .233 (160) · .234 (192) · .235 (224) · .236 (288) · .237 (352). En llautó PVD 112.04.070 / .071 i negre mat PVD 112.04.072 / .073 (96 / 128).",
  ]),
  handle("handle-hafele-d12", "Tirador en D d'inox Ø12 Häfele", "155.01.251", [[108, 96], [140, 128], [172, 160], [204, 192], [236, 224], [300, 288], [332, 320], [364, 352], [460, 448], [492, 480], [572, 560], [652, 640], [972, 960]], "1.103", [
    "Inox AISI 304 mat raspallat, Ø12, sortint 35: 155.01.250 (96) · .251 (128) · .252 (160) · .253 (192) · .254 (224) · .255 (288) · .256 (320) · .257 (352) · .258 (448) · .259 (480) · .260 (560) · .261 (640) · .262 (960).",
  ]),
]

// --- Suports de prestatge (p. FF 3.103–3.104) ----------------------------------------------------------------------------

const support = (id: string, name: string, ref: string, page: string, note: string): HardwareItem => ({
  id,
  name,
  category: "shelf-support",
  engine: "system32",
  maker: "Häfele",
  ref,
  tags: [note, "Per embotir en un forat Ø5: a la filera System 32 (Ø5 × 12).", SRC(page)],
  params: { edgeOffset: 37, pitch: 32, diameter: 5, depth: 12 },
  targets: [{ key: "side", label: "Lateral", ops: [{ kind: "drill", face: "A", u: 0, v: 0, d: "diameter", depth: "depth", tag: "system32" }] }],
  version: 1,
  builtin: true,
})

export const HAFELE_SUPPORTS: HardwareItem[] = [
  support("shelf-hafele-282-24-717", "Suport de prestatge Häfele Ixconnect de zamac (piu Ø5)", "282.24.717", "3.103", "Zamac niquelat plata, dues llengüetes en tascó, 9,4 kg per suport (DIN EN 16337); amb el recolzament de plàstic, 282.24.733."),
  support("shelf-hafele-282-04-712", "Suport de prestatge Häfele Ixconnect d'acer amb llengüeta (piu Ø5)", "282.04.712", "3.104", "Acer niquelat amb llengüeta de fixació contra el lliscament; sense llengüeta, 282.04.711 (niquelat) / 282.04.515 (llautonat)."),
]

/** v35: els ferratges del catàleg general Häfele (additiu: s'afegeixen si no hi són, per id). */
export const HAFELE_CATALOGUE_ITEMS: HardwareItem[] = [...HAFELE_GLASS_FRAMES, ...HAFELE_HANDLES, ...HAFELE_SUPPORTS]
