import { describe, expect, it } from "vitest"
import { defaultModule } from "../model"
import { buildModule } from "./buildModule"
import { nest } from "../nesting/nest"

describe("fons del mateix material que el cos", () => {
  it("comparteix tauler amb el cos al nesting", () => {
    const m = defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "screwed" })
    m.carcass = { ...m.carcass, backMaterial: m.carcass.material, backThickness: m.carcass.thickness }
    const { panels } = buildModule(m)
    const n = nest(panels, { kerf: 6, margin: 10, sheet: { w: 2800, h: 2070 } })
    expect(n.boards).toHaveLength(1)
  })

  it("en ranura i massa gruixut, avisa", () => {
    const m = defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "groove" })
    m.carcass = { ...m.carcass, backThickness: m.carcass.thickness }
    expect(buildModule(m).warnings.some((w) => w.code === "back-groove")).toBe(true)
    m.carcass = { ...m.carcass, backThickness: 8 }
    expect(buildModule(m).warnings.some((w) => w.code === "back-groove")).toBe(false)
  })

  it("cargolat i del mateix tauler que el cos: lliure al terra, cantells als quatre costats; arrambat, només el de dalt", () => {
    const m = { ...defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "screwed" }), wallGap: 300 }
    const back = () => buildModule(m).panels.find((p) => p.role === "back")!
    expect(Object.values(back().edges).some(Boolean)).toBe(false)
    m.carcass = { ...m.carcass, backMaterial: m.carcass.material, backThickness: m.carcass.thickness }
    expect(back().edges).toEqual({ left: true, right: true, top: true, bottom: true })
    delete (m as { wallGap?: number }).wallGap
    expect(Object.values(back().edges).filter(Boolean)).toHaveLength(1)
  })
})

describe("joc de l'ample de la ranura del fons (Folgances per defecte)", () => {
  const backGrooves = (m: ReturnType<typeof defaultModule>) =>
    buildModule(m)
      .panels.filter((p) => p.role === "side" || p.role === "bottom" || p.role === "top")
      .flatMap((p) => p.grooves.filter((g) => g.tag === "back").map((g) => ({ role: p.role, id: p.id, g, width: p.width })))

  it("sense joc, la ranura fa el gruix del fons; amb 0,8, el gruix + 0,8 i el cantell de darrere no es mou", () => {
    const m = defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "groove" })
    const before = backGrooves(m)
    expect(before.length).toBeGreaterThanOrEqual(3)
    for (const b of before) expect(b.g.h).toBeCloseTo(m.carcass.backThickness, 6)
    m.carcass = { ...m.carcass, grooveClearance: 0.8 }
    const after = backGrooves(m)
    expect(after).toHaveLength(before.length)
    after.forEach((a, i) => {
      const b = before[i]!
      expect(a.g.h).toBeCloseTo(m.carcass.backThickness + 0.8, 6)
      // El cantell de darrere es queda on era: o la y no canvia, o la ranura s'eixampla cap a l'altra banda.
      const sameStart = Math.abs(a.g.y - b.g.y) < 1e-6
      const sameEnd = Math.abs(a.g.y + a.g.h - (b.g.y + b.g.h)) < 1e-6
      expect(sameStart || sameEnd).toBe(true)
    })
  })

  it("res amagat compta: amb el fons cargolat, el joc no es llegeix", () => {
    const m = defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "screwed" })
    m.carcass = { ...m.carcass, grooveClearance: 0.8 }
    expect(backGrooves(m)).toHaveLength(0)
  })
})
