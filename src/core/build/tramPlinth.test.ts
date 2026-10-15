import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, PLINTH_PROFILE_ITEMS, defaultModule, dishwasherModule, floorTrams, setTramSides, withSupport, type Composition, type FloorSupport, type Module } from "../model"
import { HAFELE_LEGS } from "../model/hafele/hafeleLegs"
import { MAG_FURNITURE } from "../model/magFurniture"
import { buildComposition, panelBox } from "./buildComposition"
import { PLINTH_MAX_LENGTH } from "./tramPlinth"

/** El suport «Sòcol»: potes genèriques de 100 i el sòcol a `setback` de la cara dels fronts. */
const plinth = (p: Partial<FloorSupport["plinth"]> = {}, s: Partial<FloorSupport> = {}): FloorSupport => ({ kind: "plinth", height: 100, plinth: { setback: 24, ...p }, ...s })
const box = (id: string, w: number, more: Partial<Module> = {}): Module => {
  const m = defaultModule(id, id, { width: w, height: 770, depth: 560 })
  return { ...m, ...more }
}
const comp = (modules: Module[], support: FloorSupport): Composition => ({ modules, references: [], support })
const plinths = (c: Composition) => buildComposition(c).panels.filter((p) => p.role === "plinth")
/** Illa de 2000 × 770 × 900, lliure al terra a 1000 de la paret. */
const island = (): Module => ({ ...defaultModule("i", "Illa", { width: 2000, height: 770, depth: 900 }), wallGap: 1000, x: 0 })

describe("trams: els mòduls de terra que es toquen", () => {
  it("la fila és un tram; un mòdul separat o lliure al terra en fa un altre; els penjats no compten", () => {
    const hung = box("h", 600)
    const c = comp([box("a", 600), box("b", 600), { ...box("c", 600), gapBefore: 300 }, island(), { ...hung, carcass: { ...hung.carcass, base: { kind: "wall", height: 1450 } } }], plinth())
    const t = floorTrams(withSupport(c))
    expect(t.map((x) => [x.id, x.modules, x.free])).toEqual([["a", [0, 1], false], ["c", [2], false], ["i", [3], true]])
  })
})

describe("el sòcol de cada tram (una peça, mai una per mòdul)", () => {
  it("la fila: una sola peça de punta a punta, de terra fins a 5 mm sota la base, a la retirada de la cara dels fronts", () => {
    const ps = plinths(comp([box("a", 600), box("b", 900), box("c", 600)], plinth()))
    expect(ps).toHaveLength(1)
    const p = ps[0]!
    expect(p.length).toBe(2100)
    expect(p.width).toBe(95)
    const b = panelBox(p)
    expect(b.min[1]).toBeCloseTo(0)
    // 560 de caixa + 19 de front recobrent − 24 de retirada.
    expect(b.max[2]).toBeCloseTo(560 + 19 - 24)
  })

  it("l'illa (lliure al terra): per defecte, tot el voltant a tope", () => {
    const ps = plinths(comp([island()], plinth({ sideSetback: 5 })))
    const by = Object.fromEntries(ps.map((p) => [p.label, p]))
    expect(Object.keys(by).sort()).toEqual(["Sòcol", "Sòcol darrere", "Sòcol dret", "Sòcol esquerre"])
    expect(by["Sòcol"]!.length).toBe(1990)
    expect(by["Sòcol darrere"]!.length).toBe(1990)
    // Del darrere (a 5) al davant (919 − 24), menys els dos gruixos.
    expect(by["Sòcol esquerre"]!.length).toBe(919 - 24 - 5 - 2 * 19)
    expect(by["Sòcol"]!.edges.left && by["Sòcol"]!.edges.right).toBe(true)
  })

  it("els costats es trien per tram; a inglet, tots de fora a fora", () => {
    const c0 = withSupport(comp([island()], plinth({ sideSetback: 5, corners: "mitre" })))
    const c = { ...c0, support: setTramSides(c0.support!, floorTrams(c0)[0]!, c0, { left: true, right: true }) }
    const by = Object.fromEntries(plinths(c).map((p) => [p.label, p]))
    expect(Object.keys(by).sort()).toEqual(["Sòcol", "Sòcol dret", "Sòcol esquerre"])
    expect([...by["Sòcol"]!.mitres!].sort()).toEqual(["left", "right"])
    expect(by["Sòcol esquerre"]!.mitres).toHaveLength(1)
  })

  it("més llarg que un tauler: a trossos, amb la junta on es toquen dos mòduls", () => {
    const ps = plinths(comp([box("a", 600), box("b", 600), box("c", 600), box("d", 600), box("e", 600)], plinth()))
    expect(ps.map((p) => p.length)).toEqual([2400, 600])
    expect(ps.every((p) => p.length <= PLINTH_MAX_LENGTH)).toBe(true)
    // Les juntes, sense cantell; els extrems de fora, amb.
    expect(ps[0]!.edges.right).toBe(false)
    expect(ps[1]!.edges.left).toBe(false)
  })

  it("d'alumini: cap peça de CNC, els perfils a extres i a la comanda els trossos, els clips i les cantoneres", () => {
    const b = buildComposition(comp([island()], plinth({ sideSetback: 5, hardware: PLINTH_PROFILE_ITEMS[0]! })))
    expect(b.panels.some((p) => p.role === "plinth")).toBe(false)
    expect(b.extras.filter((p) => p.id.endsWith("-alu"))).toHaveLength(4)
    const [o] = b.linearOrders
    expect(o!.cuts.slice(0, 2)).toEqual([1990, 1990])
    expect(o!.corners).toBe(4)
  })

  it("avisa si un tram toca el peu de la pota triada", () => {
    const w = buildComposition(comp([island()], plinth({ sideSetback: 40 }, { leg: structuredClone(HAFELE_LEGS[0]!) }))).warnings
    expect(w.some((x) => x.code === "hardware" && x.message.includes("esquerre"))).toBe(true)
  })

  it("potes vistes o directe a terra: cap sòcol", () => {
    expect(plinths(comp([box("a", 600), box("b", 600)], plinth({}, { kind: "legs" })))).toEqual([])
    expect(plinths(comp([box("a", 600), box("b", 600)], plinth({}, { kind: "floor" })))).toEqual([])
  })

  it("avisa del mòdul del tram que no arriba a l'alçada dels baixos (el taulell no quedaria pla)", () => {
    const dw = { ...dishwasherModule(), id: "dw", name: "Rentaplats" }
    const low = { ...dw, carcass: { ...dw.carcass, height: 860 } }
    const w = buildComposition(comp([box("a", 600), low, box("b", 600)], plinth())).warnings.filter((x) => x.moduleId === "dw" && x.code === "layout")
    expect(w).toHaveLength(1)
    expect(w[0]!.message).toContain("870")
  })
})

describe("els mobles d'abans passen al suport del moble", () => {
  it("el sòcol de les potes de cada mòdul: un sòcol per tram, amb els costats dels extrems", () => {
    const leg = (id: string, sides: { left?: boolean; right?: boolean }): Module => {
      const m = box(id, 600)
      return { ...m, carcass: { ...m.carcass, base: { kind: "legs", height: 100, plinth: { setback: 5, ...sides } } } }
    }
    const c = withSupport({ modules: [leg("a", { left: true }), leg("b", {}), leg("c", { right: true })], references: [] })
    expect(c.support).toMatchObject({ kind: "plinth", height: 100, plinth: { setback: 5 + 19 } })
    expect(c.modules.every((m) => m.carcass.base.kind === "legs" && !m.carcass.base.plinth)).toBe(true)
    expect(c.support!.trams).toEqual({ a: { left: true, right: true } })
    expect(withSupport(c)).toBe(c)
  })

  it("el sòcol de caixa (laterals fins a terra): potes de la mateixa alçada i el mòdul més baix (a dalt queda on era)", () => {
    const m = box("a", 600, {})
    const c = withSupport({ modules: [{ ...m, carcass: { ...m.carcass, height: 870, base: { kind: "plinth", height: 100, setback: 30 } } }], references: [] })
    expect(c.support).toMatchObject({ kind: "plinth", height: 100 })
    expect(c.modules[0]!.carcass.base).toEqual({ kind: "legs", height: 100 })
    expect(c.modules[0]!.carcass.height).toBe(770)
  })

  it("els sòcols correguts es treuen (el sòcol és el del tram) i la cuina continua sent cuina", () => {
    const k: Composition = BUILTIN_TEMPLATES.find((t) => t.id === "modern-kitchen")!.make()
    const c = withSupport({ ...k, kind: undefined })
    expect(c.runs!.some((r) => r.kind === "plinth")).toBe(false)
    expect(c.kind).toBe("cuina")
    expect(c.support).toMatchObject({ kind: "plinth", plinth: { setback: 50, material: "Melamina roure", thickness: 16 } })
    const ps = plinths(c)
    expect(ps).toHaveLength(2)
    expect(ps.reduce((n, p) => n + p.length, 0)).toBe(3000)
  })

  it("el sòcol del rentaplats (del terra al front), per defecte, és l'alçada de les potes del moble", () => {
    const dw = { ...dishwasherModule(), id: "dw" }
    const za = dw.root.appliance!
    const own = { ...dw, root: { ...dw.root, appliance: { hardware: za.hardware } } }
    const front = (h: number) => buildComposition(comp([box("a", 600), own], plinth({}, { height: h }))).panels.find((p) => p.id.startsWith("dw:") && p.role === "flap")!
    // El front comença a dalt de les potes: 20 més de potes, 20 menys de front.
    expect(front(100).length - front(120).length).toBeCloseTo(20)
  })

  it("un mòdul sense base no pot anar sobre potes: va directe a terra", () => {
    const open = box("o", 600)
    const c = withSupport(comp([box("a", 600), { ...open, carcass: { ...open.carcass, noBottom: true } }], plinth()))
    expect(c.modules[1]!.carcass.base).toEqual({ kind: "none" })
  })

  it("la «Cuina greige amb illa»: l'illa porta sòcol al voltant, a inglet, i la fila al davant", () => {
    const c = withSupport(MAG_FURNITURE.find((t) => t.id === "greige-kitchen")!.make())
    const isl = c.modules.find((m) => m.name === "Illa")!
    const trams = floorTrams(c)
    const t = trams.find((x) => x.modules.includes(c.modules.indexOf(isl)))!
    expect(c.support!.trams?.[t.id]).toEqual({ back: true, left: true, right: true })
    expect(c.support!.plinth.corners).toBe("mitre")
  })

  it("la llum a sota d'un mòdul de terra: amb potes vistes es fa; amb sòcol no (quedaria amagada)", () => {
    const m = box("a", 600)
    const lit: Module = { ...m, carcass: { ...m.carcass, base: { kind: "legs", height: 100 }, underLight: {} } }
    const lights = (kind: FloorSupport["kind"]) => buildComposition(comp([lit], plinth({}, { kind }))).extras.filter((p) => p.id.includes("under")).length
    expect(lights("legs")).toBeGreaterThan(0)
    expect(lights("plinth")).toBe(0)
  })
})
