import { describe, expect, it } from "vitest"
import { BALL_MM, ballSpanU } from "./ballMaterial"

describe("ballSpanU", () => {
  const u = Math.PI * BALL_MM
  it("color: la volta real", () => expect(ballSpanU({ kind: "color", color: "#fff", roughness: 0.5 })).toBeCloseTo(u))
  it("repeticions enteres si cal estirar poc", () => {
    // 942 / 200 = 4,71 → 5 repeticions (+6 %).
    expect(ballSpanU({ kind: "pattern", pattern: "fabric", color: "#fff", tileMm: 200, roughness: 1 })).toBe(1000)
  })
  it("foto en mirall: parell", () => {
    expect(ballSpanU({ kind: "image", src: "x", tileMm: 240 })).toBe(960)
  })
  it("massa estirada: escala real", () => {
    expect(ballSpanU({ kind: "image", src: "x", tileMm: 600, seamless: true })).toBeCloseTo(u)
  })
})
