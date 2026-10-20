import { describe, expect, it } from "vitest"
import { defaultModule, withSupport, type Composition, type FloorSupport, type Module } from "../model"
import { buildComposition } from "./buildComposition"
import { panelBox } from "./geometry"

/** Per decisió de l'usuari, 2026-10-20: el moble normal té el suport a cada mòdul (com abans); la cuina, un per a tots. */
const box = (id: string, base: Module["carcass"]["base"] = { kind: "none" }): Module => {
  const m = defaultModule(id, id, { width: 600, height: 770, depth: 560 })
  return { ...m, carcass: { ...m.carcass, base } }
}
const support: FloorSupport = { kind: "plinth", height: 100, plinth: { setback: 24 }, trams: { a: { left: true, right: true } } }
const plinths = (c: Composition) => buildComposition(c).panels.filter((p) => p.role === "plinth")

describe("suport del moble normal: el de cada mòdul", () => {
  it("no pren el suport del moble: cada mòdul conserva el seu", () => {
    const c: Composition = { kind: "moble", modules: [box("a", { kind: "plinth", height: 80, setback: 20 }), box("b", { kind: "legs", height: 120 })], references: [] }
    expect(withSupport(c)).toBe(c)
  })

  it("les potes amb sòcol fan un sòcol per mòdul, de terra fins a 5 mm sota la base", () => {
    const legs = { kind: "legs", height: 100, plinth: { setback: 30 } } as const
    const ps = plinths({ kind: "moble", modules: [box("a", legs), box("b", legs)], references: [] })
    expect(ps.map((p) => [p.module, p.length, p.width])).toEqual([
      [1, 600, 95],
      [2, 600, 95],
    ])
    expect(panelBox(ps[0]!).min[1]).toBeCloseTo(0)
  })

  it("un moble normal desat amb el suport del moble el torna als mòduls (el sòcol, només al davant de cada un)", () => {
    const legs = { kind: "legs", height: 100 } as const
    const c = withSupport({ kind: "moble", modules: [box("a", legs), box("b", legs), box("c", legs)], references: [], support })
    expect(c.support).toBeUndefined()
    const sides = c.modules.map((m) => (m.carcass.base.kind === "legs" ? m.carcass.base.plinth : undefined))
    expect(sides.map((p) => p && Object.keys(p))).toEqual([["setback"], ["setback"], ["setback"]])
    // La retirada del sòcol del tram és de la cara dels fronts; la de les potes, del davant de la caixa (sense fronts, el gruix).
    expect(sides[0]!.setback).toBe(24 - c.modules[0]!.carcass.thickness)
  })

  it("la cuina continua amb un sol suport i un sòcol per tram", () => {
    const legs = { kind: "legs", height: 100 } as const
    const c: Composition = { kind: "cuina", modules: [box("a", legs), box("b", legs)], references: [], support: { ...support, trams: {} } }
    expect(withSupport(c).support).toBeDefined()
    expect(plinths(c).map((p) => p.length)).toEqual([1200])
  })
})
