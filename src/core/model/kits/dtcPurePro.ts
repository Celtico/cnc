import type { HardwareKit, KitClosing, KitComponent, KitVariant } from "../hardwareKit"
import { nl2, doubleWallKit } from "./dtcDoubleWall"
import { hdScrews } from "./dtcMagicStarUltra"

/**
 * **DTC PURE-PRO HK** (sèrie HK), calaix de doble paret ultraprim (lateral de 13) amb darrere de fusta (catàleg DTC 2026,
 * pp. 387–422; la sèrie **HQ** és la mateixa amb un **lateral de vidre** de 6, `DTC_PURE_PRO_HQ*`, pp. 395–404):
 *
 * - HK11 **M** (lateral 90, darrere de fusta 64) — pp. 407–408
 * - HK12 **K** (lateral 128, darrere 102) — pp. 411–412
 * - HK13 **C** (lateral 167, darrere 137) — pp. 413–414
 * - Darreres metàl·lics HK1x034<KB> i fons de 16 (NL − 27 × LW − 16) — p. 421
 *
 * Fets de les pàgines: NL ∈ {270 … 550}; joc complet `HK1<s><NL>A11` (suau) i `HK6<s><NL/10>04A11` (push-open); guies
 * les del MAGIC-STAR ULTRA, `HD10<NL>H` / `HD10<NL/10>04GX`; joc de laterals `HK1<s><NL/10>01` (blanc seda E29, gris
 * mat E30); tapes 0HK1sJS01; **el front va amb pius de posició** (Ø10, o Ø2) a 20 de cada lateral del moble i amb els
 * suports de fixació HT10082 (sense suports de davant cargolats); **sense suports de darrere**; barra GG0FH01 tallada a
 * LW − 167 (push-open); taula KB → barra: 300–600 ○, 800–1200 ● (sense estabilitzador). LT = NL + 3, guia a 3 del
 * cantell, «quart forat» a 37. Fusta: darrere LW − 16 × alçada; fons LW − 16 × NL − 27 (amb els dos darreres), tauler
 * de 16. Front: pius a 16 (M: 2) o 32 (K: 3; C: 4) de pas, el de baix a ≥ 61 del cantell de baix del front.
 */

const NLS = [270, 300, 350, 400, 450, 500, 550]

function variants(s: number, glass = false): KitVariant[] {
  return NLS.map((nl) => {
    // HQ (vidre): joc HQ1s<NL>A12 / HQ6s<NL/10>04A12 i laterals HQ1s<NL/10>2 (pp. 395–404).
    const kit: Partial<Record<KitClosing, string>> = glass ? { soft: `HQ1${s}${nl}A12`, push: `HQ6${s}${nl2(nl)}04A12` } : { soft: `HK1${s}${nl}A11`, push: `HK6${s}${nl2(nl)}04A11` }
    const slides: Partial<Record<KitClosing, string>> = { soft: `HD10${nl}H`, push: `HD10${nl2(nl)}04GX` }
    return { nl, kit, slides, sideKit: glass ? `HQ1${s}${nl2(nl)}2` : `HK1${s}${nl2(nl)}01`, screws: hdScrews(nl) }
  })
}

/** El lateral de vidre de 6 (ESG, xamfrà 0,7 × 45°) de la sèrie HQ: va dins del lateral prim, surt amb el calaix. */
function glassSide(s: number, H: number): KitComponent {
  return {
    id: "glassSide",
    name: "Lateral de vidre (6 mm)",
    side: "both",
    mount: "drawer",
    qty: 1,
    item: { kind: "fixed", item: `HK1${s}062` },
    note: "Número HK1s062<NL> (el de la NL triada); el vidre entra al perfil del lateral prim.",
    material: "Vidre",
    shapes: [{ kind: "box", x: 4, y: SIDE_BASE + 6, z: 10, w: 6, h: H - 8, d: "NL-20" }],
  }
}

interface SeriesSpec {
  s: number
  /** Sèrie HQ: lateral de vidre (mateixes guies, fusta i mecanitzats que l'HK). */
  glass?: boolean
  code: string
  boxSideHeight: number
  backHeight: number
  /** Alçades dels pius del front (y del joc: des de la vora inferior de la guia). */
  frontYs: number[]
  backScrewYs: number[]
  pages: string
}

const SIDE_BASE = 10
const BOTTOM_BASE = 19

function hkKit(sp: SeriesSpec): HardwareKit {
  return doubleWallKit({
    maker: "DTC",
    series: `PURE-PRO ${sp.glass ? "HQ" : "HK"}1${sp.s}`,
    heightClass: { code: sp.code, boxSideHeight: sp.boxSideHeight, backHeight: sp.backHeight },
    variants: variants(sp.s, sp.glass),
    ...(sp.glass ? { extraComponents: [glassSide(sp.s, sp.boxSideHeight)] } : {}),
    closings: ["soft", "push"],
    finishes: ["white", "grey"],
    rules: {
      depthMargin: 3,
      slideSetback: 3,
      baseAboveFront: 38,
      widths: [
        { upTo: 600, stabilizer: 0, syncRod: 1 },
        { upTo: 1200, stabilizer: 0, syncRod: 2 },
      ],
      syncRodCut: { push: "LW-167" },
      metalBackSideThickness: 16,
    },
    geometry: { sideBase: SIDE_BASE, sideThickness: 13, bottomBase: BOTTOM_BASE, slideHeight: 28.5, slideThickness: 13 },
    // Lateral prim contra el lateral del moble: el fons (LW − 16) entra dins del lateral.
    sideSkins: { outer: 0.5, inner: 12 },
    frontBrackets: { screw: "HT10082", extra: { item: "0HK1" + sp.s + "JS01", note: "Tapes (esquerra i dreta)" } },
    metalBack: { prefix: `HK1${sp.s}034`, inset: 9.5, bottomDepth: "NL-27" },
    wood: { bottomWidth: "LW-16", bottomDepth: "NL-27", backWidth: "LW-16" },
    machining: {
      sideRows: [SIDE_BASE, 38],
      front: { x: 20, ys: sp.frontYs, minFromBottom: 61 },
      back: { xFromEdge: 9, ys: sp.backScrewYs },
    },
    syncRod: { item: "GG0FH01", y: 15, zBack: "NL-40" },
    source: `Catàleg DTC 2026, pp. ${sp.pages} (joc), 421–422 (darreres metàl·lics)${sp.glass ? "; el lateral de vidre HK1s062<NL>" : ""}`,
    photo: "hardware/dtc-pure-pro.webp",
    hypotheses: [
      "El front va amb pius de posició Ø10 (o forats Ø2) a 20 mm de la cara interior de cada lateral (cota LW − 40 entre pius) i a les alçades del dibuix (M: 61 i 77 del cantell de baix del front): la prebroca Ø2 del taller hi val si els pius són de cargolar; amb pius Ø10 cal canviar el Ø a Preferències › Regles de mecanitzat.",
      "Fileres de cargols de la guia al lateral a 10 i 38 mm per sobre de la vora inferior de la guia (guies HD10, com al MAGIC-STAR ULTRA).",
      "Columnes de cargols llegides del dibuix «Screw Positions» (no a escala), les mateixes que les guies HD10.",
      "Vora inferior de la guia a 38 mm del cantell de baix del front («min 38»); lateral a 10 per sobre de la guia i fons a 19 (el catàleg suposa fons de 16).",
      "Cargols del darrere de fusta a 9 mm dels cantells i a les alçades de la vista lateral (M: 21 i 53; C: les de K més una a 117).",
      "Els suports de fixació HT10082 (zincats, 400 per caixa) són els que el catàleg llista al joc: no en diu el mecanitzat.",
    ],
  })
}

export const DTC_PURE_PRO_HK11 = hkKit({ s: 1, code: "M", boxSideHeight: 90, backHeight: 64, frontYs: [23, 39], backScrewYs: [21, 53], pages: "407–408" })
const DTC_PURE_PRO_HK12 = hkKit({ s: 2, code: "K", boxSideHeight: 128, backHeight: 102, frontYs: [23, 55, 87], backScrewYs: [21, 53, 85], pages: "411–412" })
const DTC_PURE_PRO_HK13 = hkKit({ s: 3, code: "C", boxSideHeight: 167, backHeight: 137, frontYs: [23, 55, 87, 119], backScrewYs: [21, 53, 85, 117], pages: "413–414" })

export const DTC_PURE_PRO_HQ11 = hkKit({ s: 1, glass: true, code: "M", boxSideHeight: 90, backHeight: 64, frontYs: [23, 39], backScrewYs: [21, 53], pages: "395–396" })
const DTC_PURE_PRO_HQ13 = hkKit({ s: 3, glass: true, code: "C", boxSideHeight: 167, backHeight: 137, frontYs: [23, 55, 87, 119], backScrewYs: [21, 53, 85, 117], pages: "399–400" })

export const DTC_PURE_PRO_KITS: { id: string; name: string; kit: HardwareKit }[] = [
  { id: "kit-dtc-hk11", name: "DTC PURE-PRO HK11 M (90)", kit: DTC_PURE_PRO_HK11 },
  { id: "kit-dtc-hk12", name: "DTC PURE-PRO HK12 K (128)", kit: DTC_PURE_PRO_HK12 },
  { id: "kit-dtc-hk13", name: "DTC PURE-PRO HK13 C (167)", kit: DTC_PURE_PRO_HK13 },
]

/** La sèrie HQ (lateral de vidre), v28. */
export const DTC_PURE_PRO_GLASS_KITS: { id: string; name: string; kit: HardwareKit }[] = [
  { id: "kit-dtc-hq11", name: "DTC PURE-PRO HQ11 M (90, vidre)", kit: DTC_PURE_PRO_HQ11 },
  { id: "kit-dtc-hq13", name: "DTC PURE-PRO HQ13 C (167, vidre)", kit: DTC_PURE_PRO_HQ13 },
]
