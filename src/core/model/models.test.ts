import { describe, expect, it } from "vitest"
import { modelFootprint } from "./models"

describe("models 3D", () => {
  const m = { x: 100, z: 200, w: 1000, d: 400 }
  const near = (f: ReturnType<typeof modelFootprint>, want: { x: number; z: number; w: number; d: number }) => {
    expect(f.x).toBeCloseTo(want.x, 6)
    expect(f.z).toBeCloseTo(want.z, 6)
    expect(f.w).toBeCloseTo(want.w, 6)
    expect(f.d).toBeCloseTo(want.d, 6)
  }

  it("la petjada sense girar és la caixa", () => {
    near(modelFootprint({ ...m, rot: 0 }), { x: 100, z: 200, w: 1000, d: 400 })
    near(modelFootprint(m), { x: 100, z: 200, w: 1000, d: 400 })
  })

  it("girat 90°, ample i fons s'intercanvien al voltant del centre", () => {
    // Centre (600, 400).
    near(modelFootprint({ ...m, rot: 90 }), { x: 400, z: -100, w: 400, d: 1000 })
    near(modelFootprint({ ...m, rot: -90 }), { x: 400, z: -100, w: 400, d: 1000 })
  })

  it("girat 45°, la caixa que l'envolta", () => {
    const s = (1000 + 400) * Math.SQRT1_2
    near(modelFootprint({ ...m, rot: 45 }), { x: 600 - s / 2, z: 400 - s / 2, w: s, d: s })
  })
})
