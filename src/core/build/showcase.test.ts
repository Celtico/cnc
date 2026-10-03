import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES } from "../model"
import { buildComposition } from "./buildComposition"

describe("plantilles vitrina", () => {
  for (const id of ["sideboard-iron", "floating-tv", "bath-vanity", "kitchen-island", "walk-in-wardrobe", "flatpack-desk", "tv-long", "bookcase-black", "bunk-beds", "walnut-console", "walnut-floating", "coffee-cube", "oak-kitchen"]) {
    it(id, () => {
      const t = BUILTIN_TEMPLATES.find((x) => x.id === id)!
      const b = buildComposition(t.make())
      expect(b.warnings.filter((w) => ["layout", "collision", "ref-cut"].includes(w.code))).toEqual([])
      expect(b.panels.length + b.extras.length).toBeGreaterThan(2)
    })
  }
})

describe("barres de penjar", () => {
  it("el vestidor fa 3 barres d'inox, fora del nesting, de lateral a lateral", () => {
    const b = buildComposition(BUILTIN_TEMPLATES.find((x) => x.id === "walk-in-wardrobe")!.make())
    const rails = b.extras.filter((p) => p.label === "Barra de penjar")
    expect(rails).toHaveLength(3)
    expect(rails.every((p) => p.material === "Acer inox" && p.outline)).toBe(true)
    expect(rails[0]!.thickness).toBeGreaterThan(900)
    expect(b.panels.some((p) => p.label === "Barra de penjar")).toBe(false)
    expect(b.warnings.filter((w) => w.code === "rail")).toEqual([])
  })
})

describe("front d'una zona dividida", () => {
  it("les portes de l'armari tapen el penjador i el maleter (de dalt a baix)", () => {
    const comp = BUILTIN_TEMPLATES.find((x) => x.id === "walk-in-wardrobe")!.make()
    const b = buildComposition(comp)
    const doors = b.panels.filter((p) => p.module === 1 && p.role === "door")
    expect(doors).toHaveLength(2)
    // Gairebé tota l'alçada (2280 − sòcol 80), i sense passar dels 2.200 recomanats.
    const tallest = Math.max(...doors.map((d) => Math.max(d.length, d.width)))
    expect(tallest).toBeGreaterThan(2100)
    expect(tallest).toBeLessThanOrEqual(2200)
  })
})

describe("peça enganxada a un mòdul", async () => {
  const { moveModuleBy, resolveParts } = await import("../model")
  it("el taulell de pedra segueix l'illa quan es mou", () => {
    const comp = BUILTIN_TEMPLATES.find((x) => x.id === "kitchen-island")!.make()
    const island = comp.modules.at(-1)!
    const before = resolveParts(comp)[0]!
    expect([before.x, before.y, before.z]).toEqual([550, 870, 1540])
    const after = resolveParts(moveModuleBy(comp, island.id, 200, 0, 100))[0]!
    expect([after.x, after.z]).toEqual([750, 1640])
  })
})
