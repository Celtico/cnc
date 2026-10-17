import { describe, expect, it } from "vitest"
import { pointInPolygon, signedArea } from "../model/polygon"
import { subtractRects } from "./region2d"

describe("subtractRects", () => {
  it("sense rectangles: el rectangle sencer, antihorari", () => {
    const [p] = subtractRects(100, 50, [])
    expect(p!.outer).toEqual([[0, 0], [100, 0], [100, 50], [0, 50]])
    expect(p!.inners).toEqual([])
  })

  it("rectangle interior: un bucle interior horari", () => {
    const polys = subtractRects(100, 50, [{ a0: 20, a1: 40, b0: 10, b1: 20 }])
    expect(polys).toHaveLength(1)
    expect(polys[0]!.outer).toHaveLength(4)
    expect(polys[0]!.inners).toHaveLength(1)
    expect(signedArea(polys[0]!.outer)).toBeGreaterThan(0)
    expect(signedArea(polys[0]!.inners[0]!)).toBeLessThan(0)
    expect(Math.abs(signedArea(polys[0]!.inners[0]!))).toBeCloseTo(200)
  })

  it("ranura que travessa la cara: la parteix en dues", () => {
    const polys = subtractRects(100, 50, [{ a0: 0, a1: 100, b0: 10, b1: 20 }])
    expect(polys).toHaveLength(2)
    for (const p of polys) {
      expect(p.outer).toHaveLength(4)
      expect(p.inners).toEqual([])
      expect(signedArea(p.outer)).toBeGreaterThan(0)
    }
    const areas = polys.map((p) => signedArea(p.outer)).sort((a, b) => a - b)
    expect(areas).toEqual([1000, 3000])
  })

  it("ranura que toca un costat: osca de 8 vèrtexs", () => {
    const polys = subtractRects(100, 50, [{ a0: 0, a1: 30, b0: 10, b1: 20 }])
    expect(polys).toHaveLength(1)
    expect(polys[0]!.outer).toHaveLength(8)
    expect(signedArea(polys[0]!.outer)).toBeCloseTo(5000 - 300)
    expect(pointInPolygon([15, 15], polys[0]!.outer)).toBe(false)
    expect(pointInPolygon([50, 15], polys[0]!.outer)).toBe(true)
  })

  it("dos rectangles interiors: dos bucles interiors", () => {
    const polys = subtractRects(100, 50, [
      { a0: 10, a1: 20, b0: 10, b1: 20 },
      { a0: 60, a1: 80, b0: 30, b1: 40 },
    ])
    expect(polys).toHaveLength(1)
    expect(polys[0]!.inners).toHaveLength(2)
  })

  it("rectangle fora del domini: s'ignora", () => {
    const polys = subtractRects(100, 50, [{ a0: 200, a1: 300, b0: 0, b1: 10 }])
    expect(polys).toHaveLength(1)
    expect(polys[0]!.inners).toEqual([])
  })
})
