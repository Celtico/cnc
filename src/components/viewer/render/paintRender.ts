import type { Job, Look } from "./renderConfig"
import { aces, agx, bloomBuffer, makeAgxLut, makePowLut, makeSrgbLut, sampleBloom, srgbLut, vignette } from "./tonemap"

const SRGB_LUT = makeSrgbLut()
const srgb = (c: number) => srgbLut(SRGB_LUT, c)
const AGX_LUT = makeAgxLut()
const POW_LUT = makePowLut()

/**
 * Pinta les sumes d'una feina al llenç amb l'aspecte triat (exposició, corba, fons…). `denoised`: el resultat del filtre
 * de soroll, si n'hi ha; `img`: la `ImageData` reaprofitada entre dibuixos.
 */
export function paintRender(c: HTMLCanvasElement, j: Job, L: Look, denoised: Float32Array | null, sceneBackground: [number, number, number] | undefined, img: { current: ImageData | null }) {
  if (c.width !== j.w || c.height !== j.h) {
    c.width = j.w
    c.height = j.h
  }
  const ctx = c.getContext("2d")!
  if (!img.current || img.current.width !== j.w || img.current.height !== j.h) img.current = ctx.createImageData(j.w, j.h)
  const out = img.current.data
  const k = 1 / j.count
  const D = L.denoise && denoised && denoised.length === j.w * j.h * 3 ? denoised : null
  const col = (i: number, c: number) => (D ? D[i * 3 + c]! : j.accum[i * 4 + c]! * k)
  // Exposició automàtica: mitjana geomètrica de la llum de les superfícies (com el fotòmetre
  // d'una càmera), que queda al gris mitjà (18 %).
  let autoK = 1
  if (L.auto) {
    let sum = 0, cnt = 0
    for (let i = 0, n = j.w * j.h; i < n; i += 7) {
      if (j.accum[i * 4 + 3]! * k < 0.5) continue
      const y = 0.2126 * col(i, 0) + 0.7152 * col(i, 1) + 0.0722 * col(i, 2)
      if (!(y >= 0) || !Number.isFinite(y)) continue
      sum += Math.log(1e-4 + y)
      cnt++
    }
    const gm = cnt ? Math.exp(sum / cnt) : 0.3
    autoK = Math.min(40, Math.max(0.25, (L.key ?? 0.18) / 0.7 / gm))
  }
  const expo = 0.7 * Math.pow(2, L.exposure) * autoK
  const wr = 1 + 0.12 * L.warmth, wb = 1 - 0.12 * L.warmth
  // Corba de color: AgX (per defecte, natural) o ACES. Entrada lineal ja exposada.
  const tc = [0, 0, 0]
  const toneRgb = L.curve === "aces"
    ? (r: number, g: number, b: number) => {
        tc[0] = aces(r, 1); tc[1] = aces(g, 1); tc[2] = aces(b, 1)
      }
    : (r: number, g: number, b: number) => agx(AGX_LUT, POW_LUT, r, g, b, tc)
  const sb = sceneBackground ?? [0, 0, 0]
  toneRgb(sb[0] * expo, sb[1] * expo, sb[2] * expo)
  const bgR = srgb(tc[0]!), bgG = srgb(tc[1]!), bgB = srgb(tc[2]!)
  // Resplendor (a 1/16 dels píxels) i vinyeta: només amb el fons de l'escena (els catàlegs, nets).
  const W = j.w, H = j.h
  const bloom = L.bloom > 0 ? bloomBuffer(W, H, (i, c) => col(i, c) * expo * (c === 0 ? wr : c === 2 ? wb : 1), L.bloomThreshold) : null
  const bl = [0, 0, 0]
  const vig = L.background === "scene" ? L.vignette : 0
  const cx = (W - 1) / 2, cy = (H - 1) / 2, rd2 = 1 / (cx * cx + cy * cy || 1)
  for (let i = 0, n = W * H; i < n; i++) {
    let lr = col(i, 0) * wr * expo, lg = col(i, 1) * expo, lb = col(i, 2) * wb * expo
    if (bloom) {
      sampleBloom(bloom, i % W, (i / W) | 0, bl)
      lr += bl[0]! * L.bloom; lg += bl[1]! * L.bloom; lb += bl[2]! * L.bloom
    }
    if (vig > 0) {
      const dx = (i % W) - cx, dy = ((i / W) | 0) - cy
      const v = vignette((dx * dx + dy * dy) * rd2, vig)
      lr *= v; lg *= v; lb *= v
    }
    toneRgb(lr, lg, lb)
    let r = tc[0]!, g = tc[1]!, b = tc[2]!
    if (!Number.isFinite(r + g + b)) r = g = b = 0
    const a = j.accum[i * 4 + 3]! * k
    if (L.saturation !== 1) {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = y + (r - y) * L.saturation
      g = y + (g - y) * L.saturation
      b = y + (b - y) * L.saturation
    }
    r = srgb(r)
    g = srgb(g)
    b = srgb(b)
    if (L.contrast !== 1) {
      r = (r - 0.5) * L.contrast + 0.5
      g = (g - 0.5) * L.contrast + 0.5
      b = (b - 0.5) * L.contrast + 0.5
    }
    let alpha = 1
    if (L.background !== "scene" && a < 1) {
      // Els píxels de fons (alfa < 1, amb les vores suavitzades) es barregen amb el blanc o
      // queden transparents. El color guardat al fons és el de l'escena: se'n treu.
      const fr = a > 0.001 ? (r - bgR * (1 - a)) / a : 0
      const fg = a > 0.001 ? (g - bgG * (1 - a)) / a : 0
      const fb = a > 0.001 ? (b - bgB * (1 - a)) / a : 0
      if (L.background === "white") {
        r = fr * a + (1 - a)
        g = fg * a + (1 - a)
        b = fb * a + (1 - a)
      } else {
        r = fr
        g = fg
        b = fb
        alpha = a
      }
    }
    // L'array és «clamped»: arrodoneix i retalla a 0–255.
    out[i * 4] = r * 255
    out[i * 4 + 1] = g * 255
    out[i * 4 + 2] = b * 255
    out[i * 4 + 3] = alpha * 255
  }
  ctx.putImageData(img.current, 0, 0)
}
