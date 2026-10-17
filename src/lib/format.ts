/** Arrodoneix a `dp` decimals: `Math.round(v · 10^dp) / 10^dp` (no és `toFixed`: no deixa zeros de més). */
export const roundTo = (v: number, dp: number): number => {
  const k = 10 ** dp
  return Math.round(v * k) / k
}

/** Número per a la UI: arrodonit a `dp` decimals, sense zeros de més i amb coma decimal («12,5»). */
export const fmtNum = (v: number, dp = 2): string => String(roundTo(v, dp)).replace(".", ",")
