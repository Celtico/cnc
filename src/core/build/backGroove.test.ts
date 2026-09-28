import { describe, expect, it } from "vitest"
import { defaultModule } from "../model"
import { buildModule } from "./buildModule"
import { nest } from "../nesting/nest"

describe("fons del mateix material que el cos", () => {
  it("comparteix tauler amb el cos al nesting", () => {
    const m = defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "screwed" })
    m.carcass = { ...m.carcass, backMaterial: m.carcass.material, backThickness: m.carcass.thickness }
    const { panels } = buildModule(m)
    const n = nest(panels, { kerf: 6, margin: 10, sheet: { w: 2800, h: 2070 } })
    expect(n.boards).toHaveLength(1)
  })

  it("en ranura i massa gruixut, avisa", () => {
    const m = defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "groove" })
    m.carcass = { ...m.carcass, backThickness: m.carcass.thickness }
    expect(buildModule(m).warnings.some((w) => w.code === "back-groove")).toBe(true)
    m.carcass = { ...m.carcass, backThickness: 8 }
    expect(buildModule(m).warnings.some((w) => w.code === "back-groove")).toBe(false)
  })
})
