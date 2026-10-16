import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type Island, type Module } from "../model"
import { buildComposition } from "./buildComposition"
import { panelBox } from "./geometry"

const mod = (id: string, wallGap: number, x = 0): Module => {
  const m = defaultModule(id, id)
  return { ...m, wallGap, x, root: { ...m.root, front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } } }
}
const island = (patch: Partial<Island> = {}): Island => ({ id: "i1", front: "F", back: "B", gap: 0, left: true, right: true, ...patch })
const comp = (isl?: Island): Composition => ({ kind: "moble", modules: [mod("F", 1500), mod("B", 0, 900)], references: [], ...(isl ? { islands: [isl] } : {}) })
const boxOf = (ps: ReturnType<typeof buildComposition>["panels"]) => {
  const lo = [0, 1, 2].map((k) => Math.min(...ps.map((p) => panelBox(p).min[k]!)))
  const hi = [0, 1, 2].map((k) => Math.max(...ps.map((p) => panelBox(p).max[k]!)))
  return { lo, hi }
}

describe("illa: mòduls d'esquena i panells de remat", () => {
  it("el de darrere es gira, va a la mateixa X i enganxat al darrere del de davant, sense solapar", () => {
    const b = buildComposition(comp(island({ left: false, right: false })))
    const F = boxOf(b.panels.filter((p) => p.module === 1))
    const B = boxOf(b.panels.filter((p) => p.module === 2))
    expect(B.lo[0]).toBeCloseTo(F.lo[0]!)
    // El darrere del de darrere toca el darrere del de davant (Z = 1500).
    expect(B.hi[2]).toBeCloseTo(F.lo[2]!)
    expect(b.panels.filter((p) => p.module === 2 && p.role === "drawerFront").every((p) => p.placement.explodeDir[2] < 0)).toBe(true)
    expect(b.warnings.some((w) => w.code === "overlap")).toBe(false)
    expect(b.warnings.some((w) => w.code === "island")).toBe(true)
  })

  it("amb pas de cables, separats `gap` mm", () => {
    const b = buildComposition(comp(island({ gap: 30, left: false, right: false })))
    expect(boxOf(b.panels.filter((p) => p.module === 1)).lo[2]! - boxOf(b.panels.filter((p) => p.module === 2)).hi[2]!).toBeCloseTo(30)
  })

  it("panells de remat d'una sola peça que cobreixen les dues files, amb cantell vist", () => {
    const b = buildComposition(comp(island()))
    const ends = b.panels.filter((p) => p.label.startsWith("Remat"))
    expect(ends.map((p) => p.label).sort()).toEqual(["Remat dret", "Remat esquerre"])
    const mods = boxOf(b.panels.filter((p) => (p.module ?? 0) <= 2))
    for (const e of ends) {
      const eb = panelBox(e)
      expect(eb.min[2]).toBeCloseTo(mods.lo[2]!)
      expect(eb.max[2]).toBeCloseTo(mods.hi[2]!)
      expect(eb.max[1] - eb.min[1]).toBeCloseTo(mods.hi[1]! - mods.lo[1]!)
      expect(e.thickness).toBe(19)
      expect(Object.values(e.edges).filter(Boolean)).toHaveLength(3)
    }
    const left = ends.find((p) => p.label === "Remat esquerre")!
    expect(panelBox(left).max[0]).toBeCloseTo(mods.lo[0]!)
  })

  it("sense illa, res no canvia; amb un mòdul que no hi és, l'illa no es fa", () => {
    const base = buildComposition(comp())
    expect(buildComposition({ ...comp(), islands: [island({ back: "nope" })] }).panels).toEqual(base.panels)
  })
})
