import { describe, expect, it } from "vitest"
import { layoutDims, textW, viewCircles } from "./dims"

const box = { x0: 0, y0: 0, x1: 600, y1: 400 }

describe("cotes dels plànols", () => {
  it("total i encadenades des dels cantells, entre elements i amb la referència", () => {
    const l = layoutDims(box, [{ x: 100, y: 200, hx: 4, hy: 4, label: "Ø8 × 10" }, { x: 132, y: 200, hx: 4, hy: 4, label: "Ø8 × 10" }], 20, { ref: [300, 200] })
    const labels = l.dims.map((d) => d.label)
    // X: 0 → 100 → 132 → 300 → 600; Y: 0 → 200 → 400.
    expect(labels).toEqual(["100", "32", "168", "300", "200", "200", "600", "400"])
    // La caixa ho conté tot.
    expect(l.extent.x).toBeLessThan(0)
    expect(l.extent.y).toBeLessThan(0)
    expect(l.extent.x + l.extent.w).toBeGreaterThan(600)
    expect(l.extent.y + l.extent.h).toBeGreaterThan(400)
  })

  it("els textos que no hi caben pugen de fila i no s'encavalquen", () => {
    const xs = [100, 110, 120, 130, 140]
    const l = layoutDims(box, xs.map((x) => ({ x, y: 200, hx: 1, hy: 1 })), 20)
    const short = l.dims.filter((d) => d.shift)
    expect(short.length).toBeGreaterThan(0)
    // Dos textos a la mateixa fila no es toquen.
    const rows = new Map<number, [number, number][]>()
    for (const d of short) {
      const mid = (d.a[0] + d.b[0]) / 2
      const w = textW(d.label, 20)
      rows.set(d.shift!, [...(rows.get(d.shift!) ?? []), [mid - w / 2, mid + w / 2]])
    }
    for (const list of rows.values()) {
      list.sort((a, b) => a[0] - b[0])
      for (let i = 1; i < list.length; i++) expect(list[i]![0]).toBeGreaterThanOrEqual(list[i - 1]![1])
    }
  })

  it("les etiquetes dels elements no es posen a sobre d'un altre element ni d'una altra etiqueta", () => {
    const feats = [0, 1, 2, 3].map((k) => ({ x: 200 + k * 30, y: 200, hx: 5, hy: 5, label: "Ø10 × 12" }))
    const l = layoutDims(box, feats, 20)
    expect(l.labels.length).toBeGreaterThan(0)
    const lfs = 16
    const boxes = l.labels.map((t) => {
      const w = textW(t.text, lfs)
      const x0 = t.anchor === "start" ? t.x : t.anchor === "end" ? t.x - w : t.x - w / 2
      return [x0, t.y - lfs * 1.1 * 0.85, x0 + w, t.y + lfs * 1.1 * 0.15] as [number, number, number, number]
    })
    for (const [i, a] of boxes.entries()) {
      for (const f of feats) expect(a[0] < f.x + f.hx && a[2] > f.x - f.hx && a[1] < f.y + f.hy && a[3] > f.y - f.hy).toBe(false)
      for (const b of boxes.slice(i + 1)) expect(a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]).toBe(false)
    }
  })

  it("cercles d'una vista: centre i radi (sense el punt de tancar repetit)", () => {
    const circle: number[] = []
    for (let i = 0; i <= 24; i++) circle.push(16 + 2.5 * Math.cos((i / 24) * 2 * Math.PI), 10 + 2.5 * Math.sin((i / 24) * 2 * Math.PI))
    const c = viewCircles([[0, 0, 64, 0, 64, 20, 0, 20, 0, 0], circle])
    expect(c).toHaveLength(1)
    expect(c[0]!.x).toBeCloseTo(16, 3)
    expect(c[0]!.y).toBeCloseTo(10, 3)
    expect(c[0]!.r).toBeCloseTo(2.5, 2)
  })
})
