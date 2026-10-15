import type { HardwareKit, KitClosing, KitVariant } from "../hardwareKit"
import { doubleWallKit, frontYsCentred, nl2 } from "./dtcDoubleWall"

/**
 * **DTC DRAGON-PRO** (sèrie HB), calaix de doble paret compatible amb fons i darrere de 16 (catàleg DTC 2026, pp. 331–386):
 *
 * - HB01 **M** (lateral 95, darrere de fusta 84) — pp. 341–342
 * - HB02 **B** (lateral 127, darrere 116) — pp. 361–362
 * - HB03 **D** (lateral 178, darrere 167) — pp. 365–366
 * - HB0C **C** (lateral 209, darrere 198) — pp. 369–370
 * - HB04 **F** (lateral 238, darrere 228) — pp. 373–374
 * - Darreres metàl·lics TB0134 (M), TB0234 (B) i TB0334 (D) per KB, fons de 16 (NL − 22 × LW − 75) — p. 383
 * - L'HB00 (calaix interior baix, sense front de fusta) i els calaixos interiors no s'hi fan: el model dels jocs és el
 *   calaix amb front.
 *
 * Fets de les pàgines: NL ∈ {250, 270, 300, 350, 400, 450, 500, 550, 600, 650}; joc complet `HB0<s><NL/10>04AX` (suau)
 * i `HB6<s><NL/10>04AX` (push-open); guies `HB01<NL/10>04H-1` / `HB01<NL/10>04GX` (iguals per a totes les alçades); joc
 * de laterals `HB0<s><NL>X` (blanc seda E29, gris mat E30, negre mat E36); suports de davant HE1x011X / HE1x016X /
 * HD1x019; suports de darrere TB0<s>031; barra GG0FH01 tallada a LW − 106 (push-open); taula KB → estabilitzador /
 * barra: 300–600 (− / ○), 800–1200 (○ / ●). LT = NL + 3 (push-open: + 12 només als calaixos interiors), guia a 3 del
 * cantell, «tercer forat» a 37. Fusta: darrere LW − 87 × alçada; fons LW − 75 × NL − 24 (darrere de fusta) o NL − 22
 * (metàl·lic), tauler de 16. Front: forats Ø2 (o Ø10) a 32 (M: 2; B: 3; D i C: 2 + 2 a 96; F: 2 + 2 + 1), el de baix a
 * ≥ 47,5 del cantell de baix del front.
 */

const NLS = [250, 270, 300, 350, 400, 450, 500, 550, 600, 650]

/** Columnes de cargols de la guia (z des del cantell de davant; tercer forat a 37). Llegides del dibuix (no a escala). */
function hbScrews(nl: number): KitVariant["screws"] {
  const rear = nl <= 270 ? [133] : nl <= 350 ? [165] : nl <= 400 ? [229] : nl <= 550 ? [261] : [261, 389]
  return { both: [37, ...rear], top: [] }
}

function variants(s: string): KitVariant[] {
  return NLS.map((nl) => {
    const kit: Partial<Record<KitClosing, string>> = { soft: `HB0${s}${nl2(nl)}04AX`, push: `HB6${s}${nl2(nl)}04AX` }
    const slides: Partial<Record<KitClosing, string>> = { soft: `HB01${nl2(nl)}04H-1`, push: `HB01${nl2(nl)}04GX` }
    return { nl, kit, slides, sideKit: `HB0${s}${nl}X`, screws: hbScrews(nl) }
  })
}

interface SeriesSpec {
  s: string
  code: string
  boxSideHeight: number
  backHeight: number
  bracketSeries: number
  extraBracket?: string
  /** Prefix del darrere metàl·lic (C i F no en tenen). */
  metalBack?: string
  frontHoleOffsets: number[]
  backScrewYs: number[]
  pages: string
}

const SIDE_BASE = 15
const BOTTOM_BASE = 22

function hbKit(sp: SeriesSpec): HardwareKit {
  const b = sp.bracketSeries
  return doubleWallKit({
    maker: "DTC",
    series: `DRAGON-PRO HB0${sp.s}`,
    heightClass: { code: sp.code, boxSideHeight: sp.boxSideHeight, backHeight: sp.backHeight },
    variants: variants(sp.s),
    closings: ["soft", "push"],
    finishes: ["white", "grey", "black"],
    rules: {
      depthMargin: 3,
      slideSetback: 3,
      baseAboveFront: 33,
      widths: [
        { upTo: 600, stabilizer: 0, syncRod: 1 },
        { upTo: 1200, stabilizer: 1, syncRod: 2 },
      ],
      syncRodCut: { push: "LW-106" },
      metalBackSideThickness: 16,
    },
    geometry: { sideBase: SIDE_BASE, sideThickness: 13, bottomBase: BOTTOM_BASE, slideHeight: 37.5, slideThickness: 13 },
    // Laterals més cap a dins: el fons fa LW − 75 (37,5 per costat; cotes 15.5 · 22.8 · 37.5 del dibuix d'instal·lació).
    sideSkins: { outer: 15.5, inner: 36 },
    frontBrackets: { screw: `HE1${b}011X`, press: `HE1${b}016X`, dowel: `HD1${b}019`, ...(sp.extraBracket ? { extra: { item: sp.extraBracket, note: "Suport de davant de més (gris fosc)" } } : {}) },
    backBracket: `TB0${sp.s}031`,
    ...(sp.metalBack ? { metalBack: { prefix: sp.metalBack, inset: 38.6, bottomDepth: "NL-22" } } : {}),
    wood: { bottomWidth: "LW-75", bottomDepth: "NL-24", backWidth: "LW-87" },
    machining: {
      sideRows: [SIDE_BASE, 43],
      front: { x: 22.8, ys: frontYsCentred(SIDE_BASE, sp.boxSideHeight, sp.frontHoleOffsets), minFromBottom: 47.5 },
      back: { xFromEdge: 9, ys: sp.backScrewYs },
    },
    syncRod: { item: "GG0FH01", y: 20, zBack: "NL-40" },
    source: `Catàleg DTC 2026, pp. ${sp.pages} (joc), 383–384 (darreres metàl·lics i accessoris)`,
    photo: "hardware/dtc-dragon-pro.webp",
    hypotheses: [
      "Fileres de cargols de la guia al lateral a 15 i 43 mm per sobre de la vora inferior de la guia (el dibuix mostra dues fileres sense acotar).",
      "Columnes de cargols llegides del dibuix «Screw Positions» (no a escala): tercer forat a 37 i cotes 96, 128, 192, 224 i 128.",
      "Vora inferior de la guia a 33 mm del cantell de baix del front («min 33»); lateral del calaix a 15 per sobre de la guia i fons a 22 (el catàleg suposa fons de 16).",
      "Forats dels suports de davant a 22,8 mm de la cara interior del lateral (cota «22.8»), centrats a l'alçada del lateral del calaix.",
      "Cargols del darrere de fusta a 9 mm dels cantells i a les alçades de la vista lateral, comptades des del cantell de baix (M: 20 i 52).",
    ],
  })
}

export const DTC_DRAGON_PRO_HB01 = hbKit({ s: "1", code: "M", boxSideHeight: 95, backHeight: 84, bracketSeries: 1, metalBack: "TB0134", frontHoleOffsets: [-16, 16], backScrewYs: [20, 52], pages: "341–342" })
const DTC_DRAGON_PRO_HB02 = hbKit({ s: "2", code: "B", boxSideHeight: 127, backHeight: 116, bracketSeries: 2, metalBack: "TB0234", frontHoleOffsets: [-32, 0, 32], backScrewYs: [30, 62, 94], pages: "361–362" })
const DTC_DRAGON_PRO_HB03 = hbKit({ s: "3", code: "D", boxSideHeight: 178, backHeight: 167, bracketSeries: 3, metalBack: "TB0334", frontHoleOffsets: [-80, -48, 48, 80], backScrewYs: [32, 64, 96, 128], pages: "365–366" })
export const DTC_DRAGON_PRO_HB0C = hbKit({ s: "C", code: "C", boxSideHeight: 209, backHeight: 198, bracketSeries: 3, frontHoleOffsets: [-80, -48, 48, 80], backScrewYs: [32, 64, 96, 160, 176], pages: "369–370" })
const DTC_DRAGON_PRO_HB04 = hbKit({ s: "4", code: "F", boxSideHeight: 238, backHeight: 228, bracketSeries: 3, extraBracket: "HE14017", frontHoleOffsets: [-96, -64, -32, 64, 96], backScrewYs: [32, 64, 160, 192], pages: "373–374" })

export const DTC_DRAGON_PRO_KITS: { id: string; name: string; kit: HardwareKit }[] = [
  { id: "kit-dtc-hb01", name: "DTC DRAGON-PRO HB01 M (95)", kit: DTC_DRAGON_PRO_HB01 },
  { id: "kit-dtc-hb02", name: "DTC DRAGON-PRO HB02 B (127)", kit: DTC_DRAGON_PRO_HB02 },
  { id: "kit-dtc-hb03", name: "DTC DRAGON-PRO HB03 D (178)", kit: DTC_DRAGON_PRO_HB03 },
  { id: "kit-dtc-hb0c", name: "DTC DRAGON-PRO HB0C C (209)", kit: DTC_DRAGON_PRO_HB0C },
  { id: "kit-dtc-hb04", name: "DTC DRAGON-PRO HB04 F (238)", kit: DTC_DRAGON_PRO_HB04 },
]
