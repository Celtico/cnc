import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import type { Composition } from "./composition"
import { boxCage, normalizeCage, refineCage, subdivide } from "./meshShape"

describe("forma lliure (caixa de control i Catmull-Clark, per decisió de l'usuari, 2026-10-17)", () => {
  it("la caixa de partida: 26 punts i 24 cares; suavitzada, una superfície tancada dins de la caixa", () => {
    const c = boxCage()
    expect([c.v.length, c.f.length]).toEqual([26, 24])
    const s = subdivide(c, 2)
    expect(s.triangles.length).toBe(24 * 16 * 2)
    // Tancada: cada aresta, dos triangles.
    const e = new Map<string, number>()
    for (const t of s.triangles) for (let k = 0; k < 3; k++) {
      const a = t[k]!, b = t[(k + 1) % 3]!
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      e.set(key, (e.get(key) ?? 0) + 1)
    }
    expect([...e.values()].every((n) => n === 2)).toBe(true)
    // Suau: dins de la caixa (toca el mig de cada cara, que és pla) i sense les cantonades.
    expect(s.positions.every((p) => p.every((x) => x >= 0 && x <= 1))).toBe(true)
    expect(s.positions.some((p) => p.every((x) => x === 0))).toBe(false)
    // Orientada cap a fora: el volum amb signe és positiu.
    let vol = 0
    for (const [a, b, cc] of s.triangles) {
      const p = s.positions[a]!, q = s.positions[b]!, r = s.positions[cc]!
      vol += (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6
    }
    expect(vol).toBeGreaterThan(0.3)
  })

  it("«Més detall» i tornar-la a la caixa", () => {
    const c = refineCage(boxCage())
    expect(c.v.length).toBe(98)
    const i0 = c.v.findIndex((p) => p[0] === Math.min(...c.v.map((q) => q[0])))
    const moved = { ...c, v: c.v.map((p, i) => (i === i0 ? ([p[0] - 0.5, p[1], p[2]] as [number, number, number]) : p)) }
    const n = normalizeCage(moved, { x: 0, y: 0, z: 0, w: 100, h: 100, d: 100 })
    expect(n.box.x).toBeLessThan(0)
    expect(n.box.w).toBeGreaterThan(100)
    expect(Math.min(...n.cage.v.map((p) => p[0]))).toBe(0)
  })

  it("una forma que entra per dalt en un tauler: un buidat amb mapa (relleu) que va al programa", () => {
    const comp = {
      kind: "moble",
      modules: [],
      parts: [{ id: "p", name: "Tauler", orient: "flat", w: 600, h: 400, thickness: 38, material: "Corian Glacier White", x: 0, y: 0, z: 0 }],
      references: [{ id: "m", name: "Relleu", effect: "cut", shape: "mesh", mesh: boxCage(), axis: "y", w: 300, h: 60, d: 200, x: 150, y: 18, z: 100 }],
    } as unknown as Composition
    const b = buildComposition(comp)
    const p = b.panels.find((q) => q.id === "part:p")!
    expect(p.pockets).toHaveLength(1)
    const k = p.pockets![0]!
    expect(k.face).toBe("A")
    expect(k.map).toBeDefined()
    // Fondària: de la cara (38) fins al punt més baix de la forma suavitzada (una mica per sobre de y = 18).
    expect(k.depth).toBeGreaterThan(10)
    expect(k.depth).toBeLessThanOrEqual(20)
    expect(b.warnings.filter((w) => w.code === "ref-cut")).toEqual([])
  })
})
