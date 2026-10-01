import { describe, expect, it } from "vitest"
import { buildBvh, INTERNAL, intersectBvh, NODE_WORDS, triHit } from "./bvh"
import { buildEnvCdf, dirToUv, envPdf, sampleEnv, uvToDir } from "./envSampling"
import { halveTexture, packGpuScene, packTextures, TRI_VEC4 } from "./gpuScene"
import type { RenderEnv, RenderScene, RenderTexture } from "./sceneData"
import { bevelNormal, clampLum } from "./shading"

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
    const scene: RenderScene = {
      positions: pos,
      uvs: new Float32Array(n * 6).map((_, i) => i),
      matIndex: new Uint16Array(n).map((_, i) => i % 2),
      triBevel: new Int32Array(n).map((_, i) => (i % 3 ? -1 : 0)),
      bevel: new Float32Array(20),
      materials: [0, 1].map(() => ({ color: [1, 1, 1] as [number, number, number], map: -1, uv: [1, 0, 0, 0, 1, 0, 0, 0, 1], roughness: 0.5, metalness: 0, opacity: 1, alphaCut: 0, bump: 0 })),
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
    }
    expect(g.portalCount).toBe(1)
    expect(g.portalOff).toBe(g.bevelOff + 5)
    expect(() => packGpuScene(scene, null, 1024)).toThrow(/massa gran/)
  })
})
