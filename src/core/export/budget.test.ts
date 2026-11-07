import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { DEFAULT_CABINET, DEFAULT_SETTINGS, cabinetToComposition } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { budgetCsv, budgetPdf, priceOf, toBudget, withPrice } from "./budget"

const panels = buildComposition(cabinetToComposition({ ...DEFAULT_CABINET, doors: 2 })).panels
const base = DEFAULT_SETTINGS.prices

describe("toBudget", () => {
  it("sense preus, totes les files a 0 i el total a 0", () => {
    const b = toBudget(panels, base)
    expect(b.rows.length).toBeGreaterThan(0)
    expect(b.total).toBe(0)
    expect(b.rows.some((r) => r.key.kind === "material")).toBe(true)
    expect(b.rows.some((r) => r.key.kind === "edge")).toBe(true)
  })

  it("m² de tauler amb la merma, i subtotal + marge + IVA", () => {
    const mat = panels[0]!
    const key = { kind: "material" as const, material: mat.material, thickness: mat.thickness }
    let prices = withPrice({ ...base, waste: 10, margin: 20, vat: 21 }, key, 20)
    prices = withPrice(prices, { kind: "edge" }, 1)
    expect(priceOf(prices, key)).toBe(20)
    const b = toBudget(panels, prices)
    const m2 = panels.filter((p) => p.material === mat.material && p.thickness === mat.thickness && p.role !== "hardware").reduce((a, p) => a + (p.length * p.width) / 1e6, 0)
    const row = b.rows.find((r) => r.key.kind === "material" && r.concept.includes(mat.material) && r.key.thickness === mat.thickness)!
    expect(row.qty).toBeCloseTo(m2 * 1.1, 1)
    expect(b.subtotal).toBeCloseTo(b.rows.reduce((a, r) => a + r.amount, 0), 1)
    expect(b.margin).toBeCloseTo(b.subtotal * 0.2, 1)
    expect(b.total).toBeCloseTo((b.subtotal + b.margin) * 1.21, 1)
  })

  it("taulers sencers del nesting i ferratges sumats pel nom", () => {
    const nesting = nest(panels, DEFAULT_NEST_OPTIONS)
    const b = toBudget(panels, { ...base, wholeSheets: true }, {
      nesting,
      hardware: [{ component: "a", name: "Frontissa", qty: 2 }, { component: "a", name: "Frontissa", qty: 2 }],
    })
    const sheetM2 = (DEFAULT_NEST_OPTIONS.sheet.w * DEFAULT_NEST_OPTIONS.sheet.h) / 1e6
    const mats = b.rows.filter((r) => r.key.kind === "material")
    expect(mats.reduce((a, r) => a + r.qty, 0)).toBeCloseTo(nesting.boards.length * sheetM2, 1)
    expect(b.rows.find((r) => r.key.kind === "hardware")).toMatchObject({ concept: "Frontissa", qty: 4 })
  })
})

describe("budgetCsv i budgetPdf", () => {
  const prices = withPrice(base, { kind: "hole" }, 0.15)
  const b = toBudget(panels, prices)
  it("CSV amb BOM, capçalera i total", () => {
    const csv = budgetCsv(b, prices)
    expect(csv.startsWith("﻿Concepte;Quantitat;Unitat;Preu (€);Import (€)")).toBe(true)
    expect(csv).toContain("Total;;;;")
  })
  it("PDF A4", () => {
    const pdf = Array.from(budgetPdf(b, prices, { project: "Prova" }), (c) => String.fromCharCode(c)).join("")
    expect(pdf.startsWith("%PDF-1.4")).toBe(true)
    expect(pdf).toContain("/MediaBox [0 0 595.276 841.89]")
    expect(pdf).toContain("(Pressupost)")
  })
})
