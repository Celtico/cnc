import { describe, expect, it } from "vitest"
import { defaultModule, setSplitThickness, splitZone, type Module } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"

const overlap = (a: ReturnType<typeof panelBox>, b: ReturnType<typeof panelBox>) =>
  [0, 1, 2].every((i) => Math.min(a.max[i]!, b.max[i]!) - Math.max(a.min[i]!, b.min[i]!) > 0.5)

const split = (dir: "v" | "h", thickness: number | undefined): Module => {
  const m = defaultModule("m", "M", { width: 900, height: 900, depth: 400 })
  const root = setSplitThickness(splitZone(m.root, m.root.id, dir), m.root.id, thickness)
  return { ...m, root }
}

const hits = (mod: Module) => {
  const boxes = buildModule(mod).panels.filter((p) => p.role !== "back").map((p) => ({ p, b: panelBox(p) }))
  const out: string[] = []
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i]!.b, boxes[j]!.b)) out.push(`${boxes[i]!.p.id} × ${boxes[j]!.p.id}`)
  return out
}

describe("divisions gruixudes (buides)", () => {
  it("divisor vertical: dues pells, tira del davant i tres llistons, del gruix aparent", () => {
    const b = buildModule(split("v", 50))
    const ids = b.panels.map((p) => p.id)
    for (const id of ["divider-1", "divider-1-right", "divider-1-facing", "divider-1-spacer-back", "divider-1-spacer-bottom", "divider-1-spacer-top"]) expect(ids).toContain(id)
    expect(b.panels.find((p) => p.id === "divider-1-facing")!.width).toBe(50)
    expect(b.panels.find((p) => p.id === "divider-1-right")!.assembly).toBe("Divisor (buit)")
    const [a, c] = b.layout.leaves.map((z) => b.layout.rects.get(z.id)!)
    expect(c!.x0 - a!.x1).toBe(50)
    expect(hits(split("v", 50))).toEqual([])
  })

  it("divisió horitzontal: prestatge fix gruixut", () => {
    const b = buildModule(split("h", 60))
    expect(b.panels.filter((p) => p.role === "fixedShelf")).toHaveLength(2)
    expect(b.panels.find((p) => p.id === "fixed-1-facing")!.width).toBe(60)
    const [a, c] = b.layout.leaves.map((z) => b.layout.rects.get(z.id)!)
    expect(c!.y0 - a!.y1).toBe(60)
    expect(hits(split("h", 60))).toEqual([])
  })

  it("els fronts tapen mig divisor gruixut cadascun", () => {
    const m = split("v", 50)
    const kids = m.root.split!.children.map((z) => ({ ...z, front: { kind: "door" as const, mode: "single" as const, hinge: "left" as const } }))
    const b = buildModule({ ...m, root: { ...m.root, split: { ...m.root.split!, children: kids } } })
    const doors = b.panels.filter((p) => p.role === "door").map((p) => panelBox(p)).sort((p, q) => p.min[0]! - q.min[0]!)
    const mid = b.layout.rects.get(kids[0]!.id)!.x1 + 25
    expect(doors[0]!.max[0]!).toBeLessThan(mid)
    expect(doors[1]!.min[0]!).toBeGreaterThan(mid)
    expect(mid - doors[0]!.max[0]!).toBeLessThan(3)
  })

  it("massa prim per a dues pells: es fa massís i avisa", () => {
    const b = buildModule(split("v", 30))
    expect(b.panels.some((p) => p.id === "divider-1-right")).toBe(false)
    expect(b.warnings.some((w) => w.code === "hollow" && /massissos/.test(w.message))).toBe(true)
  })

  it("treure el gruix torna el divisor d'un tauler", () => {
    const m = split("v", 50)
    expect(setSplitThickness(m.root, m.root.id, undefined).split!.thickness).toBeUndefined()
  })
})
