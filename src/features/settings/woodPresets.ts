import type { WoodGen } from "../../core/model"

/** Més punts de partida per al generador de fusta (a més de roure, noguera i freixe). */
export const WOOD_EXTRA_PRESETS: { name: string; gen: WoodGen }[] = [
  { name: "Cirerer", gen: { base: "#b87a52", dark: "#8a4e30", lines: 20, wobble: 0.05, bands: 30, contrast: 0.45, figure: 2, pores: 900, grain: 6, tileMm: 600, seed: 404 } },
  { name: "Wengué", gen: { base: "#4a3527", dark: "#1f140d", lines: 44, wobble: 0.02, bands: 20, contrast: 0.9, figure: 0, pores: 1800, grain: 10, tileMm: 600, seed: 505 } },
  { name: "Pi", gen: { base: "#e2c28f", dark: "#b8864f", lines: 12, wobble: 0.12, bands: 14, contrast: 0.75, figure: 5, pores: 300, grain: 6, tileMm: 700, seed: 606 } },
  { name: "Roure fumat", gen: { base: "#8a6c50", dark: "#5a412c", lines: 26, wobble: 0.06, bands: 26, contrast: 0.55, figure: 2, pores: 2400, grain: 9, tileMm: 600, seed: 707 } },
  { name: "Faig", gen: { base: "#e0b98f", dark: "#c29467", lines: 30, wobble: 0.03, bands: 18, contrast: 0.3, figure: 1, pores: 3200, grain: 7, tileMm: 600, seed: 808 } },
  { name: "Roure blanquejat", gen: { base: "#e8dcc6", dark: "#c4b08e", lines: 26, wobble: 0.06, bands: 22, contrast: 0.4, figure: 2, pores: 2200, grain: 6, tileMm: 600, seed: 909 } },
]
