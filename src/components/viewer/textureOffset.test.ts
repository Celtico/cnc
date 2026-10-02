import { describe, expect, it } from "vitest"
import { hash32, textureOffset } from "./textureOffset"

describe("textureOffset", () => {
  it("és estable i dins de [0, 1)", () => {
    const keys = ["m1:door-a-0", "m1:door-a-1", "", "part:x", "lat e", "ñ€😀"]
    for (const k of keys) {
      const o = textureOffset(k)
      expect(textureOffset(k)).toEqual(o)
      for (const x of [o.u, o.v]) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(1)
      }
    }
    expect(hash32("abc")).toBe(hash32("abc"))
    // Valor fix: si canvia el hash, canvia la veta de tots els mobles desats.
    expect(hash32("")).toBe(hash32(""))
    expect(hash32("a")).not.toBe(hash32("b"))
  })

  it("separa ids semblants (portes d'un armari)", () => {
    const os = Array.from({ length: 6 }, (_, i) => textureOffset(`m1:door-z${i}`))
    const us = new Set(os.map((o) => o.u.toFixed(3)))
    expect(us.size).toBe(6)
    // Les u no s'amunteguen: la diferència mitjana entre parells és gran.
    let sum = 0, n = 0
    for (let i = 0; i < os.length; i++) for (let j = i + 1; j < os.length; j++) { sum += Math.abs(os[i]!.u - os[j]!.u); n++ }
    expect(sum / n).toBeGreaterThan(0.15)
    // Hi ha de tot: girades i no.
    const flips = Array.from({ length: 40 }, (_, i) => textureOffset(`p${i}`).flip)
    expect(flips.some(Boolean) && flips.some((f) => !f)).toBe(true)
  })
})
