import { describe, expect, it } from "vitest"
import { buildComposition } from "../../core/build/buildComposition"
import { emptyModule, panelAabb, type Composition } from "../../core/model"
import { DEFAULT_FACE_OPTS, runFaceTool } from "./faceTools"

describe("tauler dinàmic (FreePart.dyn)", () => {
  const m = { ...emptyModule("m", "Moble"), gapBefore: 0 }
  const comp: Composition = { modules: [m], references: [] }
  const build = buildComposition(comp)
  const base = build.panels.find((p) => p.role === "bottom")!
  const b = panelAabb(base)
  const hit = { panel: base, point: [(b.min[0] + b.max[0]) / 2, b.max[1], (b.min[2] + b.max[2]) / 2] as [number, number, number], normal: [0, 1, 0] as [number, number, number] }
  const panelOf = (c: Composition) => buildComposition(c).panels.find((p) => p.id.startsWith("part:"))!

  it("surt de la cara on es recolza fins als laterals i els segueix quan el moble s'eixampla", () => {
    const r = runFaceTool("dynpanel", DEFAULT_FACE_OPTS, comp, build, hit)
    expect(r.error).toBeFalsy()
    const t = m.carcass.thickness
    const a = panelAabb(panelOf(r.comp!))
    expect(a.min[1]).toBeCloseTo(b.max[1], 0)
    expect(a.max[0] - a.min[0]).toBeCloseTo(m.carcass.width - 2 * t, 0)
    const wide = { ...r.comp!, modules: [{ ...m, carcass: { ...m.carcass, width: m.carcass.width + 300 } }] }
    const w = panelAabb(panelOf(wide))
    expect(w.max[0] - w.min[0]).toBeCloseTo(m.carcass.width + 300 - 2 * t, 0)
  })

  it("el desplaçament el separa de la cara", () => {
    const r = runFaceTool("dynpanel", { ...DEFAULT_FACE_OPTS, dynOff: 100 }, comp, build, hit)
    expect(panelAabb(panelOf(r.comp!)).min[1]).toBeCloseTo(b.max[1] + 100, 0)
  })
})
