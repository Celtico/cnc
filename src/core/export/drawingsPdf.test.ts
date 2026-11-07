import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { DEFAULT_CABINET, cabinetToComposition } from "../model"
import { drawingsPdf } from "./drawingsPdf"

const panels = buildComposition(cabinetToComposition({ ...DEFAULT_CABINET, doors: 2 })).panels
const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("")

describe("drawingsPdf", () => {
  const r = drawingsPdf(panels, { project: "Prova", date: new Date("2026-11-07") })
  const pdf = latin1(r.bytes)

  it("una pàgina pel moble i una per peça diferent, en A4 apaïsat", () => {
    expect(r.pages).toBe(1 + r.pieces)
    expect(r.pieces).toBeGreaterThan(0)
    expect(r.pieces).toBeLessThanOrEqual(panels.filter((p) => p.role !== "hardware").length)
    expect(pdf).toContain(`/Count ${r.pages}`)
    expect(pdf.match(/\/MediaBox \[0 0 841\.89 595\.276\]/g)).toHaveLength(r.pages)
  })

  it("les peces iguals van juntes, amb totes les refs", () => {
    const twins = buildComposition(cabinetToComposition({ ...DEFAULT_CABINET, shelves: 3 })).panels
    const shelves = twins.filter((p) => p.role === "shelf")
    expect(shelves.length).toBe(3)
    const d = drawingsPdf(twins, { project: "x" })
    expect(d.pieces).toBeLessThan(twins.filter((p) => p.role !== "hardware").length)
  })

  it("porta les vistes, les mides generals i la xref bona", () => {
    expect(pdf).toContain("(Alçat)")
    expect(pdf).toContain("(Planta)")
    const xref = Number(/startxref\n(\d+)/.exec(pdf)![1])
    expect(pdf.slice(xref, xref + 4)).toBe("xref")
    const offsets = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    offsets.forEach((o, i) => expect(pdf.slice(o).startsWith(`${i + 1} 0 obj`)).toBe(true))
  })
})
