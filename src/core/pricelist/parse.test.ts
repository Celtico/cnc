import { describe, expect, it } from "vitest"
import { boardAreaOf, budgetPriceFrom, itemsToLines, parsePriceList, searchPriceLists, supplierFromFile, toNum, type PdfLine, type PriceList } from "./parse"

const L = (page: number, cells: string[], xs: number[], h = 9): PdfLine => ({ page, h, cells, xs })

describe("tarifes", () => {
  it("llegeix números de tarifa", () => {
    expect(toNum("1.234,56")).toBe(1234.56)
    expect(toNum("1 234,56")).toBe(1234.56)
    expect(toNum("12.50")).toBe(12.5)
    expect(toNum("3,2")).toBe(32)
  })

  it("agrupa els trossos en línies i cel·les", () => {
    const lines = itemsToLines(1, [
      { s: "Frontissa", x: 10, y: 700, w: 40, h: 9 },
      { s: "110°", x: 52, y: 700.5, w: 18, h: 9 },
      { s: "12,30", x: 300, y: 700, w: 20, h: 9 },
      { s: "Segona", x: 10, y: 680, w: 30, h: 9 },
    ])
    expect(lines.map((l) => l.cells)).toEqual([["Frontissa 110°", "12,30"], ["Segona"]])
    expect(lines[0]!.xs).toEqual([10, 300])
  })

  it("treu files amb referència, preu, unitat de la capçalera, capítol i títol", () => {
    const lines = [
      L(1, ["FRONTISSES"], [40], 14),
      L(1, ["Frontissa clip 110°"], [40], 12),
      L(1, ["Referència", "Acabat", "Preu €/u"], [40, 200, 400]),
      L(1, ["311.04.500", "niquelat", "4,85"], [40, 200, 400]),
      L(1, ["311.04.501", "negre", "5,20 €"], [40, 200, 400]),
      L(2, ["TAULERS"], [40], 14),
      L(2, ["Melamina blanca 19 mm 2800x2070", "Preu tauler"], [40, 400]),
      L(2, ["MB19-2800", "Blanc", "42,00"], [40, 200, 400]),
    ]
    const p = parsePriceList(lines)
    expect(p.rows).toHaveLength(3)
    expect(p.rows[0]).toMatchObject({ ref: "311.04.500", price: 4.85, unit: "u", page: 1 })
    expect(p.rows[0]!.desc).toContain("niquelat")
    expect(p.chapters[p.rows[0]!.chap]).toBe("FRONTISSES")
    expect(p.titles[p.rows[0]!.title]).toBe("Frontissa clip 110°")
    expect(p.rows[2]).toMatchObject({ ref: "MB19-2800", price: 42, unit: "tauler" })
    expect(p.chapters[p.rows[2]!.chap]).toBe("TAULERS")
  })

  it("fa servir els marcadors del PDF com a capítols", () => {
    const p = parsePriceList([L(3, ["A-1234", "Tirador", "2,00"], [0, 100, 300])], [{ title: "Tiradors", page: 2 }])
    expect(p.chapters).toEqual(["Tiradors"])
  })

  const list = (o: Partial<PriceList>): PriceList => ({ id: "t", supplier: "Prov", file: "f.pdf", discount: 0, createdAt: 0, chapters: ["C"], titles: [""], rows: [], ...o })

  it("busca a totes les tarifes: primer la referència exacta, després el més barat", () => {
    const a = list({ id: "a", supplier: "A", discount: 50, rows: [{ ref: "X1", desc: "frontissa 110 niquel", price: 10, unit: "u", page: 1, chap: 0, title: 0 }] })
    const b = list({ id: "b", supplier: "B", rows: [{ ref: "FR110", desc: "Frontissa 110°", price: 6, unit: "u", page: 1, chap: 0, title: 0 }] })
    expect(searchPriceLists([a, b], "frontissa 110").map((h) => h.list.supplier)).toEqual(["A", "B"])
    expect(searchPriceLists([a, b], "fr110")[0]!.list.supplier).toBe("B")
    expect(searchPriceLists([a, b], "x")).toEqual([])
  })

  it("passa el preu per tauler a €/m² amb la mida de la descripció o la del nesting", () => {
    expect(boardAreaOf("Tauler 2.800 × 2.070 mm")).toBeCloseTo(5.796)
    expect(boardAreaOf("19 x 2800")).toBeNull()
    const l = list({ discount: 10, rows: [] })
    const withSize = { ref: "", desc: "2800x2070", price: 57.96, unit: "tauler", page: 1, chap: 0, title: 0 }
    expect(budgetPriceFrom({ list: l, row: withSize }, { unit: "m²" }).price).toBe(9)
    const noSize = { ...withSize, desc: "blanc" }
    expect(budgetPriceFrom({ list: l, row: noSize }, { unit: "m²", boardArea: 2 }).price).toBe(26.08)
    expect(budgetPriceFrom({ list: l, row: { ...noSize, unit: "m2" } }, { unit: "m²", boardArea: 2 }).price).toBe(52.16)
    expect(budgetPriceFrom({ list: l, row: noSize }, { unit: "u" }).note).toContain("−10%")
  })

  it("suggereix el proveïdor pel nom del fitxer", () => {
    expect(supplierFromFile("Tarifa_Hafele-2026.pdf")).toBe("Hafele")
    expect(supplierFromFile("precios emuca 2026.pdf", ["Emuca"])).toBe("Emuca")
  })
})
