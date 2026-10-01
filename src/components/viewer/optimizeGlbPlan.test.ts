import { describe, expect, it } from "vitest"
import { distributeBudget, formatReport, keepMask, keptGroupScale, planTriangles } from "./optimizeGlbPlan"

describe("optimització dels .glb pujats", () => {
  it("dins del pressupost no es toca res", () => {
    expect(planTriangles(60_000, 30_000, 100_000)).toEqual({ opaqueRatio: 1, alphaKeep: 1 })
  })

  it("les fulles es queden senceres si hi caben i es delma l'escorça", () => {
    const p = planTriangles(120_000, 40_000, 100_000)
    expect(p.alphaKeep).toBe(1)
    expect(p.opaqueRatio).toBeCloseTo(0.5)
  })

  it("si les fulles soles passen del pressupost, l'escorça en té un 25 % i se'n treuen grups", () => {
    const p = planTriangles(50_000, 150_000, 100_000)
    expect(p.opaqueRatio).toBeCloseTo(0.5)
    expect(p.alphaKeep).toBeCloseTo(0.5)
    const q = planTriangles(10_000, 150_000, 100_000)
    expect(q.opaqueRatio).toBe(1)
    expect(q.alphaKeep).toBeCloseTo(0.6)
  })

  it("reparteix proporcionalment", () => {
    expect(distributeBudget([300, 100], 200)).toEqual([150, 50])
    expect(distributeBudget([10, 20], 100)).toEqual([10, 20])
  })

  it("els grups que es queden són repartits i la mida no passa d'1,5×", () => {
    const m = keepMask(10, 0.3)
    expect(m.filter(Boolean)).toHaveLength(3)
    expect(m.slice(0, 3).filter(Boolean)).toHaveLength(0)
    expect(keptGroupScale(1)).toBe(1)
    expect(keptGroupScale(0.64)).toBeCloseTo(1.25)
    expect(keptGroupScale(0.1)).toBe(1.5)
  })

  it("missatge en català", () => {
    const r = { trisBefore: 450_000, trisAfter: 98_000, bytesBefore: 12.3 * 1024 * 1024, bytesAfter: 2.1 * 1024 * 1024, texturesResized: 3, changed: true }
    expect(formatReport(r)).toBe("12,3 MB → 2,1 MB · 450.000 → 98.000 triangles · 3 textures reduïdes")
    expect(formatReport({ ...r, trisAfter: 450_000, texturesResized: 1 })).toBe("12,3 MB → 2,1 MB · 1 textura reduïda")
  })
})
