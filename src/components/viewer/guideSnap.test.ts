import { describe, expect, it } from "vitest"
import { snapWithGuides } from "./guideSnap"

const box = (x: number, y: number, w = 100, h = 100) => ({ x, y, z: 0, w, h, d: 50 })

describe("guies del Figma", () => {
  it("la vora s'enganxa a la vora de l'altre i hi surt una guia d'una caixa a l'altra", () => {
    const r = snapWithGuides(box(507, 400), ["x", "y"], [box(500, 0)], {}, 20)
    expect(r.box.x).toBe(500)
    expect(r.snapped).toEqual(["x"])
    // Les dues vores i el mig coincideixen: tres guies verticals, de dalt de l'una a baix de l'altra.
    expect(r.guides.length).toBe(3)
    expect(r.guides[0]).toEqual({ from: [500, 0, 25], to: [500, 500, 25] })
  })
  it("el mig s'enganxa al mig", () => {
    const r = snapWithGuides(box(290, 400, 200), ["x"], [box(340, 0)], {}, 20)
    expect(r.box.x).toBe(290)
    expect(r.guides).toEqual([{ from: [390, 0, 25], to: [390, 500, 25] }])
  })
  it("amb Alt, ni imant ni guies; lluny, tampoc", () => {
    expect(snapWithGuides(box(507, 400), ["x"], [box(500, 0)], {}, 20, true)).toEqual({ box: box(507, 400), snapped: [], guides: [] })
    expect(snapWithGuides(box(700, 400), ["x"], [box(500, 0)], {}, 20).guides).toEqual([])
  })
  it("el terra i la paret enganxen però no fan guia", () => {
    const r = snapWithGuides(box(5, 400), ["x"], [], { x: [0] }, 20)
    expect(r.box.x).toBe(0)
    expect(r.guides).toEqual([])
  })
})
