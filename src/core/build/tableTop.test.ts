import { describe, expect, it } from "vitest"
import { tableModule, type PNode } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"
import { toStep } from "../export/step"
import { stepSolids } from "../export/stepRead"
import { toDxf } from "../export/dxf"

const K = 0.5522847498
const ellipse = (w: number, h: number): PNode[] => {
  const a = w / 2, b = h / 2
  return [
    { x: w, y: b, in: [0, -K * b], out: [0, K * b], t: "smooth" },
    { x: a, y: h, in: [K * a, 0], out: [-K * a, 0], t: "smooth" },
    { x: 0, y: b, in: [0, K * b], out: [0, -K * b], t: "smooth" },
    { x: a, y: 0, in: [-K * a, 0], out: [K * a, 0], t: "smooth" },
  ]
}

describe("tauler de taula", () => {
  it("per sobre dels laterals, amb voladís", () => {
    const m = tableModule("t", "Taula", { width: 1600, height: 750, depth: 900, joint: "butt", tableTop: { overhang: 100 } })
    const b = buildModule(m)
    const top = b.panels.find((p) => p.role === "top")!
    const side = b.panels.find((p) => p.id === "side-left")!
    expect(top.length).toBe(1800)
    expect(top.width).toBe(1100)
    const tb = panelBox(top)
    expect(tb.min[0]).toBe(-100)
    expect(panelBox(side).max[1]).toBe(750 - m.carcass.thickness)
    expect(tb.min[1]).toBe(750 - m.carcass.thickness)
    expect(top.outline).toBeUndefined()
  })
  it("oval: contorn amb arcs, sòlid tancat al STEP i polilínia al DXF", () => {
    const m = tableModule("t", "Taula", { width: 1400, height: 750, depth: 800, tableTop: { overhang: 150, shape: ellipse(500, 300) } })
    const top = buildModule(m).panels.find((p) => p.role === "top")!
    expect(top.outline!.length).toBeGreaterThan(4)
    const xs = top.outline!.map((q) => q[0])
    expect(Math.max(...xs)).toBeCloseTo(top.length, 0)
    const step = toStep([top], { name: "oval" })
    expect(stepSolids(step.text)[0]!.badEdges).toBe(0)
    expect(toDxf([top])).toMatch(/\r\n42\r\n/)
  })
})

describe("forma del tauler: la corba no surt del rectangle", () => {
  it("una ona amb manegadors que sobresurten queda dins de llarg × ample", async () => {
    const { shapeOutline } = await import("./buildModule")
    const { flatten } = await import("../model")
    const wave = [
      { x: 0, y: 0 },
      { x: 1000, y: 0, out: [0, 0] as [number, number] },
      { x: 1000, y: 400, in: [300, -200] as [number, number], out: [-300, 300] as [number, number], t: "smooth" as const },
      { x: 0, y: 400, in: [300, 300] as [number, number] },
    ]
    const pts = flatten(shapeOutline(wave, 1460, 460))
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(-0.1)
      expect(x).toBeLessThanOrEqual(1460.1)
      expect(y).toBeGreaterThanOrEqual(-0.1)
      expect(y).toBeLessThanOrEqual(460.1)
    }
  })
})
