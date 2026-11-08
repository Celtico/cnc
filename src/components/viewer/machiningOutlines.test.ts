import { describe, expect, it } from "vitest"
import type { Panel } from "../../core/model"
import { machiningOutlines } from "./machiningOutlines"

const panel = (holes: unknown[], grooves: unknown[] = []) => ({ length: 600, width: 400, thickness: 19, holes, grooves }) as unknown as Panel
/** Els segments que baixen de la cara A (les ratlles de fondària). */
const verticals = (s: number[]) => {
  let n = 0
  for (let i = 0; i < s.length; i += 6) if (s[i] === s[i + 3] && s[i + 1] === s[i + 4] && s[i + 2] !== s[i + 5]) n++
  return n
}

describe("machiningOutlines", () => {
  it("un forat sol: dues vores (entrada i fons), cap ratlla", () => {
    const s = machiningOutlines(panel([{ x: 100, y: 100, diameter: 8, depth: 12, face: "A" }]))
    expect(s.length / 6).toBe(144)
    expect(verticals(s)).toBe(0)
  })
  it("les tres butxaques del Cabineo: una sola forma amb una ratlla a cada punta", () => {
    const s = machiningOutlines(panel([0, 11.2, 22.4].map((d) => ({ x: 100 + d, y: 100, diameter: 15, depth: 11, face: "A", tag: "cabineo" }))))
    expect(verticals(s)).toBe(4)
    // Fons a 19 − 11 = 8.
    expect(Math.min(...s.filter((_, i) => i % 3 === 2))).toBeCloseTo(8, 5)
  })
  it("una ranura: boca, fons i quatre cantonades", () => {
    expect(machiningOutlines(panel([], [{ x: 0, y: 380, w: 600, h: 4, depth: 8, face: "B" }])).length / 6).toBe(12)
  })
})
