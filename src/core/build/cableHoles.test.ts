import { describe, expect, it } from "vitest"
import { defaultModule, type CableHole, type Composition } from "../model"
import { buildModule } from "./buildModule"
import { buildComposition } from "./buildComposition"
import { toStep } from "../export/step"
import { stepSolids } from "../export/stepRead"
import { toWorld } from "./geometry"

const mod = (holes: CableHole[]) => {
  const m = defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "screwed" })
  return { ...m, extras: { cableHoles: holes } }
}

describe("passacables", () => {
  it("rectangular al fons: retall amb la mida i STEP net", () => {
    const { panels, warnings } = buildModule(mod([{ panel: "back", x: 400, y: 350, diameter: 60, shape: "rect", w: 120, h: 80 }]))
    const back = panels.find((p) => p.role === "back")!
    const c = back.cutouts![0]!
    expect(c.kind).toBe("rect")
    if (c.kind === "rect") expect([c.w, c.h].sort((p, q) => p - q)).toEqual([80, 120])
    expect(warnings).toEqual([])
    const step = toStep(panels, { name: "p" })
    expect(step.warnings).toEqual([])
    for (const s of stepSolids(step.text)) expect(s.badEdges).toBe(0)
  })

  it("al lateral dret: x des del darrere, y des de baix", () => {
    const { panels } = buildModule(mod([{ panel: "right", x: 200, y: 300, diameter: 50 }]))
    const side = panels.find((p) => p.id === "side-right")!
    const c = side.cutouts![0]!
    expect(c.kind).toBe("circle")
    if (c.kind !== "circle") return
    const w = toWorld(side, [c.x, c.y, 0])
    expect(w[1]).toBeCloseTo(300, 0)
    expect(w[2]).toBeCloseTo(200, 0)
  })

  it("fora de la peça: no es fa i avisa", () => {
    const { panels, warnings } = buildModule(mod([{ panel: "back", x: 10, y: 10, diameter: 60 }]))
    expect(panels.find((p) => p.role === "back")!.cutouts ?? []).toHaveLength(0)
    expect(warnings.some((w) => w.code === "cable-hole")).toBe(true)
  })

  it("segueix l'objecte: el forat és davant del centre de l'objecte i el segueix", () => {
    const m = mod([{ panel: "back", x: 0, y: 0, diameter: 60, ref: "endoll" }])
    const comp = (x: number): Composition => ({
      modules: [{ ...m, gapBefore: 100 }],
      references: [{ id: "endoll", name: "Endoll", w: 80, h: 80, d: 30, x, y: 300, z: 0 }],
    })
    const centre = (c: Composition) => {
      const back = buildComposition(c).panels.find((p) => p.role === "back")!
      const h = back.cutouts![0]!
      if (h.kind !== "circle") throw new Error("rodó")
      return toWorld(back, [h.x, h.y, 0])
    }
    const a = centre(comp(400))
    expect(a[0]).toBeCloseTo(440, 0)
    expect(a[1]).toBeCloseTo(340, 0)
    const b = centre(comp(600))
    expect(b[0]).toBeCloseTo(640, 0)
  })
})
