import { describe, expect, it } from "vitest"
import { loftCage, START_SHAPES } from "./meshShape"
import { applySlices, sliceMesh, sliceObject, DEFAULT_SLICES } from "./slices"
import type { Composition, RefObject } from "./composition"

const bench = (): RefObject => {
  const xs = Array.from({ length: 9 }, (_, i) => i * 250)
  const rings = xs.map((x) => {
    const H = 420 + 80 * Math.sin((x / 2000) * Math.PI * 2)
    return [[0, 0], [450, 0], [450, H * 0.85], [360, H], [90, H], [0, H * 0.85]] as [number, number][]
  })
  const { cage, box } = loftCage(rings, xs, [0])
  return { id: "r1", name: "Banc", shape: "mesh", mesh: cage, ...box }
}

describe("llistons", () => {
  it("talla un banc en llistons de costat amb barres", () => {
    const t = performance.now()
    const res = sliceObject(bench(), DEFAULT_SLICES, "G")
    const ms = performance.now() - t
    expect(res.count).toBeGreaterThan(50)
    expect(res.parts.every((p) => p.orient === "side" && p.thickness === 19 && p.group === "G")).toBe(true)
    // El banc seu a terra: la base de cada llistó del mig, a y = 0.
    const mid = res.parts[Math.floor(res.parts.length / 2)]!
    expect(mid.y).toBeLessThan(1)
    expect(res.rods.length).toBe(2)
    expect(res.rods.every((r) => r.effect === "cut" && r.shape === "cylinder" && r.axis === "x")).toBe(true)
    console.log(res.count, "llistons", res.parts[30]!.shape!.length, "punts", res.rods.map((r) => r.name), res.warnings, Math.round(ms), "ms")
    expect(ms).toBeLessThan(3000)
  })

  it("una esfera tallada de dalt a baix fa cercles estirats", () => {
    const o: RefObject = { id: "s", name: "Esfera", shape: "mesh", mesh: START_SHAPES.find((s) => s.id === "sphere")!.make(), x: 0, y: 0, z: 0, w: 400, h: 400, d: 400 }
    const res = sliceObject(o, { ...DEFAULT_SLICES, axis: "y", gap: 0, rods: 0 }, "G")
    expect(res.parts.every((p) => p.orient === "flat")).toBe(true)
    const big = res.parts.reduce((a, b) => (a.w > b.w ? a : b))
    expect(Math.abs(big.w - big.h)).toBeLessThan(big.w * 0.15)
  })

  it("un forat de la secció surt com una peça que talla", () => {
    // Un cub de 100 amb un buit cúbic de 40 al mig (cares del buit girades).
    const cube = (s: number, o: number, flip: boolean) => {
      const p: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((v) => v.map((x) => o + x * s) as [number, number, number])
      const q = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]]
      const t = q.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]] as [number, number, number][])
      return { p, t: flip ? t.map(([a, b, c]) => [a, c, b] as [number, number, number]) : t }
    }
    const A = cube(100, 0, false), B = cube(40, 30, true)
    const mesh = { positions: [...A.p, ...B.p], triangles: [...A.t, ...B.t.map((t) => t.map((i) => i + 8) as [number, number, number])] }
    const st = sliceMesh(mesh, "z", 10, 0)
    const mid = st[5]![0]!
    expect(mid.holes.length).toBe(1)
    expect(st[0]![0]!.holes.length).toBe(0)
  })

  it("tornar a tallar refà el grup i amaga la forma", () => {
    const comp: Composition = { kind: "lliure", modules: [], references: [bench()], parts: [] } as unknown as Composition
    const a = applySlices(comp, "r1", DEFAULT_SLICES).comp
    const b = applySlices(a, "r1", { ...DEFAULT_SLICES, thickness: 30 }).comp
    expect(b.references.find((r) => r.id === "r1")!.hidden).toBe(true)
    expect(b.parts!.every((p) => p.thickness === 30)).toBe(true)
    expect(b.references.length).toBe(1 + 2)
  })
})
