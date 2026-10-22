import { describe, expect, it } from "vitest"
import { COMBO_TEMPLATES, CompositionSchema, JOINED_COMBOS, MODEL_COMBOS, visibleModule, withNeighbourSides, type Zone } from "../model"
import { buildComposition } from "./buildComposition"
import { DESIGN_ERRORS } from "./designErrors"

describe("models constructius", () => {
  it("unes 25 combinacions per categoria, amb ids únics", () => {
    for (const c of MODEL_COMBOS) expect(c.items.length, c.name).toBeGreaterThanOrEqual(8)
    expect(new Set(COMBO_TEMPLATES.map((t) => t.id)).size).toBe(COMBO_TEMPLATES.length)
  })
  for (const t of COMBO_TEMPLATES)
    it(t.id + " " + t.name, () => {
      const comp = t.make()
      expect(CompositionSchema.safeParse(comp).success).toBe(true)
      const b = buildComposition(comp)
      expect(b.warnings.filter((w) => DESIGN_ERRORS.includes(w.code)).map((w) => `${w.code}: ${w.message}`)).toEqual([])
      expect(b.panels.length).toBeGreaterThan(0)
    })
})

const fronts = (z: Zone): number => (z.front ? 1 : 0) + (z.split?.children.reduce((n, c) => n + fronts(c), 0) ?? 0)

describe("mobles junts", () => {
  for (const t of JOINED_COMBOS.flatMap((c) => c.items))
    it(`${t.id}: el veí fa de lateral i no es perd cap front`, () => {
      const comp = t.make()
      expect(comp.modules.some((m) => !m.carcass.sides.left || !m.carcass.sides.right)).toBe(true)
      const held = withNeighbourSides(comp)
      // Cada lateral que falta és aguantat pel veí.
      for (const m of held.modules) {
        const miss = [!m.carcass.sides.left && "left", !m.carcass.sides.right && "right"].filter(Boolean)
        expect(m.carcass.corner ?? null, m.name).toBe(miss.length === 2 ? "both" : miss[0] ?? null)
        expect(fronts(visibleModule(m).root), m.name).toBe(fronts(m.root))
      }
    })
})
