import { describe, expect, it } from "vitest"
import { buildComposition } from "../../core/build/buildComposition"
import { emptyModule, panelAabb, type Composition } from "../../core/model"
import { dragArrow, dragArrows } from "./dragArrows"
import { DEFAULT_FACE_OPTS, runFaceTool } from "./faceTools"

describe("fletxes d'arrossegar (cel, 2026-11-08)", () => {
  const m = { ...emptyModule("m", "Moble"), gapBefore: 0 }
  const comp0: Composition = { modules: [m], references: [] }
  const build0 = buildComposition(comp0)
  const base = build0.panels.find((p) => p.role === "bottom")!
  const b = panelAabb(base)
  const hit = { panel: base, point: [(b.min[0] + b.max[0]) / 2, b.max[1], (b.min[2] + b.max[2]) / 2] as [number, number, number], normal: [0, 1, 0] as [number, number, number] }
  const r = runFaceTool("dynpanel", DEFAULT_FACE_OPTS, comp0, build0, hit)
  const comp = r.comp!
  const build = buildComposition(comp)
  const id = comp.parts![0]!.id
  const boxOf = (c: Composition) => panelAabb(buildComposition(c).panels.find((p) => p.id === `part:${id}`)!)
  const box0 = boxOf(comp)

  it("el tauler dinàmic triat té una fletxa a cada costat i una al gruix", () => {
    const arrows = dragArrows("dynpanel", DEFAULT_FACE_OPTS, comp, build, id)
    expect(arrows.map((a) => a.id).sort()).toEqual([`dyn:${id}:0:0`, `dyn:${id}:0:1`, `dyn:${id}:2:0`, `dyn:${id}:2:1`, `dynT:${id}`].sort())
    expect(dragArrows("dynpanel", DEFAULT_FACE_OPTS, comp, build, null)).toEqual([])
  })

  it("arrossegar un costat sense imant hi deixa un desplaçament, i segueix lligat", () => {
    const res = dragArrow(`dyn:${id}:0:1`, -100, comp, build, 0)!
    const nb = boxOf(res.comp)
    expect(nb.max[0]).toBeCloseTo(box0.max[0] - 100, 0)
    expect(res.comp.parts![0]!.dyn).toBeTruthy()
    // Si el moble s'eixampla, el costat segueix el lateral (100 mm abans).
    const wide = { ...res.comp, modules: [{ ...m, carcass: { ...m.carcass, width: m.carcass.width + 200 } }] }
    expect(boxOf(wide).max[0]).toBeCloseTo(box0.max[0] + 200 - 100, 0)
  })

  it("prop d'una altra cara, s'hi imanta", () => {
    const res = dragArrow(`dyn:${id}:0:1`, -8, comp, build, 25)!
    expect(boxOf(res.comp).max[0]).toBeCloseTo(box0.max[0], 0)
    expect(res.label).toContain("imant")
  })

  it("la fletxa del gruix el separa de la cara on es recolza", () => {
    const res = dragArrow(`dynT:${id}`, 150, comp, build, 0)!
    expect(boxOf(res.comp).min[1]).toBeCloseTo(box0.min[1] + 150, 0)
  })

  it("la cara dinàmica estira una peça (i deixa d'estar lligada)", () => {
    const arrows = dragArrows("face", DEFAULT_FACE_OPTS, comp, build, id)
    expect(arrows).toHaveLength(6)
    const res = dragArrow(`face:p:${id}:0:0:pull`, 50, comp, build, 0)!
    const nb = boxOf(res.comp)
    expect(nb.min[0]).toBeCloseTo(box0.min[0] - 50, 0)
    expect(nb.max[0]).toBeCloseTo(box0.max[0], 0)
    const mv = dragArrow(`face:p:${id}:1:1:move`, 40, comp, build, 0)!
    expect(boxOf(mv.comp).min[1]).toBeCloseTo(box0.min[1] + 40, 0)
  })

  it("la cara d'un moble l'estira", () => {
    const o = { ...DEFAULT_FACE_OPTS, facePick: { module: "m", a: 0, s: 1 as const } }
    const [arrow] = dragArrows("face", o, comp0, build0, null)
    const res = dragArrow(arrow!.id, 120, comp0, build0, 0)!
    expect(res.comp.modules[0]!.carcass.width).toBe(m.carcass.width + 120)
  })
})
