import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES } from "../model"
import { buildComposition } from "./buildComposition"

describe("plantilles vitrina", () => {
  for (const id of ["wave-console", "sideboard-iron", "floating-tv", "bath-vanity", "flatpack-desk"]) {
    it(id, () => {
      const t = BUILTIN_TEMPLATES.find((x) => x.id === id)!
      const b = buildComposition(t.make())
      expect(b.warnings.filter((w) => ["layout", "collision", "ref-cut"].includes(w.code))).toEqual([])
      expect(b.panels.length + b.extras.length).toBeGreaterThan(2)
    })
  }
})
