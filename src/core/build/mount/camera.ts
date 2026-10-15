import type { Vec3 } from "../../model"
import type { Box, HardwareMount } from "./types"

/** La càmera de «Com va muntat» no s'acosta més de `MIN_DIST` (es veuria el ferratge sol, sense peça) ni s'allunya més de `MAX_DIST` (mm). */
export const MOUNT_CAMERA_DIST = { min: 260, max: 1600 }
/** Camp de visió vertical de «Com va muntat» (editor i miniatura), graus. */
export const MOUNT_FOV = 32

/**
 * La càmera de «Com va muntat» (el 3D de l'editor en obrir-lo i la miniatura de la targeta, la mateixa vista): mira
 * des de la cara on entra el forat principal (a les frontisses, des de dins del moble, on es veuen la cassoleta i la
 * placa; un tirador, des de fora del front; una pota, de davant i una mica de sota; un joc de calaix, des de dins i del
 * darrere), una mica de costat i de dalt, i **enquadra `region`** (el ferratge, els seus forats i un marge de peça) amb la
 * càmera més a prop que la veu sencera per a aquest `aspect` (`fitCamera`), entre `MOUNT_CAMERA_DIST`. Un «només 3D»,
 * `modelCamera`. `target` i `dist` en mm; `dir` unitari, del punt mirat cap a la càmera.
 */
export function mountCamera(m: HardwareMount, aspect = 1.6): { target: Vec3; dir: Vec3; dist: number } {
  if (m.model && !m.panels.length) return modelCamera(m.region, aspect, MOUNT_FOV)
  const n = m.focus?.view ?? m.focus?.normal ?? m.aim?.view ?? ([0, 0, 1] as Vec3)
  const hinge = !!m.hinge
  // De costat i de dalt: a les frontisses, cap a dins del moble (+X, lluny del lateral), si no, cap a la dreta.
  const side: Vec3 = [hinge ? 0.75 : 0.6, hinge ? 0.85 : 0.6, Math.abs(n[2]) > 0.7 ? 0 : 0.5]
  const k = side[0] * n[0] + side[1] * n[1] + side[2] * n[2]
  const d: Vec3 = [n[0] + side[0] - k * n[0], n[1] + side[1] - k * n[1], n[2] + side[2] - k * n[2]]
  const len = Math.hypot(d[0], d[1], d[2]) || 1
  const dir: Vec3 = (m.focus?.exact && m.focus.view) || (!m.focus && m.aim?.view) ? (m.focus?.view ?? m.aim!.view!) : [d[0] / len, d[1] / len, d[2] / len]
  const fit = fitCamera(m.region, dir, aspect, MOUNT_FOV)
  return { target: fit.target, dir, dist: Math.min(m.whole ? Infinity : MOUNT_CAMERA_DIST.max, Math.max(MOUNT_CAMERA_DIST.min, fit.dist)) }
}

const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const unit3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** El marge de la imatge: la caixa ocupa com a molt aquest tros de cada meitat del camp. */
const FIT_FILL = 0.86

/**
 * Per a una direcció `dir` (del punt mirat cap a la càmera) i una caixa `b`, la càmera **més a prop** que encara veu els
 * vuit vèrtexs (perspectiva, fov vertical `fov`, `aspect` = amplada / alçada, marge `FIT_FILL`): per a cada eix de la
 * pantalla, la posició de costat que deixa acostar més la càmera (una funció còncava a trossos: cerca ternària), i la
 * distància és la més petita dels dos eixos. `pose(cf)` dona la càmera centrada per a una fondària `cf` qualsevol.
 */
function fitter(b: Box, dir: Vec3, aspect: number, fov: number) {
  // La base de la càmera: f (cap on mira), r (dreta), u (amunt).
  const f: Vec3 = [-dir[0], -dir[1], -dir[2]]
  const r = unit3(cross3(f, Math.abs(f[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0]))
  const u = cross3(r, f)
  const corners: Vec3[] = []
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) corners.push([x, y, z])
  const t = Math.tan((fov * Math.PI) / 360) * FIT_FILL
  const P = corners.map((p) => ({ r: dot3(p, r), u: dot3(p, u), f: dot3(p, f) }))
  // Per a una posició de costat c (en r o u), fins on pot avançar la càmera (en f) veient-los tots.
  const reach = (axis: "r" | "u", k: number) => (c: number) => Math.min(...P.map((p) => p.f - Math.abs(p[axis] - c) / k))
  const best = (axis: "r" | "u", k: number) => {
    const g = reach(axis, k)
    let lo = Math.min(...P.map((p) => p[axis]))
    let hi = Math.max(...P.map((p) => p[axis]))
    for (let i = 0; i < 80; i++) {
      const a = lo + (hi - lo) / 3
      const c = hi - (hi - lo) / 3
      if (g(a) < g(c)) lo = a
      else hi = c
    }
    const c = (lo + hi) / 2
    return { c, f: g(c) }
  }
  const bx = best("r", t * aspect)
  const by = best("u", t)
  // Centrat dins del que es pot amb la càmera a `cf` (el tros de posicions de costat on encara es veuen tots).
  const centred = (axis: "r" | "u", k: number, c0: number, cf: number) => {
    const g = reach(axis, k)
    const span = Math.max(...P.map((p) => p[axis])) - Math.min(...P.map((p) => p[axis])) + 1
    let a = c0
    let z = c0
    for (let step = span; step > 1e-3; step /= 2) {
      if (g(a - step) >= cf - 1e-6) a -= step
      if (g(z + step) >= cf - 1e-6) z += step
    }
    return (a + z) / 2
  }
  const pose = (cf: number): Vec3 => {
    const cr = centred("r", t * aspect, bx.c, cf)
    const cu = centred("u", t, by.c, cf)
    return [cr * r[0] + cu * u[0] + cf * f[0], cr * r[1] + cu * u[1] + cf * f[1], cr * r[2] + cu * u[2] + cf * f[2]]
  }
  const center: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
  // Mira el punt del raig del mig més a prop del centre de la caixa (l'òrbita gira al voltant del ferratge).
  const at = (cf: number): { target: Vec3; dir: Vec3; dist: number } => {
    const cam = pose(cf)
    const dist = Math.max(1, dot3([center[0] - cam[0], center[1] - cam[1], center[2] - cam[2]], f))
    return { target: [cam[0] + f[0] * dist, cam[1] + f[1] * dist, cam[2] + f[2] * dist], dir, dist }
  }
  return { f, u, t, corners, pose, cf: Math.min(bx.f, by.f), at }
}

/** La càmera més a prop que veu tota la caixa `b` (mm) mirant des de `dir` (unitari, del punt mirat cap a la càmera). Pur. */
function fitCamera(b: Box, dir: Vec3, aspect = 1.6, fov = MOUNT_FOV): { target: Vec3; dir: Vec3; dist: number } {
  const k = fitter(b, dir, aspect, fov)
  return k.at(k.cf)
}

/**
 * D'on es mira un «només 3D» (una caixa `b`, mm; Y amunt): la direcció i, per a aquesta direcció, la càmera **més a prop**
 * que encara veu tota la caixa (`fitCamera`).
 * - Compacte (el costat llarg < 5 × el del mig): de davant a la dreta i de dalt (3/4).
 * - **Llarg i prim** (un perfil de 1560 × 12,5 × 6,5): mirant **al llarg** des d'un extrem, de costat i de dalt pocs graus
 *   (menys com més prim): la secció de l'extrem de davant es veu gran i la resta s'allunya en perspectiva cap al fons,
 *   tota dins la imatge (de costat sortiria una ratlla). Si el costat llarg és el vertical (una pota alta), de 3/4.
 * Pur.
 */
export function modelCamera(b: { min: Vec3; max: Vec3 }, aspect = 1.6, fov = MOUNT_FOV, angles?: { az: number; el: number }): { target: Vec3; dir: Vec3; dist: number } {
  const size: Vec3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
  const order = [0, 1, 2].sort((i, j) => size[j]! - size[i]!)
  const L = order[0]!
  const ratio = size[L]! / Math.max(1e-6, size[order[1]!]!)
  let dir: Vec3
  const along = ratio >= 5 && L !== 1
  if (along) {
    // Al llarg de l'eix llarg (horitzontal), des de l'extrem «min», una mica de costat (l'altre eix horitzontal) i de dalt.
    const deg = Math.PI / 180
    // De costat una mica més que la meitat del camp horitzontal: el llarg travessa la imatge d'un costat a l'altre (amb
    // menys, s'amuntega cap al punt de fuga; amb més, la secció es fa petita).
    const halfH = Math.atan(Math.tan((fov * Math.PI) / 360) * FIT_FILL * aspect) / deg
    const az = (angles?.az ?? Math.max(halfH + 1.5, Math.min(40, 240 / ratio))) * deg
    const el = (angles?.el ?? Math.max(10, Math.min(28, 160 / ratio))) * deg
    const along: Vec3 = L === 0 ? [-1, 0, 0] : [0, 0, -1]
    const side: Vec3 = L === 0 ? [0, 0, 1] : [1, 0, 0]
    dir = unit3([
      Math.cos(el) * (Math.cos(az) * along[0] + Math.sin(az) * side[0]),
      Math.sin(el),
      Math.cos(el) * (Math.cos(az) * along[2] + Math.sin(az) * side[2]),
    ])
  } else dir = unit3([0.62, 0.48, 0.78])
  const k = fitter(b, dir, aspect, fov)
  let cf = k.cf
  if (along) {
    // Mirant al llarg, la càmera pot acostar-se fins que la secció de davant omple la imatge: s'atura abans, quan fa
    // ~45 % de l'alçada (la resta del llarg, en perspectiva, al costat).
    const near = k.corners.filter((p) => p[L] === b.min[L])
    const nearH = (c: number) => {
      const cam = k.pose(c)
      const ys = near.map((p) => {
        const d: Vec3 = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]]
        return dot3(d, k.u) / (dot3(d, k.f) * k.t)
      })
      return (Math.max(...ys) - Math.min(...ys)) / 2
    }
    if (nearH(cf) > 0.45) {
      let lo = cf - 4 * size[L]!
      let hi = cf
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2
        if (nearH(mid) > 0.45) hi = mid
        else lo = mid
      }
      cf = lo
    }
  }
  return k.at(cf)
}
