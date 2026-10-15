import type { HardwareKit, KitClosing, KitVariant } from "../hardwareKit"
import { DTC_METAL_BACK_WIDTHS, doubleWallKit, frontYsCentred, nl2 } from "./dtcDoubleWall"

export { KIT_RAIL_MATERIAL, KIT_RUNNER_MATERIAL } from "./dtcDoubleWall"

/**
 * **DTC MAGIC-PRO**, calaix de doble paret (catàleg DTC 2026, secció «Double-wall drawer systems», pp. 225–266; les
 * pàgines i els números són els mateixos que al catàleg 2024, d'on es va llegir el primer joc): un joc per classe
 * d'alçada, llegit de les pàgines del catàleg (no d'un STEP):
 *
 * - HT10 **N** (lateral 62,5, darrere de fusta 39) — pp. 231–232
 * - HT11 **M** (lateral 88, darrere 63) — pp. 233–234 (el primer, la prova)
 * - HT12 **K** (lateral 126, darrere 101) — pp. 239–240
 * - HT13 **C** (lateral 174, darrere 148) — pp. 243–244
 * - HT14 **F** (lateral 238, darrere 212) — pp. 249–250
 * - Darreres metàl·lics HT1x034<KB> i fons de 16 (NL − 27 × LW − 19) — p. 259
 * - Muntatge i tall de la barra de sincronització — pp. 251–254
 *
 * Fets de les pàgines: NL ∈ {270, 300, 350, 400, 450, 500, 550, 600}; joc complet `HT<S><NL/10>04A11` (tancament suau),
 * `HT6<s><NL/10>04A11` (push-open), `HT5<s><NL/10>04A11` (push-open + suau, només des de 350); guies industrials
 * `HT10<NL/10>04H` / `HT10<NL/10>04GX` / `HT50<NL/10>04H` (iguals per a totes les alçades); joc de laterals
 * `HT<S><NL/10>01` (acabats blanc seda E29, gris mat E30 i, al catàleg 2026, negre mat E36; mateix número); suports de
 * davant (cargolats / a pressió) per sèrie; suports de darrere `HT<S>031`; barra de sincronització GG0FH01 de 1100,
 * tallada a LW − 167 (push-open) o LW − 238 (push + suau). Instal·lació: LT = NL + 3 (LT = fondària interior), guia a 3
 * del cantell de davant, «tercer forat» a 37; taula KB → estabilitzador / barra: 300–600 (− / ○) i 800–1200 (○ / ●),
 * igual a totes les alçades. Fusta: darrere LW − 40 (+1/−0) × alçada de la classe, fons LW − 19 (+1/−0) × NL − 29
 * (darrere de fusta) o NL − 27 (metàl·lic), tauler de 16. Front: 2 forats Ø2 (o Ø10 a pressió) a 32 (M, K; 16 a la N;
 * 4 forats 32/96/32 a C i F), el de baix a ≥ 51 del cantell de baix del front.
 *
 * El dibuix «Screw Positions of the Slides» no és a escala: les columnes de cargols s'han llegit de les cotes (160, 192,
 * 128, 224, 256, 320 des del tercer forat) i de quines guies les porten. Les alçades de les fileres i la posició vertical
 * del joc respecte del front són **hipòtesis** (`hypotheses`): cal confirmar-les amb la guia a la mà.
 */

const NLS = [270, 300, 350, 400, 450, 500, 550, 600]

/** Columnes de cargols de la guia (z des del cantell de davant del lateral; el tercer forat és a 37). */
function screws(nl: number): KitVariant["screws"] {
  const rear = nl <= 270 ? [197] : nl <= 350 ? [229, 261] : nl <= 500 ? [261, 293] : [261, 293, 357]
  return { both: [37, ...rear], top: [69, 165] }
}

function variants(series: number): KitVariant[] {
  // HT11 → HT61 (push) i HT51 (push + suau): el segon dígit és el de la sèrie.
  const s = series - 10
  return NLS.map((nl) => {
    const kit: Partial<Record<KitClosing, string>> = { soft: `HT${series}${nl2(nl)}04A11`, push: `HT6${s}${nl2(nl)}04A11` }
    const slides: Partial<Record<KitClosing, string>> = { soft: `HT10${nl2(nl)}04H`, push: `HT10${nl2(nl)}04GX` }
    if (nl >= 350) {
      kit.pushSoft = `HT5${s}${nl2(nl)}04A11`
      slides.pushSoft = `HT50${nl2(nl)}04H`
    }
    return { nl, kit, slides, sideKit: `HT${series}${nl2(nl)}01`, screws: screws(nl) }
  })
}

interface SeriesSpec {
  series: number
  code: string
  boxSideHeight: number
  backHeight: number
  /** Suports de davant: cargolats i a pressió. */
  frontBrackets: [string, string]
  /** Forats dels suports de davant al front, des del centre del lateral del calaix (mm). */
  frontHoleOffsets: number[]
  /** Cargols dels suports de darrere al darrere de fusta, des del seu cantell de baix. */
  backScrewYs: number[]
  pages: string
}

const SIDE_BASE = 10
const BOTTOM_BASE = 19

function dtcKit(sp: SeriesSpec): HardwareKit {
  return doubleWallKit({
    maker: "DTC",
    series: `MAGIC-PRO HT${sp.series}`,
    heightClass: { code: sp.code, boxSideHeight: sp.boxSideHeight, backHeight: sp.backHeight },
    variants: variants(sp.series),
    closings: ["soft", "push", "pushSoft"],
    finishes: ["white", "grey", "black"],
    rules: {
      depthMargin: 3,
      slideSetback: 3,
      baseAboveFront: 38,
      widths: [
        { upTo: 600, stabilizer: 0, syncRod: 1 },
        { upTo: 1200, stabilizer: 1, syncRod: 2 },
      ],
      syncRodCut: { push: "LW-167", pushSoft: "LW-238" },
      metalBackSideThickness: 16,
    },
    geometry: { sideBase: SIDE_BASE, sideThickness: 13, bottomBase: BOTTOM_BASE, slideHeight: 47.5, slideThickness: 13 },
    frontBrackets: { screw: sp.frontBrackets[0], press: sp.frontBrackets[1] },
    backBracket: `HT${sp.series}031`,
    metalBack: { prefix: `HT${sp.series}034`, widths: DTC_METAL_BACK_WIDTHS, inset: 20.6, bottomDepth: "NL-27" },
    wood: { bottomWidth: "LW-19", bottomDepth: "NL-29", backWidth: "LW-40" },
    machining: {
      sideRows: [SIDE_BASE, 38],
      front: { x: 14, ys: frontYsCentred(SIDE_BASE, sp.boxSideHeight, sp.frontHoleOffsets), minFromBottom: 51 },
      back: { xFromEdge: 9, ys: sp.backScrewYs },
    },
    syncRod: { item: "GG0FH01", y: 15, zBack: "NL-40" },
    source: `Catàleg DTC, pp. ${sp.pages} (joc), 251–254 (muntatge), 259 (darreres metàl·lics)`,
    photo: "hardware/dtc-magic-pro.webp",
    hypotheses: [
      "Fileres de cargols de la guia al lateral a 10 i 38 mm per sobre de la vora inferior de la guia (el dibuix del catàleg mostra dues fileres però no les acota).",
      "Vora inferior de la guia a 38 mm per sobre del cantell de baix del front del calaix («min 38» del dibuix d'instal·lació).",
      "Lateral del calaix a 10 mm per sobre de la guia i cara de sota del fons a 19 (del STEP de referència, amb fons de 19: el catàleg suposa 16).",
      "Forats dels suports de davant a 14 mm de la cara interior del lateral del moble (cota «14» del dibuix d'instal·lació), centrats a l'alçada del lateral del calaix.",
      "Cargols dels suports de darrere a 9 mm dels cantells del darrere i a 19 i 51 del seu cantell de baix (vista lateral del dibuix d'instal·lació, M).",
      "El fons de referència del taller (STEP) fa NL − 13,5 de fondària, no NL − 29: es fa servir la fórmula del catàleg.",
    ],
  })
}

const DTC_MAGIC_PRO_HT10 = dtcKit({ series: 10, code: "N", boxSideHeight: 62.5, backHeight: 39, frontBrackets: ["HT10011", "HT10016"], frontHoleOffsets: [-8, 8], backScrewYs: [12, 28], pages: "231–232" })
export const DTC_MAGIC_PRO_HT11 = dtcKit({ series: 11, code: "M", boxSideHeight: 88, backHeight: 63, frontBrackets: ["TB01011", "TB01016"], frontHoleOffsets: [-16, 16], backScrewYs: [19, 51], pages: "233–234" })
const DTC_MAGIC_PRO_HT12 = dtcKit({ series: 12, code: "K", boxSideHeight: 126, backHeight: 101, frontBrackets: ["HT12012", "HT12016"], frontHoleOffsets: [-16, 16], backScrewYs: [19, 51], pages: "239–240" })
const DTC_MAGIC_PRO_HT13 = dtcKit({ series: 13, code: "C", boxSideHeight: 174, backHeight: 148, frontBrackets: ["TB03011", "TB03016"], frontHoleOffsets: [-80, -48, 48, 80], backScrewYs: [19, 51, 115, 147], pages: "243–244" })
const DTC_MAGIC_PRO_HT14 = dtcKit({ series: 14, code: "F", boxSideHeight: 238, backHeight: 212, frontBrackets: ["TB03011", "TB03016"], frontHoleOffsets: [-80, -48, 48, 80], backScrewYs: [19, 51, 115, 147], pages: "249–250" })

/** Els jocs DTC MAGIC-PRO, de la N a la F (l'HT11 M és el primer i el de referència). */
export const DTC_MAGIC_PRO_KITS: { id: string; name: string; kit: HardwareKit }[] = [
  { id: "kit-dtc-ht10", name: "DTC MAGIC-PRO HT10 N (62,5)", kit: DTC_MAGIC_PRO_HT10 },
  { id: "kit-dtc-ht11", name: "DTC MAGIC-PRO HT11 M (88)", kit: DTC_MAGIC_PRO_HT11 },
  { id: "kit-dtc-ht12", name: "DTC MAGIC-PRO HT12 K (126)", kit: DTC_MAGIC_PRO_HT12 },
  { id: "kit-dtc-ht13", name: "DTC MAGIC-PRO HT13 C (174)", kit: DTC_MAGIC_PRO_HT13 },
  { id: "kit-dtc-ht14", name: "DTC MAGIC-PRO HT14 F (238)", kit: DTC_MAGIC_PRO_HT14 },
]
