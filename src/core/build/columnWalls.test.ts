import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type RefObject } from "../model"
import { buildComposition, panelBox } from "./buildComposition"
import { legPoints } from "./columnWalls"

const mod = (back: "groove" | "screwed" = "groove") => ({ ...defaultModule("m", "x", { width: 1000, height: 800, depth: 500, back }), gapBefore: 0 })
const comp = (o: RefObject, back?: "groove" | "screwed"): Composition => ({ modules: [mod(back)], references: [o] })
const col = (x: number, z: number, w = 250, d = 250): RefObject => ({ id: "c", name: "Columna", w, h: 2600, d, x, y: 0, z, effect: "cut", axis: "y" })

describe("moble tancat al voltant d'una columna", () => {
  it("columna a la cantonada de darrere a l'esquerra: el fons del davant i el del costat, amb les ranures a la base i a la tapa", () => {
    const b = buildComposition(comp(col(-60, -60)))
    const walls = b.panels.filter((p) => p.id.includes("colback"))
    expect(walls).toHaveLength(2)
    for (const w of walls) {
      expect(w.role).toBe("back")
      expect(w.thickness).toBe(10)
      const box = panelBox(w)
      // Fora de la columna (a 10 mm, la retirada del fons) i dins del mòdul.
      const inColumn = box.min[0] < 190 - 0.5 && box.min[2] < 190 - 0.5
      expect(inColumn).toBe(false)
      expect(box.min[0]).toBeGreaterThanOrEqual(0)
      expect(box.max[0]).toBeLessThanOrEqual(1000)
    }
    const front = walls.find((w) => Math.abs(w.placement.zAxis[2]) === 1)!
    expect(panelBox(front).min[2]).toBeCloseTo(200, 0)
    const side = walls.find((w) => Math.abs(w.placement.zAxis[0]) === 1)!
    expect(panelBox(side).min[0]).toBeCloseTo(200, 0)
    for (const role of ["bottom", "top"]) {
      const p = b.panels.find((q) => q.role === role && q.id === `m:${role}`)!
      expect(p.grooves.filter((g) => g.tag === "back").length, role).toBeGreaterThanOrEqual(3)
      for (const g of p.grooves) expect(Math.min(g.w, g.h), role).toBeCloseTo(10, 6)
    }
    expect(b.warnings.filter((w) => w.code === "ref-cut")).toEqual([])
  })

  it("columna al mig del darrere: el fons del davant i els dos dels costats", () => {
    const b = buildComposition(comp(col(400, -60)))
    expect(b.panels.filter((p) => p.id.includes("colback"))).toHaveLength(3)
  })

  it("amb el fons cargolat, els fons nous sense ranures", () => {
    const b = buildComposition(comp(col(-60, -60), "screwed"))
    expect(b.panels.filter((p) => p.id.includes("colback")).length).toBeGreaterThanOrEqual(1)
    expect(b.panels.find((q) => q.id === "m:bottom")!.grooves.filter((g) => g.tag === "back")).toHaveLength(0)
  })

  it("una columna que travessa tot el mòdul no s'hi tanca: avís", () => {
    const b = buildComposition(comp(col(400, -60, 200, 700)))
    expect(b.panels.filter((p) => p.id.includes("colback"))).toHaveLength(0)
    expect(b.warnings.some((w) => w.code === "ref-cut" && /travessa tot el mòdul/.test(w.message))).toBe(true)
  })
})

describe("potes d'una base retallada per una columna", () => {
  it("una a cada cantonada que queda (cinc amb una columna a la cantonada), cap dins de la columna", () => {
    const b = buildComposition(comp(col(-60, -60)))
    const base = b.panels.find((q) => q.id === "m:bottom")!
    const pts = legPoints(base, 50)!
    expect(pts).toHaveLength(5)
    for (const [x, z] of pts) expect(x < 190 && z < 190).toBe(false)
    const plain = buildComposition({ modules: [mod()], references: [] }).panels.find((q) => q.id === "m:bottom")!
    expect(legPoints(plain, 50)).toBeUndefined()
  })
})

describe("columna que no arriba a la tapa", () => {
  it("no es tanca i ho diu", () => {
    const b = buildComposition(comp({ ...col(-60, -60), h: 500 }))
    expect(b.panels.filter((p) => p.id.includes("colback"))).toHaveLength(0)
    expect(b.warnings.some((w) => w.code === "ref-cut" && /no arriba a la tapa/.test(w.message))).toBe(true)
  })
})
