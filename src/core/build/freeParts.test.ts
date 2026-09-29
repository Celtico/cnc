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

describe("encaixos només al Flat-pack", () => {
  it("en un moble normal les peces lliures no fan encaixos", () => {
    const side = part({ id: "side", orient: "side", w: 300, h: 600, x: 1000 })
    const shelf = part({ id: "shelf", orient: "flat", w: 400, h: 300, x: 1000, y: 300 })
    const b = buildComposition(comp([side, shelf], { kind: "moble" }))
    expect(b.joints).toEqual([])
    expect(b.panels.find((p) => p.id === "part:side")!.cutouts ?? []).toHaveLength(0)
  })
})

describe("peça lliure que talla (booleana)", () => {
  it("fa un forat passant a la peça que travessa en la direcció del gruix i no és peça", () => {
    const back = part({ id: "back", orient: "front", w: 800, h: 600 })
    const hole = part({ id: "hole", orient: "front", w: 100, h: 100, x: 300, y: 200, z: -10, thickness: 40, effect: "cut" })
    const b = buildComposition(comp([back, hole]))
    expect(b.panels.map((p) => p.id)).toEqual(["part:back"])
    const cut = b.panels[0]!.cutouts ?? []
    expect(cut).toHaveLength(1)
  })
  it("amb forma: l'estirada (v cap al davant) talla al lloc bo", () => {
    const shelf = part({ id: "shelf", orient: "flat", w: 800, h: 400, y: 300 })
    const hole = part({ id: "hole", orient: "flat", w: 100, h: 100, x: 100, y: 290, z: 20, thickness: 40, effect: "cut" })
    const b = buildComposition(comp([shelf, hole]))
    const c = b.panels[0]!.cutouts![0]!
    if (c.kind !== "polygon") throw new Error(c.kind)
    const bb = bounds(c.points as Pt[])
    // x = 100..200 · z = 20..120 del fons → v (des del davant, z = 400) = 280..380.
    expect([Math.round(bb.x0), Math.round(bb.x1), Math.round(bb.y0), Math.round(bb.y1)]).toEqual([100, 200, 280, 380])
  })
})

describe("peça que talla travessant de costat", () => {
  const front = part({ id: "front", orient: "front", w: 600, h: 400 })
  // Barra quadrada vertical (estirada: gruix = alçada) que passa per davant i per darrere del tauler.
  const rod = (y: number, t: number) => part({ id: "rod", orient: "flat", w: 50, h: 50, x: 200, y, z: -10, thickness: t, effect: "cut" })

  it("de cara a cara i sense arribar a la vora: forat rectangular", () => {
    const b = buildComposition(comp([front, rod(100, 200)]))
    const c = b.panels[0]!.cutouts ?? []
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ kind: "rect", w: 50, h: 200 })
    expect(b.warnings.filter((w) => w.partId === "rod")).toEqual([])
  })

  it("de cara a cara fins a la vora: osca al contorn", () => {
    const b = buildComposition(comp([front, rod(200, 700)]))
    const o = b.panels[0]!.outline!
    expect(o).toHaveLength(8)
    expect(b.warnings.filter((w) => w.partId === "rod")).toEqual([])
  })

  it("de dalt a baix: la parteix i avisa", () => {
    const b = buildComposition(comp([front, rod(-100, 700)]))
    expect(b.warnings.some((w) => w.partId === "rod" && w.message.includes("trossos"))).toBe(true)
  })

  it("un tub rodó dins d'un bloc: booleà al 3D; a la CNC avisa, a la pedra no", () => {
    const block = part({ id: "block", orient: "front", w: 600, h: 100, thickness: 600 })
    const tube = part({ id: "tube", orient: "flat", w: 50, h: 50, x: 200, y: -100, z: 200, thickness: 400, effect: "cut", shape: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }].map((q) => ({ ...q, t: "corner" as const })) })
    const wood = buildComposition(comp([block, { ...tube, shape: undefined }]))
    expect(wood.panels[0]!.solidCuts).toHaveLength(1)
    expect(wood.panels[0]!.cutouts ?? []).toHaveLength(0)
    expect(wood.warnings.some((w) => w.partId === "tube" && w.message.includes("cantell"))).toBe(true)
    const stone = buildComposition(comp([{ ...block, nest: false }, { ...tube, shape: undefined }]))
    expect(stone.extras[0]!.solidCuts).toHaveLength(1)
    expect(stone.warnings.filter((w) => w.partId === "tube")).toEqual([])
    // Els 4 vèrtexs de la secció, en coordenades de la peça, i el vector travessa els 100 mm d'alçada.
    const sc = wood.panels[0]!.solidCuts![0]!
    expect(sc.points).toHaveLength(4)
    expect(Math.abs(sc.dir[1])).toBe(400)
  })
})
