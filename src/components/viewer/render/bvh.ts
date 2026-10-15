/**
 * BVH dels triangles del render, compartit pel path tracer de CPU (`pathWorker`) i el de GPU
 * (`gpuTracer`): es construeix amb SAH per calaixos (12 per eix) i es desa empaquetat, 8
 * paraules de 32 bits per node, tal com el llegeix el shader:
 *
 * - `[0..2]` mínim (f32) · `[3]` fulla: primer triangle (a `order`); interior: fill dret (u32)
 * - `[4..6]` màxim (f32) · `[7]` fulla: nombre de triangles; interior: `INTERNAL | eix`
 *
 * El fill esquerre d'un node interior és sempre el següent (`n + 1`).
 */
export const NODE_WORDS = 8
export const INTERNAL = 0x80000000
const LEAF_MAX = 4
const BINS = 12

export interface Bvh {
  /** Nodes empaquetats (vistes `f32` i `u32` del mateix buffer). */
  f32: Float32Array
  u32: Uint32Array
  count: number
  /** Ordre dels triangles: les fulles en fan servir trossos seguits. */
  order: Uint32Array
}

/** `pos`: 9 floats per triangle (coordenades del món). */
export function buildBvh(pos: Float32Array): Bvh {
  const triCount = Math.floor(pos.length / 9)
  const order = new Uint32Array(triCount)
  for (let i = 0; i < triCount; i++) order[i] = i
  const cap = Math.max(1, triCount * 2)
  const buf = new ArrayBuffer(cap * NODE_WORDS * 4)
  const f32 = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  if (!triCount) {
    // Un node buit que no toca res (caixa al revés).
    f32.set([1, 1, 1], 0)
    f32.set([-1, -1, -1], 4)
    u32[3] = 0
    u32[7] = 0
    return { f32, u32, count: 1, order }
  }
  // Caixa i centre de cada triangle.
  const bmin = new Float32Array(triCount * 3), bmax = new Float32Array(triCount * 3), cen = new Float32Array(triCount * 3)
  for (let t = 0; t < triCount; t++)
    for (let a = 0; a < 3; a++) {
      const x0 = pos[t * 9 + a]!, x1 = pos[t * 9 + 3 + a]!, x2 = pos[t * 9 + 6 + a]!
      bmin[t * 3 + a] = Math.min(x0, x1, x2)
      bmax[t * 3 + a] = Math.max(x0, x1, x2)
      cen[t * 3 + a] = (x0 + x1 + x2) / 3
    }
  let nodes = 0
  const binMin = new Float32Array(BINS * 3), binMax = new Float32Array(BINS * 3), binCnt = new Uint32Array(BINS)
  const rArea = new Float64Array(BINS), rCnt = new Uint32Array(BINS)
  const area = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0
    return dx < 0 ? 0 : dx * dy + dy * dz + dz * dx
  }

  const build = (start: number, count: number): number => {
    const n = nodes++
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity
    let cmn0 = Infinity, cmn1 = Infinity, cmn2 = Infinity, cmx0 = -Infinity, cmx1 = -Infinity, cmx2 = -Infinity
    for (let i = start; i < start + count; i++) {
      const t = order[i]! * 3
      if (bmin[t]! < mnx) mnx = bmin[t]!
      if (bmin[t + 1]! < mny) mny = bmin[t + 1]!
      if (bmin[t + 2]! < mnz) mnz = bmin[t + 2]!
      if (bmax[t]! > mxx) mxx = bmax[t]!
      if (bmax[t + 1]! > mxy) mxy = bmax[t + 1]!
      if (bmax[t + 2]! > mxz) mxz = bmax[t + 2]!
      const c0 = cen[t]!, c1 = cen[t + 1]!, c2 = cen[t + 2]!
      if (c0 < cmn0) cmn0 = c0
      if (c1 < cmn1) cmn1 = c1
      if (c2 < cmn2) cmn2 = c2
      if (c0 > cmx0) cmx0 = c0
      if (c1 > cmx1) cmx1 = c1
      if (c2 > cmx2) cmx2 = c2
    }
    const o = n * NODE_WORDS
    f32[o] = mnx; f32[o + 1] = mny; f32[o + 2] = mnz
    f32[o + 4] = mxx; f32[o + 5] = mxy; f32[o + 6] = mxz
    const leaf = () => {
      u32[o + 3] = start
      u32[o + 7] = count
      return n
    }
    if (count <= LEAF_MAX) return leaf()

    // SAH per calaixos: el millor tall dels tres eixos.
    const cmn = [cmn0, cmn1, cmn2], cmx = [cmx0, cmx1, cmx2]
    let bestAxis = -1, bestBin = 0, bestCost = Infinity
    for (let axis = 0; axis < 3; axis++) {
      const lo = cmn[axis]!, ext = cmx[axis]! - lo
      if (!(ext > 1e-9)) continue
      const k = BINS / ext
      binCnt.fill(0)
      binMin.fill(Infinity)
      binMax.fill(-Infinity)
      for (let i = start; i < start + count; i++) {
        const t = order[i]!
        const b = Math.min(BINS - 1, Math.floor((cen[t * 3 + axis]! - lo) * k))
        binCnt[b]!++
        for (let a = 0; a < 3; a++) {
          if (bmin[t * 3 + a]! < binMin[b * 3 + a]!) binMin[b * 3 + a] = bmin[t * 3 + a]!
          if (bmax[t * 3 + a]! > binMax[b * 3 + a]!) binMax[b * 3 + a] = bmax[t * 3 + a]!
        }
      }
      // De dreta a esquerra: àrea i nombre de la part dreta de cada tall.
      let rx0 = Infinity, ry0 = Infinity, rz0 = Infinity, rx1 = -Infinity, ry1 = -Infinity, rz1 = -Infinity, rc = 0
      for (let b = BINS - 1; b > 0; b--) {
        rx0 = Math.min(rx0, binMin[b * 3]!); ry0 = Math.min(ry0, binMin[b * 3 + 1]!); rz0 = Math.min(rz0, binMin[b * 3 + 2]!)
        rx1 = Math.max(rx1, binMax[b * 3]!); ry1 = Math.max(ry1, binMax[b * 3 + 1]!); rz1 = Math.max(rz1, binMax[b * 3 + 2]!)
        rc += binCnt[b]!
        rArea[b] = area(rx0, ry0, rz0, rx1, ry1, rz1)
        rCnt[b] = rc
      }
      let lx0 = Infinity, ly0 = Infinity, lz0 = Infinity, lx1 = -Infinity, ly1 = -Infinity, lz1 = -Infinity, lc = 0
      for (let b = 0; b < BINS - 1; b++) {
        lx0 = Math.min(lx0, binMin[b * 3]!); ly0 = Math.min(ly0, binMin[b * 3 + 1]!); lz0 = Math.min(lz0, binMin[b * 3 + 2]!)
        lx1 = Math.max(lx1, binMax[b * 3]!); ly1 = Math.max(ly1, binMax[b * 3 + 1]!); lz1 = Math.max(lz1, binMax[b * 3 + 2]!)
        lc += binCnt[b]!
        if (!lc || !rCnt[b + 1]) continue
        const cost = area(lx0, ly0, lz0, lx1, ly1, lz1) * lc + rArea[b + 1]! * rCnt[b + 1]!
        if (cost < bestCost) {
          bestCost = cost
          bestAxis = axis
          bestBin = b
        }
      }
    }
    let leftCount: number
    let axis = bestAxis
    if (bestAxis < 0) {
      // Tots els centres al mateix punt: es parteix per la meitat.
      axis = 0
      leftCount = count >> 1
    } else {
      const parentArea = area(mnx, mny, mnz, mxx, mxy, mxz)
      // Fulla si partir no surt a compte (cost de travessar ≈ 1 triangle).
      if (count <= 8 && bestCost >= parentArea * (count - 1)) return leaf()
      const lo = cmn[axis]!, k = BINS / (cmx[axis]! - lo)
      let i = start, j = start + count - 1
      while (i <= j) {
        const b = Math.min(BINS - 1, Math.floor((cen[order[i]! * 3 + axis]! - lo) * k))
        if (b <= bestBin) i++
        else {
          const tmp = order[i]!
          order[i] = order[j]!
          order[j] = tmp
          j--
        }
      }
      leftCount = i - start
      if (leftCount === 0 || leftCount === count) leftCount = count >> 1
    }
    build(start, leftCount)
    const right = build(start + leftCount, count - leftCount)
    u32[o + 3] = right
    u32[o + 7] = (INTERNAL | axis) >>> 0
    return n
  }
  build(0, triCount)
  return { f32: f32.subarray(0, nodes * NODE_WORDS), u32: u32.subarray(0, nodes * NODE_WORDS), count: nodes, order }
}

interface BvhHit {
  t: number
  tri: number
  u: number
  v: number
}

/**
 * Intersecció més propera (sense filtres de material): per a l'enfocament de la càmera i els
 * tests. El worker de CPU en fa una còpia en línia (més ràpida, amb el vidre i els retalls).
 */
export function intersectBvh(bvh: Bvh, pos: Float32Array, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMax = Infinity): BvhHit | null {
  const { f32, u32 } = bvh
  const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz
  const stack: number[] = [0]
  let best: BvhHit | null = null
  let hitT = tMax
  while (stack.length) {
    const n = stack.pop()! * NODE_WORDS
    let t0 = (f32[n]! - ox) * idx, t1 = (f32[n + 4]! - ox) * idx
    let tmin = Math.min(t0, t1), tmax = Math.max(t0, t1)
    t0 = (f32[n + 1]! - oy) * idy; t1 = (f32[n + 5]! - oy) * idy
    tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1))
    t0 = (f32[n + 2]! - oz) * idz; t1 = (f32[n + 6]! - oz) * idz
    tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1))
    if (tmax < Math.max(tmin, 0) || tmin > hitT) continue
    const meta = u32[n + 7]!
    if (meta < INTERNAL) {
      for (let i = u32[n + 3]!, e = i + meta; i < e; i++) {
        const t = bvh.order[i]!
        const h = triHit(pos, t, ox, oy, oz, dx, dy, dz)
        if (h && h.t < hitT) {
          hitT = h.t
          best = h
        }
      }
    } else {
      // El fill més proper a l'origen, primer (es posa l'últim a la pila).
      const near = n / NODE_WORDS + 1, far = u32[n + 3]!
      const axis = meta & 3
      const neg = axis === 0 ? dx < 0 : axis === 1 ? dy < 0 : dz < 0
      if (neg) stack.push(near, far)
      else stack.push(far, near)
    }
  }
  return best
}

/** Möller–Trumbore. */
export function triHit(pos: Float32Array, t: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): BvhHit | null {
  const b = t * 9
  const ax = pos[b]!, ay = pos[b + 1]!, az = pos[b + 2]!
  const e1x = pos[b + 3]! - ax, e1y = pos[b + 4]! - ay, e1z = pos[b + 5]! - az
  const e2x = pos[b + 6]! - ax, e2y = pos[b + 7]! - ay, e2z = pos[b + 8]! - az
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x
  const det = e1x * px + e1y * py + e1z * pz
  if (Math.abs(det) < 1e-12) return null
  const inv = 1 / det
  const tx = ox - ax, ty = oy - ay, tz = oz - az
  const u = (tx * px + ty * py + tz * pz) * inv
  if (u < 0 || u > 1) return null
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x
  const v = (dx * qx + dy * qy + dz * qz) * inv
  if (v < 0 || u + v > 1) return null
  const d = (e2x * qx + e2y * qy + e2z * qz) * inv
  return d > 1e-5 ? { t: d, tri: t, u, v } : null
}
