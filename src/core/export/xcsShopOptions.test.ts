import { beforeAll, describe, expect, it } from "vitest"
import { unzip } from "../file/zip"
import { machineFromContext } from "../machine/maestro"
import { mergeReimport } from "../machine/pgmx"
import { bytes, read } from "../machine/testContext"
import {
  bitsLabel,
  boardMargin,
  cncBlindDepth,
  DEFAULT_MACHINE_NESTING,
  MachineSchema,
  parseMacroArgs,
  setBits,
  type BPt,
  type CutMode,
  type Machine,
  type MachineRules,
  type Panel,
} from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { cncNestOptions, LOAD_MACRO, loadMacroLine, toMaestroNestXcs } from "./maestroNestXcs"
import { cutLoop, encodingWarning, isCcw, panelXcs, reverseLoop, slotPts, toMaestroXcs, xcsBytes, xcsZip } from "./maestroXcs"
import { flattenPath, parseXcsPreview } from "./xcsPreview"

/**
 * Opcions del taller que encara s'han de confirmar (docs/millores-v1/cnc-mecanitzats.md §(b)): codificació, marge del tauler,
 * pell dels forats gairebé passants, sentit del fresat i capçalera (Pload, bits). Per defecte fan el d'abans (les proves
 * d'or no canvien); aquí, la branca que no és la de defecte.
 */

let M: Machine
const NO_RULES: MachineRules = {
  grooves: { tool: "", maxPass: 50 },
  pockets: { tool: "" },
  profile: [],
  ramp: { enabled: false, length: 40 },
  small: { maxSide: 0, maxArea: 0, passes: [] },
}
beforeAll(async () => {
  const m = (
    await machineFromContext(
      { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
      "m",
    )
  ).machine
  M = { ...m, rules: NO_RULES }
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

const nestXcs = (panels: Panel[], m: Machine) => {
  const plan = cncNestOptions(panels, m, DEFAULT_NEST_OPTIONS)
  return { plan, xcs: toMaestroNestXcs(panels, nest(panels, plan.options), m, { project: "Prova", date: new Date("2026-10-06T00:00:00Z") }) }
}

/** Dades d'un fitxer d'un .zip sense compressió. */
async function entry(zip: Uint8Array, name: string): Promise<Uint8Array> {
  const e = (await unzip(zip)).find((x) => x.name === name)
  if (!e) throw new Error(`no hi ha ${name}`)
  return e.data
}

describe("codificació dels .xcs", () => {
  it("per defecte, UTF-8 amb BOM (els .xcs i el LLEGEIX-ME)", async () => {
    const { xcs } = nestXcs([panel({})], M)
    expect(xcs.encoding).toBe("utf8-bom")
    const zip = xcsZip(xcs)
    const data = await entry(zip, xcs.sheets[0]!.file)
    expect([...data.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(xcs.files.find((f) => f.name === "LLEGEIX-ME.txt")!.text).toContain("UTF-8 amb BOM")
  })
  it("sense BOM: els .xcs comencen amb ASCII (byte a byte el text) i el LLEGEIX-ME continua amb BOM", async () => {
    const m: Machine = { ...M, xcsEncoding: "ascii" }
    const { xcs } = nestXcs([panel({})], m)
    expect(xcs.encoding).toBe("ascii")
    const zip = xcsZip(xcs)
    const sheet = xcs.sheets[0]!
    const data = await entry(zip, sheet.file)
    expect(data[0]).toBe("/".charCodeAt(0))
    expect(data.every((b) => b < 0x80)).toBe(true)
    expect(new TextDecoder().decode(data)).toBe(sheet.text)
    const readme = await entry(zip, "LLEGEIX-ME.txt")
    expect([...readme.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(readme.slice(3))).toContain("sense BOM")
    expect(xcs.warnings.some((w) => w.includes("ASCII"))).toBe(false)
  })
  it("xcsBytes sense BOM = l'UTF-8 tal qual", () => {
    expect([...xcsBytes("//A", false)]).toEqual([0x2f, 0x2f, 0x41])
    expect([...xcsBytes("//A")].slice(0, 3)).toEqual([0xef, 0xbb, 0xbf])
  })
  it("sense BOM i un nom d'eina amb accents: avís (a l'export per tauler i al per peça)", () => {
    const tools = M.tools.map((t) => (t.kind === "router" ? { ...t, mslName: `${t.mslName ?? t.code} niàdora` } : t))
    const m: Machine = { ...M, tools, xcsEncoding: "ascii" }
    const { xcs } = nestXcs([panel({})], m)
    expect(xcs.warnings[0]).toMatch(/no són ASCII/)
    expect(toMaestroXcs([panel({ outline: [[0, 0], [720, 0], [720, 560], [0, 560]] })], m, { project: "p" }).warnings[0]).toMatch(/no són ASCII/)
    // Amb BOM, cap avís.
    expect(encodingWarning({ xcsEncoding: "utf8-bom" }, [{ name: "a.xcs", text: "niàdora" }])).toBeNull()
    expect(encodingWarning({}, [{ name: "a.xcs", text: "niàdora" }])).toBeNull()
  })
})

describe("marge del tauler", () => {
  it("per defecte, fix (10 mm)", () => {
    const { plan } = nestXcs([panel({})], M)
    expect(plan.margin).toBe(10)
    expect(plan.options.margin).toBe(10)
  })
  it("«Ø de la fresa»: marge = Ø de la fresa del contorn (+ el que s'hi posi), al nesting, la capçalera i el LLEGEIX-ME", () => {
    const m: Machine = { ...M, nesting: { ...DEFAULT_MACHINE_NESTING, edgeTrimMode: "tool" } }
    const { plan, xcs } = nestXcs([panel({})], m)
    expect(plan.tool).toBeDefined()
    const d = plan.tool!.diameter
    expect(plan.margin).toBe(d)
    expect(plan.options.margin).toBe(d)
    const s = xcs.sheets[0]!
    expect(Math.min(...s.parts.map((p) => p.x))).toBeGreaterThanOrEqual(d - 1e-9)
    expect(Math.min(...s.parts.map((p) => p.y))).toBeGreaterThanOrEqual(d - 1e-9)
    expect(s.text).toContain(`Marge del tauler ${d} mm`)
    expect(parseXcsPreview(s.text).edgeTrim).toBe(d)
    expect(xcs.files.find((f) => f.name === "LLEGEIX-ME.txt")!.text).toContain(`Marge del tauler ${d} mm`)

    const plus = cncNestOptions([panel({})], { ...M, nesting: { ...DEFAULT_MACHINE_NESTING, edgeTrimMode: "tool", edgeTrimExtra: 2 } }, DEFAULT_NEST_OPTIONS)
    expect(plus.margin).toBe(d + 2)
  })
  it("boardMargin: sense fresa, el fix", () => {
    expect(boardMargin({ ...DEFAULT_MACHINE_NESTING, edgeTrimMode: "tool" }, undefined)).toBe(10)
    expect(boardMargin({ ...DEFAULT_MACHINE_NESTING, edgeTrimMode: "tool", edgeTrimExtra: 1 }, { diameter: 14 })).toBe(15)
    expect(boardMargin(DEFAULT_MACHINE_NESTING, { diameter: 14 })).toBe(10)
  })
})

describe("pell dels forats i ranures gairebé passants", () => {
  it("cncBlindDepth: per defecte, de gruix − 0,5 o més → gruix − 1; amb pell 0,1, el 18,9 es queda", () => {
    expect(cncBlindDepth(19, 18.9, {})).toEqual({ depth: 18, shortened: true, minSkin: 1 })
    expect(cncBlindDepth(19, 18.4, {})).toEqual({ depth: 18.4, shortened: false, minSkin: 1 })
    const thin = { blind: { minSkin: 0.1, threshold: 0.5 } }
    expect(cncBlindDepth(19, 18.9, thin)).toEqual({ depth: 18.9, shortened: false, minSkin: 0.1 })
    expect(cncBlindDepth(19, 19, thin).depth).toBeCloseTo(18.9)
    expect(cncBlindDepth(19, 19, thin).shortened).toBe(true)
    // Mai s'aprofundeix un forat.
    expect(cncBlindDepth(19, 18.6, { blind: { minSkin: 0.1, threshold: 2 } }).depth).toBe(18.6)
  })
  const holes = [
    { x: 22, y: 93, diameter: 4, depth: 18.9, face: "A" as const },
    { x: 100, y: 93, diameter: 4, depth: 19, face: "A" as const },
  ]
  const drills = (text: string) => [...text.matchAll(/CreateDrill\("[^"]*_Forat_\d+", [^,]+, [^,]+, ([^,]+), 4,/g)].map((x) => Number(x[1]))
  it("per tauler: per defecte a 18; amb pell 0,1, 18,9 (com el programa real) i un de 19 a 18,9 amb avís", () => {
    const def = nestXcs([panel({ holes })], M).xcs
    expect(drills(def.sheets[0]!.text)).toEqual([18, 18])
    expect(def.warnings.filter((w) => w.includes("gruix − 1"))).toHaveLength(2)
    const m: Machine = { ...M, rules: { ...NO_RULES, blind: { minSkin: 0.1, threshold: 0.5 } } }
    const x = nestXcs([panel({ holes })], m).xcs
    expect(drills(x.sheets[0]!.text).sort()).toEqual([18.9, 18.9])
    expect(x.warnings.filter((w) => w.includes("gruix − 0,1") || w.includes("gruix − 0.1"))).toHaveLength(1)
  })
  it("per peça, i també les ranures", () => {
    const m: Machine = { ...M, rules: { ...NO_RULES, blind: { minSkin: 0.2, threshold: 0.5 } } }
    const p = panel({ holes, grooves: [{ x: 0, y: 200, w: 720, h: 10, depth: 19, face: "A" }] })
    const r = panelXcs(p, "A.1.L.1", m)
    const depths = r.ops.filter((o) => o.kind === "drill").map((o) => o.depth)
    expect(depths[0]).toBeCloseTo(18.8)
    expect(depths[1]).toBeCloseTo(18.8)
    const g = r.ops.find((o) => o.kind === "route" || o.kind === "slot")!
    expect(g.depth).toBeCloseTo(18.8)
  })
})

describe("sentit del fresat", () => {
  const signed = (pts: [number, number][]) => pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * p[1], 0) / 2
  it("reverseLoop: el mateix contorn a l'inrevés (també els arcs) i dues vegades, l'original", () => {
    const slot = slotPts({ kind: "slot", x: 10, y: 10, w: 200, h: 68 })
    const rev = reverseLoop(slot)
    expect(isCcw(slot)).toBe(true)
    expect(isCcw(rev)).toBe(false)
    expect(reverseLoop(rev)).toEqual(slot)
    expect(rev[0]).toEqual([slot[0]![0], slot[0]![1]].concat(rev[0]!.length > 2 ? [rev[0]![2]!] : []))
    const area = (pts: BPt[]) => Math.abs(signed(pts.map((p) => [p[0], p[1]] as [number, number])))
    expect(area(rev)).toBeCloseTo(area(slot))
  })
  it("cutLoop: oposició = fora antihorari i dins horari; concordança = a l'inrevés; «com surt» no toca res", () => {
    const sq: BPt[] = [[0, 0], [10, 0], [10, 10], [0, 10]]
    const cw = reverseLoop(sq)
    expect(cutLoop(cw, "outside", "asIs")).toBe(cw)
    expect(isCcw(cutLoop(cw, "outside", "conventional"))).toBe(true)
    expect(isCcw(cutLoop(sq, "inside", "conventional"))).toBe(false)
    expect(isCcw(cutLoop(sq, "outside", "climb"))).toBe(false)
    expect(isCcw(cutLoop(cw, "inside", "climb"))).toBe(true)
  })

  const cutouts: Panel["cutouts"] = [
    { kind: "rect", x: 100, y: 100, w: 200, h: 150 },
    { kind: "slot", x: 400, y: 100, w: 208, h: 68 },
    { kind: "circle", x: 550, y: 400, diameter: 80 },
  ]
  /** Sentit (antihorari?) dels contorns per fora i talls per dins tal com els llegeix la Vista CAM. */
  const senses = (text: string) => {
    const pv = parseXcsPreview(text)
    const of = (side: "inside" | "outside") => pv.ops.filter((o) => o.kind === "contour" && o.side === side).map((o) => signed(flattenPath(o.path!)) > 0)
    return { inside: of("inside"), outside: of("outside") }
  }
  const withMode = (cutMode?: CutMode, ramp = false): Machine => ({ ...M, rules: { ...NO_RULES, ramp: { enabled: ramp, length: 40 }, ...(cutMode ? { cutMode } : {}) } })

  it("per defecte (com surt): tot antihorari i el cercle amb isClockwise false", () => {
    const { xcs } = nestXcs([panel({ cutouts })], withMode())
    const s = senses(xcs.sheets[0]!.text)
    expect(s.inside).toEqual([true, true, true])
    expect(s.outside).toEqual([true])
    expect(xcs.sheets[0]!.text).toMatch(/CreateCircleCenterRadius\([^)]*, false\);/)
  })
  for (const ramp of [false, true]) {
    it(`en oposició (com TopSolid): fora antihorari, dins horari${ramp ? ", amb rampa" : ""}`, () => {
      const { xcs } = nestXcs([panel({ cutouts })], withMode("conventional", ramp))
      const s = senses(xcs.sheets[0]!.text)
      expect(s.inside).toEqual([false, false, false])
      expect(s.outside).toEqual([true])
      expect(xcs.sheets[0]!.text).toMatch(/CreateCircleCenterRadius\([^)]*, true\);/)
    })
    it(`en concordança: fora horari, dins antihorari${ramp ? ", amb rampa" : ""}`, () => {
      const { xcs } = nestXcs([panel({ cutouts })], withMode("climb", ramp))
      const s = senses(xcs.sheets[0]!.text)
      expect(s.inside).toEqual([true, true, true])
      expect(s.outside).toEqual([false])
    })
  }
  it("per peça, el mateix (contorn de les peces amb forma i talls)", () => {
    const outline: BPt[] = [[0, 0], [720, 0], [720, 560], [0, 560]]
    const r = panelXcs(panel({ cutouts, outline }), "A.1.L.1", withMode("conventional"))
    const s = senses(r.programs[0]!.text)
    expect(s.inside).toEqual([false, false, false])
    expect(s.outside).toEqual([true])
  })
  it("girar la peça al nesting no canvia el sentit", () => {
    const { xcs } = nestXcs([panel({ cutouts, grain: "y" })], withMode("conventional"))
    expect(xcs.sheets[0]!.parts[0]!.angle).toBe(90)
    const s = senses(xcs.sheets[0]!.text)
    expect(s.inside).toEqual([false, false, false])
    expect(s.outside).toEqual([true])
  })
})

describe("capçalera dels programes per tauler", () => {
  it("bits de les opcions mecàniques", () => {
    expect(setBits(16777216)).toEqual([24])
    expect(bitsLabel(16777216)).toBe("0x01000000 · bit 24")
    expect(bitsLabel(16973824)).toBe("0x01030000 · bits 16, 17, 24")
    expect(bitsLabel(0)).toBe("0x00000000 · cap bit")
  })
  it("macro Pload: per defecte la del programa real; amb paràmetres propis, aquests", () => {
    expect(LOAD_MACRO).toBe(`CreateMacro("Pload", "PLOAD", 1, 0, 1, 0, 4, 2, false, 0, 0, 0, 0);`)
    expect(loadMacroLine("1,0, 1 ,0,4,2,true,0,0,0,0")).toBe(`CreateMacro("Pload", "PLOAD", 1, 0, 1, 0, 4, 2, true, 0, 0, 0, 0);`)
    expect(parseMacroArgs("1, x")).toBeNull()
    expect(parseMacroArgs("")).toBeNull()
    const program = { mechanicalOptions: 16777216, setupPosition: { x: 0, y: -20, z: 5, rot: 90 }, loadMacro: true, loadMacroArgs: "2, 0, 1, 0, 4, 2, false, 0, 0, 0, 0", pneumaticHood: 1, fallPrevention: true }
    const m: Machine = { ...M, nesting: { ...DEFAULT_MACHINE_NESTING, program } }
    const text = nestXcs([panel({})], m).xcs.sheets[0]!.text
    expect(text).toContain(`CreateMacro("Pload", "PLOAD", 2, 0, 1, 0, 4, 2, false, 0, 0, 0, 0);`)
    expect(text).toContain("SetWorkpieceSetupPosition(0, -20, 5, 90);")
  })
  it("esquema: els camps nous són opcionals i els dolents no passen", () => {
    expect(MachineSchema.safeParse(M).success).toBe(true)
    const full = { ...M, xcsEncoding: "ascii", nesting: { ...DEFAULT_MACHINE_NESTING, edgeTrimMode: "tool", edgeTrimExtra: 0, program: { mechanicalOptions: 1, setupPosition: { x: 0, y: 0, z: 0, rot: 0 }, loadMacro: true, loadMacroArgs: "1, 2", pneumaticHood: 1, fallPrevention: true } }, rules: { ...NO_RULES, cutMode: "conventional", blind: { minSkin: 0.1, threshold: 0.5 } } }
    expect(MachineSchema.safeParse(full).success).toBe(true)
    expect(MachineSchema.safeParse({ ...full, xcsEncoding: "latin1" }).success).toBe(false)
    expect(MachineSchema.safeParse({ ...full, nesting: { ...full.nesting, program: { ...full.nesting.program, loadMacroArgs: "1, ; 2" } } }).success).toBe(false)
  })
  it("tornar a importar la màquina conserva la codificació", () => {
    expect(mergeReimport({ ...M, xcsEncoding: "ascii" }, M).xcsEncoding).toBe("ascii")
    expect(mergeReimport(M, M).xcsEncoding).toBeUndefined()
  })
})
