import type { HardwareItem } from "./hardwareSchema"

/**
 * Ferratges dels **mòduls penjats** i **per metres** (v45; `docs/funcional/model.md` › Penjadors i Ferratges per metres).
 * **Els estàndard del mercat** (per decisió de l'usuari, 2026-10-15: «fem-ho tot el més estàndard possible»), amb les
 * mides de la fitxa tècnica del fabricant (fonts i pàgines a `docs/ferratges-jocs.md` › Ferratges per metres i penjadors):
 * - **Penjador ocult regulable**: el Libra H2 d'Italiana Ferramenta (Häfele 290.41.910), muntat «sota la tapa» i **darrere
 *   del fons**, que va retirat en ranura (espai de servei de 15 mm com a mínim; Häfele: 16–20): 4 forats Ø10 × 13 en
 *   columna a 32 al lateral (cara de dins), el primer a 37 sota la tapa i l'eix a 5 darrere la cara de darrere del fons;
 *   al fons, la ranura de 12 × 54,5 per regular-lo (a 34 sota la tapa i a 19,5 del lateral). Sense osca al fons. El Camar
 *   807 (el que se sol anomenar) és el dels **baixos penjats** amb plaques de paret, no el de regleta.
 * - **Regleta**: Libra B3 (F003290: acer de 2 mm, 33,5 d'alt, 5,6 de fons, barra de 2000).
 * - **Sòcol d'alumini**: Emuca Noline (100 / 150, barres de 3,9 m) i Häfele 713.35.401 (gruix 11,5): un clip a cada pota
 *   per tram (Häfele 713.28.540 / AXILO 637.38.354), cantonera de 90° i unió lineal.
 */

/**
 * Penjador ocult regulable (un a cada lateral, a la cantonada de dalt i darrere, darrere del fons). `underTop` = 1: les
 * mides verticals es prenen des de sota la tapa; `behindBack`: l'eix dels forats, darrere la cara de darrere del fons.
 */
export const HANGER_ITEM: HardwareItem = {
  id: "hanger-concealed",
  name: "Penjador ocult regulable",
  category: "wall",
  engine: "hanger",
  tags: ["Libra H2 · Häfele 290.41.910"],
  params: { underTop: 1, fromTop: 37, behindBack: 5, pitch: 32, holeDiameter: 10, holeDepth: 13, gap: 15, railTop: 40, slotWidth: 12, slotLength: 54.5, slotTop: 34, slotSide: 19.5, bodyWidth: 39.4, bodyHeight: 142.2, bodyDepth: 15 },
  targets: [
    {
      key: "side",
      label: "Lateral (cara de dins, darrere del fons, sota la tapa)",
      ops: [0, 1, 2, 3].map((k) => ({ kind: "drill" as const, face: "A" as const, u: k ? `pitch * ${k}` : 0, v: 0, d: "holeDiameter", depth: "holeDepth", tag: "hanger" })),
    },
  ],
  version: 2,
  builtin: true,
}

/** Regleta d'acer de paret on s'enganxen els penjadors (es talla a l'amplada dels mòduls penjats seguits). */
export const WALL_RAIL_ITEM: HardwareItem = {
  id: "wall-rail-steel",
  name: "Regleta de penjar d'acer",
  category: "wall",
  engine: "wallRail",
  tags: ["Libra B3 F003290"],
  params: { height: 33.5, depth: 5.6, stock: 2000, clipSpacing: 300, clipEnd: 50 },
  targets: [{ key: "wall", label: "Paret (cargols i tacs: a mà)", ops: [] }],
  linear: { clip: { name: "Cargol i tac de paret" } },
  material: "Acer inox",
  version: 2,
  builtin: true,
}

/**
 * Sòcol d'alumini de cuina: es talla a mida, es clipa a les potes (un clip a cada pota per tram: `clipSpacing` 0) i porta
 * cantonera a les cantonades i unió lineal on un tram és més llarg que la barra (un extrem a la vista fa un retorn amb
 * cantonera; contra la paret, es talla a tope).
 */
const aluPlinth = (h: number): HardwareItem => ({
  id: `plinth-alu-${h}`,
  name: `Sòcol d'alumini ${h}`,
  category: "leg",
  engine: "plinthProfile",
  tags: ["Emuca Noline · Häfele 713.35"],
  params: { height: h, depth: 12, stock: 3900, clipSpacing: 0, clipEnd: 0 },
  targets: [{ key: "legs", label: "Potes (un clip de sòcol a cada pota per tram: a mà, sense mecanitzat)", ops: [] }],
  linear: { clip: { name: "Clip de sòcol a la pota" }, corner: { name: "Cantonera de sòcol de 90°" }, joint: { name: "Unió lineal de sòcol" } },
  material: "Alumini anoditzat plata",
  version: 2,
  builtin: true,
})

export const PLINTH_PROFILE_ITEMS: HardwareItem[] = [aluPlinth(100), aluPlinth(150)]
