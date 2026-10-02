import { describe, expect, it } from "vitest"
import { cameraFromHomography, focalPx, project, type Camera, type Vec3 } from "./camera"
import { planeToImage, rectanglePoints, type Mat3, type Pt } from "./homography"
import {
  calibrationQuality,
  effectiveReference,
  floorDepth,
  floorLevel,
  measureValues,
  planeModel,
  relativeDistance,
  relativeRect,
  scaledOrigin,
  type Measure,
} from "./measure"

function rotX(a: number): Mat3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}
function rotY(a: number): Mat3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}
function mul(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = []
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!)
  return r as unknown as Mat3
}
const R_WALL: Mat3 = [1, 0, 0, 0, -1, 0, 0, 0, -1]
// Càmera a 1,2 m d'alçada mirant una mica avall, a 2,6 m de la paret.
const truth: Camera = { f: focalPx(26, 1920, 1080), cx: 960, cy: 540, r: mul(mul(rotY(0.12), rotX(0.2)), R_WALL), t: [-350, 420, 2600] }
const REF_W = 600
const REF_H = 400
const refPts = rectanglePoints(REF_W, REF_H).map((p) => project(truth, [p[0], p[1], 0])!)
const px = (p: Vec3): Pt => project(truth, p)!

describe("mesures relatives i estimades", () => {
  const model = planeModel({ points: refPts, refW: REF_W, refH: REF_H })!
  const wall: Measure = { id: "w", name: "Paret", kind: "distance", points: [px([-800, 0, 0]), px([1900, 0, 0])] }
  const radiator: Measure = { id: "r", name: "Radiador", kind: "rect", points: [px([1000, 100, 0]), px([1650, 100, 0]), px([1650, 700, 0]), px([1000, 700, 0])] }

  it("distància relativa = proporció respecte a l'amplada de la referència", () => {
    expect(relativeDistance(model, px([0, 0, 0]), px([600, 0, 0]))).toBeCloseTo(1, 6)
    expect(relativeDistance(model, wall.points[0]!, wall.points[1]!)).toBeCloseTo(2700 / 600, 5)
    const r = relativeRect(model, radiator.points)
    expect(r.w * REF_W).toBeCloseTo(650, 3)
    expect(r.h * REF_W).toBeCloseTo(600, 3)
  })

  it("amb la referència sense mides, Total queda en blanc (null) i la relativa és correcta", () => {
    const m = planeModel({ points: refPts, refW: null, refH: null, aspect: REF_W / REF_H })!
    expect(m.mode).toBe("relative")
    const [v] = measureValues(m, [wall], null)
    expect(v!.total).toBeNull()
    expect(v!.state).toBe("relative")
    expect(v!.relative).toBeCloseTo(4.5, 5)
    expect(effectiveReference(m, [wall], null)).toBeNull()
  })

  it("entrar una mida amb cinta omple totes les totals i dona mides a la referència", () => {
    const m = planeModel({ points: refPts, refW: null, refH: null, aspect: REF_W / REF_H })!
    const values = measureValues(m, [{ ...wall, tape: 2700 }, radiator], null)
    expect(values[0]).toMatchObject({ state: "real", total: 2700, error: 0 })
    expect(values[1]!.state).toBe("estimated")
    expect(values[1]!.total).toBeCloseTo(650, 0)
    expect(values[1]!.total2).toBeCloseTo(600, 0)
    expect(effectiveReference(m, [{ ...wall, tape: 2700 }], null)).toEqual({ w: 600, h: 400 })
  })

  it("recalibratge: una cinta diferent de l'estimació escala la resta en proporció", () => {
    // La referència diu 600 però la paret amb cinta fa 2970 (10 % més que l'estimació de 2700).
    const values = measureValues(model, [{ ...wall, tape: 2970 }, radiator], REF_W)
    expect(values[1]!.total).toBeCloseTo(650 * 1.1, 0)
    expect(effectiveReference(model, [{ ...wall, tape: 2970 }], REF_W)!.w).toBeCloseTo(660, 0)
  })

  it("rectangle amb cinta: l'amplada és real, l'alçada continua estimada (state2)", () => {
    const [v] = measureValues(model, [{ ...radiator, tape: 650 }], REF_W)
    expect(v).toMatchObject({ state: "real", error: 0, state2: "estimated" })
    expect(v!.error2).toBeGreaterThan(0)
    const [w] = measureValues(model, [radiator], REF_W)
    expect(w).toMatchObject({ state: "estimated", state2: "estimated" })
    const [d] = measureValues(model, [wall], REF_W)
    expect(d!.state2).toBeUndefined()
  })

  it("quadrilàter degenerat (punts repetits) sense mides: cap model", () => {
    expect(planeModel({ points: [[100, 100], [100, 100], [100, 300], [100, 300]], refW: null, refH: null })).toBeNull()
    expect(planeModel({ points: [[100, 100], [300, 100], [300, 100], [100, 100]], refW: null, refH: null })).toBeNull()
  })

  it("sense mides ni forma: escala de la imatge, amb error gran", () => {
    const m = planeModel({ points: refPts, refW: null, refH: null })!
    expect(m.mode).toBe("image")
    const [v] = measureValues(m, [wall], null)
    expect(v!.state).toBe("relative")
  })
})

describe("qualitat del calibratge", () => {
  const h = planeToImage(refPts, REF_W, REF_H)!
  it("una foto correcta passa", () => {
    const q = calibrationQuality(h, truth.f, truth.cx, truth.cy)
    expect(q.ok).toBe(true)
    expect(q.scaleRatio).toBeCloseTo(1, 3)
    expect(q.angleDeg).toBeCloseTo(90, 2)
  })
  it("punts mal posats (rectangle que no ho és) avisen", () => {
    const bad = [...refPts] as Pt[]
    bad[2] = [bad[2]![0] + 120, bad[2]![1] - 60]
    const q = calibrationQuality(planeToImage(bad, REF_W, REF_H)!, truth.f, truth.cx, truth.cy)
    expect(q.ok).toBe(false)
    expect(q.message).toMatch(/Calibratge dubtós/)
  })
  it("una focal molt equivocada es nota quan la foto és obliqua (de cara no es pot saber)", () => {
    const oblique: Camera = { ...truth, r: mul(mul(rotY(0.6), rotX(0.25)), R_WALL) }
    const pts = rectanglePoints(REF_W, REF_H).map((p) => project(oblique, [p[0], p[1], 0])!)
    const q = calibrationQuality(planeToImage(pts, REF_W, REF_H)!, truth.f * 2.5, truth.cx, truth.cy)
    expect(q.ok).toBe(false)
  })
})

describe("línia del terra i fondària", () => {
  const h = planeToImage(refPts, REF_W, REF_H)!
  const cam = cameraFromHomography(h, truth.f, truth.cx, truth.cy)!
  // El terra és 850 mm per sota de la base de la referència; la paret és el pla z = 0.
  const FLOOR_Y = -850

  it("la línia del terra dona l'alçada del terra i el seu extrem esquerre", () => {
    const line: [Pt, Pt] = [px([-900, FLOOR_Y, 0]), px([1500, FLOOR_Y, 0])]
    const fl = floorLevel(cam, line)!
    expect(fl.y).toBeCloseTo(FLOOR_Y, 2)
    expect(fl.xLeft).toBeCloseTo(-900, 2)
  })

  it("un punt a terra a 300 mm de la paret es mesura dins del marge declarat", () => {
    const p = px([400, FLOOR_Y, 300])
    const d = floorDepth(cam, p, FLOOR_Y)!
    expect(Math.abs(d.depth - 300)).toBeLessThanOrEqual(1)
    expect(d.x).toBeCloseTo(400, 0)
    expect(d.error).toBeGreaterThan(0)
    expect(d.error).toBeLessThan(0.35)
    // Amb 3 px d'error a la imatge, el valor real cau dins del marge.
    const shifted = floorDepth(cam, [p[0], p[1] + 3], FLOOR_Y)!
    expect(Math.abs(shifted.depth - 300)).toBeLessThanOrEqual(300 * d.error + 1)
  })

  it("amb la referència per davant de la paret, la fondària es compta des de la paret real", () => {
    const wallOffset = 200
    const p = px([400, FLOOR_Y, 300 - wallOffset])
    const d = floorDepth(cam, p, FLOOR_Y, wallOffset)!
    expect(Math.abs(d.depth - 300)).toBeLessThanOrEqual(1)
  })
})

describe("origen desat", () => {
  it("es queda al mateix punt de la foto si la referència es recalibra", () => {
    scaledOrigin([-1500, -800, 100], 600, 660).forEach((v, i) => expect(v).toBeCloseTo([-1650, -880, 110][i]!, 9))
    expect(scaledOrigin([-1500, -800, 0], 600, 600)).toEqual([-1500, -800, 0])
  })
  it("sense escala desada (antics) o sense escala ara: en mm, tal com és", () => {
    expect(scaledOrigin([10, 20, 0], undefined, 660)).toEqual([10, 20, 0])
    expect(scaledOrigin([10, 20, 0], 600, null)).toEqual([10, 20, 0])
  })
})
