import { describe, expect, it } from "vitest"
import { emptyModule, panelAabb } from "../model"
import { buildModule } from "./buildModule"

describe("trencajunt (Taulell)", () => {
  it("la base i el sostre queden enrere del davant dels laterals; els forats de les unions no es mouen", () => {
    const m = emptyModule("m", "M")
    const a = buildModule(m).panels
    const b = buildModule({ ...m, carcass: { ...m.carcass, breakJoint: 2 } }).panels
    const d = m.carcass.depth
    for (const role of ["bottom", "top"] as const) {
      const p0 = a.find((p) => p.role === role)!
      const p1 = b.find((p) => p.role === role)!
      expect(panelAabb(p1).max[2]).toBeCloseTo(d - 2, 5)
      expect(panelAabb(p1).min[2]).toBeCloseTo(panelAabb(p0).min[2], 5)
      const w = (p: typeof p0) => p.holes.map((h) => { const o = p.placement; return [0, 1, 2].map((k) => o.origin[k]! + o.xAxis[k]! * h.x + o.yAxis[k]! * h.y).map((v) => Math.round(v * 10) / 10).join(",") }).sort()
      expect(w(p1)).toEqual(w(p0))
    }
    const side = b.find((p) => p.role === "side")!
    expect(panelAabb(side).max[2]).toBeCloseTo(d, 5)
  })
})
