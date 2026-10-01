import type { RenderEnv } from "./sceneData"

/**
 * Mostreig per importància del cel HDRI (equirectangular): les direccions es trien amb una
 * probabilitat proporcional a la llum del píxel (× sin θ, l'àrea a l'esfera), amb una CDF
 * marginal per files i una de condicional per columnes. Ho fan servir la CPU i la GPU (el
 * shader rep `marginal` i `conditional` tal qual).
 *
 * Mapa: u = atan2(x, −z) / 2π + ½ + gir, v = acos(y) / π (el mateix que `envSky`).
 */
export interface EnvCdf {
  w: number
  h: number
  /** h + 1 valors, de 0 a 1. */
  marginal: Float32Array
  /** h files de w + 1 valors, de 0 a 1. */
  conditional: Float32Array
  /** Suma dels pesos (lum × sin θ); per passar de probabilitat de píxel a densitat. */
  total: number
}

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

export function buildEnvCdf(env: RenderEnv): EnvCdf {
  const { w, h, data } = env
  const marginal = new Float32Array(h + 1)
  const conditional = new Float32Array(h * (w + 1))
  const rows = new Float64Array(h)
  let total = 0
  for (let y = 0; y < h; y++) {
    const s = Math.sin(((y + 0.5) / h) * Math.PI)
    let acc = 0
    const o = y * (w + 1)
    conditional[o] = 0
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      // Un mínim perquè cap direcció amb llum tingui probabilitat 0.
      acc += (lum(data[i]!, data[i + 1]!, data[i + 2]!) + 1e-4) * s
      conditional[o + x + 1] = acc
    }
    for (let x = 1; x <= w; x++) conditional[o + x] = acc > 0 ? conditional[o + x]! / acc : x / w
    rows[y] = acc
    total += acc
  }
  let acc = 0
  for (let y = 0; y < h; y++) {
    acc += rows[y]!
    marginal[y + 1] = total > 0 ? acc / total : (y + 1) / h
  }
  marginal[h] = 1
  for (let y = 0; y < h; y++) conditional[y * (w + 1) + w] = 1
  return { w, h, marginal, conditional, total }
}

/** Primer índex i amb cdf[off + i + 1] > u (cerca binària en n intervals). */
function find(cdf: Float32Array, off: number, n: number, u: number): number {
  let lo = 0, hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cdf[off + mid + 1]! <= u) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Direcció → (u, v) de la imatge (0–1), amb el gir del cel (en voltes). */
export function dirToUv(dx: number, dy: number, dz: number, rot: number): [number, number] {
  let u = (Math.atan2(dx, -dz) / (2 * Math.PI) + 0.5 + rot) % 1
  if (u < 0) u += 1
  return [u, Math.acos(Math.max(-1, Math.min(1, dy))) / Math.PI]
}

/** (u, v) → direcció (inversa de `dirToUv`). */
export function uvToDir(u: number, v: number, rot: number): [number, number, number] {
  const phi = (u - 0.5 - rot) * 2 * Math.PI
  const th = v * Math.PI
  const s = Math.sin(th)
  return [s * Math.sin(phi), Math.cos(th), -s * Math.cos(phi)]
}

/** Densitat (per estereoradiant) de triar la direcció `d`. */
export function envPdf(c: EnvCdf, dx: number, dy: number, dz: number, rot: number): number {
  const [u, v] = dirToUv(dx, dy, dz, rot)
  const x = Math.min(c.w - 1, Math.floor(u * c.w)), y = Math.min(c.h - 1, Math.floor(v * c.h))
  const s = Math.sqrt(Math.max(0, 1 - dy * dy))
  if (s < 1e-6) return 0
  const o = y * (c.w + 1)
  const p = (c.marginal[y + 1]! - c.marginal[y]!) * (c.conditional[o + x + 1]! - c.conditional[o + x]!)
  return (p * c.w * c.h) / (2 * Math.PI * Math.PI * s)
}

/** Tria una direcció amb dos nombres a l'atzar (0–1): [dx, dy, dz, densitat]. */
export function sampleEnv(c: EnvCdf, u1: number, u2: number, rot: number): [number, number, number, number] {
  const y = find(c.marginal, 0, c.h, u1)
  const o = y * (c.w + 1)
  const x = find(c.conditional, o, c.w, u2)
  // Posició dins del píxel amb el que sobra de cada nombre.
  const m0 = c.marginal[y]!, m1 = c.marginal[y + 1]!
  const c0 = c.conditional[o + x]!, c1 = c.conditional[o + x + 1]!
  const fy = m1 > m0 ? (u1 - m0) / (m1 - m0) : 0.5
  const fx = c1 > c0 ? (u2 - c0) / (c1 - c0) : 0.5
  const u = (x + Math.min(0.999, Math.max(0.001, fx))) / c.w
  const v = (y + Math.min(0.999, Math.max(0.001, fy))) / c.h
  const [dx, dy, dz] = uvToDir(u, v, rot)
  return [dx, dy, dz, envPdf(c, dx, dy, dz, rot)]
}
