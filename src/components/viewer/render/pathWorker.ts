/// <reference lib="webworker" />
/**
 * Path tracer per CPU (com el render físic de Cinema 4D): cada worker calcula passades
 * senceres d'una mostra per píxel i les envia al fil principal, que les acumula. Llum: cel
 * d'estudi + sol amb ombres suaus; materials difusos amb una mica de reflex, metalls i
 * transparència. Triangles en un BVH propi.
 */
import type { RenderScene } from "./sceneData"

type Msg = { type: "scene"; scene: RenderScene; width: number; height: number; seed: number } | { type: "stop" }

let S: RenderScene | null = null
let W = 0
let H = 0
let running = false
let rng = 1

const random = () => {
  // xorshift32
  rng ^= rng << 13
  rng ^= rng >>> 17
  rng ^= rng << 5
  return (rng >>> 0) / 4294967296
}

// --- BVH ------------------------------------------------------------------------------
let triCount = 0
let tri: Float32Array // 9 per triangle
let order: Uint32Array
let nodeMin: Float32Array
let nodeMax: Float32Array
let nodeLeft: Int32Array // fill esquerre (el dret és el següent del seu subarbre) o -1 si fulla
let nodeRight: Int32Array
let nodeStart: Uint32Array
let nodeCount: Uint32Array
let nodes = 0

function buildBVH(pos: Float32Array) {
  triCount = pos.length / 9
  tri = pos
  order = new Uint32Array(triCount)
  for (let i = 0; i < triCount; i++) order[i] = i
  const cap = triCount * 2 + 1
  nodeMin = new Float32Array(cap * 3)
  nodeMax = new Float32Array(cap * 3)
  nodeLeft = new Int32Array(cap)
  nodeRight = new Int32Array(cap)
  nodeStart = new Uint32Array(cap)
  nodeCount = new Uint32Array(cap)
  const cen = new Float32Array(triCount * 3)
  for (let t = 0; t < triCount; t++)
    for (let a = 0; a < 3; a++) cen[t * 3 + a] = (pos[t * 9 + a]! + pos[t * 9 + 3 + a]! + pos[t * 9 + 6 + a]!) / 3
  nodes = 0
  const build = (start: number, count: number): number => {
    const n = nodes++
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity
    let cmnx = Infinity, cmny = Infinity, cmnz = Infinity, cmxx = -Infinity, cmxy = -Infinity, cmxz = -Infinity
    for (let i = start; i < start + count; i++) {
      const t = order[i]!
      for (let k = 0; k < 3; k++) {
        const x = pos[t * 9 + k * 3]!, y = pos[t * 9 + k * 3 + 1]!, z = pos[t * 9 + k * 3 + 2]!
        if (x < mnx) mnx = x
        if (y < mny) mny = y
        if (z < mnz) mnz = z
        if (x > mxx) mxx = x
        if (y > mxy) mxy = y
        if (z > mxz) mxz = z
      }
      const cx = cen[t * 3]!, cy = cen[t * 3 + 1]!, cz = cen[t * 3 + 2]!
      if (cx < cmnx) cmnx = cx
      if (cy < cmny) cmny = cy
      if (cz < cmnz) cmnz = cz
      if (cx > cmxx) cmxx = cx
      if (cy > cmxy) cmxy = cy
      if (cz > cmxz) cmxz = cz
    }
    nodeMin[n * 3] = mnx; nodeMin[n * 3 + 1] = mny; nodeMin[n * 3 + 2] = mnz
    nodeMax[n * 3] = mxx; nodeMax[n * 3 + 1] = mxy; nodeMax[n * 3 + 2] = mxz
    if (count <= 4) {
      nodeLeft[n] = -1
      nodeStart[n] = start
      nodeCount[n] = count
      return n
    }
    const ex = cmxx - cmnx, ey = cmxy - cmny, ez = cmxz - cmnz
    const axis = ex > ey && ex > ez ? 0 : ey > ez ? 1 : 2
    const mid = axis === 0 ? (cmnx + cmxx) / 2 : axis === 1 ? (cmny + cmxy) / 2 : (cmnz + cmxz) / 2
    let i = start
    let j = start + count - 1
    while (i <= j) {
      if (cen[order[i]! * 3 + axis]! < mid) i++
      else {
        const tmp = order[i]!
        order[i] = order[j]!
        order[j] = tmp
        j--
      }
    }
    let leftCount = i - start
    if (leftCount === 0 || leftCount === count) leftCount = count >> 1
    nodeLeft[n] = build(start, leftCount)
    nodeRight[n] = build(start + leftCount, count - leftCount)
    return n
  }
  if (triCount) build(0, triCount)
}

const stack = new Int32Array(128)
// Resultat de la intersecció.
let hitT = 0, hitTri = -1, hitU = 0, hitV = 0

function intersect(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMax: number, any: boolean): boolean {
  hitT = tMax
  hitTri = -1
  if (!triCount) return false
  const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz
  let sp = 0
  stack[sp++] = 0
  while (sp > 0) {
    const n = stack[--sp]!
    // Caixa.
    let t0 = (nodeMin[n * 3]! - ox) * idx, t1 = (nodeMax[n * 3]! - ox) * idx
    let tmin = Math.min(t0, t1), tmax = Math.max(t0, t1)
    t0 = (nodeMin[n * 3 + 1]! - oy) * idy
    t1 = (nodeMax[n * 3 + 1]! - oy) * idy
    tmin = Math.max(tmin, Math.min(t0, t1))
    tmax = Math.min(tmax, Math.max(t0, t1))
    t0 = (nodeMin[n * 3 + 2]! - oz) * idz
    t1 = (nodeMax[n * 3 + 2]! - oz) * idz
    tmin = Math.max(tmin, Math.min(t0, t1))
    tmax = Math.min(tmax, Math.max(t0, t1))
    if (tmax < Math.max(tmin, 0) || tmin > hitT) continue
    if (nodeLeft[n]! < 0) {
      const s = nodeStart[n]!, e = s + nodeCount[n]!
      for (let i = s; i < e; i++) {
        const t = order[i]!
        const b = t * 9
        const ax = tri[b]!, ay = tri[b + 1]!, az = tri[b + 2]!
        const e1x = tri[b + 3]! - ax, e1y = tri[b + 4]! - ay, e1z = tri[b + 5]! - az
        const e2x = tri[b + 6]! - ax, e2y = tri[b + 7]! - ay, e2z = tri[b + 8]! - az
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x
        const det = e1x * px + e1y * py + e1z * pz
        if (Math.abs(det) < 1e-12) continue
        const inv = 1 / det
        const tx = ox - ax, ty = oy - ay, tz = oz - az
        const u = (tx * px + ty * py + tz * pz) * inv
        if (u < 0 || u > 1) continue
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x
        const v = (dx * qx + dy * qy + dz * qz) * inv
        if (v < 0 || u + v > 1) continue
        const d = (e2x * qx + e2y * qy + e2z * qz) * inv
        if (d > 1e-5 && d < hitT) {
          hitT = d
          hitTri = t
          hitU = u
          hitV = v
          if (any) return true
        }
      }
    } else {
      stack[sp++] = nodeLeft[n]!
      stack[sp++] = nodeRight[n]!
    }
  }
  return hitTri >= 0
}

// --- Materials i textures ----------------------------------------------------------------
const LIN = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
const wrap = (x: number, mode: number) => {
  if (mode === 2) return Math.min(1, Math.max(0, x))
  const f = x - Math.floor(x)
  if (mode === 1 && Math.floor(x) % 2 !== 0) return 1 - f
  return f
}
/** Albedo (lineal) al punt tocat. */
const alb = [0, 0, 0]
function albedo(t: number) {
  const m = S!.materials[S!.matIndex[t]!]!
  alb[0] = m.color[0]; alb[1] = m.color[1]; alb[2] = m.color[2]
  if (m.map < 0) return m
  const tex = S!.textures[m.map]!
  const b = t * 6
  const w = 1 - hitU - hitV
  const u0 = S!.uvs[b]! * w + S!.uvs[b + 2]! * hitU + S!.uvs[b + 4]! * hitV
  const v0 = S!.uvs[b + 1]! * w + S!.uvs[b + 3]! * hitU + S!.uvs[b + 5]! * hitV
  const e = m.uv
  const u = wrap(e[0]! * u0 + e[3]! * v0 + e[6]!, tex.wrapS)
  const v = wrap(e[1]! * u0 + e[4]! * v0 + e[7]!, tex.wrapT)
  const px = Math.min(tex.w - 1, Math.floor(u * tex.w))
  const py = Math.min(tex.h - 1, Math.floor((tex.flipY ? 1 - v : v) * tex.h))
  const i = (py * tex.w + px) * 4
  alb[0] *= LIN[tex.data[i]!]!
  alb[1] *= LIN[tex.data[i + 1]!]!
  alb[2] *= LIN[tex.data[i + 2]!]!
  return m
}

// Cel d'estudi (lineal): clar a dalt, més fosc a baix.
function sky(dx: number, dy: number, dz: number, out: number[]) {
  void dx; void dz
  const t = Math.max(-1, Math.min(1, dy))
  if (t >= 0) {
    out[0] = 0.55 + 0.25 * t
    out[1] = 0.54 + 0.25 * t
    out[2] = 0.53 + 0.28 * t
  } else {
    out[0] = 0.22; out[1] = 0.21; out[2] = 0.2
  }
}

const SUN = [2.3, 2.15, 1.95]
const env = [0, 0, 0]

function trace(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, out: Float32Array, o: number) {
  let tr = 1, tg = 1, tb = 1
  let r = 0, g = 0, b = 0
  const sun = S!.sun
  for (let bounce = 0; bounce < 6; bounce++) {
    if (!intersect(ox, oy, oz, dx, dy, dz, 1e9, false)) {
      if (bounce === 0) {
        r += S!.background[0]; g += S!.background[1]; b += S!.background[2]
      } else {
        sky(dx, dy, dz, env)
        r += tr * env[0]!; g += tg * env[1]!; b += tb * env[2]!
      }
      break
    }
    const t = hitTri
    const m = albedo(t)
    // Normal geomètrica, girada cap al raig.
    const k = t * 9
    const e1x = tri[k + 3]! - tri[k]!, e1y = tri[k + 4]! - tri[k + 1]!, e1z = tri[k + 5]! - tri[k + 2]!
    const e2x = tri[k + 6]! - tri[k]!, e2y = tri[k + 7]! - tri[k + 1]!, e2z = tri[k + 8]! - tri[k + 2]!
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x
    const nl = Math.hypot(nx, ny, nz) || 1
    nx /= nl; ny /= nl; nz /= nl
    if (nx * dx + ny * dy + nz * dz > 0) { nx = -nx; ny = -ny; nz = -nz }
    const px = ox + dx * hitT + nx * 1e-4, py = oy + dy * hitT + ny * 1e-4, pz = oz + dz * hitT + nz * 1e-4
    // Transparència (vidre): passa de llarg.
    if (m.opacity < 1 && random() > m.opacity) {
      ox = px - nx * 2e-4; oy = py - ny * 2e-4; oz = pz - nz * 2e-4
      tr *= 0.95 * (0.5 + 0.5 * alb[0]!); tg *= 0.95 * (0.5 + 0.5 * alb[1]!); tb *= 0.95 * (0.5 + 0.5 * alb[2]!)
      continue
    }
    const metal = m.metalness > 0.5
    const specP = metal ? 1 : 0.04 + 0.1 * (1 - m.roughness)
    if (random() < specP) {
      // Reflex: mirall pertorbat per la rugositat.
      const dot = dx * nx + dy * ny + dz * nz
      let rx = dx - 2 * dot * nx, ry = dy - 2 * dot * ny, rz = dz - 2 * dot * nz
      const rough = m.roughness * m.roughness
      rx += (random() * 2 - 1) * rough; ry += (random() * 2 - 1) * rough; rz += (random() * 2 - 1) * rough
      const rl = Math.hypot(rx, ry, rz) || 1
      dx = rx / rl; dy = ry / rl; dz = rz / rl
      if (dx * nx + dy * ny + dz * nz <= 0) break
      if (metal) { tr *= alb[0]!; tg *= alb[1]!; tb *= alb[2]! }
      ox = px; oy = py; oz = pz
      continue
    }
    // Difús: llum directa del sol (ombra suau: el sol té una mica de mida) i rebot cosinus.
    const ar = alb[0]!, ag = alb[1]!, ab = alb[2]!
    const jx = sun[0] + (random() - 0.5) * 0.06, jy = sun[1] + (random() - 0.5) * 0.06, jz = sun[2] + (random() - 0.5) * 0.06
    const jl = Math.hypot(jx, jy, jz)
    const sx = jx / jl, sy = jy / jl, sz = jz / jl
    const cos = nx * sx + ny * sy + nz * sz
    if (cos > 0 && !intersect(px, py, pz, sx, sy, sz, 1e9, true)) {
      r += tr * ar * SUN[0]! * cos / Math.PI
      g += tg * ag * SUN[1]! * cos / Math.PI
      b += tb * ab * SUN[2]! * cos / Math.PI
    }
    tr *= ar; tg *= ag; tb *= ab
    // Rebot cosinus.
    const u1 = random(), u2 = random()
    const rr = Math.sqrt(u1), phi = 2 * Math.PI * u2
    const lx = rr * Math.cos(phi), ly = rr * Math.sin(phi), lz = Math.sqrt(1 - u1)
    // Base ortonormal al voltant de n.
    const ax = Math.abs(nx) > 0.9 ? 0 : 1, ay = Math.abs(nx) > 0.9 ? 1 : 0
    let tx = ay * nz - 0 * ny, ty = 0 * nx - ax * nz, tz = ax * ny - ay * nx
    const tl = Math.hypot(tx, ty, tz) || 1
    tx /= tl; ty /= tl; tz /= tl
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx
    dx = tx * lx + bx * ly + nx * lz
    dy = ty * lx + by * ly + ny * lz
    dz = tz * lx + bz * ly + nz * lz
    ox = px; oy = py; oz = pz
    // Ruleta russa.
    if (bounce >= 2) {
      const pmax = Math.max(tr, tg, tb)
      if (random() > pmax) break
      tr /= pmax; tg /= pmax; tb /= pmax
    }
  }
  out[o] = r
  out[o + 1] = g
  out[o + 2] = b
}

function pass(): Float32Array {
  const out = new Float32Array(W * H * 3)
  const c = S!.camera
  const m = c.matrix
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nxp = ((x + random()) / W) * 2 - 1
      const nyp = 1 - ((y + random()) / H) * 2
      let ox: number, oy: number, oz: number, dx: number, dy: number, dz: number
      if (c.ortho) {
        const lx = nxp * c.scale * c.aspect, ly = nyp * c.scale
        ox = m[12]! + m[0]! * lx + m[4]! * ly
        oy = m[13]! + m[1]! * lx + m[5]! * ly
        oz = m[14]! + m[2]! * lx + m[6]! * ly
        dx = -m[8]!; dy = -m[9]!; dz = -m[10]!
      } else {
        const lx = nxp * c.scale * c.aspect, ly = nyp * c.scale
        dx = m[0]! * lx + m[4]! * ly - m[8]!
        dy = m[1]! * lx + m[5]! * ly - m[9]!
        dz = m[2]! * lx + m[6]! * ly - m[10]!
        const l = Math.hypot(dx, dy, dz)
        dx /= l; dy /= l; dz /= l
        ox = m[12]!; oy = m[13]!; oz = m[14]!
      }
      trace(ox, oy, oz, dx, dy, dz, out, (y * W + x) * 3)
    }
  }
  return out
}

function loop() {
  if (!running) return
  const buf = pass()
  ;(self as unknown as Worker).postMessage({ type: "pass", data: buf }, [buf.buffer])
  setTimeout(loop, 0)
}

self.onmessage = (e: MessageEvent<Msg>) => {
  const msg = e.data
  if (msg.type === "stop") {
    running = false
    return
  }
  S = msg.scene
  W = msg.width
  H = msg.height
  rng = msg.seed | 1
  buildBVH(S.positions)
  running = true
  loop()
}
