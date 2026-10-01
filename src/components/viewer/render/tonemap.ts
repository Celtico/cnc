/**
 * To de la imatge del render (pur, es prova amb Vitest): ACES aproximat i la corba sRGB amb una
 * taula (el `pow` per píxel costa massa a 3600 × 2400).
 */

/** To ACES aproximat (lineal → [0, 1] lineal); `exp` = multiplicador d'exposició. */
export function aces(v: number, exp: number): number {
  const a = v * exp
  return Math.min(1, Math.max(0, (a * (2.51 * a + 0.03)) / (a * (2.43 * a + 0.59) + 0.14)))
}

/** Corba sRGB exacta (lineal [0, 1] → sRGB [0, 1]). */
export const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

/** Taula de la corba sRGB: `n + 1` valors entre 0 i 1. */
export function makeSrgbLut(n = 4096): Float32Array {
  const lut = new Float32Array(n + 1)
  for (let i = 0; i <= n; i++) lut[i] = srgb(i / n)
  return lut
}

/** sRGB amb la taula (interpolació lineal); el valor es retalla a [0, 1]. */
export function srgbLut(lut: Float32Array, c: number): number {
  const n = lut.length - 1
  const x = (c > 0 ? (c < 1 ? c : 1) : 0) * n
  const i = x | 0
  if (i >= n) return lut[n]!
  const f = x - i
  return lut[i]! + (lut[i + 1]! - lut[i]!) * f
}

/**
 * Agrupa les peticions de dibuix: com a molt una per fotograma i, si dibuixar costa molt, prou
 * espaiades perquè no s'hi passi més d'un terç del temps (`gap` = 2 × el que ha costat l'última).
 */
export function createDrawScheduler(
  draw: () => void,
  env: { raf: (cb: () => void) => unknown; timeout: (cb: () => void, ms: number) => unknown; now: () => number } = {
    raf: (cb) => requestAnimationFrame(cb),
    timeout: (cb, ms) => setTimeout(cb, ms),
    now: () => performance.now(),
  },
) {
  let scheduled = false
  let cancelled = false
  let lastEnd = -Infinity
  let cost = 0
  const run = () => {
    scheduled = false
    if (cancelled) return
    const t0 = env.now()
    draw()
    lastEnd = env.now()
    cost = lastEnd - t0
  }
  return {
    request() {
      if (scheduled || cancelled) return
      scheduled = true
      const wait = lastEnd + cost * 2 - env.now()
      if (wait > 1) env.timeout(() => env.raf(run), wait)
      else env.raf(run)
    },
    cancel() {
      cancelled = true
    },
    /** El que ha costat l'últim dibuix (ms). */
    get cost() {
      return cost
    },
  }
}
