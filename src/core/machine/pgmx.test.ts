import { describe, expect, it } from "vitest"
import { zipStore } from "../file/zip"
import { parseSettings } from "../model"
import { isPlaceholderTool, type MachineTool } from "../model/machine"
import { machineFromContext } from "./maestro"
import { applyPgmx, mergeReimport, parsePgmxXml, pgmxSummary, readPgmx } from "./pgmx"
import { read } from "./testContext"
import { pickRouter, usableTool } from "./tools"

// El projecte real del taller (XML principal del .pgmx, Maestro 2.0.5 rev 1005), només lectura.
const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }
const PGMX = new Uint8Array(readFileSync("docs/maestro/samples/Proyecto1.pgmx.xml"))

const machine = async () => (await machineFromContext({ tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" }, "m")).machine

describe("projecte de Maestro (.pgmx)", () => {
  it("Proyecto1: versió, eines (ID, nom) i capçalera", () => {
    const info = parsePgmxXml(new TextDecoder().decode(PGMX))
    expect(info.version).toBe("2.0.5 rev 1005")
    expect(info.tools).toEqual([{ id: "2149647431", name: "12mm diamant nesting" }])
    expect(info.header).toEqual({
      executionFields: "AD",
      repetitions: 1,
      tableOptions: 10,
      mechanicalOptions: 16973824,
      continuousCycle: false,
      technologicalMirror: true,
      preserveWorkingSequence: true,
    })
  })

  it("llegeix el .pgmx (zip) i l'XML solt", async () => {
    const zip = zipStore([{ name: "Proyecto1.xml", data: PGMX }, { name: "Altres.txt", data: new TextEncoder().encode("x") }])
    expect((await readPgmx(zip)).tools).toHaveLength(1)
    expect((await readPgmx(PGMX)).version).toBe("2.0.5 rev 1005")
    await expect(readPgmx(new TextEncoder().encode("<Altres/>"))).rejects.toThrow()
  })

  it("aplica els noms per ID (el codi no canvia) i la capçalera", async () => {
    const m = await machine()
    const info = parsePgmxXml(new TextDecoder().decode(PGMX))
    const r = applyPgmx(m, info, "Proyecto1.pgmx", { withHeader: true, now: 1 })
    const e128 = r.machine.tools.find((t) => t.code === "E128")!
    expect(e128).toMatchObject({ code: "E128", name: "12mm diamant nesting", mslName: "12mm diamant nesting" })
    expect(r.renamed).toEqual([{ code: "E128", from: "Diamant D12", to: "12mm diamant nesting" }])
    expect(r.missing).toEqual([])
    expect(r.machine.header.mechanicalOptions).toBe(16973824)
    expect(r.machine.pgmx).toEqual({ file: "Proyecto1.pgmx", version: "2.0.5 rev 1005", tools: 1, importedAt: 1 })
    expect(pgmxSummary(r, info)).toMatch(/E128 «Diamant D12» → «12mm diamant nesting»/)
    // Un nom posat a mà es respecta (però l'MSL agafa el del .pgmx).
    const mine = { ...m, tools: m.tools.map((t) => (t.code === "E128" ? { ...t, name: "La meva", edited: ["name" as const] } : t)) }
    const r2 = applyPgmx(mine, info, "P", { withHeader: false })
    expect(r2.machine.tools.find((t) => t.code === "E128")).toMatchObject({ name: "La meva", mslName: "12mm diamant nesting" })
    expect(r2.machine.header.mechanicalOptions).toBe(0)
    // Desat i tornat a llegir.
    expect(parseSettings({ version: 10, machines: [r.machine] }).problems).toEqual([])
  })
})

describe("tornar a importar el context", () => {
  it("conserva els camps tocats a mà, el nom de l'MSL i les eines afegides", async () => {
    const fresh = await machine()
    const manual: MachineTool = { code: "E300", name: "Fresa 8", kind: "router", diameter: 8, maxDepth: 30, mounted: true, auto: true, manual: true }
    const old = {
      ...fresh,
      id: "old",
      name: "La SCM",
      verticalDrills: "tool" as const,
      tools: [
        ...fresh.tools.map((t) =>
          t.code === "003" ? { ...t, name: "Broca 5", maxDepth: 20, diameter: 99, edited: ["name" as const, "maxDepth" as const] }
          : t.code === "E128" ? { ...t, mslName: "12mm diamant nesting" }
          : t.code === "E219" ? { ...t, auto: false, edited: ["auto" as const] }
          : t,
        ),
        manual,
      ],
    }
    const m = mergeReimport(old, fresh)
    expect(m).toMatchObject({ id: "old", name: "La SCM", verticalDrills: "tool" })
    // Els camps tocats es queden; la resta (el Ø) torna a ser el de Maestro.
    expect(m.tools.find((t) => t.code === "003")).toMatchObject({ name: "Broca 5", maxDepth: 20, diameter: 5, edited: ["name", "maxDepth"] })
    expect(m.tools.find((t) => t.code === "E128")).toMatchObject({ name: "Diamant D12", mslName: "12mm diamant nesting" })
    expect(m.tools.find((t) => t.code === "E219")!.auto).toBe(false)
    expect(m.tools.find((t) => t.code === "E300")).toEqual(manual)
    expect(m.tools).toHaveLength(fresh.tools.length + 1)
  })

  it("una «Eina nova» sense codi no es tria", async () => {
    const m = await machine()
    const nova: MachineTool = { code: "NOVA1", name: "Eina nova", kind: "router", diameter: 20, maxDepth: 50, mounted: true, auto: true, manual: true }
    expect(isPlaceholderTool(nova)).toBe(true)
    expect(usableTool(nova)).toBe(false)
    expect(pickRouter({ ...m, tools: [...m.tools, nova] }, 30, 20)?.code).toBe("E219")
  })
})
