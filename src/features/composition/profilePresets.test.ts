import { describe, expect, it } from "vitest"
import { PRESETS, matchPreset } from "./profilePresets"

const make = (id: string, w: number, h: number) => PRESETS.find((p) => p.id === id)!.make(w, h)

describe("matchPreset", () => {
  it("reconeix les formes de partida a qualsevol mida", () => {
    expect(matchPreset(make("round", 1200, 800))).toBe("round")
    expect(matchPreset(make("ellipse", 1800, 1100))).toBe("ellipse")
    expect(matchPreset(make("rect", 500, 300))).toBe("rect")
  })
  it("una forma editada no és cap preset", () => {
    const p = make("round", 1200, 800)
    p[0] = { ...p[0]!, x: p[0]!.x + 40 }
    expect(matchPreset(p)).toBeUndefined()
  })
})
