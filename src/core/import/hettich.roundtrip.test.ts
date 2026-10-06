/**
 * Amb les descàrregues reals de Hettich (ZIP tal com es baixen de hettich.com, a `HETTICH_DIR`: `STEP_Scharniere.zip`,
 * `DWG_DXF_Scharniere.zip`). Són dades del fabricant: **no es copien al repo**; sense la carpeta, se salta.
 * `HETTICH_DIR=/camí/als/zips pnpm exec vitest run src/core/import/hettich.roundtrip.test.ts`
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { listZip, readZipEntry, type ZipIndexEntry } from "../file/zip"
import { readDxf } from "./dxf"
import { groupHettich, hettichFileKind } from "./hettich"
import { proposeHinge, proposePlate, type HardwareProposal } from "./proposal"
import { stepFeatures } from "./stepGeometry"
import { viewFromDxf } from "./views"

const DIR = process.env.HETTICH_DIR ?? ""
const STEP_ZIP = join(DIR, "STEP_Scharniere.zip")
const DXF_ZIP = join(DIR, "DWG_DXF_Scharniere.zip")
const has = DIR !== "" && existsSync(STEP_ZIP)

const open = (path: string) => {
  const bytes = new Uint8Array(readFileSync(path))
  const index = listZip(bytes)
  const text = async (e: ZipIndexEntry) => new TextDecoder("latin1").decode(await readZipEntry(bytes, e))
  const find = (re: RegExp) => index.find((e) => re.test(e.name))
  return { bytes, index, text, find }
}

const ok = (p: HardwareProposal | { error: string }): HardwareProposal => {
  if ("error" in p) throw new Error(p.error)
  return p
}
const holes = (p: HardwareProposal) => p.holes.map((h) => [h.role, Math.abs(h.u), h.v, h.d, h.depth])

describe.skipIf(!has)("descàrregues reals de Hettich", () => {
  const step = has ? open(STEP_ZIP) : null!
  const read = async (art: string) => stepFeatures(await step.text(step.find(new RegExp(`/${art}\\.stp$`))!))

  it("agrupa el ZIP de STEP per article i categoria", () => {
    const g = groupHettich(step.index.map((e) => ({ path: e.name, kind: hettichFileKind(e.name), size: e.size })))
    expect(g.length).toBeGreaterThan(800)
    const s = g.find((a) => a.article === "9071205")!
    expect(s).toMatchObject({ category: "hinge", kind: "hinge", tags: ["recobrent"] })
    expect(g.find((a) => a.article === "9071615")).toMatchObject({ category: "plate", kind: "plate" })
    expect(g.filter((a) => a.category === "plate").length).toBeGreaterThan(150)
  })

  it("Sensys 110° recobrent (9071205): cassoleta Ø35 × 13 i cargols Ø5 a ±26 / 5,5", async () => {
    const p = ok(proposeHinge(await read("9071205")))
    expect(holes(p)).toEqual([
      ["cup", 0, 0, 35, 13],
      ["screw", 26, 5.5, 5, 10],
      ["screw", 26, 5.5, 5, 10],
    ])
    expect(p.frame.n).toEqual([0, 1, 0])
  })

  it("Sensys d'angle W30 (9085166): la cassoleta inclinada es posa al pla de la porta", async () => {
    const p = ok(proposeHinge(await read("9085166")))
    expect(holes(p)).toEqual([
      ["cup", 0, 0, 35, 13],
      ["screw", 26, 5.5, 5, 10],
      ["screw", 26, 5.5, 5, 10],
    ])
    expect(p.notes.join(" ")).toMatch(/inclinada/)
  })

  it("plaques 8099: per pressió Ø10 × 11,5 i amb cargols euro Ø5 × 12, a ±16 de la referència", async () => {
    expect(holes(ok(proposePlate(await read("9071615"))))).toEqual([
      ["dowel", 16, 0, 10, 11.5],
      ["dowel", 16, 0, 10, 11.5],
    ])
    expect(holes(ok(proposePlate(await read("9071620"))))).toEqual([
      ["screw", 16, 0, 5, 12],
      ["screw", 16, 0, 5, 12],
    ])
  })

  it("plaques: només els forats de muntatge de la cara del lateral (9071680 en dona 2; 9071650, sense forats de més)", async () => {
    // 9071680 (per pressió): les dues espigues Ø10; el trau d'ajust de la placa (Ø5 a 16 / 11,4) no és del lateral.
    expect(holes(ok(proposePlate(await read("9071680"))))).toEqual([
      ["dowel", 16, 0, 10, 11],
      ["dowel", 16, 0, 10, 11],
    ])
    // 9071650 (Hettich Direkt): els dos forats a ±16,19 del model; ni el rectangle arrodonit ni el tetó de l'altra cara.
    expect(holes(ok(proposePlate(await read("9071650"))))).toEqual([
      ["screw", 16.19, 0, 5, 12],
      ["screw", 16.19, 0, 5, 12],
    ])
    // 9313868 (System 4899): cargols sense parell → ambigua, cap forat (s'entren a mà).
    const amb = ok(proposePlate(await read("9313868")))
    expect(amb.holes).toEqual([])
    expect(amb.notes.join(" ")).toMatch(/ambigua/)
  })

  it("totes les plaques: parells simètrics a la cara del lateral o cap forat", async () => {
    const g = groupHettich(step.index.map((e) => ({ path: e.name, kind: hettichFileKind(e.name) })))
    const counts: Record<string, number> = {}
    for (const a of g.filter((x) => x.kind === "plate")) {
      const p = proposePlate(await read(a.article))
      const k = "error" in p ? "error" : String(p.holes.length)
      counts[k] = (counts[k] ?? 0) + 1
      if ("error" in p) continue
      // Cada forat té el seu parell (−u, la mateixa v i broca) i és una broca de debò, amb una fondària de lateral.
      for (const h of p.holes) {
        expect(p.holes.some((o) => o !== h && Math.abs(o.u + h.u) < 1 && Math.abs(o.v - h.v) < 1 && o.d === h.d)).toBe(true)
        expect(h.d).toBeGreaterThanOrEqual(2.5)
        expect(h.d).toBeLessThanOrEqual(12)
        expect(h.depth).toBeGreaterThan(0)
        expect(h.depth).toBeLessThanOrEqual(15)
      }
    }
    console.log("Plaques (forats proposats → articles):", JSON.stringify(counts))
    expect(counts["2"]! + (counts["4"] ?? 0)).toBeGreaterThan(120)
  }, 120_000)

  it("la gran majoria de frontisses i plaques del ZIP donen una proposta", async () => {
    const g = groupHettich(step.index.map((e) => ({ path: e.name, kind: hettichFileKind(e.name) })))
    const tally = { hinge: [0, 0], plate: [0, 0] }
    for (const a of g) {
      if (a.kind === "none") continue
      const e = step.find(new RegExp(`/${a.article}\\.stp$`))!
      const f = stepFeatures(await step.text(e))
      const p = a.kind === "hinge" ? proposeHinge(f) : proposePlate(f)
      tally[a.kind][0]!++
      // Una placa ambigua dona una proposta sense forats (s'entren a mà): no compta.
      if (!("error" in p) && p.holes.length) tally[a.kind][1]!++
    }
    console.log("Propostes:", JSON.stringify(tally))
    expect(tally.hinge[1]! / tally.hinge[0]!).toBeGreaterThan(0.6)
    expect(tally.plate[1]! / tally.plate[0]!).toBeGreaterThan(0.6)
  }, 120_000)

  it.skipIf(!existsSync(DXF_ZIP))("vistes 2D: la frontal es registra sobre els forats; punts de connexió", async () => {
    const dxf = open(DXF_ZIP)
    const p = ok(proposeHinge(await read("9071205")))
    const front = readDxf(await dxf.text(dxf.find(/\/9071205_2D_front_view\.DXF$/i)!))
    expect(front.circles.map((c) => Math.round(c.r * 100) / 100).sort((a, b) => a - b)).toEqual([2.6, 2.6, 16, 17.5])
    const v = viewFromDxf("front", front, p.holes)
    expect(v.registered).toBe(true)
    expect(v.points).toHaveLength(3)
    for (const name of ["side", "top"] as const) {
      const d = readDxf(await dxf.text(dxf.find(new RegExp(`/9071205_2D_${name}_view\\.DXF$`, "i"))!))
      expect(d.polylines.length).toBeGreaterThan(10)
    }
    // Petita per desar: menys de 40 kB de JSON.
    expect(JSON.stringify(v).length).toBeLessThan(40_000)
  })
})
