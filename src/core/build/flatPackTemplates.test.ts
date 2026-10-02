import { describe, expect, it } from "vitest"
import { flatPackShelf, flatPackStool } from "../model"
import { buildComposition } from "./buildComposition"

describe("plantilles flat-pack", () => {
  it("prestatgeria: pestanyes passants als laterals i dits a dalt, sense avisos", () => {
    const b = buildComposition(flatPackShelf())
    expect(b.panels).toHaveLength(7)
    // «same-size» és informatiu (el taller casa per mida): es revisa a part.
    expect(b.warnings.filter((w) => w.code !== "same-size")).toEqual([])
    const kinds = b.joints.map((j) => j.kind).sort()
    expect(kinds.filter((k) => k === "tab").length).toBe(8)
    expect(kinds.filter((k) => k === "finger").length).toBe(2)
    const side = b.panels.find((p) => p.label === "Lateral esquerre")!
    expect(side.cutouts!.length).toBeGreaterThan(6)
  })

  it("tamboret: mitja fusta entre potes i pestanyes al seient", () => {
    const b = buildComposition(flatPackStool())
    // «same-size» és informatiu (el taller casa per mida): es revisa a part.
    expect(b.warnings.filter((w) => w.code !== "same-size")).toEqual([])
    expect(b.joints.map((j) => j.kind).sort()).toEqual(["lap", "tab", "tab"])
    const seat = b.panels.find((p) => p.label === "Seient")!
    expect(seat.outline).toBeDefined()
    expect(seat.cutouts!.length).toBeGreaterThan(0)
  })
})
