import { describe, expect, it } from "vitest"
import {
  applyHomography,
  computeHomography,
  invertMat3,
  mulMat3,
  planeToImage,
  rectanglePoints,
  solveLinear,
  type Mat3,
  type Pt,
} from "./homography"

const close = (a: Pt, b: Pt, tol = 1e-6) => {
  expect(a[0]).toBeCloseTo(b[0], -Math.log10(tol))
  expect(a[1]).toBeCloseTo(b[1], -Math.log10(tol))
}

describe("solveLinear", () => {
  it("resol un sistema 2×2", () => {
    expect(solveLinear([[2, 1], [1, 3]], [5, 10])).toEqual([1, 3])
  })
  it("retorna null si és singular", () => {
    expect(solveLinear([[1, 2], [2, 4]], [3, 6])).toBeNull()
  })
})

describe("computeHomography", () => {
  const src = rectanglePoints(600, 400)
  // Un quadrilàter en perspectiva (píxels).
  const dst: Pt[] = [
    [312, 880],
    [1502, 910],
    [1440, 210],
    [380, 260],
  ]
  const h = computeHomography(src, dst)!

  it("porta exactament els 4 punts", () => {
    expect(h).not.toBeNull()
    src.forEach((p, i) => close(applyHomography(h, p), dst[i]!))
  })

  it("la inversa desfà la transformació", () => {
    const inv = invertMat3(h)!
    for (const p of [[100, 50], [300, 200], [590, 390]] as Pt[]) {
      close(applyHomography(inv, applyHomography(h, p)), p, 1e-6)
    }
  })

  it("H·H⁻¹ és la identitat (a escala)", () => {
    const inv = invertMat3(h)!
    const id = mulMat3(h, inv)
    const s = id[8]
    const expected: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    id.forEach((v, i) => expect(v / s).toBeCloseTo(expected[i]!, 6))
  })

  it("una homografia afí (sense perspectiva) té h31 = h32 = 0", () => {
    const affine = computeHomography(src, src.map(([x, y]) => [2 * x + 10, 3 * y - 5] as Pt))!
    expect(affine[6]).toBeCloseTo(0, 9)
    expect(affine[7]).toBeCloseTo(0, 9)
    expect(affine[0]).toBeCloseTo(2, 9)
    expect(affine[4]).toBeCloseTo(3, 9)
  })

  it("punts degenerats (tres colineals) → null", () => {
    const bad: Pt[] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ]
    expect(computeHomography(bad, dst)).toBeNull()
  })

  it("planeToImage fa servir l'ordre baix-esquerra, baix-dreta, dalt-dreta, dalt-esquerra", () => {
    const h2 = planeToImage(dst, 600, 400)!
    close(applyHomography(h2, [0, 0]), dst[0]!)
    close(applyHomography(h2, [600, 400]), dst[2]!)
  })
})
