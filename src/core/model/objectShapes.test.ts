import { describe, expect, it } from "vitest"
import { tube } from "./objectShapes"
import { bounds, pointInPolygon, sampleProfile, selfIntersects, type PNode } from "./polygon"

describe("tub buit (pantalles de làmpada)", () => {
  it("dues meitats d'anella que omplen la seva caixa, sense creuar-se, amb el forat al mig", () => {
    const [a, b] = tube("P", "Lli blanc", 300, 0, 300, 600, 280, 3)
    for (const p of [a!, b!]) {
      const pts = sampleProfile(p.shape as PNode[])
      const bb = bounds(pts)
      expect([bb.x0, bb.y0, Math.round(bb.x1), Math.round(bb.y1)]).toEqual([0, 0, 600, 300])
      expect(selfIntersects(pts)).toBe(false)
      expect([p.w, p.h, p.thickness]).toEqual([600, 300, 280])
    }
    // v = 0 al davant (z màxima): la meitat del fons té l'arc a v = R, la del davant a v = 0. La paret (a 1,5 mm de la
    // vora rodona) hi és; el centre del tub (a z = cz: v = 0 al fons, v = R al davant), no.
    const back = sampleProfile(a!.shape as PNode[]), fwd = sampleProfile(b!.shape as PNode[])
    expect(a!.z).toBe(0)
    expect(b!.z).toBe(300)
    expect(pointInPolygon([300, 298.5], back)).toBe(true)
    expect(pointInPolygon([300, 1.5], fwd)).toBe(true)
    expect(pointInPolygon([300, 1.5], back)).toBe(false)
    expect(pointInPolygon([300, 298.5], fwd)).toBe(false)
    expect(pointInPolygon([300, 150], back)).toBe(false)
    expect(pointInPolygon([300, 150], fwd)).toBe(false)
  })
})
