import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type Module } from "../model"
import { buildComposition, moduleFromWorld, moduleToWorld } from "./buildComposition"
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
    expect(mb.turn?.rot).toBe(180)
    expect(moduleToWorld(mb, 0, 0)[0]).toBeCloseTo(mb.x + 2 * mb.turn!.cx)
    const [x, z] = moduleFromWorld(mb, ...moduleToWorld(mb, 123, 45))
    expect([x, z].map(r)).toEqual([123, 45])
  })
  it("arrambat a la paret, «girat» no compta", () => {
    expect(buildComposition(drawers(true, null)).panels).toEqual(buildComposition(drawers(false, null)).panels)
  })
})

describe("mòdul girat 90° o 270° (l'extrem d'una illa)", () => {
  const rotated = (rot: 90 | 270): Composition => {
    const c = drawers(false)
    return { ...c, modules: [{ ...c.modules[0]!, rot }] }
  }
  it("les mateixes peces, girades al voltant del centre: l'amplada va en Z i els fronts miren al costat", () => {
    const a = bounds(drawers(false))
    const strip = (c: Composition) => buildComposition(c).panels.map(({ placement: _p, ...rest }) => rest)
    for (const rot of [90, 270] as const) {
      const b = bounds(rotated(rot))
      // Mateix centre; l'ample i la fondària es canvien.
      expect(r((b.lo[0]! + b.hi[0]!) / 2)).toBeCloseTo(r((a.lo[0]! + a.hi[0]!) / 2))
      expect(r(b.hi[0]! - b.lo[0]!)).toBeCloseTo(r(a.hi[2]! - a.lo[2]!))
      expect(r(b.hi[2]! - b.lo[2]!)).toBeCloseTo(r(a.hi[0]! - a.lo[0]!))
      expect(strip(rotated(rot))).toEqual(strip(drawers(false)))
      const fronts = buildComposition(rotated(rot)).panels.filter((p) => p.role === "drawerFront")
      expect(fronts.every((p) => (rot === 90 ? p.placement.explodeDir[0] > 0 : p.placement.explodeDir[0] < 0))).toBe(true)
    }
  })
  it("el clic i el ressaltat: d'anada i tornada al mòdul", () => {
    const mb = buildComposition(rotated(90)).modules[0]!
    const [x, z] = moduleFromWorld(mb, ...moduleToWorld(mb, 100, 20))
    expect([x, z].map(r)).toEqual([100, 20])
  })
})

describe("sòcol d'una illa amb un mòdul girat 90° a l'extrem", () => {
  it("el costat del sòcol on mira el mòdul de l'extrem va retirat del seu front", () => {
    const m = (id: string, x: number, wallGap: number, rot?: 90 | 180 | 270): Module => {
      const b = defaultModule(id, id, { width: 600, depth: 560 })
      return { ...b, x, wallGap, ...(rot ? { rot } : {}), carcass: { ...b.carcass, base: { kind: "legs", height: 100 } }, root: { ...b.root, front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } } }
    }
    // Dues files d'esquena (z 1500 i 921) i, a la dreta, un mòdul girat 90° que les toca.
    const F = m("F", 0, 1500), B = m("B", 0, 921, 180)
    const fz = 1500 + 579 // la cara dels fronts del de davant
    // Girat 90° al voltant del centre de la seva caixa (x + 300, z + 289,5): la petjada (579 × 600) toca el lateral dels de
    // l'illa a x = 600 i queda centrada en Z.
    const E = m("E", 600 + 579 / 2 - 300, 921 + (fz - 921) / 2 - 579 / 2, 90)
    const c = { kind: "moble", modules: [F, B, E], references: [], support: { kind: "plinth", height: 100, plinth: { setback: 50 } } } as unknown as Composition
    const b = buildComposition(c)
    const plinth = b.panels.filter((p) => /^Sòcol/.test(p.label))
    const maxX = Math.max(...plinth.map((p) => panelBox(p).max[0]!))
    expect(maxX).toBeCloseTo(600 + 579 - 50)
  })
})
