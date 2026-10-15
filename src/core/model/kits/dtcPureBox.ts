import type { HardwareKit, KitClosing, KitVariant } from "../hardwareKit"
import { doubleWallKit } from "./dtcDoubleWall"

/**
 * **DTC PURE-BOX HL** (sèrie HL), calaix de paret prima sobre **guies de sota GG10** (catàleg DTC 2026, pp. 423–438):
 *
 * - HL11 (lateral 84, darrere 75 − T) — pp. 431–432
 * - HL12 (lateral 122, darrere 113 − T) — pp. 433–434
 * - HL13 (lateral 159, darrere 148 − T) — pp. 435–436
 *
 * Fets de les pàgines: NL ∈ {250 … 550}; **només tancament suau**; guies `GG10<NL>H` (opció 1: LT = NL + 3) o
 * `GG10<NL>H1` (opció 2, 7/8 d'extensió, fins a 450: LT = NL + Y − 7); joc de laterals `HLG1s<NL>X` (250 i 270) o
 * `HL1s<NL>X` (acabats blanc seda E29 i gris mat E30); tapes 0HLJS01; **sense joc complet** (es compren guies +
 * laterals), sense suports de davant ni de darrere al catàleg (el lateral porta la fixació del front: forats Ø2 a 27 de
 * cada lateral, LW − 54 entre ells, a 16 i 48 del cantell de baix del front; cargols del darrere a 9 del cantell).
 * Fusta: fons LW − 16 × NL − 21 (tauler de fins a 20), darrere LW − 16 × (75 − T) (T = gruix del fons). Sense darrere
 * metàl·lic ni barra de sincronització.
 *
 * El model dels jocs demana un número de joc complet per tancament: aquí es posa el de les guies (`kit` = `slides`).
 */

const NLS = [250, 270, 300, 350, 400, 450, 500, 550]

/** Columnes de cargols de la guia GG10 (z des del cantell de davant; «quart forat» a 37). Llegides del dibuix (no a escala). */
function ggScrews(nl: number): KitVariant["screws"] {
  const rear = nl <= 270 ? [133] : nl <= 350 ? [165] : nl <= 450 ? [229] : [261, 325]
  return { both: [37, ...rear], top: [] }
}

function variants(s: number): KitVariant[] {
  return NLS.map((nl) => {
    const slides: Partial<Record<KitClosing, string>> = { soft: `GG10${nl}H` }
    return { nl, kit: { ...slides }, slides, sideKit: nl <= 270 ? `HLG1${s}${nl}X` : `HL1${s}${nl}X`, screws: ggScrews(nl) }
  })
}

interface SeriesSpec {
  s: number
  boxSideHeight: number
  /** Alçada del darrere amb fons de 16 (el catàleg: 75 − T, 113 − T, 148 − T). */
  backHeight: number
  frontYs: number[]
  backScrewYs: number[]
  pages: string
}

const SIDE_BASE = 12
const BOTTOM_BASE = 21

function hlKit(sp: SeriesSpec): HardwareKit {
  return doubleWallKit({
    maker: "DTC",
    series: `PURE-BOX HL1${sp.s}`,
    heightClass: { code: `HL1${sp.s}`, boxSideHeight: sp.boxSideHeight, backHeight: sp.backHeight },
    variants: variants(sp.s),
    closings: ["soft"],
    finishes: ["white", "grey"],
    rules: {
      depthMargin: 3,
      slideSetback: 2,
      baseAboveFront: 34,
      widths: [{ upTo: 1200, stabilizer: 0, syncRod: 0 }],
      syncRodCut: {},
    },
    geometry: { sideBase: SIDE_BASE, sideThickness: 13, bottomBase: BOTTOM_BASE, slideHeight: 25, slideThickness: 13 },
    sideSkins: { outer: 0.5, inner: 12 },
    frontBrackets: { screw: "0HLJS01", extra: { item: "0HLJS01", note: "Tapes (blanc H03 · gris fosc H11)" } },
    wood: { bottomWidth: "LW-16", bottomDepth: "NL-21", backWidth: "LW-16", bottomNote: "Tauler de fins a 20 mm (catàleg: T màx. 20).", backNote: "Alçada = 75 − T (HL11), 113 − T (HL12), 148 − T (HL13), amb T = gruix del fons: la de l'app és amb fons de 16." },
    machining: {
      sideRows: [9, 18],
      front: { x: 27, ys: sp.frontYs, minFromBottom: 57 },
      back: { xFromEdge: 9, ys: sp.backScrewYs },
    },
    syncRod: { item: "GG0FH01", y: 15, zBack: "NL-40" },
    source: `Catàleg DTC 2026, pp. ${sp.pages} (joc), 423–438 (sèrie)`,
    photo: "hardware/dtc-pure-box.webp",
    hypotheses: [
      "Guia de sota GG10 (opció 1, LT = NL + 3): fileres de cargols a 9 i 18 mm per sobre de la vora inferior de la guia (guia de 25 d'alçada; el dibuix no les acota) i columnes llegides del dibuix «Screw Positions» (no a escala).",
      "Lateral del calaix a 12 per sobre de la guia i fons a 21; vora inferior de la guia a 34 del cantell de baix del front («min 34»).",
      "Forats del front a 27 de la cara interior de cada lateral (LW − 54 entre ells) i a 16 i 48 del cantell de baix del front (cotes «16 · 32»); Ø2 (el catàleg també admet Ø10).",
      "Alçada del darrere amb fons de 16: el catàleg la dona com a 75/113/148 − T.",
      "L'opció 2 de guies (GG10<NL>H1, 7/8 d'extensió, LT = NL + Y − 7) no s'hi fa: només les GG10<NL>H.",
    ],
  })
}

const DTC_PURE_BOX_HL11 = hlKit({ s: 1, boxSideHeight: 84, backHeight: 59, frontYs: [28, 60], backScrewYs: [16, 48], pages: "431–432" })
export const DTC_PURE_BOX_HL12 = hlKit({ s: 2, boxSideHeight: 122, backHeight: 97, frontYs: [28, 60, 92], backScrewYs: [16, 48, 80], pages: "433–434" })
const DTC_PURE_BOX_HL13 = hlKit({ s: 3, boxSideHeight: 159, backHeight: 132, frontYs: [28, 60, 92, 124], backScrewYs: [16, 48, 80, 112], pages: "435–436" })

export const DTC_PURE_BOX_KITS: { id: string; name: string; kit: HardwareKit }[] = [
  { id: "kit-dtc-hl11", name: "DTC PURE-BOX HL11 (84)", kit: DTC_PURE_BOX_HL11 },
  { id: "kit-dtc-hl12", name: "DTC PURE-BOX HL12 (122)", kit: DTC_PURE_BOX_HL12 },
  { id: "kit-dtc-hl13", name: "DTC PURE-BOX HL13 (159)", kit: DTC_PURE_BOX_HL13 },
]
