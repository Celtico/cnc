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
  it("els buidats, a la cara que no es veu (com al Taulell): base per sota, travessers per sobre, fons pel darrere", () => {
    const b = buildComposition({ modules: [cabModule(DEF, DEFAULT_SETTINGS, "Buc")], references: [] }).panels
    const out = (role: string, axis: number, sign: number) => {
      const ps = b.filter((p) => p.role === role)
      const hs = ps.flatMap((p) => p.holes.filter((h) => h.tag === "cabineo" && h.diameter === 15).map((h) => (h.face === "A" ? 1 : -1) * p.placement.zAxis[axis]! * sign))
      return hs.length > 0 && hs.every((v) => v > 0)
    }
    expect(out("bottom", 1, -1)).toBe(true)
    expect(out("top", 1, 1)).toBe(true)
    expect(out("back", 2, -1)).toBe(true)
  })
  it("també amb cargols o clavilles", () => {
    expect(holes("screw").some((h) => h.tag === "screw")).toBe(true)
    expect(holes("dowel").some((h) => h.tag === "cabineo" || h.tag === "screw")).toBe(false)
  })
})
