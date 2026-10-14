import type { HardwareItem } from "../hardware"

/**
 * Potes de sòcol **Häfele AXILO™ 78** (catàleg general Häfele, `docs/blaetterkatalog.pdf`, p. FF 11.79; per decisió de
 * l'usuari, 2026-10-14) com a items del motor `leg` de l'app: la base «Potes» les posa a cada cantonada i fa els forats de
 * la placa a la cara de sota de la base.
 *
 * **Placa rectangular per cargolar 637.76.333** (plàstic negre, 92 × 79 × 25): quatre cargols en quadre de 64 × 64 i el
 * tub al forat de Ø30. El tub és a 39,5 mm de la vora del clip i els cargols, centrats a 39,5 mm de la vora contrària.
 * **Com la munta el taller** (el model de TopSolid del germà, 2026-10-14): el costat llarg al llarg de l'amplada del moble i
 * el clip cap al lateral, a les quatre cantonades (les de la dreta, en mirall: `params.mirror`); la placa **separada** de
 * les vores de la fusta (`inset` 50: l'eix del tub a 50 dels laterals i del darrere, i `insetFront` 85 del davant, on va el sòcol; mesurat al
 * model del taller —vist de davant, el fons al darrere— amb la placa de 92 com a escala; el clip queda a ~5 del cantell del
 * lateral i la placa a ~10 del darrere i a ~45 del davant). Al marc de la pota (u = X del mòdul cap a dins a
 * l'esquerra, v = cap al davant, origen a l'eix del tub) els cargols són a u = −19 / +45 i v = ±32. El tub amb el peu
 * regulable es demana a part per l'alçada.
 *
 * **Hipòtesi** (el catàleg no ho diu): la prebroca dels cargols, Ø3 × 10 (els del darrere cauen sobre la ranura del fons
 * de la base: amb 10 de fondària i la ranura de 8, queda 1 mm en un tauler de 19).
 */
const AXILO_SOURCE = "Catàleg general Häfele, p. FF 11.79 (AXILO 78)"

export const HAFELE_LEGS: HardwareItem[] = [
  {
    id: "leg-hafele-axilo78-screw",
    name: "Pota de sòcol AXILO 78 · placa rectangular per cargolar",
    category: "leg",
    engine: "leg",
    maker: "Häfele",
    ref: "637.76.333",
    tags: [
      "Placa de fixació rectangular per cargolar (637.76.333, plàstic negre, 92 × 79 × 25): 4 cargols en quadre de 64 × 64, tub al forat Ø30; com la munta el taller, el costat llarg al llarg de l'amplada i el clip cap al lateral (les de la dreta, en mirall), l'eix a 50 dels laterals i del darrere i a 85 del davant, on va el sòcol (mesurat al model del taller).",
      "Tub amb peu regulable a part (Ø78, 150 kg per pota), per l'alçada de la base «Potes»: 60 → 637.76.351 (53–80) · 80 → .352 (70–100) · 100 → .353 (90–120) · 125 → .354 (115–145) · 150 → .355 (140–170) · 180 → .356 (170–200) · 200 → .357 (190–220).",
      "Hipòtesi: prebroca dels cargols Ø3 × 10 (el catàleg no la dona; els del darrere cauen sota la ranura del fons).",
      AXILO_SOURCE,
    ],
    // La placa per dibuixar-la (al marc de la pota, l'esquerra): del clip (−39,5 −5) a l'altra vora (+52,5), ±39,5, 25 de
    // gruix; el peu Ø78.
    params: { inset: 50, insetFront: 85, mirror: 1, plateU0: -44.5, plateU1: 52.5, plateV: 39.5, plateH: 25, foot: 78 },
    targets: [
      {
        key: "base",
        label: "Base (cara de sota): els 4 cargols de la placa (a l'esquerra; a la dreta, en mirall)",
        ops: [
          { kind: "drill", face: "A", u: -19, v: -32, d: 3, depth: 10, tag: "leg" },
          { kind: "drill", face: "A", u: 45, v: -32, d: 3, depth: 10, tag: "leg" },
          { kind: "drill", face: "A", u: -19, v: 32, d: 3, depth: 10, tag: "leg" },
          { kind: "drill", face: "A", u: 45, v: 32, d: 3, depth: 10, tag: "leg" },
        ],
      },
    ],
    version: 6,
    builtin: true,
  },
]
