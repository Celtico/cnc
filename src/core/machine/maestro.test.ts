import { describe, expect, it } from "vitest"
import { crc32, unzip, zipStore } from "../file/zip"
import { MachineSchema } from "../model/machine"
import { applyAtrx, classifyContextFiles, machineFromContext, parseAtrx, parseCfgx, parseHeaderParams, parseTlgx } from "./maestro"
import { parseXml, textOf } from "./xml"

import { bytes, read } from "./testContext"

describe("lector XML", () => {
  it("noms sense prefix, i:type, entitats, CDATA i comentaris", () => {
    const x = parseXml(`<?xml version="1.0"?><!-- c --><a:Root xmlns:i="x" i:type="b:Kind"><B>1 &amp; 2 &#65;</B><C><![CDATA[<raw>]]></C><D/></a:Root>`)
    expect(x.name).toBe("Root")
    expect(x.type).toBe("Kind")
    expect(textOf(x, "B")).toBe("1 & 2 A")
    expect(textOf(x, "C")).toBe("<raw>")
    expect(x.children.map((c) => c.name)).toEqual(["B", "C", "D"])
  })
  it("llança si està mal format", () => {
    expect(() => parseXml("<a><b></a>")).toThrow()
    expect(() => parseXml("<a>")).toThrow()
  })
})

describe("zip", () => {
  it("CRC-32 conegut", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926)
  })
  it("store → unzip torna els mateixos fitxers", async () => {
    const files = [
      { name: "A.1.L.1.xcs", data: new TextEncoder().encode("CreateFinishedWorkpieceBox(\"x\",1,2,3);") },
      { name: "LLEGEIX-ME.txt", data: new TextEncoder().encode("àèò") },
    ]
    const back = await unzip(zipStore(files))
    expect(back.map((f) => f.name)).toEqual(files.map((f) => f.name))
    expect(new TextDecoder().decode(back[1]!.data)).toBe("àèò")
  })
  it("llegeix el .cfgx (deflate)", async () => {
    const e = await unzip(bytes("Cfgx/AA10008021.cfgx"))
    expect(e.map((x) => x.name)).toEqual(["AA10008021.xml"])
    expect(e[0]!.data.length).toBe(608682)
  })
})

describe("context de màquina AA10008021", () => {
  const tools = parseTlgx(read("Tlgx/def.tlgx"))
  const atrx = parseAtrx(read("Atrx/def.atrx"))
  const equipped = applyAtrx(tools, atrx)
  const byCode = (c: string) => equipped.find((t) => t.code === c)!

  it("42 eines amb codi, tipus i mides", () => {
    expect(tools).toHaveLength(42)
    expect(byCode("003")).toMatchObject({ name: "5mm ESQ", kind: "drill", orientation: "vertical", diameter: 5, maxDepth: 35, rotation: "left", tip: "FlatDrill", auto: true })
    expect(byCode("E128")).toMatchObject({ name: "Diamant D12", id: "2149647431", kind: "router", diameter: 12, maxDepth: 24, rotation: "right", auto: true })
    expect(byCode("E604")).toMatchObject({ kind: "blade", diameter: 125, maxDepth: 45, bladeThickness: 3.2 })
    expect(byCode("A504").kind).toBe("aggregate")
    expect(byCode("E998").kind).toBe("probe")
    // Els exemples de SCM no es fan servir sols.
    expect(byCode("E504").auto).toBe(false)
    expect(byCode("E990").auto).toBe(false)
  })

  it("equipament: versió, capçals i broques horitzontals", () => {
    expect(atrx.version).toBe("2.00.004")
    expect(atrx.heads.map((h) => `${h.number}:${h.kind}`)).toEqual(["3:router", "1:boring", "6:router"])
    expect(byCode("021")).toMatchObject({ orientation: "horizontal", heads: [1], spindles: [52, 65], mounted: true })
    expect(byCode("013")).toMatchObject({ orientation: "vertical", diameter: 35, spindles: [10], mounted: true })
    expect(byCode("E128")).toMatchObject({ heads: [3, 6], mounted: true })
    // A la llista però no muntades.
    expect(byCode("005").mounted).toBe(false)
    expect(byCode("023").mounted).toBe(false)
  })

  it("capçalera i configuració", async () => {
    expect(parseHeaderParams(read("Settings/XilogHeaderParameters.xml"))).toEqual({
      executionFields: "AD",
      repetitions: 1,
      tableOptions: 10,
      mechanicalOptions: 0,
      continuousCycle: false,
      technologicalMirror: false,
      preserveWorkingSequence: false,
    })
    const cfg = await parseCfgx(bytes("Cfgx/AA10008021.cfgx"))
    expect(cfg.description).toBe("5020*1905 8 BARRE MATIC 4 BASI rif. ant.")
    expect(cfg.workArea).toEqual({ x: 5020, y: 1905 })
    expect(cfg.areas).toContain("A")
    expect(cfg.areas).toContain("D")
  })

  it("carpeta sencera → màquina vàlida", async () => {
    const names = ["AA10008021.machinecontext/Tlgx/def.tlgx", "AA10008021.machinecontext/Atrx/def.atrx", "AA10008021.machinecontext/Cfgx/AA10008021.cfgx", "AA10008021.machinecontext/Settings/XilogHeaderParameters.xml", "AA10008021.machinecontext/User.options"]
    const c = classifyContextFiles(names)
    expect(c).toEqual({ tlgx: names[0], atrx: names[1], cfgx: names[2], header: names[3], serial: "AA10008021" })
    const { machine, problems } = await machineFromContext(
      { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
      "m1",
    )
    expect(problems).toEqual([])
    expect(MachineSchema.safeParse(machine).success).toBe(true)
    expect(machine).toMatchObject({ name: "SCM AA10008021", serial: "AA10008021", maestroVersion: "2.00.004", workArea: { x: 5020, y: 1905 }, header: { executionFields: "AD" } })
  })

  it("fitxers solts: sense .atrx avisa i les dona totes per muntades", async () => {
    expect(classifyContextFiles(["def.tlgx"])).toEqual({ tlgx: "def.tlgx" })
    const { machine, problems } = await machineFromContext({ tlgx: read("Tlgx/def.tlgx") }, "m2")
    expect(problems.length).toBe(2)
    expect(machine.tools.every((t) => t.mounted)).toBe(true)
  })
})
