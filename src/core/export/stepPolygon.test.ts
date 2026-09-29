import { describe, expect, it } from "vitest"
import { defaultModule, filletCorner, reverseB, type BPt } from "../model"
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

  it("amb arcs (cantonades arrodonides i un costat còncau): cares cilíndriques i sòlid tancat", () => {
    const back = buildModule(defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "screwed" })).panels.find((p) => p.role === "back")!
    let pts: BPt[] = [[100, 100], [400, 100], [400, 300], [100, 300]]
    for (const i of [3, 2, 1, 0]) pts = filletCorner(pts, i, 30)!
    // Un costat còncau (entra al forat): bulge negatiu al costat de baix.
    pts = pts.map((q, i) => (i === 1 ? [q[0], q[1], -0.2] : q)) as BPt[]
    for (const points of [pts, reverseB(pts)]) {
      const p = { ...back, cutouts: [{ kind: "polygon" as const, points }] }
      const step = toStep([p], { name: "arc" })
      expect(step.warnings).toEqual([])
      expect(stepSolids(step.text)[0]!.badEdges).toBe(0)
      expect((step.text.match(/CYLINDRICAL_SURFACE/g) ?? []).length).toBe(5)
      expect(toDxf([p])).toMatch(/\r\n42\r\n/)
    }
  })
})
