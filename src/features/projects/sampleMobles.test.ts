import { describe, expect, it } from "vitest"
import { buildComposition } from "../../core/build/buildComposition"
import { CompositionSchema, RANDOM_SHAPES } from "../../core/model"
import { sampleCategories } from "./sampleMobles"

describe("mostres de proves a Models constructius", () => {
  const cats = sampleCategories()
  it("una categoria per fitxer i una d'aleatoris i una de formes a l'atzar, ids únics", () => {
    expect(cats).toHaveLength(8)
    expect(cats.at(-2)!.items).toHaveLength(50)
    expect(cats.at(-1)!.items).toHaveLength(RANDOM_SHAPES)
    const ids = cats.flatMap((c) => c.items.map((t) => t.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it("cada mostra s'obre com un moble vàlid i es construeix", () => {
    for (const c of cats)
      for (const t of c.items) {
        const comp = t.make()
        expect(CompositionSchema.safeParse(comp).success, t.id).toBe(true)
        expect(comp.modules.length, t.id).toBeGreaterThan(0)
        buildComposition(comp)
      }
  }, 120_000)
})
