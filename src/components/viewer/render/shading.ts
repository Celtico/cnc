/**
 * Constants i funcions de l'ombrejat compartides pels dos motors (CPU i GPU), perquè facin el
 * mateix. El shader en porta una còpia en WGSL (`gpuTracer.wgsl.ts`).
 */

/** Radi de les arestes arrodonides dels taulers (m): les vores agafen llum com les de debò. */
export const BEVEL_RADIUS = 0.002
/**
 * Llum indirecta màxima d'una mostra, en múltiples de la llum típica de l'escena (`sceneKey`, la
 * mitjana geomètrica: l'exposició automàtica la porta al gris mitjà): treu les «ateses» (punts
 * blancs), també a les habitacions fosques.
 */
export const INDIRECT_CLAMP = 20
/** Llum directa màxima d'una mostra (molt més alta: els reflexos del sol es queden). */
export const DIRECT_CLAMP = 400
/** Relleu de la veta (inclinació de la normal per diferència de luminància entre texels). */
export const BUMP_STRENGTH = 6
/** Rugositat mínima dels reflexos vistos després d'un rebot difús (regularització del camí). */
export const PATH_ROUGHNESS = 0.45
/** Vidre: llum que deixa passar cap a les ombres (sol i finestres). */
export const GLASS_SHADOW = 0.85

/**
 * Normal de les arestes arrodonides d'una caixa (coordenades locals de la malla): a menys de
 * `r` d'una aresta de la cara, la normal s'inclina cap a fora fins a 45° just a l'aresta (on es
 * troba amb la de l'altra cara). Només els eixos paral·lels a la cara (la normal geomètrica `n`
 * no hi apunta). També val per a les cares a inglet i les extrusions (arrodoneix les tapes).
 * Torna la normal normalitzada.
 */
export function bevelNormal(p: ArrayLike<number>, n: ArrayLike<number>, min: ArrayLike<number>, max: ArrayLike<number>, r: number): [number, number, number] {
  const out: [number, number, number] = [n[0]!, n[1]!, n[2]!]
  for (let a = 0; a < 3; a++) {
    if (Math.abs(n[a]!) > 0.5) continue
    const ra = Math.min(r, (max[a]! - min[a]!) * 0.25)
    if (!(ra > 0)) continue
    const lo = p[a]! - min[a]!, hi = max[a]! - p[a]!
    if (lo < ra && lo <= hi) out[a] = out[a]! - (1 - Math.max(0, lo) / ra)
    else if (hi < ra) out[a] = out[a]! + (1 - Math.max(0, hi) / ra)
  }
  const l = Math.hypot(out[0], out[1], out[2]) || 1
  out[0] /= l
  out[1] /= l
  out[2] /= l
  return out
}

/** Luminància (Rec. 709). */
export const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Escala un color perquè la seva luminància no passi de `max` (les ateses). */
export function clampLum(c: [number, number, number], max: number): [number, number, number] {
  const l = luminance(c[0], c[1], c[2])
  if (!(l <= max)) {
    if (!Number.isFinite(l)) return [0, 0, 0]
    const k = max / l
    return [c[0] * k, c[1] * k, c[2] * k]
  }
  return c
}

type V3 = [number, number, number]

/**
 * Base tangent d'un triangle per les derivades de les coordenades de textura: T = dP/du i
 * B = dP/dv (sense normalitzar), amb les arestes `e1`, `e2` i les diferències d'UV
 * (du1, dv1) i (du2, dv2). `null` si les UV són degenerades.
 */
export function tangentFrame(e1: ArrayLike<number>, e2: ArrayLike<number>, du1: number, dv1: number, du2: number, dv2: number): [V3, V3] | null {
  const det = du1 * dv2 - du2 * dv1
  if (!(Math.abs(det) > 1e-12)) return null
  const r = 1 / det
  const T: V3 = [(e1[0]! * dv2 - e2[0]! * dv1) * r, (e1[1]! * dv2 - e2[1]! * dv1) * r, (e1[2]! * dv2 - e2[2]! * dv1) * r]
  const B: V3 = [(e2[0]! * du1 - e1[0]! * du2) * r, (e2[1]! * du1 - e1[1]! * du2) * r, (e2[2]! * du1 - e1[2]! * du2) * r]
  return [T, B]
}

/**
 * Normal d'un mapa de normals (espai tangent, convenció OpenGL: x cap a +u, y cap a +v, z la
 * normal) sobre la normal `n`: T s'ortogonalitza (Gram-Schmidt) i B surt de n × T amb el signe
 * de la B de les UV (textures girades o en mirall). `ts` ja en [−1, 1]. Torna la normal unitària.
 */
export function perturbNormal(n: ArrayLike<number>, T: ArrayLike<number>, B: ArrayLike<number>, ts: ArrayLike<number>): V3 {
  const d = n[0]! * T[0]! + n[1]! * T[1]! + n[2]! * T[2]!
  let tx = T[0]! - n[0]! * d, ty = T[1]! - n[1]! * d, tz = T[2]! - n[2]! * d
  const tl = Math.hypot(tx, ty, tz)
  if (!(tl > 1e-12)) return [n[0]!, n[1]!, n[2]!]
  tx /= tl; ty /= tl; tz /= tl
  let bx = n[1]! * tz - n[2]! * ty, by = n[2]! * tx - n[0]! * tz, bz = n[0]! * ty - n[1]! * tx
  if (bx * B[0]! + by * B[1]! + bz * B[2]! < 0) { bx = -bx; by = -by; bz = -bz }
  const x = ts[0]!, y = ts[1]!, z = ts[2]!
  const ox = tx * x + bx * y + n[0]! * z, oy = ty * x + by * y + n[1]! * z, oz = tz * x + bz * y + n[2]! * z
  const l = Math.hypot(ox, oy, oz) || 1
  return [ox / l, oy / l, oz / l]
}

/**
 * Normal d'ombrejat d'un punt (u, v baricèntriques) del triangle `t`: les normals dels vèrtexs
 * (`normals`, 9 per triangle) interpolades i normalitzades (superfícies corbes llises: cilindres,
 * taules rodones, models), girada a la mateixa cara que la normal geomètrica `g` (ja girada cap
 * al raig). Si no n'hi ha o és degenerada, `g`. Les caixes i els taulers tenen les normals dels
 * vèrtexs iguals a la de la cara: no canvien.
 */
export function smoothNormal(normals: ArrayLike<number> | undefined, t: number, u: number, v: number, g: ArrayLike<number>): V3 {
  const b = t * 9
  if (!normals || normals.length < b + 9) return [g[0]!, g[1]!, g[2]!]
  const w = 1 - u - v
  let x = normals[b]! * w + normals[b + 3]! * u + normals[b + 6]! * v
  let y = normals[b + 1]! * w + normals[b + 4]! * u + normals[b + 7]! * v
  let z = normals[b + 2]! * w + normals[b + 5]! * u + normals[b + 8]! * v
  const l = Math.hypot(x, y, z)
  if (!(l > 1e-6)) return [g[0]!, g[1]!, g[2]!]
  x /= l; y /= l; z /= l
  if (x * g[0]! + y * g[1]! + z * g[2]! < 0) { x = -x; y = -y; z = -z }
  return [x, y, z]
}

/** Nivells per eix de les normals empaquetades per a la GPU (octaedre, 12 bits per eix; parell perquè el 0 sigui exacte). */
const OCT_LEVELS = 4094

/**
 * Normal unitària → un sol float (per a la GPU, als buits dels triangles): coordenades de
 * l'octaedre en 12 + 12 bits, com a enter (< 2^24, exacte en f32). Error < 0,1°.
 */
export function encodeNormal(x: number, y: number, z: number): number {
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1
  let a = x / s, b = y / s
  if (z < 0) {
    const a0 = a
    a = (1 - Math.abs(b)) * (a0 >= 0 ? 1 : -1)
    b = (1 - Math.abs(a0)) * (b >= 0 ? 1 : -1)
  }
  const qa = Math.round((Math.min(1, Math.max(-1, a)) * 0.5 + 0.5) * OCT_LEVELS)
  const qb = Math.round((Math.min(1, Math.max(-1, b)) * 0.5 + 0.5) * OCT_LEVELS)
  return qa * 4096 + qb
}

/** Inversa d'`encodeNormal` (el shader en porta una còpia, `decodeNormal`). */
export function decodeNormal(f: number): V3 {
  const k = Math.round(f)
  const a = (Math.floor(k / 4096) / OCT_LEVELS) * 2 - 1, b = ((k % 4096) / OCT_LEVELS) * 2 - 1
  let x = a, y = b
  const z = 1 - Math.abs(a) - Math.abs(b)
  const t = Math.max(-z, 0)
  x += x >= 0 ? -t : t
  y += y >= 0 ? -t : t
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}
