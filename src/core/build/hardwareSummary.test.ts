import { describe, expect, it } from "vitest"
import { buildComposition } from "./buildComposition"
import { ruleHardwareCounts } from "./hardwareSummary"
import { cabinetToModule, DEFAULT_CABINET, defaultModule, type Composition, type HardwareItem, type HardwarePlacement } from "../model"

describe("ferratges de les regles d'un mòdul (resum de l'inspector)", () => {
  it("una porta: frontisses i tirador; amb potes, quatre", () => {
    const m = cabinetToModule({ ...DEFAULT_CABINET, doors: 1, shelves: 1 }, "m1", "Baix")
    const b = buildComposition({ modules: [m], references: [] })
    const counts = ruleHardwareCounts(b.panels.filter((p) => p.id.startsWith("m1:")), 4)
    const by = Object.fromEntries(counts.map((c) => [c.id, c.count]))
    expect(by.hinge).toBeGreaterThanOrEqual(2)
    expect(by.handle).toBe(1)
    expect(by.leg).toBe(4)
    // Res que no hi és.
    expect(by.slide).toBeUndefined()
    expect(counts.every((c) => c.count > 0)).toBe(true)
  })
  it("sense res, llista buida", () => {
    expect(ruleHardwareCounts([])).toEqual([])
  })
})

describe("ferratges col·locats al 3D", () => {
  const item: HardwareItem = {
    id: "hw-x",
    name: "Accessori",
    category: "misc",
    engine: "model",
    params: {},
    targets: [{ key: "model", label: "Només 3D", ops: [] }],
    version: 1,
    imported: { maker: "Blum", article: "X1", folders: [], files: [], proposed: [], confirmed: false, bbox: { min: [-10, -10, 0], max: [10, 10, 5] } },
    machining: [{ id: "d1", part: "top", kind: "drill", face: "A", d: 5, depth: 10, p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 } }],
  } as HardwareItem
  const pl: HardwarePlacement = { id: "pl-7", item, targets: [{ part: "top", module: "m1", panel: "top" }], p: { from: "center", at: 0 }, q: { from: "center", at: 0 } }
  const comp: Composition = { modules: [defaultModule("m1", "Baix")], references: [], hardwarePlacements: [pl] }

  it("el model porta l'id del col·locat (per triar-lo al 3D)", () => {
    const top = buildComposition(comp).panels.find((p) => p.id === "m1:top")!
    expect(top.fittings?.[0]).toMatchObject({ kind: "item", placement: "pl-7" })
  })
  it("importat sense confirmar: el model es veu però cap forat", () => {
    const top = buildComposition(comp).panels.find((p) => p.id === "m1:top")!
    expect(top.holes.some((h) => h.tag === "fitting")).toBe(false)
    expect(top.fittings?.length).toBe(1)
  })
})
