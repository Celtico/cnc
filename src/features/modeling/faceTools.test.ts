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

describe("unions (clavilles, cargols, Cabineo)", () => {
  const m = { ...emptyModule("m", "Moble"), gapBefore: 0 }
  const comp: Composition = { modules: [m], references: [] }
  const build = buildComposition(comp)
  const base = build.panels.find((p) => p.role === "bottom")!
  const bb = panelAabb(base)
  const left = build.panels.filter((p) => p.role === "side").sort((a, b) => panelAabb(a).min[0] - panelAabb(b).min[0])[0]!
  const lb = panelAabb(left)
  const hands = (c: Composition, id: string) => buildComposition(c).panels.find((p) => p.id === id)!.holes.filter((h) => h.tag === "hand")

  it("les clavilles van del lateral al cantell de la base, centrades al seu gruix", () => {
    const hit = { panel: left, point: [lb.min[0], (bb.min[1] + bb.max[1]) / 2 + 3, (lb.min[2] + lb.max[2]) / 2] as [number, number, number], normal: [-1, 0, 0] as [number, number, number] }
    const r = runFaceTool("dowel", DEFAULT_FACE_OPTS, comp, build, hit)
    expect(r.error, r.message).toBeFalsy()
    const side = hands(r.comp!, left.id)
    const edge = hands(r.comp!, base.id)
    expect(side.length).toBeGreaterThanOrEqual(2)
    expect(edge.length).toBe(side.length)
    expect(edge.every((h) => h.face === "edge")).toBe(true)
  })

  it("el Cabineo fa tres buidats a la base per connector i un cargol al lateral", () => {
    const hit = { panel: base, point: [bb.min[0] + 10, bb.max[1], (bb.min[2] + bb.max[2]) / 2] as [number, number, number], normal: [0, 1, 0] as [number, number, number] }
    const r = runFaceTool("cabineo", DEFAULT_FACE_OPTS, comp, build, hit)
    expect(r.error, r.message).toBeFalsy()
    const pockets = hands(r.comp!, base.id)
    const screws = hands(r.comp!, left.id)
    expect(pockets.length).toBe(3 * screws.length)
    expect(pockets.every((h) => h.diameter === 15)).toBe(true)
  })
})
