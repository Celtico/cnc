import { describe, expect, it } from "vitest"
import { camDraw, camRows, type CamOp, type XcsPreview } from "../../core/export/xcsPreview"
import type { CamSheetView } from "./camDrawing"
import { bounds, polylineLength } from "../../core/model"
import { camInspect, edgeGaps } from "./camInspect"

const base = { line: 1, name: "", plane: "Top", toolArg: "T", tool: "T", desc: "" }
const rect = (x0: number, y0: number, x1: number, y1: number) => ({
  name: "r",
  kind: "polyline" as const,
  start: [x0, y0] as [number, number],
  segs: [{ to: [x1, y0] as [number, number] }, { to: [x1, y1] as [number, number] }, { to: [x0, y1] as [number, number] }, { to: [x0, y0] as [number, number] }],
  closed: true,
})

function view(ops: CamOp[]): CamSheetView {
  const preview: XcsPreview = {
    workpiece: { name: "T", L: 2800, W: 2070, T: 19 },
    parts: [{ ref: "A.1.H.3", name: "Lateral", label: "", length: 762, width: 561, x: 120, y: 35.5, angle: 0, w: 762, h: 561 }],
    ops,
    unknown: 0,
    unknownLines: [],
  }
  const draws = new Map()
  const widths = new Map<number, number>()
  for (const o of ops) {
    if (o.kind === "drill") continue
    widths.set(o.n, 8)
    const d = camDraw(o, 8)
    if (d) draws.set(o.n, d)
  }
  return { preview, tools: [], colorOf: new Map(), rows: camRows(ops), draws, widths, small: new Set(), outlines: new Map() }
}

describe("camInspect", () => {
  it("geometria bàsica", () => {
    expect(bounds([[1, 2], [5, -1]])).toEqual({ x0: 1, y0: -1, x1: 5, y1: 2 })
    expect(polylineLength([[0, 0], [3, 0], [3, 4]], false)).toBe(7)
    expect(polylineLength([[0, 0], [3, 0], [3, 4]], true)).toBe(12)
    expect(edgeGaps({ x0: 10, y0: 20, x1: 10, y1: 20 }, { x0: 0, y0: 0, x1: 100, y1: 50 })).toEqual({ left: 10, right: 90, bottom: 20, top: 30 })
  })

  it("peça: mida, origen i cotes", () => {
    const i = camInspect(view([]), { kind: "part", ref: "A.1.H.3" })!
    expect(i.title).toBe("Peça A.1.H.3 · 762 × 561 mm")
    expect(i.lines[0]).toBe("X 120 · Y 35,5 des de l'origen")
    expect(i.dims.map((d) => d.label)).toEqual(["762", "561", "120", "35,5"])
  })

  it("forat: Ø, fondària i cantells més propers de la peça", () => {
    const i = camInspect(view([{ ...base, n: 1, kind: "drill", ref: "A.1.H.3", depth: 12, x: 157, y: 67.5, diameter: 5 }]), { kind: "op", n: 1 })!
    expect(i.lines[0]).toBe("Ø 5 · prof. 12")
    expect(i.lines[1]).toBe("X 157 · Y 67,5 des de l'origen")
    expect(i.lines[2]).toBe("a 37 del cantell esquerre · a 32 del de baix")
    expect(i.dims.map((d) => d.label)).toEqual(["37", "32"])
  })

  it("caixera: mida, passades i distàncies als cantells", () => {
    const o: CamOp = { ...base, n: 2, kind: "pocket", ref: "A.1.H.3", depth: 10, maxPass: 4, path: rect(170, 85.5, 270, 105.5) }
    const i = camInspect(view([o]), { kind: "op", n: 2 })!
    expect(i.lines[0]).toBe("Amplada 20 · llargada 100 mm")
    expect(i.lines[1]).toBe("Eina T · Ø 8")
    expect(i.lines[2]).toBe("prof. 10 · 3 passades de 4")
    expect(i.lines.at(-1)).toBe("a 50 del cantell esquerre · a 50 del de baix")
    expect(i.dims.map((d) => d.label)).toEqual(["100", "20", "50", "50"])
  })

  it("contorn per fora: sense distàncies a la peça; fora del pla de dalt, sense cotes", () => {
    const o: CamOp = { ...base, n: 3, kind: "contour", side: "outside", ref: "A.1.H.3", depth: 19.5, path: rect(120, 35.5, 882, 596.5) }
    const i = camInspect(view([o]), { kind: "op", n: 3 })!
    expect(i.lines[0]).toBe("762 × 561 mm · llargada 2646 mm")
    expect(i.dims).toHaveLength(2)
    expect(camInspect(view([{ ...o, plane: "Left" }]), { kind: "op", n: 3 })!.dims).toEqual([])
    expect(camInspect(view([o]), { kind: "op", n: 99 })).toBeNull()
  })

  it("fresat pel centre en dues passades (ranura del fons de 10,8 amb fresa de 8): l'ample i les cotes del que es talla", () => {
    // Anada i tornada a 2,8 l'una de l'altra, de 278 de llarg.
    const path = { name: "p", kind: "polyline" as const, start: [300, 500] as [number, number], segs: [{ to: [578, 500] as [number, number] }, { to: [578, 502.8] as [number, number] }, { to: [300, 502.8] as [number, number] }], closed: false }
    const o: CamOp = { ...base, n: 4, kind: "rough", ref: "A.1.H.3", depth: 8, path }
    const i = camInspect(view([o]), { kind: "op", n: 4 })!
    expect(i.lines[0]).toBe("Amplada 10,8 (8 d'eina + 2,8 entre passades) · llargada 286 mm")
    expect(i.dims.filter((d) => d.title === "Alçada").map((d) => d.label)).toEqual(["10,8"])
  })
})
