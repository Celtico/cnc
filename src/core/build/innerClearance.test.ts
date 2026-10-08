import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, ModuleSchema, applySettingsToModule, defaultModule, hasInnerPieces, moduleHasInnerPieces, parseSettings, visibleModule, withInnerClearance, type Carcass, type Hole, type Module, type Panel, type Vec3, type Zone } from "../model"
import { buildMobleFile, mobleToJson, parseMobleFile } from "../file/mobleFile"
import { DEFAULT_NEST_OPTIONS } from "../nesting/nest"
import { buildComposition } from "./buildComposition"
import { buildModule } from "./buildModule"
import { toWorld } from "./geometry"

/**
 * Folgança de les peces de dins (`Carcass.innerClearance`, Preferències › Folgances per defecte › «Peces de dins»):
 * amb l'arrel dividida, tots els divisors i prestatges fixos (de qualsevol nivell, també els de l'arrel; per decisió de
 * l'usuari, «no ha de comptar el nivell de divisió»), tants mm menys de llarg, la meitat a cada cap i centrats; els
 * prestatges fixos d'un mòdul sense dividir, sencers; els regulables i la caixa no es toquen.
 */

const mod = (root: Zone, innerClearance?: number, carcass: Partial<Carcass> = {}, inset = false): Module => {
  const m = defaultModule("m", "Mòdul", { width: 900, height: 1200, depth: 500, ...carcass })
  return {
    ...m,
    root,
    carcass: { ...m.carcass, ...(innerClearance !== undefined ? { innerClearance } : {}) },
    fronts: { ...m.fronts, ...(inset ? { style: "inset" as const } : {}) },
  }
}

/** Arrel dividida en vertical: a l'esquerra un prestatge fix (divisió horitzontal de dins), a la dreta un divisor de dins
 * amb un prestatge fix (sense «Regulables») a la primera i dos de regulables a la segona. */
const nested = (): Zone => ({
  id: "root",
  split: {
    dir: "v",
    sizes: ["auto", "auto"],
    children: [
      { id: "a", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "a1" }, { id: "a2" }] } },
      { id: "b", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "b1", shelves: { n: 1, adjustable: false } }, { id: "b2", shelves: { n: 2, adjustable: true } }] } },
    ],
  },
})

const byId = (panels: Panel[]) => new Map(panels.map((p) => [p.id, p]))
const dowels = (p: Panel) => p.holes.filter((h) => h.tag === "dowel")
const holeWorld = (p: Panel, h: Hole): Vec3 => toWorld(p, [h.x, h.y, h.face === "A" ? p.thickness : h.face === "B" ? 0 : p.thickness / 2])
/** Mida de la peça al llarg + ample (el constructor posa el costat llarg a `length`: el «llarg» del prestatge pot ser l'ample). */
const size = (p: Panel) => p.length + p.width
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Cada espiga de cantell té el seu forat de cara a una altra peça (mai mitja unió), a `gap` mm (la folgança del cap). */
function expectPaired(panels: Panel[], gapOf: (p: Panel) => number): void {
  const faces = panels.flatMap((q) => dowels(q).filter((h) => h.face !== "edge").map((h) => ({ q, w: holeWorld(q, h) })))
  const edges = panels.flatMap((p) => dowels(p).filter((h) => h.face === "edge").map((h) => ({ p, h, w: holeWorld(p, h) })))
  expect(edges.length).toBe(faces.length)
  for (const e of edges) {
    // A la vora de la peça (no fora): el forat de cantell és sobre el seu cantell.
    const along = e.h.edge === "left" || e.h.edge === "right" ? e.h.x : e.h.y
    const span = e.h.edge === "left" || e.h.edge === "right" ? e.p.length : e.p.width
    expect(Math.min(Math.abs(along), Math.abs(along - span)), `${e.p.id} cantell`).toBeLessThan(0.01)
    // Al moble, a la mateixa línia que un forat de cara d'una altra peça, a la folgança del cap.
    const g = gapOf(e.p)
    expect(faces.some((f) => f.q !== e.p && Math.abs(dist(f.w, e.w) - g) < 0.02), `${e.p.id}: espiga sense parella a ${g} mm`).toBe(true)
  }
}

describe("folgança de les peces de dins", () => {
  it("mòdul sense dividir amb prestatges fixos: sencers (com sense folgança)", () => {
    const root: Zone = { id: "root", shelves: { n: 2, adjustable: false } }
    expect(buildModule(mod(root, 1)).panels).toEqual(buildModule(mod(root, 0)).panels)
    expect(hasInnerPieces(root)).toBe(false)
  })

  it("divisors i prestatges fixos de la primera divisió (vertical o horitzontal): també 1 mm menys, centrats", () => {
    for (const dir of ["v", "h"] as const) {
      const root: Zone = { id: "root", split: { dir, sizes: ["auto", "auto", "auto"], children: [{ id: "a" }, { id: "b" }, { id: "c" }] } }
      const a = byId(buildModule(mod(root, 1)).panels), b = byId(buildModule(mod(root, 0)).panels)
      const role = dir === "v" ? "divider" : "fixedShelf"
      const inner = [...a.values()].filter((p) => p.role === role)
      expect(inner).toHaveLength(2)
      for (const p of inner) {
        const q = b.get(p.id)!
        expect(size(p), p.id).toBeCloseTo(size(q) - 1, 6)
        const mid = (x: Panel) => toWorld(x, [x.length / 2, x.width / 2, 0])
        expect(mid(p), p.id).toEqual(mid(q))
      }
      // La caixa, igual.
      for (const [id, p] of a) if (p.role !== role) expect(size(p), id).toBe(size(b.get(id)!))
      expectPaired([...a.values()], (p) => (p.role === role ? 0.5 : 0))
    }
  })

  it("divisors i prestatges fixos de tots els nivells: 1 mm menys de llarg, centrats; els regulables i la caixa, iguals", () => {
    const withGap = byId(buildModule(mod(nested(), 1)).panels)
    const without = byId(buildModule(mod(nested(), 0)).panels)
    expect([...withGap.keys()].sort()).toEqual([...without.keys()].sort())
    // El divisor de l'arrel, el prestatge fix de «a» i el divisor de «b».
    const changed = new Set<string>()
    for (const [id, p] of withGap) {
      const q = without.get(id)!
      if (size(p) === size(q)) {
        expect(p.placement, id).toEqual(q.placement)
        continue
      }
      changed.add(id)
      expect(size(p), id).toBeCloseTo(size(q) - 1, 6)
      // Només el llarg (la fondària no canvia).
      expect(p.length === q.length || p.width === q.width, id).toBe(true)
      // Centrada: el mig de la peça no es mou (al moble).
      const mid = (x: Panel) => toWorld(x, [x.length / 2, x.width / 2, 0])
      expect(mid(p), id).toEqual(mid(q))
    }
    const roles = [...changed].map((id) => withGap.get(id)!.role).sort()
    // Els dos divisors (l'arrel i «b»), el prestatge fix de la divisió horitzontal i el prestatge fix (no regulable) de «b1».
    expect(roles).toEqual(["divider", "divider", "fixedShelf", "shelf"])
    // Els regulables de «b2»: iguals.
    const adjustable = [...withGap.values()].filter((p) => p.role === "shelf" && !changed.has(p.id))
    expect(adjustable).toHaveLength(2)
  })

  it("els forats de les unions no es mouen: les espigues van aparellades i el forat de cara de l'altra peça és al mateix lloc", () => {
    const a = buildModule(mod(nested(), 1)).panels
    const b = byId(buildModule(mod(nested(), 0)).panels)
    const inner = new Set(a.filter((p) => size(p) !== size(b.get(p.id)!)).map((p) => p.id))
    expect(inner.size).toBe(4)
    // Les peces que no canvien porten els mateixos forats (els de cara de les unions amb les de dins, també).
    for (const p of a) if (!inner.has(p.id)) expect(p.holes, p.id).toEqual(b.get(p.id)!.holes)
    // Les de dins: tantes espigues com sense folgança, al seu cantell i alineades amb el forat de cara.
    for (const id of inner) expect(dowels(a.find((p) => p.id === id)!).length, id).toBe(dowels(b.get(id)!).length)
    expectPaired(a, (p) => (inner.has(p.id) ? 0.5 : 0))
  })

  it("amb fronts encastats, parets buides, inglet i 3 mm: espigues sempre aparellades", () => {
    const cases: Module[] = [
      mod({ ...nested(), front: { kind: "door", mode: "double", hinge: "left" } }, 3, {}, true),
      mod(nested(), 3, { hollow: { thickness: 60 } }),
      mod(nested(), 2, { joint: "mitre" }),
      mod(nested(), 1.5, { back: "inset", backInsetSetback: 10 }),
    ]
    for (const m of cases) {
      const a = buildModule(m), b = buildModule({ ...m, carcass: { ...m.carcass, innerClearance: 0 } })
      const before = byId(b.panels)
      const g = m.carcass.innerClearance! / 2
      const inner = new Set(a.panels.filter((p) => before.get(p.id) && size(p) !== size(before.get(p.id)!)).map((p) => p.id))
      expect(inner.size).toBeGreaterThan(0)
      expectPaired(a.panels, (p) => (inner.has(p.id) ? g : 0))
      expect(a.warnings.map((w) => w.code)).toEqual(b.warnings.map((w) => w.code))
    }
  })

  it("prestatges fixos gruixuts (buits) de dins: pells, tira i llistons segueixen el llarg nou", () => {
    const root: Zone = { id: "root", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a", shelves: { n: 1, adjustable: false, thickness: 60 } }, { id: "b" }] } }
    const a = byId(buildModule(mod(root, 1)).panels), b = byId(buildModule(mod(root, 0)).panels)
    for (const id of ["shelf-1", "shelf-1-top", "shelf-1-facing", "shelf-1-spacer-back"]) {
      const key = [...a.keys()].find((k) => k.endsWith(id))!
      expect(size(a.get(key)!), id).toBeCloseTo(size(b.get(key)!) - 1, 6)
      const mid = (x: Panel) => toWorld(x, [x.length / 2, x.width / 2, 0])
      expect(mid(a.get(key)!), id).toEqual(mid(b.get(key)!))
    }
    for (const [end, dx] of [["left", 0.5], ["right", -0.5]] as const) {
      const key = [...a.keys()].find((k) => k.endsWith(`shelf-1-spacer-${end}`))!
      expect(a.get(key)!.placement.origin[0], end).toBeCloseTo(b.get(key)!.placement.origin[0] + dx, 6)
    }
  })

  it("mòdul d'abans sense el camp: es llegeix com 0 i fa les mateixes peces", () => {
    const m = mod(nested())
    expect(m.carcass.innerClearance).toBeUndefined()
    const parsed = ModuleSchema.parse(JSON.parse(JSON.stringify(m)))
    expect(parsed.carcass.innerClearance).toBeUndefined()
    expect(buildModule(parsed).panels).toEqual(buildModule(mod(nested(), 0)).panels)
  })

  it("fitxer .moble: anada i tornada amb la folgança (i sense, 0)", () => {
    const comp = { kind: "moble" as const, modules: [mod(nested(), 1.5), { ...mod(nested()), id: "m2", gapBefore: 10 }], references: [] }
    const res = parseMobleFile(mobleToJson(buildMobleFile({ name: "Dins", composition: comp, nesting: DEFAULT_NEST_OPTIONS, references: [], exportedAt: "2026-10-08T12:00:00Z" })))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.project.composition.modules.map((m) => m.carcass.innerClearance)).toEqual([1.5, undefined])
    expect(buildComposition(res.file.project.composition).panels).toEqual(buildComposition(comp).panels)
  })

  it("res amagat compta: sense peces de dins (o a 0), el camp no compta", () => {
    expect(moduleHasInnerPieces(mod(nested(), 1))).toBe(true)
    expect(visibleModule(mod(nested(), 1)).carcass.innerClearance).toBe(1)
    expect(visibleModule(mod(nested(), 0)).carcass.innerClearance).toBeUndefined()
    // Sense dividir (amb prestatges fixos o regulables, o calaixos): no n'hi ha.
    for (const flat of [
      { id: "root", shelves: { n: 2, adjustable: false } },
      { id: "root", shelves: { n: 2, adjustable: true } },
      { id: "root", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] }, shelves: { n: 2, adjustable: false } },
    ] satisfies Zone[]) {
      expect(moduleHasInnerPieces(mod(flat, 1))).toBe(false)
      expect(visibleModule(mod(flat, 1)).carcass.innerClearance).toBeUndefined()
      expect(buildModule(mod(flat, 1)).panels).toEqual(buildModule(mod(flat)).panels)
    }
    // Dividida només en la primera divisió, amb regulables o calaixos: el divisor de l'arrel ja la porta.
    const first: Zone = { id: "root", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a", shelves: { n: 2, adjustable: true } }, { id: "b", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] }, shelves: { n: 2, adjustable: false } }] } }
    expect(moduleHasInnerPieces(mod(first, 1))).toBe(true)
    expect(visibleModule(mod(first, 1)).carcass.innerClearance).toBe(1)
  })

  it("mòduls nous i plantilles: la de Preferències (1 mm); els que ja en diuen alguna cosa no es toquen", () => {
    expect(DEFAULT_SETTINGS.gaps.innerClearance).toBe(1)
    expect(applySettingsToModule(DEFAULT_SETTINGS, defaultModule("m", "x")).carcass.innerClearance).toBe(1)
    expect(applySettingsToModule({ ...DEFAULT_SETTINGS, gaps: { ...DEFAULT_SETTINGS.gaps, innerClearance: 0.5 } }, defaultModule("m", "x")).carcass.innerClearance).toBe(0.5)
    const comp = { modules: [mod(nested()), mod(nested(), 0)] }
    const out = withInnerClearance(comp, 1)
    expect(out.modules.map((m) => m.carcass.innerClearance)).toEqual([1, 0])
    expect(withInnerClearance(out, 2)).toBe(out)
  })

  it("preferències v25: les d'abans reben 1 mm (additiu, idempotent); una de desada es queda", () => {
    const { innerClearance: _, ...oldGaps } = DEFAULT_SETTINGS.gaps
    const v24 = { ...DEFAULT_SETTINGS, version: 24, gaps: { ...oldGaps, outerGap: 3 } }
    const a = parseSettings(v24)
    expect(a.problems).toEqual([])
    expect(a.migrated).toBe(true)
    expect(a.settings.gaps).toEqual({ ...oldGaps, outerGap: 3, innerClearance: 1 })
    const again = parseSettings(JSON.parse(JSON.stringify(a.settings)))
    expect(again.settings.gaps).toEqual(a.settings.gaps)
    expect(parseSettings({ ...DEFAULT_SETTINGS, gaps: { ...DEFAULT_SETTINGS.gaps, innerClearance: 0 } }).settings.gaps.innerClearance).toBe(0)
    expect(parseSettings({ ...v24, gaps: { ...v24.gaps, innerClearance: 2.5 } }).settings.gaps.innerClearance).toBe(2.5)
  })
})
