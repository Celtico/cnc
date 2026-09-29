import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { defaultModule, modulePlacements, mountOf, type Composition } from "./composition"
import { moveModuleBy } from "./editOps"

const comp = (wallGap?: number): Composition => ({
  modules: [{ ...defaultModule("a", "A", { width: 600 }), gapBefore: 0, ...(wallGap !== undefined ? { wallGap } : {}) }],
  references: [],
})

describe("mòduls a la paret, penjats o al terra", () => {
  it("sense separació: arrambat a la paret", () => {
    expect(mountOf(comp().modules[0]!)).toBe("wall")
    expect(modulePlacements(comp())[0]!.z ?? 0).toBe(0)
  })
  it("al terra: les peces es desplacen de la paret", () => {
    const zs0 = buildComposition(comp(0)).panels.map((p) => p.placement.origin[2])
    const zs = buildComposition(comp(500)).panels.map((p) => p.placement.origin[2])
    expect(mountOf(comp(500).modules[0]!)).toBe("floor")
    zs.forEach((z, i) => expect(z).toBeCloseTo(zs0[i]! + 500))
  })
  it("moure endavant i enrere, sense passar la paret", () => {
    expect(moveModuleBy(comp(100), "a", 0, 0, 250).modules[0]!.wallGap).toBe(350)
    expect(moveModuleBy(comp(100), "a", 0, 0, -400).modules[0]!.wallGap).toBe(0)
    // Arrambat: dz no hi fa res.
    expect(moveModuleBy(comp(), "a", 0, 0, 250).modules[0]!.wallGap).toBeUndefined()
  })
})
