import { describe, expect, it } from "vitest"
import { buildCabinet } from "../build/buildCabinet"
import { DEFAULT_CABINET } from "../model"
import {
  cabinetToPlane,
  cameraFromHomography,
  focalPx,
  imageToPlane,
  imageToPlaneAt,
  project,
  projectPanels,
  toCamera,
  type Camera,
  type Vec3,
} from "./camera"
import { planeToImage, rectanglePoints, type Mat3, type Pt } from "./homography"

// --- Càmera sintètica ------------------------------------------------------------

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
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!)
  return r as unknown as Mat3
}

// Càmera davant d'una paret: x igual, y i z invertits (gir de π sobre x), més una mica de gir.
const R_WALL: Mat3 = [1, 0, 0, 0, -1, 0, 0, 0, -1]
const truth: Camera = {
  f: focalPx(26, 1920, 1080),
  cx: 960,
  cy: 540,
  r: mul(mul(rotY(0.18), rotX(-0.12)), R_WALL),
  t: [-350, 420, 2600],
}

const REF_W = 600
const REF_H = 400
const refImage = rectanglePoints(REF_W, REF_H).map((p) => project(truth, [p[0], p[1], 0])!)
const h = planeToImage(refImage, REF_W, REF_H)!
const recovered = cameraFromHomography(h, truth.f, truth.cx, truth.cy)!

describe("cameraFromHomography", () => {
  it("la focal en píxels surt de la diagonal del format 35 mm", () => {
    expect(focalPx(26, 1920, 1080)).toBeCloseTo((26 * Math.hypot(1920, 1080)) / Math.hypot(36, 24), 6)
  })

  it("recupera la rotació i la translació de la càmera sintètica", () => {
    expect(recovered).not.toBeNull()
    recovered.r.forEach((v, i) => expect(v).toBeCloseTo(truth.r[i]!, 5))
    recovered.t.forEach((v, i) => expect(v).toBeCloseTo(truth.t[i]!, 3))
  })

  it("projecta punts fora del pla igual que la càmera real", () => {
    for (const p of [[200, 100, 350], [0, 0, 600], [600, 400, 19], [-500, 900, 200]] as Vec3[]) {
      const a = project(truth, p)!
      const b = project(recovered, p)!
      expect(b[0]).toBeCloseTo(a[0], 3)
      expect(b[1]).toBeCloseTo(a[1], 3)
    }
  })

  it("el pla queda davant la càmera (t_z > 0) encara que H vingui amb el signe canviat", () => {
    const flipped = h.map((v) => -v) as unknown as Mat3
    const cam = cameraFromHomography(flipped, truth.f, truth.cx, truth.cy)!
    expect(cam.t[2]).toBeGreaterThan(0)
    expect(toCamera(cam, [0, 0, 0])[2]).toBeGreaterThan(0)
  })

  it("una homografia degenerada retorna null", () => {
    expect(cameraFromHomography([0, 0, 1, 0, 0, 1, 0, 0, 1], 1000, 0, 0)).toBeNull()
  })

  it("imageToPlane és la inversa de la projecció sobre el pla", () => {
    const p: Pt = [250, 130]
    const img = project(truth, [p[0], p[1], 0])!
    const back = imageToPlane(h, img)!
    expect(back[0]).toBeCloseTo(p[0], 4)
    expect(back[1]).toBeCloseTo(p[1], 4)
  })
})

describe("cabinetToPlane", () => {
  it("paret: el darrere del moble és al pla i la fondària surt cap a la càmera", () => {
    expect(cabinetToPlane([100, 200, 300], { plane: "wall", offset: [10, 20], totalDepth: 579 })).toEqual([110, 220, 300])
  })
  it("terra: la base és al pla, el front a l'offset i el darrere més enllà", () => {
    const o = { plane: "floor" as const, offset: [10, 20] as Pt, totalDepth: 579 }
    expect(cabinetToPlane([100, 200, 579], o)).toEqual([110, 20, 200]) // front
    expect(cabinetToPlane([100, 200, 0], o)).toEqual([110, 599, 200]) // darrere
  })
})

describe("projectPanels", () => {
  const panels = buildCabinet(DEFAULT_CABINET)
  const faces = projectPanels(panels, recovered, { plane: "wall", offset: [0, 0], totalDepth: 579 })

  it("només cares que miren a la càmera, cap punt darrere", () => {
    expect(faces.length).toBeGreaterThan(0)
    for (const f of faces) {
      expect(f.facing).toBeGreaterThan(0)
      expect(f.pts).toHaveLength(4)
      for (const [x, y] of f.pts) {
        expect(Number.isFinite(x)).toBe(true)
        expect(Number.isFinite(y)).toBe(true)
      }
    }
  })

  it("ordenades de lluny a prop, i la més propera és de la porta", () => {
    for (let i = 1; i < faces.length; i++) expect(faces[i]!.depth).toBeLessThanOrEqual(faces[i - 1]!.depth)
    expect(faces.at(-1)!.role).toBe("door")
  })

  it("del fons només es dibuixen la cara frontal i, com a molt, dos cantells (mai la posterior)", () => {
    const back = faces.filter((f) => f.panelId === "back")
    for (const f of back) expect(f.facing).toBeGreaterThan(0)
    expect(back.length).toBeGreaterThanOrEqual(1)
    expect(back.length).toBeLessThanOrEqual(3)
  })

  it("el mateix moble al terra també es projecta", () => {
    const floor = projectPanels(panels, recovered, { plane: "floor", offset: [0, 0], totalDepth: 579 })
    expect(floor.length).toBeGreaterThan(0)
  })
})

describe("imageToPlaneAt", () => {
  it("recupera un punt de la paret real quan la referència és per davant", () => {
    const d = 200
    const wallPoint: Vec3 = [350, -420, -d]
    const px = project(truth, wallPoint)!
    const back = imageToPlaneAt(truth, px, -d)!
    expect(back[0]).toBeCloseTo(350, 3)
    expect(back[1]).toBeCloseTo(-420, 3)
  })
  it("amb z = 0 coincideix amb el pla de la referència", () => {
    const px = project(truth, [120, 80, 0])!
    const back = imageToPlaneAt(truth, px, 0)!
    expect(back[0]).toBeCloseTo(120, 3)
    expect(back[1]).toBeCloseTo(80, 3)
  })
  it("el moble recolzat a la paret real queda wallOffset per darrere de la referència", () => {
    const p = cabinetToPlane([0, 0, 0], { plane: "wall", offset: [0, 0], totalDepth: 560, wallOffset: 200 })
    expect(p[2]).toBe(-200)
  })
})
