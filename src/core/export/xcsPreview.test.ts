import { beforeAll, describe, expect, it } from "vitest"
// Només per als tests: el .pgmx real del taller i les mostres (import dinàmic: el tsc de l'app no té els tipus de Node).
const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }
import { buildComposition } from "../build/buildComposition"
import { machineFromContext } from "../machine/maestro"
import { applyPgmx, parsePgmxXml } from "../machine/pgmx"
import { bytes, read } from "../machine/testContext"
import { BUILTIN_TEMPLATES, STORE_TEMPLATES, type Machine, type MachineTool } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { cncNestOptions, toMaestroNestXcs } from "./maestroNestXcs"
import { approachSegment, arcCenter, camDraw, camRows, camTools, findTool, flattenPath, offsetPolyline, parseXcsPreview, signedArea, type CamOp, type CamPath, type Pt } from "./xcsPreview"

const sample = (f: string) => new TextDecoder().decode(new Uint8Array(readFileSync(`docs/maestro/samples/${f}`)))
const tool = (code: string, mslName: string, diameter: number): MachineTool => ({ code, name: mslName, mslName, kind: "router", diameter, maxDepth: 45, mounted: true, auto: true, manual: true })

/** Màquina del taller (context + Proyecto1.pgmx) amb la «8mm diamant» i la «14mm diamant nesting» afegides (regles del germà). */
let M: Machine
beforeAll(async () => {
  const ctx = (
    await machineFromContext(
      { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
      "m",
    )
  ).machine
  const info = parsePgmxXml(new TextDecoder().decode(new Uint8Array(readFileSync("docs/maestro/samples/Proyecto1.pgmx.xml"))))
  const base = applyPgmx(ctx, info, "Proyecto1.pgmx", { withHeader: true, now: 0 }).machine
  M = { ...base, tools: [...base.tools, tool("E801", "8mm diamant", 8), tool("E814", "14mm diamant nesting", 14)] }
})

const bbox = (pts: Pt[]) => ({
  x0: Math.min(...pts.map((p) => p[0])),
  x1: Math.max(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  y1: Math.max(...pts.map((p) => p[1])),
})
const rect = (x0: number, y0: number, x1: number, y1: number): CamPath => ({ name: "r", kind: "polyline", start: [x0, y0], segs: [{ to: [x1, y0] }, { to: [x1, y1] }, { to: [x0, y1] }, { to: [x0, y0] }], closed: true })
const contour = (path: CamPath, side: CamOp["side"]): CamOp => ({ n: 1, line: 1, kind: "contour", name: "c", plane: "Top", toolArg: "x", tool: "x", depth: 19, desc: "", path, side })

describe("geometria", () => {
  it("centre d'un arc per dos punts i radi (sentit i més de 180°)", () => {
    expect(arcCenter([1, 0], [0, 1], 1, false, false).map((v) => +v.toFixed(9))).toEqual([0, 0])
    expect(arcCenter([1, 0], [0, 1], 1, true, false).map((v) => +v.toFixed(9))).toEqual([1, 1])
    expect(arcCenter([1, 0], [0, 1], 1, true, true).map((v) => +v.toFixed(9))).toEqual([0, 0])
  })
  it("cercle aplanat: tancat, radi constant", () => {
    const p = parseXcsPreview(`CreateCircleCenterRadius("c", 50, 40, 10, false);\nCreateContour("t", 19.3, 1, 0, "tall", TypeOfProcess.GeneralRouting, "E128", "-1", 0, -1, -1, -1, 0);`)
    const pts = flattenPath(p.ops[0]!.path!)
    expect(pts.length).toBeGreaterThan(36)
    for (const q of pts) expect(Math.hypot(q[0] - 50, q[1] - 40)).toBeCloseTo(10, 6)
    // Per dins amb una fresa de Ø12: el centre a 4 mm del centre.
    const d = camDraw(p.ops[0]!, 12)!
    for (const q of d.centre) expect(Math.hypot(q[0] - 50, q[1] - 40)).toBeCloseTo(4, 6)
    // Ø20 o més: no hi cap, el centre és un punt.
    expect(camDraw(p.ops[0]!, 20)!.centre).toHaveLength(1)
  })
  it("rectangle per fora: el centre de l'eina a r, cantonades arrodonides de radi r", () => {
    const d = camDraw(contour(rect(0, 0, 100, 50), "outside"), 12)!
    expect(bbox(d.centre)).toEqual({ x0: -6, x1: 106, y0: -6, y1: 56 })
    // Cap punt a menys de r de la peça; els costats rectes exactament a r.
    for (const q of d.centre) {
      const dx = Math.max(0 - q[0], 0, q[0] - 100)
      const dy = Math.max(0 - q[1], 0, q[1] - 50)
      expect(Math.hypot(dx, dy)).toBeCloseTo(6, 6)
    }
    expect(d.width).toBe(12)
    // Igual en sentit horari (el costat depèn del sentit de la geometria).
    const cw: CamPath = { ...rect(0, 0, 100, 50), start: [0, 0], segs: [{ to: [0, 50] }, { to: [100, 50] }, { to: [100, 0] }, { to: [0, 0] }] }
    expect(bbox(camDraw(contour(cw, "outside"), 12)!.centre)).toEqual({ x0: -6, x1: 106, y0: -6, y1: 56 })
  })
  it("rectangle per dins (talls, caixeres): cantonades vives exactes a r", () => {
    const d = camDraw(contour(rect(10, 10, 110, 60), "inside"), 12)!
    expect(d.centre).toHaveLength(4)
    expect(bbox(d.centre)).toEqual({ x0: 16, x1: 104, y0: 16, y1: 54 })
    const pocket = camDraw({ ...contour(rect(10, 10, 110, 60), "inside"), kind: "pocket" }, 12)!
    expect(pocket.fill).toBe(true)
  })
  it("fresat obert: centre a la geometria, o a l'esquerra/dreta amb la correcció", () => {
    const path: CamPath = { name: "g", kind: "polyline", start: [0, 0], segs: [{ to: [100, 0] }], closed: false }
    const op: CamOp = { n: 1, line: 1, kind: "rough", name: "r", plane: "Top", toolArg: "x", tool: "x", depth: 8, desc: "", path, side: "center" }
    expect(camDraw(op, 8)!.centre).toEqual([[0, 0], [100, 0]])
    expect(camDraw({ ...op, side: "left" }, 8)!.centre).toEqual([[0, 4], [100, 4]])
    expect(camDraw({ ...op, side: "right" }, 8)!.centre).toEqual([[0, -4], [100, -4]])
  })
  it("òfset d'una forma en L: la cantonada entrant per intersecció", () => {
    const L: Pt[] = [[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]]
    expect(signedArea(L)).toBeGreaterThan(0)
    const o = offsetPolyline(L, true, -5)
    // La cantonada entrant (40, 40) passa a (45, 45).
    expect(o.some((q) => Math.abs(q[0] - 45) < 1e-9 && Math.abs(q[1] - 45) < 1e-9)).toBe(true)
    expect(bbox(o)).toEqual({ x0: -5, x1: 105, y0: -5, y1: 105 })
  })
  it("entrada lineal: acaba al començament del recorregut, en la direcció del primer tram", () => {
    expect(approachSegment([[50, 0], [100, 0], [100, 10]], 40)).toEqual([[10, 0], [50, 0]])
    expect(approachSegment([[50, 0]], 40)).toBeNull()
  })
})

describe("lector de l'MSL", () => {
  it("línies desconegudes o mal fetes: es compten i no fan res", () => {
    const p = parseXcsPreview(
      [
        "hola món",
        `CreateDrill("x", 1, 2`,
        `AddSegmentToPolyline(1, 2);`,
        `CreateDrill("ok", 10, 20, 12, 8, "", TypeOfProcess.Drilling, "-1", "-1");`,
        `CreateDrill("dolent", a, 20, 12, 8, "", TypeOfProcess.Drilling, "-1", "-1");`,
        `FooBar(1, 2);`,
        `CreatePolyline("p", 0, 0);`,
        `AddSegmentToPolyline(10, 0);`,
        `AddArcCenterAngleToPolyline(0, 0, 90);`,
        `SetMachiningParameters ("AD", 1, 10,16777216, false);;`,
        `CreateRoughFinish("q", 5, "\\"cometes\\" i \\\\", TypeOfProcess.GeneralRouting, "8mm diamant", "-1", 0, -1, -1, -1, 0);`,
      ].join("\r\n"),
    )
    expect(p.unknown).toBe(6)
    expect(p.unknownLines.map((u) => u.line)).toEqual([1, 2, 3, 5, 6, 9])
    expect(p.ops.map((o) => o.name)).toEqual(["ok", "q"])
    expect(p.ops[1]!.desc).toBe(`"cometes" i \\`)
    expect(p.ops[1]!.path!.segs).toHaveLength(1)
    expect(() => parseXcsPreview("\u0000\u0001((((")).not.toThrow()
  })

  it("mostra nesting_T01.xcs: tauler, peces, etiquetes i operacions", () => {
    const p = parseXcsPreview(sample("nesting_T01.xcs"))
    expect(p.unknown).toBe(0)
    expect(p.workpiece).toEqual({ name: "Noguera_xapada_19#01", L: 2800, W: 2070, T: 19 })
    expect(p.edgeTrim).toBe(10)
    expect(p.spacing).toBe(14)
    expect(p.parts).toHaveLength(19)
    expect(p.parts[0]).toMatchObject({ ref: "A.1.H.3", name: "baix", label: "Base", length: 1800, width: 440, x: 10, y: 10, angle: 0, cx: 910, cy: 230 })
    expect(p.parts.find((x) => x.ref === "A.1.H.26")).toMatchObject({ name: "estanter 2", label: "Prestatge 2 (pell de baix)" })
    expect(p.parts.every((x) => x.cx !== undefined)).toBe(true)
    const drills = p.ops.filter((o) => o.kind === "drill")
    expect(drills).toHaveLength(60)
    expect(drills[0]).toMatchObject({ name: "A.1.H.3_Forat_3", ref: "A.1.H.3", x: 650.5, y: 50, depth: 12, diameter: 8, toolArg: "-1", tool: "006" })
    const contours = p.ops.filter((o) => o.kind === "contour")
    expect(contours).toHaveLength(57)
    const c = contours[0]!
    expect(c).toMatchObject({ ref: "A.1.F.9", tool: "12mm diamant nesting", side: "outside", depth: 18, overMaterial: 1, small: true, pass: { index: 1, count: 3 }, approach: { linear: true, k: 6.667 } })
    expect(c.path!.closed).toBe(true)
    expect(bbox(flattenPath(c.path!))).toEqual({ x0: 1885, x1: 2543, y0: 1372, y1: 1674.5 })
    // Les operacions, en l'ordre del fitxer.
    expect(p.ops.map((o) => o.n)).toEqual(p.ops.map((_, i) => i + 1))
    expect(p.ops.every((o, i) => !i || o.line > p.ops[i - 1]!.line)).toBe(true)
    // Llegenda i llista.
    const tools = camTools(p.ops, M)
    expect(tools.find((t) => t.kind === "drill" && t.diameter === 8)).toMatchObject({ name: "006", count: 12 })
    expect(tools.find((t) => t.name === "12mm diamant nesting")).toMatchObject({ kind: "router", diameter: 12, count: 57 })
    const rows = camRows(p.ops)
    expect(rows[0]).toMatchObject({ from: 1, to: 12, count: 12, kind: "drill" })
    expect(rows.reduce((a, r) => a + r.count, 0)).toBe(p.ops.length)
  })

  it("programa real del taller (TopSolid): recorreguts explícits del centre de l'eina", () => {
    const p = parseXcsPreview(sample("taller_U767_Gris_cubanita_19_01.xcs"))
    expect(p.unknown).toBe(0)
    expect(p.workpiece).toEqual({ name: "U767_Gris_cubanita_19#01", L: 2800, W: 2070, T: 19 })
    expect(p.ops.filter((o) => o.kind === "drill")).toHaveLength(84)
    const routed = p.ops.filter((o) => o.kind === "rough")
    expect(routed).toHaveLength(5)
    for (const o of routed) expect(o.toolpath).toBeDefined()
    // La fondària de debò és la del recorregut (−19,3), no la de farciment (−2).
    expect(routed.filter((o) => Math.abs(o.depth - 19.3) < 1e-9)).toHaveLength(4)
    // OP7: el centre de l'eina a 6 mm de la peça (12..2352 × 12..491).
    const d = camDraw(routed.find((o) => o.name.startsWith("OP7_1"))!, 12)!
    expect(bbox(d.centre)).toMatchObject({ x0: 6, x1: 2358, y0: 6 })
  })

  it("programa per peça (toMaestroXcs): forats amb el comentari de la broca i contorn amb arcs", () => {
    const l = parseXcsPreview(sample("lateral_A.1.L.1.xcs"))
    expect(l.unknown).toBe(0)
    expect(l.workpiece).toMatchObject({ name: "A.1.L.1", L: 700, W: 440, T: 19 })
    expect(l.ops[0]).toMatchObject({ kind: "drill", tool: "003", diameter: 5 })
    expect(l.ops[0]!.ref).toBeUndefined()
    const s = parseXcsPreview(sample("peca-amb-forma_A.1.H.1.xcs"))
    expect(s.unknown).toBe(0)
    const c = s.ops.find((o) => o.kind === "contour")!
    expect(c.path!.segs.some((x) => x.arc)).toBe(true)
    const b = bbox(flattenPath(c.path!))
    expect(b.x0).toBeCloseTo(0, 1)
    expect(b.x1).toBeCloseTo(1200, 1)
    expect(b.y0).toBeCloseTo(0, 1)
    expect(b.y1).toBeCloseTo(700, 1)
  })
})

describe("programes de l'app (toMaestroNestXcs) amb el context real", () => {
  const templates = [...BUILTIN_TEMPLATES, ...STORE_TEMPLATES.filter((_, i) => i % 20 === 0)]
  it(`${templates.length} mobles: el que es llegeix és el que s'ha escrit`, () => {
    const kinds = new Set<string>()
    let ramps = 0
    let passes = 0
    for (const t of templates) {
      const b = buildComposition(t.make())
      const n = nest(b.panels, cncNestOptions(b.panels, M, DEFAULT_NEST_OPTIONS).options)
      const x = toMaestroNestXcs(b.panels, n, M, { project: t.name })
      for (const sh of x.sheets) {
        const at = `${t.name} ${sh.file}`
        const p = parseXcsPreview(sh.text)
        expect(p.unknown, `${at}: ${p.unknownLines.map((u) => u.text).join(" | ")}`).toBe(0)
        expect(p.workpiece, at).toEqual({ name: sh.workpiece, L: sh.w, W: sh.h, T: sh.thickness })
        // Peces i etiquetes de la capçalera.
        expect(p.parts.map((q) => q.ref), at).toEqual(sh.parts.map((q) => q.ref))
        sh.parts.forEach((q, i) => {
          const r = p.parts[i]!
          expect([r.x, r.y, r.w, r.h, r.angle, r.cx, r.cy], `${at} ${q.ref}`).toEqual([q.x, q.y, q.w, q.h, q.angle, q.cx, q.cy].map((v) => +(+v).toFixed(3)))
        })
        // Una operació per mecanitzat, en el mateix ordre.
        expect(p.ops, at).toHaveLength(sh.ops.length)
        sh.ops.forEach((o, i) => {
          const r = p.ops[i]!
          const w = `${at} #${i + 1} ${o.ref} ${o.what}`
          kinds.add(r.kind)
          expect(r.kind, w).toBe({ drill: "drill", pocket: "pocket", route: "rough", contour: "contour", slot: "slot" }[o.kind as string])
          expect(r.ref, w).toBe(o.ref)
          expect(r.depth, w).toBeCloseTo(o.depth, 2)
          expect(r.plane, w).toBe("Top")
          // L'eina: la de l'operació o, amb broca automàtica, la del comentari (la que ha comprovat l'app).
          expect(findTool(M, r.tool)?.code, w).toBe(o.kind === "drill" ? (o.candidate ?? o.tool) : o.tool)
          if (r.kind === "drill") {
            expect([r.x, r.y], w).toEqual([+o.points[0]![0].toFixed(3), +o.points[0]![1].toFixed(3)])
            return
          }
          const pts = flattenPath(r.path!)
          const a = bbox(pts)
          const e = bbox(o.points)
          for (const k of ["x0", "x1", "y0", "y1"] as const) expect(a[k], `${w} ${k}`).toBeCloseTo(e[k], 1)
          if (o.stage === "outer") expect(r.side, w).toBe("outside")
          if (o.stage === "inner") expect(r.side, w).toBe("inside")
          expect(!!r.approach, w).toBe(!!o.ramp)
          if (o.ramp) ramps++
          expect(r.pass, w).toEqual(o.pass)
          if (o.pass) passes++
          if (o.passes && o.passes.length > 1) expect(r.maxPass, w).toBeGreaterThan(0)
          // El centre de l'eina: per fora dels contorns, a mig Ø.
          if (o.stage === "outer" && r.path!.kind === "polyline" && pts.length === 5) {
            const d = camDraw(r, findTool(M, r.tool)!.diameter)!
            const c = bbox(d.centre)
            const rr = findTool(M, r.tool)!.diameter / 2
            expect(c.x0, w).toBeCloseTo(e.x0 - rr, 1)
            expect(c.y1, w).toBeCloseTo(e.y1 + rr, 1)
          }
        })
      }
    }
    expect([...kinds].sort()).toEqual(expect.arrayContaining(["contour", "drill"]))
    expect(ramps).toBeGreaterThan(0)
    expect(passes).toBeGreaterThan(0)
  })
})

describe("contorns només d'arcs", () => {
  it("«Roda»: el tauler rodó és tancat (contorn de la peça i centre de l'eina per fora)", () => {
    const t = STORE_TEMPLATES.find((x) => x.name.includes("«Roda»"))!
    expect(t).toBeDefined()
    const b = buildComposition(t.make())
    const n = nest(b.panels, cncNestOptions(b.panels, M, DEFAULT_NEST_OPTIONS).options)
    const x = toMaestroNestXcs(b.panels, n, M, { project: t.name })
    const sh = x.sheets.find((s) => s.ops.some((o) => o.stage === "outer" && o.points.length > 20))!
    const p = parseXcsPreview(sh.text)
    const i = sh.ops.findIndex((o) => o.stage === "outer" && o.points.length > 20)
    const r = p.ops[i]!
    expect(r.path!.closed).toBe(true)
    const d = camDraw(r, findTool(M, r.tool)!.diameter)!
    expect(d.closed).toBe(true)
    // El centre de l'eina: fora del tauler (radi més gran que el de la peça).
    const e = bbox(sh.ops[i]!.points)
    const cx = (e.x0 + e.x1) / 2
    const cy = (e.y0 + e.y1) / 2
    const R = (e.x1 - e.x0) / 2
    for (const q of d.centre) expect(Math.hypot(q[0] - cx, q[1] - cy)).toBeGreaterThan(R + 1)
  })
})
