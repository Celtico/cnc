import { describe, expect, it } from "vitest"
import { importedMesh, parseStl } from "./meshImport"
import { MeshCageSchema } from "./meshShape"
import { applySlices, DEFAULT_SLICES } from "./slices"
import { defaultModule, newId, type Composition } from "./composition"

type V3 = [number, number, number]
type Tri = [V3, V3, V3]

/** Un cub de costat `s` (Z amunt), tancat. */
function cube(s: number): Tri[] {
  const p = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s]
  const quad = (a: V3, b: V3, c: V3, d: V3): Tri[] => [[a, b, c], [a, c, d]]
  return [
    ...quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)),
    ...quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)),
    ...quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)),
    ...quad(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)),
    ...quad(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)),
    ...quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)),
  ]
}

/** STL binari dels triangles. */
function binary(tris: Tri[]): ArrayBuffer {
  const buf = new ArrayBuffer(84 + tris.length * 50)
  const dv = new DataView(buf)
  dv.setUint32(80, tris.length, true)
  tris.forEach((t, i) => t.forEach((p, k) => p.forEach((x, c) => dv.setFloat32(84 + i * 50 + 12 + k * 12 + c * 4, x, true))))
  return buf
}

/** Un pla amb ones (Z amunt, el davant cap a −Y), obert: com el que s'exporta del Cinema 4D. */
function waves(n: number, size: number): Tri[] {
  const at = (i: number, j: number): V3 => [(i / n) * size, -10 * Math.sin(i / 3), (j / n) * size]
  const out: Tri[] = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([at(i, j), at(i + 1, j), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i, j + 1)])
  return out
}

describe("importar un model 3D (.stl)", () => {
  it("binari i de text: els mateixos triangles", () => {
    const t = cube(1)
    const text = `solid c\n${t.map((tr) => `facet normal 0 0 0\nouter loop\n${tr.map((p) => `vertex ${p.join(" ")}`).join("\n")}\nendloop\nendfacet`).join("\n")}\nendsolid c`
    expect(parseStl(binary(t))).toHaveLength(12)
    expect(parseStl(new TextEncoder().encode(text).buffer as ArrayBuffer)).toEqual(parseStl(binary(t)))
    expect(() => parseStl(new TextEncoder().encode("hola").buffer as ArrayBuffer)).toThrow()
  })

  it("tancat: la malla tal com ve (sense suavitzar), unitats endevinades (metres → mm)", () => {
    const m = importedMesh(cube(0.5))
    expect(m.relief).toBe(false)
    expect(m.rough).toBe(false)
    expect([m.w, m.h, m.d]).toEqual([500, 500, 500])
    expect(m.mesh.level).toBe(0)
    expect(m.mesh.f).toHaveLength(12)
    expect(MeshCageSchema.safeParse(m.mesh).success).toBe(true)
  })

  it("obert (pla amb ones): un relleu tancat amb el darrere pla, Z amunt passa a Y amunt i el davant a +z", () => {
    const m = importedMesh(waves(40, 57))
    expect(m.relief).toBe(true)
    // 57 unitats: centímetres.
    expect(m.w).toBeCloseTo(570, 0)
    expect(m.h).toBeCloseTo(570, 0)
    expect(m.d).toBeGreaterThan(200)
    expect(m.d).toBeLessThan(240)
    expect(MeshCageSchema.safeParse(m.mesh).success).toBe(true)
    for (const p of m.mesh.v) for (const x of p) expect(x >= 0 && x <= 1).toBe(true)
  })

  it("es talla en llistons sense avisos", () => {
    const m = importedMesh(waves(40, 57))
    const ref = { id: newId("r"), name: "Ones", shape: "mesh" as const, mesh: m.mesh, x: 0, y: 0, z: 0, w: m.w, h: m.h, d: m.d }
    const comp: Composition = { kind: "lliure", modules: [defaultModule(newId("m"), "Mòdul 1")], references: [ref], parts: [] }
    const r = applySlices(comp, ref.id, { ...DEFAULT_SLICES, gap: 6, rods: 0 }).result
    expect(r.count).toBeGreaterThanOrEqual(20)
    expect(r.warnings).toEqual([])
  })
})
