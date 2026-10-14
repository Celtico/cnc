import type { HardwareItem } from "../hardware"

/**
 * Potes de sòcol **Häfele AXILO™ 78** (catàleg general Häfele, `docs/blaetterkatalog.pdf`, p. FF 11.79; per decisió de
 * l'usuari, 2026-10-14) com a items del motor `leg` de l'app: la base «Potes» les posa a cada cantonada i fa els forats de
 * la placa a la cara de sota de la base.
 *
 * **Placa rectangular per cargolar 637.76.333** (plàstic negre, 92 × 79 × 25): quatre cargols en quadre de 64 × 64 i el
 * tub al forat de Ø30. El tub és a 39,5 mm de la vora del clip del sòcol i els cargols, centrats a 39,5 mm de la vora
 * contrària: al marc de la pota (u = X del mòdul, v = cap al davant, origen a l'eix del tub) els cargols són a u = ±32 i
 * v = −45 / +19, amb el clip cap al davant (on va el sòcol). El tub amb el peu regulable es demana a part per l'alçada.
 *
 * **Hipòtesi** (el catàleg no ho diu): la prebroca dels cargols, Ø3 × 12 (la de les potes de l'app).
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
      "Placa de fixació rectangular per cargolar (637.76.333, plàstic negre, 92 × 79 × 25): 4 cargols en quadre de 64 × 64, tub al forat Ø30, clip del sòcol cap al davant.",
      "Tub amb peu regulable a part (Ø78, 150 kg per pota), per l'alçada de la base «Potes»: 60 → 637.76.351 (53–80) · 80 → .352 (70–100) · 100 → .353 (90–120) · 125 → .354 (115–145) · 150 → .355 (140–170) · 180 → .356 (170–200) · 200 → .357 (190–220).",
      "Hipòtesi: prebroca dels cargols Ø3 × 12 (el catàleg no la dona).",
      AXILO_SOURCE,
    ],
    params: { inset: 60 },
    targets: [
      {
        key: "base",
        label: "Base (cara de sota): els 4 cargols de la placa",
        ops: [
          { kind: "drill", face: "A", u: -32, v: -45, d: 3, depth: 12, tag: "leg" },
          { kind: "drill", face: "A", u: 32, v: -45, d: 3, depth: 12, tag: "leg" },
          { kind: "drill", face: "A", u: -32, v: 19, d: 3, depth: 12, tag: "leg" },
          { kind: "drill", face: "A", u: 32, v: 19, d: 3, depth: 12, tag: "leg" },
        ],
      },
    ],
    version: 1,
    builtin: true,
  },
]
