import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type HardwarePlacement } from "../../core/model"
import { duplicatePlacement, PLACEMENT_COPY_SHIFT, placementScope, removePlacement } from "./placements"

const pl = (id: string, from: "min" | "max" | "center" = "min"): HardwarePlacement =>
  ({ id, item: { id: "hw", name: "X", category: "misc", engine: "model", params: {}, targets: [{ key: "model", label: "", ops: [] }], version: 1 }, targets: [{ part: "top", module: "m1", panel: "top" }], p: { from, at: 100 }, q: { from: "min", at: 0 } }) as HardwarePlacement

describe("col·locats: duplicar i eliminar (3D, llista i teclat)", () => {
  const comp: Composition = { modules: [defaultModule("m1", "Baix")], references: [], hardwarePlacements: [pl("a"), pl("b", "max")] }
  it("la còpia va just després, amb un id nou i desplaçada cap a dins", () => {
    const r = duplicatePlacement(comp, "a")!
    expect(r.comp.hardwarePlacements!.map((p) => p.id)).toEqual(["a", r.id, "b"])
    expect(r.id).not.toBe("a")
    expect(r.comp.hardwarePlacements![1]!.p.at).toBe(100 + PLACEMENT_COPY_SHIFT)
    // L'original no es toca.
    expect(comp.hardwarePlacements![0]!.p.at).toBe(100)
    expect(duplicatePlacement(comp, "nope")).toBeNull()
  })
  it("eliminar l'últim treu el camp (el .moble torna a la versió d'abans)", () => {
    const one = removePlacement(comp, "a")
    expect(one.hardwarePlacements!.map((p) => p.id)).toEqual(["b"])
    expect("hardwarePlacements" in removePlacement(one, "b")).toBe(false)
  })
  it("l'àmbit és el mòdul o la peça lliure de la peça principal", () => {
    expect(placementScope(pl("a"))).toEqual({ kind: "module", moduleId: "m1" })
    expect(placementScope({ ...pl("a"), targets: [{ part: "part", freePart: "p1" }] })).toEqual({ kind: "part", partId: "p1" })
  })
})
