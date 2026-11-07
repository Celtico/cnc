import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { panelAabb } from "./fitBlock"
import { extrudeSketch, type Sketch } from "./sketch"

describe("croquis i extrusió", () => {
  it("el rectangle d'una cara de dalt surt cap amunt, amb la seva mida i al seu lloc", () => {
    const s: Sketch = { id: "s", name: "R", a: 1, level: 700, dir: 1, pts: [[100, 50], [700, 50], [700, 450], [100, 450]], rect: true }
    const p = extrudeSketch(s, 19, { id: "p", name: "Peça 1", material: "Melamina blanca" })
    const b = panelAabb(buildComposition({ modules: [], references: [], parts: [p] }).panels[0]!)
    expect(b.min).toEqual([100, 700, 50])
    expect(b.max).toEqual([700, 719, 450])
  })
  it("una polilínia d'escaire en L fa la peça amb aquest contorn (no girada)", () => {
    // L vista de dalt: el tros llarg al fons (z petita), el curt endavant a l'esquerra.
    const s: Sketch = { id: "s", name: "L", a: 1, level: 0, dir: 1, pts: [[0, 0], [600, 0], [600, 200], [200, 200], [200, 500], [0, 500]] }
    const p = extrudeSketch(s, 19, { id: "p", name: "L", material: "Melamina blanca" })
    const panel = buildComposition({ modules: [], references: [], parts: [p] }).panels[0]!
    // Un punt del tros curt (x 100, z 400) és dins; un de l'angle buit (x 400, z 400), fora. v local = zmax - z.
    const outline = panel.outline ?? []
    const inside = (u: number, v: number) => {
      let c = false
      for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const [xi, yi] = [outline[i]![0], outline[i]![1]]
        const [xj, yj] = [outline[j]![0], outline[j]![1]]
        if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) c = !c
      }
      return c
    }
    expect(outline.length).toBeGreaterThan(3)
    expect(inside(100, 500 - 400)).toBe(true)
    expect(inside(400, 500 - 400)).toBe(false)
  })
})
