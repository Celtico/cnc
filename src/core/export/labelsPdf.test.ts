import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { DEFAULT_CABINET, cabinetToComposition } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { labelsPdf, pieceLabels } from "./labelsPdf"
import { pieceRefs } from "./refs"
import { toTopsolidCsv } from "./topsolidCsv"

const panels = buildComposition(cabinetToComposition({ ...DEFAULT_CABINET, doors: 2 })).panels
const nesting = nest(panels, DEFAULT_NEST_OPTIONS)
const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("")

describe("pieceLabels", () => {
  const labels = pieceLabels(panels, nesting)

  it("una etiqueta per peça del nesting, amb la ref i el tauler del CSV del taller", () => {
    const placed = nesting.boards.reduce((a, b) => a + b.placements.length, 0) + nesting.unplaced.length
    expect(labels).toHaveLength(placed)
    const refs = pieceRefs(panels)
    const rows = new Map(toTopsolidCsv(panels, nesting, { project: "" }).rows.map((r) => [r.panelId, r]))
    for (const l of labels) {
      expect(l.ref).toBe(refs.get(l.panelId))
      expect(l.board).toBe(rows.get(l.panelId)?.board)
    }
    expect(new Set(labels.map((l) => l.ref)).size).toBe(labels.length)
  })

  it("les portes porten els quatre cantells", () => {
    const door = labels.find((l) => panels.find((p) => p.id === l.panelId)?.role === "door")!
    expect(door.edges).toEqual([1, 2, 3, 4])
  })

  it("sense nesting, totes les peces que es fabriquen", () => {
    expect(pieceLabels(panels)).toHaveLength(panels.filter((p) => p.role !== "hardware").length)
  })
})

describe("labelsPdf", () => {
  const labels = pieceLabels(panels, nesting)
  const pdf = latin1(labelsPdf(labels, { project: "Cuina d'en Pau", label: { w: 100, h: 50 } }))

  it("és un PDF amb una pàgina de 100 × 50 mm per etiqueta", () => {
    expect(pdf.startsWith("%PDF-1.4")).toBe(true)
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true)
    expect(pdf).toContain(`/Count ${labels.length}`)
    expect(pdf.match(/\/MediaBox \[0 0 283\.465 141\.732\]/g)).toHaveLength(labels.length)
  })

  it("la taula xref apunta a cada objecte", () => {
    const xref = Number(/startxref\n(\d+)/.exec(pdf)![1])
    expect(pdf.slice(xref, xref + 4)).toBe("xref")
    const offsets = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    offsets.forEach((o, i) => expect(pdf.slice(o).startsWith(`${i + 1} 0 obj`)).toBe(true))
  })

  it("text en WinAnsi: accents, × i parèntesis escapats", () => {
    expect(pdf).toContain(labels[0]!.ref)
    expect(pdf).toContain("Mòdul 1")
    expect(pdf).toContain(" × ")
    expect(labelsPdf([{ ...labels[0]!, name: "Porta (esq)" }], { project: "x" }).length).toBeGreaterThan(0)
    expect(latin1(labelsPdf([{ ...labels[0]!, name: "Porta (esq)" }], { project: "x" }))).toContain("Porta \\(esq\\)")
  })
})
