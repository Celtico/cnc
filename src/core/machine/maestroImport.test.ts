import { describe, expect, it } from "vitest"
import { zipStore } from "../file/zip"
import { parseSettings } from "../model"
import { detectMaestroFile, importMaestro, planMaestroImport, xmlRoot } from "./maestroImport"
import { bytes, CTX_FILES } from "./testContext"

const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }
const PGMX = new Uint8Array(readFileSync("docs/maestro/samples/Proyecto1.pgmx.xml"))

/** La carpeta .machinecontext tal com la dona `webkitdirectory` (amb fitxers que no interessen). */
const ctxFolder = () => [
  ...CTX_FILES.map((p) => ({ path: `AA10008021.machinecontext/${p}`, bytes: bytes(p) })),
  { path: "AA10008021.machinecontext/Settings/LoadUnitClampSpacerSizeSettings.xml", bytes: bytes("Settings/LoadUnitClampSpacerSizeSettings.xml") },
]
let n = 0
const newId = () => `m${++n}`

describe("detecció dels fitxers de Maestro", () => {
  it("pel contingut, no per l'extensió", () => {
    expect(xmlRoot("﻿<?xml version=\"1.0\"?><!-- x --><a:Project xmlns:a=\"y\">")).toBe("Project")
    expect(detectMaestroFile("x.tlgx", bytes("Tlgx/def.tlgx"))).toBe("tlgx")
    expect(detectMaestroFile("x.atrx", bytes("Atrx/def.atrx"))).toBe("atrx")
    expect(detectMaestroFile("AA10008021.cfgx", bytes("Cfgx/AA10008021.cfgx"))).toBe("cfgx")
    expect(detectMaestroFile("XilogHeaderParameters.xml", bytes("Settings/XilogHeaderParameters.xml"))).toBe("header")
    expect(detectMaestroFile("Settings/LoadUnitClampSpacerSizeSettings.xml", bytes("Settings/LoadUnitClampSpacerSizeSettings.xml"))).toBe("other")
    // L'XML del projecte, amb qualsevol nom; i el .pgmx (zip).
    expect(detectMaestroFile("Proyecto(1).xml", PGMX)).toBe("pgmx")
    expect(detectMaestroFile("Proyecto1.pgmx", zipStore([{ name: "Proyecto1.xml", data: PGMX }]))).toBe("pgmx")
    expect(detectMaestroFile("biblio.lbdx", zipStore([{ name: "a.xml", data: PGMX }]))).toBe("other")
  })

  it("pla: context i projectes per carpeta; a la carpeta .pgmx només l'XML gros", () => {
    const plan = planMaestroImport([
      { path: "AA10008021.machinecontext/Tlgx/def.tlgx", kind: "tlgx", size: 1 },
      { path: "AA10008021.machinecontext/Cfgx/AA10008021.cfgx", kind: "cfgx", size: 1 },
      { path: "Proyecto(1).pgmx/Proyecto(1).xml", kind: "pgmx", size: 100 },
      { path: "Proyecto(1).pgmx/Altre.xml", kind: "pgmx", size: 10 },
      { path: "Proyecto(1).pgmx/def.atrx", kind: "atrx", size: 1 },
      { path: "solt.pgmx", kind: "pgmx", size: 1 },
    ])
    expect(plan).toEqual([
      { group: "AA10008021.machinecontext", context: { tlgx: "AA10008021.machinecontext/Tlgx/def.tlgx", cfgx: "AA10008021.machinecontext/Cfgx/AA10008021.cfgx", serial: "AA10008021" }, pgmx: [] },
      { group: "Proyecto(1).pgmx", context: { atrx: "Proyecto(1).pgmx/def.atrx" }, pgmx: ["Proyecto(1).pgmx/Proyecto(1).xml"] },
      { group: "", context: {}, pgmx: ["solt.pgmx"] },
    ])
  })
})

describe("importador de Maestro", () => {
  it("carpeta .machinecontext → màquina nova; tornar-la a importar l'actualitza", async () => {
    const r = await importMaestro(ctxFolder(), [], { newId })
    expect(r.machines).toHaveLength(1)
    const m = r.machines[0]!
    expect(m).toMatchObject({ serial: "AA10008021", isDefault: true, maestroVersion: "2.00.004" })
    expect(r.selected).toBe(m.id)
    expect(r.lines[0]).toMatch(/importada: 42 eines/)
    const again = await importMaestro(ctxFolder(), r.machines, { newId })
    expect(again.machines).toHaveLength(1)
    expect(again.machines[0]!.id).toBe(m.id)
    expect(again.lines[0]).toMatch(/actualitzada/)
  })

  it("context i .pgmx alhora: primer el context, després els noms del projecte", async () => {
    const r = await importMaestro([{ path: "Proyecto1.pgmx.xml", bytes: PGMX }, ...ctxFolder()], [], { newId })
    expect(r.machines).toHaveLength(1)
    const m = r.machines[0]!
    expect(m.tools.find((t) => t.code === "E128")).toMatchObject({ mslName: "12mm diamant nesting" })
    expect(m.pgmx?.file).toBe("Proyecto1.pgmx.xml")
    expect(r.lines[1]).toMatch(/Proyecto1\.pgmx\.xml → SCM AA10008021\. .*E128/)
  })

  it(".pgmx solt: a la màquina triada (o la per defecte)", async () => {
    const base = (await importMaestro(ctxFolder(), [], { newId })).machines
    const other = { ...base[0]!, id: "altra", serial: "X", isDefault: false }
    const two = [base[0]!, other]
    const toSel = await importMaestro([{ path: "Proyecto1.pgmx", bytes: zipStore([{ name: "Proyecto1.xml", data: PGMX }]) }], two, { target: "altra", newId })
    expect(toSel.machines.find((x) => x.id === "altra")!.pgmx?.file).toBe("Proyecto1.pgmx")
    expect(toSel.machines.find((x) => x.id !== "altra")!.pgmx).toBeUndefined()
    const toDef = await importMaestro([{ path: "Proyecto1.pgmx.xml", bytes: PGMX }], two, { newId })
    expect(toDef.selected).toBe(base[0]!.id)
  })

  it(".pgmx sense cap màquina: en fa una amb les eines del projecte", async () => {
    const r = await importMaestro([{ path: "Proyecto1.pgmx.xml", bytes: PGMX }], [], { newId })
    const m = r.machines[0]!
    expect(m).toMatchObject({ name: "Màquina de Proyecto1", isDefault: true, maestroVersion: "2.0.5 rev 1005" })
    expect(m.tools).toEqual([expect.objectContaining({ id: "2149647431", code: "12mm diamant nesting", mslName: "12mm diamant nesting", auto: false })])
    expect(m.header.mechanicalOptions).toBe(16973824)
    expect(parseSettings({ version: 10, machines: r.machines }).problems).toEqual([])
  })

  it("carpeta .pgmx desplegada amb def.atrx i .cfgx: identifica la màquina per la sèrie o la crea", async () => {
    const folder = [
      { path: "Proyecto(1).pgmx/Proyecto(1).xml", bytes: PGMX },
      { path: "Proyecto(1).pgmx/def.atrx", bytes: bytes("Atrx/def.atrx") },
      { path: "Proyecto(1).pgmx/AA10008021.cfgx", bytes: bytes("Cfgx/AA10008021.cfgx") },
    ]
    // Ja importada: hi van els noms.
    const base = (await importMaestro(ctxFolder(), [], { newId })).machines
    const other = { ...base[0]!, id: "altra", serial: "X", isDefault: true }
    const r = await importMaestro(folder, [{ ...base[0]!, isDefault: false }, other], { target: "altra", newId })
    expect(r.machines.find((x) => x.serial === "AA10008021")!.tools.find((t) => t.code === "E128")!.mslName).toBe("12mm diamant nesting")
    expect(r.machines.find((x) => x.id === "altra")!.pgmx).toBeUndefined()
    // Cap màquina: eines de l'.atrx (sense mides) i el model del .cfgx.
    const fresh = await importMaestro(folder, [], { newId })
    const m = fresh.machines[0]!
    expect(m).toMatchObject({ serial: "AA10008021", maestroVersion: "2.00.004" })
    expect(m.model).not.toBe("")
    expect(m.tools.find((t) => t.code === "003")).toMatchObject({ kind: "drill", mounted: true, auto: false })
    expect(m.tools.some((t) => t.id === "2149647431")).toBe(true)
    expect(fresh.problems.join(" ")).toMatch(/\.tlgx/)
    expect(parseSettings({ version: 10, machines: fresh.machines }).problems).toEqual([])
  })

  it("res de Maestro → error clar", async () => {
    await expect(importMaestro([{ path: "foto.xml", bytes: new TextEncoder().encode("<Altres/>") }], [], { newId })).rejects.toThrow(/machinecontext/)
    await expect(importMaestro([{ path: "Atrx/def.atrx", bytes: bytes("Atrx/def.atrx") }], [], { newId })).rejects.toThrow(/\.tlgx/)
  })
})
