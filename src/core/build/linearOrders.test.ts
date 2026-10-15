import { describe, expect, it } from "vitest"
import { PLINTH_PROFILE_ITEMS } from "../model"
import { barsFor, buildLinearOrders, clipCount, cutsText } from "./linearOrders"
import { plinthCorners, plinthPieces } from "./plinth"

describe("ferratges per metres", () => {
  it("un tram més llarg que la barra porta unió lineal", () => {
    const item = PLINTH_PROFILE_ITEMS[0]!
    const [o] = buildLinearOrders([{ item, length: 4500, stock: 3900, clipSpacing: 0, clipEnd: 0, clips: 6, corners: 0 }])
    expect(o!.bars).toBe(2)
    expect(o!.joints).toBe(1)
    expect(o!.clips).toBe(6)
  })

  it("clips, barres i trossos", () => {
    expect(clipCount(300, 600, 80)).toBe(2)
    expect(clipCount(1990, 600, 80)).toBe(5)
    expect(clipCount(1000, 0, 0)).toBe(0)
    expect(barsFor([1500, 1500, 900], 2000)).toBe(3)
    expect(barsFor([1000, 900], 2000)).toBe(1)
    expect(barsFor([4500], 2000)).toBe(3)
    expect(barsFor([4500], 0)).toBe(0)
    expect(cutsText([1800, 1800, 600])).toBe("2 × 1800 + 600")
  })

  it("cantonades i trams", () => {
    expect(plinthCorners({ front: true, back: false, left: true, right: true })).toBe(2)
    const ps = plinthPieces({ x0: 0, x1: 1000, zBack: 0, zFront: 600, y0: 0, h: 95, t: 19, corners: "butt", sides: { front: true, back: false, left: true, right: false } })
    expect(ps.map((p) => [p.side, p.length])).toEqual([["front", 1000], ["left", 581]])
  })
})
