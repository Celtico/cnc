import { describe, expect, it } from "vitest"
import { buildComposition } from "./buildComposition"
import { partFrame, refPoints } from "./hardwarePlace"
import { CompositionSchema, defaultModule, normalizeComposition, repeatCount, repeatOffsets, type Composition, type GenOp, type HardwareItem, type HardwarePlacement, type Panel } from "../model"
import { buildMobleFile, mobleToJson, parseMobleFile } from "../file/mobleFile"
import { toDxf } from "../export/dxf"

/**
 * Ferratges col·locats **paramètrics**: la posició (des de l'inici, el final, el mig o un %, amb un desplaçament o una
 * fórmula amb L · A · G · M) i la repetició (quantitat, regla per la mida, cada tants mm entre marges) es recalculen a
 * cada construcció: si el mòdul canvia de mida, el ferratge el segueix. Mirall esquerra/dreta. Migració de les posicions
 * d'abans (`ref` → `min`).
 */

function item(ops: GenOp[]): HardwareItem {
  return { id: "hw-p", name: "Ferratge de prova", category: "misc", engine: "model", params: {}, targets: [{ key: "model", label: "Només 3D", ops: [] }], version: 1, machining: ops }
}
const drill = (part: GenOp["part"], extra: Partial<GenOp> = {}): GenOp => ({ id: `d-${part}`, part, kind: "drill", face: "A", d: 8, depth: 10, p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 }, ...extra })

function comp(pl: HardwarePlacement[], size: { width?: number; height?: number } = {}): Composition {
  return { modules: [defaultModule("m1", "Baix", size)], references: [], hardwarePlacements: pl }
}
const panel = (c: Composition, id: string): Panel => buildComposition(c).panels.find((p) => p.id === id)!
/** Els forats del ferratge en coordenades del moble (P, Q) de la peça: on són de debò, encara que la peça es mogui. */
function worldPQ(c: Composition, id: string): [number, number][] {
  const p = panel(c, id)
  const f = partFrame(p)
  const AX = { x: 0, y: 1, z: 2 } as const
  return p.holes
    .filter((h) => h.tag === "fitting")
    .map((h) => {
      const { origin: o, xAxis: X, yAxis: Y } = p.placement
      const w = [0, 1, 2].map((i) => o[i]! + h.x * X[i]! + h.y * Y[i]!)
      return [Math.round(w[AX[f.p]]! * 100) / 100, Math.round(w[AX[f.q]]! * 100) / 100] as [number, number]
    })
}
const onTop = (more: Partial<HardwarePlacement>): HardwarePlacement => ({ id: "pl", item: item([drill("top")]), targets: [{ part: "top", module: "m1", panel: "top" }], p: { from: "min", at: 0 }, q: { from: "center", at: 0 }, ...more })
const warns = (c: Composition) => buildComposition(c).warnings.filter((w) => w.code === "hardware").map((w) => w.message)

describe("col·locats paramètrics: segueixen el moble", () => {
  it("centrat amb 2 còpies (cada 200 mm, centrades): canviar l'amplada del mòdul les manté al mig", () => {
    const pl = onTop({ p: { from: "center", at: 0 }, repeat: { axis: "p", count: 2, spacing: 200, layout: "centred" } })
    // Mòdul de 600: X del moble 300 ± 100.
    expect(worldPQ(comp([pl]), "m1:top").map((x) => x[0])).toEqual([200, 400])
    // Mòdul de 1000: 500 ± 100.
    expect(worldPQ(comp([pl], { width: 1000 }), "m1:top").map((x) => x[0])).toEqual([400, 600])
    expect(warns(comp([pl], { width: 1000 }))).toEqual([])
  })

  it("des del final: sempre a la mateixa distància del cantell dret", () => {
    const pl = onTop({ p: { from: "max", at: 50 } })
    expect(worldPQ(comp([pl]), "m1:top")[0]![0]).toBe(581 - 50)
    expect(worldPQ(comp([pl], { width: 900 }), "m1:top")[0]![0]).toBe(881 - 50)
  })

  it("a un % de la peça (i un desplaçament)", () => {
    const pl = onTop({ p: { from: "ratio", pct: 25, at: 10 } })
    // Tapa de 19 a 581 (562): 19 + 140,5 + 10.
    expect(worldPQ(comp([pl]), "m1:top")[0]![0]).toBe(169.5)
    // Tapa de 19 a 981 (962): 19 + 240,5 + 10.
    expect(worldPQ(comp([pl], { width: 1000 }), "m1:top")[0]![0]).toBe(269.5)
  })

  it("fórmula amb les mides de la peça (L, A, G, M), sense eval; una de dolenta no fa res i avisa", () => {
    // Lateral: P = fondària (Z), Q = alçada (Y). M = la mida de l'eix; A = ample de la peça (la fondària del lateral).
    const side = (q: HardwarePlacement["q"], p: HardwarePlacement["p"] = { from: "min", at: 37 }): HardwarePlacement => ({ id: "pl", item: item([drill("side")]), targets: [{ part: "side", module: "m1", panel: "side-left" }], p, q })
    expect(worldPQ(comp([side({ from: "min", at: 0, expr: "M/3" })]), "m1:side-left")[0]![1]).toBe(240)
    expect(worldPQ(comp([side({ from: "min", at: 0, expr: "M/3" })], { height: 900 }), "m1:side-left")[0]![1]).toBe(300)
    expect(worldPQ(comp([side({ from: "min", at: 100 }, { from: "min", at: 0, expr: "A - 37 - G" })]), "m1:side-left")[0]![0]).toBe(560 - 37 - 19)
    const bad = comp([side({ from: "min", at: 0, expr: "M/" })])
    expect(panel(bad, "m1:side-left").holes.some((h) => h.tag === "fitting")).toBe(false)
    expect(warns(bad).join(" ")).toMatch(/fórmula «M\/»/)
    const unknown = comp([side({ from: "min", at: 0, expr: "window.alert(1)" })])
    expect(warns(unknown).join(" ")).toMatch(/fórmula/)
  })

  it("repetir per regla segons la llargada (com les frontisses) repartides entre marges", () => {
    const rule = { steps: [{ upTo: 900, n: 2 }, { upTo: 1600, n: 3 }], else: 4 }
    const pl: HardwarePlacement = { id: "pl", item: item([drill("side")]), targets: [{ part: "side", module: "m1", panel: "side-left" }], p: { from: "min", at: 37 }, q: { from: "min", at: 0 }, repeat: { axis: "q", count: 1, spacing: 0, layout: "span", rule, margins: [100, 100] } }
    // Lateral de 720: 2, a 100 i 620.
    expect(worldPQ(comp([pl]), "m1:side-left").map((x) => x[1])).toEqual([100, 620])
    // Lateral de 1200: 3 (100, 600, 1100).
    expect(worldPQ(comp([pl], { height: 1200 }), "m1:side-left").map((x) => x[1])).toEqual([100, 600, 1100])
    // 2000: 4.
    expect(worldPQ(comp([pl], { height: 2000 }), "m1:side-left")).toHaveLength(4)
  })

  it("cada tants mm entre marges (les que hi caben, centrades)", () => {
    const rep = { axis: "p" as const, count: 1, spacing: 32, layout: "pitch" as const, margins: [37, 37] as [number, number] }
    expect(repeatCount(rep, 562)).toBe(16)
    const offs = repeatOffsets(rep, 562, 0)
    expect(offs[0]!).toBeCloseTo(41)
    expect(offs.at(-1)! - offs[0]!).toBeCloseTo(15 * 32)
    // A la peça: el grup centrat a la tapa.
    const xs = worldPQ(comp([onTop({ repeat: rep })]), "m1:top").map((x) => x[0])
    expect(xs).toHaveLength(16)
    expect((xs[0]! + xs.at(-1)!) / 2).toBeCloseTo(300)
  })

  it("«des del punt» (d'abans) i refPoints directe", () => {
    const top = panel(comp([]), "m1:top")
    const f = partFrame(top)
    expect(refPoints({ p: { from: "min", at: 50 }, q: { from: "min", at: 0 }, repeat: { axis: "p", count: 3, spacing: 100 } }, f)).toEqual([
      [69, 0],
      [169, 0],
      [269, 0],
    ])
  })

  it("tot o res: si una còpia de la repetició surt de la peça, cap", () => {
    const pl = onTop({ p: { from: "center", at: 0 }, repeat: { axis: "p", count: 5, spacing: 200, layout: "centred" } })
    // 300 ± 400: la primera i l'última cauen fora d'una tapa de 562.
    expect(panel(comp([pl]), "m1:top").holes.some((h) => h.tag === "fitting")).toBe(false)
    expect(warns(comp([pl])).join(" ")).toMatch(/fora de la peça/)
    // Prou ample: totes.
    expect(worldPQ(comp([pl], { width: 1200 }), "m1:top")).toHaveLength(5)
  })
})

describe("mirall esquerra/dreta", () => {
  it("al lateral: també al de l'altre costat, a la mateixa alçada i fondària (cara de dins)", () => {
    const pl: HardwarePlacement = { id: "pl", item: item([drill("side")]), targets: [{ part: "side", module: "m1", panel: "side-left" }], p: { from: "max", at: 37 }, q: { from: "min", at: 200 }, mirror: true }
    const c = comp([pl])
    expect(worldPQ(c, "m1:side-right")).toEqual(worldPQ(c, "m1:side-left"))
    expect(panel(c, "m1:side-right").holes.filter((h) => h.tag === "fitting")[0]!.face).toBe("A")
    // Al 3D, el ferratge als dos laterals.
    expect(panel(c, "m1:side-right").fittings?.some((f) => f.placement === "pl")).toBe(true)
  })

  it("a una peça de costat a costat: reflectit respecte del seu mig (els mecanitzats també)", () => {
    const ops = [drill("top", { p: { from: "ref", at: 10 } })]
    const pl = onTop({ item: item(ops), p: { from: "min", at: 50 }, mirror: true })
    const xs = worldPQ(comp([pl]), "m1:top").map((x) => x[0]).sort((a, b) => a - b)
    // Referència a 69 (+10 = 79) i la reflectida a 19 + 581 − 69 = 531 (−10 = 521).
    expect(xs).toEqual([79, 521])
    // Centrat: el mirall cau a sobre i no es repeteix.
    expect(worldPQ(comp([onTop({ p: { from: "center", at: 0 }, mirror: true })]), "m1:top")).toHaveLength(1)
  })

  it("sense peça a l'altre costat (divisor): cap mecanitzat i avís", () => {
    const m = defaultModule("m1", "Baix")
    m.carcass = { ...m.carcass, sides: { ...m.carcass.sides, right: false } }
    const pl: HardwarePlacement = { id: "pl", item: item([drill("side")]), targets: [{ part: "side", module: "m1", panel: "side-left" }], p: { from: "min", at: 37 }, q: { from: "min", at: 200 }, mirror: true }
    const c: Composition = { modules: [m], references: [], hardwarePlacements: [pl] }
    const b = buildComposition(c)
    expect(b.panels.find((p) => p.id === "m1:side-left")!.holes.some((h) => h.tag === "fitting")).toBe(false)
    expect(warns(c).join(" ")).toMatch(/altre costat/)
  })
})

describe("migració i fitxer", () => {
  const old = { id: "pl", item: item([drill("top")]), targets: [{ part: "top", module: "m1", panel: "top" }], p: { from: "ref", at: 50 }, q: { from: "ref", at: 100 }, repeat: { axis: "p", count: 2, spacing: 100 } }
  it("«des de la referència» d'abans es llegeix «des de l'inici»: el mateix resultat, idempotent", () => {
    const raw = { modules: [defaultModule("m1", "Baix")], references: [], hardwarePlacements: [old] }
    const once = normalizeComposition(CompositionSchema.parse(raw))
    expect(once.hardwarePlacements![0]!.p).toEqual({ from: "min", at: 50 })
    expect(once.hardwarePlacements![0]!.q).toEqual({ from: "min", at: 100 })
    const twice = normalizeComposition(CompositionSchema.parse(JSON.parse(JSON.stringify(once))))
    expect(twice).toEqual(once)
    // Les mateixes peces que abans (`ref` = des de l'inici): tapa de 19, forats a 69 i 169; Z 100.
    expect(worldPQ(once, "m1:top")).toEqual([
      [69, 100],
      [169, 100],
    ])
  })

  it(".moble: els camps paramètrics van i tornen", () => {
    const pl = onTop({ p: { from: "ratio", pct: 30, at: 0, expr: "M/10" }, repeat: { axis: "p", count: 1, spacing: 64, layout: "span", rule: { steps: [{ upTo: 600, n: 2 }], else: 3 }, margins: [40, 60] }, mirror: true })
    const c = comp([pl])
    const file = buildMobleFile({ name: "x", composition: c, references: [] })
    const res = parseMobleFile(mobleToJson(file))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.project.composition.hardwarePlacements).toEqual([pl])
    expect(buildComposition(res.file.project.composition).panels).toEqual(buildComposition(c).panels)
  })

  it("arriba al DXF on toca després de canviar la mida", () => {
    const pl = onTop({ p: { from: "max", at: 100 } })
    const dxf = toDxf([panel(comp([pl], { width: 800 }), "m1:top")])
    expect(dxf).toContain("DRILL_D8_P10")
  })
})
