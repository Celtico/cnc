import { describe, expect, it } from "vitest"
import { buildModule } from "../../core/build/buildModule"
import { defaultModule, HardwarePlacementSchema, type Composition, type HardwarePlacement } from "../../core/model"
import { duplicatePlacement, PLACEMENT_COPY_SHIFT, placementAdvanced, placementScope, placePosValue, removePlacement, simplifyPlacement } from "./placements"

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

describe("col·locats avançats d'una versió anterior: es llegeixen igual i es poden simplificar", () => {
  const panel = buildModule(defaultModule("m1", "Baix")).panels.find((p) => p.role === "top")!
  it("un de simple no és avançat i no canvia", () => {
    const a = pl("a")
    expect(placementAdvanced(a)).toEqual([])
    expect(simplifyPlacement(a, panel)).toBe(a)
  })
  it("repetició, mirall, gir i fórmula surten com a «avançat»; simplificar deixa una sola posició, la d'ara, des de l'inici", () => {
    const adv: HardwarePlacement = { ...pl("a"), p: { from: "min", at: 0, expr: "M/4" }, q: { from: "ratio", at: 0, pct: 50 }, repeat: { axis: "p", count: 3, spacing: 100, layout: "step" }, mirror: true, turn: 90 }
    expect(HardwarePlacementSchema.safeParse(adv).success).toBe(true)
    const txt = placementAdvanced(adv)
    expect(txt.some((t) => /repetició/.test(t))).toBe(true)
    expect(txt.some((t) => /mirall/.test(t))).toBe(true)
    expect(txt.some((t) => /gir del model 90/.test(t))).toBe(true)
    expect(txt.some((t) => /M\/4/.test(t))).toBe(true)
    const s = simplifyPlacement(adv, panel)
    expect(s.repeat).toBeUndefined()
    expect(s.mirror).toBeUndefined()
    expect(s.turn).toBeUndefined()
    expect(s.p).toEqual({ from: "min", at: panel.length / 4 })
    expect(s.q).toEqual({ from: "min", at: panel.width / 2 })
    expect(placementAdvanced(s)).toEqual([])
    // On cau no canvia.
    expect(placePosValue(s.p, panel, "p")).toBe(placePosValue(adv.p, panel, "p"))
    expect(placePosValue(s.q, panel, "q")).toBe(placePosValue(adv.q, panel, "q"))
  })
  it("sense la peça (o fórmula dolenta), es queda la distància que tenia", () => {
    const adv: HardwarePlacement = { ...pl("a"), p: { from: "max", at: 30, expr: "L +" }, mirror: true }
    const s = simplifyPlacement(adv, undefined)
    expect(s.p).toEqual({ from: "max", at: 30 })
    expect(s.mirror).toBeUndefined()
  })
})
