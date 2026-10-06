import { beforeAll, describe, expect, it } from "vitest"
import { buildComposition } from "./buildComposition"
import { machineFromContext } from "../machine/maestro"
import { bytes, read } from "../machine/testContext"
import { defaultMachineRules, defaultModule, type Composition, type GenOp, type HardwareItem, type Machine } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { cncNestOptions, toMaestroNestXcs } from "../export/maestroNestXcs"
import { parseXcsPreview } from "../export/xcsPreview"
import { toDxf, parseDxfEntities } from "../export/dxf"
import { toStep } from "../export/step"
import { toTopsolidCsv } from "../export/topsolidCsv"

/**
 * Un ferratge col·locat a mà arriba a tots els fitxers del taller pels camps de mecanitzat de sempre (`Panel.holes`,
 * `grooves`, `cutouts`): DXF, .xcs (per tauler), STEP i CSV de TopSolid.
 */

let M: Machine
beforeAll(async () => {
  M = (
    await machineFromContext(
      { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
      "m",
    )
  ).machine
  // Amb la fresa de 8 de les ranures afegida a mà (com la hi posaria el germà) i les regles del taller.
  M = { ...M, tools: [...M.tools, { code: "E801", name: "8mm diamant", mslName: "8mm diamant", kind: "router", diameter: 8, maxDepth: 45, mounted: true, auto: true, manual: true }], rules: defaultMachineRules() }
})

const ops: GenOp[] = [
  { id: "g", part: "top", kind: "groove", face: "A", along: "p", full: true, w: 8, depth: 10, p: { from: "ref", at: 0 }, q: { from: "max", at: 20 } },
  { id: "h", part: "top", kind: "drill", face: "A", d: 5, depth: 12, p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 } },
  { id: "t", part: "top", kind: "drill", face: "A", d: 8, depth: 1, through: true, p: { from: "ref", at: 40 }, q: { from: "ref", at: 0 } },
  { id: "b", part: "top", kind: "drill", face: "B", d: 5, depth: 8, p: { from: "ref", at: 0 }, q: { from: "ref", at: 60 } },
]
const item: HardwareItem = { id: "hw", name: "Perfil", category: "door-system", engine: "model", params: {}, targets: [{ key: "model", label: "Només 3D", ops: [] }], version: 1, machining: ops }
const comp: Composition = {
  modules: [defaultModule("m1", "Baix")],
  references: [],
  hardwarePlacements: [{ id: "pl", item, targets: [{ part: "top", module: "m1", panel: "top" }], p: { from: "min", at: 100 }, q: { from: "min", at: 200 } }],
}

describe("ferratge col·locat → fitxers del taller", () => {
  const b = buildComposition(comp)
  const top = b.panels.find((p) => p.id === "m1:top")!

  it("a la peça", () => {
    expect(top.grooves.filter((g) => g.tag === "fitting")).toHaveLength(1)
    expect(top.holes.filter((h) => h.tag === "fitting")).toEqual([{ x: 100, y: 200, diameter: 5, depth: 12, face: "A", tag: "fitting" }, { x: 100, y: 260, diameter: 5, depth: 8, face: "B", tag: "fitting" }])
    expect(top.cutouts).toEqual([{ kind: "circle", x: 140, y: 200, diameter: 8, tag: "fitting" }])
  })

  it("DXF: capes de la ranura, del forat i del tall", () => {
    const layers = parseDxfEntities(toDxf([top])).map((e) => e.layer)
    expect(layers).toContain("GROOVE_W8_P10")
    expect(layers).toContain("DRILL_D5_P12")
    expect(layers).toContain("CUT_THROUGH")
  })

  it(".xcs per tauler: la ranura, el forat i el tall", () => {
    const { options } = cncNestOptions([top], M, DEFAULT_NEST_OPTIONS)
    const x = toMaestroNestXcs([top], nest([top], options), M, { project: "t", date: new Date("2026-10-02") })
    const text = x.sheets.map((s) => s.text).join("\n")
    const prev = parseXcsPreview(text)
    const kinds = prev.ops.map((o) => `${o.kind}:${o.depth}`)
    expect(kinds).toContain("drill:12")
    expect(x.warnings.filter((w) => /Sostre/.test(w))).toEqual([])
    expect(kinds).toContain("rough:10")
    expect(prev.ops.some((o) => o.kind === "drill" && o.depth > 19)).toBe(true)
  })

  it("STEP: el sòlid de la tapa porta els buidats (sense avisos)", () => {
    const plain = toStep([{ ...top, holes: top.holes.filter((h) => h.tag !== "fitting"), grooves: top.grooves.filter((g) => g.tag !== "fitting"), cutouts: [] }], { name: "t", date: "2026-10-02" })
    const s = toStep([top], { name: "t", date: "2026-10-02" })
    expect(s.warnings).toEqual([])
    expect(s.text.length).toBeGreaterThan(plain.text.length)
    expect((s.text.match(/CYLINDRICAL_SURFACE/g) ?? []).length).toBeGreaterThan((plain.text.match(/CYLINDRICAL_SURFACE/g) ?? []).length)
  })

  it("CSV de TopSolid: el forat de la cara B fa la 2a cara de la tapa (els forats van amb el STEP)", () => {
    const csv = toTopsolidCsv(b.panels, nest(b.panels, DEFAULT_NEST_OPTIONS), { project: "t" })
    const row = csv.text.split(/\r?\n/).find((l) => l.includes(";dalt;"))!
    expect(row).toMatch(/Volt/)
  })
})
