import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { emptyModule, type FreePart } from "./index"

describe("bloc condicionat (FreePart.fit)", () => {
  const m = { ...emptyModule("m", "Moble"), gapBefore: 0 }
  const part = (x: number): FreePart => ({ id: "b", name: "Prestatge 1", orient: "flat", w: 10, h: 10, thickness: 19, material: "Melamina blanca", x, y: 300, z: 200, module: "m", fit: { gap: 1 } })
  const shelf = (mod: typeof m) => buildComposition({ modules: [mod], references: [], parts: [part(mod.carcass.width / 2)] }).panels.find((p) => p.id === "part:b")!
  it("omple el buit entre els laterals i el segueix quan el moble s'eixampla", () => {
    const t = m.carcass.thickness
    const a = shelf(m)
    expect(Math.max(a.length, a.width)).toBeCloseTo(m.carcass.width - 2 * t - 2, 0)
    const wide = { ...m, carcass: { ...m.carcass, width: m.carcass.width + 300 } }
    const b = shelf(wide)
    expect(Math.max(b.length, b.width)).toBeCloseTo(wide.carcass.width - 2 * t - 2, 0)
  })
})
