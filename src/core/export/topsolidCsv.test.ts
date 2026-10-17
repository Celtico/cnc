import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { DEFAULT_CABINET, cabinetToComposition, flatPackStool, flatten, type Panel } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { DEFAULT_LABEL, labelPoint } from "./labelPoint"
import { pointInPolygon } from "../model/polygon"
import { boardName, encodeUtf16le, localToBoard, TOPSOLID_CSV_HEADER, toTopsolidCsv } from "./topsolidCsv"

const panels = buildComposition(cabinetToComposition(DEFAULT_CABINET)).panels
const nesting = nest(panels, DEFAULT_NEST_OPTIONS)
const csv = toTopsolidCsv(panels, nesting, { project: "Prova" })
const lines = csv.text.split("\r\n").filter(Boolean)

describe("toTopsolidCsv", () => {
  it("capçalera exacta de TopSolid, CRLF i decimals amb punt", () => {
    expect(lines[0]).toBe(TOPSOLID_CSV_HEADER.join(";"))
    expect(csv.text).toContain("\r\n")
    expect(csv.text).not.toMatch(/\d,\d/)
  })

  it("una fila de tauler abans de les seves peces, amb material:LxAxG", () => {
    const boardRows = lines.slice(1).filter((l) => l.split(";")[3]!.includes(":"))
    expect(boardRows).toHaveLength(nesting.boards.length)
    const first = lines[1]!.split(";")
    expect(first[0]).toBe(boardName(nesting.boards[0]!.material, nesting.boards[0]!.thickness, 1))
    expect(first[3]).toBe(`${nesting.boards[0]!.material}:2800x2070x${nesting.boards[0]!.thickness}`)
    expect(first[4]).toBe("2800.0")
    expect(first[5]).toBe("2070.0")
    expect(first[14]).toBe("Prova")
    expect(first[15]).toBe("Configurador")
  })

  it("una fila per peça amb mides, ÍNDICE_3D únic i cantells", () => {
    const pieceRows = lines.slice(1).filter((l) => !l.split(";")[3]!.includes(":"))
    expect(pieceRows).toHaveLength(panels.length)
    const refs = pieceRows.map((l) => l.split(";")[19])
    expect(new Set(refs).size).toBe(panels.length)
    expect(refs.every((r) => /^A\.1\.[LHTF]\.\d+$/.test(r!))).toBe(true)
    const door = pieceRows.find((l) => l.split(";")[3] === "porta")!.split(";")
    expect([door[13], door[16], door[17], door[18]]).toEqual(["canto 1mm", "canto 1mm", "canto 1mm", "canto 1mm"])
    const back = pieceRows.find((l) => l.split(";")[3] === "trassera")!.split(";")
    expect([back[13], back[16], back[17], back[18]]).toEqual(["", "", "", ""])
  })

  it("l'etiqueta cau dins de la peça col·locada al tauler", () => {
    for (const row of csv.rows) {
      const board = nesting.boards.find((b) => b.placements.some((p) => p.panelId === row.panelId))!
      const pl = board.placements.find((p) => p.panelId === row.panelId)!
      expect(row.x).toBeGreaterThanOrEqual(pl.x)
      expect(row.x).toBeLessThanOrEqual(pl.x + pl.w)
      expect(row.y).toBeGreaterThanOrEqual(pl.y)
      expect(row.y).toBeLessThanOrEqual(pl.y + pl.h)
    }
  })

  it("nom de tauler amb guions baixos i numeració per material", () => {
    expect(boardName("Melamina blanca", 19, 1)).toBe("Melamina_blanca_19#01")
  })

  it("localToBoard gira 90° en sentit antihorari", () => {
    const pl = { panelId: "p", x: 100, y: 200, w: 50, h: 300, angle: 90 as const, cx: 0, cy: 0 }
    expect(localToBoard(pl, 0, 0)).toEqual({ x: 150, y: 200 })
    expect(localToBoard(pl, 300, 50)).toEqual({ x: 100, y: 500 })
  })

  it("`;`, `:` i salts de línia als textos no trenquen les columnes", () => {
    const named = panels.map((p, i) => (i === 0 ? { ...p, name: "Lateral 40;60" } : i === 1 ? { ...p, name: "Prestatge: dalt" } : i === 2 ? { ...p, name: "Línia\r\nnova" } : p))
    const mat = named.map((p) => ({ ...p, material: "Roure; nat:ural" }))
    const out = toTopsolidCsv(mat, nest(mat, DEFAULT_NEST_OPTIONS), { project: "Prova; v2", edgeText: "canto; 1mm" })
    const rows = out.text.split("\r\n").filter(Boolean)
    expect(rows).toHaveLength(1 + nesting.boards.length + panels.length)
    for (const r of rows) expect(r.split(";")).toHaveLength(TOPSOLID_CSV_HEADER.length)
    const pieces = rows.slice(1).filter((l) => !l.split(";")[3]!.includes(":"))
    expect(pieces).toHaveLength(panels.length)
    const names = pieces.map((l) => l.split(";")[3])
    expect(names).toContain("Lateral 40,60")
    expect(names).toContain("Prestatge- dalt")
    expect(names).toContain("Linia nova")
    const board = rows[1]!.split(";")
    expect(board[3]).toMatch(/^Roure, nat-ural:\d+x\d+x\d+$/)
    expect(board[0]).toBe("Roure_nat-ural_19#01")
    expect(board[14]).toBe("Prova, v2")
  })

  it("UTF-16 LE amb BOM", () => {
    const bytes = encodeUtf16le("A;")
    expect([...bytes]).toEqual([0xff, 0xfe, 0x41, 0x00, 0x3b, 0x00])
  })
})

describe("labelPoint", () => {
  const shelf = panels.find((p) => p.role === "shelf")!
  it("centre si està lliure", () => {
    const lp = labelPoint(shelf)
    expect(lp.fits).toBe(true)
    expect(lp.u).toBeCloseTo(shelf.length / 2)
    expect(lp.v).toBeCloseTo(shelf.width / 2)
  })
  it("s'aparta d'un forat al centre i no toca cap mecanitzat", () => {
    const p: Panel = { ...shelf, holes: [{ x: shelf.length / 2, y: shelf.width / 2, diameter: 35, depth: 13, face: "A" }] }
    const lp = labelPoint(p)
    expect(lp.fits).toBe(true)
    const dx = Math.abs(lp.u - shelf.length / 2)
    const dy = Math.abs(lp.v - shelf.width / 2)
    // L'etiqueta (99×68) no pot tapar el forat (Ø35 + 10 de marge).
    expect(dx > 49.5 + 27.5 || dy > 34 + 27.5).toBe(true)
  })
  it("peça massa petita: al centre i ho diu", () => {
    const small: Panel = { ...shelf, length: 80, width: 50 }
    expect(labelPoint(small)).toEqual({ u: 40, v: 25, fits: false })
  })
  it("peça amb forma (pota del tamboret): l'etiqueta sencera dins del contorn", () => {
    const legs = buildComposition(flatPackStool()).panels.filter((p) => p.outline)
    expect(legs.some((p) => p.label === "Pota davant" || p.name === "Pota davant")).toBe(true)
    for (const p of legs) {
      const ring = flatten(p.outline!)
      const lp = labelPoint(p)
      expect(pointInPolygon([lp.u, lp.v], ring), p.name).toBe(true)
      if (!lp.fits) continue
      const { w, h } = DEFAULT_LABEL
      for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) expect(pointInPolygon([lp.u + (du * w) / 2, lp.v + (dv * h) / 2], ring), p.name).toBe(true)
    }
  })
  it("contorn en U (arc obert): no posa l'etiqueta al buit del mig", () => {
    // 600 × 400 amb una osca de 300 × 300 al mig de baix: el centre (300, 200) és al buit.
    const u: Panel = { ...shelf, length: 600, width: 400, holes: [], grooves: [], edges: { left: false, right: false, bottom: false, top: false }, outline: [[0, 0], [150, 0], [150, 300], [450, 300], [450, 0], [600, 0], [600, 400], [0, 400]] }
    const lp = labelPoint(u)
    expect(lp.fits).toBe(true)
    expect(lp.v - DEFAULT_LABEL.h / 2).toBeGreaterThanOrEqual(300)
  })

  it("gruixos amb decimals: el gruix de debò i noms de tauler que no es repeteixen", () => {
    const [a] = panels
    const thin = { ...a!, id: "thin", thickness: 18.6 }
    const std = { ...a!, id: "std", thickness: 19 }
    const n = nest([thin, std], DEFAULT_NEST_OPTIONS)
    const out = toTopsolidCsv([thin, std], n, { project: "x" }).text.split("\r\n").filter(Boolean).map((l) => l.split(";"))
    const boards = out.slice(1).filter((c) => c[3]!.includes(":"))
    expect(boards.map((c) => c[0])).toEqual([boardName(a!.material, 18.6, 1), boardName(a!.material, 19, 1)])
    expect(new Set(boards.map((c) => c[0])).size).toBe(2)
    expect(boards[0]![3]).toBe(`${a!.material}:2800x2070x18.6`)
    expect(boards[0]![6]).toBe("18.6")
    expect(boards[1]![6]).toBe("19")
    const pieces = out.slice(1).filter((c) => !c[3]!.includes(":"))
    expect(pieces.map((c) => c[6]).sort()).toEqual(["18.6", "19"])
    expect(boardName("Melamina blanca", 18.6, 2)).toBe("Melamina_blanca_18.6#02")
  })
})
