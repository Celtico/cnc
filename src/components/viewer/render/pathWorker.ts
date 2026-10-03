/// <reference lib="webworker" />
/**
 * Path tracer per CPU (com el render físic de Cinema 4D): cada worker calcula passades
 * senceres d'una mostra per píxel i les envia al fil principal, que les acumula.
 *
 * El mateix algorisme que el de GPU (`gpuTracer.wgsl.ts`; si en canvies un, canvia l'altre):
 * - Materials: difús (Lambert) + reflex GGX amb Fresnel (Schlick), metalls, vidre fi (reflex o
 *   passa recte, amb el to), retall per l'alfa. Normal d'ombrejat interpolada dels vèrtexs
 *   (`smoothNormal`); les mostres que la geomètrica i la d'ombrejat veuen a cares diferents no compten.
 *   Arestes arrodonides als taulers (`bevelNormal`) i relleu i brillantor de la veta a la fusta
 *   (`bump`), sobre la normal d'ombrejat.
 * - Llum: sol amb mida (ombres suaus) i cel (estudi, de dia o HDRI) amb mostreig directe a cada
 *   rebot (NEE) i MIS amb el del material; als interiors, la llum del cel es mostreja per les
 *   finestres (portals); l'HDRI, per importància (CDF de la llum).
 * - Làmpades: els triangles que emeten (pantalles, bombetes) sumen la seva llum en tocar-los (MIS)
 *   i es mostregen directament a cada rebot (`emitters.ts`, CDF d'àrea × luminància).
 * - Translucidesa (fulles, cortines, pantalles): part del difús passa a l'altra cara (`translucent`).
 * - Mapes PBR: normal (espai tangent, OpenGL) i rugositat (G) amb la repetició del color.
 * - Sense ateses: la llum indirecta d'una mostra té un màxim (`INDIRECT_CLAMP`) i, després d'un
 *   rebot difús, els reflexos es tornen més rugosos (`PATH_ROUGHNESS`).
 */
import { buildBvh, INTERNAL, NODE_WORDS } from "./bvh"
import { EMIT_FLOATS, buildEmitters, pickEmitter, type Emitters } from "./emitters"
import { buildEnvCdf, envPdf, sampleEnv, type EnvCdf } from "./envSampling"
import { lightSetup } from "./lights"
import type { RenderEnv, RenderOpts, RenderScene } from "./sceneData"
import { BACKDROP_GAIN, BUMP_STRENGTH, COAT_ROUGHNESS, DIRECT_CLAMP, GLASS_SHADOW, INDIRECT_CLAMP, PATH_ROUGHNESS, bevelNormal, perturbNormal, smoothNormal, tangentFrame } from "./shading"

type Msg =
  | { type: "scene" | "estimate"; scene: RenderScene; width: number; height: number; seed: number; opts: RenderOpts; env?: RenderEnv | null; auxPasses?: number }
  | { type: "stop" }
  | { type: "resume" }
  /** El fil principal torna els buffers d'una passada (ja sumada) per reaprofitar-los. */
  | { type: "buffers"; data: Float32Array; aux?: Float32Array }

let ENV: RenderEnv | null = null
let CDF: EnvCdf | null = null
let envRot = 0

let O: RenderOpts = { bounces: 6, sunAzimuth: 40, sunElevation: 45, sunIntensity: 1, skyIntensity: 1, softness: 0.15 }
let sunDir: [number, number, number] = [0, 1, 0]
let sunCol: [number, number, number] = [0, 0, 0]
let sunCosMax = 1
let sunA2 = 0
/** Llum del cel directa: 0 = cosinus (cel llis), 1 = HDRI per importància, 2 = per les finestres. */
let neeMode = 0
/** Làmpades: triangles que emeten i el seu multiplicador (0 = apagades). */
let EM: Emitters = { data: new Float32Array(0), count: 0, total: 0 }
let lampScale = 1

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
let tri: Float32Array = new Float32Array(0)
let order: Uint32Array = new Uint32Array(0)
let nf: Float32Array = new Float32Array(0)
let nu: Uint32Array = new Uint32Array(0)

const stack = new Int32Array(128)
// Resultat de la intersecció.
let hitT = 0, hitTri = -1, hitU = 0, hitV = 0
/** El raig d'ombra ha travessat vidre. */
let crossedGlass = false

function intersect(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMax: number, any: boolean): boolean {
  hitT = tMax
  hitTri = -1
  crossedGlass = false
  if (!triCount) return false
  const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz
  const mats = S!.materials, mi = S!.matIndex
  let sp = 0
  stack[sp++] = 0
  while (sp > 0) {
    const n = stack[--sp]! * NODE_WORDS
    let t0 = (nf[n]! - ox) * idx, t1 = (nf[n + 4]! - ox) * idx
    let tmin = t0 < t1 ? t0 : t1, tmax = t0 < t1 ? t1 : t0
    t0 = (nf[n + 1]! - oy) * idy
    t1 = (nf[n + 5]! - oy) * idy
    tmin = Math.max(tmin, Math.min(t0, t1))
    tmax = Math.min(tmax, Math.max(t0, t1))
    t0 = (nf[n + 2]! - oz) * idz
    t1 = (nf[n + 6]! - oz) * idz
    tmin = Math.max(tmin, Math.min(t0, t1))
    tmax = Math.min(tmax, Math.max(t0, t1))
    if (tmax < Math.max(tmin, 0) || tmin > hitT) continue
    const meta = nu[n + 7]!
    if (meta < INTERNAL) {
      const s = nu[n + 3]!, e = s + meta
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
          const m = mats[mi[t]!]!
          // Fulles retallades (alfa de la textura): on és transparent, el raig hi passa.
          if (m.alphaCut > 0 && alphaAt(t, u, v) < m.alphaCut) continue
          // Rajos d'ombra: el vidre no fa ombra (en deixa passar la major part).
          if (any && m.opacity < 1) {
            crossedGlass = true
            continue
          }
          hitT = d
          hitTri = t
          hitU = u
          hitV = v
          if (any) return true
        }
      }
    } else {
      // El fill més proper primer (és l'últim que es posa a la pila).
      const near = n / NODE_WORDS + 1, far = nu[n + 3]!
      const axis = meta & 3
      if ((axis === 0 ? dx : axis === 1 ? dy : dz) < 0) {
        stack[sp++] = near
        stack[sp++] = far
      } else {
        stack[sp++] = far
        stack[sp++] = near
      }
    }
  }
  return hitTri >= 0
}

/** Raig d'ombra: 0 si el tapa res opac; el vidre deixa passar `GLASS_SHADOW`. */
function visible(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMax: number): number {
  if (intersect(ox, oy, oz, dx, dy, dz, tMax, true)) return 0
  return crossedGlass ? GLASS_SHADOW : 1
}

// --- Textures ----------------------------------------------------------------------------
const LIN = new Float32Array(256)
/** Mapes lineals (normals, rugositat): el byte tal qual. */
const RAW = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  RAW[i] = c
}
/** Índex del texel amb la repetició: 0 = repeteix · 1 = mirall · 2 = vora. */
const wrapI = (x: number, n: number, mode: number) => {
  if (mode === 2) return x < 0 ? 0 : x >= n ? n - 1 : x
  if (mode === 1) {
    const m = ((x % (2 * n)) + 2 * n) % (2 * n)
    return m < n ? m : 2 * n - 1 - m
  }
  return ((x % n) + n) % n
}
/** Coordenades de textura (abans de repetir) al punt (u, v baricèntriques) del triangle `t`. */
let tu = 0, tv = 0
function texCoord(t: number, bu: number, bv: number) {
  const m = S!.materials[S!.matIndex[t]!]!
  const uv = S!.uvs, b = t * 6, w = 1 - bu - bv
  const u0 = uv[b]! * w + uv[b + 2]! * bu + uv[b + 4]! * bv
  const v0 = uv[b + 1]! * w + uv[b + 3]! * bu + uv[b + 5]! * bv
  const e = m.uv
  tu = e[0]! * u0 + e[3]! * v0 + e[6]!
  tv = e[1]! * u0 + e[4]! * v0 + e[7]!
}
/** Alfa (0–1, el texel més proper) al punt del triangle `t`: per als retalls de les fulles. */
function alphaAt(t: number, bu: number, bv: number): number {
  const tex = S!.textures[S!.materials[S!.matIndex[t]!]!.map]
  if (!tex) return 1
  texCoord(t, bu, bv)
  const vv = tex.flipY ? 1 - tv : tv
  const x = wrapI(Math.floor(tu * tex.w), tex.w, tex.wrapS), y = wrapI(Math.floor(vv * tex.h), tex.h, tex.wrapT)
  return tex.data[(y * tex.w + x) * 4 + 3]! / 255
}
/** Color lineal bilineal de la textura `ti` a (u, v) (abans de repetir) → `tc`. */
const tc = [0, 0, 0]
function sampleTex(ti: number, u: number, v: number) {
  const tex = S!.textures[ti]!
  const vv = tex.flipY ? 1 - v : v
  const fx = u * tex.w - 0.5, fy = vv * tex.h - 0.5
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  const ax = fx - x0, ay = fy - y0
  const xa = wrapI(x0, tex.w, tex.wrapS), xb = wrapI(x0 + 1, tex.w, tex.wrapS)
  const ya = wrapI(y0, tex.h, tex.wrapT), yb = wrapI(y0 + 1, tex.h, tex.wrapT)
  const d = tex.data
  const LIN = tex.linear ? RAW : LIN_SRGB
  const i00 = (ya * tex.w + xa) * 4, i10 = (ya * tex.w + xb) * 4, i01 = (yb * tex.w + xa) * 4, i11 = (yb * tex.w + xb) * 4
  const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay
  for (let c = 0; c < 3; c++) tc[c] = LIN[d[i00 + c]!]! * w00 + LIN[d[i10 + c]!]! * w10 + LIN[d[i01 + c]!]! * w01 + LIN[d[i11 + c]!]! * w11
}
const LIN_SRGB = LIN
const lumTex = (ti: number, u: number, v: number) => {
  sampleTex(ti, u, v)
  return 0.2126 * tc[0]! + 0.7152 * tc[1]! + 0.0722 * tc[2]!
}

// --- Cel -----------------------------------------------------------------------------------
// Cel d'estudi (lineal): clar a dalt, més fosc a baix.
function studioSky(dy: number, out: number[]) {
  const t = Math.max(-1, Math.min(1, dy))
  if (t >= 0) {
    out[0] = 0.55 + 0.25 * t
    out[1] = 0.54 + 0.25 * t
    out[2] = 0.53 + 0.28 * t
  } else {
    out[0] = 0.22; out[1] = 0.21; out[2] = 0.2
  }
}

/** Cel de dia (ambients): zenit blau, horitzó clar, halo del sol i terra llunyà. */
function daySky(dx: number, dy: number, dz: number, out: number[]) {
  const s = sunDir
  const cs = Math.max(0, dx * s[0] + dy * s[1] + dz * s[2])
  if (dy >= 0) {
    const k = Math.pow(1 - dy, 2.5)
    out[0] = 0.32 + (0.95 - 0.32) * k
    out[1] = 0.48 + (0.97 - 0.48) * k
    out[2] = 0.85 + (1.0 - 0.85) * k
  } else {
    const k = Math.min(1, -dy * 5)
    out[0] = 0.62 + (0.3 - 0.62) * k
    out[1] = 0.64 + (0.31 - 0.64) * k
    out[2] = 0.64 + (0.26 - 0.64) * k
  }
  // Halo del sol ample (un de petit i molt fort faria ateses: el sol ja és a part).
  const glow = Math.pow(cs, 16) * 1.2 + Math.pow(cs, 4) * 0.3
  out[0] += glow; out[1] += glow * 0.92; out[2] += glow * 0.78
}

/** Cel HDRI (equirectangular, bilineal: amb el píxel més proper es veia a quadres per les finestres) girat `envRot`. */
function envSky(dx: number, dy: number, dz: number, out: number[]) {
  const e = ENV!
  let u = (Math.atan2(dx, -dz) / (2 * Math.PI) + 0.5 + envRot) % 1
  if (u < 0) u += 1
  const v = Math.acos(Math.max(-1, Math.min(1, dy))) / Math.PI
  const fx = u * e.w - 0.5, fy = Math.max(0, Math.min(e.h - 1, v * e.h - 0.5))
  const x0f = Math.floor(fx), tx = fx - x0f
  const x0 = (x0f + e.w) % e.w, x1 = (x0 + 1) % e.w
  const y0 = Math.floor(fy), y1 = Math.min(e.h - 1, y0 + 1), ty = fy - y0
  const d = e.data
  for (let c = 0; c < 3; c++) {
    const a = d[(y0 * e.w + x0) * 3 + c]! * (1 - tx) + d[(y0 * e.w + x1) * 3 + c]! * tx
    const b = d[(y1 * e.w + x0) * 3 + c]! * (1 - tx) + d[(y1 * e.w + x1) * 3 + c]! * tx
    out[c] = a * (1 - ty) + b * ty
  }
}

/**
 * Vista per les finestres (`backdrops.ts`): el panorama (alfa 0 = cel) per sobre del cel, amb la llum del cel a
 * l'horitzó (de dia clar, al vespre fosc). Bilineal, amb el gir del cel.
 */
const horizon = [0, 0, 0]
function backdrop(dx: number, dy: number, dz: number, out: number[]) {
  const ti = S!.backdrop!
  const tex = S!.textures[ti]
  if (!tex) return
  let u = (Math.atan2(dx, -dz) / (2 * Math.PI) + 0.5 + envRot) % 1
  if (u < 0) u += 1
  const v = Math.acos(Math.max(-1, Math.min(1, dy))) / Math.PI
  // Alfa bilineal.
  const fx = u * tex.w - 0.5, fy = v * tex.h - 0.5
  const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0
  const xa = wrapI(x0, tex.w, 0), xb = wrapI(x0 + 1, tex.w, 0), ya = wrapI(y0, tex.h, 2), yb = wrapI(y0 + 1, tex.h, 2)
  const A = (x: number, y: number) => tex.data[(y * tex.w + x) * 4 + 3]! / 255
  const a = (A(xa, ya) * (1 - ax) + A(xb, ya) * ax) * (1 - ay) + (A(xa, yb) * (1 - ax) + A(xb, yb) * ax) * ay
  if (!(a > 0)) return
  sampleTex(ti, u, v)
  const hl = Math.hypot(dx, dz) || 1
  sky(dx / hl * 0.995, 0.1, dz / hl * 0.995, horizon)
  const L = (0.2126 * horizon[0]! + 0.7152 * horizon[1]! + 0.0722 * horizon[2]!) * BACKDROP_GAIN
  for (let c = 0; c < 3; c++) out[c] = out[c]! * (1 - a) + tc[c]! * L * a
}

/** Llum del cel en la direcció d (amb la intensitat del cel). */
function sky(dx: number, dy: number, dz: number, out: number[]) {
  if (ENV) envSky(dx, dy, dz, out)
  else if (S!.daylight) daySky(dx, dy, dz, out)
  else studioSky(dy, out)
  const k = O.skyIntensity
  out[0]! *= k; out[1]! *= k; out[2]! *= k
}

/** Densitat (per estereoradiant) de triar la direcció d per alguna finestra des de p. */
function portalPdf(px: number, py: number, pz: number, dx: number, dy: number, dz: number): number {
  const P = S!.portals
  const np = P.length / 9
  let pdf = 0
  for (let i = 0; i < P.length; i += 9) {
    const ux = P[i + 3]!, uy = P[i + 4]!, uz = P[i + 5]!, vx = P[i + 6]!, vy = P[i + 7]!, vz = P[i + 8]!
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
    const area = Math.hypot(cx, cy, cz)
    const dn = dx * cx + dy * cy + dz * cz
    if (Math.abs(dn) < 1e-9 || area < 1e-9) continue
    const t = ((P[i]! - px) * cx + (P[i + 1]! - py) * cy + (P[i + 2]! - pz) * cz) / dn
    if (t <= 0) continue
    const qx = px + dx * t - P[i]!, qy = py + dy * t - P[i + 1]!, qz = pz + dz * t - P[i + 2]!
    const s = (qx * ux + qy * uy + qz * uz) / (ux * ux + uy * uy + uz * uz)
    const r = (qx * vx + qy * vy + qz * vz) / (vx * vx + vy * vy + vz * vz)
    if (Math.abs(s) > 0.5 || Math.abs(r) > 0.5) continue
    const cos = Math.abs(dn) / area
    pdf += (t * t) / (area * cos)
  }
  return pdf / np
}

// --- Material del punt -------------------------------------------------------------------
// Normal d'ombrejat (n), geomètrica (g), cap a la càmera (v), base tangent (t, b).
let nx = 0, ny = 0, nz = 0, gx = 0, gy = 0, gz = 0, vx = 0, vy = 0, vz = 0
let tx = 0, ty = 0, tz = 0, bx = 0, by = 0, bz = 0
let NoV = 1
// Paràmetres del BSDF: difús, F0, alfa² del reflex i probabilitat de triar el reflex.
let kdR = 0, kdG = 0, kdB = 0, f0R = 0, f0G = 0, f0B = 0, A2 = 0, PS = 0
/** Translucidesa del material del punt (difús que passa a l'altra cara). */
let TR = 0
/**
 * Vernís (capa transparent a sobre, com el lacat brillant o el marbre polit): pes `COAT`, alfa² `CA2`, Fresnel cap a la
 * càmera `CFV` (el que la capa treu a la base) i probabilitat de triar-la en rebotar `PC`. Vellut: `SH` (lluïssor de la
 * tela a les vores, Disney).
 */
let COAT = 0, CA2 = 0, CFV = 0, PC = 0, SH = 0
let fr = 0, fg = 0, fb = 0

function basis() {
  const sign = nz >= 0 ? 1 : -1
  const a = -1 / (sign + nz), b = nx * ny * a
  tx = 1 + sign * nx * nx * a; ty = sign * b; tz = -sign * nx
  bx = b; by = sign + ny * ny * a; bz = -ny
}

/**
 * BSDF (→ fr, fg, fb) per a la direcció de la llum l; torna la densitat de `sampleBsdf`. Cap a
 * l'altra cara (translúcids): difús transmès, el color × `TR` / π. El cosinus el posa qui crida (|n·l|).
 */
function evalBsdf(lx: number, ly: number, lz: number, a2: number): number {
  const NoL = nx * lx + ny * ly + nz * lz
  const back = lx * gx + ly * gy + lz * gz < 0
  if (NoL <= 0 || back) {
    if (TR > 0 && back && NoL < 0) {
      const att = (1 - COAT * CFV) / Math.PI
      fr = kdR * TR * att; fg = kdG * TR * att; fb = kdB * TR * att
      return ((1 - PC) * (1 - PS) * TR * -NoL) / Math.PI
    }
    fr = fg = fb = 0
    return 0
  }
  let hx = lx + vx, hy = ly + vy, hz = lz + vz
  const hl = Math.hypot(hx, hy, hz) || 1
  hx /= hl; hy /= hl; hz /= hl
  const NoH = Math.max(0, nx * hx + ny * hy + nz * hz), VoH = Math.max(1e-4, vx * hx + vy * hy + vz * hz)
  const dd = NoH * NoH * (a2 - 1) + 1
  const D = a2 / (Math.PI * dd * dd)
  const vis = 0.5 / (NoL * Math.sqrt(NoV * NoV * (1 - a2) + a2) + NoV * Math.sqrt(NoL * NoL * (1 - a2) + a2))
  const fw = Math.pow(1 - VoH, 5)
  const sR = f0R + (1 - f0R) * fw, sG = f0G + (1 - f0G) * fw, sB = f0B + (1 - f0B) * fw
  const ds = D * vis
  const kr = (1 - TR) / Math.PI
  fr = sR * ds + kdR * (1 - sR) * kr
  fg = sG * ds + kdG * (1 - sG) * kr
  fb = sB * ds + kdB * (1 - sB) * kr
  if (SH > 0) {
    // Vellut: la tela s'aclareix a les vores (Disney: (1 − l·h)⁵), del color de la tela cap al blanc.
    const LoH = Math.max(0, lx * hx + ly * hy + lz * hz)
    const k = SH * Math.pow(1 - LoH, 5) * (1 - TR)
    fr += k * (0.5 + 0.5 * kdR); fg += k * (0.5 + 0.5 * kdG); fb += k * (0.5 + 0.5 * kdB)
  }
  const pdf = (PS * D * NoH) / (4 * VoH) + (1 - PS) * NoL * kr
  if (!(COAT > 0)) return pdf
  // Vernís: un reflex nítid (GGX, F0 0,04) a sobre; la base rep la llum que la capa no reflecteix.
  const c2 = Math.max(CA2, CA2 + a2 - A2)
  const dc = NoH * NoH * (c2 - 1) + 1
  const Dc = c2 / (Math.PI * dc * dc)
  const visc = 0.5 / (NoL * Math.sqrt(NoV * NoV * (1 - c2) + c2) + NoV * Math.sqrt(NoL * NoL * (1 - c2) + c2))
  const Fc = COAT * (0.04 + 0.96 * fw)
  const att = 1 - COAT * CFV
  const cs = Fc * Dc * visc
  fr = fr * att + cs; fg = fg * att + cs; fb = fb * att + cs
  return (1 - PC) * pdf + (PC * Dc * NoH) / (4 * VoH)
}

/** Màxims d'una mostra (relatius a la llum de l'escena, `sceneKey`). */
let clampInd = Infinity, clampDir = Infinity
/** Contribució d'una mostra; `k` = el rebot on es calcula (0 = llum directa). */
let accR = 0, accG = 0, accB = 0
function add(r: number, g: number, b: number, k: number) {
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  if (!(l > 0)) return
  const max = k >= 1 ? clampInd : clampDir
  const s = l > max ? max / l : 1
  if (!Number.isFinite(s * l)) return
  accR += r * s; accG += g * s; accB += b * s
}

/** AOV de la primera superfície (per al filtre de soroll): albedo i normal. */
let aovA0 = 0, aovA1 = 0, aovA2 = 0, aovN0 = 0, aovN1 = 0, aovN2 = 0

const env = [0, 0, 0]
const lp = [0, 0, 0]

function trace(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, out: Float32Array, o: number) {
  let tr = 1, tg = 1, tb = 1
  accR = accG = accB = 0
  let alpha = 1
  let aov = false
  // Últim punt on s'ha rebotat (per al MIS dels rajos que surten al cel).
  let vertex = -1
  let cpx = 0, cpy = 0, cpz = 0, cnx = 0, cny = 0, cnz = 0, lastPdf = 0
  let delta = false
  let pathRough = 0
  const mats = S!.materials
  aovA0 = 1; aovA1 = 1; aovA2 = 1; aovN0 = 0; aovN1 = 0; aovN2 = 0
  for (let bounce = 0; bounce < O.bounces; bounce++) {
    if (!intersect(ox, oy, oz, dx, dy, dz, 1e9, false)) {
      if (bounce === 0) {
        // Fons: el color de l'escena i alfa 0 (fons blanc o transparent al diàleg).
        // Segueix la llum del cel (al vespre, fosc), com al motor de GPU.
        const k = O.skyIntensity
        accR += S!.background[0] * k; accG += S!.background[1] * k; accB += S!.background[2] * k
        alpha = 0
        break
      }
      sky(dx, dy, dz, env)
      // Per un vidre sense haver tocat res: la vista de fora (jardí, mar) davant del cel.
      if (vertex < 0 && S!.backdrop !== undefined && S!.backdrop >= 0) backdrop(dx, dy, dz, env)
      let w = 1
      if (vertex >= 0 && !delta) {
        const pn = neeMode === 2 ? portalPdf(cpx, cpy, cpz, dx, dy, dz) : neeMode === 1 ? envPdf(CDF!, dx, dy, dz, envRot) : Math.max(0, cnx * dx + cny * dy + cnz * dz) / Math.PI
        w = (lastPdf * lastPdf) / (lastPdf * lastPdf + pn * pn)
      }
      add(tr * env[0]! * w, tg * env[1]! * w, tb * env[2]! * w, Math.max(0, vertex))
      break
    }
    const t = hitTri
    const m = mats[S!.matIndex[t]!]!
    // Normal geomètrica, girada cap al raig.
    const k9 = t * 9
    const e1x = tri[k9 + 3]! - tri[k9]!, e1y = tri[k9 + 4]! - tri[k9 + 1]!, e1z = tri[k9 + 5]! - tri[k9 + 2]!
    const e2x = tri[k9 + 6]! - tri[k9]!, e2y = tri[k9 + 7]! - tri[k9 + 1]!, e2z = tri[k9 + 8]! - tri[k9 + 2]!
    gx = e1y * e2z - e1z * e2y; gy = e1z * e2x - e1x * e2z; gz = e1x * e2y - e1y * e2x
    const gl = Math.hypot(gx, gy, gz) || 1
    gx /= gl; gy /= gl; gz /= gl
    if (gx * dx + gy * dy + gz * dz > 0) { gx = -gx; gy = -gy; gz = -gz }
    const hx = ox + dx * hitT, hy = oy + dy * hitT, hz = oz + dz * hitT
    // Albedo (textura bilineal).
    let ar = m.color[0], ag = m.color[1], ab = m.color[2]
    let rough = m.roughness
    // Normal d'ombrejat: la dels vèrtexs interpolada (corbes llises), a la cara de la geomètrica. La
    // geomètrica es queda per als desplaçaments dels rajos i per saber de quina cara surten.
    {
      const sn = smoothNormal(S!.normals, t, hitU, hitV, [gx, gy, gz])
      nx = sn[0]; ny = sn[1]; nz = sn[2]
    }
    // Llum vista d'un emissor amb textura (pantalla de lli): la de la textura respecte de la mitjana (es veu la tela).
    let emK = 1
    if (m.map >= 0) {
      texCoord(t, hitU, hitV)
      const u = tu, v = tv
      sampleTex(m.map, u, v)
      ar *= tc[0]!; ag *= tc[1]!; ab *= tc[2]!
      emK = (0.2126 * tc[0]! + 0.7152 * tc[1]! + 0.0722 * tc[2]!) / Math.max(0.02, S!.textures[m.map]!.lum)
      if (m.roughMap >= 0) {
        sampleTex(m.roughMap, u, v)
        rough = Math.min(1, Math.max(0.02, rough * tc[1]!))
      }
      if (m.normalMap >= 0) {
        // Mapa de normals: base tangent per les derivades de les UV del triangle.
        const uv = S!.uvs, b6 = t * 6, e = m.uv
        const U = (i: number) => e[0]! * uv[b6 + i * 2]! + e[3]! * uv[b6 + i * 2 + 1]! + e[6]!
        const V = (i: number) => e[1]! * uv[b6 + i * 2]! + e[4]! * uv[b6 + i * 2 + 1]! + e[7]!
        const f = tangentFrame([e1x, e1y, e1z], [e2x, e2y, e2z], U(1) - U(0), V(1) - V(0), U(2) - U(0), V(2) - V(0))
        if (f) {
          sampleTex(m.normalMap, u, v)
          const r = perturbNormal([nx, ny, nz], f[0], f[1], [tc[0]! * 2 - 1, tc[1]! * 2 - 1, tc[2]! * 2 - 1])
          nx = r[0]; ny = r[1]; nz = r[2]
        }
      }
      if (m.bump > 0) {
        // Veta: relleu (gradient de la luminància) i les parts fosques, més mates.
        const tex = S!.textures[m.map]!
        const l0 = 0.2126 * tc[0]! + 0.7152 * tc[1]! + 0.0722 * tc[2]!
        const gu = lumTex(m.map, u + 1 / tex.w, v) - l0, gv = lumTex(m.map, u, v + 1 / tex.h) - l0
        const avg = Math.max(0.02, tex.lum)
        rough = Math.min(1, Math.max(0.05, rough * (1 + (0.5 * (avg - l0)) / avg)))
        // Direccions de u i v a la superfície (dP/du, dP/dv).
        const uv = S!.uvs, b6 = t * 6, e = m.uv
        const U = (i: number) => e[0]! * uv[b6 + i * 2]! + e[3]! * uv[b6 + i * 2 + 1]! + e[6]!
        const V = (i: number) => e[1]! * uv[b6 + i * 2]! + e[4]! * uv[b6 + i * 2 + 1]! + e[7]!
        const du1 = U(1) - U(0), dv1 = V(1) - V(0), du2 = U(2) - U(0), dv2 = V(2) - V(0)
        const det = du1 * dv2 - du2 * dv1
        if (Math.abs(det) > 1e-12) {
          const r = 1 / det
          let Tx = (e1x * dv2 - e2x * dv1) * r, Ty = (e1y * dv2 - e2y * dv1) * r, Tz = (e1z * dv2 - e2z * dv1) * r
          let Bx = (e2x * du1 - e1x * du2) * r, By = (e2y * du1 - e1y * du2) * r, Bz = (e2z * du1 - e1z * du2) * r
          const tl = Math.hypot(Tx, Ty, Tz) || 1, bl = Math.hypot(Bx, By, Bz) || 1
          Tx /= tl; Ty /= tl; Tz /= tl; Bx /= bl; By /= bl; Bz /= bl
          const s = BUMP_STRENGTH * m.bump
          nx -= s * (gu * Tx + gv * Bx); ny -= s * (gu * Ty + gv * By); nz -= s * (gu * Tz + gv * Bz)
          const nl = Math.hypot(nx, ny, nz) || 1
          nx /= nl; ny /= nl; nz /= nl
        }
      }
    }
    // Arestes arrodonides dels taulers: al sistema de la malla.
    const bi = S!.triBevel[t]!
    if (bi >= 0) {
      const B = S!.bevel, q = bi * 20
      const lx = B[q]! * hx + B[q + 1]! * hy + B[q + 2]! * hz + B[q + 3]!
      const ly = B[q + 4]! * hx + B[q + 5]! * hy + B[q + 6]! * hz + B[q + 7]!
      const lz = B[q + 8]! * hx + B[q + 9]! * hy + B[q + 10]! * hz + B[q + 11]!
      let mx = B[q]! * nx + B[q + 1]! * ny + B[q + 2]! * nz
      let my = B[q + 4]! * nx + B[q + 5]! * ny + B[q + 6]! * nz
      let mz = B[q + 8]! * nx + B[q + 9]! * ny + B[q + 10]! * nz
      const ml = Math.hypot(mx, my, mz) || 1
      mx /= ml; my /= ml; mz /= ml
      const r = bevelNormal([lx, ly, lz], [mx, my, mz], [B[q + 12]!, B[q + 13]!, B[q + 14]!], [B[q + 16]!, B[q + 17]!, B[q + 18]!], B[q + 15]!)
      const wx = B[q]! * r[0] + B[q + 4]! * r[1] + B[q + 8]! * r[2]
      const wy = B[q + 1]! * r[0] + B[q + 5]! * r[1] + B[q + 9]! * r[2]
      const wz = B[q + 2]! * r[0] + B[q + 6]! * r[1] + B[q + 10]! * r[2]
      const wl = Math.hypot(wx, wy, wz) || 1
      nx = wx / wl; ny = wy / wl; nz = wz / wl
    }
    vx = -dx; vy = -dy; vz = -dz
    // La normal d'ombrejat no pot mirar d'esquena a la càmera.
    NoV = nx * vx + ny * vy + nz * vz
    if (NoV < 0.05) {
      const k = 0.05 - NoV
      nx += vx * k; ny += vy * k; nz += vz * k
      const nl = Math.hypot(nx, ny, nz) || 1
      nx /= nl; ny /= nl; nz /= nl
      NoV = Math.max(1e-3, nx * vx + ny * vy + nz * vz)
    }
    // Làmpada: la seva llum (MIS amb la mostra directa si s'hi ha arribat rebotant).
    if (lampScale > 0 && EM.count > 0) {
      const em = m.emission
      const el = 0.2126 * em[0] + 0.7152 * em[1] + 0.0722 * em[2]
      if (el > 0) {
        let w = 1
        if (vertex >= 0 && !delta) {
          const cosL = Math.abs(dx * gx + dy * gy + dz * gz)
          const pl = cosL > 1e-6 ? ((el / EM.total) * hitT * hitT) / cosL : 0
          w = (lastPdf * lastPdf) / (lastPdf * lastPdf + pl * pl)
        }
        const k = lampScale * w * emK
        add(tr * em[0] * k, tg * em[1] * k, tb * em[2] * k, Math.max(0, vertex))
      }
    }
    // Vidre fi: reflex (Fresnel) o passa recte amb el to del vidre.
    if (m.opacity < 1) {
      const c = Math.abs(dx * gx + dy * gy + dz * gz)
      const F = 0.04 + 0.96 * Math.pow(1 - c, 5)
      if (random() < F) {
        const dot = dx * gx + dy * gy + dz * gz
        dx -= 2 * dot * gx; dy -= 2 * dot * gy; dz -= 2 * dot * gz
        ox = hx + gx * 1e-4; oy = hy + gy * 1e-4; oz = hz + gz * 1e-4
        delta = true
      } else {
        ox = hx - gx * 1e-4; oy = hy - gy * 1e-4; oz = hz - gz * 1e-4
        tr *= 1 - m.opacity * (1 - ar); tg *= 1 - m.opacity * (1 - ag); tb *= 1 - m.opacity * (1 - ab)
      }
      continue
    }
    if (!aov) {
      aov = true
      aovA0 = ar; aovA1 = ag; aovA2 = ab
      aovN0 = nx; aovN1 = ny; aovN2 = nz
    }
    vertex++
    delta = false
    const px = hx + gx * 1e-4, py = hy + gy * 1e-4, pz = hz + gz * 1e-4
    // L'altra cara (llum que travessa un translúcid).
    const qx = hx - gx * 1e-4, qy = hy - gy * 1e-4, qz = hz - gz * 1e-4
    TR = m.translucent
    // BSDF: difús + GGX (metall: només reflex amb el color).
    const metal = Math.min(1, Math.max(0, m.metalness))
    kdR = ar * (1 - metal); kdG = ag * (1 - metal); kdB = ab * (1 - metal)
    f0R = 0.04 + (ar - 0.04) * metal; f0G = 0.04 + (ag - 0.04) * metal; f0B = 0.04 + (ab - 0.04) * metal
    const re = vertex > 0 ? Math.max(rough, pathRough) : rough
    A2 = Math.max(1e-4, re * re * re * re)
    COAT = Math.min(1, Math.max(0, m.coat ?? 0))
    SH = Math.min(1, Math.max(0, m.sheen ?? 0))
    {
      const rc = vertex > 0 ? Math.max(COAT_ROUGHNESS, pathRough) : COAT_ROUGHNESS
      CA2 = Math.max(1e-5, rc * rc * rc * rc)
      CFV = 0.04 + 0.96 * Math.pow(1 - NoV, 5)
      PC = COAT > 0 ? COAT * Math.min(0.5, 0.15 + CFV) : 0
    }
    {
      const fw = Math.pow(1 - NoV, 5)
      const ws = (0.2126 * f0R + 0.7152 * f0G + 0.0722 * f0B) * (1 - fw) + fw
      const wd = (0.2126 * kdR + 0.7152 * kdG + 0.0722 * kdB) * (1 - ws)
      PS = wd < 1e-4 ? 1 : Math.min(0.95, Math.max(0.05, ws / (ws + wd)))
    }
    basis()

    // Sol (disc amb mida: ombres suaus). El reflex s'eixampla amb la mida del sol.
    {
      const u1 = random(), u2 = random()
      const ct = 1 - u1 * (1 - sunCosMax), st = Math.sqrt(Math.max(0, 1 - ct * ct)), ph = 2 * Math.PI * u2
      const s0 = sunDir[0], s1 = sunDir[1], s2 = sunDir[2]
      const sg = s2 >= 0 ? 1 : -1
      const a = -1 / (sg + s2), b = s0 * s1 * a
      const ux = 1 + sg * s0 * s0 * a, uy = sg * b, uz = -sg * s0
      const wx = b, wy = sg + s1 * s1 * a, wz = -s1
      const cp = Math.cos(ph) * st, sp = Math.sin(ph) * st
      const lx = ux * cp + wx * sp + s0 * ct, ly = uy * cp + wy * sp + s1 * ct, lz = uz * cp + wz * sp + s2 * ct
      const front = lx * gx + ly * gy + lz * gz > 0
      if (front || TR > 0) {
        const NoL = Math.abs(nx * lx + ny * ly + nz * lz)
        evalBsdf(lx, ly, lz, A2 + sunA2)
        if (fr + fg + fb > 0) {
          const T = front ? visible(px, py, pz, lx, ly, lz, 1e9) : visible(qx, qy, qz, lx, ly, lz, 1e9)
          if (T > 0) add(tr * fr * sunCol[0] * NoL * T, tg * fg * sunCol[1] * NoL * T, tb * fb * sunCol[2] * NoL * T, vertex)
        }
      }
    }
    // Cel: mostra directa (per les finestres, l'HDRI o cosinus) amb MIS.
    {
      let lx = 0, ly = 0, lz = 0, pl = 0
      if (neeMode === 2) {
        const P = S!.portals, np = P.length / 9
        const i = Math.min(np - 1, Math.floor(random() * np)) * 9
        const r1 = random() - 0.5, r2 = random() - 0.5
        lx = P[i]! + r1 * P[i + 3]! + r2 * P[i + 6]! - px
        ly = P[i + 1]! + r1 * P[i + 4]! + r2 * P[i + 7]! - py
        lz = P[i + 2]! + r1 * P[i + 5]! + r2 * P[i + 8]! - pz
        const d = Math.hypot(lx, ly, lz) || 1
        lx /= d; ly /= d; lz /= d
        pl = portalPdf(px, py, pz, lx, ly, lz)
      } else if (neeMode === 1) {
        const s = sampleEnv(CDF!, random(), random(), envRot)
        lx = s[0]; ly = s[1]; lz = s[2]; pl = s[3]
      } else {
        const u1 = random(), u2 = random()
        const rr = Math.sqrt(u1), ph = 2 * Math.PI * u2
        const a = rr * Math.cos(ph), b = rr * Math.sin(ph), c = Math.sqrt(1 - u1)
        lx = tx * a + bx * b + nx * c; ly = ty * a + by * b + ny * c; lz = tz * a + bz * b + nz * c
        pl = c / Math.PI
      }
      const front = lx * gx + ly * gy + lz * gz > 0
      if (pl > 0 && (front || TR > 0)) {
        const pb = evalBsdf(lx, ly, lz, A2)
        const NoL = Math.abs(nx * lx + ny * ly + nz * lz)
        if (fr + fg + fb > 0) {
          const T = front ? visible(px, py, pz, lx, ly, lz, 1e9) : visible(qx, qy, qz, lx, ly, lz, 1e9)
          if (T > 0) {
            sky(lx, ly, lz, lp)
            const w = (pl * T * NoL) / (pl * pl + pb * pb)
            add(tr * fr * lp[0]! * w, tg * fg * lp[1]! * w, tb * fb * lp[2]! * w, vertex)
          }
        }
      }
    }
    // Làmpades: un punt d'un triangle emissor (àrea × luminància) amb MIS.
    if (lampScale > 0 && EM.count > 0) {
      const E = EM.data, o = pickEmitter(EM, random()) * EMIT_FLOATS
      const su = Math.sqrt(random()), r2 = random()
      const b1 = su * (1 - r2), b2 = su * r2
      let lx = E[o]! + E[o + 4]! * b1 + E[o + 8]! * b2 - px
      let ly = E[o + 1]! + E[o + 5]! * b1 + E[o + 9]! * b2 - py
      let lz = E[o + 2]! + E[o + 6]! * b1 + E[o + 10]! * b2 - pz
      const dist = Math.hypot(lx, ly, lz) || 1
      lx /= dist; ly /= dist; lz /= dist
      const cx = E[o + 5]! * E[o + 10]! - E[o + 6]! * E[o + 9]!, cy = E[o + 6]! * E[o + 8]! - E[o + 4]! * E[o + 10]!, cz = E[o + 4]! * E[o + 9]! - E[o + 5]! * E[o + 8]!
      const cosL = Math.abs(cx * lx + cy * ly + cz * lz) / (Math.hypot(cx, cy, cz) || 1)
      const front = lx * gx + ly * gy + lz * gz > 0
      if (cosL > 1e-4 && (front || TR > 0)) {
        const pl = ((E[o + 15]! / EM.total) * dist * dist) / cosL
        const pb = evalBsdf(lx, ly, lz, A2)
        const NoL = Math.abs(nx * lx + ny * ly + nz * lz)
        if (fr + fg + fb > 0) {
          const T = front ? visible(px, py, pz, lx, ly, lz, dist * (1 - 1e-3)) : visible(qx, qy, qz, lx, ly, lz, dist * (1 - 1e-3))
          if (T > 0) {
            const w = (lampScale * pl * T * NoL) / (pl * pl + pb * pb)
            add(tr * fr * E[o + 12]! * w, tg * fg * E[o + 13]! * w, tb * fb * E[o + 14]! * w, vertex)
          }
        }
      }
    }
    // Rebot: reflex GGX o difús (cosinus), segons PS.
    let lx: number, ly: number, lz: number
    const coatS = PC > 0 && random() < PC
    const spec = coatS || random() < PS
    if (coatS) {
      const u1 = random(), u2 = random()
      const ph = 2 * Math.PI * u1
      const ct = Math.sqrt((1 - u2) / (1 + (CA2 - 1) * u2)), st = Math.sqrt(Math.max(0, 1 - ct * ct))
      const hx2 = tx * Math.cos(ph) * st + bx * Math.sin(ph) * st + nx * ct
      const hy2 = ty * Math.cos(ph) * st + by * Math.sin(ph) * st + ny * ct
      const hz2 = tz * Math.cos(ph) * st + bz * Math.sin(ph) * st + nz * ct
      const vh = vx * hx2 + vy * hy2 + vz * hz2
      lx = 2 * vh * hx2 - vx; ly = 2 * vh * hy2 - vy; lz = 2 * vh * hz2 - vz
    } else if (spec) {
      const u1 = random(), u2 = random()
      const ph = 2 * Math.PI * u1
      const ct = Math.sqrt((1 - u2) / (1 + (A2 - 1) * u2)), st = Math.sqrt(Math.max(0, 1 - ct * ct))
      const hx2 = tx * Math.cos(ph) * st + bx * Math.sin(ph) * st + nx * ct
      const hy2 = ty * Math.cos(ph) * st + by * Math.sin(ph) * st + ny * ct
      const hz2 = tz * Math.cos(ph) * st + bz * Math.sin(ph) * st + nz * ct
      const vh = vx * hx2 + vy * hy2 + vz * hz2
      lx = 2 * vh * hx2 - vx; ly = 2 * vh * hy2 - vy; lz = 2 * vh * hz2 - vz
    } else {
      const u1 = random(), u2 = random()
      const rr = Math.sqrt(u1), ph = 2 * Math.PI * u2
      // Translúcid: una part del difús surt per l'altra cara (cosinus al voltant de −n).
      const c = TR > 0 && random() < TR ? -Math.sqrt(1 - u1) : Math.sqrt(1 - u1)
      const a = rr * Math.cos(ph), b = rr * Math.sin(ph)
      lx = tx * a + bx * b + nx * c; ly = ty * a + by * b + ny * c; lz = tz * a + bz * b + nz * c
    }
    const ldg = lx * gx + ly * gy + lz * gz
    const nl = nx * lx + ny * ly + nz * lz
    if (ldg * nl <= 0 || (ldg < 0 && (spec || !(TR > 0)))) break
    const pdf = evalBsdf(lx, ly, lz, A2)
    const NoL = Math.abs(nl)
    if (!(pdf > 1e-8)) break
    tr *= (fr * NoL) / pdf; tg *= (fg * NoL) / pdf; tb *= (fb * NoL) / pdf
    pathRough = Math.max(pathRough, coatS ? COAT_ROUGHNESS : spec ? re * 0.5 : PATH_ROUGHNESS)
    cpx = px; cpy = py; cpz = pz; cnx = nx; cny = ny; cnz = nz; lastPdf = pdf
    dx = lx; dy = ly; dz = lz
    if (ldg > 0) { ox = px; oy = py; oz = pz } else { ox = qx; oy = qy; oz = qz }
    // Ruleta russa.
    if (bounce >= 2) {
      const pmax = Math.min(0.95, Math.max(tr, tg, tb))
      if (random() > pmax) break
      tr /= pmax; tg /= pmax; tb /= pmax
    }
  }
  out[o] = accR
  out[o + 1] = accG
  out[o + 2] = accB
  out[o + 3] = alpha
}

/**
 * Llum típica de l'escena (mitjana geomètrica de la luminància d'una quadrícula de 32 × 24 rajos
 * sense màxims, amb una llavor fixa: dona el mateix a tots els workers i a la GPU). Els màxims
 * de les ateses en són múltiples: en una habitació fosca, també són més baixos.
 */
function sceneKey(): number {
  const keepRng = rng, keepI = clampInd, keepD = clampDir
  rng = 0x2545f491
  clampInd = clampDir = Infinity
  const c = S!.camera, m = c.matrix
  const out = new Float32Array(4)
  let sum = 0, n = 0
  const GX = 32, GY = 24, SPP = 4
  for (let gy = 0; gy < GY; gy++)
    for (let gx = 0; gx < GX; gx++) {
      let l = 0, hit = 0
      for (let s = 0; s < SPP; s++) {
        const nxp = ((gx + random()) / GX) * 2 - 1, nyp = 1 - ((gy + random()) / GY) * 2
        const lx = nxp * c.scale * c.aspect, ly = nyp * c.scale + (c.ortho ? 0 : (c.shift ?? 0))
        let ox = m[12]!, oy = m[13]!, oz = m[14]!, dx: number, dy: number, dz: number
        if (c.ortho) {
          ox += m[0]! * lx + m[4]! * ly; oy += m[1]! * lx + m[5]! * ly; oz += m[2]! * lx + m[6]! * ly
          dx = -m[8]!; dy = -m[9]!; dz = -m[10]!
        } else {
          dx = m[0]! * lx + m[4]! * ly - m[8]!; dy = m[1]! * lx + m[5]! * ly - m[9]!; dz = m[2]! * lx + m[6]! * ly - m[10]!
          const q = Math.hypot(dx, dy, dz)
          dx /= q; dy /= q; dz /= q
        }
        trace(ox, oy, oz, dx, dy, dz, out, 0)
        if (out[3]! > 0) {
          l += 0.2126 * out[0]! + 0.7152 * out[1]! + 0.0722 * out[2]!
          hit++
        }
      }
      if (!hit) continue
      sum += Math.log(1e-3 + l / hit)
      n++
    }
  rng = keepRng
  clampInd = keepI
  clampDir = keepD
  return n ? Math.max(0.01, Math.exp(sum / n)) : 0.3
}

let focus = 0
/** Una passada (una mostra per píxel) a `out` (RGBA) i, si n'hi ha, les AOV a `aux` (se sobreescriuen). */
function pass(out: Float32Array, aux: Float32Array | null) {
  const c = S!.camera
  const m = c.matrix
  const ap = (O.aperture ?? 0) / 1000
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
        const lx = nxp * c.scale * c.aspect, ly = nyp * c.scale + (c.shift ?? 0)
        dx = m[0]! * lx + m[4]! * ly - m[8]!
        dy = m[1]! * lx + m[5]! * ly - m[9]!
        dz = m[2]! * lx + m[6]! * ly - m[10]!
        const l = Math.hypot(dx, dy, dz)
        dx /= l; dy /= l; dz /= l
        ox = m[12]!; oy = m[13]!; oz = m[14]!
        if (ap > 0 && focus > 0) {
          // Lent fina: el punt enfocat és al pla de focus; l'origen es mou pel disc de la lent.
          const fwd = -(dx * m[8]! + dy * m[9]! + dz * m[10]!)
          const t = focus / Math.max(1e-3, fwd)
          const fx = ox + dx * t, fy = oy + dy * t, fz = oz + dz * t
          const rr = Math.sqrt(random()) * ap, ph = random() * 2 * Math.PI
          const du = rr * Math.cos(ph), dv = rr * Math.sin(ph)
          ox += m[0]! * du + m[4]! * dv; oy += m[1]! * du + m[5]! * dv; oz += m[2]! * du + m[6]! * dv
          dx = fx - ox; dy = fy - oy; dz = fz - oz
          const q = Math.hypot(dx, dy, dz)
          dx /= q; dy /= q; dz /= q
        }
      }
      const i = y * W + x
      trace(ox, oy, oz, dx, dy, dz, out, i * 4)
      if (aux) {
        aux[i * 6] = aovA0; aux[i * 6 + 1] = aovA1; aux[i * 6 + 2] = aovA2
        aux[i * 6 + 3] = aovN0; aux[i * 6 + 4] = aovN1; aux[i * 6 + 5] = aovN2
      }
    }
  }
}

// Buffers: un sol joc per worker, que va i torna (transferit) del fil principal; mentre és fora,
// s'espera (sumar-lo costa molt menys que una passada). Les AOV només es fan les primeres passades.
let buf: Float32Array | null = null
let auxBuf: Float32Array | null = null
let auxLeft = 0
/** Els buffers són al fil principal. */
let away = false
let scheduled = false

function schedule() {
  if (scheduled || !running || away) return
  scheduled = true
  setTimeout(loop, 0)
}

function loop() {
  scheduled = false
  if (!running || away) return
  const out = buf ?? new Float32Array(W * H * 4)
  const aux = auxLeft > 0 ? (auxBuf ?? new Float32Array(W * H * 6)) : null
  buf = auxBuf = null
  pass(out, aux)
  if (aux) auxLeft--
  away = true
  ;(self as unknown as Worker).postMessage({ type: "pass", data: out, aux, auxMore: auxLeft > 0 }, aux ? [out.buffer, aux.buffer] : [out.buffer])
}

self.onmessage = (e: MessageEvent<Msg>) => {
  const msg = e.data
  if (msg.type === "stop") {
    running = false
    return
  }
  if (msg.type === "resume") {
    running = true
    schedule()
    return
  }
  if (msg.type === "buffers") {
    buf = msg.data.length === W * H * 4 ? msg.data : null
    auxBuf = msg.aux && msg.aux.length === W * H * 6 ? msg.aux : null
    away = false
    schedule()
    return
  }
  S = msg.scene
  W = msg.width
  H = msg.height
  rng = msg.seed | 1
  O = msg.opts
  const L = lightSetup(S, O, msg.env ?? null)
  sunDir = L.sunDir
  sunCol = L.sunCol
  sunCosMax = L.sunCosMax
  sunA2 = L.sunA2
  neeMode = L.neeMode
  lampScale = L.lampScale
  ENV = msg.env ?? null
  CDF = ENV ? buildEnvCdf(ENV) : null
  envRot = (O.envRotation ?? 0) / 360
  tri = S.positions
  triCount = tri.length / 9
  const bvh = buildBvh(tri)
  nf = bvh.f32
  nu = bvh.u32
  order = bvh.order
  EM = buildEmitters(S)
  // Enfocament: la distància del centre de la imatge.
  {
    // El raig del centre (amb el descentrament, `shift`): la seva component endavant és 1, així que `hitT` és la
    // distància del pla enfocat (paral·lel a la imatge), la que fa servir la lent fina.
    const m = S.camera.matrix, sh = S.camera.ortho ? 0 : (S.camera.shift ?? 0)
    focus = intersect(m[12]!, m[13]!, m[14]!, m[4]! * sh - m[8]!, m[5]! * sh - m[9]!, m[6]! * sh - m[10]!, 1e9, false) ? hitT : 0
  }
  const key = sceneKey()
  if (msg.type === "estimate") {
    ;(self as unknown as Worker).postMessage({ type: "estimate", key, focus })
    return
  }
  clampInd = INDIRECT_CLAMP * key
  clampDir = DIRECT_CLAMP * key
  auxLeft = Math.max(1, msg.auxPasses ?? 1)
  buf = auxBuf = null
  away = false
  running = true
  schedule()
}
