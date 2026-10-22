import { describe, expect, it } from "vitest"
import { STORE_CATALOG, STORE_TEMPLATES } from "../model"
import { CompositionSchema } from "../model"
import { buildComposition } from "./buildComposition"
import { DESIGN_ERRORS } from "./designErrors"

describe("plantilles per a botigues de mobles", () => {
  it("13 categories, 3 dissenys per tipus i ids únics", () => {
    expect(STORE_CATALOG).toHaveLength(13)
    for (const c of STORE_CATALOG) for (const t of c.types) expect(t.items).toHaveLength(3)
    expect(new Set(STORE_TEMPLATES.map((t) => t.id)).size).toBe(STORE_TEMPLATES.length)
  })
  for (const t of STORE_TEMPLATES)
    it(t.name, () => {
      const comp = t.make()
      expect(CompositionSchema.safeParse(comp).success).toBe(true)
      const b = buildComposition(comp)
      expect(b.warnings.filter((w) => DESIGN_ERRORS.includes(w.code)).map((w) => `${w.code}: ${w.message}`)).toEqual([])
      expect(b.panels.length + b.extras.length).toBeGreaterThan(0)
    })
})
