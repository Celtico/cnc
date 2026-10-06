import { describe, expect, it } from "vitest"
import { snapAngle45 } from "./polygon"

describe("snapAngle45 (Maj a la ploma)", () => {
  it("gira al múltiple de 45° més proper i manté la llargada", () => {
    expect(snapAngle45([100, 8])).toEqual([100.3, 0])
    expect(snapAngle45([-3, 50])).toEqual([0, 50.1])
    const [x, y] = snapAngle45([70, 60])
    expect(x).toBeCloseTo(y, 1)
    expect(Math.hypot(x, y)).toBeCloseTo(Math.hypot(70, 60), 0)
    expect(snapAngle45([0, 0])).toEqual([0, 0])
  })
})
