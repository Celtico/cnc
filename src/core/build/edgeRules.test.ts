import { afterEach, describe, expect, it } from "vitest"
import { defaultModule, setSolidMaterials, type Composition, type Module } from "../model"
import { buildComposition } from "./buildComposition"

const comp = (m: Module): Composition => ({ kind: "moble", modules: [m], references: [] })
const withBack = (back: Module["carcass"]["back"], wallGap: number | null = 500): Module => {
  const m = defaultModule("m1", "M")
  // Lliure al terra, separat de la paret (`wallGap`): el darrere es veu.
  return { ...m, carcass: { ...m.carcass, back }, root: { ...m.root, shelves: { n: 2, adjustable: true } }, ...(wallGap !== null ? { wallGap } : {}) }
}
const byLabel = (c: Composition, label: string) => buildComposition(c).panels.find((p) => p.label === label)!

describe("cantells de la caixa", () => {
  afterEach(() => setSolidMaterials([]))

  it("lliure al terra separat de la paret, el cantell del darrere de laterals, base, tapa i prestatges queda cantejat (amb fons o sense; cargolat, no)", () => {
    const groove = comp(withBack("groove"))
    const none = comp(withBack("none"))
    const screwed = comp(withBack("screwed"))
    // Lateral esquerre: davant = top, darrere = bottom. Dret: davant = bottom, darrere = top.
    expect(byLabel(groove, "Lateral esquerre").edges.bottom).toBe(true)
    expect(byLabel(screwed, "Lateral esquerre").edges.bottom).toBe(false)
    expect(byLabel(none, "Lateral esquerre").edges).toMatchObject({ top: true, bottom: true })
    expect(byLabel(none, "Lateral dret").edges).toMatchObject({ top: true, bottom: true })
    // Base: davant = bottom, darrere = top. Tapa (Sostre): davant = top, darrere = bottom.
    expect(byLabel(groove, "Base").edges.top).toBe(true)
    expect(byLabel(screwed, "Base").edges.top).toBe(false)
    expect(byLabel(none, "Base").edges).toMatchObject({ top: true, bottom: true })
    expect(byLabel(none, "Sostre").edges).toMatchObject({ top: true, bottom: true })
    // Prestatges regulables: davant = bottom, darrere = top.
    const shelves = buildComposition(none).panels.filter((p) => p.role === "shelf")
    expect(shelves.length).toBeGreaterThan(0)
    for (const s of shelves) expect(s.edges).toMatchObject({ top: true, bottom: true })
  })

  it("lliure al terra tocant la paret, també el darrere (al terra, tots els cantells)", () => {
    expect(byLabel(comp(withBack("none", 0)), "Base").edges.top).toBe(true)
    expect(byLabel(comp(withBack("groove", 0)), "Lateral esquerre").edges).toEqual({ left: true, right: true, bottom: true, top: true })
  })

  it("arrambat a la paret (a terra): els cantells de davant i els de dalt", () => {
    const c = comp(withBack("none", null))
    // Lateral: local x = alçada, «right» és el cap de dalt.
    expect(byLabel(c, "Lateral esquerre").edges).toEqual({ left: false, right: true, bottom: false, top: true })
    expect(byLabel(c, "Lateral dret").edges).toEqual({ left: false, right: true, bottom: true, top: false })
    expect(byLabel(c, "Base").edges).toEqual({ left: false, right: false, bottom: true, top: false })
    expect(byLabel(c, "Sostre").edges).toEqual({ left: false, right: false, bottom: false, top: true })
  })

  it("penjat a la paret: els de davant i els de sota", () => {
    const m = withBack("groove", null)
    const c = comp({ ...m, carcass: { ...m.carcass, base: { kind: "wall", height: 1500 } } })
    // Lateral: local x = alçada, «left» és el cap de baix.
    expect(byLabel(c, "Lateral esquerre").edges).toEqual({ left: true, right: false, bottom: false, top: true })
    expect(byLabel(c, "Lateral dret").edges).toEqual({ left: true, right: false, bottom: true, top: false })
    expect(byLabel(c, "Base").edges).toEqual({ left: false, right: false, bottom: true, top: false })
    expect(byLabel(c, "Sostre").edges).toEqual({ left: false, right: false, bottom: false, top: true })
  })

  it("un cantell que toca una altra peça no es canteja (la base entre laterals, el prestatge contra el fons)", () => {
    const c = comp(withBack("groove"))
    expect(byLabel(c, "Base").edges).toMatchObject({ left: false, right: false })
    for (const s of buildComposition(c).panels.filter((p) => p.role === "shelf")) expect(s.edges).toMatchObject({ left: false, right: false })
  })

  it("un material massís no es canteja; la resta, igual que sempre", () => {
    const c = comp(withBack("none"))
    const material = byLabel(c, "Lateral esquerre").material
    setSolidMaterials([{ name: material, solid: true }])
    const b = buildComposition(c)
    for (const p of b.panels.filter((x) => x.material === material)) expect(Object.values(p.edges).some(Boolean), p.label).toBe(false)
    setSolidMaterials([{ name: material, solid: false }])
    expect(byLabel(c, "Lateral esquerre").edges.top).toBe(true)
  })
})

describe("cantells d'una taula", () => {
  it("una taula compta com a lliure al terra: el tauler, cantejat pels quatre costats", () => {
    const m = defaultModule("m1", "M")
    const c: Composition = { kind: "taula", modules: [m], references: [] }
    const s = buildComposition(c).panels.find((p) => p.label === "Lateral esquerre")!
    expect(s.edges).toEqual({ left: true, right: true, bottom: true, top: true })
    expect(buildComposition({ ...c, kind: "moble" }).panels.find((p) => p.label === "Lateral esquerre")!.edges).toEqual({ left: false, right: true, bottom: false, top: true })
  })
})
