import { beforeAll, describe, expect, it } from "vitest"
// Només per als tests: el .pgmx real del taller (import dinàmic: el tsc de l'app no té els tipus de Node).
const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }
import { buildComposition } from "../build/buildComposition"
import { machineFromContext } from "../machine/maestro"
import { bytes, read } from "../machine/testContext"
import { BUILTIN_TEMPLATES, STORE_TEMPLATES, parseSettings, type BPt, type Machine, type MachineRules, type Panel } from "../model"
import { INSPIRED_TEMPLATES } from "../model/inspiredTemplates"
import { unzip, zipStore } from "../file/zip"
import { applyPgmx, parsePgmxXml } from "../machine/pgmx"
import { cs, dedupePolyline, edgeHoleOnFace, edgePoint, maxToolDiameter, num, panelXcs, planeSize, sharpCorners, toMaestroXcs, xcsBytes } from "./maestroXcs"

let M: Machine
const NO_RULES: MachineRules = {
  grooves: { tool: "", maxPass: 50 },
  pockets: { tool: "" },
  profile: [],
  ramp: { enabled: false, length: 40 },
  small: { maxSide: 0, maxArea: 0, passes: [] },
}
beforeAll(async () => {
  M = (
    await machineFromContext(
      { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
      "m",
    )
  ).machine
  // Sense regles del taller (tria automàtica de sempre): els tests de les regles van a part (`machineRules.test.ts`).
  M = { ...M, rules: NO_RULES }
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
  placement: PLACEMENT,
  ...over,
})

const lines = (t: string) => t.split("\r\n")

describe("format MSL", () => {
  it("números i cadenes", () => {
    expect(num(12)).toBe("12")
    expect(num(12.34567)).toBe("12.346")
    expect(num(-0.0001)).toBe("0")
    // Cadena C#: sense plegar accents (els noms d'eina de Maestro van tal qual), amb \\ i " escapats.
    expect(cs('Lateral "esq" àç\\')).toBe('"Lateral \\"esq\\" àç\\\\"')
    expect(cs("12mm diamant nesting")).toBe('"12mm diamant nesting"')
    expect(cs("a\r\nb")).toBe('"a  b"')
    expect(() => num(NaN)).toThrow()
    expect(() => num(Infinity)).toThrow()
  })
  it("fitxer UTF-8 amb BOM", () => {
    const b = xcsBytes("Ø")
    expect([...b]).toEqual([0xef, 0xbb, 0xbf, 0xc3, 0x98])
  })
  it("punts dels cantells vistos des de fora", () => {
    const p = { length: 720, width: 560, thickness: 19 }
    expect(edgePoint(p, { x: 100, y: 0 }, "bottom")).toEqual([100, 9.5])
    expect(edgePoint(p, { x: 100, y: 560 }, "top")).toEqual([620, 9.5])
    expect(edgePoint(p, { x: 0, y: 37 }, "left")).toEqual([523, 9.5])
    expect(edgePoint(p, { x: 720, y: 37 }, "right")).toEqual([37, 9.5])
  })
})

describe("fresa més grossa per a un contorn", () => {
  it("per dins: amplada − 0,5 i el radi dels arcs (ranura, dogbones)", () => {
    expect(maxToolDiameter([[0, 0], [100, 0], [100, 60], [0, 60]], "inside")).toBe(59.5)
    // Ranura de 10 amb extrems rodons (semicercles de radi 5).
    expect(maxToolDiameter([[5, 0], [95, 0, 1], [95, 10], [5, 10, 1]], "inside")).toBe(9.5)
    // El mateix contorn en sentit horari dona el mateix.
    expect(maxToolDiameter([[5, 10], [95, 10, -1], [95, 0], [5, 0, -1]], "inside")).toBe(9.5)
  })
  it("arcs ja convertits en segments (dogbones): el radi de la tirada", () => {
    // Quadrat de 30 amb un dogbone de radi 3 a la cantonada de dalt a la dreta, fet de segments.
    // El cercle de radi 3 (centre a 2,12 de cada costat) surt per la cantonada: arc antihorari de −45° a 135°.
    const dog: [number, number][] = []
    for (let k = 0; k <= 12; k++) {
      const a = -Math.PI / 4 + (k / 12) * Math.PI
      dog.push([30 - 2.12 + 3 * Math.cos(a), 30 - 2.12 + 3 * Math.sin(a)])
    }
    const pts = [[0, 0], [30, 0], ...dog, [0, 30]] as [number, number][]
    expect(maxToolDiameter(pts, "inside")).toBeCloseTo(6, 0)
  })
  it("per fora: només els arcs còncaus de la peça (una osca rodona)", () => {
    // Rectangle amb una osca semicircular de radi 20 al costat de dalt (cap endins: arc horari).
    const notch: [number, number, number?][] = [[0, 0], [200, 0], [200, 100], [120, 100, -1], [80, 100], [0, 100]]
    expect(maxToolDiameter(notch as never, "outside")).toBeCloseTo(40)
    expect(maxToolDiameter([[0, 0], [200, 0], [200, 100], [0, 100]], "outside")).toBe(Infinity)
  })
})

describe("peça senzilla (golden)", () => {
  const side = () =>
    panel({
      holes: [
        { x: 37, y: 100, diameter: 5, depth: 12, face: "A", tag: "system32" },
        { x: 22.5, y: 100, diameter: 35, depth: 13, face: "A", tag: "hinge" },
        { x: 0, y: 37, diameter: 8, depth: 30, face: "edge", edge: "left", tag: "dowel" },
        { x: 360, y: 280, diameter: 8, depth: 10, face: "B" },
      ],
      grooves: [{ x: 0, y: 10, w: 720, h: 10.5, depth: 8, face: "A" }],
    })

  it("programa A: capçalera, forats, cantell i ranura amb disc", () => {
    const r = panelXcs(side(), "A.1.L.1", M)
    expect(r.programs.map((p) => p.file)).toEqual(["A.1.L.1.xcs", "A.1.L.1Volt.xcs"])
    const a = lines(r.programs[0]!.text)
    expect(a).toContain(`SetMachiningParameters("AD", 1, 10, 0, false);`)
    expect(a).toContain(`CreateFinishedWorkpieceBox("A.1.L.1", 720, 560, 19);`)
    expect(a).toContain(`CreateRawWorkpiece("A.1.L.1", 0, 0, 0, 0, 0, 0);`)
    expect(a).toContain(`SelectWorkplane("Top");`)
    // Broques verticals: eina automàtica (com els .pgmx del taller), amb la que hi ha al comentari.
    expect(a).toContain(`// broca vertical O5 (003): eina automatica`)
    expect(a).toContain(`CreateDrill("Forat_1", 37, 100, 12, 5, "", TypeOfProcess.Drilling, "-1", "-1");`)
    expect(a).toContain(`CreateDrill("Forat_2", 22.5, 100, 13, 35, "", TypeOfProcess.Drilling, "-1", "-1");`)
    expect(r.ops.find((o) => o.what.startsWith("forat Ø5"))).toMatchObject({ tool: "-1", candidate: "003" })
    // Cantell 4 (esquerre) → cara «Left», X = ample − y, Y = mig gruix; broca horitzontal automàtica.
    expect(a).toContain(`SelectWorkplane("Left");`)
    expect(a).toContain(`CreateDrill("ForatCantell_1", 523, 9.5, 30, 8, "", TypeOfProcess.Drilling, "-1", "-1");`)
    // Ranura de 10,5 de cantell a cantell: 4 passades del disc E604 de 3,2.
    expect(a.filter((l) => l.startsWith("CreateSlot("))).toHaveLength(4)
    expect(a).toContain(`CreateSegment("Ranura_1_S1", 0, 11.6, 720, 11.6);`)
    expect(a).toContain(`CreateSlot("Ranura_1_1", 8, "Ranura_1", TypeOfProcess.GeneralRouting, "E604", "-1", 0, -1, -1, -1, 0);`)
    expect(a).toContain(`CreateSegment("Ranura_1_S4", 0, 18.9, 720, 18.9);`)
    expect(r.warnings).toEqual([])
    expect(r.features).toBe(r.handled + r.skipped)
  })

  it("opció «eina concreta»: el nom de la broca", () => {
    const r = panelXcs(side(), "A.1.L.1", { ...M, verticalDrills: "tool" })
    const a = lines(r.programs[0]!.text)
    expect(a).toContain(`CreateDrill("Forat_1", 37, 100, 12, 5, "", TypeOfProcess.Drilling, "003", "-1");`)
    expect(a).toContain(`CreateDrill("Forat_2", 22.5, 100, 13, 35, "", TypeOfProcess.Drilling, "013", "-1");`)
  })

  it("programa Volt: cara B girada sobre X", () => {
    const r = panelXcs(side(), "A.1.L.1", M)
    const b = lines(r.programs[1]!.text)
    expect(b).toContain(`CreateFinishedWorkpieceBox("A.1.L.1", 720, 560, 19);`)
    // y = 280 → 560 − 280 = 280; el forat de 8 vertical és el 006.
    expect(b).toContain(`CreateDrill("Forat_1", 360, 280, 10, 8, "", TypeOfProcess.Drilling, "-1", "-1");`)
    expect(r.ops.find((o) => o.program === "B")).toMatchObject({ tool: "-1", candidate: "006" })
    expect(b.some((l) => l.includes("ForatCantell"))).toBe(false)
  })

  it("ranura que no arriba als cantells: fresa (o avís si cap hi cap)", () => {
    const r = panelXcs(panel({ grooves: [{ x: 50, y: 100, w: 300, h: 14, depth: 8, face: "A" }] }), "R", M)
    const a = lines(r.programs[0]!.text)
    expect(a).toContain(`CreatePolyline("Ranura_1_G", 57, 107);`)
    expect(a).toContain(`AddSegmentToPolyline(343, 107);`)
    expect(a).toContain(`CreateRoughFinish("Ranura_1", 8, "ranura", TypeOfProcess.GeneralRouting, "E219", "-1", 0, -1, -1, -1, 0);`)
    const narrow = panelXcs(panel({ grooves: [{ x: 50, y: 100, w: 300, h: 10, depth: 8, face: "A" }] }), "R", M)
    expect(narrow.programs).toEqual([])
    expect(narrow.warnings[0]).toMatch(/cap fresa de Ø ≤ 10/)
  })

  it("talls: tirador Ø5 amb broca, rectangle i contorn amb arcs amb fresa", () => {
    const r = panelXcs(
      panel({
        role: "door",
        cutouts: [
          { kind: "circle", x: 100, y: 50, diameter: 5, tag: "handle" },
          { kind: "rect", x: 200, y: 200, w: 100, h: 60 },
        ],
        outline: [
          [0, 0],
          [720, 0],
          [720, 460, Math.tan(Math.PI / 8)],
          [620, 560],
          [0, 560],
        ],
      }),
      "D",
      M,
    )
    const a = lines(r.programs[0]!.text)
    expect(a).toContain(`CreateDrill("ForatPassant_1", 100, 50, 20, 5, "", TypeOfProcess.Drilling, "-1", "-1");`)
    expect(a).toContain(`CreatePolyline("Tall_1_G", 300, 200);`)
    expect(a).toContain(`ClosePolyline("");`)
    // Rectangle (cantonades vives): la fresa més petita, i avís del radi que hi queda.
    expect(a).toContain(`CreateContour("Tall_1", 20, 1, 0, "tall passant", TypeOfProcess.GeneralRouting, "E128", "-1", 0, -1, -1, -1, 0);`)
    expect(r.warnings).toEqual([`tall rect 100 × 60 a (200, 200): 4 cantonades vives queden amb radi 6 mm (fresa E128 Ø12)`])
    // Arc de 90° (bulge tan(22,5°)) de radi 100, antihorari.
    expect(a).toContain(`AddArc2PointRadiusToPolyline(620, 560, 100, false, false);`)
    expect(a).toContain(`CreateContour("Contorn_1", 20, 1, 1, "contorn", TypeOfProcess.GeneralRouting, "E219", "-1", 0, -1, -1, -1, 0);`)
    // El contorn, l'últim.
    expect(a.filter((l) => l.startsWith("Create")).at(-1)).toMatch(/^CreateContour\("Contorn_1"/)
  })

  it("sense eina: avís i el mecanitzat no surt", () => {
    const r = panelXcs(panel({ holes: [{ x: 50, y: 50, diameter: 6, depth: 10, face: "A" }, { x: 0, y: 50, diameter: 5, depth: 20, face: "edge", edge: "left" }] }), "X", M)
    expect(r.programs).toEqual([])
    expect(r.skipped).toBe(2)
    expect(r.warnings.join("\n")).toMatch(/cap broca vertical de Ø6/)
    expect(r.warnings.join("\n")).toMatch(/cap broca horitzontal de Ø5/)
    expect(r.missingTool).toBe(2)
    // El forat de cantell que no surt també va a la ruta (perforadora), a més de l'avís.
    expect(r.postProcesses.map((x) => x.text)).toEqual(["Forats de cantell · 1 forat que no fa la CNC (perforadora horitzontal)"])
    expect(r.route).toBe("CNC: sense programa → perforadora horitzontal")
  })
})

describe("després de la CNC (post-processos)", () => {
  it("inglets i cantells: no són avisos, són passos de la ruta, també al .xcs com a comentari", () => {
    const p = panel({
      mitres: ["right", "left"],
      edges: { left: false, right: false, bottom: true, top: true },
      holes: [
        { x: 37, y: 100, diameter: 5, depth: 12, face: "A" },
        { x: 0, y: 37, diameter: 8, depth: 30, face: "edge", edge: "left" },
        { x: 360, y: 280, diameter: 8, depth: 10, face: "B" },
      ],
      assembly: "Lateral esquerre (paret buida)",
    })
    const r = panelXcs(p, "A.1.L.1", M)
    expect(r.warnings).toEqual([])
    expect(r.missingTool).toBe(0)
    // El forat de cantell el fa la CNC: no surt; la cara B és el programa Volt.
    expect(r.postProcesses.map((x) => x.text)).toEqual([
      "Programa cara B: A.1.L.1Volt.xcs (girar la peça sobre l'eix X)",
      "Inglet a 45° · cantells 2+4 (serra)",
      "Cantejar cantells 1+3 (cantejadora)",
      "Encolar · Lateral esquerre (paret buida)",
    ])
    expect(r.route).toBe("CNC: A.1.L.1.xcs + A.1.L.1Volt.xcs → serra (inglets) → cantejadora → encolar")
    const a = lines(r.programs[0]!.text)
    expect(a).toContain(`// Ordre de treball: CNC: A.1.L.1.xcs + A.1.L.1Volt.xcs -> serra (inglets) -> cantejadora -> encolar`)
    expect(a).toContain(`//   2. Inglet a 45 graus - cantells 2+4 (serra)`)
    // Res que aturi la màquina (missatges a l'operari).
    expect(r.programs[0]!.text).not.toMatch(/CreateMessage|ShowMessage/)
    for (const prog of r.programs) expect(prog.text.split("\r\n").filter((l) => l.startsWith("//")).join("")).toMatch(/^[\x20-\x7e]*$/)
  })

  it("LLEGEIX-ME: «Després de la CNC» per peça i «Avisos» només amb problemes", () => {
    const mitred = panel({ id: "m", mitres: ["top"], holes: [{ x: 37, y: 100, diameter: 5, depth: 12, face: "A" }] })
    const x = toMaestroXcs([mitred], M, { project: "Prova", date: new Date("2026-10-02") })
    expect(x.warnings).toEqual([])
    expect(x.postProcessPanels).toBe(1)
    const t = x.files.at(-1)!.text
    expect(t).toMatch(/Ordre de treball: CNC: .+\.xcs → serra \(inglets\)/)
    expect(t).toMatch(/1\. Inglet a 45° · cantell 1 \(serra\)/)
    expect(t).not.toMatch(/^Avisos/m)
    const bad = toMaestroXcs([panel({ holes: [{ x: 50, y: 50, diameter: 6, depth: 10, face: "A" }] })], M, { project: "Prova" })
    expect(bad.missingTool).toBe(1)
    expect(bad.files.at(-1)!.text).toMatch(/^Avisos \(1\)/m)
  })
})

describe("geometria", () => {
  it("punts repetits i segments de llargada zero fora", () => {
    expect(dedupePolyline([[0, 0], [10, 0], [10, 0.0004, 1], [10, 10], [0, 10], [0, 0]])).toEqual([[0, 0], [10, 0.0004, 1], [10, 10], [0, 10]])
    expect(dedupePolyline([[5, 5], [5, 5]])).toHaveLength(1)
  })
  it("mig cercle amb el centre (AddArc2PointCenterToPolyline) i ranura rodona = cercle", () => {
    const r = panelXcs(panel({ cutouts: [{ kind: "slot", x: 100, y: 100, w: 100.003, h: 20 }, { kind: "slot", x: 300, y: 100, w: 20, h: 20.0004 }] }), "S", M)
    const a = lines(r.programs[0]!.text)
    expect(a).toContain(`AddArc2PointCenterToPolyline(190.003, 120, 190.003, 110, false);`)
    expect(a.some((l) => l.startsWith("AddArc2PointRadiusToPolyline"))).toBe(false)
    // La segona és un cercle de Ø20: la broca de 20 (009), automàtica.
    expect(a).toContain(`CreateDrill("ForatPassant_1", 310, 110, 20, 20, "", TypeOfProcess.Drilling, "-1", "-1");`)
    expect(r.warnings).toEqual([])
  })
  it("cantonades vives: per dins les del forat, per fora les entrants", () => {
    expect(sharpCorners([[0, 0], [10, 0], [10, 10], [0, 10]], "inside")).toBe(4)
    expect(sharpCorners([[0, 0], [10, 0], [10, 10], [0, 10]], "outside")).toBe(0)
    // L: una cantonada entrant.
    expect(sharpCorners([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]], "outside")).toBe(1)
    expect(sharpCorners([[5, 0], [95, 0, 1], [95, 10], [5, 10, 1]], "inside")).toBe(0)
  })
  it("forats de cantell d'una peça amb forma: només si el contorn toca la cara", () => {
    const outline: BPt[] = [[0, 0], [400, 0], [400, 200], [200, 300], [0, 300]]
    const p = { length: 400, width: 300, outline }
    expect(edgeHoleOnFace(p, { x: 100, y: 0, diameter: 8 }, "bottom")).toBe(true)
    expect(edgeHoleOnFace(p, { x: 0, y: 150, diameter: 8 }, "left")).toBe(true)
    expect(edgeHoleOnFace(p, { x: 300, y: 300, diameter: 8 }, "top")).toBe(false)
    expect(edgeHoleOnFace(p, { x: 400, y: 250, diameter: 8 }, "right")).toBe(false)
    const r = panelXcs(panel({ length: 400, width: 300, outline, holes: [{ x: 400, y: 250, diameter: 8, depth: 30, face: "edge", edge: "right" }] }), "F", M)
    expect(r.ops.some((o) => o.kind === "drill")).toBe(false)
    expect(r.warnings.join("\n")).toMatch(/no toca la cara del cantell 2/)
  })
})

describe("noms d'eina del .pgmx del taller", () => {
  it("l'E128 surt amb el nom de Maestro 2.0.5, i la capçalera del projecte", () => {
    const info = parsePgmxXml(new TextDecoder().decode(new Uint8Array(readFileSync("docs/maestro/samples/Proyecto1.pgmx.xml"))))
    const m2 = applyPgmx(M, info, "Proyecto1.pgmx", { withHeader: true, now: 0 }).machine
    const r = panelXcs(panel({ cutouts: [{ kind: "rect", x: 200, y: 200, w: 100, h: 60 }] }), "P", m2)
    const a = lines(r.programs[0]!.text)
    expect(a).toContain(`SetMachiningParameters("AD", 1, 10, 16973824, false);`)
    expect(a).toContain(`CreateContour("Tall_1", 20, 1, 0, "tall passant", TypeOfProcess.GeneralRouting, "12mm diamant nesting", "-1", 0, -1, -1, -1, 0);`)
    expect(r.ops[0]!.tool).toBe("E128")
  })
})

describe("moble sencer", () => {
  it("zip amb un programa per peça, els Volt i el LLEGEIX-ME", async () => {
    const comp = BUILTIN_TEMPLATES[0]!.make()
    const b = buildComposition(comp)
    const x = toMaestroXcs(b.panels, M, { project: "Prova", date: new Date("2026-10-02") })
    expect(x.files.at(-1)!.name).toBe("LLEGEIX-ME.txt")
    expect(x.programs).toBe(x.files.length - 1)
    const names = x.files.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
    const z = await unzip(zipStore(x.files.map((f) => ({ name: f.name, data: new TextEncoder().encode(f.text) }))))
    expect(z.map((f) => f.name)).toEqual(names)
  })
})

describe("propietats sobre mobles del catàleg", () => {
  const templates = [...BUILTIN_TEMPLATES, ...INSPIRED_TEMPLATES, ...STORE_TEMPLATES.filter((_, i) => i % 9 === 0)]
  it(`${templates.length} mobles: cada mecanitzat té eina o avís, i tot cau dins de la peça`, () => {
    let ops = 0
    for (const t of templates) {
      const b = buildComposition(t.make())
      const x = toMaestroXcs(b.panels, M, { project: t.name })
      x.panels.forEach((r, i) => {
        const p = b.panels[i]!
        expect(r.features, `${t.name} ${r.ref}`).toBe(r.handled + r.skipped)
        for (const o of r.ops) {
          ops++
          const [w, h] = planeSize(p, o.plane)
          for (const [px, py] of o.points) {
            expect(px, `${t.name} ${r.ref} ${o.what}`).toBeGreaterThanOrEqual(-0.01)
            expect(px, `${t.name} ${r.ref} ${o.what}`).toBeLessThanOrEqual(w + 0.01)
            expect(py, `${t.name} ${r.ref} ${o.what}`).toBeGreaterThanOrEqual(-0.01)
            expect(py, `${t.name} ${r.ref} ${o.what}`).toBeLessThanOrEqual(h + 0.01)
          }
          if (o.tool !== "-1") {
            const tool = M.tools.find((tt) => tt.code === o.tool)
            expect(tool, o.tool).toBeDefined()
            expect(tool!.mounted && tool!.auto).toBe(true)
            expect(o.depth).toBeLessThanOrEqual(tool!.maxDepth + 1e-6)
          }
          // Les cegues, mai passants.
          if (o.plane === "Top" && o.kind !== "contour" && !o.what.startsWith("tall")) expect(o.depth).toBeLessThan(p.thickness)
        }
        for (const prog of r.programs) {
          // Noms únics dins de cada programa (manual §2 p5).
          const ns = [...prog.text.matchAll(/^Create(?!FinishedWorkpieceBox|RawWorkpiece)\w+\("([^"]+)"/gm)].map((m) => m[1])
          expect(new Set(ns).size, `${r.ref} ${prog.file}`).toBe(ns.length)
          // Sense caràcters de control (els noms d'eina poden dur accents: el fitxer és UTF-8 amb BOM).
          // eslint-disable-next-line no-control-regex -- es busquen precisament els caràcters de control
          expect(prog.text).not.toMatch(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/)
        }
      })
    }
    expect(ops).toBeGreaterThan(100)
  })
})

describe("preferències: màquines", () => {
  it("una eina invàlida no fa perdre la màquina", () => {
    const raw = { ...M, id: "a", tools: [...M.tools, { code: "", name: "trencada" }] }
    const r = parseSettings({ version: 10, machines: [raw] })
    expect(r.settings.machines).toHaveLength(1)
    expect(r.settings.machines[0]!.tools).toHaveLength(M.tools.length)
    expect(r.problems.join(" ")).toMatch(/eina  descartada/)
  })
  it("màquines desades abans: capçalera i broques per defecte", () => {
    const { repetitions: _r, continuousCycle: _c, ...oldHeader } = M.header
    const { verticalDrills: _v, ...old } = M
    const r = parseSettings({ version: 10, machines: [{ ...old, header: oldHeader }] })
    expect(r.settings.machines[0]).toMatchObject({ verticalDrills: "auto", header: { repetitions: 1, continuousCycle: false } })
  })
})

describe("preferències v10", () => {
  it("v9 sense màquines → llista buida; una sola per defecte", () => {
    const r = parseSettings({ version: 9 })
    expect(r.settings.machines).toEqual([])
    expect(r.migrated).toBe(true)
    const two = parseSettings({ version: 10, machines: [{ ...M, id: "a", isDefault: true }, { ...M, id: "b", isDefault: true }] })
    expect(two.settings.machines.map((m) => m.isDefault)).toEqual([true, false])
  })
})
