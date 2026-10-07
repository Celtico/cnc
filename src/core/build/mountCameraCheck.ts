import { expect } from "vitest"
import type { HardwareItem, Vec3 } from "../model"
import { toWorld } from "./geometry"
import { hardwareMount, MOUNT_CAMERA_DIST, MOUNT_FOV, mountCamera, type HardwareMount } from "./hardwareMount"

/**
 * Comprovació comuna dels tests de la càmera de «Com va muntat» (`mountCamera.test.ts` i, amb les descàrregues reals,
 * `mountCamera.roundtrip.test.ts`): la regió del muntatge (`HardwareMount.region`) cau sencera dins la imatge amb marge,
 * per a l'aspecte de la miniatura (2:1) i els de l'editor.
 */

const ASPECTS = [2, 1.6, 1.2]
/** Cada vèrtex, com a molt a aquest tros de la meitat de la imatge (la càmera fa cabre la regió al 86 %). */
const MAX_NDC = 0.9

const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** On cau cada vèrtex de la regió a la imatge (−1…1) amb la càmera de `mountCamera`, i la fondària de cadascun. */
function projectRegion(m: HardwareMount, aspect: number) {
  const c = mountCamera(m, aspect)
  const cam: Vec3 = [c.target[0] + c.dir[0] * c.dist, c.target[1] + c.dir[1] * c.dist, c.target[2] + c.dir[2] * c.dist]
  const f: Vec3 = [-c.dir[0], -c.dir[1], -c.dir[2]]
  const r = unit(cross(f, Math.abs(f[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0]))
  const u = cross(r, f)
  const t = Math.tan((MOUNT_FOV * Math.PI) / 360)
  const b = m.region
  const out: { x: number; y: number; z: number }[] = []
  for (const x of [b.min[0], b.max[0]])
    for (const y of [b.min[1], b.max[1]])
      for (const z of [b.min[2], b.max[2]]) {
        const d: Vec3 = [x - cam[0], y - cam[1], z - cam[2]]
        const depth = dot(d, f)
        out.push({ x: dot(d, r) / (depth * t * aspect), y: dot(d, u) / (depth * t), z: depth })
      }
  return { c, ndc: out }
}

/** La regió cau dins la imatge amb marge, davant de la càmera, i omple un bon tros (ni un punt ni retallada). */
export function expectFramed(item: HardwareItem, label = item.name) {
  const m = hardwareMount(item)
  expect(m.error, label).toBeUndefined()
  expect(m.region.max.every((v, k) => v > m.region.min[k]!), label).toBe(true)
  for (const aspect of ASPECTS) {
    const { c, ndc } = projectRegion(m, aspect)
    expect(Math.hypot(...c.dir), label).toBeCloseTo(1, 6)
    expect(c.dist, label).toBeGreaterThan(0)
    // La càmera no és dins de cap peça (una guia mirada cap al davant sortia pel front del calaix).
    const cam = [0, 1, 2].map((k) => c.target[k]! + c.dir[k]! * c.dist)
    for (const p of m.panels) {
      const cs: Vec3[] = []
      for (const x of [0, p.length]) for (const y of [0, p.width]) for (const z of [0, p.thickness]) cs.push(toWorld(p, [x, y, z]))
      const inside = [0, 1, 2].every((k) => cam[k]! > Math.min(...cs.map((q) => q[k]!)) - 5 && cam[k]! < Math.max(...cs.map((q) => q[k]!)) + 5)
      expect(inside, `${label} · ${aspect}: la càmera és dins de ${p.id}`).toBe(false)
    }
    for (const q of ndc) {
      expect(q.z, `${label} · ${aspect}: darrere la càmera`).toBeGreaterThan(c.dist * 0.05)
      expect(Math.abs(q.x), `${label} · ${aspect}: fora de la imatge en x`).toBeLessThanOrEqual(MAX_NDC)
      expect(Math.abs(q.y), `${label} · ${aspect}: fora de la imatge en y`).toBeLessThanOrEqual(MAX_NDC)
    }
    // Ocupa la imatge: en algun eix, més de la meitat (llevat que la distància mínima l'hagi fet apartar).
    const w = Math.max(...ndc.map((q) => q.x)) - Math.min(...ndc.map((q) => q.x))
    const h = Math.max(...ndc.map((q) => q.y)) - Math.min(...ndc.map((q) => q.y))
    // (Un «només 3D» llarg i prim es mira al llarg i la càmera s'atura quan la secció fa el 45 %: omple menys.)
    if (c.dist > MOUNT_CAMERA_DIST.min + 1e-6 && c.dist < MOUNT_CAMERA_DIST.max - 1e-6) expect(Math.max(w, h) / 2, `${label} · ${aspect}: massa petit`).toBeGreaterThan(m.model ? 0.4 : 0.6)
    else expect(Math.max(w, h) / 2, `${label} · ${aspect}: un punt`).toBeGreaterThan(0.12)
  }
}

