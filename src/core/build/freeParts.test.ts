import { describe, expect, it } from "vitest"
import { bounds, defaultModule, type Composition, type FreePart, type Panel, type Pt } from "../model"
import { buildComposition } from "./buildComposition"
import { buildFreeParts } from "./freeParts"

const part = (p: Partial<FreePart> & Pick<FreePart, "id" | "orient" | "w" | "h">): FreePart => ({
  name: p.id,
  thickness: 18,
  material: "Blanc",
  x: 0,
  y: 0,
  z: 0,
  ...p,
})

const comp = (parts: FreePart[], extra: Partial<Composition> = {}): Composition => ({
  kind: "lliure",
  modules: [defaultModule("m1", "Mòdul 1")],
  references: [],
  parts,
  ...extra,
})

const byId = (panels: Panel[], id: string) => panels.find((p) => p.id === `part:${id}`)!

describe("peces lliures", () => {
  it("tipus Flat-pack: només les peces lliures, cadascuna una peça de debò", () => {
    const b = buildComposition(comp([part({ id: "a", orient: "front", w: 400, h: 300 })]))
    expect(b.panels).toHaveLength(1)
    expect(b.panels[0]!.role).toBe("part")
    expect(b.panels[0]!.length).toBe(400)
    expect(b.panels[0]!.width).toBe(300)
    expect(b.modules).toHaveLength(0)
  })

  it("en un moble normal, van després dels mòduls", () => {
    const b = buildComposition(comp([part({ id: "a", orient: "flat", w: 400, h: 300, x: 1000 })], { kind: "moble" }))
    expect(b.panels.at(-1)!.id).toBe("part:a")
    expect(b.panels.at(-1)!.module).toBe(2)
  })

  it("T: pestanyes a la que entra i mortalles passants a l'altra, amb el joc", () => {
    const side = part({ id: "side", orient: "side", w: 300, h: 600 })
    const shelf = part({ id: "shelf", orient: "flat", w: 400, h: 300, y: 300 })
    const r = buildFreeParts(comp([side, shelf], { joinery: { clearance: 0.2, tool: 0, tabWidth: 50 } }), 1)
    expect(r.joints).toEqual([{ kind: "tab", a: "side", b: "shelf", into: "shelf", through: true }])
    const s = byId(r.panels, "side")
    // 300 mm de fondària → 3 pestanyes de 50.
    expect(s.cutouts).toHaveLength(3)
    for (const c of s.cutouts!) {
      if (c.kind !== "polygon") throw new Error()
      const bb = bounds(c.points as Pt[])
      const sizes = [bb.x1 - bb.x0, bb.y1 - bb.y0].sort((a, b) => a - b)
      expect(sizes[0]).toBeCloseTo(18.2, 5)
      expect(sizes[1]).toBeCloseTo(50.2, 5)
    }
    const sh = byId(r.panels, "shelf")
    expect(sh.outline).toBeDefined()
    // Les pestanyes sobresurten 18 mm del cos: el contorn té punts a u = 0 i a u = 18.
    const us = new Set(sh.outline!.map((q) => q[0]))
    expect(us.has(0)).toBe(true)
    expect(us.has(18)).toBe(true)
  })

  it("T cega: si només hi entra una part del gruix, ranures en lloc de talls", () => {
    const side = part({ id: "side", orient: "side", w: 300, h: 600 })
    const shelf = part({ id: "shelf", orient: "flat", w: 400, h: 300, y: 300, x: 8 })
    const r = buildFreeParts(comp([side, shelf]), 1)
    expect(r.joints[0]).toMatchObject({ kind: "tab", into: "shelf", through: false })
    const s = byId(r.panels, "side")
    expect(s.cutouts ?? []).toHaveLength(0)
    expect(s.grooves).toHaveLength(3)
    expect(s.grooves[0]!.depth).toBe(10)
  })

  it("X: mitja fusta, cadascuna amb la ranura fins a la meitat", () => {
    const a = part({ id: "a", orient: "front", w: 400, h: 300, z: 100 })
    const b = part({ id: "b", orient: "side", w: 300, h: 300, x: 200 })
    const r = buildFreeParts(comp([a, b], { joinery: { clearance: 0, tool: 0, tabWidth: 50 } }), 1)
    expect(r.joints).toEqual([{ kind: "lap", a: "a", b: "b" }])
    const pa = byId(r.panels, "a")
    // Ranura de 18 d'ample de dalt (y = 300) fins a la meitat (y = 150), a x = 200..218.
    expect(pa.outline).toBeDefined()
    expect(pa.outline!.some((q) => q[0] === 200 && q[1] === 150)).toBe(true)
    expect(pa.outline!.some((q) => q[0] === 218 && q[1] === 150)).toBe(true)
    const pb = byId(r.panels, "b")
    expect(pb.outline).toBeDefined()
  })

  it("L: dits alterns a la cantonada", () => {
    const a = part({ id: "a", orient: "front", w: 400, h: 300 })
    const b = part({ id: "b", orient: "side", w: 300, h: 300 })
    const r = buildFreeParts(comp([a, b]), 1)
    expect(r.joints).toEqual([{ kind: "finger", a: "a", b: "b" }])
    expect(byId(r.panels, "a").outline).toBeDefined()
    expect(byId(r.panels, "b").outline).toBeDefined()
  })

  it("només es toquen: espigues al cantell i a la cara", () => {
    const side = part({ id: "side", orient: "side", w: 300, h: 600 })
    const shelf = part({ id: "shelf", orient: "flat", w: 400, h: 300, x: 18, y: 300 })
    const r = buildFreeParts(comp([side, shelf]), 1)
    expect(r.joints).toEqual([{ kind: "dowel", a: "side", b: "shelf", into: "shelf" }])
    const sh = byId(r.panels, "shelf")
    expect(sh.holes).toHaveLength(2)
    expect(sh.holes.every((h) => h.face === "edge")).toBe(true)
    const s = byId(r.panels, "side")
    expect(s.holes).toHaveLength(2)
    expect(s.holes.every((h) => h.face !== "edge")).toBe(true)
  })

  it("dogbones: les mortalles passants surten amb les cantonades buidades", () => {
    const side = part({ id: "side", orient: "side", w: 300, h: 600 })
    const shelf = part({ id: "shelf", orient: "flat", w: 400, h: 300, y: 300 })
    const r = buildFreeParts(comp([side, shelf], { joinery: { clearance: 0.2, tool: 6, tabWidth: 50 } }), 1)
    const c = byId(r.panels, "side").cutouts![0]!
    if (c.kind !== "polygon") throw new Error()
    expect(c.points.length).toBeGreaterThan(8)
  })

  it("sense encaixos (joints: false): peces rectes i avís si s'encavalquen", () => {
    const side = part({ id: "side", orient: "side", w: 300, h: 600, joints: false })
    const shelf = part({ id: "shelf", orient: "flat", w: 400, h: 300, y: 300 })
    const r = buildFreeParts(comp([side, shelf]), 1)
    expect(r.joints).toHaveLength(0)
    expect(r.warnings).toHaveLength(1)
  })
})

describe("peces que no són de CNC", () => {
  it("ferro, pedra…: fora del nesting, a extras, sense encaixos", () => {
    const side = part({ id: "side", orient: "side", w: 300, h: 600 })
    const iron = part({ id: "iron", orient: "flat", w: 400, h: 300, y: 300, nest: false, material: "Ferro negre", thickness: 5 })
    const b = buildComposition(comp([side, iron]))
    expect(b.panels.map((p) => p.id)).toEqual(["part:side"])
    expect(b.extras.map((p) => p.id)).toEqual(["part:iron"])
    expect(b.joints).toEqual([])
    expect(b.warnings).toEqual([])
  })
})
