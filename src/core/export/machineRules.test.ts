import { beforeAll, describe, expect, it } from "vitest"
// Només per als tests: el .pgmx real del taller (import dinàmic: el tsc de l'app no té els tipus de Node).
const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }
import { machineFromContext } from "../machine/maestro"
import { applyPgmx, parsePgmxXml } from "../machine/pgmx"
import { findRuleTool, profileRuleFor, RulePicker } from "../machine/rules"
import { bytes, read } from "../machine/testContext"
import { defaultMachineRules, isSmallPart, MACHINE_RULES_VERSION, machineRules, parseSettings, repairMachine, withMachineRules, type Machine, type MachineTool, type Panel } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { cncNestOptions, nestingRouter, orderFeats, toMaestroNestXcs } from "./maestroNestXcs"
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
    const m = withMachineRules<Pick<Machine, "rules" | "rulesVersion">>({ rules: old })
    expect(m.rules!.small.maxArea).toBe(0.8)
    expect(m.rules!.small.maxSide).toBe(0)
    expect(m.rulesVersion).toBe(MACHINE_RULES_VERSION)
    expect(withMachineRules(m)).toBe(m)
  })
  it("les migracions es fan un sol cop: si després l'usuari torna a triar Ø + 1 o 300 mm / 0,1 m², es queda", () => {
    const { rules: _r, rulesVersion: _v, ...old } = BASE
    const small = { ...defaultMachineRules().small, maxSide: 300, maxArea: 0.1 }
    const raw = { ...old, rules: { ...defaultMachineRules(), small }, nesting: { edgeTrim: 10, spacingExtra: 1, overcut: 0.3, smallParts: "last" } }
    const first = parseSettings({ version: 10, machines: [raw] })
    const a = first.settings.machines[0]!
    expect(a.nesting!.spacingExtra).toBe(2)
    expect(a.rules!.small.maxArea).toBe(0.8)
    expect(a.rulesVersion).toBe(MACHINE_RULES_VERSION)
    // Es desa la migració (si no, es tornaria a fer i trepitjaria la tria de l'usuari).
    expect(first.migrated).toBe(true)
    // L'usuari ho torna a posar: es queda.
    const mine = { ...a, nesting: { ...a.nesting!, spacingExtra: 1 }, rules: { ...a.rules!, small } }
    const again = parseSettings({ version: 10, machines: [mine] })
    expect(again.settings.machines[0]!.nesting!.spacingExtra).toBe(1)
    expect(again.settings.machines[0]!.rules!.small).toEqual(small)
    expect(again.migrated).toBe(false)
  })
})

describe("reparar una màquina desada", () => {
  it("regles invàlides: es restauren les del taller i es conserva la màquina (amb un problema)", () => {
    const bad = { ...BASE, rules: { ...defaultMachineRules(), grooves: { tool: "8mm diamant", maxPass: -3 } } }
    const r = repairMachine(bad)
    expect(r.machine?.id).toBe(BASE.id)
    expect(r.machine?.rules).toBeUndefined()
    expect(r.problems.join(" ")).toMatch(/regles de mecanitzat invàlides/)
    const s = parseSettings({ version: 10, machines: [bad] })
    expect(s.settings.machines[0]!.rules).toEqual(defaultMachineRules())
    expect(s.problems.join(" ")).toMatch(/regles de mecanitzat invàlides/)
  })
  it("opcions de nesting invàlides (i regles bones): només es treuen les opcions de nesting", () => {
    const mine = { ...defaultMachineRules(), ramp: { enabled: false, length: 40 } }
    const r = repairMachine({ ...BASE, rules: mine, nesting: { edgeTrim: 500, spacingExtra: 2, overcut: 0.3, smallParts: "last" } })
    expect(r.machine?.nesting).toBeUndefined()
    expect(r.machine?.rules).toEqual(mine)
    expect(r.problems).toEqual(["opcions dels programes per tauler invàlides: es restauren les inicials"])
  })
  it("totes dues invàlides: es treuen totes dues", () => {
    const r = repairMachine({ ...BASE, rules: { nope: 1 }, nesting: { edgeTrim: -1 } })
    expect(r.machine).toBeTruthy()
    expect(r.problems).toHaveLength(2)
  })
  it("la resta de la màquina invàlida: es descarta", () => {
    expect(repairMachine({ ...BASE, header: null }).machine).toBeUndefined()
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
  it("una eina amb el nom però no muntada o no automàtica no es fa servir (avís)", () => {
    const off = { ...M, tools: M.tools.map((t) => (t.code === "E801" ? { ...t, auto: false } : t)) }
    expect(findRuleTool(off, "8mm diamant")).toBeUndefined()
    const rp = new RulePicker(off)
    expect(rp.tool("groove", "8mm diamant", 10, 8)).toBeUndefined()
    expect(rp.notes).toEqual([`regla «Ranures»: l'eina «8mm diamant» és a la màquina però no es pot fer servir (no muntada, no automàtica o sense codi de Maestro); es tria l'eina automàticament`])
  })
  it("una eina que no arriba: un sol avís i una sola eina que falta, encara que sigui a diverses fondàries", () => {
    const short = { ...M, tools: M.tools.map((t) => (t.code === "E801" ? { ...t, maxDepth: 5 } : t)) }
    const rp = new RulePicker(short)
    rp.tool("groove", "8mm diamant", 10, 8)
    rp.tool("groove", "8mm diamant", 10, 9)
    rp.tool("groove", "8mm diamant", 10, 12)
    expect(rp.notes).toHaveLength(1)
    expect(rp.missing).toBe(1)
  })
  it("nesting: la de 14 no hi és → automàtica i avís", () => {
    const x = nestOf([panel({ thickness: 30 })], BASE)
    expect(x.warnings[0]).toMatch(/regla «Perfilar 23–41 mm»: l'eina «14mm diamant nesting» no és a la màquina/)
    expect(x.sheets[0]!.ops.find((o) => o.stage === "outer")).toBeTruthy()
    expect(x.missingTool).toBeGreaterThanOrEqual(1)
  })
})

describe("separació del nesting = la fresa de contorn més grossa dels gruixos", () => {
  it("19 + 30 amb el context real: la de 12 (regla 8–22) i la de 30 sense la de la regla (la de nesting que travessa)", () => {
    const panels = [panel({}), panel({ thickness: 30 })]
    const fallback = nestingRouter(BASE, 30.3)!
    const plan = cncNestOptions(panels, BASE, DEFAULT_NEST_OPTIONS)
    expect(plan.tool?.diameter).toBe(Math.max(12, fallback.diameter))
    expect(plan.spacing).toBe(16)
    // El tauler de 30 es fa amb la mateixa fresa que ha fixat la separació, i els textos ho diuen.
    const x = toMaestroNestXcs(panels, nest(panels, plan.options), BASE, { project: "t", date: new Date("2026-10-02") })
    expect(x.spacing).toBe(16)
    expect(x.tool?.code).toBe(plan.tool?.code)
    const t30 = x.sheets.find((s) => s.thickness === 30)!
    expect(t30.ops.find((o) => o.stage === "outer")!.tool).toBe(plan.tool!.code)
    const readme = x.files.at(-1)!.text
    expect(readme).toContain(`separació entre peces 16 mm (fresa ${plan.tool!.mslName ?? plan.tool!.code} Ø${plan.tool!.diameter} + 2)`)
    for (const s of x.sheets) expect(s.text).toContain(`separacio 16 mm (${plan.tool!.mslName ?? plan.tool!.code} D${plan.tool!.diameter} + 2)`)
  })
  it("sense regles: la fresa de nesting de cada gruix", () => {
    const nr: Machine = { ...M, rules: { ...defaultMachineRules(), profile: [] }, tools: [...M.tools, tool("E820", "20mm nesting curta", 20)].map((t) => (t.code === "E820" ? { ...t, maxDepth: 20 } : t)) }
    // Gruix 19: la de nesting més petita que travessa (12); 30: la de 20 no arriba → la mateixa de 12 (o la que travessi).
    const p19 = cncNestOptions([panel({})], nr, DEFAULT_NEST_OPTIONS)
    const both = cncNestOptions([panel({}), panel({ thickness: 30 })], nr, DEFAULT_NEST_OPTIONS)
    const t19 = nestingRouter(nr, 19.3)!
    const t30 = nestingRouter(nr, 30.3)!
    expect(p19.spacing).toBe(t19.diameter + 2)
    expect(both.spacing).toBe(Math.max(t19.diameter, t30.diameter) + 2)
  })
  it("tria la fresa més grossa encara que el gruix més gros no en tingui", () => {
    // Una màquina amb només la de 14 per a 8–22 i la de 12 per a 23–41 (al revés): la separació és 14 + 2.
    const inv: Machine = {
      ...M,
      rules: { ...defaultMachineRules(), profile: [{ min: 8, max: 22, tool: "14mm diamant nesting" }, { min: 23, max: 41, tool: "12mm diamant nesting" }] },
    }
    expect(cncNestOptions([panel({}), panel({ thickness: 30 })], inv, DEFAULT_NEST_OPTIONS).spacing).toBe(16)
  })
})

describe("peces petites al final, sense passades de desbast", () => {
  it("marcades com a petites: van al final (o al principi) encara que no tinguin desbastos", () => {
    // Petites = algun costat de menys de 150 mm (sense desbastos): el llistó de 2000 × 120 (0,24 m²) és petit i la peça de
    // 300 × 200 (0,06 m²), no. Per àrea, el llistó aniria abans; per marca, va al final.
    const noRough: Machine = { ...M, rules: { ...defaultMachineRules(), small: { maxSide: 150, maxArea: 0, passes: [] } } }
    const small = panel({ length: 2000, width: 120, label: "Llistó" })
    const big = panel({ label: "Lateral", length: 1400, width: 700 })
    const big2 = panel({ label: "Lateral 2", length: 300, width: 200 })
    const x = nestOf([big, small, big2], noRough)
    const ops = x.sheets[0]!.ops.filter((o) => o.stage === "outer")
    const smallRef = x.sheets[0]!.parts.find((p) => p.label === "Llistó")!.ref
    expect(ops.every((o) => !o.pass)).toBe(true)
    expect(ops.map((o) => o.ref).at(-1)).toBe(smallRef)
    const firstM: Machine = { ...noRough, nesting: { edgeTrim: 10, spacingExtra: 2, overcut: 0.3, smallParts: "first" } }
    const first = nestOf([big, small, big2], firstM)
    expect(first.sheets[0]!.ops.filter((o) => o.stage === "outer")[0]!.ref).toBe(smallRef)
  })
  it("orderFeats: `small` mana sobre l'àrea", () => {
    const f = (x: number, area: number, small?: boolean) => ({ stage: "outer" as const, key: "k", start: [x, 0] as [number, number], end: [x, 0] as [number, number], area, ...(small ? { small } : {}) })
    // Una «petita» més gran que una normal (llindar per costat, p. ex.): igualment al final.
    const o = orderFeats([f(1, 500_000, true), f(2, 1000), f(3, 90_000)])
    expect(o.map((x) => x.start[0])).toEqual([3, 2, 1])
    expect(orderFeats([f(1, 500_000, true), f(2, 1000), f(3, 90_000)], "first")[0]!.start[0]).toBe(1)
  })
})
