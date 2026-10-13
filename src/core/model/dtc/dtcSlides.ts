import type { HardwareItem } from "../hardware"

/**
 * **Guies de calaix DTC** (catàleg DTC 2026) com a items del motor `slide` de l'app (la caixa de fusta de sempre):
 *
 * - **Guies ocultes** (de sota, «Undermount slides», pp. 505–592): MAGIC-MOVE TS10 / TS80 (40 kg, sincronitzades),
 *   TS11 / TS81 (60 kg, 450–750); D-MOTION DS10 / DS80 (35 kg, bloqueig), SS10 / SS80 (35 kg, bloqueig), SS10C / SS80C
 *   (35 kg, piu), D-MOTION PLUS GG10 / GG80 (25 kg, 2/3 d'extensió, piu) i GG10C / GG80C (bloqueig). Les «x0» són per a
 *   laterals de calaix de fins a 16 (SKW = LW − 42); les «x80», més amples (SKW = LW − 49). Mides del calaix: SKL = NL − 10,
 *   LT = NL + 3 (push-open, + 5 més). Cargols al lateral del moble al «quart forat» (37 del davant) i a les columnes
 *   del dibuix (96 · 128 · 160 · 192 · 224 · 256): prebroques Ø2 × 10. El calaix: darrere amb 2 forats Ø6 × 10 (a 7
 *   dels laterals i 11 del fons) i el dispositiu de bloqueig cargolat sota el fons al davant (no es fan a la CNC: el
 *   target `box` només hi posa la prebroca del bloqueig).
 * - **Guies de boles** (pp. 597–608): SUPER-RAIL 45 amb tancament suau (4587xxxHX, 45 kg) i push-open (4587xxxGX),
 *   SUPER-RAIL 45 lleugera (4588xxxHX / GX, 25 kg); estàndard 45 sobreextensió (4587xxxA, 45 kg) i 36 extensió total
 *   (3681xxxA, 35 kg). Folgança 12,7 per costat; cargols de cap pla Ø4 (prebroca Ø2).
 * - **Guies de rodets** (pp. 501–502): sèrie A (H = 13) i L (H = 14,5), 25 kg, 250–600, folgança 12,5.
 *
 * El motor de l'app només fa **dos forats** al lateral (`frontOffset` i `frontOffset + secondOffset`) i dos a la caixa:
 * les columnes de més del catàleg (per NL) són a `tags`, a confirmar amb la guia a la mà (`hypotheses` de cada item).
 */

interface SlideSpec {
  id: string
  name: string
  family: string
  load: number
  lengths: number[]
  /** Números: suau · push-open · push + suau (patró amb <NL>). */
  numbers: string
  /** Folgança per costat entre la caixa i el lateral. */
  sideClearance: number
  /** Alçada dels forats del lateral, des de baix de la caixa (ocultes: a la vora inferior del calaix). */
  holeHeight: number
  frontOffset: number
  secondOffset: number
  bottomOffset: number
  backClearance: number
  /** Caixa: forats Ø i fondària, i on. */
  box: { d: number; depth: number; label: string }
  side: { d: number; depth: number }
  pages: string
  notes: string[]
}

const BOX_T = 16
const BOX_DROP = 20

function dtcSlide(sp: SlideSpec): HardwareItem {
  return {
    id: sp.id,
    name: sp.name,
    category: "slide",
    engine: "slide",
    maker: "DTC",
    ref: sp.numbers,
    tags: [sp.family, `${sp.load} kg · NL ${sp.lengths[0]}–${sp.lengths.at(-1)}`, ...sp.notes, `Catàleg DTC 2026, pp. ${sp.pages}`],
    params: {
      sideClearance: sp.sideClearance,
      boxThickness: BOX_T,
      bottomThickness: 16,
      boxDrop: BOX_DROP,
      bottomOffset: sp.bottomOffset,
      backClearance: sp.backClearance,
      frontOffset: sp.frontOffset,
      secondOffset: sp.secondOffset,
      holeHeight: sp.holeHeight,
    },
    lengths: [...sp.lengths],
    targets: [
      {
        key: "side",
        label: "Lateral del moble (prebroques dels cargols)",
        ops: [
          { kind: "drill", face: "A", u: "frontOffset", v: 0, d: sp.side.d, depth: sp.side.depth, tag: "slide" },
          { kind: "drill", face: "A", u: "frontOffset+secondOffset", v: 0, d: sp.side.d, depth: sp.side.depth, tag: "slide" },
        ],
      },
      {
        key: "box",
        label: sp.box.label,
        ops: [
          { kind: "drill", face: "A", u: "frontOffset", v: 0, d: sp.box.d, depth: sp.box.depth, tag: "slide" },
          { kind: "drill", face: "A", u: "frontOffset+secondOffset", v: 0, d: sp.box.d, depth: sp.box.depth, tag: "slide" },
        ],
      },
    ],
    version: 1,
    builtin: true,
  }
}

const NL_250_600 = [250, 270, 300, 350, 400, 450, 500, 550, 600]
const NL_450_750 = [450, 500, 550, 600, 650, 700, 750]

const UNDER_NOTES = [
  "Cargols al lateral: quart forat a 37 del davant i columnes a 96 · 128 · 160 · 192 · 224 · 256 (segons NL); l'app en fa dos (37 i 37 + 224).",
  "Calaix: lateral de fins a 16, fons retirat (SKL = NL − 10); darrere amb 2 forats Ø6 × 10 (a 7 dels laterals, 11 del fons) i bloqueig sota el fons al davant: no es fan a la CNC.",
  "Hipòtesi: alçada dels cargols del lateral del moble a 5 mm sobre la vora de baix de la caixa (van sota el calaix, a la guia).",
]
const under = (sp: Pick<SlideSpec, "id" | "name" | "family" | "load" | "lengths" | "numbers" | "pages"> & { wide?: boolean; notes?: string[] }): HardwareItem =>
  dtcSlide({
    ...sp,
    sideClearance: sp.wide ? 24.5 : 21,
    holeHeight: 5,
    frontOffset: 37,
    secondOffset: 224,
    bottomOffset: 12,
    backClearance: 10,
    side: { d: 2, depth: 10 },
    box: { d: 2, depth: 8, label: "Caixa del calaix (prebroca del dispositiu de bloqueig / piu, al davant)" },
    notes: [`SKW = LW − ${sp.wide ? 49 : 42}`, ...UNDER_NOTES, ...(sp.notes ?? [])],
  })

export const DTC_SLIDES: HardwareItem[] = [
  under({ id: "slide-dtc-ts10", name: "Guia oculta DTC MAGIC-MOVE TS10", family: "Oculta, extensió total sincronitzada, bloqueig", load: 40, lengths: NL_250_600, numbers: "TS10<NL>H (suau) · TS10<NL>GX (push) · FTS10<NL>H (push + suau, des de 350)", pages: "515–516", notes: ["Dispositiu de bloqueig 2D 0TSD01-A o 3D 0TSD02-A; barra GG0FH01 tallada a LW − 167 (push) / LW − 238 (push + suau)."] }),
  under({ id: "slide-dtc-ts80", name: "Guia oculta DTC MAGIC-MOVE TS80 (ampla)", family: "Oculta, extensió total sincronitzada, bloqueig", load: 40, lengths: NL_250_600, numbers: "TS80<NL>H · TS80<NL>GX · FTS80<NL>H", wide: true, pages: "517–518", notes: ["Bloqueig 0TSD01-A / 0TSD02-A; barra GG0FH01 a LW − 175 / LW − 246."] }),
  under({ id: "slide-dtc-ts11", name: "Guia oculta DTC MAGIC-MOVE TS11 (60 kg)", family: "Oculta, extensió total sincronitzada, bloqueig", load: 60, lengths: NL_450_750, numbers: "TS11<NL>H (suau)", pages: "519–520", notes: ["Bloqueig 0TSD01-A / 0TSD02-A."] }),
  under({ id: "slide-dtc-ts81", name: "Guia oculta DTC MAGIC-MOVE TS81 (60 kg, ampla)", family: "Oculta, extensió total sincronitzada, bloqueig", load: 60, lengths: NL_450_750, numbers: "TS81<NL>H (suau)", wide: true, pages: "521–522" }),
  under({ id: "slide-dtc-ds10", name: "Guia oculta DTC D-MOTION DS10", family: "Oculta, extensió total, bloqueig", load: 35, lengths: NL_250_600, numbers: "DS10<NL>H · DS10<NL>GX · FDS10<NL>H (des de 350)", pages: "537–538", notes: ["Bloqueig 2D 0DSD03-A o 3D 0DSD04-A; barra GG0FH01 a LW − 167 / LW − 238."] }),
  under({ id: "slide-dtc-ds80", name: "Guia oculta DTC D-MOTION DS80 (ampla)", family: "Oculta, extensió total, bloqueig", load: 35, lengths: NL_250_600, numbers: "DS80<NL>H · DS80<NL>GX · FDS80<NL>H", wide: true, pages: "539–540", notes: ["Bloqueig 0DSD03-A / 0DSD04-A; barra a LW − 175 / LW − 246."] }),
  under({ id: "slide-dtc-ss10", name: "Guia oculta DTC D-MOTION SS10", family: "Oculta, extensió total, bloqueig", load: 35, lengths: NL_250_600, numbers: "SS10<NL>H / H1 (suau) · SS10<NL>GX (push)", pages: "545–546", notes: ["Bloqueig 0SSLD01-A; barra GG0FH01 a LW − 164."] }),
  under({ id: "slide-dtc-ss80", name: "Guia oculta DTC D-MOTION SS80 (ampla)", family: "Oculta, extensió total, bloqueig", load: 35, lengths: NL_250_600, numbers: "SS80<NL>H / H1 · SS80<NL>GX", wide: true, pages: "547–548" }),
  under({ id: "slide-dtc-ss10c", name: "Guia oculta DTC D-MOTION SS10C (piu)", family: "Oculta, extensió total, piu", load: 35, lengths: NL_250_600, numbers: "SS10C<NL>H · SS10C<NL>GX", pages: "549–550" }),
  under({ id: "slide-dtc-ss80c", name: "Guia oculta DTC D-MOTION SS80C (piu, ampla)", family: "Oculta, extensió total, piu", load: 35, lengths: NL_250_600, numbers: "SS80C<NL>H · SS80C<NL>GX", wide: true, pages: "551–552" }),
  under({ id: "slide-dtc-gg10", name: "Guia oculta DTC D-MOTION PLUS GG10 (2/3)", family: "Oculta, 2/3 d'extensió, piu", load: 25, lengths: NL_250_600, numbers: "GG10<NL>H (suau) · GG10<NL>GX (push); GG10<NL>H1 (7/8, fins a 450)", pages: "583–584", notes: ["Barra GG0FH01 a LW − 142. Fons de calaix amb forats Ø6 × 15 al darrere (taula A/B per NL)."] }),
  under({ id: "slide-dtc-gg80", name: "Guia oculta DTC D-MOTION PLUS GG80 (2/3, ampla)", family: "Oculta, 2/3 d'extensió, piu", load: 25, lengths: NL_250_600, numbers: "GG80<NL>H · GG80<NL>GX; GG80<NL>H1 (7/8, fins a 450)", wide: true, pages: "585–588" }),
  under({ id: "slide-dtc-gg10c", name: "Guia oculta DTC D-MOTION PLUS GG10C (2/3, bloqueig)", family: "Oculta, 2/3 d'extensió, bloqueig", load: 25, lengths: NL_250_600, numbers: "GG10C<NL>H · GG10C<NL>GX; 7/8 fins a 500", pages: "573–576" }),
  under({ id: "slide-dtc-gg80c", name: "Guia oculta DTC D-MOTION PLUS GG80C (2/3, bloqueig, ampla)", family: "Oculta, 2/3 d'extensió, bloqueig", load: 25, lengths: NL_250_600, numbers: "GG80C<NL>H · GG80C<NL>GX", wide: true, pages: "577–580" }),
  // Guies de boles (laterals)
  dtcSlide({ id: "slide-dtc-superrail-45", name: "Guia de boles DTC SUPER-RAIL 45, tancament suau", family: "Boles, extensió total, 45 mm", load: 45, lengths: NL_250_600, numbers: "4587<NL/25>HX (suau) · 4587<NL/25>GX (push-open): 4587110HX = 250 … 4587124HX = 600", sideClearance: 12.7, holeHeight: 22.8, frontOffset: 37, secondOffset: 128, bottomOffset: 10, backClearance: 10, side: { d: 2, depth: 10 }, box: { d: 2, depth: 10, label: "Lateral de la caixa (cargols de cap pla Ø4)" }, pages: "601–602", notes: ["Membre del moble: forats a 37 · 17,2 del davant i 64 · 96 · 128 · 160 · 192 · 224 · 256 · 320 · 352; caixa: 50,5 · 15,8 · 9,4 del davant.", "LT mín. = NL + 4 (push-open: 35 + (X + 3) davant)."] }),
  dtcSlide({ id: "slide-dtc-superrail-45-light", name: "Guia de boles DTC SUPER-RAIL 45 lleugera (25 kg)", family: "Boles, extensió total, 45 mm", load: 25, lengths: NL_250_600, numbers: "4588<NL/25>HX (suau) · 4588<NL/25>GX (push-open)", sideClearance: 12.7, holeHeight: 22.3, frontOffset: 37, secondOffset: 128, bottomOffset: 10, backClearance: 10, side: { d: 2, depth: 10 }, box: { d: 2, depth: 10, label: "Lateral de la caixa (cargols de cap pla Ø4)" }, pages: "603–604", notes: ["Mateixes posicions que la SUPER-RAIL 45 (44,6 d'alçada)."] }),
  dtcSlide({ id: "slide-dtc-bb-45", name: "Guia de boles DTC 45, sobreextensió", family: "Boles, sobreextensió, 45 mm", load: 45, lengths: NL_250_600, numbers: "4587310A (250) · 4587312A (300) · 4587314A (350) · 4587316A (400) · 4587318A (450) · 4587320A (500) · 4587322A (550) · 4587324A (600)", sideClearance: 12.7, holeHeight: 22.8, frontOffset: 35, secondOffset: 128, bottomOffset: 10, backClearance: 10, side: { d: 2, depth: 10 }, box: { d: 2, depth: 10, label: "Lateral de la caixa (cargols de cap pla Ø4)" }, pages: "607–608", notes: ["Membre del moble: 35 del davant i 64 · 128 · 160 · 224 · 288 · 352 · 416 · 480; caixa: 50,5 · 9,4 i 96 · 128 · 160 · 192 · 224."] }),
  dtcSlide({ id: "slide-dtc-bb-36", name: "Guia de boles DTC 36, extensió total", family: "Boles, extensió total, 36 mm", load: 35, lengths: NL_250_600, numbers: "3681010A (250) · 3681012A (300) · 3681014A (350) · 3681016A (400) · 3681018A (450) · 3681020A (500) · 3681022A (550) · 3681024A (600)", sideClearance: 12.7, holeHeight: 17.8, frontOffset: 35, secondOffset: 128, bottomOffset: 10, backClearance: 10, side: { d: 2, depth: 10 }, box: { d: 2, depth: 10, label: "Lateral de la caixa (cargols de cap pla Ø4)" }, pages: "607–608", notes: ["Membre del moble: 35 · 32 del davant i 64 · 128 · 224 · 320 · 352 · 416 · 448 · 512."] }),
  // Guies de rodets (de sota, epoxi)
  dtcSlide({ id: "slide-dtc-roller-a", name: "Guia de rodets DTC sèrie A", family: "Rodets, epoxi, muntatge de sota", load: 25, lengths: NL_250_600, numbers: "A109 · A129 · A149 · A169 · A189 · A209 · A229 · A249 (1,0 mm); A101 · A121 · A141 · A161 · A181 · A201 · A221 · A241 (1,2 mm)", sideClearance: 12.5, holeHeight: 6.5, frontOffset: 37, secondOffset: 128, bottomOffset: 10, backClearance: 10, side: { d: 2, depth: 10 }, box: { d: 2, depth: 10, label: "Lateral de la caixa (membre del calaix, de sota)" }, pages: "501–502", notes: ["H = 13 (membre del moble); forats a 37 del davant i 32 · 96 · 96 · 128 · 96 · 32 · 64; blanc E01A, gris E03, marró E04, negre E05. Dispositiu de tancament suau: p. 504."] }),
  dtcSlide({ id: "slide-dtc-roller-l", name: "Guia de rodets DTC sèrie L", family: "Rodets, epoxi, muntatge de sota", load: 25, lengths: NL_250_600, numbers: "L109 · L129 · L149 · L169 · L189 · L209 · L229 · L249 (1,0 mm); L101 · L121 · L141 · L161 · L181 · L201 · L221 · L241 (1,2 mm)", sideClearance: 12.5, holeHeight: 7.25, frontOffset: 37, secondOffset: 128, bottomOffset: 10, backClearance: 10, side: { d: 2, depth: 10 }, box: { d: 2, depth: 10, label: "Lateral de la caixa (membre del calaix, de sota)" }, pages: "501–502", notes: ["H = 14,5; mateixes posicions que la sèrie A. Dispositiu de tancament suau: p. 503."] }),
]
