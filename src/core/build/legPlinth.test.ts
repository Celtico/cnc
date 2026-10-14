import { it, expect } from "vitest"
import { HAFELE_LEGS } from "../model/hafele/hafeleLegs"
import { defaultModule, newId, type Composition } from "../model"
import { buildComposition, buildBounds } from "./buildComposition"
it("al moble, el sòcol de cada mòdul amb potes va de terra (y = 0) i no fa xocar els mòduls", () => {
  const m = defaultModule("m", "x")
  const mod = { ...m, carcass: { ...m.carcass, base: { kind: "legs" as const, height: 100, hardware: structuredClone(HAFELE_LEGS[0]!), plinth: { setback: 20 } } } }
  const comp = { id: newId(), name: "t", modules: [mod, { ...mod, id: "m2" }], references: [], parts: [], models: [] } as unknown as Composition
  const b = buildComposition(comp)
  const pl = b.panels.filter((p) => p.role === "plinth")
  expect(pl).toHaveLength(2)
  expect(Math.min(...pl.map((p) => p.placement.origin[1]))).toBeCloseTo(0, 1)
  expect(buildBounds(b).min[1]).toBeCloseTo(0, 1)
  expect(b.warnings.map((w) => w.code)).not.toContain("overlap")
})
