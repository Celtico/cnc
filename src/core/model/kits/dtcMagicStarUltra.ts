import type { HardwareKit, KitClosing, KitVariant } from "../hardwareKit"
import { doubleWallKit, frontYsCentred, nl2 } from "./dtcDoubleWall"

/**
 * **DTC MAGIC-STAR ULTRA** (sèrie HD), calaix de doble paret amb la guia més baixa (catàleg DTC 2026, pp. 267–330):
 *
 * - HD11 **M** (lateral 88, darrere de fusta 58) — pp. 273–274
 * - HD12 **K** (lateral 126, darrere 96) — pp. 285–286
 * - HD13 **C** (lateral 174, darrere 144) — pp. 297–298
 * - HD14 **F** (lateral 238, darrere 208) — pp. 309–310
 * - Darreres metàl·lics HD1x034<KB> i fons de 16 (NL − 13 × LW − 19) — p. 327; muntatge pp. 313–314
 *
 * Fets de les pàgines: NL ∈ {270 … 600}; joc complet `HD1<s><NL/10>04A11` (suau), `HD6<s><NL/10>04A11` (push-open),
 * `HD7<s><NL/10>04A11` (push + suau, des de 350); guies `HD10<NL>H` / `HD10<NL/10>04GX` / `HD10<NL/10>04K`; joc de
 * laterals `HD1<s><NL/10>011` (blanc seda E29, gris mat E30, negre mat E36); suports de davant HE1s011X (cargolat),
 * HE1s016X (a pressió Ø10) i HD1s019 (espiga ràpida); **sense suports de darrere** (el lateral porta el ganxo del
 * darrere: cargols a 9 del cantell); barra GG0FH01 tallada a LW − 167 (push) o LW − 238 (push + suau); taula KB →
 * barra: 300–600 ○, 800–1200 ● (sense estabilitzador). LT = NL + 3, guia a 3 del cantell, «quart forat» a 37. Fusta:
 * darrere LW − 40 × alçada; fons LW − 19 × NL − 13 (amb darrere de fusta i metàl·lic), tauler de 16. Front: forats Ø2 (o
 * Ø10) a 32 (M: 2; K: 3; C: 2 + 2 a 96; F: 4 + 2), el de baix a ≥ 51.
 */

const NLS = [270, 300, 350, 400, 450, 500, 550, 600]

/** Columnes de cargols de la guia (z des del cantell de davant; el «quart forat» és a 37). Llegides del dibuix (no a escala). */
export function hdScrews(nl: number): KitVariant["screws"] {
  const rear = nl <= 300 ? [165, 229] : nl <= 400 ? [165, 261] : nl <= 450 ? [165, 284] : nl <= 500 ? [197, 261, 284] : [197, 261, 284, 339]
  return { both: [37, ...rear], top: [69] }
}

function variants(s: number): KitVariant[] {
  return NLS.map((nl) => {
    const kit: Partial<Record<KitClosing, string>> = { soft: `HD1${s}${nl2(nl)}04A11`, push: `HD6${s}${nl2(nl)}04A11` }
    const slides: Partial<Record<KitClosing, string>> = { soft: `HD10${nl}H`, push: `HD10${nl2(nl)}04GX` }
    if (nl >= 350) {
      kit.pushSoft = `HD7${s}${nl2(nl)}04A11`
      slides.pushSoft = `HD10${nl2(nl)}04K`
    }
    return { nl, kit, slides, sideKit: `HD1${s}${nl2(nl)}011`, screws: hdScrews(nl) }
  })
}

interface SeriesSpec {
  s: number
  code: string
  boxSideHeight: number
  backHeight: number
  /** Sèrie dels suports de davant (HE1s011X / HE1s016X / HD1s019). */
  bracketSeries: number
  extraBracket?: string
  frontHoleOffsets: number[]
  backScrewYs: number[]
  pages: string
}

const SIDE_BASE = 10
const BOTTOM_BASE = 19

function hdKit(sp: SeriesSpec): HardwareKit {
  const b = sp.bracketSeries
  return doubleWallKit({
    maker: "DTC",
    series: `MAGIC-STAR ULTRA HD1${sp.s}`,
    heightClass: { code: sp.code, boxSideHeight: sp.boxSideHeight, backHeight: sp.backHeight },
    variants: variants(sp.s),
    closings: ["soft", "push", "pushSoft"],
    finishes: ["white", "grey", "black"],
    rules: {
      depthMargin: 3,
      slideSetback: 3,
      baseAboveFront: 38,
      widths: [
        { upTo: 600, stabilizer: 0, syncRod: 1 },
        { upTo: 1200, stabilizer: 0, syncRod: 2 },
      ],
      syncRodCut: { push: "LW-167", pushSoft: "LW-238" },
      metalBackSideThickness: 16,
    },
    geometry: { sideBase: SIDE_BASE, sideThickness: 13, bottomBase: BOTTOM_BASE, slideHeight: 28.5, slideThickness: 13 },
    frontBrackets: { screw: `HE1${b}011X`, press: `HE1${b}016X`, dowel: `HD1${b}019`, ...(sp.extraBracket ? { extra: { item: sp.extraBracket, note: "Suport de davant de més (gris fosc)" } } : {}) },
    metalBack: { prefix: `HD1${sp.s}034`, inset: 20.6, bottomDepth: "NL-13" },
    wood: { bottomWidth: "LW-19", bottomDepth: "NL-13", backWidth: "LW-40" },
    machining: {
      sideRows: [SIDE_BASE, 38],
      front: { x: 14, ys: frontYsCentred(SIDE_BASE, sp.boxSideHeight, sp.frontHoleOffsets), minFromBottom: 51 },
      back: { xFromEdge: 9, ys: sp.backScrewYs },
    },
    syncRod: { item: "GG0FH01", y: 15, zBack: "NL-40" },
    source: `Catàleg DTC 2026, pp. ${sp.pages} (joc), 313–314 (muntatge), 327 (darreres metàl·lics)`,
    photo: "hardware/dtc-magic-star-ultra.webp",
    hypotheses: [
      "Fileres de cargols de la guia al lateral a 10 i 38 mm per sobre de la vora inferior de la guia (com al MAGIC-PRO; el dibuix no les acota).",
      "Columnes de cargols llegides del dibuix «Screw Positions» (no a escala): quart forat a 37 i cotes 32, 128, 160, 192, 224 i 23 / 78 dels grups del darrere.",
      "Vora inferior de la guia a 38 mm del cantell de baix del front («min 38»); guia de 28,5 d'alçada (cota «28.5» del dibuix d'instal·lació).",
      "Lateral del calaix a 10 mm per sobre de la guia i fons a 19, com al MAGIC-PRO (el catàleg suposa fons de 16).",
      "Forats dels suports de davant a 14 mm de la cara interior del lateral, centrats a l'alçada del lateral del calaix.",
      "Cargols del darrere de fusta a 9 mm dels cantells i a les alçades de la vista lateral (M: 14 i 46).",
    ],
  })
}

export const DTC_MAGIC_STAR_HD11 = hdKit({ s: 1, code: "M", boxSideHeight: 88, backHeight: 58, bracketSeries: 1, frontHoleOffsets: [-16, 16], backScrewYs: [14, 46], pages: "273–274" })
export const DTC_MAGIC_STAR_HD12 = hdKit({ s: 2, code: "K", boxSideHeight: 126, backHeight: 96, bracketSeries: 2, frontHoleOffsets: [-32, 0, 32], backScrewYs: [14, 46, 78], pages: "285–286" })
export const DTC_MAGIC_STAR_HD13 = hdKit({ s: 3, code: "C", boxSideHeight: 174, backHeight: 144, bracketSeries: 3, frontHoleOffsets: [-80, -48, 48, 80], backScrewYs: [15, 47, 111, 127], pages: "297–298" })
export const DTC_MAGIC_STAR_HD14 = hdKit({ s: 4, code: "F", boxSideHeight: 238, backHeight: 208, bracketSeries: 3, extraBracket: "HE14017", frontHoleOffsets: [-112, -80, -48, -16, 80, 112], backScrewYs: [15, 47, 143, 175], pages: "309–310" })

export const DTC_MAGIC_STAR_KITS: { id: string; name: string; kit: HardwareKit }[] = [
  { id: "kit-dtc-hd11", name: "DTC MAGIC-STAR ULTRA HD11 M (88)", kit: DTC_MAGIC_STAR_HD11 },
  { id: "kit-dtc-hd12", name: "DTC MAGIC-STAR ULTRA HD12 K (126)", kit: DTC_MAGIC_STAR_HD12 },
  { id: "kit-dtc-hd13", name: "DTC MAGIC-STAR ULTRA HD13 C (174)", kit: DTC_MAGIC_STAR_HD13 },
  { id: "kit-dtc-hd14", name: "DTC MAGIC-STAR ULTRA HD14 F (238)", kit: DTC_MAGIC_STAR_HD14 },
]
