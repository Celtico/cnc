import type { HardwareItem } from "./hardwareSchema"

/**
 * Ferratges dels **mòduls penjats** i **per metres** (v45; `docs/funcional/model.md` › Penjadors i Ferratges per metres).
 * Valors inicials de l'app (sense fabricant: el taller compra el que té a mà), amb les mides dels de catàleg que s'hi
 * assemblen. Fonts (2026-10-15):
 * - Penjador ocult regulable: Camar 807 (camar.it, «sistemi 807»: cos metàl·lic de 10 mm, 4 forats Ø10 al lateral amb
 *   espiga, 120 kg, regulació 19 / 22 mm, tapa segons la posició del fons) i Häfele Libra H2 290.41.910 (files.hafele.co.uk,
 *   23T7-222: 4 forats Ø10 al lateral a 32 mm, 150 kg el parell, regulació 13 / 12 mm, «service gap» 16–20 mm darrere el
 *   fons); Häfele 290.03.935/936 (23T7-220): mínim 16 mm d'espai darrere el fons, al terç de dalt del moble.
 * - Regleta: Italiana Ferramenta Libra B3 F003290 (hranipex: acer de 2 mm, H 33,5, L 2000) i la regleta d'acer
 *   galvanitzat Häfele de 2032 mm (23T7-231).
 * - Sòcol d'alumini: perfils de cuina de 100 / 150 mm en barres de 4 m amb clips a la pota i cantonera de 90° (Emuca i
 *   altres; bricozor.com «plinthes aluminium Emuca»).
 * **Hipòtesis** (per confirmar amb el taller i la plantilla de forar del fabricant): la posició dels forats (37 del
 * cantell de dalt i del de darrere, a 32), la fondària (12), on es talla el fons perquè hi passi el ganxo (osca de
 * 20 × 110 a les cantonades de dalt), l'alçada de la regleta (30 sota la cara de dalt del moble), la secció i la barra del sòcol d'alumini
 * (16 de gruix, 4000) i els clips (cada 600, la regleta cada 300).
 */

/** Penjador ocult regulable (un a cada lateral, a la cantonada de dalt i darrere). */
export const HANGER_ITEM: HardwareItem = {
  id: "hanger-concealed",
  name: "Penjador ocult regulable",
  category: "wall",
  engine: "hanger",
  tags: ["Com Camar 807 · Häfele Libra H2 290.41.910"],
  params: { fromTop: 37, fromBack: 37, pitch: 32, holeDiameter: 10, holeDepth: 12, gap: 16, railTop: 30, notchWidth: 20, notchHeight: 110, bodyWidth: 20, bodyHeight: 90, bodyDepth: 60 },
  targets: [
    {
      key: "side",
      label: "Lateral (cara de dins, cantonada de dalt i darrere)",
      ops: [
        { kind: "drill", face: "A", u: 0, v: 0, d: "holeDiameter", depth: "holeDepth", tag: "hanger" },
        { kind: "drill", face: "A", u: 0, v: "pitch", d: "holeDiameter", depth: "holeDepth", tag: "hanger" },
        { kind: "drill", face: "A", u: "pitch", v: 0, d: "holeDiameter", depth: "holeDepth", tag: "hanger" },
        { kind: "drill", face: "A", u: "pitch", v: "pitch", d: "holeDiameter", depth: "holeDepth", tag: "hanger" },
      ],
    },
  ],
  version: 1,
  builtin: true,
}

/** Regleta d'acer de paret on s'enganxen els penjadors (es talla a l'amplada dels mòduls penjats seguits). */
export const WALL_RAIL_ITEM: HardwareItem = {
  id: "wall-rail-steel",
  name: "Regleta de penjar d'acer",
  category: "wall",
  engine: "wallRail",
  tags: ["Com Libra B3 F003290 · Häfele 2032 mm"],
  params: { height: 33.5, depth: 10, stock: 2000, clipSpacing: 300, clipEnd: 50 },
  targets: [{ key: "wall", label: "Paret (cargols i tacs: a mà)", ops: [] }],
  linear: { clip: { name: "Cargol i tac de paret" } },
  material: "Acer inox",
  version: 1,
  builtin: true,
}

/** Sòcol d'alumini de cuina: es clipa a les potes, es talla a mida i les cantonades porten una cantonera. */
const aluPlinth = (h: number): HardwareItem => ({
  id: `plinth-alu-${h}`,
  name: `Sòcol d'alumini ${h}`,
  category: "leg",
  engine: "plinthProfile",
  params: { height: h, depth: 16, stock: 4000, clipSpacing: 600, clipEnd: 80 },
  targets: [{ key: "legs", label: "Potes (clips de sòcol: a mà, sense mecanitzat)", ops: [] }],
  linear: { clip: { name: "Clip de sòcol a la pota" }, corner: { name: "Cantonera de sòcol de 90°" } },
  material: "Alumini anoditzat plata",
  version: 1,
  builtin: true,
})

export const PLINTH_PROFILE_ITEMS: HardwareItem[] = [aluPlinth(100), aluPlinth(150)]
