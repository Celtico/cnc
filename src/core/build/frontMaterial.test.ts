import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES } from "../model"
import { buildComposition } from "./buildComposition"

describe("material dels fronts", () => {
  const FRONTS = new Set(["door", "drawerFront", "flap", "grille", "hatch", "panel"])
  const comp = () => BUILTIN_TEMPLATES.find((t) => t.id === "wardrobe-2-doors")!.make()

  it("sense material de fronts, les portes són del material del cos", () => {
    const c = comp()
    const { panels } = buildComposition(c)
    const body = c.modules[0]!.carcass.material
    expect(panels.filter((p) => FRONTS.has(p.role)).every((p) => p.material === body)).toBe(true)
  })

  it("amb material de fronts, només canvien els fronts", () => {
    const c = comp()
    c.modules[0]!.carcass.frontMaterial = "Roure natural"
    const { panels } = buildComposition(c)
    const fronts = panels.filter((p) => FRONTS.has(p.role))
    const rest = panels.filter((p) => !FRONTS.has(p.role) && p.role !== "back")
    expect(fronts.length).toBeGreaterThan(0)
    expect(fronts.every((p) => p.material === "Roure natural")).toBe(true)
    expect(rest.every((p) => p.material === c.modules[0]!.carcass.material)).toBe(true)
  })
})
