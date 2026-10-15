import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, PLINTH_PROFILE_ITEMS, defaultModule, type Composition, type Module, type PlinthSides } from "../model"
import { MAG_FURNITURE } from "../model/magFurniture"
import { buildComposition, panelBox } from "./buildComposition"
import { buildModule } from "./buildModule"
import { barsFor, buildLinearOrders, clipCount, cutsText } from "./linearOrders"
import { plinthCorners, plinthPieces } from "./plinth"

/** Illa de 2000 × 770 × 900 sobre potes genèriques de 100. */
function island(plinth: PlinthSides & { setback: number }): Module {
  const m = defaultModule("i", "Illa")
  return { ...m, carcass: { ...m.carcass, width: 2000, height: 770, depth: 900, base: { kind: "legs", height: 100, plinth } } }
}

const plinths = (m: Module) => buildModule(m).panels.filter((p) => p.role === "plinth")

describe("sòcol al voltant (base «Potes»)", () => {
  it("només el davant: la peça de sempre", () => {
    const ps = plinths(island({ setback: 5 }))
    expect(ps.map((p) => p.id)).toEqual(["plinth"])
    expect(ps[0]!.length).toBe(2000)
  })

  it("tot el voltant a tope: davant i darrere de fora a fora, els laterals entre mig", () => {
    const ps = plinths(island({ setback: 5, back: true, left: true, right: true, sideSetback: 5 }))
    const by = Object.fromEntries(ps.map((p) => [p.id, p]))
    expect(Object.keys(by).sort()).toEqual(["plinth", "plinth-back", "plinth-left", "plinth-right"])
    // 2000 − 2 × 5 de retirada; laterals: 900 − 5 − 5 − 2 × 19.
    expect(by.plinth!.length).toBe(1990)
    expect(by["plinth-back"]!.length).toBe(1990)
    expect(by["plinth-left"]!.length).toBe(852)
    expect(by.plinth!.mitres).toBeUndefined()
    // Els extrems del davant es veuen (hi topen els laterals): cantell.
    expect(by.plinth!.edges.left && by.plinth!.edges.right).toBe(true)
    // El lateral esquerre, a 5 del costat i de terra a 95.
    const bx = panelBox(by["plinth-left"]!)
    expect(bx.min[0]).toBeCloseTo(5)
    expect(bx.max[0]).toBeCloseTo(24)
    expect(bx.min[1]).toBeCloseTo(-100)
    expect(bx.max[1] - bx.min[1]).toBeCloseTo(95)
    // Les potes genèriques (Ø48 a 50 dels cantells) queden a dins: cap avís.
    expect(buildModule(island({ setback: 5, back: true, left: true, right: true, sideSetback: 5 })).warnings.filter((w) => w.code === "hardware")).toEqual([])
  })

  it("a inglet: tots els trams de fora a fora, tallats a 45° on fan cantonada", () => {
    const ps = plinths(island({ setback: 5, left: true, right: true, sideSetback: 5, corners: "mitre" }))
    const by = Object.fromEntries(ps.map((p) => [p.id, p]))
    expect(by.plinth!.length).toBe(1990)
    expect([...by.plinth!.mitres!].sort()).toEqual(["left", "right"])
    // Sense darrere: el lateral va del davant (a 5) fins al darrere del mòdul, a inglet només al davant.
    expect(by["plinth-left"]!.length).toBe(895)
    expect(by["plinth-left"]!.mitres).toHaveLength(1)
  })

  it("avisa si un tram toca el peu de les potes", () => {
    const w = buildModule(island({ setback: 5, left: true, sideSetback: 30 })).warnings
    expect(w.some((x) => x.code === "hardware" && x.message.includes("esquerre"))).toBe(true)
  })

  it("d'alumini: cap peça de CNC, els perfils a extres, i a la comanda les barres, un clip a cada pota per tram i les cantoneres", () => {
    const item = PLINTH_PROFILE_ITEMS[0]!
    const b = buildModule(island({ setback: 5, back: true, left: true, right: true, sideSetback: 5, hardware: item }))
    expect(b.panels.some((p) => p.role === "plinth")).toBe(false)
    const alu = b.extras.filter((p) => p.id.endsWith("-alu"))
    expect(alu).toHaveLength(4)
    expect(alu.every((p) => p.role === "hardware" && p.material === "Alumini anoditzat plata" && p.width === 100 && p.thickness === 12)).toBe(true)
    const [o] = buildLinearOrders(b.linear)
    // Laterals entre el davant i el darrere (perfil de 12): 900 − 5 − 5 − 2 × 12 = 866.
    expect(o!.cuts).toEqual([1990, 1990, 866, 866])
    expect(o!.corners).toBe(4)
    // 2 × 1990 + 2 × 866 = 5712 → dues barres de 3900.
    expect(o!.bars).toBe(2)
    // Un clip a cada pota de cada tram: 4 trams × 2 potes.
    expect(o!.clips).toBe(8)
    expect(o!.joints).toBe(0)
  })

  it("un tram més llarg que la barra porta unió lineal", () => {
    const item = PLINTH_PROFILE_ITEMS[0]!
    const [o] = buildLinearOrders([{ item, length: 4500, stock: 3900, clipSpacing: 0, clipEnd: 0, clips: 6, corners: 0 }])
    expect(o!.bars).toBe(2)
    expect(o!.joints).toBe(1)
    expect(o!.clips).toBe(6)
  })

  it("la «Cuina greige amb illa»: l'illa porta sòcol al voltant, a inglet", () => {
    const c = MAG_FURNITURE.find((t) => t.id === "greige-kitchen")!.make()
    const isl = c.modules.find((m) => m.name === "Illa")!
    expect(isl.carcass.base.kind === "legs" && isl.carcass.base.plinth?.left && isl.carcass.base.plinth.right && isl.carcass.base.plinth.back).toBe(true)
    const b = buildComposition(c)
    const n = c.modules.indexOf(isl) + 1
    expect(b.panels.filter((p) => p.module === n && p.role === "plinth")).toHaveLength(4)
  })
})

describe("sòcol corregut amb retorns (sense UI)", () => {
  it("retorn a l'esquerra: del davant fins a la paret", () => {
    const c: Composition = BUILTIN_TEMPLATES.find((t) => t.id === "modern-kitchen")!.make()
    const run = c.runs!.find((r) => r.kind === "plinth")!
    Object.assign(run, { left: true, sideSetback: 0 })
    const ps = buildComposition(c).panels.filter((p) => p.id.startsWith(`run:${run.id}`))
    expect(ps).toHaveLength(2)
    expect(ps.some((p) => p.label === "Sòcol esquerre corregut")).toBe(true)
  })
})

describe("ferratges per metres", () => {
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
