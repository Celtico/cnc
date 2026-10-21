import { describe, expect, it } from "vitest"
import { addCompositionModules, defaultModule, modulePlacements, STORE_TEMPLATES, type Composition } from "."

const base = (): Composition => ({ kind: "moble", modules: [{ ...defaultModule("a", "A", { width: 800 }), gapBefore: 0 }], references: [] })

describe("afegir un moble fet com a mòduls", () => {
  it("un mòdul de fila va a continuació, sense grup, amb id nou", () => {
    const src = base()
    const r = addCompositionModules(base(), src, "Calaixera")
    expect(r.comp.modules).toHaveLength(2)
    expect(r.comp.modules[1]!.id).not.toBe("a")
    expect(r.comp.modules[1]!.group).toBeUndefined()
    expect(modulePlacements(r.comp)[1]!.x).toBeCloseTo(800, 0)
  })
  it("un moble de diversos mòduls: tots, en un grup amb el seu nom, i el que hi havia no canvia", () => {
    const t = STORE_TEMPLATES.find((x) => x.make().modules.length >= 2)!
    const src = t.make()
    const here = base()
    const r = addCompositionModules(here, src, t.name)
    expect(r.comp.modules).toHaveLength(1 + src.modules.length)
    expect(r.comp.modules[0]).toEqual(here.modules[0])
    expect(new Set(r.comp.modules.slice(1).map((m) => m.group))).toEqual(new Set([t.name]))
    expect(new Set(r.comp.modules.map((m) => m.id)).size).toBe(r.comp.modules.length)
  })
})
