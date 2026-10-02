import { buildBvh, type Bvh } from "./bvh"
import { EMIT_FLOATS, buildEmitters } from "./emitters"
import { buildEnvCdf } from "./envSampling"
import type { RenderEnv, RenderScene, RenderTexture } from "./sceneData"
import { encodeNormal } from "./shading"

/**
 * L'escena del render empaquetada per a la GPU (`gpuTracer`): buffers d'emmagatzematge plans,
 * sense textures de GPU (així no hi ha límit d'unitats de textura, el problema dels Mac/iPhone
 * amb three-gpu-pathtracer). Tot és pur (sense WebGPU): es prova amb Vitest.
 *
 * - `tris`: 5 vec4 per triangle, en l'ordre del BVH: (v0, material) (e1, malla bevel) (e2, n0)
 *   (uv0, uv1) (uv2, n1, n2). Les normals dels vèrtexs n0–n2 van en un float cadascuna
 *   (`encodeNormal`: octaedre de 12 + 12 bits), als buits: el buffer no creix.
 * - `nodes`: el BVH de `bvh.ts`, tal qual.
 * - `info` (vec4): materials (6 per material), textures (1, u32: inici, w, h, repetició),
 *   malles amb bevel (5), finestres (3) i triangles emissors (4, `emitters.ts`).
 * - `texels`: totes les textures RGBA8 seguides (un u32 per texel).
 * - `env`: cel HDRI RGB, la CDF marginal (h + 1) i la condicional (h × (w + 1)).
 */
export const TRI_VEC4 = 5
export const MAT_VEC4 = 6
export const BEVEL_VEC4 = 5
export const PORTAL_VEC4 = 3

export interface PackedTextures {
  texels: Uint32Array
  /** Per textura: inici (en texels), w, h, repetició (wrapS | wrapT << 2 | flipY << 4 | lineal << 5). */
  entries: { offset: number; w: number; h: number; flags: number }[]
  /** Quantes vegades s'han reduït a la meitat per cabre (0 = mida original). */
  halvings: number
}

/** Redueix una textura RGBA8 a la meitat (mitjana de 2×2). */
export function halveTexture(t: RenderTexture): RenderTexture {
  if (t.w <= 1 && t.h <= 1) return t
  const w = Math.max(1, t.w >> 1), h = Math.max(1, t.h >> 1)
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) {
            const xx = Math.min(t.w - 1, x * 2 + i), yy = Math.min(t.h - 1, y * 2 + j)
            s += t.data[(yy * t.w + xx) * 4 + c]!
          }
        out[(y * w + x) * 4 + c] = s / 4
      }
  return { ...t, w, h, data: out }
}

/** Totes les textures en un sol buffer de u32; si no hi caben (`maxBytes`), es redueixen. */
export function packTextures(textures: RenderTexture[], maxBytes: number): PackedTextures {
  let list = textures
  let halvings = 0
  const words = (l: RenderTexture[]) => l.reduce((s, t) => s + t.w * t.h, 0)
  while (words(list) * 4 > maxBytes && list.some((t) => t.w > 1 || t.h > 1)) {
    list = list.map(halveTexture)
    halvings++
  }
  const texels = new Uint32Array(Math.max(1, words(list)))
  const entries: PackedTextures["entries"] = []
  let off = 0
  for (const t of list) {
    const n = t.w * t.h
    // RGBA8 en ordre de bytes = u32 little-endian (el que llegeix `unpack4x8unorm`).
    const src = new Uint8Array(t.data.buffer, t.data.byteOffset, n * 4)
    new Uint8Array(texels.buffer, off * 4, n * 4).set(src)
    entries.push({ offset: off, w: t.w, h: t.h, flags: t.wrapS | (t.wrapT << 2) | ((t.flipY ? 1 : 0) << 4) | ((t.linear ? 1 : 0) << 5) })
    off += n
  }
  return { texels, entries, halvings }
}

export interface GpuScene {
  tris: Float32Array
  nodes: Uint32Array
  info: Uint32Array
  matOff: number
  texOff: number
  bevelOff: number
  portalOff: number
  portalCount: number
  emitOff: number
  emitCount: number
  /** Σ àrea × luminància dels emissors. */
  emitTotal: number
  texels: Uint32Array
  texHalvings: number
  env: Float32Array
  envW: number
  envH: number
  envMarginal: number
  envConditional: number
  envTotal: number
  triCount: number
  bvh: Bvh
}

/** Escena massa gran per a la GPU (es fa per CPU). */
export class GpuLimitError extends Error {}

export function packGpuScene(scene: RenderScene, env: RenderEnv | null, maxBinding: number): GpuScene {
  const triCount = scene.matIndex.length
  const bvh = buildBvh(scene.positions)
  const tris = new Float32Array(Math.max(1, triCount) * TRI_VEC4 * 4)
  const P = scene.positions, UV = scene.uvs, N = scene.normals as Float32Array | undefined
  for (let i = 0; i < triCount; i++) {
    const t = bvh.order[i]!
    const o = i * TRI_VEC4 * 4, p = t * 9, u = t * 6
    tris[o] = P[p]!; tris[o + 1] = P[p + 1]!; tris[o + 2] = P[p + 2]!; tris[o + 3] = scene.matIndex[t]!
    tris[o + 4] = P[p + 3]! - P[p]!; tris[o + 5] = P[p + 4]! - P[p + 1]!; tris[o + 6] = P[p + 5]! - P[p + 2]!; tris[o + 7] = scene.triBevel[t] ?? -1
    tris[o + 8] = P[p + 6]! - P[p]!; tris[o + 9] = P[p + 7]! - P[p + 1]!; tris[o + 10] = P[p + 8]! - P[p + 2]!
    for (let k = 0; k < 6; k++) tris[o + 12 + k] = UV[u + k]!
    // Normals dels vèrtexs (sense: la de la cara).
    let fx = tris[o + 5]! * tris[o + 10]! - tris[o + 6]! * tris[o + 9]!, fy = tris[o + 6]! * tris[o + 8]! - tris[o + 4]! * tris[o + 10]!, fz = tris[o + 4]! * tris[o + 9]! - tris[o + 5]! * tris[o + 8]!
    const fl = Math.hypot(fx, fy, fz) || 1
    fx /= fl; fy /= fl; fz /= fl
    const nv = (k: number) => (N && N.length >= p + 9 ? encodeNormal(N[p + k * 3]!, N[p + k * 3 + 1]!, N[p + k * 3 + 2]!) : encodeNormal(fx, fy, fz))
    tris[o + 11] = nv(0)
    tris[o + 18] = nv(1)
    tris[o + 19] = nv(2)
  }
  const tex = packTextures(scene.textures, Math.min(maxBinding, 256 * 1024 * 1024))

  const nMat = scene.materials.length, nTex = tex.entries.length, nBevel = scene.bevel.length / 20, nPortal = scene.portals.length / 9
  const matOff = 0
  const texOff = matOff + nMat * MAT_VEC4
  const bevelOff = texOff + nTex
  const portalOff = bevelOff + nBevel * BEVEL_VEC4
  const em = buildEmitters(scene)
  const emitOff = portalOff + nPortal * PORTAL_VEC4
  const total = emitOff + em.count * (EMIT_FLOATS / 4)
  const info = new Uint32Array(Math.max(1, total) * 4)
  const f = new Float32Array(info.buffer)
  scene.materials.forEach((m, i) => {
    const o = (matOff + i * MAT_VEC4) * 4
    const e = m.uv
    const em = m.emission ?? [0, 0, 0]
    f.set([m.color[0], m.color[1], m.color[2], m.map, e[0]!, e[1]!, e[3]!, e[4]!, e[6]!, e[7]!, m.roughness, m.metalness, m.opacity, m.alphaCut, m.bump, scene.textures[m.map]?.lum ?? 0, em[0], em[1], em[2], m.translucent ?? 0, m.normalMap ?? -1, m.roughMap ?? -1, 0, 0], o)
  })
  tex.entries.forEach((t, i) => info.set([t.offset, t.w, t.h, t.flags], (texOff + i) * 4))
  f.set(scene.bevel, bevelOff * 4)
  for (let i = 0; i < nPortal; i++) {
    const o = (portalOff + i * PORTAL_VEC4) * 4
    const q = scene.portals.subarray(i * 9, i * 9 + 9)
    f.set([q[0]!, q[1]!, q[2]!, 0, q[3]!, q[4]!, q[5]!, 0, q[6]!, q[7]!, q[8]!, 0], o)
  }

  f.set(em.data, emitOff * 4)

  let envData = new Float32Array(4)
  let envMarginal = 0, envConditional = 0, envTotal = 0
  if (env) {
    const cdf = buildEnvCdf(env)
    envMarginal = env.w * env.h * 3
    envConditional = envMarginal + env.h + 1
    envData = new Float32Array(envConditional + env.h * (env.w + 1))
    envData.set(env.data, 0)
    envData.set(cdf.marginal, envMarginal)
    envData.set(cdf.conditional, envConditional)
    envTotal = cdf.total
  }
  for (const [name, b] of [["triangles", tris], ["BVH", bvh.u32], ["materials", info], ["textures", tex.texels], ["cel HDRI", envData]] as const)
    if (b.byteLength > maxBinding) throw new GpuLimitError(`L'escena és massa gran per a la GPU (${name}: ${Math.round(b.byteLength / 1048576)} MB; màxim ${Math.round(maxBinding / 1048576)} MB).`)
  return {
    tris,
    nodes: new Uint32Array(bvh.u32),
    info,
    matOff,
    texOff,
    bevelOff,
    portalOff,
    portalCount: nPortal,
    emitOff,
    emitCount: em.count,
    emitTotal: em.total,
    texels: tex.texels,
    texHalvings: tex.halvings,
    env: envData,
    envW: env?.w ?? 0,
    envH: env?.h ?? 0,
    envMarginal,
    envConditional,
    envTotal,
    triCount,
    bvh,
  }
}
