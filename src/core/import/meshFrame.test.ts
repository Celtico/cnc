import { describe, expect, it } from "vitest"
import { circlesAlong, composeFrames, hingeFrameFromMesh, meshPoints, plateFrameFromMesh } from "./meshFrame"
import type { V3 } from "./stepGeometry"

/**
 * Marc de muntatge estimat de la malla (`meshFrame.ts`), amb malles sintètiques fetes com les tessel·la OpenCascade:
 * anells de vèrtexs exactament al cercle, a la mateixa alçada. (Amb els fitxers reals: `meshFrame.roundtrip.test.ts`.)
 */

/** Anell de `n` punts de radi `r` al pla perpendicular a l'eix `axis`, a l'alçada `t`, centrat a `c` (les dues altres coordenades). */
function ring(axis: 0 | 1 | 2, c: [number, number], r: number, t: number, n = 24): V3[] {
  const out: V3[] = []
  const [ia, ib] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI
    const p: V3 = [0, 0, 0]
    p[ia] = c[0] + r * Math.cos(a)
    p[ib] = c[1] + r * Math.sin(a)
    p[axis] = t
    out.push(p)
  }
  return out
}
const mesh = (pts: V3[]) => [{ position: Float32Array.from(pts.flat()) }]
/**
 * Una caixa de punts (el cos del ferratge), per decantar el centre de massa: amb un petit desordre determinista, com una
 * tessel·lació de debò (una graella regular fa cercles per casualitat: 5-12-13).
 */
function box(min: V3, max: V3, step = 5): V3[] {
  const out: V3[] = []
  let s = 12345
  const jitter = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * step * 0.6
  for (let x = min[0]; x <= max[0]; x += step) for (let y = min[1]; y <= max[1]; y += step) for (let z = min[2]; z <= max[2]; z += step) out.push([x + jitter(), y + jitter(), z + jitter()])
  return out
}
const near = (a: readonly number[], b: readonly number[], tol = 0.05) => a.every((x, i) => Math.abs(x - b[i]!) <= tol)

describe("cercles d'una malla", () => {
  it("troba un anell sencer i el tram del cilindre; un arc no és un forat", () => {
    const pts = [...ring(1, [0, 0], 17.5, -13), ...ring(1, [0, 0], 17.5, 0), ...ring(1, [40, 0], 2.5, 0, 12).slice(0, 5)]
    const cs = circlesAlong(meshPoints(mesh(pts)), 1, 10, 20)
    expect(cs).toHaveLength(1)
    expect(cs[0]!.r).toBeCloseTo(17.5, 3)
    expect([cs[0]!.t0, cs[0]!.t1]).toEqual([-13, 0])
    expect(circlesAlong(meshPoints(mesh(pts)), 1, 1, 5)).toHaveLength(0)
  })
  it("dos forats al mateix anell (els dos tetons d'una placa) surten tots dos", () => {
    const pts = [...ring(0, [-16, 0], 5, 0, 16), ...ring(0, [16, 0], 5, 0, 16), ...ring(0, [-16, 0], 5, -11.5, 16), ...ring(0, [16, 0], 5, -11.5, 16)]
    const cs = circlesAlong(meshPoints(mesh(pts)), 0, 2, 6)
    expect(cs.map((c) => Math.round(c.centre[0])).sort((a, b) => a - b)).toEqual([-16, 16])
    for (const c of cs) expect([c.t0, c.t1]).toEqual([-11.5, 0])
  })
})

describe("frontissa a partir de la malla", () => {
  // Com la Sensys de Hettich: cassoleta Ø35 × 13 a l'eix Y (cara a y = 0, cos cap a +y), cargols Ø5,2 a ±26 (Z) / 5,5 (X).
  const sensys = [
    ...ring(1, [0, 0], 17.5, -13, 36),
    ...ring(1, [0, 0], 17.5, 0, 36),
    ...ring(1, [5.5, -26], 2.6, 0, 12),
    ...ring(1, [5.5, -26], 2.6, 3, 12),
    ...ring(1, [5.5, 26], 2.6, 0, 12),
    ...ring(1, [5.5, 26], 2.6, 3, 12),
    // El braç, cap a +y (dins del moble) i una mica cap a +x.
    ...box([-4, 3, -10], [12, 65, 10], 4),
  ]
  it("cassoleta, cargols i marc com la proposta del STEP", () => {
    const p = hingeFrameFromMesh(mesh(sensys))!
    expect(p).not.toBeNull()
    expect(p.kind).toBe("hinge")
    expect(near(p.frame.origin, [0, 0, 0])).toBe(true)
    expect(near(p.frame.n, [0, 1, 0])).toBe(true)
    expect(near(p.frame.v, [1, 0, 0])).toBe(true)
    expect(near(p.frame.u, [0, 0, 1])).toBe(true)
    expect(p.holes.map((h) => [h.role, h.u, h.v, h.d, h.depth])).toEqual([
      ["cup", 0, 0, 35, 13],
      ["screw", -26, 5.5, 5, 10],
      ["screw", 26, 5.5, 5, 10],
    ])
    expect(p.notes[0]).toMatch(/estimat/)
  })
  it("una cassoleta Ø26 (r 13) també és una cassoleta; sense cargols, «cap a dins» pel cos", () => {
    const pts = [...ring(2, [0, 0], 13, 11, 30), ...ring(2, [0, 0], 13, 0, 30), ...box([-10, -4, -60], [10, 20, -2], 4)]
    const p = hingeFrameFromMesh(mesh(pts))!
    expect(p.holes[0]).toMatchObject({ role: "cup", d: 26, depth: 11 })
    // Cos cap a −z: la cara és z = 0 i n = −Z; v cap a +y (on hi ha el cos).
    expect(near(p.frame.n, [0, 0, -1])).toBe(true)
    expect(near(p.frame.origin, [0, 0, 0])).toBe(true)
    expect(p.frame.v[1]).toBeGreaterThan(0.9)
    expect(p.notes.join(" ")).toMatch(/Sense forats de cargol/)
  })
  it("sense cassoleta rodona (CLIP top EXPANDO T de Blum): el parell de fixacions dona la cara i el cantell", () => {
    // Dos tetons Ø10 a ±16 (Y) que surten de la cara z = 38,5 fins a 44,4; el cos cap a −z.
    const pts = [...ring(2, [-27, -16], 4.93, 38.5, 16), ...ring(2, [-27, 16], 4.93, 38.5, 16), ...ring(2, [-27, -16], 4.93, 44.4, 16), ...ring(2, [-27, 16], 4.93, 44.4, 16), ...box([-48, -22, -38], [-2, 22, 38.5], 6)]
    const p = hingeFrameFromMesh(mesh(pts))!
    expect(p).not.toBeNull()
    expect(near(p.frame.origin, [-27, 0, 38.5])).toBe(true)
    expect(near(p.frame.n, [0, 0, -1])).toBe(true)
    expect(p.holes.map((h) => [h.role, Math.abs(h.u), h.v, h.d, h.depth])).toEqual([
      ["cup", 0, 0, 35, 13],
      ["dowel", 16, 0, 10, 6],
      ["dowel", 16, 0, 10, 6],
    ])
    expect(p.notes[0]).toMatch(/sense cassoleta rodona/)
  })
  it("un anell solt de 8 punts (un arrodoniment) no és cap cassoleta: amb un parell de fixacions, mana el parell", () => {
    const pts = [...ring(2, [-14, 0], 17, 36.3, 8), ...ring(2, [-27, -16], 4.93, 38.5, 16), ...ring(2, [-27, 16], 4.93, 38.5, 16), ...ring(2, [-27, -16], 4.93, 44.4, 16), ...ring(2, [-27, 16], 4.93, 44.4, 16), ...box([-48, -22, -38], [-2, 22, 38.5], 6)]
    const p = hingeFrameFromMesh(mesh(pts))!
    expect(p.notes[0]).toMatch(/sense cassoleta rodona/)
    expect(near(p.frame.origin, [-27, 0, 38.5])).toBe(true)
  })
  it("sense cap patró, null", () => {
    expect(hingeFrameFromMesh(mesh(box([0, 0, 0], [50, 50, 50], 10)))).toBeNull()
    expect(hingeFrameFromMesh([])).toBeNull()
  })
})

describe("placa a partir de la malla", () => {
  it("els dos tetons de la cara del lateral, a ±16, i la cara (no la punta dels tetons)", () => {
    // Cara del lateral x = 0 (molts vèrtexs), tetons Ø10 cap a −x fins a −11,5, cos de la placa cap a +x.
    const face: V3[] = []
    for (let y = -22; y <= 28; y += 2) for (let z = -27; z <= 27; z += 2) face.push([0, y, z])
    const pts = [...face, ...ring(0, [0, -16], 5, 0, 16), ...ring(0, [0, 16], 5, 0, 16), ...ring(0, [0, -16], 5, -11.5, 16), ...ring(0, [0, 16], 5, -11.5, 16), ...box([0, -20, -25], [6, 26, 25], 3)]
    const p = plateFrameFromMesh(mesh(pts))!
    expect(p).not.toBeNull()
    expect(near(p.frame.origin, [0, 0, 0])).toBe(true)
    expect(near(p.frame.n, [1, 0, 0])).toBe(true)
    expect(p.holes.map((h) => [h.role, h.u, h.v, h.d, h.depth])).toEqual([
      ["dowel", -16, 0, 10, 11.5],
      ["dowel", 16, 0, 10, 11.5],
    ])
  })
})

describe("composar marcs", () => {
  it("fitxer → model desat → marc nou", () => {
    const outer = { origin: [10, 0, 0] as V3, u: [0, 0, 1] as V3, v: [1, 0, 0] as V3, n: [0, 1, 0] as V3 }
    const inner = { origin: [1, 2, 3] as V3, u: [1, 0, 0] as V3, v: [0, 1, 0] as V3, n: [0, 0, 1] as V3 }
    const f = composeFrames(outer, inner)
    // L'origen interior (1 u, 2 v, 3 n) en coordenades del fitxer: 10 + 2·x + 3·y + 1·z.
    expect(f.origin).toEqual([12, 3, 1])
    expect(f.u).toEqual(outer.u)
    expect(f.v).toEqual(outer.v)
    expect(f.n).toEqual(outer.n)
  })
})
