import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { emptyModule } from "./index"
import { holeKey } from "./pieceEdits"

const side = (b: ReturnType<typeof buildComposition>) => b.panels.find((p) => p.id === "m:side-left")!

describe("retocs a mà d'una peça (Module.pieceEdits)", () => {
  const base = { ...emptyModule("m", "Moble"), gapBefore: 0 }
  it("canvien els cantells, afegeixen forats i treuen els del mòdul, i es conserven en canviar el mòdul", () => {
    const plain = side(buildComposition({ modules: [base], references: [] }))
    expect(plain).toBeDefined()
    const drop = plain.holes.length ? [holeKey(plain.holes[0]!)] : []
    const edited = { ...base, pieceEdits: { "side-left": { edges: { top: !plain.edges.top }, holes: [{ x: 100, y: 100, diameter: 8, depth: 12, face: "A" as const }], drop } } }
    const p = side(buildComposition({ modules: [edited], references: [] }))
    expect(p.edges.top).toBe(!plain.edges.top)
    expect(p.holes.filter((h) => h.tag === "hand")).toHaveLength(1)
    if (drop.length) expect(p.holes.some((h) => holeKey(h) === drop[0])).toBe(false)
    const wider = side(buildComposition({ modules: [{ ...edited, carcass: { ...edited.carcass, width: edited.carcass.width + 200 } }], references: [] }))
    expect(wider.holes.filter((h) => h.tag === "hand")).toHaveLength(1)
    expect(wider.edges.top).toBe(!plain.edges.top)
  })
})
