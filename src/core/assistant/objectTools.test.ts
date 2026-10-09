import { describe, expect, it } from "vitest"
import { CompositionSchema, DEFAULT_SETTINGS, partBox, type Composition } from "../model"
import { ellipse, objectComposition, roundRect } from "../model/objectShapes"
import { objectPayload, objectToolSet, OBJECT_TOOL_INPUTS, partShapeKind, runObjectTool } from "./objectTools"
import type { ToolRun } from "./toolset"

const ctx = { settings: DEFAULT_SETTINGS }
const blank = (): Composition => objectComposition([])
const sim = DEFAULT_SETTINGS.materials.find((m) => m.category === "sim")!.name

function ok(comp: Composition, name: string, input: unknown): Extract<ToolRun<Composition>, { ok: true }> {
  const r = runObjectTool(comp, name, input, ctx)
  if (!r.ok) throw new Error(`${name}: ${r.error}`)
  expect(CompositionSchema.safeParse(r.doc).success).toBe(true)
  return r
}
function err(comp: Composition, name: string, input: unknown): string {
  const r = runObjectTool(comp, name, input, ctx)
  expect(r.ok).toBe(false)
  return r.ok ? "" : r.error
}

describe("assistent IA: eines dels objectes", () => {
  it("les definicions són JSON Schema d'objecte amb descripció", () => {
    const set = objectToolSet(ctx)
    expect(set.tools.map((t) => t.name)).toEqual(Object.keys(OBJECT_TOOL_INPUTS))
    for (const t of set.tools) {
      expect(t.input_schema.type).toBe("object")
      expect(t.description.length).toBeGreaterThan(10)
    }
    expect(set.system).toContain("no es fabrica")
  })

  it("add_part: una tauleta rodona (tauler en cercle sobre un peu), sense nesting i amb el material de Preferències", () => {
    let c = blank()
    const top = ok(c, "add_part", { name: "Sobre", orient: "flat", w: 500, h: 500, thickness: 20, x: 0, y: 430, z: 0, material: sim.toUpperCase(), shape: { kind: "circle" } })
    c = top.doc
    c = ok(c, "add_part", { name: "Peu", orient: "flat", w: 60, h: 60, thickness: 430, x: 220, z: 220, material: sim, shape: { kind: "circle" }, group: "Tauleta" }).doc
    const p = c.parts!.find((x) => x.id === top.result.part_id)!
    expect(p.material).toBe(sim)
    expect(p.nest).toBe(false)
    expect(p.shape).toEqual(ellipse(500, 500))
    expect(partShapeKind(p)).toEqual({ kind: "circle" })
    const s = objectPayload("get_object", { doc: c, result: {} }, ctx)
    expect(s.object.size).toEqual({ w: 500, h: 450, d: 500 })
    expect(s.object.parts.map((x) => [x.name, x.shape, x.group ?? null])).toEqual([["Sobre", "circle", null], ["Peu", "circle", "Tauleta"]])
    expect(s.materials!.simulation).toContain(sim)
    expect(s.object.groups).toEqual(["Tauleta"])
  })

  it("errors en català: material que no hi és, peça que no hi és, radi que no hi cap, sota terra", () => {
    const c = ok(blank(), "add_part", { orient: "front", w: 400, h: 300, thickness: 18, x: 0, z: 0, material: sim }).doc
    expect(err(c, "add_part", { orient: "front", w: 400, h: 300, thickness: 18, x: 0, z: 0, material: "Kriptonita" })).toContain("no és a Preferències")
    expect(err(c, "update_part", { part: "p-x", w: 10 })).toContain("No hi ha cap peça")
    expect(err(c, "update_part", { part: "Peça 1", shape: { kind: "rounded", radius: 200 } })).toContain("no hi cap")
    expect(err(c, "add_part", { orient: "front", w: 400, h: 300, thickness: 18, x: 0, y: -5, z: 0, material: sim })).toContain("Entrada no vàlida")
    expect(err(c, "fly", {})).toContain("Eina desconeguda")
  })

  it("update_part: la forma arrodonida es refà a la mida nova amb el mateix radi; reorientar conserva el centre", () => {
    let c = ok(blank(), "add_part", { name: "Coixí", orient: "flat", w: 450, h: 450, thickness: 120, x: 0, y: 400, z: 0, material: sim, shape: { kind: "rounded", radius: 60 } }).doc
    c = ok(c, "update_part", { part: "Coixí", w: 600 }).doc
    const p = c.parts![0]!
    expect(p.shape).toEqual(roundRect(600, 450, 60))
    expect(partShapeKind(p)).toEqual({ kind: "rounded", radius: 60 })
    const before = partBox(p)
    c = ok(c, "update_part", { part: p.id, orient: "front" }).doc
    const after = partBox(c.parts![0]!)
    for (const a of [0, 2]) expect((after.min[a]! + after.max[a]!) / 2).toBeCloseTo((before.min[a]! + before.max[a]!) / 2, 0)
    c = ok(c, "update_part", { part: p.id, shape: { kind: "rectangle" }, group: "Sofà" }).doc
    expect(c.parts![0]!.shape).toBeUndefined()
    expect(c.parts![0]!.group).toBe("Sofà")
    c = ok(c, "update_part", { part: p.id, group: null }).doc
    expect(c.parts![0]!.group).toBeUndefined()
  })

  it("duplicate_part, set_group, move_group (no baixa de terra), duplicate_group i remove_part", () => {
    let c = ok(blank(), "add_part", { name: "Pota", orient: "flat", w: 40, h: 40, thickness: 400, x: 0, z: 0, material: sim }).doc
    const id = c.parts![0]!.id
    const d = ok(c, "duplicate_part", { part: id, dx: 460 })
    c = d.doc
    expect(c.parts!.map((p) => [p.x, p.z])).toEqual([[0, 0], [460, 0]])
    // Dues peces es diuen «Pota (còpia)» / «Pota»: pel nom, la única.
    c = ok(c, "set_group", { parts: [id, String(d.result.part_id)], group: "Potes" }).doc
    c = ok(c, "move_group", { group: "Potes", dy: -50, dz: 30 }).doc
    expect(c.parts!.map((p) => [p.y, p.z])).toEqual([[0, 30], [0, 30]])
    const g = ok(c, "duplicate_group", { group: "Potes" })
    expect(g.result.group).toBe("Potes (còpia)")
    c = g.doc
    expect(c.parts).toHaveLength(4)
    expect(err(c, "move_group", { group: "Res", dx: 1 })).toContain("No hi ha cap grup")
    c = ok(c, "remove_part", { part: id }).doc
    expect(c.parts).toHaveLength(3)
  })
})
