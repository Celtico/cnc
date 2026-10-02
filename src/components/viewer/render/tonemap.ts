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

// --- AgX ------------------------------------------------------------------------------------

/** Corba de color del render: AgX (natural, com Blender 4) o ACES (més contrast i saturat). */
export type ToneCurve = "agx" | "aces"

const AGX_MIN_EV = -12.47393
const AGX_MAX_EV = 4.026069
/** Llum màxima (lineal) que distingeix la corba AgX (2^4,03). */
const AGX_XMAX = Math.pow(2, AGX_MAX_EV)

/** Corba d'AgX d'un canal (ja amb la matriu d'entrada): log2 normalitzat i el polinomi de contrast. */
export function agxCurve(x: number): number {
  const l = Math.min(AGX_MAX_EV, Math.max(AGX_MIN_EV, Math.log2(Math.max(1e-10, x))))
  const t = (l - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV)
  const t2 = t * t, t4 = t2 * t2
  return 15.5 * t4 * t2 - 40.14 * t4 * t + 31.96 * t4 - 6.868 * t2 * t + 0.4298 * t2 + 0.1191 * t - 0.00232
}

/** Taula de la corba d'AgX indexada per √(x / màx) (el `log2` per píxel costa massa). */
export function makeAgxLut(n = 4096): Float32Array {
  const lut = new Float32Array(n + 1)
  for (let i = 0; i <= n; i++) {
    const u = i / n
    lut[i] = agxCurve(u * u * AGX_XMAX)
  }
  return lut
}

/** Taula de x^2,2 a [0, 1] (la sortida d'AgX ja és de pantalla: es torna a lineal). */
export function makePowLut(n = 4096, g = 2.2): Float32Array {
  const lut = new Float32Array(n + 1)
  for (let i = 0; i <= n; i++) lut[i] = Math.pow(i / n, g)
  return lut
}

const lutAt = (lut: Float32Array, x: number) => {
  const n = lut.length - 1
  const f0 = (x > 0 ? (x < 1 ? x : 1) : 0) * n
  const i = f0 | 0
  if (i >= n) return lut[n]!
  return lut[i]! + (lut[i + 1]! - lut[i]!) * (f0 - i)
}

/**
 * To AgX (lineal Rec. 709 → lineal [0, 1] de pantalla, a `out`): matriu d'entrada (desatura una
 * mica els colors molt forts perquè no es tornin grocs o cian), corba en log2 i matriu de sortida.
 * Els molt brillants es tornen blancs suaument, com una pel·lícula.
 */
export function agx(curve: Float32Array, pow22: Float32Array, r: number, g: number, b: number, out: number[] | Float32Array) {
  const ir = 0.842479062253094 * r + 0.0784335999999992 * g + 0.0792237451477643 * b
  const ig = 0.0423282422610123 * r + 0.878468636469772 * g + 0.0791661274605434 * b
  const ib = 0.0423756549057051 * r + 0.0784336 * g + 0.879142973793104 * b
  const cr = lutAt(curve, Math.sqrt(Math.max(0, ir) / AGX_XMAX))
  const cg = lutAt(curve, Math.sqrt(Math.max(0, ig) / AGX_XMAX))
  const cb = lutAt(curve, Math.sqrt(Math.max(0, ib) / AGX_XMAX))
  out[0] = lutAt(pow22, 1.19687900512017 * cr - 0.0980208811401368 * cg - 0.0990297440797205 * cb)
  out[1] = lutAt(pow22, -0.0528968517574562 * cr + 1.15190312990417 * cg - 0.0989611768448433 * cb)
  out[2] = lutAt(pow22, -0.0529716355144438 * cr - 0.0980434501171241 * cg + 1.15107367264116 * cb)
}

// --- Vinyeta i resplendor ---------------------------------------------------------------------

/**
 * Vinyeta (com una lent): factor de llum a (x, y) amb el centre a 1. `r2` = distància² al centre
 * relativa a la mitja diagonal; `k` de 0 (cap) a 1 (fosc a les cantonades, ≈ −1,5 EV).
 */
export const vignette = (r2: number, k: number) => {
  const f = 1 + 0.9 * k * r2
  return 1 / (f * f)
}

export interface BloomBuffer {
  w: number
  h: number
  /** RGB lineal (amb l'exposició) del que passa del llindar, borrós. */
  data: Float32Array
  /** Factor d'escala (píxels de la imatge per píxel del buffer). */
  scale: number
}

/**
 * Resplendor dels punts molt brillants (llums, reflexos del sol), com la llum que s'escampa a la
 * lent: es redueix la imatge (`scale` = 4), es queda el que passa de `threshold` (amb genoll suau)
 * i es difumina amb una gaussiana separable ample (≈ 2 % de l'amplada). `get(i, c)` = color lineal
 * del píxel i (ja amb l'exposició). Barat: tot a 1/16 dels píxels.
 */
export function bloomBuffer(w: number, h: number, get: (i: number, c: number) => number, threshold: number, scale = 4): BloomBuffer {
  const bw = Math.max(1, Math.ceil(w / scale)), bh = Math.max(1, Math.ceil(h / scale))
  let a = new Float32Array(bw * bh * 3)
  const knee = threshold * 0.5
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      let r = 0, g = 0, b = 0, n = 0
      for (let y = by * scale; y < Math.min(h, (by + 1) * scale); y++)
        for (let x = bx * scale; x < Math.min(w, (bx + 1) * scale); x++) {
          const i = y * w + x
          const cr = get(i, 0), cg = get(i, 1), cb = get(i, 2)
          if (!Number.isFinite(cr + cg + cb)) continue
          // Genoll suau: el que passa del llindar entra a poc a poc (sense vora dura).
          const m = Math.max(cr, cg, cb)
          let s = m - threshold + knee
          s = s <= 0 ? 0 : s < 2 * knee ? (s * s) / (4 * knee) : m - threshold
          const k = m > 1e-6 ? Math.max(0, s) / m : 0
          r += cr * k; g += cg * k; b += cb * k
          n++
        }
      const o = (by * bw + bx) * 3
      if (n) {
        a[o] = r / n; a[o + 1] = g / n; a[o + 2] = b / n
      }
    }
  // Gaussiana separable (σ ≈ 1 % de l'amplada, al buffer reduït).
  const sigma = Math.max(1, (w * 0.012) / scale)
  const rad = Math.ceil(sigma * 2.5)
  const K = new Float32Array(rad * 2 + 1)
  let ks = 0
  for (let i = -rad; i <= rad; i++) ks += K[i + rad] = Math.exp(-(i * i) / (2 * sigma * sigma))
  for (let i = 0; i < K.length; i++) K[i]! /= ks
  let t = new Float32Array(a.length)
  for (let pass = 0; pass < 2; pass++) {
    const horiz = pass === 0
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        let r = 0, g = 0, b = 0
        for (let k = -rad; k <= rad; k++) {
          const xx = horiz ? Math.min(bw - 1, Math.max(0, x + k)) : x
          const yy = horiz ? y : Math.min(bh - 1, Math.max(0, y + k))
          const q = (yy * bw + xx) * 3, wk = K[k + rad]!
          r += a[q]! * wk; g += a[q + 1]! * wk; b += a[q + 2]! * wk
        }
        const o = (y * bw + x) * 3
        t[o] = r; t[o + 1] = g; t[o + 2] = b
      }
    const s = a
    a = t
    t = s
  }
  return { w: bw, h: bh, data: a, scale }
}

/** Resplendor bilineal al píxel (x, y) de la imatge → `out` (RGB). */
export function sampleBloom(B: BloomBuffer, x: number, y: number, out: number[]) {
  const fx = Math.min(B.w - 1, Math.max(0, (x + 0.5) / B.scale - 0.5)), fy = Math.min(B.h - 1, Math.max(0, (y + 0.5) / B.scale - 0.5))
  const x0 = fx | 0, y0 = fy | 0
  const x1 = Math.min(B.w - 1, x0 + 1), y1 = Math.min(B.h - 1, y0 + 1)
  const ax = fx - x0, ay = fy - y0
  const d = B.data
  const i00 = (y0 * B.w + x0) * 3, i10 = (y0 * B.w + x1) * 3, i01 = (y1 * B.w + x0) * 3, i11 = (y1 * B.w + x1) * 3
  const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay
  for (let c = 0; c < 3; c++) out[c] = d[i00 + c]! * w00 + d[i10 + c]! * w10 + d[i01 + c]! * w01 + d[i11 + c]! * w11
}
