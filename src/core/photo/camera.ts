import type { Panel, PanelRole } from "../model"
import { invertMat3, type Mat3, type Pt } from "./homography"

/**
 * Càmera de forat (pinhole) recuperada d'una homografia pla→imatge i una focal.
 *
 * Sistema del pla de referència (mm): origen a la cantonada baix-esquerra del
 * rectangle marcat, x cap a la dreta, y "amunt" dins del pla, z = x × y (cap a la
 * càmera si el pla és la paret; cap amunt si és el terra).
 * Sistema de càmera: x dreta, y avall (com la imatge), z endavant.
 */

export type Vec3 = readonly [number, number, number]

export interface Camera {
  /** Focal en píxels. */
  f: number
  cx: number
  cy: number
  /** Rotació pla→càmera, per files. */
  r: Mat3
  /** Translació pla→càmera. */
  t: Vec3
}

/** Diagonal del format 35 mm (36 × 24). */
const DIAG_35 = Math.hypot(36, 24)

/** Focal en píxels a partir de la focal equivalent a 35 mm i la mida de la imatge. */
export function focalPx(focal35: number, width: number, height: number): number {
  return (focal35 * Math.hypot(width, height)) / DIAG_35
}

/** Focal equivalent a 35 mm per defecte quan la foto no porta EXIF (càmera principal d'un mòbil). */
export const DEFAULT_FOCAL_35 = 26

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const unit = (a: Vec3): Vec3 => scale(a, 1 / norm(a))

/**
 * Descomposició de Zhang: H = K·[r1 r2 t] (a escala). Retorna null si l'homografia és
 * degenerada. Si el pla queda darrere la càmera, es canvia el signe global.
 */
export function cameraFromHomography(h: Mat3, f: number, cx: number, cy: number): Camera | null {
  const kInv: Mat3 = [1 / f, 0, -cx / f, 0, 1 / f, -cy / f, 0, 0, 1]
  const col = (m: Mat3, j: number): Vec3 => [m[j]!, m[3 + j]!, m[6 + j]!]
  const mulV = (m: Mat3, v: Vec3): Vec3 => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
  let m1 = mulV(kInv, col(h, 0))
  let m2 = mulV(kInv, col(h, 1))
  let m3 = mulV(kInv, col(h, 2))
  const n1 = norm(m1)
  const n2 = norm(m2)
  if (n1 < 1e-12 || n2 < 1e-12) return null
  const lambda = 2 / (n1 + n2)
  m1 = scale(m1, lambda)
  m2 = scale(m2, lambda)
  m3 = scale(m3, lambda)
  if (m3[2] < 0) {
    m1 = scale(m1, -1)
    m2 = scale(m2, -1)
    m3 = scale(m3, -1)
  }
  // Ortonormalització simètrica de r1, r2: a = bisectriu, b = perpendicular dins del pla.
  // Amb m1, m2 ja ortonormals, a − b = m1 i a + b = m2.
  const a = unit(add(unit(m1), unit(m2)))
  const b = unit(cross(cross(unit(m1), unit(m2)), a))
  const r1 = unit(sub(a, b))
  const r2 = unit(add(a, b))
  const r3 = cross(r1, r2)
  return {
    f,
    cx,
    cy,
    r: [r1[0], r2[0], r3[0], r1[1], r2[1], r3[1], r1[2], r2[2], r3[2]],
    t: m3,
  }
}

/** Punt del pla (3D, mm) → coordenades de càmera. */
export function toCamera(cam: Camera, p: Vec3): Vec3 {
  const { r, t } = cam
  return [
    r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + t[0],
    r[3] * p[0] + r[4] * p[1] + r[5] * p[2] + t[1],
    r[6] * p[0] + r[7] * p[1] + r[8] * p[2] + t[2],
  ]
}

/** Coordenades de càmera → píxel. Null si el punt és darrere la càmera. */
export function projectCamera(cam: Camera, c: Vec3): Pt | null {
  if (c[2] <= 1e-9) return null
  return [cam.cx + (cam.f * c[0]) / c[2], cam.cy + (cam.f * c[1]) / c[2]]
}

export function project(cam: Camera, p: Vec3): Pt | null {
  return projectCamera(cam, toCamera(cam, p))
}

/** On és el rectangle de referència: a la paret (moble recolzat al darrere) o al terra. */
export type ReferencePlane = "wall" | "floor"

export interface SceneOptions {
  plane: ReferencePlane
  /** Desplaçament del moble (mm) respecte a l'origen del rectangle: x al llarg, y segons el pla. */
  offset: Pt
  /** Fondària total del moble (per posar el front a tocar de l'origen quan el pla és el terra). */
  totalDepth: number
  /**
   * Distància (mm) de la referència a la paret, quan la referència és a la paret però
   * no hi toca (p. ex. una tele 200 mm per davant). El moble es recolza a la paret real,
   * és a dir, a z = −wallOffset del pla de la referència. Per defecte 0.
   */
  wallOffset?: number
  /** Separació del darrere del moble respecte a la paret (mm, cap a la càmera). Per defecte 0. */
  offsetZ?: number
}

/**
 * Coordenades del moble (X amplada, Y alçada, Z fondària amb el darrere a 0) →
 * coordenades del pla de referència.
 *  - Paret: el darrere del moble és a la paret (z = 0), i creix cap a la càmera.
 *  - Terra: la base és al terra (z = 0); el front queda a `offset.y` i el darrere més lluny.
 */
export function cabinetToPlane(p: Vec3, o: SceneOptions): Vec3 {
  const [X, Y, Z] = p
  if (o.plane === "wall") return [o.offset[0] + X, o.offset[1] + Y, Z - (o.wallOffset ?? 0) + (o.offsetZ ?? 0)]
  return [o.offset[0] + X, o.offset[1] + (o.totalDepth - Z), Y]
}

export interface ProjectedFace {
  panelId: string
  role: PanelRole
  pts: Pt[]
  /** Profunditat mitjana en càmera (per ordenar: de lluny a prop). */
  depth: number
  /** Cosinus entre la normal i la direcció de visió, 0..1 (1 = de cara). */
  facing: number
}

const BOX_FACES: { corners: [number, number, number][]; normal: Vec3 }[] = [
  // Cada cara: 4 cantonades (0/1 per eix local) en ordre, i normal local.
  { corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], normal: [0, 0, 1] },
  { corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], normal: [0, 0, -1] },
  { corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], normal: [1, 0, 0] },
  { corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], normal: [-1, 0, 0] },
  { corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], normal: [0, 1, 0] },
  { corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], normal: [0, -1, 0] },
]

/**
 * Projecta cada peça com una caixa: només les cares que miren a la càmera, ordenades
 * de lluny a prop (algorisme del pintor). Prou per superposar el moble a la foto.
 */
export function projectPanels(panels: Panel[], cam: Camera, o: SceneOptions): ProjectedFace[] {
  const faces: ProjectedFace[] = []
  for (const p of panels) {
    const { origin, xAxis, yAxis, zAxis } = p.placement
    const dims = [p.length, p.width, p.thickness] as const
    const axes = [xAxis, yAxis, zAxis] as const
    // Cantonada local (i,j,k) → moble → pla → càmera.
    const cornerCam = (i: number, j: number, k: number): Vec3 => {
      const l = [i * dims[0], j * dims[1], k * dims[2]]
      const cab: Vec3 = [
        origin[0] + l[0]! * axes[0][0] + l[1]! * axes[1][0] + l[2]! * axes[2][0],
        origin[1] + l[0]! * axes[0][1] + l[1]! * axes[1][1] + l[2]! * axes[2][1],
        origin[2] + l[0]! * axes[0][2] + l[1]! * axes[1][2] + l[2]! * axes[2][2],
      ]
      return toCamera(cam, cabinetToPlane(cab, o))
    }
    const normalCam = (n: Vec3): Vec3 => {
      // Normal local → moble (rotació de la peça) → pla → càmera (rotacions només).
      const cab: Vec3 = [
        n[0] * axes[0][0] + n[1] * axes[1][0] + n[2] * axes[2][0],
        n[0] * axes[0][1] + n[1] * axes[1][1] + n[2] * axes[2][1],
        n[0] * axes[0][2] + n[1] * axes[1][2] + n[2] * axes[2][2],
      ]
      const plane: Vec3 = o.plane === "wall" ? cab : [cab[0], -cab[2], cab[1]]
      const { r } = cam
      return [
        r[0] * plane[0] + r[1] * plane[1] + r[2] * plane[2],
        r[3] * plane[0] + r[4] * plane[1] + r[5] * plane[2],
        r[6] * plane[0] + r[7] * plane[1] + r[8] * plane[2],
      ]
    }

    for (const face of BOX_FACES) {
      const cams = face.corners.map(([i, j, k]) => cornerCam(i, j, k))
      if (cams.some((c) => c[2] <= 1e-6)) continue
      const center = scale(cams.reduce((s, c) => add(s, c), [0, 0, 0] as Vec3), 0.25)
      const n = normalCam(face.normal)
      const facing = -dot(n, unit(center))
      if (facing <= 0) continue
      const pts = cams.map((c) => projectCamera(cam, c)!)
      faces.push({ panelId: p.id, role: p.role, pts, depth: center[2], facing })
    }
  }
  return faces.sort((a, b) => b.depth - a.depth)
}

/** Punt de la imatge → punt del pla de referència (z = 0), en mm. */
export function imageToPlane(h: Mat3, p: Pt): Pt | null {
  const inv = invertMat3(h)
  if (!inv) return null
  const [x, y] = p
  const w = inv[6] * x + inv[7] * y + inv[8]
  return [(inv[0] * x + inv[1] * y + inv[2]) / w, (inv[3] * x + inv[4] * y + inv[5]) / w]
}

/**
 * Punt de la imatge → punt 3D sobre el pla paral·lel a la referència a z = `z` (mm).
 * Amb z = 0 equival a `imageToPlane`; amb z = −d dona el punt sobre la paret real quan
 * la referència és d mm per davant. Null si el raig és paral·lel al pla o hi arriba
 * per darrere de la càmera.
 */
export function imageToPlaneAt(cam: Camera, p: Pt, z: number): Pt | null {
  const { r, t, f, cx, cy } = cam
  const d: Vec3 = [(p[0] - cx) / f, (p[1] - cy) / f, 1]
  // Rᵀ·v (r és per files: pla→càmera).
  const rt = (v: Vec3): Vec3 => [
    r[0] * v[0] + r[3] * v[1] + r[6] * v[2],
    r[1] * v[0] + r[4] * v[1] + r[7] * v[2],
    r[2] * v[0] + r[5] * v[1] + r[8] * v[2],
  ]
  const dw = rt(d)
  const tw = rt(t)
  if (Math.abs(dw[2]) < 1e-12) return null
  // Punt = Rᵀ(λ·d − t); la seva z ha de ser `z`.
  const lambda = (z + tw[2]) / dw[2]
  if (lambda <= 0) return null
  return [lambda * dw[0] - tw[0], lambda * dw[1] - tw[1]]
}
