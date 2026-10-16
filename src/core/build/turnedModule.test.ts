import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type Module } from "../model"
import { buildComposition, moduleWorldX } from "./buildComposition"
import { panelBox } from "./geometry"

const drawers = (turned: boolean, wallGap: number | null = 0): Composition => {
  const m: Module = defaultModule("m1", "M")
  return {
    kind: "moble",
    modules: [{ ...m, ...(wallGap !== null ? { wallGap } : {}), ...(turned ? { turned: true } : {}), root: { ...m.root, front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } } }],
    references: [],
  }
}
const bounds = (c: Composition) => {
  const ps = buildComposition(c).panels
  const lo = [0, 1, 2].map((k) => Math.min(...ps.map((p) => panelBox(p).min[k]!)))
  const hi = [0, 1, 2].map((k) => Math.max(...ps.map((p) => panelBox(p).max[k]!)))
  return { lo, hi }
}
const r = (v: number) => Math.round(v * 1000) / 1000

describe("mòdul girat 180° (lliure al terra)", () => {
  it("ocupa el mateix lloc, amb les mateixes peces i mecanitzats, i els fronts miren enrere", () => {
    const a = buildComposition(drawers(false))
    const b = buildComposition(drawers(true))
    expect(bounds(drawers(true)).lo.map(r)).toEqual(bounds(drawers(false)).lo.map(r))
    expect(bounds(drawers(true)).hi.map(r)).toEqual(bounds(drawers(false)).hi.map(r))
    const strip = (c: typeof a) => c.panels.map(({ placement: _p, ...rest }) => rest)
    expect(strip(b)).toEqual(strip(a))
    const fronts = b.panels.filter((p) => p.role === "drawerFront")
    expect(fronts.every((p) => p.placement.explodeDir[2] < 0)).toBe(true)
    // El front és al darrere de la caixa (Z petita).
    const box = bounds(drawers(true))
    for (const f of fronts) expect(panelBox(f).min[2]).toBeCloseTo(box.lo[2]!)
  })
  it("la X del mòdul es llegeix al revés (clic al 3D, compartiment ressaltat)", () => {
    const b = buildComposition(drawers(true))
    const mb = b.modules[0]!
    expect(mb.mirrorX).toBeDefined()
    expect(moduleWorldX(mb, 0)).toBeCloseTo(mb.x + mb.mirrorX!)
  })
  it("arrambat a la paret, «girat» no compta", () => {
    expect(buildComposition(drawers(true, null)).panels).toEqual(buildComposition(drawers(false, null)).panels)
  })
})
