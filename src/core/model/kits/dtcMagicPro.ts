import type { HardwareKit, KitClosing, KitVariant } from "../hardwareKit"

/**
 * **DTC MAGIC-PRO**, calaix de doble paret (catàleg DTC 2024, secció «Double-wall drawer systems»): un joc per classe
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
 * `HT<S><NL/10>01`; suports de davant (cargolats / a pressió) per sèrie; suports de darrere `HT<S>031`; barra de
 * sincronització GG0FH01 de 1100, tallada a LW − 167 (push-open) o LW − 238 (push + suau). Instal·lació: LT = NL + 3
 * (LT = fondària interior), guia a 3 del cantell de davant, «tercer forat» a 37; taula KB → estabilitzador / barra:
 * 300–600 (− / ○) i 800–1200 (○ / ●), igual a totes les alçades. Fusta: darrere LW − 40 (+1/−0) × alçada de la classe,
 * fons LW − 19 (+1/−0) × NL − 29 (darrere de fusta) o NL − 27 (metàl·lic), tauler de 16. Front: 2 forats Ø2 (o Ø10 a
 * pressió) a 32 (M, K; 16 a la N; 4 forats 32/96/32 a C i F), el de baix a ≥ 51 del cantell de baix del front.
 *
 * El dibuix «Screw Positions of the Slides» no és a escala: les columnes de cargols s'han llegit de les cotes (160, 192,
 * 128, 224, 256, 320 des del tercer forat) i de quines guies les porten. Les alçades de les fileres i la posició vertical
 * del joc respecte del front són **hipòtesis** (`hypotheses`): cal confirmar-les amb la guia a la mà.
 */

const NLS = [270, 300, 350, 400, 450, 500, 550, 600]
const METAL_BACK_WIDTHS = [300, 325, 350, 375, 400, 450, 500, 600, 700, 800, 900, 1000, 1200]

/** Columnes de cargols de la guia (z des del cantell de davant del lateral; el tercer forat és a 37). */
function screws(nl: number): KitVariant["screws"] {
  const rear = nl <= 270 ? [197] : nl <= 350 ? [229, 261] : nl <= 500 ? [261, 293] : [261, 293, 357]
  return { both: [37, ...rear], top: [69, 165] }
}

const nl2 = (nl: number) => String(nl / 10).padStart(2, "0")

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
  const H = sp.boxSideHeight
  const c = SIDE_BASE + H / 2
  const frontYs = sp.frontHoleOffsets.map((o) => Math.round((c + o) * 10) / 10)
  return {
    maker: "DTC",
    series: `MAGIC-PRO HT${sp.series}`,
    family: "double-wall-drawer",
    heightClass: { code: sp.code, boxSideHeight: H, backHeight: sp.backHeight },
    variants: variants(sp.series),
    options: { closing: ["soft", "push", "pushSoft"], back: ["wood", "metal"] },
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
    components: [
      {
        id: "slide",
        name: "Guia",
        side: "both",
        mount: "cabinet",
        qty: 1,
        item: { kind: "variant", field: "slides" },
        shapes: [{ kind: "box", x: 0, y: 0, z: 3, w: 13, h: 47.5, d: "NL" }],
      },
      {
        id: "boxSide",
        name: "Lateral del calaix (doble paret)",
        side: "both",
        mount: "drawer",
        qty: 1,
        item: { kind: "variant", field: "sideKit" },
        note: "El número és del joc de laterals (esquerre i dret).",
        shapes: [
          // Pell de fora, pell de dins (des del fons cap amunt), tapa de dalt i la guia del fons (el fons hi reposa).
          { kind: "box", x: 7.6, y: SIDE_BASE, z: 3, w: 1.5, h: H, d: "NL" },
          { kind: "box", x: 19.1, y: `${BOTTOM_BASE}+TB`, z: 3, w: 1.5, h: `${SIDE_BASE + H}-${BOTTOM_BASE}-TB`, d: "NL" },
          { kind: "box", x: 7.6, y: SIDE_BASE + H - 3, z: 3, w: 13, h: 3, d: "NL" },
          { kind: "box", x: 7.6, y: SIDE_BASE, z: 3, w: 13, h: BOTTOM_BASE - SIDE_BASE, d: "NL" },
        ],
      },
      {
        id: "frontBracket",
        name: "Suport de davant (cargolat)",
        side: "both",
        mount: "drawer",
        qty: 1,
        item: { kind: "fixed", item: sp.frontBrackets[0] },
        note: `A pressió (Ø10): ${sp.frontBrackets[1]}.`,
        shapes: [{ kind: "box", x: 8, y: Math.max(SIDE_BASE + 2, frontYs[0]! - 14), z: 3, w: 12, h: frontYs.at(-1)! - frontYs[0]! + 28, d: 6 }],
      },
      {
        id: "backBracket",
        name: "Suport de darrere",
        side: "both",
        mount: "drawer",
        qty: 1,
        item: { kind: "fixed", item: `HT${sp.series}031` },
        when: { back: ["wood"] },
        shapes: [{ kind: "box", x: 8, y: `${BOTTOM_BASE}+TB`, z: "3+NL-29-G-2", w: 12, h: "BH", d: "G+4" }],
      },
      {
        id: "metalBack",
        name: "Darrere metàl·lic",
        side: "center",
        mount: "drawer",
        qty: 1,
        item: { kind: "byWidth", prefix: `HT${sp.series}034`, widths: METAL_BACK_WIDTHS },
        when: { back: ["metal"] },
        note: "Per a laterals de 16 mm (amb 18 o 19 cal un darrere a mida).",
        shapes: [{ kind: "box", x: 20.6, y: BOTTOM_BASE, z: "3+NL-27", w: "LW-41.2", h: `${SIDE_BASE + H}-${BOTTOM_BASE}`, d: 10 }],
      },
      {
        id: "syncRod",
        name: "Barra de sincronització (1100, a tallar)",
        side: "center",
        mount: "drawer",
        qty: 1,
        item: { kind: "fixed", item: "GG0FH01" },
        when: { closing: ["push", "pushSoft"], rule: "syncRod" },
        cutLength: "SR",
        shapes: [{ kind: "rod", x: "(LW-SR)/2", y: 15, z: "3+NL-40", len: "SR", diameter: 6 }],
      },
      {
        id: "stabilizer",
        name: "Estabilitzador",
        side: "center",
        mount: "drawer",
        qty: 1,
        item: { kind: "none" },
        when: { closing: ["soft"], rule: "stabilizer" },
        note: "El catàleg el recomana a partir de 800 d'amplada però no en dona el número: demanar-lo al distribuïdor.",
        shapes: [],
      },
    ],
    wood: [
      { key: "bottom", name: "Fons del calaix (A)", width: "LW-19", depth: "NL-29", thickness: "bottom", when: { back: ["wood"] }, note: "Amplada +1/−0; fondària +0/−1 (catàleg: tauler de 16)." },
      { key: "bottom", name: "Fons del calaix (A)", width: "LW-19", depth: "NL-27", thickness: "bottom", when: { back: ["metal"] }, note: "Amplada +1/−0 (catàleg: tauler de 16)." },
      { key: "back", name: "Darrere del calaix (B)", width: "LW-40", height: "BH", thickness: "board", when: { back: ["wood"] }, note: "Amplada +1/−0." },
    ],
    machining: {
      side: { rows: [10, 38] },
      front: { x: 14, ys: frontYs, minFromBottom: 51 },
      back: { xFromEdge: 9, ys: sp.backScrewYs },
    },
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
  }
}

export const DTC_MAGIC_PRO_HT10 = dtcKit({ series: 10, code: "N", boxSideHeight: 62.5, backHeight: 39, frontBrackets: ["HT10011", "HT10016"], frontHoleOffsets: [-8, 8], backScrewYs: [12, 28], pages: "231–232" })
export const DTC_MAGIC_PRO_HT11 = dtcKit({ series: 11, code: "M", boxSideHeight: 88, backHeight: 63, frontBrackets: ["TB01011", "TB01016"], frontHoleOffsets: [-16, 16], backScrewYs: [19, 51], pages: "233–234" })
export const DTC_MAGIC_PRO_HT12 = dtcKit({ series: 12, code: "K", boxSideHeight: 126, backHeight: 101, frontBrackets: ["HT12012", "HT12016"], frontHoleOffsets: [-16, 16], backScrewYs: [19, 51], pages: "239–240" })
export const DTC_MAGIC_PRO_HT13 = dtcKit({ series: 13, code: "C", boxSideHeight: 174, backHeight: 148, frontBrackets: ["TB03011", "TB03016"], frontHoleOffsets: [-80, -48, 48, 80], backScrewYs: [19, 51, 115, 147], pages: "243–244" })
export const DTC_MAGIC_PRO_HT14 = dtcKit({ series: 14, code: "F", boxSideHeight: 238, backHeight: 212, frontBrackets: ["TB03011", "TB03016"], frontHoleOffsets: [-80, -48, 48, 80], backScrewYs: [19, 51, 115, 147], pages: "249–250" })

/** Els jocs DTC MAGIC-PRO, de la N a la F (l'HT11 M és el primer i el de referència). */
export const DTC_MAGIC_PRO_KITS: { id: string; name: string; kit: HardwareKit }[] = [
  { id: "kit-dtc-ht10", name: "DTC MAGIC-PRO HT10 N (62,5)", kit: DTC_MAGIC_PRO_HT10 },
  { id: "kit-dtc-ht11", name: "DTC MAGIC-PRO HT11 M (88)", kit: DTC_MAGIC_PRO_HT11 },
  { id: "kit-dtc-ht12", name: "DTC MAGIC-PRO HT12 K (126)", kit: DTC_MAGIC_PRO_HT12 },
  { id: "kit-dtc-ht13", name: "DTC MAGIC-PRO HT13 C (174)", kit: DTC_MAGIC_PRO_HT13 },
  { id: "kit-dtc-ht14", name: "DTC MAGIC-PRO HT14 F (238)", kit: DTC_MAGIC_PRO_HT14 },
]
