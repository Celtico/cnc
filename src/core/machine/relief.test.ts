import { describe, expect, it } from "vitest"
import { pocketDepthFn, pocketGrid, pocketSolids, roundedDepth, rotatePocket, type Pocket } from "../model"
import type { MachineTool } from "../model/machine"
import { distanceInside, erode, isoLoops, reliefPlan, defaultRelief } from "./relief"

const tool = (d: number, ball = false): MachineTool => ({ code: `T${d}`, name: `${d}mm`, kind: "router", diameter: d, maxDepth: 60, mounted: true, auto: true, ...(ball ? { ball } : {}) })
/** Una pica de 300 × 200 × 40 amb el fons de R30, amb el contorn de cantonades rodones (R40). */
const basin: Pocket = {
  points: [[40, 0], [260, 0, 0.4142], [300, 40], [300, 160, 0.4142], [260, 200], [40, 200, 0.4142], [0, 160], [0, 40, 0.4142]],
  depth: 40,
  face: "A",
  round: 30,
}

describe("forma dels buidats (`pocketField`)", () => {
  it("fons arrodonit: la paret recta fins a fondària − radi i el quart de cercle fins al fons", () => {
    expect(roundedDepth(0, 40, 30)).toBeCloseTo(10)
    expect(roundedDepth(30, 40, 30)).toBeCloseTo(40)
    expect(roundedDepth(15, 40, 30)).toBeCloseTo(10 + Math.sqrt(30 * 30 - 15 * 15))
    const f = pocketDepthFn(basin)
    expect(f(150, 100)).toBe(40)
    expect(f(-5, 100)).toBe(0)
    expect(f(5, 100)).toBeGreaterThan(10)
    expect(f(5, 100)).toBeLessThan(40)
  })

  it("el sòlid per al 3D: prisma de la paret i un mapa d'alçades tancat a sota", () => {
    const s = pocketSolids(basin, 50)
    expect(s.wall!.dir[2]).toBeCloseTo(-(10 + 1))
    expect(s.field!.index.length % 3).toBe(0)
    // Tancat: cada aresta la comparteixen exactament dos triangles.
    const edges = new Map<string, number>()
    const ix = s.field!.index
    for (let t = 0; t < ix.length; t += 3)
      for (let k = 0; k < 3; k++) {
        const a = ix[t + k]!, b = ix[t + ((k + 1) % 3)]!
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        edges.set(key, (edges.get(key) ?? 0) + 1)
      }
    expect([...edges.values()].every((n) => n === 2)).toBe(true)
  })

  it("girar la peça gira el mapa", () => {
    const m: Pocket = { points: [[0, 0], [10, 0], [10, 10]], depth: 5, face: "A", map: { x0: 0, y0: 0, step: 1, nx: 3, ny: 2, d: [0, 1, 2, 3, 4, 5] } }
    const r = rotatePocket(m, 100)
    const f0 = pocketDepthFn(m), f1 = pocketDepthFn(r)
    expect(f1(1, 100 - 2)).toBeCloseTo(f0(2, 1))
    expect(f1(0, 100 - 1)).toBeCloseTo(f0(1, 0))
  })
})

describe("recorreguts 3D (`relief`)", () => {
  it("contorns d'un cercle: un de sol, antihorari, de l'àrea del cercle", () => {
    const n = 101
    const f = new Float32Array(n * n)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) f[j * n + i] = 30 - Math.hypot(i - 50, j - 50)
    const loops = isoLoops(f, n, n, 0, 0, 1, 0)
    expect(loops).toHaveLength(1)
    let a = 0
    const l = loops[0]!
    for (let k = 0; k < l.length; k++) a += l[k]![0] * l[(k + 1) % l.length]![1] - l[(k + 1) % l.length]![0] * l[k]![1]
    expect(a / 2).toBeCloseTo(Math.PI * 900, -1)
  })

  it("distància a la vora i l'eina engreixada (plana i esfèrica)", () => {
    const g = pocketGrid({ points: [[0, 0], [100, 0], [100, 100], [0, 100]], depth: 10, face: "A" }, 1, 10)
    const mask = new Uint8Array(g.nx * g.ny).map((_, k) => (g.d[k]! > 0 ? 1 : 0))
    const dist = distanceInside(mask, g.nx, g.ny, 1)
    const mid = (g.ny >> 1) * g.nx + (g.nx >> 1)
    expect(dist[mid]).toBeCloseTo(50, 0)
    const flat = erode(g, 6, false)
    const ball = erode(g, 6, true)
    expect(flat[mid]).toBe(10)
    // A 3 mm de la paret: la plana no hi baixa; l'esfèrica, una mica.
    const near = (g.ny >> 1) * g.nx + (10 + 3)
    expect(flat[near]).toBe(0)
    expect(ball[near]!).toBeGreaterThan(0)
    expect(ball[near]!).toBeLessThan(2)
  })

  it("la pica: desbast per nivells, acabat que no es menja la forma i que arriba al fons", () => {
    const passes = reliefPlan(basin, defaultRelief(tool(12), tool(10, true), true, 8))
    expect(passes.map((p) => p.kind)).toEqual(["rough", "waterline", "raster"])
    const f = pocketDepthFn(basin)
    const rough = passes[0]!.paths.flat()
    // Desbast: deixa 0,4 mm al fons i cap punt no surt de la pica.
    expect(Math.min(...rough.map((q) => q[2]))).toBeCloseTo(-39.6, 1)
    expect(rough.every((q) => f(q[0], q[1]) > 0)).toBe(true)
    // Nivells de 8 mm: 8, 16, 24, 32 i el del fons.
    expect(new Set(rough.filter((q) => Math.abs(q[2] % 8) < 1e-6).map((q) => q[2])).size).toBeGreaterThanOrEqual(4)
    // Acabat amb la bola: la punta mai per sota de la superfície (± la graella) i arriba al fons.
    const fin = passes.slice(1).flatMap((p) => p.paths.flat())
    expect(Math.min(...fin.map((q) => q[2]))).toBeCloseTo(-40, 0)
    expect(fin.every((q) => -q[2] <= f(q[0], q[1]) + 0.6)).toBe(true)
  })
})
