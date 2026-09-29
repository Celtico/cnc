import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { MODULE_PRESETS, modulePresetsFor } from "./modulePresets"

describe("mòduls especials per tipus", () => {
  it("tots construeixen sense avisos de distribució", () => {
    for (const p of MODULE_PRESETS) {
      const { panels, warnings } = buildComposition({ kind: p.kind, modules: [p.make()], references: [] })
      expect(panels.length, p.name).toBeGreaterThan(2)
      expect(warnings.filter((w) => w.code === "layout"), p.name).toEqual([])
    }
  })
  it("cada tipus en té", () => {
    for (const k of ["moble", "cuina", "armari", "taula"] as const) expect(modulePresetsFor(k).length, k).toBeGreaterThan(1)
  })
})
