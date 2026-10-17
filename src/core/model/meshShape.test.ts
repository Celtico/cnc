import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import type { Composition } from "./composition"
import { boxCage, extrudeFaces, normalizeCage, refineCage, START_SHAPES, subdivide, toggleCrease } from "./meshShape"

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

  it("formes de partida: totes tancades i cap a fora; la caixa amb arestes vives conserva les cantonades", () => {
    for (const sh of START_SHAPES) {
      const c = sh.make()
      const s = subdivide(c, 2)
      expect(closed(s.triangles), sh.id).toBe(true)
      expect(volume(s), sh.id).toBeGreaterThan(0)
    }
    const box = subdivide(START_SHAPES.find((x) => x.id === "box")!.make(), 3)
    expect(box.positions.some((p) => p.every((x) => Math.abs(x) < 1e-9))).toBe(true)
    // El cilindre: tapes planes (la de dalt sencera a y = 1).
    const cyl = subdivide(START_SHAPES.find((x) => x.id === "cylinder")!.make(), 3)
    expect(cyl.positions.filter((p) => Math.abs(p[1] - 1) < 1e-9).length).toBeGreaterThan(20)
  })

  it("aresta viva: es posa i es treu a les arestes amb els dos punts triats", () => {
    const c = boxCage()
    const f = c.f[0]!
    const on = toggleCrease(c, f)
    expect(on.crease).toHaveLength(4)
    expect(toggleCrease(on, f).crease).toBeUndefined()
  })

  it("extrudir una cara: punts nous, cares de costat i la malla segueix tancada", () => {
    const c = boxCage()
    const r = extrudeFaces(c, c.f[0]!, 0.3)
    expect(r.ids).toHaveLength(4)
    expect(r.cage.v.length).toBe(c.v.length + 4)
    expect(r.cage.f.length).toBe(c.f.length + 4)
    const s = subdivide(r.cage, 2)
    expect(closed(s.triangles)).toBe(true)
    expect(volume(s)).toBeGreaterThan(volume(subdivide(c, 2)))
  })
})

function closed(tris: [number, number, number][]): boolean {
  const e = new Map<string, number>()
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const a = t[k]!, b = t[(k + 1) % 3]!
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    e.set(key, (e.get(key) ?? 0) + 1)
  }
  return [...e.values()].every((n) => n === 2)
}
function volume(s: ReturnType<typeof subdivide>): number {
  let vol = 0
  for (const [a, b, cc] of s.triangles) {
    const p = s.positions[a]!, q = s.positions[b]!, r = s.positions[cc]!
    vol += (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6
  }
  return vol
}
