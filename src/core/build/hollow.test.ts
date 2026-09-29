import { describe, expect, it } from "vitest"
import { defaultModule, type Module } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./buildComposition"
import { buildComposition } from "./buildComposition"

const mod = (): Module => {
  const m = defaultModule("m", "M", { width: 800, height: 720, depth: 500, hollow: { thickness: 60 } })
  return { ...m, root: { ...m.root, front: { kind: "door", mode: "double", hinge: "left" } } }
}

const overlap = (a: ReturnType<typeof panelBox>, b: ReturnType<typeof panelBox>) =>
  [0, 1, 2].every((i) => Math.min(a.max[i]!, b.max[i]!) - Math.max(a.min[i]!, b.min[i]!) > 0.5)

describe("parets buides", () => {
  it("cada paret és una caixa: dues pells, tira del davant i llistons", () => {
    const b = buildModule(mod())
    const ids = b.panels.map((p) => p.id)
    for (const w of ["side-left", "side-right", "bottom", "top"]) {
      expect(ids).toContain(w)
      expect(ids).toContain(`${w}-inner`)
      expect(ids).toContain(`${w}-facing`)
    }
    expect(b.panels.filter((p) => p.role === "spacer").length).toBe(12)
    expect(b.panels.find((p) => p.id === "side-left-facing")!.width).toBe(60)
  })
  it("cap peça es trepitja amb una altra", () => {
    const { panels } = buildComposition({ modules: [mod()], references: [] })
    // El fons entra a la ranura de les pells de dins: no compta.
    const boxes = panels.filter((p) => p.role !== "back").map((p) => ({ p, b: panelBox(p) }))
    const hits: string[] = []
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i]!.b, boxes[j]!.b)) hits.push(`${boxes[i]!.p.id} × ${boxes[j]!.p.id}`)
    expect(hits).toEqual([])
  })
  it("l'interior i els fronts compten el gruix aparent", () => {
    const b = buildModule(mod())
    const shelf = b.panels.find((p) => p.role === "shelf")
    expect(shelf!.length).toBeLessThanOrEqual(800 - 2 * 60)
    const doors = b.panels.filter((p) => p.role === "door")
    const x0 = Math.min(...doors.map((p) => panelBox(p).min[0]))
    expect(x0).toBeLessThan(5) // tapen també la paret gruixuda
  })
})
