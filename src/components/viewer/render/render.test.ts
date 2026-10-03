import { describe, expect, it } from "vitest"
import { buildBvh, INTERNAL, intersectBvh, NODE_WORDS, triHit } from "./bvh"
import { buildEnvCdf, dirToUv, envPdf, sampleEnv, uvToDir } from "./envSampling"
import { halveTexture, packGpuScene, packTextures, TRI_VEC4 } from "./gpuScene"
import type { RenderEnv, RenderScene, RenderTexture } from "./sceneData"
import { bevelNormal, clampLum, decodeNormal, encodeNormal, perturbNormal, smoothNormal, tangentFrame } from "./shading"
import { EMIT_FLOATS, buildEmitters, pickEmitter } from "./emitters"

/** Graella de n × n quadrats (2 triangles cadascun) al pla z = 0, i alguns de girats a sobre. */
function soup(n: number): Float32Array {
  const out: number[] = []
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      out.push(i, j, 0, i + 1, j, 0, i + 1, j + 1, 0)
      out.push(i, j, 0, i + 1, j + 1, 0, i, j + 1, 0)
      // Un triangle vertical a cada quadrat, a alçades diferents.
      out.push(i + 0.2, j + 0.5, 0.1 + ((i * 7 + j * 3) % 5) * 0.1, i + 0.8, j + 0.5, 0.1, i + 0.5, j + 0.5, 0.9)
    }
  return new Float32Array(out)
}

function bruteForce(pos: Float32Array, o: number[], d: number[]) {
  let best: { t: number; tri: number } | null = null
  for (let t = 0; t < pos.length / 9; t++) {
    const h = triHit(pos, t, o[0]!, o[1]!, o[2]!, d[0]!, d[1]!, d[2]!)
    if (h && (!best || h.t < best.t)) best = h
  }
  return best
}

describe("BVH compartit", () => {
  const pos = soup(12)
  const bvh = buildBvh(pos)

  it("cada triangle surt a una sola fulla i les caixes el contenen", () => {
    const seen = new Uint8Array(pos.length / 9)
    for (let n = 0; n < bvh.count; n++) {
      const o = n * NODE_WORDS
      const meta = bvh.u32[o + 7]!
      if (meta >= INTERNAL) {
        // Interior: el fill esquerre és el següent i el dret és més endavant.
        expect(bvh.u32[o + 3]!).toBeGreaterThan(n + 1)
        expect(bvh.u32[o + 3]!).toBeLessThan(bvh.count)
        continue
      }
      for (let i = bvh.u32[o + 3]!; i < bvh.u32[o + 3]! + meta; i++) {
        const t = bvh.order[i]!
        seen[t]!++
        for (let k = 0; k < 3; k++)
          for (let a = 0; a < 3; a++) {
            const v = pos[t * 9 + k * 3 + a]!
            expect(v).toBeGreaterThanOrEqual(bvh.f32[o + a]! - 1e-6)
            expect(v).toBeLessThanOrEqual(bvh.f32[o + 4 + a]! + 1e-6)
          }
      }
    }
    expect([...seen].every((s) => s === 1)).toBe(true)
  })

  it("troba el mateix que la força bruta", () => {
    let rng = 7
    const r = () => ((rng = (rng * 16807) % 2147483647) / 2147483647)
    for (let k = 0; k < 300; k++) {
      const o = [r() * 12, r() * 12, 2 + r() * 2]
      const d = [r() - 0.5, r() - 0.5, -0.3 - r()]
      const l = Math.hypot(d[0]!, d[1]!, d[2]!)
      const dn = d.map((x) => x / l)
      const a = intersectBvh(bvh, pos, o[0]!, o[1]!, o[2]!, dn[0]!, dn[1]!, dn[2]!)
      const b = bruteForce(pos, o, dn)
      expect(a?.tri ?? -1).toBe(b?.tri ?? -1)
      if (a && b) expect(a.t).toBeCloseTo(b.t, 6)
    }
  })

  it("escena buida: un node que no toca res", () => {
    const e = buildBvh(new Float32Array(0))
    expect(e.count).toBe(1)
    expect(intersectBvh(e, new Float32Array(0), 0, 0, 0, 0, 0, -1)).toBeNull()
  })
})

describe("mostreig del cel HDRI", () => {
  // Cel fosc amb un «sol» de 2 × 2 píxels molt fort.
  const w = 32, h = 16
  const data = new Float32Array(w * h * 3).fill(0.1)
  for (const [x, y] of [[20, 4], [21, 4], [20, 5], [21, 5]] as const) data.set([200, 190, 180], (y * w + x) * 3)
  const env: RenderEnv = { w, h, data }
  const cdf = buildEnvCdf(env)

  it("CDF de 0 a 1 i creixent", () => {
    expect(cdf.marginal[0]).toBe(0)
    expect(cdf.marginal[h]).toBe(1)
    for (let y = 0; y < h; y++) expect(cdf.marginal[y + 1]!).toBeGreaterThanOrEqual(cdf.marginal[y]!)
    for (let y = 0; y < h; y++) expect(cdf.conditional[y * (w + 1) + w]).toBe(1)
  })

  it("direcció ↔ (u, v) amb gir", () => {
    for (const rot of [0, 0.3]) {
      const d = uvToDir(0.37, 0.61, rot)
      const [u, v] = dirToUv(d[0], d[1], d[2], rot)
      expect(u).toBeCloseTo(0.37, 6)
      expect(v).toBeCloseTo(0.61, 6)
    }
  })

  it("tria sobretot el sol i la densitat és coherent (integra 1)", () => {
    let rng = 3
    const r = () => ((rng = (rng * 48271) % 2147483647) / 2147483647)
    let sun = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      const [dx, dy, dz, pdf] = sampleEnv(cdf, r(), r(), 0)
      expect(pdf).toBeGreaterThan(0)
      expect(pdf).toBeCloseTo(envPdf(cdf, dx, dy, dz, 0), 3)
      const [u, v] = dirToUv(dx, dy, dz, 0)
      if (Math.floor(u * w) >= 20 && Math.floor(u * w) <= 21 && Math.floor(v * h) >= 4 && Math.floor(v * h) <= 5) sun++
    }
    expect(sun / N).toBeGreaterThan(0.9)
    // ∫ pdf dω ≈ 1 (Monte Carlo uniforme a l'esfera).
    let s = 0
    const M = 20000
    for (let i = 0; i < M; i++) {
      const z = 2 * r() - 1, ph = 2 * Math.PI * r(), q = Math.sqrt(1 - z * z)
      s += envPdf(cdf, q * Math.cos(ph), z, q * Math.sin(ph), 0)
    }
    expect((s / M) * 4 * Math.PI).toBeCloseTo(1, 1)
  })
})

describe("arestes arrodonides", () => {
  const min = [0, 0, 0], max = [0.6, 0.4, 0.019], r = 0.002

  it("al mig de la cara, la normal no canvia", () => {
    expect(bevelNormal([0.3, 0.2, 0.019], [0, 0, 1], min, max, r)).toEqual([0, 0, 1])
  })

  it("a l'aresta, 45° cap a fora; a mig radi, menys", () => {
    const e = bevelNormal([0.6, 0.2, 0.019], [0, 0, 1], min, max, r)
    expect(e[0]).toBeCloseTo(Math.SQRT1_2, 6)
    expect(e[2]).toBeCloseTo(Math.SQRT1_2, 6)
    const half = bevelNormal([0.599, 0.2, 0.019], [0, 0, 1], min, max, r)
    expect(half[0]).toBeGreaterThan(0)
    expect(half[0]).toBeLessThan(e[0])
    // L'altra vora (x = 0) s'inclina cap a −x.
    expect(bevelNormal([0.0005, 0.2, 0.019], [0, 0, 1], min, max, r)[0]).toBeLessThan(0)
  })

  it("a la cantonada s'inclina cap a les dues vores", () => {
    const c = bevelNormal([0.6, 0.4, 0.019], [0, 0, 1], min, max, r)
    expect(c[0]).toBeGreaterThan(0.5)
    expect(c[1]).toBeGreaterThan(0.5)
    expect(Math.hypot(...c)).toBeCloseTo(1, 6)
  })

  it("cantell de 19 mm: les dues cares grans s'arrodoneixen", () => {
    // Cara +x (cantell): a prop de z = 0.019 s'inclina cap a +z.
    const n = bevelNormal([0.6, 0.2, 0.0185], [1, 0, 0], min, max, r)
    expect(n[2]).toBeGreaterThan(0)
    expect(n[0]).toBeGreaterThan(n[2])
  })
})

describe("màxim de les ateses", () => {
  it("escala la luminància fins al màxim i descarta els no finits", () => {
    const c = clampLum([30, 30, 30], 10)
    expect(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]).toBeCloseTo(10, 6)
    expect(clampLum([1, 2, 3], 10)).toEqual([1, 2, 3])
    expect(clampLum([Infinity, 0, 0], 10)).toEqual([0, 0, 0])
  })
})

describe("empaquetat per a la GPU", () => {
  const tex = (w: number, h: number, v: number): RenderTexture => ({ w, h, data: new Uint8ClampedArray(w * h * 4).fill(v), wrapS: 0, wrapT: 1, flipY: true, lum: 0.5 })

  it("textures seguides en u32 (RGBA little-endian) amb l'inici i la repetició", () => {
    const a = tex(2, 2, 10), b = tex(4, 1, 0)
    b.data.set([1, 2, 3, 4], 0)
    const p = packTextures([a, b], 1 << 20)
    expect(p.entries).toEqual([
      { offset: 0, w: 2, h: 2, flags: 0 | (1 << 2) | (1 << 4) },
      { offset: 4, w: 4, h: 1, flags: 0 | (1 << 2) | (1 << 4) },
    ])
    expect(p.texels[4]).toBe(1 | (2 << 8) | (3 << 16) | (4 << 24))
    expect(p.halvings).toBe(0)
  })

  it("si no hi caben, es redueixen a la meitat", () => {
    const p = packTextures([tex(64, 64, 100), tex(32, 32, 50)], 64 * 64 * 4)
    expect(p.halvings).toBe(1)
    expect(p.entries[0]).toMatchObject({ w: 32, h: 32 })
    expect(p.entries[1]).toMatchObject({ w: 16, h: 16, offset: 32 * 32 })
    expect(halveTexture(tex(3, 3, 8))).toMatchObject({ w: 1, h: 1 })
  })

  it("triangles en l'ordre del BVH amb material, bevel i uv", () => {
    const pos = soup(3)
    const n = pos.length / 9
    // Normals de vèrtex diferents per triangle i vèrtex (per veure que segueixen l'ordre del BVH).
    const normals = new Float32Array(n * 9)
    for (let i = 0; i < n * 3; i++) {
      const a = i * 0.37, z = Math.cos(i * 0.11)
      const r = Math.sqrt(1 - z * z)
      normals.set([r * Math.cos(a), r * Math.sin(a), z], i * 3)
    }
    const scene: RenderScene = {
      positions: pos,
      normals,
      uvs: new Float32Array(n * 6).map((_, i) => i),
      matIndex: new Uint16Array(n).map((_, i) => i % 2),
      triBevel: new Int32Array(n).map((_, i) => (i % 3 ? -1 : 0)),
      bevel: new Float32Array(20),
      materials: [0, 1].map((i) => ({ color: [1, 1, 1] as [number, number, number], map: -1, uv: [1, 0, 0, 0, 1, 0, 0, 0, 1], roughness: 0.5, metalness: 0, opacity: 1, alphaCut: 0, bump: 0, emission: [i * 2, i * 2, i * 2] as [number, number, number], translucent: 0, normalMap: -1, roughMap: -1 })),
      textures: [],
      camera: { ortho: false, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1], scale: 1, aspect: 1 },
      sun: [0, 1, 0],
      background: [1, 1, 1],
      portals: new Float32Array(9),
      interior: false,
      daylight: false,
    }
    const g = packGpuScene(scene, null, 1 << 28)
    expect(g.triCount).toBe(n)
    for (let i = 0; i < n; i++) {
      const t = g.bvh.order[i]!
      const o = i * TRI_VEC4 * 4
      expect(g.tris[o]).toBe(pos[t * 9])
      expect(g.tris[o + 3]).toBe(t % 2)
      expect(g.tris[o + 7]).toBe(t % 3 ? -1 : 0)
      expect(g.tris[o + 4]).toBeCloseTo(pos[t * 9 + 3]! - pos[t * 9]!, 6)
      expect(g.tris[o + 12]).toBe(t * 6)
      // Normals dels vèrtexs del mateix triangle (a n0, n1, n2), dins l'error de l'empaquetat.
      const slots = [o + 11, o + 18, o + 19]
      for (let k = 0; k < 3; k++) {
        const d = decodeNormal(g.tris[slots[k]!]!)
        const e = normals.subarray(t * 9 + k * 3, t * 9 + k * 3 + 3)
        expect(d[0] * e[0]! + d[1] * e[1]! + d[2] * e[2]!).toBeGreaterThan(Math.cos((0.1 * Math.PI) / 180))
      }
    }
    expect(g.portalCount).toBe(1)
    expect(g.portalOff).toBe(g.bevelOff + 5)
    // Emissors: els triangles del material 1 (la meitat), després de les finestres.
    expect(g.emitCount).toBe(n >> 1)
    expect(g.emitOff).toBe(g.portalOff + 3)
    expect(() => packGpuScene(scene, null, 1024)).toThrow(/massa gran/)
  })
})

describe("mapes de normals (base tangent)", () => {
  // Triangle al pla XY: (0,0,0) (2,0,0) (0,1,0), normal +Z.
  const e1 = [2, 0, 0], e2 = [0, 1, 0]
  it("T = dP/du i B = dP/dv per les UV", () => {
    // UV directes: u al llarg de X (0 → 1 en 2 m), v al llarg de Y.
    const f = tangentFrame(e1, e2, 1, 0, 0, 1)!
    expect(f[0]).toEqual([2, 0, 0])
    expect(f[1]).toEqual([0, 1, 0])
    // Textura girada 90°: u al llarg de Y, v cap a −X.
    const g = tangentFrame(e1, e2, 0, -1, 1, 0)!
    expect(g[0][1]).toBeCloseTo(1)
    expect(g[1][0]).toBeCloseTo(-2)
    // UV degenerades.
    expect(tangentFrame(e1, e2, 1, 1, 2, 2)).toBeNull()
  })
  it("la normal plana (0,0,1) no canvia; x i y inclinen cap a T i B", () => {
    const [T, B] = tangentFrame(e1, e2, 1, 0, 0, 1)!
    const n = [0, 0, 1]
    expect(perturbNormal(n, T, B, [0, 0, 1])).toEqual([0, 0, 1])
    const a = perturbNormal(n, T, B, [0.6, 0, 0.8])
    expect(a[0]).toBeCloseTo(0.6)
    expect(a[2]).toBeCloseTo(0.8)
    const b = perturbNormal(n, T, B, [0, 0.6, 0.8])
    expect(b[1]).toBeCloseTo(0.6)
    // UV en mirall (v cap avall): B s'inverteix i la y també (convenció OpenGL respecte de les UV).
    const [T2, B2] = tangentFrame(e1, e2, 1, 0, 0, -1)!
    expect(perturbNormal(n, T2, B2, [0, 0.6, 0.8])[1]).toBeCloseTo(-0.6)
    // Normal girada (cara del darrere): segueix unitària i a l'hemisferi de la normal.
    const c = perturbNormal([0, 0, -1], T, B, [0.6, 0, 0.8])
    expect(Math.hypot(...c)).toBeCloseTo(1)
    expect(c[2]).toBeCloseTo(-0.8)
  })
})

describe("làmpades (triangles emissors)", () => {
  const mat = (e: number) => ({ color: [1, 1, 1] as [number, number, number], map: -1, uv: [1, 0, 0, 0, 1, 0, 0, 0, 1], roughness: 0.5, metalness: 0, opacity: 1, alphaCut: 0, bump: 0, emission: [e, e, e] as [number, number, number], translucent: 0, normalMap: -1, roughMap: -1 })
  // Tres triangles: àrea 0,5 (llum 1), àrea 2 (llum 1) i un que no emet.
  const scene = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 1, 0, 2, 1, 0, 0, 2, 1, 0, 2, 0, 1, 2]),
    matIndex: new Uint16Array([0, 0, 1]),
    materials: [mat(1), mat(0)],
  } as unknown as RenderScene
  it("CDF per àrea × luminància i tria proporcional", () => {
    const em = buildEmitters(scene)
    expect(em.count).toBe(2)
    expect(em.total).toBeCloseTo(2.5)
    expect(em.data[3]).toBe(0)
    expect(em.data[11]).toBeCloseTo(0.2)
    expect(em.data[EMIT_FLOATS + 11]).toBe(1)
    expect(pickEmitter(em, 0.1)).toBe(0)
    expect(pickEmitter(em, 0.3)).toBe(1)
    expect(pickEmitter(em, 0.9999)).toBe(1)
  })
})

describe("pesos d'OIDN", () => {
  it("descarta els punters de Git LFS i els fitxers petits", async () => {
    const { isWeightsFile } = await import("./oidn")
    const ptr = new TextEncoder().encode("version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 12345\n")
    expect(isWeightsFile(ptr.buffer as ArrayBuffer)).toBe(false)
    const big = new Uint8Array(20 * 1024)
    big.set(ptr)
    expect(isWeightsFile(big.buffer)).toBe(false)
    expect(isWeightsFile(new Uint8Array(20 * 1024).fill(7).buffer)).toBe(true)
  })
})

describe("normals llises (interpolades dels vèrtexs)", () => {
  it("empaquetat per a la GPU: ida i tornada a tot l'esfera (error < 0,1°)", () => {
    let worst = 1
    for (let i = 0; i < 2000; i++) {
      const z = 1 - (2 * (i + 0.5)) / 2000, r = Math.sqrt(1 - z * z), a = i * 2.39996
      const n = [r * Math.cos(a), r * Math.sin(a), z]
      const f = encodeNormal(n[0]!, n[1]!, n[2]!)
      // Enter exacte en f32 (el shader el llegeix d'un Float32Array).
      expect(Math.fround(f)).toBe(f)
      expect(f).toBeLessThan(2 ** 24)
      const d = decodeNormal(f)
      worst = Math.min(worst, d[0] * n[0]! + d[1] * n[1]! + d[2] * n[2]!)
    }
    for (const n of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [0, -1, 0]]) expect(decodeNormal(encodeNormal(n[0]!, n[1]!, n[2]!)).map((x) => Math.round(x * 1e4) / 1e4 + 0)).toEqual(n)
    expect(worst).toBeGreaterThan(Math.cos((0.1 * Math.PI) / 180))
  })

  it("a un vèrtex, la normal d'aquell vèrtex; al mig, la mitjana normalitzada", () => {
    const s = Math.SQRT1_2
    // Un triangle amb tres normals diferents (un tros de cilindre).
    const N = new Float32Array([1, 0, 0, s, 0, s, 0, 0, 1])
    const g = [0.7, 0, 0.7]
    expect(smoothNormal(N, 0, 0, 0, g)).toEqual([1, 0, 0])
    const v1 = smoothNormal(N, 0, 1, 0, g)
    expect(v1[0]).toBeCloseTo(s, 6)
    expect(v1[2]).toBeCloseTo(s, 6)
    expect(smoothNormal(N, 0, 0, 1, g)).toEqual([0, 0, 1])
    const mid = smoothNormal(N, 0, 1 / 3, 1 / 3, g)
    expect(Math.hypot(...mid)).toBeCloseTo(1, 6)
    expect(mid[0]).toBeCloseTo(mid[2], 6)
  })

  it("es gira a la cara de la geomètrica (vist per darrere) i sense normals torna la geomètrica", () => {
    const N = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
    expect(smoothNormal(N, 0, 0.2, 0.3, [0, 0, -1])).toEqual([-0, -0, -1])
    expect(smoothNormal(undefined, 0, 0.2, 0.3, [0, 1, 0])).toEqual([0, 1, 0])
    expect(smoothNormal(new Float32Array(9), 0, 0.2, 0.3, [0, 1, 0])).toEqual([0, 1, 0])
  })

  it("una caixa plana: la normal d'ombrejat és la geomètrica a tot arreu", () => {
    // Caixa unitària amb les normals separades per cara (com BoxGeometry): 6 cares × 2 triangles.
    const faces: [number[], number[], number[]][] = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
    ]
    const P: number[] = [], N: number[] = []
    for (const [n, a, b] of faces) {
      const c = n.map((x) => 0.5 + x * 0.5)
      const q = (sa: number, sb: number) => c.map((x, k) => x + (a[k]! * sa + b[k]! * sb) * 0.5)
      for (const t of [[q(-1, -1), q(1, -1), q(1, 1)], [q(-1, -1), q(1, 1), q(-1, 1)]])
        for (const v of t) {
          P.push(...v)
          N.push(...n)
        }
    }
    const pos = new Float32Array(P), nrm = new Float32Array(N)
    let rng = 5
    const r = () => ((rng = (rng * 48271) % 2147483647) / 2147483647)
    for (let t = 0; t < 12; t++) {
      const b = t * 9
      const e1 = [pos[b + 3]! - pos[b]!, pos[b + 4]! - pos[b + 1]!, pos[b + 5]! - pos[b + 2]!]
      const e2 = [pos[b + 6]! - pos[b]!, pos[b + 7]! - pos[b + 1]!, pos[b + 8]! - pos[b + 2]!]
      const g = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!]
      const gl = Math.hypot(g[0]!, g[1]!, g[2]!)
      for (const side of [1, -1]) {
        const gg = g.map((x) => (x / gl) * side)
        for (let k = 0; k < 5; k++) {
          const u = r() * 0.5, v = r() * 0.5
          const s = smoothNormal(nrm, t, u, v, gg)
          for (let a = 0; a < 3; a++) expect(s[a]).toBeCloseTo(gg[a]!, 6)
        }
      }
    }
  })
})

describe("normals dels taulers amb forma (cantells corbs)", () => {
  it("taula rodona: el cantell, llis (radial); les cares, planes; un rectangle no canvia", async () => {
    const { cutoutGeometry } = await import("../cutoutGeometry")
    const R = 300, k = Math.tan(Math.PI / 8)
    const panel = { length: 2 * R, width: 2 * R, thickness: 40, outline: [[2 * R, R, k], [R, 2 * R, k], [0, R, k], [R, 0, k]], cutouts: [] }
    const g = cutoutGeometry(panel as unknown as Parameters<typeof cutoutGeometry>[0])
    const p = g.getAttribute("position"), n = g.getAttribute("normal")
    let side = 0
    for (let i = 0; i < p.count; i++) {
      const nz = n.getZ(i)
      if (Math.abs(nz) > 0.999) continue
      // Cantell: la normal és la radial del punt (no la de la faceta).
      side++
      const rx = p.getX(i) - 0.3, ry = p.getY(i) - 0.3, rl = Math.hypot(rx, ry)
      expect(Math.abs(nz)).toBeLessThan(1e-6)
      expect((n.getX(i) * rx + n.getY(i) * ry) / rl).toBeGreaterThan(Math.cos((1 * Math.PI) / 180))
    }
    expect(side).toBeGreaterThan(100)
    const rect = cutoutGeometry({ length: 600, width: 400, thickness: 19, cutouts: [] } as unknown as Parameters<typeof cutoutGeometry>[0])
    const rp = rect.getAttribute("normal")
    // Totes les normals del rectangle alineades amb un eix (arestes vives de 90°).
    for (let i = 0; i < rp.count; i++) expect(Math.max(Math.abs(rp.getX(i)), Math.abs(rp.getY(i)), Math.abs(rp.getZ(i)))).toBeCloseTo(1, 6)
  })
})

describe("càmera de fotògraf (`photoCamera`)", async () => {
  const { photoCamera } = await import("./sceneData")
  const { Matrix4, PerspectiveCamera, Vector3 } = await import("three")
  const cam = (pos: [number, number, number], target: [number, number, number]) => {
    const c = new PerspectiveCamera(40, 1.5)
    c.position.set(...pos)
    c.lookAt(...target)
    c.updateMatrixWorld(true)
    return { ortho: false, matrix: Array.from(c.matrixWorld.elements), scale: Math.tan((20 * Math.PI) / 180), aspect: 1.5 }
  }
  it("verticals rectes: càmera anivellada i el centre de la imatge on mirava", () => {
    const c = cam([2, 1.6, 3], [0, 0.4, 0])
    const p = photoCamera(c, { straight: true })
    const m = new Matrix4().fromArray(p.matrix)
    const right = new Vector3().setFromMatrixColumn(m, 0), up = new Vector3().setFromMatrixColumn(m, 1), back = new Vector3().setFromMatrixColumn(m, 2)
    expect(up.y).toBeCloseTo(1)
    expect(right.y).toBeCloseTo(0)
    expect(back.y).toBeCloseTo(0)
    // Raig del centre: amunt × shift − enrere = la direcció d'abans.
    const center = up.clone().multiplyScalar(p.shift!).sub(back).normalize()
    const before = new Vector3(-c.matrix[8]!, -c.matrix[9]!, -c.matrix[10]!).normalize()
    expect(center.distanceTo(before)).toBeLessThan(1e-6)
    // Sense l'opció, igual; mirant de dalt (> 60°), no es toca.
    expect(photoCamera(c, { straight: false })).toBe(c)
    const top = cam([0, 5, 0.5], [0, 0, 0])
    expect(photoCamera(top, { straight: true }).shift).toBeUndefined()
  })
  it("objectiu: 36 mm al costat llarg", () => {
    const c = cam([2, 1.6, 3], [0, 0.4, 0])
    expect(photoCamera(c, { focal: 36 }).scale * 1.5).toBeCloseTo(0.5)
    expect(photoCamera({ ...c, aspect: 0.8 }, { focal: 36 }).scale).toBeCloseTo(0.5)
  })
})

describe("vista per les finestres (`backdrops.ts`)", async () => {
  const { photoPanorama, aimBackdrop } = await import("./backdrops")
  const { PerspectiveCamera } = await import("three")
  const cam = (pos: [number, number, number], target: [number, number, number]) => {
    const c = new PerspectiveCamera(40, 1.5)
    c.position.set(...pos)
    c.lookAt(...target)
    c.updateMatrixWorld(true)
    return { ortho: false, matrix: Array.from(c.matrixWorld.elements), scale: 0.36, aspect: 1.5 }
  }
  // Foto 400 × 300: meitat de dalt vermella, de baix verda (l'horitzó al mig).
  const W = 400, H = 300
  const photo = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) photo.set(y < H / 2 ? [255, 0, 0, 255] : [0, 255, 0, 255], (y * W + x) * 4)
  it("una foto normal: davant, tal qual; a dalt, el cel del motor (alfa 0); a baix, opac; als costats, en mirall", () => {
    const p = photoPanorama(W, H, photo)
    const at = (u: number, el: number) => {
      const x = Math.floor(u * p.w), y = Math.floor((0.5 - el / 180) * p.h)
      return Array.from(p.data.subarray((y * p.w + x) * 4, (y * p.w + x) * 4 + 4))
    }
    expect(p.hero).toBe(0.5)
    expect(at(0.5, 5)).toEqual([255, 0, 0, 255])
    expect(at(0.5, -5)).toEqual([0, 255, 0, 255])
    expect(at(0.5, 60)[3]).toBe(0)
    expect(at(0.5, -70)[3]).toBe(255)
    // Darrere de la càmera també hi ha foto (mirall), no un forat.
    expect(at(0.02, -5)).toEqual([0, 255, 0, 255])
  })
  it("un panorama 2:1 es fa servir tal qual", () => {
    const d = new Uint8ClampedArray(64 * 32 * 4)
    expect(photoPanorama(64, 32, d).data).toBe(d)
  })
  it("la part bona del panorama queda davant de la càmera (com mira el motor)", () => {
    const w = 64, h = 32
    const d = new Uint8ClampedArray(w * h * 4)
    const hero = 0.25
    for (let y = 0; y < h; y++) d[(y * w + Math.floor(hero * w)) * 4] = 255
    for (const [eye, target] of [[[0, 1.6, 3], [0, 1.6, 0]], [[0, 1.6, 0], [3, 1.6, 0]], [[1, 1.6, 1], [0, 1.6, 2]]] as [number[], number[]][]) {
      const c = cam(eye as [number, number, number], target as [number, number, number])
      for (const rot of [0, 90]) {
        const t = aimBackdrop({ w, h, data: d, hero }, c, rot)
        const fx = target[0]! - eye[0]!, fz = target[2]! - eye[2]!
        const n = Math.hypot(fx, fz)
        let u = (Math.atan2(fx / n, -fz / n) / (2 * Math.PI) + 0.5 + rot / 360) % 1
        if (u < 0) u += 1
        const x = Math.round(u * w) % w
        const row = Array.from({ length: w }, (_, i) => t.data[(h / 2 * w + i) * 4]!)
        const got = row.indexOf(255)
        expect(Math.min(Math.abs(got - x), w - Math.abs(got - x))).toBeLessThanOrEqual(1)
      }
    }
  })
})
