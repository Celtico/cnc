import { describe, expect, it } from "vitest"
import { defaultModule } from "../model"
import { buildModule } from "../build/buildModule"
import { toStep } from "./step"
import { stepSolids } from "./stepRead"
import { toDxf } from "./dxf"

describe("tall poligonal", () => {
  it("una L passant: sòlid tancat al STEP i polilínia al DXF", () => {
    const back = buildModule(defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "screwed" })).panels.find((p) => p.role === "back")!
    const L: [number, number][] = [[100, 100], [300, 100], [300, 160], [160, 160], [160, 300], [100, 300]]
    for (const points of [L, [...L].reverse()]) {
      const p = { ...back, cutouts: [{ kind: "polygon" as const, points }] }
      const step = toStep([p], { name: "L" })
      expect(step.warnings).toEqual([])
      const [s] = stepSolids(step.text)
      expect(s!.badEdges).toBe(0)
      expect(toDxf([p]).split("VERTEX").length - 1).toBeGreaterThanOrEqual(6 + 4)
    }
  })
})
