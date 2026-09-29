import { describe, expect, it } from "vitest"
import { defaultModule } from "../model"
import { buildModule } from "./buildModule"

describe("prestatges gruixuts (buits)", () => {
  it("dues pells, tira del davant i llistons, amb el gruix aparent", () => {
    const m = defaultModule("m", "M", { width: 900, height: 900, depth: 400 })
    const mod = { ...m, root: { ...m.root, shelves: { n: 2, adjustable: false, thickness: 50 } } }
    const b = buildModule(mod)
    const facings = b.panels.filter((p) => p.role === "facing")
    expect(facings).toHaveLength(2)
    expect(facings[0]!.width).toBe(50)
    expect(b.panels.filter((p) => p.role === "shelf")).toHaveLength(4)
    expect(b.panels.filter((p) => p.role === "spacer")).toHaveLength(6)
    expect(b.panels.find((p) => p.id === "shelf-1-top")!.assembly).toBe("Prestatge 1 (buit)")
    expect(b.warnings.some((w) => w.code === "shelf-span")).toBe(false)
  })
})
