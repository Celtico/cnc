/** Parts pures de l'optimització dels `.glb` pujats (`optimizeGlb.ts`): pressupost de triangles i el missatge. */

/** Triangles màxims d'un model de l'usuari (iPhone). */
export const TRIANGLE_BUDGET = 100_000
/** Costat màxim de les textures (px). */
export const MAX_TEXTURE_SIZE = 1024
/** Per sota d'això (bytes), si ja compleix triangles i textures, es desa tal com ve. */
export const SMALL_GLB_BYTES = 5 * 1024 * 1024
/** Les malles opaques sempre poden fer servir, com a mínim, aquesta part del pressupost. */
const MIN_OPAQUE_SHARE = 0.25

export interface TrianglePlan {
  /** Part dels triangles opacs que es queda (1 = no es toca; es delmen). */
  opaqueRatio: number
  /** Part dels grups (fulles) de les malles amb alfa que es queda (1 = totes; no es delmen, se'n treuen). */
  alphaKeep: number
}

/**
 * Com repartir el pressupost entre les malles opaques (es delmen) i les d'alfa (targetes de fulles: no es delmen, se'n
 * treu una part dels grups). Primer les d'alfa es queden senceres si hi caben; les opaques tenen sempre ≥ 25 %.
 */
export function planTriangles(opaque: number, alpha: number, budget = TRIANGLE_BUDGET): TrianglePlan {
  if (opaque + alpha <= budget) return { opaqueRatio: 1, alphaKeep: 1 }
  const opaqueBudget = Math.max(budget - alpha, budget * MIN_OPAQUE_SHARE)
  const opaqueKept = Math.min(opaque, opaqueBudget)
  const alphaBudget = budget - opaqueKept
  return {
    opaqueRatio: opaque > 0 ? Math.min(1, opaqueBudget / opaque) : 1,
    alphaKeep: alpha > 0 ? Math.min(1, alphaBudget / alpha) : 1,
  }
}

/** Reparteix `budget` triangles proporcionalment a cada malla (mínim 1 triangle si en tenia). */
export function distributeBudget(tris: number[], budget: number): number[] {
  const total = tris.reduce((a, b) => a + b, 0)
  if (total <= budget) return tris.slice()
  return tris.map((t) => (t > 0 ? Math.max(1, Math.floor((t * budget) / total)) : 0))
}

/** Quins grups es queden (`keep` de 0 a 1), repartits de manera uniforme (no tots d'un costat). */
export function keepMask(count: number, keep: number): boolean[] {
  if (keep >= 1) return new Array<boolean>(count).fill(true)
  return Array.from({ length: count }, (_, i) => Math.floor((i + 1) * keep) > Math.floor(i * keep))
}

/** Escala dels grups que es queden perquè l'arbre no quedi pelat: 1/√keep, com a màxim 1,5×. */
export const keptGroupScale = (keep: number): number => (keep >= 1 ? 1 : Math.min(1.5, 1 / Math.sqrt(Math.max(keep, 1e-6))))

export interface OptimizeReport {
  trisBefore: number
  trisAfter: number
  bytesBefore: number
  bytesAfter: number
  texturesResized: number
  changed: boolean
}

const fmtMB = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} kB`
const fmtInt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")

/** «12,3 MB → 2,1 MB · 450.000 → 98.000 triangles · 3 textures reduïdes» (només el que ha canviat). */
export function formatReport(r: OptimizeReport): string {
  const parts = [`${fmtMB(r.bytesBefore)} → ${fmtMB(r.bytesAfter)}`]
  if (r.trisAfter < r.trisBefore) parts.push(`${fmtInt(r.trisBefore)} → ${fmtInt(r.trisAfter)} triangles`)
  if (r.texturesResized > 0) parts.push(r.texturesResized === 1 ? "1 textura reduïda" : `${r.texturesResized} textures reduïdes`)
  return parts.join(" · ")
}
