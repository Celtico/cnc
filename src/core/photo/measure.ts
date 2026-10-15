import { imageToPlaneAt, type Camera, type Vec3 } from "./camera"
import { computeHomography, invertMat3, orderQuad, rectanglePoints, type Mat3, type Pt } from "./homography"

/**
 * Mesures sobre la foto amb tres estats:
 *  - relativa: proporció respecte a l'amplada de la referència (= 1,00); només cal que
 *    la referència estigui marcada;
 *  - estimada: total en mm a partir de les mides conegudes de la referència;
 *  - real: l'usuari l'ha mesurada amb cinta; recalibra tota la foto.
 *
 * El model de pla es construeix sempre en unitats d'amplada de referència (amplada = 1).
 * Els mil·límetres surten de l'"amplada efectiva": la mitjana de les cintes si n'hi ha,
 * si no l'amplada coneguda de la referència, i si no res (columna Total en blanc).
 */

export type MeasureKind = "distance" | "rect"

export interface Measure {
  id: string
  name: string
  kind: MeasureKind
  /** 2 punts (distància) o 4 (rectangle), en píxels de la imatge. */
  points: Pt[]
  /** Mida amb cinta (mm) del valor principal (llargada o amplada del rectangle). */
  tape?: number | null
}

export type MeasureState = "relative" | "estimated" | "real"

export interface MeasureValue {
  id: string
  /** Proporció respecte a l'amplada de la referència (valor principal). */
  relative: number
  /** Segon valor (alçada del rectangle), relatiu. */
  relative2?: number
  /** Total en mm, o null si no se sap l'escala. */
  total: number | null
  total2?: number | null
  /** Marge d'error relatiu de l'estimació (0,05 = ±5 %). */
  error: number
  state: MeasureState
  /**
   * Estat i error del segon valor (alçada del rectangle). La cinta només dona el principal: amb cinta, l'alçada continua
   * essent estimada (`state2` = «estimated») encara que `state` sigui «real».
   */
  state2?: MeasureState
  error2?: number
}

interface PlaneModelInput {
  /** 4 punts de la referència a la imatge (qualsevol ordre). */
  points: readonly Pt[]
  /** Mides conegudes de la referència (mm) o null si no se saben. */
  refW: number | null
  refH: number | null
  /** Proporció amplada/alçada coneguda (p. ex. A4 = 297/210) quan les mides no se saben. */
  aspect?: number | null
}

type ScaleMode = "mm" | "relative" | "image"

interface PlaneModel {
  /** Homografia pla (amplada = 1, alçada = 1/aspect) → imatge. */
  h: Mat3
  hInv: Mat3
  aspect: number
  /** D'on surt la proporció: mides en mm, forma coneguda o directament de la imatge (poc fiable si no és frontal). */
  mode: ScaleMode
}

/** Longitud mitjana en píxels dels costats horitzontals i verticals del quadrilàter. */
function sideLengths(pts: readonly Pt[]): { w: number; h: number } {
  const [bl, br, tr, tl] = orderQuad(pts)
  const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])
  return { w: (d(bl, br) + d(tl, tr)) / 2, h: (d(bl, tl) + d(br, tr)) / 2 }
}

export function planeModel(input: PlaneModelInput): PlaneModel | null {
  if (input.points.length !== 4) return null
  let aspect: number
  let mode: ScaleMode
  if (input.refW && input.refH && input.refW > 0 && input.refH > 0) {
    aspect = input.refW / input.refH
    mode = "mm"
  } else if (input.aspect && input.aspect > 0) {
    aspect = input.aspect
    mode = "relative"
  } else {
    const s = sideLengths(input.points)
    // Punts repetits o en línia: sense amplada o alçada no hi ha proporció.
    if (!(s.w > 1e-9) || !(s.h > 1e-9)) return null
    aspect = s.w / s.h
    mode = "image"
  }
  const h = computeHomography(rectanglePoints(1, 1 / aspect), orderQuad(input.points))
  if (!h) return null
  const hInv = invertMat3(h)
  if (!hInv) return null
  return { h, hInv, aspect, mode }
}

/** Punt de la imatge → pla unitari. */
function toUnitPlane(m: PlaneModel, p: Pt): Pt {
  const [x, y] = p
  const inv = m.hInv
  const w = inv[6] * x + inv[7] * y + inv[8]
  return [(inv[0] * x + inv[1] * y + inv[2]) / w, (inv[3] * x + inv[4] * y + inv[5]) / w]
}

/** Distància relativa entre dos punts de la imatge (amplada de la referència = 1). */
export function relativeDistance(m: PlaneModel, a: Pt, b: Pt): number {
  const pa = toUnitPlane(m, a)
  const pb = toUnitPlane(m, b)
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1])
}

/** Amplada i alçada relatives d'un rectangle marcat amb 4 punts. */
export function relativeRect(m: PlaneModel, pts: readonly Pt[]): { w: number; h: number } {
  const [bl, br, tr, tl] = orderQuad(pts)
  const w = (relativeDistance(m, bl, br) + relativeDistance(m, tl, tr)) / 2
  const h = (relativeDistance(m, bl, tl) + relativeDistance(m, br, tr)) / 2
  return { w, h }
}

function relativeOf(m: PlaneModel, meas: Measure): { r: number; r2?: number } | null {
  if (meas.kind === "distance") {
    if (meas.points.length < 2) return null
    return { r: relativeDistance(m, meas.points[0]!, meas.points[1]!) }
  }
  if (meas.points.length < 4) return null
  const { w, h } = relativeRect(m, meas.points)
  return { r: w, r2: h }
}

/** Marge d'error de les estimacions segons d'on surt l'escala. */
const ESTIMATE_ERROR: Record<ScaleMode, number> = { mm: 0.05, relative: 0.05, image: 0.15 }

/**
 * Amplada efectiva de la referència en mm: la mitjana de les cintes (cadascuna dividida
 * per la seva mesura relativa), si n'hi ha; si no, l'amplada coneguda; si no, null.
 */
function effectiveWidth(m: PlaneModel, measures: readonly Measure[], refW: number | null): number | null {
  const ratios: number[] = []
  for (const meas of measures) {
    if (!meas.tape || meas.tape <= 0) continue
    const rel = relativeOf(m, meas)
    if (!rel || rel.r <= 1e-9) continue
    ratios.push(meas.tape / rel.r)
  }
  if (ratios.length) return ratios.reduce((a, b) => a + b, 0) / ratios.length
  return refW && refW > 0 ? refW : null
}

/** Valors de totes les mesures (relatiu sempre; total només si hi ha escala). */
export function measureValues(m: PlaneModel, measures: readonly Measure[], refW: number | null): MeasureValue[] {
  const width = effectiveWidth(m, measures, refW)
  const out: MeasureValue[] = []
  for (const meas of measures) {
    const rel = relativeOf(m, meas)
    if (!rel) continue
    const real = !!meas.tape && meas.tape > 0
    const total = real ? meas.tape! : width !== null ? rel.r * width : null
    const total2 = rel.r2 === undefined ? undefined : width !== null ? rel.r2 * width : null
    const second = total2 === undefined ? {} : { state2: (total2 !== null ? "estimated" : "relative") as MeasureState, error2: ESTIMATE_ERROR[m.mode] }
    out.push({
      id: meas.id,
      relative: rel.r,
      ...(rel.r2 !== undefined ? { relative2: rel.r2 } : {}),
      total: total === null ? null : round1(total),
      ...(total2 !== undefined ? { total2: total2 === null ? null : round1(total2) } : {}),
      error: real ? 0 : ESTIMATE_ERROR[m.mode],
      state: real ? "real" : total !== null ? "estimated" : "relative",
      ...second,
    })
  }
  return out
}

/** Mides efectives de la referència (mm), o null si no se saben. */
export function effectiveReference(m: PlaneModel, measures: readonly Measure[], refW: number | null): { w: number; h: number } | null {
  const w = effectiveWidth(m, measures, refW)
  return w === null ? null : { w: round1(w), h: round1(w / m.aspect) }
}

const round1 = (v: number): number => Math.round(v * 10) / 10

/**
 * Origen desat en mm (`originMm`) passat a l'escala d'ara. Es desa amb l'amplada efectiva de la referència d'aquell
 * moment (`scale`, mm): si després es recalibra (una cinta), tot el pla canvia d'escala i l'origen ha de quedar al mateix
 * punt de la foto, no als mateixos mm. Sense `scale` (desats abans) o sense escala ara: tal com és, en mm.
 */
export function scaledOrigin(originMm: readonly [number, number, number], scale: number | null | undefined, width: number | null): [number, number, number] {
  if (!scale || !(scale > 0) || width === null || !(width > 0)) return [originMm[0], originMm[1], originMm[2]]
  const k = width / scale
  return [originMm[0] * k, originMm[1] * k, originMm[2] * k]
}

// --- Qualitat del calibratge ----------------------------------------------------------

interface CalibrationQuality {
  /** Relació entre les escales dels dos eixos del pla (1 = perfecte). */
  scaleRatio: number
  /** Angle entre els dos eixos del pla (90° = perfecte). */
  angleDeg: number
  ok: boolean
  message: string | null
}

/**
 * Amb una càmera de forat i un rectangle real, les dues primeres columnes de K⁻¹·H
 * han de ser perpendiculars i de la mateixa longitud. Si no, els punts són mal posats,
 * el rectangle no ho és, la focal no és la bona o la foto és massa obliqua.
 */
export function calibrationQuality(h: Mat3, f: number, cx: number, cy: number): CalibrationQuality {
  const kInv: Mat3 = [1 / f, 0, -cx / f, 0, 1 / f, -cy / f, 0, 0, 1]
  const col = (j: number): Vec3 => [h[j]!, h[3 + j]!, h[6 + j]!]
  const mul = (v: Vec3): Vec3 => [kInv[0] * v[0] + kInv[1] * v[1] + kInv[2] * v[2], kInv[3] * v[0] + kInv[4] * v[1] + kInv[5] * v[2], kInv[6] * v[0] + kInv[7] * v[1] + kInv[8] * v[2]]
  const m1 = mul(col(0))
  const m2 = mul(col(1))
  const n1 = Math.hypot(...m1)
  const n2 = Math.hypot(...m2)
  if (n1 < 1e-12 || n2 < 1e-12) return { scaleRatio: 0, angleDeg: 0, ok: false, message: "No s'ha pogut calibrar: els punts estan mal posats." }
  const scaleRatio = n1 / n2
  const cos = (m1[0] * m2[0] + m1[1] * m2[1] + m1[2] * m2[2]) / (n1 * n2)
  const angleDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
  const scaleOff = Math.abs(Math.log(scaleRatio))
  const angleOff = Math.abs(angleDeg - 90)
  const ok = scaleOff < 0.12 && angleOff < 7
  let message: string | null = null
  if (!ok) {
    message = `Calibratge dubtós: els costats donen escales que difereixen un ${Math.round(Math.abs(scaleRatio - 1) * 100)} % i els eixos formen ${Math.round(angleDeg)}°. Revisa els punts, la focal o fes la foto més de cara.`
  }
  return { scaleRatio, angleDeg, ok, message }
}

/** Focal equivalent per sota de la qual l'objectiu és gran angular i deforma les vores. */
export const WIDE_ANGLE_FOCAL_35 = 20

// --- Línia del terra i fondària ---------------------------------------------------------

/**
 * Punt de la imatge → punt 3D (coordenades del pla de referència) sobre el pla
 * `axis = value` (0: x, 1: y, 2: z). Null si el raig no l'arriba a tocar per davant.
 */
function imageToPointOn(cam: Camera, p: Pt, axis: 0 | 1 | 2, value: number): Vec3 | null {
  const { r, t, f, cx, cy } = cam
  const d: Vec3 = [(p[0] - cx) / f, (p[1] - cy) / f, 1]
  const rt = (v: Vec3): Vec3 => [r[0] * v[0] + r[3] * v[1] + r[6] * v[2], r[1] * v[0] + r[4] * v[1] + r[7] * v[2], r[2] * v[0] + r[5] * v[1] + r[8] * v[2]]
  const dw = rt(d)
  const tw = rt(t)
  if (Math.abs(dw[axis]) < 1e-12) return null
  const lambda = (value + tw[axis]) / dw[axis]
  if (lambda <= 0) return null
  return [lambda * dw[0] - tw[0], lambda * dw[1] - tw[1], lambda * dw[2] - tw[2]]
}

/**
 * Alçada (y del pla) del terra a partir de la línia del terra marcada sobre la paret
 * (2 punts on la paret toca el terra). La paret real és a z = −wallOffset.
 */
export function floorLevel(cam: Camera, line: readonly [Pt, Pt], wallOffset = 0): { y: number; xLeft: number; xRight: number } | null {
  const a = imageToPlaneAt(cam, line[0], -wallOffset)
  const b = imageToPlaneAt(cam, line[1], -wallOffset)
  if (!a || !b) return null
  return { y: (a[1] + b[1]) / 2, xLeft: Math.min(a[0], b[0]), xRight: Math.max(a[0], b[0]) }
}

export interface DepthMeasure {
  /** Distància a la paret (mm). */
  depth: number
  /** Posició x sobre la paret (mm). */
  x: number
  /** Marge d'error relatiu (0,2 = ±20 %). */
  error: number
  /** L'angle de visió del terra és tan pla que val més fer la foto de biaix o una segona de costat. */
  tooFlat: boolean
}

/**
 * Fondària d'un punt tocat a terra: intersecció del raig amb el pla del terra i
 * distància a la paret. L'error creix quan el raig raspa el terra: un píxel de
 * desviació desplaça el punt D/(f·sin θ) mm.
 */
export function floorDepth(cam: Camera, p: Pt, floorY: number, wallOffset = 0, pixelError = 3): DepthMeasure | null {
  const q = imageToPointOn(cam, p, 1, floorY)
  if (!q) return null
  const depth = q[2] + wallOffset
  // Distància càmera→punt i angle del raig amb el terra (normal del terra = y).
  const camPos: Vec3 = [
    -(cam.r[0] * cam.t[0] + cam.r[3] * cam.t[1] + cam.r[6] * cam.t[2]),
    -(cam.r[1] * cam.t[0] + cam.r[4] * cam.t[1] + cam.r[7] * cam.t[2]),
    -(cam.r[2] * cam.t[0] + cam.r[5] * cam.t[1] + cam.r[8] * cam.t[2]),
  ]
  const v: Vec3 = [q[0] - camPos[0], q[1] - camPos[1], q[2] - camPos[2]]
  const dist = Math.hypot(...v)
  const sinTheta = Math.abs(v[1]) / (dist || 1)
  const shift = (pixelError / cam.f) * (dist / Math.max(sinTheta, 1e-6))
  const error = depth > 1e-6 ? Math.min(2, shift / Math.abs(depth)) : 2
  return { depth: Math.round(depth), x: Math.round(q[0]), error, tooFlat: error > 0.35 }
}
