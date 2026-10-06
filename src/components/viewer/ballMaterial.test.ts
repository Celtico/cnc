import { MeshStandardMaterial } from "three"
import { describe, expect, it } from "vitest"
import type { MaterialPref } from "../../core/model"
import { BALL_MM, ballKey, ballSpanU, physicalBall } from "./ballMaterial"
import { COAT_ROUGHNESS } from "./render/shading"

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

describe("ballKey", () => {
  const base: MaterialPref = { id: "t", name: "Prova", thicknesses: [19], hasGrain: false, finish: { kind: "lacquer", color: "#161616", roughness: 0.3 }, edge: "", category: "board" }
  it("canvia amb Reflex, Vellut, Llum que passa i la llum", () => {
    const k = ballKey(base)
    expect(ballKey({ ...base, coat: 1 })).not.toBe(k)
    expect(ballKey({ ...base, sheen: 0.5 })).not.toBe(k)
    expect(ballKey({ ...base, translucent: 0.5 })).not.toBe(k)
    expect(ballKey({ ...base, glow: 2 })).not.toBe(k)
  })
  it("no canvia amb el nom ni els gruixos", () => {
    expect(ballKey({ ...base, name: "Altre", thicknesses: [16] })).toBe(ballKey(base))
  })
})

describe("physicalBall", () => {
  const std = () => new MeshStandardMaterial({ color: "#808080", roughness: 0.6 })
  it("Reflex = vernís amb la rugositat del render", () => {
    const p = physicalBall(std(), { coat: 0.8 })
    expect(p.clearcoat).toBe(0.8)
    expect(p.clearcoatRoughness).toBe(COAT_ROUGHNESS)
    expect(p.roughness).toBe(0.6)
  })
  it("Vellut i llum que passa", () => {
    const p = physicalBall(std(), { sheen: 0.7, translucent: 0.5 })
    expect(p.sheen).toBe(0.7)
    expect(p.emissiveIntensity).toBeCloseTo(0.15)
  })
  it("sense efectes: com l'estàndard", () => {
    const p = physicalBall(std(), {})
    expect(p.clearcoat).toBe(0)
    expect(p.sheen).toBe(0)
    expect(p.defines).toEqual({ STANDARD: "", PHYSICAL: "" })
  })
})
