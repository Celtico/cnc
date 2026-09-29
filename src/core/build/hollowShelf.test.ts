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

describe("prestatges a ras del davant", () => {
  it("sense retranqueig: el cantell enrasat amb la caixa", () => {
    const m = defaultModule("m", "M", { width: 600, height: 700, depth: 400 })
    const shelfZ = (flush: boolean) => {
      const b = buildModule({ ...m, root: { ...m.root, shelves: { n: 1, adjustable: false, flush } } })
      return b.panels.find((p) => p.role === "shelf")!.placement.origin[2]
    }
    expect(shelfZ(true)).toBe(400)
    expect(shelfZ(false)).toBeLessThan(400)
  })
})

describe("a ras amb fronts encastats", () => {
  const m = defaultModule("m", "M", { width: 600, height: 700, depth: 400 })
  const inset = { ...m, fronts: { ...m.fronts, style: "inset" as const } }
  const z = (front?: { kind: "door"; mode: "single"; hinge: "left" }) => {
    const b = buildModule({ ...inset, root: { ...inset.root, shelves: { n: 1, adjustable: false, flush: true }, ...(front ? { front } : {}) } })
    return { z: b.panels.find((p) => p.role === "shelf")!.placement.origin[2], warn: b.warnings.some((w) => w.code === "inset" && w.message.includes("ras")) }
  }
  it("compartiment obert: a ras, encara que el mòdul tingui fronts encastats", () => {
    expect(z()).toEqual({ z: 400, warn: false })
  })
  it("amb porta encastada: es retiren i avisa", () => {
    const r = z({ kind: "door", mode: "single", hinge: "left" })
    expect(r.z).toBeLessThan(400)
    expect(r.warn).toBe(true)
  })
})
