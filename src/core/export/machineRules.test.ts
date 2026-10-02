import { beforeAll, describe, expect, it } from "vitest"
// Només per als tests: el .pgmx real del taller (import dinàmic: el tsc de l'app no té els tipus de Node).
const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }
import { machineFromContext } from "../machine/maestro"
import { applyPgmx, parsePgmxXml } from "../machine/pgmx"
import { findRuleTool, profileRuleFor, RulePicker } from "../machine/rules"
import { bytes, read } from "../machine/testContext"
import { defaultMachineRules, isSmallPart, machineRules, parseSettings, withMachineRules, type Machine, type MachineTool, type Panel } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { cncNestOptions, toMaestroNestXcs } from "./maestroNestXcs"
import { contourPasses, panelXcs, passDepths, rampStart, toMaestroXcs } from "./maestroXcs"

/** Màquina del taller: context + Proyecto1.pgmx (E128 = «12mm diamant nesting»), sense les eines que falten. */
let BASE: Machine
/** La mateixa amb «8mm diamant» i «14mm diamant nesting» afegides a mà (com les afegiria el germà). */
let M: Machine
const tool = (code: string, mslName: string, diameter: number): MachineTool => ({ code, name: mslName, mslName, kind: "router", diameter, maxDepth: 45, mounted: true, auto: true, manual: true })

beforeAll(async () => {
  const ctx = (
    await machineFromContext(
      { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
      "m",
    )
  ).machine
  const info = parsePgmxXml(new TextDecoder().decode(new Uint8Array(readFileSync("docs/maestro/samples/Proyecto1.pgmx.xml"))))
  BASE = applyPgmx(ctx, info, "Proyecto1.pgmx", { withHeader: true, now: 0 }).machine
  M = { ...BASE, tools: [...BASE.tools, tool("E801", "8mm diamant", 8), tool("E814", "14mm diamant nesting", 14)] }
})

const PLACEMENT = { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 1] } as Panel["placement"]
let seq = 0
const panel = (over: Partial<Panel>): Panel => ({
  id: `p${++seq}`,
  name: "lat e",
  label: "Lateral esquerre",
  role: "side",
  length: 720,
  width: 560,
  thickness: 19,
  material: "Melamina blanca",
  grain: "none",
  edges: { left: false, right: false, bottom: false, top: false },
  holes: [],
  grooves: [],
  module: 1,
  placement: PLACEMENT,
  ...over,
})
const nestOf = (panels: Panel[], m: Machine) => {
  const { options } = cncNestOptions(panels, m, DEFAULT_NEST_OPTIONS)
  return toMaestroNestXcs(panels, nest(panels, options), m, { project: "t", date: new Date("2026-10-02") })
}

describe("regles per defecte i migració", () => {
  it("valors del taller", () => {
    const r = defaultMachineRules()
    expect(r.grooves).toEqual({ tool: "8mm diamant", maxPass: 6 })
    expect(r.pockets.tool).toBe("12mm diamant nesting")
    expect(r.profile.map((x) => [x.min, x.max, x.tool])).toEqual([
      [8, 22, "12mm diamant nesting"],
      [23, 41, "14mm diamant nesting"],
    ])
    expect(r.small.passes).toEqual([
      { z: 1, xy: 1 },
      { z: 0.5, xy: 0 },
    ])
    expect(r.ramp.enabled).toBe(true)
  })
  it("una màquina desada sense regles agafa les de per defecte; amb regles, no es toquen (idempotent)", () => {
    const { rules: _r, ...old } = BASE
    const a = parseSettings({ version: 10, machines: [old] }).settings.machines[0]!
    expect(a.rules).toEqual(defaultMachineRules())
    const mine = { ...defaultMachineRules(), grooves: { tool: "6mm helicoidal", maxPass: 4 } }
    const b = parseSettings({ version: 10, machines: [{ ...old, rules: mine }] }).settings.machines[0]!
    expect(b.rules).toEqual(mine)
    const c = parseSettings({ version: 10, machines: [b] }).settings.machines[0]!
    expect(c.rules).toEqual(mine)
  })
  it("peça petita: menys de 0,8 m² (el costat no compta si és 0)", () => {
    const r = defaultMachineRules()
    expect(isSmallPart(r, 720, 560)).toBe(true) // 0,40 m²
    expect(isSmallPart(r, 1000, 799)).toBe(true)
    expect(isSmallPart(r, 1000, 800)).toBe(false)
    expect(isSmallPart(r, 2000, 50)).toBe(true) // 0,1 m²
  })
  it("migra el llindar provisional (300 mm / 0,1 m²) al del taller (0,8 m²)", () => {
    const old = { ...defaultMachineRules(), small: { ...defaultMachineRules().small, maxSide: 300, maxArea: 0.1 } }
    const m = withMachineRules({ rules: old })
    expect(m.rules!.small.maxArea).toBe(0.8)
    expect(m.rules!.small.maxSide).toBe(0)
    expect(withMachineRules(m)).toBe(m)
  })
})

describe("tria de l'eina per la regla", () => {
  it("pel nom de l'MSL, el nom o el codi, sense majúscules", () => {
    expect(findRuleTool(M, "12mm Diamant  Nesting")?.code).toBe("E128")
    expect(findRuleTool(M, "e814")?.mslName).toBe("14mm diamant nesting")
    expect(findRuleTool(BASE, "8mm diamant")).toBeUndefined()
  })
  it("perfilar segons el gruix: 8–22 → 12 mm, 23–41 → 14 mm, fora → automàtica", () => {
    const r = machineRules(M)
    expect(profileRuleFor(r, 19)?.tool).toBe("12mm diamant nesting")
    expect(profileRuleFor(r, 22)?.tool).toBe("12mm diamant nesting")
    expect(profileRuleFor(r, 30)?.tool).toBe("14mm diamant nesting")
    expect(profileRuleFor(r, 45)).toBeUndefined()
    const rp = new RulePicker(M)
    expect(rp.profileTool(16, Infinity, 16.3)?.code).toBe("E128")
    expect(rp.profileTool(30, Infinity, 30.3)?.code).toBe("E814")
    // No hi cap (arcs tancats): automàtica, sense avís.
    expect(rp.profileTool(30, 10, 30.3)).toBeUndefined()
    expect(rp.notes).toEqual([])
  })
  it("nesting: contorns d'un tauler de 30 amb la de 14 i separació 14 + 2 = 16 (del taller); el de 19 amb la de 12", () => {
    const x30 = nestOf([panel({ thickness: 30 })], M)
    expect(x30.spacing).toBe(16)
    const outer = x30.sheets[0]!.ops.find((o) => o.stage === "outer")!
    expect(outer.tool).toBe("E814")
    expect(x30.sheets[0]!.text).toContain(`"14mm diamant nesting"`)
    const x19 = nestOf([panel({})], M)
    expect(x19.sheets[0]!.ops.find((o) => o.stage === "outer")!.tool).toBe("E128")
  })
})

describe("ranures en passades", () => {
  it("fondàries de cada passada (6 mm com a molt)", () => {
    expect(passDepths(5, 6)).toEqual([5])
    expect(passDepths(6, 6)).toEqual([6])
    expect(passDepths(14, 6)).toEqual([6, 12, 14])
    expect(passDepths(12, 6)).toEqual([6, 12])
  })
  it("per peça: la «8mm diamant» (no el disc) amb CreateBidirectionalMillingStrategy si passa de 6 mm", () => {
    const p = panel({ thickness: 30, grooves: [{ x: 0, y: 100, w: 720, h: 10, depth: 14, face: "A" }, { x: 0, y: 300, w: 720, h: 10, depth: 5, face: "A" }] })
    const r = panelXcs(p, "A.1.L.1", M)
    const a = r.programs[0]!.text
    const routes = r.ops.filter((o) => o.kind === "route")
    expect(routes.map((o) => o.tool)).toEqual(["E801", "E801"])
    expect(routes.map((o) => o.passes)).toEqual([[6, 12, 14], [5]])
    expect(a).toContain(`CreateBidirectionalMillingStrategy(true, 6, 0);\r\nCreateRoughFinish("Ranura_1", 14, "ranura", TypeOfProcess.GeneralRouting, "8mm diamant", "-1", 0, -1, -1, -1, 0);`)
    // La de 5 mm, d'una passada: sense estratègia.
    expect(a.match(/CreateBidirectionalMillingStrategy/g)).toHaveLength(1)
    expect(r.warnings).toEqual([])
  })
  it("nesting: la mateixa regla", () => {
    const x = nestOf([panel({ grooves: [{ x: 0, y: 100, w: 720, h: 10, depth: 8, face: "A" }] })], M)
    const g = x.sheets[0]!.ops.find((o) => o.stage === "groove")!
    expect(g.tool).toBe("E801")
    expect(g.passes).toEqual([6, 8])
    expect(x.sheets[0]!.text).toMatch(/CreateBidirectionalMillingStrategy\(true, 6, 0\);\r\nCreateRoughFinish\(/)
  })
})

describe("caixeres", () => {
  it("rebaix tancat pels dos extrems: CreateContourPocket amb la «12mm diamant nesting»", () => {
    const p = panel({ grooves: [{ x: 200, y: 200, w: 100, h: 40, depth: 8, face: "A" }] })
    const r = panelXcs(p, "A.1.L.1", M)
    const a = r.programs[0]!.text
    expect(r.ops[0]!.kind).toBe("pocket")
    expect(a).toContain(`CreatePolyline("Caixera_1_G", 300, 200);`)
    expect(a).toContain(`CreateContourPocket("Caixera_1", 8, "caixera", TypeOfProcess.ConcentricalPocket, "12mm diamant nesting", "-1", -1, -1, -1, 50);`)
    const x = nestOf([p], M)
    expect(x.sheets[0]!.ops.find((o) => o.stage === "groove")!.kind).toBe("pocket")
  })
  it("massa estreta per a la fresa de 12: ranura amb fresa", () => {
    const r = panelXcs(panel({ grooves: [{ x: 200, y: 200, w: 100, h: 10, depth: 8, face: "A" }] }), "A.1.L.1", M)
    expect(r.ops[0]!.kind).toBe("route")
    expect(r.ops[0]!.tool).toBe("E801")
  })
})

describe("peces petites en 3 passades", () => {
  it("passades: Z 1 / XY 1, Z 0,5 / XY 0 i la final", () => {
    expect(contourPasses(19, 19.3, true, defaultMachineRules().small.passes)).toEqual([
      { depth: 18, xy: 1 },
      { depth: 18.5, xy: 0 },
      { depth: 19.3, xy: 0 },
    ])
    expect(contourPasses(19, 19.3, false, defaultMachineRules().small.passes)).toEqual([{ depth: 19.3, xy: 0 }])
  })
  it("nesting: tres CreateContour amb el sobrant (overMaterial) i els desbastos abans de les peces grans", () => {
    const small = panel({ length: 250, width: 100, label: "Llistó" })
    const big = panel({ label: "Lateral", length: 1400, width: 700 })
    const x = nestOf([big, small], M)
    const ops = x.sheets[0]!.ops.filter((o) => o.stage === "outer")
    const mine = ops.filter((o) => o.ref === x.sheets[0]!.parts.find((p) => p.label === "Llistó")!.ref)
    expect(mine.map((o) => [o.depth, o.xy, o.pass?.index])).toEqual([
      [18, 1, 1],
      [18.5, 0, 2],
      [19.3, 0, 3],
    ])
    // Ordre: desbast 1, desbast 2, la peça gran i la final de la petita (al final).
    expect(ops.map((o) => (o.pass ? `P${o.pass.index}` : "gran"))).toEqual(["P1", "P2", "gran", "P3"])
    const text = x.sheets[0]!.text
    expect(text).toMatch(/CreateContour\("A\.1\.L\.\d+_Contorn_1_P1", 18, 1, 1, "contorn", TypeOfProcess\.GeneralRouting, "12mm diamant nesting", "-1", 0, -1, -1, -1, 1\);/)
    expect(text).toMatch(/CreateContour\("A\.1\.L\.\d+_Contorn_1_P3", 19\.3, 1, 1, "contorn", TypeOfProcess\.GeneralRouting, "12mm diamant nesting", "-1", 0, -1, -1, -1, 0\);/)
    // La peça gran: una sola passada.
    expect(ops.filter((o) => !o.pass)).toHaveLength(1)
  })
  it("per peça: el contorn d'una peça amb forma petita, també en 3 passades (final als passants)", () => {
    const p = panel({ length: 200, width: 150, outline: [[0, 0], [200, 0], [200, 150], [0, 150]] })
    const r = panelXcs(p, "A.1.H.1", M)
    const c = r.ops.filter((o) => o.kind === "contour")
    expect(c.map((o) => o.depth)).toEqual([18, 18.5, 19 + M.throughExtra])
    expect(r.programs[0]!.text).toContain(`CreateContour("Contorn_1_P1", 18, 1, 1, "contorn", TypeOfProcess.GeneralRouting, "12mm diamant nesting", "-1", 0, -1, -1, -1, 1);`)
  })
})

describe("rampa d'entrada al nesting", () => {
  it("comença al mig del costat recte més llarg", () => {
    const r = rampStart(
      [
        [0, 0],
        [700, 0],
        [700, 400],
        [0, 400],
      ],
      24,
    )!
    expect(r.pts[0]).toEqual([350, 0])
    expect(r.pts.at(-1)).toEqual([0, 0])
    expect(r.room).toBe(350)
  })
  it("SetApproachStrategy lineal en baixada (k = 40 / radi) abans del contorn i Reset després", () => {
    const x = nestOf([panel({ length: 1400, width: 700 })], M)
    const text = x.sheets[0]!.text
    const outer = x.sheets[0]!.ops.find((o) => o.stage === "outer")!
    expect(outer.ramp).toBe(true)
    expect(text).toMatch(
      /AddSegmentToPolyline\([\d.]+, [\d.]+\);\r\nClosePolyline\(""\);\r\nResetApproachStrategy\(\);\r\nResetRetractStrategy\(\);\r\nSetApproachStrategy\(true, false, 6\.667\);\r\nSetRetractStrategy\(true, false, 6\.667, 0\);\r\nCreateContour\("A\.1\.L\.\d+_Contorn_1", 19\.3, 1, 1, "contorn", TypeOfProcess\.GeneralRouting, "12mm diamant nesting", "-1", 0, -1, -1, -1, 0\);\r\nResetApproachStrategy\(\);\r\nResetRetractStrategy\(\);/,
    )
    // La rampa no surt als programes per peça.
    expect(panelXcs(panel({ outline: [[0, 0], [720, 0], [720, 560], [0, 560]] }), "A", M).programs[0]!.text).not.toContain("SetApproachStrategy")
  })
  it("desactivada: cap estratègia d'entrada", () => {
    const off = { ...M, rules: { ...defaultMachineRules(), ramp: { enabled: false, length: 40 } } }
    expect(nestOf([panel({})], off).sheets[0]!.text).not.toContain("SetApproachStrategy")
  })
})

describe("eina de la regla que falta", () => {
  it("tria automàtica i un sol avís per export (amb missingTool)", () => {
    const p = panel({ grooves: [{ x: 0, y: 100, w: 720, h: 10, depth: 8, face: "A" }, { x: 0, y: 300, w: 720, h: 10, depth: 8, face: "A" }] })
    const base = { ...BASE, grooves: "router" as const, tools: [...BASE.tools, tool("E810", "10mm helicoidal", 10)] }
    const x = toMaestroXcs([p, { ...p, id: "q" }], base, { project: "t" })
    const w = x.warnings.filter((s) => s.includes("regla «Ranures»"))
    expect(w).toEqual([`regla «Ranures»: l'eina «8mm diamant» no és a la màquina (afegeix-la o importa un .pgmx amb el nom); es tria l'eina automàticament`])
    expect(x.missingTool).toBeGreaterThanOrEqual(1)
    // Les ranures surten igualment, amb la fresa automàtica (Ø ≤ 10).
    expect(x.panels[0]!.ops.filter((o) => o.kind === "route").map((o) => o.tool)).toEqual(["E810", "E810"])
  })
  it("nesting: la de 14 no hi és → automàtica i avís", () => {
    const x = nestOf([panel({ thickness: 30 })], BASE)
    expect(x.warnings[0]).toMatch(/regla «Perfilar 23–41 mm»: l'eina «14mm diamant nesting» no és a la màquina/)
    expect(x.sheets[0]!.ops.find((o) => o.stage === "outer")).toBeTruthy()
    expect(x.missingTool).toBeGreaterThanOrEqual(1)
  })
})
