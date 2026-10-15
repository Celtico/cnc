import type { Expr } from "../expr"
import type { HardwareKit, KitClosing, KitComponent, KitFinish, KitVariant } from "../hardwareKit"

/**
 * Constructor comú dels **calaixos de doble paret de DTC** (catàleg «2026 DTC Home and Furniture Fittings Catalogue»,
 * secció «Double-wall drawer systems»): totes les sèries (MAGIC-PRO, MAGIC-STAR ULTRA, DRAGON-PRO, PURE-PRO HK) tenen la
 * mateixa estructura al catàleg —joc complet per NL i tancament, guies, joc de laterals, suports de davant i de darrere,
 * darrere metàl·lic per amplada, barra de sincronització, taula d'amplades, fórmules del fons i del darrere, forats del
 * front, cargols del darrere— i només canvien els números, les alçades i algunes cotes. Cada sèrie dona un `DoubleWallSpec`
 * i d'aquí surt el `HardwareKit` sencer, amb els components en el mateix ordre i les mateixes formes 3D.
 *
 * **Coordenades del joc**: `x` des de la cara interior del lateral del moble cap a dins, `y` amunt des de la vora inferior
 * de la guia, `z` des de la cara de darrere del front cap al fons (vegeu `hardwareKit.ts`).
 */

/**
 * Materials del 3D dels dos cossos de la guia: no són a Materials, el color surt de la paraula clau «acer»
 * (`resolveFinish`: gris fosc metàl·lic) i d'«Acer inox» (de Materials: gris clar). El cos fix es veu fosc contra el
 * lateral del moble; la corredora i els laterals (blanc seda, gris mat o negre mat, `KIT_FINISHES`) surten amb el calaix.
 */
export const KIT_RAIL_MATERIAL = "Acer fosc"
export const KIT_RUNNER_MATERIAL = "Acer inox"

/** Amplades de moble (KB) dels darreres metàl·lics de DTC, iguals a totes les sèries que en tenen. */
export const DTC_METAL_BACK_WIDTHS = [300, 325, 350, 375, 400, 450, 500, 600, 700, 800, 900, 1000, 1200]

/** NL en dos dígits (270 → «27», 300 → «30»), com als números d'article de DTC. */
export const nl2 = (nl: number) => String(nl / 10).padStart(2, "0")

interface DoubleWallSpec {
  maker: string
  series: string
  heightClass: HardwareKit["heightClass"]
  variants: KitVariant[]
  closings: KitClosing[]
  finishes: KitFinish[]
  rules: HardwareKit["rules"]
  geometry: HardwareKit["geometry"]
  /**
   * Formes 3D del lateral de doble paret: x de la pell de fora i de la pell de dins (la de dins arrenca del fons cap
   * amunt). Sense, les del MAGIC-PRO (7,6 i 19,1).
   */
  sideSkins?: { outer: number; inner: number }
  /** Suports de davant: número del cargolat i, si n'hi ha, el d'a pressió (Ø10) i el d'espiga ràpida. */
  frontBrackets: { screw: string; press?: string; dowel?: string; extra?: { item: string; note: string } }
  /** Suports de darrere (darrere de fusta); sense, el lateral ja aguanta el darrere. */
  backBracket?: string
  /** Darrere metàl·lic: prefix del número (+ KB), a quina x comença i la fondària del fons amb aquest darrere. */
  metalBack?: { prefix: string; widths?: number[]; inset: number; bottomDepth: Expr }
  wood: {
    bottomWidth: Expr
    /** Fondària del fons amb darrere de fusta. */
    bottomDepth: Expr
    backWidth: Expr
    bottomNote?: string
    backNote?: string
  }
  machining: {
    /** Fileres de cargols de la guia al lateral (y del joc). */
    sideRows: number[]
    /** Forats dels suports de davant: x de la cara interior del lateral i alçades (y del joc). */
    front: { x: number; ys: number[]; minFromBottom: number }
    /** Cargols del darrere de fusta: a `xFromEdge` dels cantells i a `ys` del cantell de baix. */
    back?: { xFromEdge: number; ys: number[] }
  }
  /** Barra de sincronització: número i on va (y, z des del davant). */
  syncRod: { item: string; y: number; zBack: Expr }
  /** Components de més de la sèrie (el lateral de vidre de la PURE-PRO HQ). */
  extraComponents?: KitComponent[]
  source: string
  photo: string
  hypotheses: string[]
}

export function doubleWallKit(sp: DoubleWallSpec): HardwareKit {
  const H = sp.heightClass.boxSideHeight
  const { sideBase, bottomBase, slideHeight } = sp.geometry
  const skins = sp.sideSkins ?? { outer: 7.6, inner: 19.1 }
  const frontYs = sp.machining.front.ys
  const setback = sp.rules.slideSetback
  const fb = sp.frontBrackets
  const fbNotes = [fb.press ? `A pressió (Ø10): ${fb.press}.` : "", fb.dowel ? `Espiga ràpida: ${fb.dowel}.` : "", fb.extra ? `${fb.extra.note}: ${fb.extra.item}.` : ""].filter(Boolean).join(" ")
  const backs: HardwareKit["options"]["back"] = sp.metalBack ? ["wood", "metal"] : ["wood"]
  return {
    maker: sp.maker,
    series: sp.series,
    family: "double-wall-drawer",
    heightClass: { ...sp.heightClass },
    variants: sp.variants,
    options: { closing: sp.closings, back: backs, finish: sp.finishes },
    rules: { ...sp.rules },
    geometry: { ...sp.geometry },
    components: [
      {
        id: "slide",
        name: "Guia",
        side: "both",
        mount: "cabinet",
        qty: 1,
        item: { kind: "variant", field: "slides" },
        // Telescòpica, un sol article: el **cos** (perfil contra el lateral del moble, fix: `kitfix-`, acer fosc) i la
        // **corredora** (sota el lateral de doble paret, surt amb el calaix: `drawer-`, acer clar). Totes dues NL de llarg.
        shapes: [
          { kind: "box", x: 0, y: 0, z: setback, w: 7.6, h: slideHeight, d: "NL", material: KIT_RAIL_MATERIAL },
          { kind: "box", x: 7.6, y: sideBase, z: setback, w: 13, h: bottomBase - sideBase, d: "NL", mount: "drawer", material: KIT_RUNNER_MATERIAL },
        ],
      },
      {
        id: "boxSide",
        name: "Lateral del calaix (doble paret)",
        side: "both",
        mount: "drawer",
        qty: 1,
        item: { kind: "variant", field: "sideKit" },
        finish: true,
        note: "El número és del joc de laterals (esquerre i dret).",
        shapes: [
          // Pell de fora, pell de dins (des del fons cap amunt) i tapa de dalt; a sota hi va la corredora de la guia
          // (el fons reposa sobre la corredora, a `bottomBase`).
          { kind: "box", x: skins.outer, y: sideBase, z: setback, w: 1.5, h: H, d: "NL" },
          { kind: "box", x: skins.inner, y: `${bottomBase}+TB`, z: setback, w: 1.5, h: `${sideBase + H}-${bottomBase}-TB`, d: "NL" },
          { kind: "box", x: skins.outer, y: sideBase + H - 3, z: setback, w: Math.round((skins.inner + 1.5 - skins.outer) * 10) / 10, h: 3, d: "NL" },
        ],
      },
      {
        id: "frontBracket",
        name: "Suport de davant (cargolat)",
        side: "both",
        mount: "drawer",
        qty: 1,
        item: { kind: "fixed", item: fb.screw },
        ...(fbNotes ? { note: fbNotes } : {}),
        shapes: [{ kind: "box", x: 8, y: Math.max(sideBase + 2, frontYs[0]! - 14), z: setback, w: 12, h: frontYs.at(-1)! - frontYs[0]! + 28, d: 6 }],
      },
      ...(sp.backBracket
        ? [
            {
              id: "backBracket",
              name: "Suport de darrere",
              side: "both" as const,
              mount: "drawer" as const,
              qty: 1,
              item: { kind: "fixed" as const, item: sp.backBracket },
              when: { back: ["wood" as const] },
              shapes: [{ kind: "box" as const, x: 8, y: `${bottomBase}+TB`, z: `${setback}+${sp.wood.bottomDepth}-G-2`, w: 12, h: "BH", d: "G+4" }],
            },
          ]
        : []),
      ...(sp.metalBack
        ? [
            {
              id: "metalBack",
              name: "Darrere metàl·lic",
              side: "center" as const,
              mount: "drawer" as const,
              qty: 1,
              item: { kind: "byWidth" as const, prefix: sp.metalBack.prefix, widths: sp.metalBack.widths ?? DTC_METAL_BACK_WIDTHS },
              when: { back: ["metal" as const] },
              note: "Per a laterals de 16 mm (amb 18 o 19 cal un darrere a mida).",
              shapes: [{ kind: "box" as const, x: sp.metalBack.inset, y: bottomBase, z: `${setback}+${sp.metalBack.bottomDepth}`, w: `LW-${Math.round(sp.metalBack.inset * 2 * 10) / 10}`, h: `${sideBase + H}-${bottomBase}`, d: 10 }],
            },
          ]
        : []),
      {
        id: "syncRod",
        name: "Barra de sincronització (1100, a tallar)",
        side: "center",
        mount: "drawer",
        qty: 1,
        item: { kind: "fixed", item: sp.syncRod.item },
        when: { closing: sp.closings.filter((c) => c !== "soft"), rule: "syncRod" },
        cutLength: "SR",
        shapes: [{ kind: "rod", x: "(LW-SR)/2", y: sp.syncRod.y, z: `${setback}+${sp.syncRod.zBack}`, len: "SR", diameter: 6 }],
      },
      ...(sp.rules.widths.some((w) => w.stabilizer >= 1)
        ? [
            {
              id: "stabilizer",
              name: "Estabilitzador",
              side: "center" as const,
              mount: "drawer" as const,
              qty: 1,
              item: { kind: "none" as const },
              when: { closing: ["soft" as const], rule: "stabilizer" as const },
              note: "El catàleg el recomana a partir de 800 d'amplada però no en dona el número: demanar-lo al distribuïdor.",
              shapes: [],
            },
          ]
        : []),
      ...(sp.extraComponents ?? []),
    ],
    wood: [
      { key: "bottom", name: "Fons del calaix (A)", width: sp.wood.bottomWidth, depth: sp.wood.bottomDepth, thickness: "bottom", when: { back: ["wood"] }, note: sp.wood.bottomNote ?? "Amplada +1/−0; fondària +0/−1 (catàleg: tauler de 16)." },
      ...(sp.metalBack ? [{ key: "bottom" as const, name: "Fons del calaix (A)", width: sp.wood.bottomWidth, depth: sp.metalBack.bottomDepth, thickness: "bottom" as const, when: { back: ["metal" as const] }, note: "Amplada +1/−0 (catàleg: tauler de 16)." }] : []),
      { key: "back", name: "Darrere del calaix (B)", width: sp.wood.backWidth, height: "BH", thickness: "board", when: { back: ["wood"] }, note: sp.wood.backNote ?? "Amplada +1/−0." },
    ],
    machining: {
      side: { rows: sp.machining.sideRows },
      front: { x: sp.machining.front.x, ys: frontYs, minFromBottom: sp.machining.front.minFromBottom },
      ...(sp.machining.back ? { back: sp.machining.back } : {}),
    },
    source: sp.source,
    photo: sp.photo,
    hypotheses: sp.hypotheses,
  }
}

/** Alçades dels forats dels suports de davant: centrats a l'alçada del lateral del calaix, a `offsets` del centre. */
export function frontYsCentred(sideBase: number, H: number, offsets: number[]): number[] {
  const c = sideBase + H / 2
  return offsets.map((o) => Math.round((c + o) * 10) / 10)
}
