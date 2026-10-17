import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import type { Composition } from "./composition"
import { encodeLevels, reliefLevels, type ImageRelief } from "./imageRelief"

describe("relleu d'una imatge en blanc i negre (per decisió de l'usuari, 2026-10-17)", () => {
  it("els grisos van i tornen de base64", () => {
    const img: ImageRelief = { w: 2, h: 2, data: encodeLevels(new Uint8Array([0, 255, 128, 64])) }
    expect(Array.from(reliefLevels(img), (v) => Math.round(v * 255))).toEqual([0, 255, 128, 64])
  })

  it("una imatge sobre un tauler: el negre es buida a tota la fondària de la caixa, el blanc no; amb «invertir», al revés", () => {
    // Meitat esquerra negra, meitat dreta blanca.
    const px = new Uint8Array(20 * 10).map((_, k) => (k % 20 < 10 ? 0 : 255))
    const comp = (invert: boolean) =>
      ({
        kind: "moble",
        modules: [],
        parts: [{ id: "p", name: "Plafó", orient: "flat", w: 400, h: 300, thickness: 19, material: "Corian Glacier White", x: 0, y: 0, z: 0 }],
        references: [{ id: "i", name: "Imatge", effect: "cut", shape: "image", image: { w: 20, h: 10, data: encodeLevels(px), ...(invert ? { invert } : {}) }, w: 200, h: 6, d: 100, x: 100, y: 13, z: 100 }],
      }) as unknown as Composition
    for (const inv of [false, true]) {
      const k = buildComposition(comp(inv)).panels.find((q) => q.id === "part:p")!.pockets![0]!
      expect(k.depth).toBeCloseTo(6, 1)
      const m = k.map!
      const at = (x: number, y: number) => m.d[Math.round((y - m.y0) / m.step) * m.nx + Math.round((x - m.x0) / m.step)]!
      // El tauler estirat: x de la peça = x; y de la peça = z de la composició (de davant a la paret o al revés): es mira a mig fons.
      const left = at(130, k.points[0]![1] + 50), right = at(270, k.points[0]![1] + 50)
      expect(inv ? right : left).toBeCloseTo(6, 1)
      expect(inv ? left : right).toBeCloseTo(0, 1)
    }
  })
})
