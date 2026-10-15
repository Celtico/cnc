import { describe, expect, it } from "vitest"
import { clearWhiteBackground, containRect } from "./whiteBackground"

/** Imatge RGBA `w` × `h` d'un color, amb un rectangle d'un altre color. */
function image(w: number, h: number, bg: number, rect?: { x: number; y: number; w: number; h: number; v: number }): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
      const v = inside ? rect.v : bg
      d.set([v, v, v, 255], (y * w + x) * 4)
    }
  return d
}
const alpha = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3]

describe("fons blanc de les fotos de producte", () => {
  it("el blanc de la vora passa a transparent i el rectangle és el de l'aparell", () => {
    const d = image(10, 8, 255, { x: 2, y: 1, w: 5, h: 6, v: 30 })
    expect(clearWhiteBackground(d, 10, 8)).toEqual({ x: 2, y: 1, w: 5, h: 6 })
    expect(alpha(d, 10, 0, 0)).toBe(0)
    expect(alpha(d, 10, 9, 7)).toBe(0)
    expect(alpha(d, 10, 3, 3)).toBe(255)
  })

  it("el blanc de dins de l'aparell (envoltat d'una vora fosca) es queda", () => {
    const d = image(9, 9, 255, { x: 1, y: 1, w: 7, h: 7, v: 20 })
    // Dins del marc fosc, un quadrat blanc (la porta blanca d'un rentaplats).
    for (let y = 3; y < 6; y++) for (let x = 3; x < 6; x++) d.set([255, 255, 255, 255], (y * 9 + x) * 4)
    expect(clearWhiteBackground(d, 9, 9)).toEqual({ x: 1, y: 1, w: 7, h: 7 })
    expect(alpha(d, 9, 4, 4)).toBe(255)
  })

  it("una foto sense fons no canvia; una de tota blanca no deixa res", () => {
    const dark = image(4, 4, 40)
    expect(clearWhiteBackground(dark, 4, 4)).toEqual({ x: 0, y: 0, w: 4, h: 4 })
    expect(dark.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true)
    // Gris clar (250 < 252): també és fons.
    expect(clearWhiteBackground(image(4, 4, 253), 4, 4)).toBeNull()
    expect(clearWhiteBackground(image(4, 4, 250), 4, 4)).toEqual({ x: 0, y: 0, w: 4, h: 4 })
  })

  it("contain: la foto sencera, centrada, amb la seva proporció", () => {
    // Foto quadrada en una cara alta: tota l'amplada, centrada en alçada.
    expect(containRect(1, 600, 800)).toEqual({ x: 0, y: 100, w: 600, h: 600 })
    // Foto apaïsada en una cara quadrada: tota l'amplada.
    expect(containRect(2, 400, 400)).toEqual({ x: 0, y: 100, w: 400, h: 200 })
    // Foto alta en una cara apaïsada: tota l'alçada.
    expect(containRect(0.5, 400, 200)).toEqual({ x: 150, y: 0, w: 100, h: 200 })
    expect(containRect(NaN, 10, 20)).toEqual({ x: 0, y: 0, w: 10, h: 20 })
  })
})
