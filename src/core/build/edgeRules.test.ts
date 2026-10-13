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

  it("sense fons i lliure al terra, el cantell del darrere de laterals, base, tapa i prestatges queda cantejat", () => {
    const groove = comp(withBack("groove"))
    const none = comp(withBack("none"))
    // Lateral esquerre: davant = top, darrere = bottom. Dret: davant = bottom, darrere = top.
    expect(byLabel(groove, "Lateral esquerre").edges.bottom).toBe(false)
    expect(byLabel(none, "Lateral esquerre").edges).toMatchObject({ top: true, bottom: true })
    expect(byLabel(none, "Lateral dret").edges).toMatchObject({ top: true, bottom: true })
    // Base: davant = bottom, darrere = top. Tapa (Sostre): davant = top, darrere = bottom.
    expect(byLabel(groove, "Base").edges.top).toBe(false)
    expect(byLabel(none, "Base").edges).toMatchObject({ top: true, bottom: true })
    expect(byLabel(none, "Sostre").edges).toMatchObject({ top: true, bottom: true })
    // Prestatges regulables: davant = bottom, darrere = top.
    const shelves = buildComposition(none).panels.filter((p) => p.role === "shelf")
    expect(shelves.length).toBeGreaterThan(0)
    for (const s of shelves) expect(s.edges).toMatchObject({ top: true, bottom: true })
  })

  it("arrambat a la paret o lliure tocant-la, sense fons, el darrere no es canteja", () => {
    expect(byLabel(comp(withBack("none", null)), "Lateral esquerre").edges.bottom).toBe(false)
    expect(byLabel(comp(withBack("none", 0)), "Base").edges.top).toBe(false)
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
