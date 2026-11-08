import { describe, expect, it } from "vitest"
import { buildComposition } from "../../core/build/buildComposition"
import { DEFAULT_SETTINGS } from "../../core/model"
import { cabModule, DEF } from "./nouMobleModels"

describe("Nou moble: la unió de la caixa (cel, 2026-11-08)", () => {
  const holes = (union: typeof DEF.union) => buildComposition({ modules: [cabModule({ ...DEF, union }, DEFAULT_SETTINGS, "Buc")], references: [] }).panels.flatMap((p) => p.holes)
  it("surt amb Cabineo, com al Taulell", () => {
    expect(cabModule(DEF, DEFAULT_SETTINGS, "Buc").hardware?.dowel?.engine).toBe("cabineo")
    expect(holes("cabineo").some((h) => h.tag === "cabineo")).toBe(true)
    // A tots els llocs la mateixa unió (també el fons): cap espiga.
    expect(holes("cabineo").filter((h) => h.tag === "dowel")).toEqual([])
  })
  it("també amb cargols o clavilles", () => {
    expect(holes("screw").some((h) => h.tag === "screw")).toBe(true)
    expect(holes("dowel").some((h) => h.tag === "cabineo" || h.tag === "screw")).toBe(false)
  })
})
