import type { RenderScene } from "./sceneData"
import { luminance } from "./shading"

/**
 * Triangles que emeten llum (pantalles i bombetes) per a la mostra directa de les làmpades (NEE),
 * els mateixos per a la CPU i la GPU. Es trien amb probabilitat proporcional a àrea × luminància
 * (CDF) i el punt, uniforme dins el triangle: la densitat d'àrea és `lum / total`.
 *
 * `data`: 16 floats (4 vec4) per triangle: (v0, cdf inicial) (e1, àrea) (e2, cdf final)
 * (radiància, luminància).
 */
export const EMIT_FLOATS = 16

export interface Emitters {
  data: Float32Array
  count: number
  /** Σ àrea × luminància (sense la intensitat de les làmpades). */
  total: number
}

export function buildEmitters(scene: RenderScene): Emitters {
  const P = scene.positions
  const list: number[] = []
  let total = 0
  const n = scene.matIndex.length
  for (let t = 0; t < n; t++) {
    const m = scene.materials[scene.matIndex[t]!]!
    const e = m.emission
    if (!e) continue
    const lum = luminance(e[0], e[1], e[2])
    if (!(lum > 0)) continue
    const b = t * 9
    const e1x = P[b + 3]! - P[b]!, e1y = P[b + 4]! - P[b + 1]!, e1z = P[b + 5]! - P[b + 2]!
    const e2x = P[b + 6]! - P[b]!, e2y = P[b + 7]! - P[b + 1]!, e2z = P[b + 8]! - P[b + 2]!
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x
    const area = 0.5 * Math.hypot(cx, cy, cz)
    if (!(area > 1e-10)) continue
    list.push(P[b]!, P[b + 1]!, P[b + 2]!, total, e1x, e1y, e1z, area, e2x, e2y, e2z, 0, e[0], e[1], e[2], lum)
    total += area * lum
  }
  const data = new Float32Array(list)
  const count = data.length / EMIT_FLOATS
  // CDF normalitzada: inici (v0.w) i final (e2.w) de cada triangle.
  for (let i = 0; i < count; i++) {
    const o = i * EMIT_FLOATS
    const lo = data[o + 3]! / total
    data[o + 3] = lo
    data[o + 11] = i === count - 1 ? 1 : 0
  }
  for (let i = 0; i < count - 1; i++) data[i * EMIT_FLOATS + 11] = data[(i + 1) * EMIT_FLOATS + 3]!
  return { data, count, total }
}

/** Triangle emissor per a `u` ∈ [0, 1) (cerca binària a la CDF). */
export function pickEmitter(em: Emitters, u: number): number {
  let lo = 0, hi = em.count - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (em.data[mid * EMIT_FLOATS + 11]! <= u) lo = mid + 1
    else hi = mid
  }
  return lo
}
