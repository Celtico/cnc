import { beforeAll, describe, expect, it } from "vitest"
// Només per als tests: el .pgmx real del taller (import dinàmic: el tsc de l'app no té els tipus de Node).
const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }
import { buildComposition } from "../build/buildComposition"
import { machineFromContext } from "../machine/maestro"
import { applyPgmx, parsePgmxXml } from "../machine/pgmx"
import { bytes, read } from "../machine/testContext"
import { BUILTIN_TEMPLATES, STORE_TEMPLATES, type BPt, type Machine, type MachineRules, type Panel } from "../model"
import { DEFAULT_NEST_OPTIONS, nest, validateNesting } from "../nesting/nest"
import { cncNestOptions, nestingRouter, orderFeats, sheetFile, toBoard, toMaestroNestXcs, type NestAngle, type PartPlace } from "./maestroNestXcs"

let M: Machine
const NO_RULES: MachineRules = {
  grooves: { tool: "", maxPass: 50 },
  pockets: { tool: "" },
  profile: [],
  ramp: { enabled: false, length: 40 },
  small: { maxSide: 0, maxArea: 0, passes: [] },
}
let M2: Machine
beforeAll(async () => {
  M = (
    await machineFromContext(
      { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
      "m",
    )
  ).machine
  // Sense regles del taller (tria automàtica de sempre): els tests de les regles van a part (`machineRules.test.ts`).
  M = { ...M, rules: NO_RULES }
  const info = parsePgmxXml(new TextDecoder().decode(new Uint8Array(readFileSync("docs/maestro/samples/Proyecto1.pgmx.xml"))))
  M2 = applyPgmx(M, info, "Proyecto1.pgmx", { withHeader: true, now: 0 }).machine
})

const PLACEMENT = { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 1] } as Panel["placement"]
const panel = (over: Partial<Panel>): Panel => ({
  id: "p1",
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

const signedArea = (pts: [number, number][]) => pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * p[1], 0) / 2

describe("gir de les peces al tauler", () => {
  const L = 600
  const W = 400
  const at = (angle: NestAngle): PartPlace => ({ x: 100, y: 50, angle, length: L, width: W })
  it("un forat a (u, v) cau al punt del tauler de cada gir", () => {
    expect(toBoard(at(0), 30, 20)).toEqual([130, 70])
    // 90° antihorari: el costat llarg en Y; (u, v) → (A − v, u).
    expect(toBoard(at(90), 30, 20)).toEqual([480, 80])
    expect(toBoard(at(180), 30, 20)).toEqual([670, 430])
    expect(toBoard(at(270), 30, 20)).toEqual([120, 620])
  })
  it("les cantonades omplen la petjada i el sentit del contorn no canvia (sense mirall)", () => {
    for (const a of [0, 90, 180, 270] as NestAngle[]) {
      const [fw, fh] = a % 180 === 0 ? [L, W] : [W, L]
      const pts = ([[0, 0], [L, 0], [L, W], [0, W]] as [number, number][]).map(([u, v]) => toBoard(at(a), u, v))
      expect(Math.min(...pts.map((p) => p[0]))).toBe(100)
      expect(Math.max(...pts.map((p) => p[0]))).toBe(100 + fw)
      expect(Math.min(...pts.map((p) => p[1]))).toBe(50)
      expect(Math.max(...pts.map((p) => p[1]))).toBe(50 + fh)
      expect(signedArea(pts)).toBeCloseTo(L * W)
    }
  })
  it("coincideix amb el nesting: la peça amb veta en Y va a 90° i els forats hi cauen", () => {
    const p = panel({ grain: "y", holes: [{ x: 37, y: 100, diameter: 5, depth: 12, face: "A" }] })
    const { options } = cncNestOptions([p], M, DEFAULT_NEST_OPTIONS)
    const n = nest([p], options)
    const pl = n.boards[0]!.placements[0]!
    expect(pl.angle).toBe(90)
    const x = toMaestroNestXcs([p], n, M, { project: "t", date: new Date("2026-10-02") })
    const d = x.sheets[0]!.ops.find((o) => o.kind === "drill")!
    expect(d.points[0]).toEqual(toBoard({ x: pl.x, y: pl.y, angle: 90, length: 720, width: 560 }, 37, 100))
    expect(d.points[0]).toEqual([pl.x + 560 - 100, pl.y + 37])
  })
})

describe("contorns per dins i per fora", () => {
  it("talls per dins (costat 0) i contorn per fora (costat 1), antihoraris al tauler, passants al martiri", () => {
    const p = panel({ grain: "y", cutouts: [{ kind: "rect", x: 200, y: 200, w: 100, h: 60 }] })
    const { options } = cncNestOptions([p], M2, DEFAULT_NEST_OPTIONS)
    const x = toMaestroNestXcs([p], nest([p], options), M2, { project: "t" })
    const s = x.sheets[0]!
    const inner = s.ops.find((o) => o.stage === "inner")!
    const outer = s.ops.find((o) => o.stage === "outer")!
    expect(signedArea(inner.points)).toBeGreaterThan(0)
    expect(signedArea(outer.points)).toBeGreaterThan(0)
    expect(inner.depth).toBeCloseTo(19.3)
    expect(outer.depth).toBeCloseTo(19.3)
    expect(s.text).toMatch(/CreateContour\("A\.1\.\w+\.1_Tall_1", 19\.3, 1, 0, "tall passant"/)
    expect(s.text).toMatch(/CreateContour\("A\.1\.\w+\.1_Contorn_1", 19\.3, 1, 1, "contorn", TypeOfProcess\.GeneralRouting, "12mm diamant nesting"/)
    // El tall és dins del contorn de la peça.
    const xs = outer.points.map((q) => q[0])
    const ys = outer.points.map((q) => q[1])
    for (const [px, py] of inner.points) {
      expect(px).toBeGreaterThan(Math.min(...xs))
      expect(px).toBeLessThan(Math.max(...xs))
      expect(py).toBeGreaterThan(Math.min(...ys))
      expect(py).toBeLessThan(Math.max(...ys))
    }
  })
  it("peça amb forma: el contorn del perfil amb arcs, girat", () => {
    const outline: BPt[] = [[0, 0], [400, 0, 0.4], [400, 300], [0, 300]]
    const p = panel({ length: 400, width: 300, outline, grain: "y" })
    const { options } = cncNestOptions([p], M2, DEFAULT_NEST_OPTIONS)
    const x = toMaestroNestXcs([p], nest([p], options), M2, { project: "t" })
    expect(x.sheets[0]!.text).toMatch(/AddArc2PointRadiusToPolyline/)
  })
})

describe("nesting per a la CNC", () => {
  it("separació ≥ Ø de la fresa de nesting i marge de la màquina", () => {
    const tool = nestingRouter(M2, 19.3)!
    expect(tool.mslName).toBe("12mm diamant nesting")
    const panels = Array.from({ length: 12 }, (_, i) => panel({ id: `p${i}`, length: 500 + i * 20, width: 300 }))
    const plan = cncNestOptions(panels, M2, DEFAULT_NEST_OPTIONS)
    expect(plan.spacing).toBe(tool.diameter + 2)
    expect(plan.options.margin).toBe(10)
    const n = nest(panels, plan.options)
    expect(validateNesting(n)).toEqual([])
    for (const b of n.boards) {
      for (const a of b.placements) {
        expect(a.x).toBeGreaterThanOrEqual(10)
        expect(a.y).toBeGreaterThanOrEqual(10)
        for (const c of b.placements) {
          if (a === c) continue
          const gx = Math.max(c.x - (a.x + a.w), a.x - (c.x + c.w))
          const gy = Math.max(c.y - (a.y + a.h), a.y - (c.y + c.h))
          expect(Math.max(gx, gy)).toBeGreaterThanOrEqual(tool.diameter)
        }
      }
    }
    // Opcions de la màquina.
    const m3: Machine = { ...M2, nesting: { edgeTrim: 15, spacingExtra: 3, overcut: 0.5, smallParts: "last" } }
    const plan3 = cncNestOptions(panels, m3, DEFAULT_NEST_OPTIONS)
    expect(plan3.options.margin).toBe(15)
    expect(plan3.spacing).toBe(tool.diameter + 3)
  })
})

describe("ordre", () => {
  it("forats → ranures → talls → contorns, les peces petites al final", () => {
    const f = (stage: "drill" | "groove" | "inner" | "outer", x: number, area = 0, key = "k") => ({ stage, key, start: [x, 0] as [number, number], end: [x, 0] as [number, number], area })
    const feats = [f("outer", 10, 1000), f("drill", 50), f("outer", 20, 100_000), f("inner", 5), f("groove", 1), f("drill", 5), f("outer", 900, 90_000)]
    const o = orderFeats(feats)
    expect(o.map((x) => x.stage)).toEqual(["drill", "drill", "groove", "inner", "outer", "outer", "outer"])
    expect(o.slice(0, 2).map((x) => x.start[0])).toEqual([5, 50])
    expect(o.at(-1)!.area).toBe(1000)
    expect(orderFeats(feats, "first").filter((x) => x.stage === "outer")[0]!.area).toBe(1000)
  })
})

describe("moble del catàleg", () => {
  it("un programa per tauler: estructura, noms únics, tot dins del tauler, rutes", () => {
    const b = buildComposition(BUILTIN_TEMPLATES[0]!.make())
    const { options } = cncNestOptions(b.panels, M2, DEFAULT_NEST_OPTIONS)
    const n = nest(b.panels, options)
    const x = toMaestroNestXcs(b.panels, n, M2, { project: "Prova", date: new Date("2026-10-02") })
    expect(x.programs).toBe(n.boards.length)
    expect(x.files.at(-1)!.name).toBe("LLEGEIX-ME.txt")
    const s = x.sheets[0]!
    expect(s.file).toBe(sheetFile(s.tab, s.material, s.thickness))
    expect(s.file).toMatch(/^T01_[A-Za-z0-9_]+_\d+\.xcs$/)
    const t = s.text.split("\r\n")
    // Capçalera com el programa de nesting real del taller (docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs).
    const head = ["MachineParameters mp=GetMachiningParameters();", `SetMachiningParameters("AD", 1, 10, 16777216, false);`, "SetPreserveWorkingSequence(true);", "SetWorkPieceFallPrevention(true);"]
    expect(t.slice(t.indexOf(head[0]!), t.indexOf(head[0]!) + 4)).toEqual(head)
    // La peça de treball es diu com el tauler del CSV: `<material>_<gruix>#01`.
    expect(s.workpiece).toBe(`${s.material.replace(/\s+/g, "_")}_${s.thickness}#01`)
    expect(t).toContain(`CreateFinishedWorkpieceBox("${s.workpiece}", ${s.w}, ${s.h}, ${s.thickness});`)
    expect(t).toContain(`CreateRawWorkpiece("${s.workpiece}", 0, 0, 0, 0, 0, 0);`)
    expect(t).toContain("SetWorkpieceSetupPosition(0, -20, 0, 0);")
    expect(t).toContain(`CreateMacro("Pload", "PLOAD", 1, 0, 1, 0, 4, 2, false, 0, 0, 0, 0);`)
    expect(t.slice(t.indexOf(`SelectWorkplane("Top");`), t.indexOf(`SelectWorkplane("Top");`) + 4)).toEqual([`SelectWorkplane("Top");`, "SetPneumaticHoodPosition(1);", "ResetAuxiliaryHood();", "ResetDustpan();"])
    // Forats amb els paràmetres opcionals del real i un comentari d'eina abans de cada grup.
    for (const l of t.filter((x) => x.startsWith("CreateDrill("))) expect(l).toMatch(/, "-1", "-1", 0, -1, -1, "P", 0, 2\);$/)
    const firstDrill = t.findIndex((x) => x.startsWith("CreateDrill("))
    if (firstDrill >= 0) expect(t.slice(0, firstDrill).filter((x) => x.startsWith("//BROCA PLANA ")).length).toBeGreaterThan(0)
    expect(t.filter((x) => x.startsWith("//FRESA PLANA ")).length).toBeGreaterThan(0)
    // Un altre màquina pot canviar-ho (Preferències › Màquines CNC › Programes per tauler).
    const custom: Machine = { ...M2, nesting: { edgeTrim: 10, spacingExtra: 2, overcut: 0.3, smallParts: "last", program: { mechanicalOptions: 0, setupPosition: { x: 5, y: 0, z: 0, rot: 0 }, loadMacro: false, pneumaticHood: 3, fallPrevention: false } } }
    const c = toMaestroNestXcs(b.panels, nest(b.panels, cncNestOptions(b.panels, custom, DEFAULT_NEST_OPTIONS).options), custom, { project: "Prova" }).sheets[0]!.text
    expect(c).toContain(`SetMachiningParameters("AD", 1, 10, 0, false);`)
    expect(c).toContain("SetWorkpieceSetupPosition(5, 0, 0, 0);")
    expect(c).toContain("SetWorkPieceFallPrevention(false);")
    expect(c).toContain("SetPneumaticHoodPosition(3);")
    expect(c).not.toContain("Pload")
    for (const part of s.parts) expect(s.text).toContain(`etiqueta al centre (${part.cx}, ${part.cy})`)
    for (const sh of x.sheets) {
      const ns = [...sh.text.matchAll(/^Create(?!FinishedWorkpieceBox|RawWorkpiece)\w+\("([^"]+)"/gm)].map((m) => m[1])
      expect(new Set(ns).size).toBe(ns.length)
      // Un contorn per peça; tot dins del tauler; etapes en ordre.
      expect(sh.ops.filter((o) => o.stage === "outer")).toHaveLength(sh.parts.length)
      const order = ["drill", "groove", "inner", "outer"]
      sh.ops.forEach((o, i) => {
        if (i) expect(order.indexOf(o.stage)).toBeGreaterThanOrEqual(order.indexOf(sh.ops[i - 1]!.stage))
        for (const [px, py] of o.points) {
          expect(px).toBeGreaterThanOrEqual(0)
          expect(px).toBeLessThanOrEqual(sh.w)
          expect(py).toBeGreaterThanOrEqual(0)
          expect(py).toBeLessThanOrEqual(sh.h)
        }
        if (o.stage === "drill" && !o.what.startsWith("tall")) expect(o.depth).toBeLessThan(sh.thickness)
      })
    }
    // Forats de cantell i cara B: a la ruta, no al programa.
    const edgy = b.panels.findIndex((p) => p.holes.some((h) => h.face === "edge"))
    if (edgy >= 0) expect(x.panels[edgy]!.route).toMatch(/^CNC \(tauler \d+\) → .*perforadora horitzontal/)
    const backy = b.panels.findIndex((p) => p.holes.some((h) => h.face === "B") || p.grooves.some((g) => g.face === "B"))
    if (backy >= 0) expect(x.panels[backy]!.postProcesses[0]!.text).toMatch(/^Mecanitzats cara B .*: fer a la perforadora \/ segona passada/)
    expect(x.files.at(-1)!.text).toMatch(/aprofitament \d+ %/)
  })
  const templates = [...BUILTIN_TEMPLATES, ...STORE_TEMPLATES.filter((_, i) => i % 15 === 0)]
  it(`${templates.length} mobles: cada peça col·locada té contorn, tot dins del tauler i fora de les altres peces`, () => {
    let edgeRoutes = 0
    for (const t of templates) {
      const b = buildComposition(t.make())
      const { options } = cncNestOptions(b.panels, M2, DEFAULT_NEST_OPTIONS)
      const n = nest(b.panels, options)
      const x = toMaestroNestXcs(b.panels, n, M2, { project: t.name })
      for (const sh of x.sheets) {
        // Cada peça té el seu contorn o un avís (p. ex. dogbones massa petits per a les freses de la biblioteca).
        for (const part of sh.parts) {
          const has = sh.ops.some((o) => o.stage === "outer" && o.ref === part.ref) || x.warnings.some((w) => w.startsWith(`${part.ref} `) && w.includes("contorn de la peça"))
          expect(has, `${t.name} ${part.ref}`).toBe(true)
        }
        for (const o of sh.ops) {
          // Cada mecanitzat cau dins de la petjada de la seva peça.
          const part = sh.parts.find((q) => q.ref === o.ref)!
          for (const [px, py] of o.points) {
            expect(px, `${t.name} ${o.ref} ${o.what}`).toBeGreaterThanOrEqual(part.x - 0.01)
            expect(px, `${t.name} ${o.ref} ${o.what}`).toBeLessThanOrEqual(part.x + part.w + 0.01)
            expect(py, `${t.name} ${o.ref} ${o.what}`).toBeGreaterThanOrEqual(part.y - 0.01)
            expect(py, `${t.name} ${o.ref} ${o.what}`).toBeLessThanOrEqual(part.y + part.h + 0.01)
          }
        }
      }
      edgeRoutes += x.panels.filter((p) => /perforadora horitzontal/.test(p.route)).length
    }
    expect(edgeRoutes).toBeGreaterThan(0)
  })
})
