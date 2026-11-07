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

describe("retall (només la peça triada)", () => {
  it("la peça solta talla la peça clicada primer i no les altres que travessa", () => {
    const m = { ...emptyModule("m", "Moble"), gapBefore: 0 }
    const base0: Composition = { modules: [m], references: [] }
    const b0 = buildComposition(base0)
    const sides = b0.panels.filter((p) => p.role === "side")
    const box = sides.map(panelAabb)
    // Una barra que travessa els dos laterals, a mitja alçada.
    const bar = { id: "c", name: "Tub", orient: "front" as const, w: box[1]!.max[0] - box[0]!.min[0] + 40, h: 40, thickness: 40, material: "Melamina blanca", x: box[0]!.min[0] - 20, y: 400, z: 200 }
    const comp: Composition = { ...base0, parts: [bar] }
    const build = buildComposition(comp)
    const target = build.panels.find((p) => p.id === sides[0]!.id)!
    const barPanel = build.panels.find((p) => p.id === "part:c")!
    const a = runFaceTool("cut", DEFAULT_FACE_OPTS, comp, build, { panel: target, point: [0, 0, 0], normal: [1, 0, 0] })
    const r = runFaceTool("cut", a.opts!, comp, build, { panel: barPanel, point: [0, 0, 0], normal: [0, 0, 1] })
    expect(r.error, r.message).toBeFalsy()
    const out = buildComposition(r.comp!).panels
    const cut = (id: string) => { const p = out.find((x) => x.id === id)!; return (p.cutouts?.length ?? 0) + (p.outline ? 1 : 0) + (p.pockets?.length ?? 0) }
    expect(cut(sides[0]!.id)).toBeGreaterThan(0)
    expect(cut(sides[1]!.id)).toBe(0)
  })
})

describe("cara dinàmica · enganxar", () => {
  it("de cara: la peça solta va a tocar la cara clicada, amb la separació", () => {
    const m = { ...emptyModule("m", "Moble"), gapBefore: 0 }
    const part = { id: "q", name: "Peça", orient: "side" as const, w: 300, h: 300, thickness: 19, material: "M", x: m.carcass.width + 500, y: 100, z: 50 }
    const comp: Composition = { modules: [m], references: [], parts: [part] }
    const build = buildComposition(comp)
    const pp = build.panels.find((p) => p.id === "part:q")!
    const right = build.panels.filter((p) => p.role === "side").sort((a, b) => panelAabb(b).max[0] - panelAabb(a).max[0])[0]!
    const pa = panelAabb(pp)
    const ra = panelAabb(right)
    const o = { ...DEFAULT_FACE_OPTS, faceMode: "mate" as const, faceGap: 2 }
    const r1 = runFaceTool("face", o, comp, build, { panel: pp, point: [pa.min[0], 200, 100], normal: [-1, 0, 0] })
    expect(r1.opts?.mateFrom).toBeTruthy()
    const r2 = runFaceTool("face", r1.opts!, comp, build, { panel: right, point: [ra.max[0], 200, 100], normal: [1, 0, 0] })
    expect(r2.error).toBeFalsy()
    const moved = r2.comp!.parts!.find((p) => p.id === "q")!
    expect(moved.x).toBeCloseTo(ra.max[0] + 2, 0)
  })
})
