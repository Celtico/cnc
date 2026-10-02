/**
 * Anada i tornada dels programes Maestro (.xcs) per tauler amb el parser del taller (`parseXcs`, `toolUses` de
 * `taller-cnc-nest/src/nesting/parsers/xcs-machining.ts`, importat del seu codi font, només lectura).
 *
 * (a) El programa de nesting real del taller (docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs) es llegeix com
 *     sempre. (b) Els nostres programes per tauler (context real AA10008021 + Proyecto1.pgmx) els llegeix sencers: tauler,
 *     forats (posició, fondària, Ø i eina pel comentari `//BROCA PLANA …`) i fresats `CreateRoughFinish` (eina i fondària).
 *     El parser només reconeix com a fresat el `CreateRoughFinish` i només en treu punts dels recorreguts explícits
 *     (`CreateToolpath`…): els nostres contorns, talls i caixeres (`CreateContour` / `CreateContourPocket`, recorregut calculat
 *     pel Maestro) no hi surten. Vegeu docs/maestro-xcs.md, «Comparació amb un programa real del taller».
 *
 * Fora del `tsc` del projecte (com `taller.roundtrip.test.ts`); Vitest sí que l'executa. Repo del taller:
 * `TALLER_DIR` o `~/Desktop/taller-cnc-nest`; si no hi és, se salta.
 */
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { machineFromContext } from "../machine/maestro"
import { applyPgmx, parsePgmxXml } from "../machine/pgmx"
import { bytes, read } from "../machine/testContext"
import { BUILTIN_TEMPLATES, toolMslName, type Machine, type MachineTool } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { cncNestOptions, toMaestroNestXcs } from "./maestroNestXcs"

const PARSER = join(process.env.TALLER_DIR ?? join(homedir(), "Desktop/taller-cnc-nest"), "src/nesting/parsers/xcs-machining.ts")
const REAL = "docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs"

type XcsDrill = { op: string; x: number; y: number; depth: number; dia: number; tool: string }
type XcsRout = { op: string; tool: string; depth: number; label: string; pts: [number, number][] }
type XcsData = { board: string; w: number; h: number; thick: number; drills: XcsDrill[]; routs: XcsRout[] }
type ToolUse = { tool: string; dia: number | null; depths: number[]; drills: number; routs: number }
type Parser = { parseXcs: (text: string) => XcsData; toolUses: (d: XcsDrill[], r: XcsRout[]) => ToolUse[] }

const router = (code: string, mslName: string, diameter: number): MachineTool => ({ code, name: mslName, mslName, kind: "router", diameter, maxDepth: 45, mounted: true, auto: true, manual: true })

// Vitest recull el cos d'un `describe.skipIf` encara que se salti: l'import, només si hi és.
const parser = existsSync(PARSER) ? ((await import(/* @vite-ignore */ PARSER)) as Parser) : null

describe.skipIf(!parser)("parser .xcs del taller", () => {
  const { parseXcs, toolUses } = parser ?? ({} as Parser)

  describe("programa de nesting real del taller (U767)", () => {
    const text = readFileSync(REAL, "utf8")

    it("tauler, forats per eina i fresats", () => {
      const d = parseXcs(text)
      expect(d).toMatchObject({ board: "U767_Gris_cubanita_19#01", w: 2800, h: 2070, thick: 19 })
      expect(d.drills).toHaveLength(84)
      expect(d.routs).toHaveLength(5)
      const uses = Object.fromEntries(toolUses(d.drills, d.routs).map((u) => [u.tool, u]))
      expect(uses["BROCA PLANA FO-FPL-2"]).toMatchObject({ dia: 2, depths: [5.15], drills: 10 })
      expect(uses["BROCA PLANA FO-FPL-4"]).toMatchObject({ dia: 4, depths: [18.9], drills: 4 })
      expect(uses["BROCA PLANA FO-FPL-8"]).toMatchObject({ dia: 8, depths: [11], drills: 6 })
      expect(uses["BROCA PLANA FO-FPL-3"]).toMatchObject({ dia: 3, depths: [9], drills: 64 })
      expect(uses["12mm diamant nesting"]).toMatchObject({ routs: 5 })
      expect(d.routs.filter((r) => r.label === "Tercera passada")).toHaveLength(3)
      for (const p of [...d.drills.map((x) => [x.x, x.y]), ...d.routs.flatMap((r) => r.pts)]) {
        expect(p[0]).toBeGreaterThanOrEqual(0)
        expect(p[0]).toBeLessThanOrEqual(d.w)
        expect(p[1]).toBeGreaterThanOrEqual(0)
        expect(p[1]).toBeLessThanOrEqual(d.h)
      }
    })

    it("la fondària de debò és la Z del recorregut (−19,3 = gruix + 0,3); el parser llegeix la del CreateRoughFinish", () => {
      const d = parseXcs(text)
      // El parser dona 2 mm als contorns passants: el CreateRoughFinish (−2) i el DEPTH (−2,01) del real no són la fondària.
      expect([...new Set(d.routs.map((r) => r.depth))].sort((a, b) => a - b)).toEqual([2, 10])
      const zs = [...text.matchAll(/^Add(?:Segment|Arc2PointRadius)ToToolpath \(([^)]*)\)/gm)].map((m) => Number(m[1]!.split(",")[2]))
      expect(Math.min(...zs)).toBeCloseTo(-19.3)
    })
  })

  describe("els nostres programes per tauler", () => {
    let BASE: Machine
    let MX: Machine
    beforeAll(async () => {
      const ctx = (
        await machineFromContext(
          { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
          "m",
        )
      ).machine
      const info = parsePgmxXml(readFileSync("docs/maestro/samples/Proyecto1.pgmx.xml", "utf8"))
      BASE = applyPgmx(ctx, info, "Proyecto1.pgmx", { withHeader: true, now: 0 }).machine
      // Amb les freses de les regles afegides a mà (com les afegiria el germà): ranures amb CreateRoughFinish.
      MX = { ...BASE, tools: [...BASE.tools, router("E801", "8mm diamant", 8), router("E814", "14mm diamant nesting", 14)] }
    })

    it(`${BUILTIN_TEMPLATES.length} mobles del catàleg × 2 màquines: tot el que el parser sap llegir hi és, al seu lloc`, () => {
      let drills = 0
      let routs = 0
      for (const m of [BASE, MX]) {
        const byCode = new Map(m.tools.map((t) => [t.code, t]))
        const msl = (code: string) => toolMslName(byCode.get(code)!)
        for (const t of BUILTIN_TEMPLATES) {
          const b = buildComposition(t.make())
          const n = nest(b.panels, cncNestOptions(b.panels, m, DEFAULT_NEST_OPTIONS).options)
          const x = toMaestroNestXcs(b.panels, n, m, { project: t.name })
          const byId = new Map(b.panels.map((p) => [p.id, p]))
          for (const sh of x.sheets) {
            const at = `${t.name} ${sh.file}`
            const d = parseXcs(sh.text)
            expect(d, at).toMatchObject({ board: sh.workpiece, w: sh.w, h: sh.h, thick: sh.thickness })
            expect(d.board, at).toMatch(/_\d+(\.\d+)?#\d\d$/)

            // Forats: un per op, en el mateix ordre, amb posició, fondària, Ø i l'eina del comentari //BROCA PLANA.
            const dOps = sh.ops.filter((o) => o.kind === "drill")
            expect(d.drills.length, at).toBe(dOps.length)
            d.drills.forEach((h, i) => {
              const o = dOps[i]!
              expect([h.x, h.y], `${at} ${h.op}`).toEqual([Math.round(o.points[0]![0] * 1000) / 1000, Math.round(o.points[0]![1] * 1000) / 1000])
              expect(h.x).toBeGreaterThanOrEqual(0)
              expect(h.x).toBeLessThanOrEqual(sh.w)
              expect(h.y).toBeGreaterThanOrEqual(0)
              expect(h.y).toBeLessThanOrEqual(sh.h)
              expect(h.depth, `${at} ${h.op}`).toBeCloseTo(o.depth, 3)
              expect(o.what, `${at} ${h.op}`).toMatch(new RegExp(`^(forat|tall) Ø${h.dia}\\b`))
              expect(h.tool, `${at} ${h.op}`).toBe(`BROCA PLANA ${msl(o.candidate ?? o.tool)}`)
            })

            // Fresats: el parser només veu els CreateRoughFinish (les ranures), amb l'eina i la fondària.
            const rOps = sh.ops.filter((o) => o.kind === "route")
            expect(d.routs.length, at).toBe(rOps.length)
            d.routs.forEach((r, i) => {
              expect(r.tool, `${at} ${r.op}`).toBe(msl(rOps[i]!.tool))
              expect(r.depth, `${at} ${r.op}`).toBeCloseTo(rOps[i]!.depth, 3)
              // Sense recorregut explícit: el Maestro el calcula de la polilínia (no hi ha punts per al parser).
              expect(r.pts).toEqual([])
            })
            // Cap altre comentari no es fa passar per una eina.
            const uses = toolUses(d.drills, d.routs)
            expect(uses.every((u) => u.tool.startsWith("BROCA PLANA ") || m.tools.some((tt) => toolMslName(tt) === u.tool)), at).toBe(true)
            expect(uses.reduce((a, u) => a + u.drills, 0)).toBe(dOps.length)

            // Comptes contra les nostres dades: forats de la cara A i ranures de les peces del tauler (o un avís).
            const placed = sh.parts.map((p) => byId.get(p.panelId)!)
            const warned = (ref: string, re: RegExp) => x.warnings.filter((w) => w.startsWith(`${ref} `) && re.test(w)).length
            const holesA = placed.reduce((a, p) => a + p.holes.filter((h) => h.face === "A").length, 0)
            const holeWarn = sh.parts.reduce((a, p) => a + warned(p.ref, /: forat Ø[^:]* cara A: (cap broca|la broca)/), 0)
            expect(dOps.filter((o) => o.what.startsWith("forat")).length + holeWarn, at).toBe(holesA)
            const groovesA = placed.reduce((a, p) => a + p.grooves.filter((g) => g.face === "A").length, 0)
            const grooveWarn = sh.parts.reduce((a, p) => a + warned(p.ref, /: ranura [^:]* cara A: (cap fresa|massa curta|fora de la peça)/), 0)
            expect(sh.ops.filter((o) => o.stage === "groove").length + grooveWarn, at).toBe(groovesA)
            drills += d.drills.length
            routs += d.routs.length
          }
        }
      }
      expect(drills).toBeGreaterThan(0)
      expect(routs).toBeGreaterThan(0)
    })
  })
})
