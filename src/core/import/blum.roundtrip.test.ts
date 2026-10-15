import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { toDxf } from "../export/dxf"
import { listZip, readZipEntry } from "../file/zip"
import { DEFAULT_MODULE_HARDWARE, defaultModule, type HardwareItem, type Panel } from "../model"
import type { HettichFile } from "./hettich"
import { articleItem } from "./importItem"
import { confirmProblem, setConfirmed } from "../model/hardwareEdit"
import { groupImport, importCandidate, importFileKind } from "./makers"
import { mergeImported, mergePreview } from "./merge"
import { modelProposal } from "./proposal"
import { stepFeatures } from "./stepGeometry"
import { machiningFromXilog, readXilog } from "./xilogPgm"

/**
 * Amb les descàrregues reals de Blum E-SERVICES (`BLUM_DIR` = la carpeta amb els fitxers solts i els ZIP del producte;
 * no es copien al repo): BLUM_DIR=/tmp/claude-0/blum pnpm exec vitest run src/core/import/blum.roundtrip.test.ts
 */
const DIR = process.env.BLUM_DIR
const run = DIR && existsSync(DIR) ? describe : describe.skip

/** Els fitxers com els tria l'usuari: els solts i els ZIP (els de dins, amb el nom del ZIP com a carpeta). */
async function picked(dir: string): Promise<{ files: HettichFile[]; read: Map<string, () => Promise<Uint8Array>> }> {
  const files: HettichFile[] = []
  const read = new Map<string, () => Promise<Uint8Array>>()
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (!statSync(full).isFile()) continue
    if (name.endsWith(".zip")) {
      const bytes = new Uint8Array(readFileSync(full))
      for (const e of listZip(bytes)) {
        const path = `${name.replace(/\.zip$/, "")}/${e.name}`
        if (e.name.endsWith("/") || !importCandidate(path)) continue
        files.push({ path, kind: importFileKind(path) })
        read.set(path, () => readZipEntry(bytes, e))
      }
      continue
    }
    if (!importCandidate(name)) continue
    files.push({ path: name, kind: importFileKind(name) })
    read.set(name, async () => new Uint8Array(readFileSync(full)))
  }
  return { files, read }
}

run("Blum (descàrregues reals)", () => {
  it("tots els .pgm es llegeixen sencers: forats XBO, cap registre desconegut", async () => {
    const { files, read } = await picked(DIR!)
    const pgms = files.filter((f) => f.kind === "pgm")
    expect(pgms.length).toBeGreaterThanOrEqual(9)
    for (const f of pgms) {
      const p = readXilog(await read.get(f.path)!())
      expect(p.version, f.path).toBe("Xilog3-9.0")
      expect(p.header, f.path).toEqual({ dx: 200, dy: 100, dz: 19, bx: 0, by: 0 })
      expect(p.holes.length, f.path).toBeGreaterThan(0)
      expect(p.warnings, f.path).toEqual([])
    }
  })

  it("agrupa per article (fitxers solts i ZIP), amb el producte i la peça", async () => {
    const { files } = await picked(DIR!)
    const { articles, loose } = groupImport(files)
    expect(articles.every((a) => a.maker === "Blum")).toBe(true)
    expect(loose).toEqual([])
    const by = new Map(articles.map((a) => [a.article, a]))
    // Amb 3D, la frontissa de Blum va al lloc de frontissa (abans «només 3D» col·locada a mà).
    expect(by.get("71T453T")).toMatchObject({ category: "hinge", part: "front", kind: "hinge" })
    expect(by.get("48N0510.02")).toMatchObject({ hand: "R" })
    expect(by.get("48N0510.03")).toMatchObject({ hand: "L" })
    // Els ZIP repetits (« (1)») i els STEP/DXF de cada joc van al mateix article.
    const tip = by.get("956.1201")!
    expect(tip).toMatchObject({ category: "push", label: "Placa TIP-ON · 956.1201", part: "side" })
    expect(by.get("750.4501T")).toMatchObject({ category: "slide", label: "Guia LEGRABOX · 750.4501T" })
    expect(by.get("40.2000")!.files.map((f) => f.kind)).toContain("pgm")
    // Un DXF de Blum és un sòlid ACIS: sense STEP ni PGM no s'importa.
    for (const a of articles) if (!a.files.some((f) => ["step", "pgm", "dae"].includes(f.kind))) expect(a.kind, a.article).toBe("none")
  })

  it("71T453T: espigues Ø10 × 6 a ±16; confirmat i col·locat al lateral, el DXF del moble porta els forats", async () => {
    const { files, read } = await picked(DIR!)
    const a = groupImport(files).articles.find((x) => x.article === "71T453T")!
    const step = a.files.find((f) => f.kind === "step")!
    const p = modelProposal(stepFeatures(new TextDecoder("latin1").decode(await read.get(step.path)!())), [])
    const pgm = a.files.find((f) => f.kind === "pgm")!
    const m = machiningFromXilog(await read.get(pgm.path)!(), a.part!, "pgm")
    expect(m.ops.map((o) => [o.part, o.face, o.d, o.depth, o.p.at, o.q.at])).toEqual([
      ["front", "A", 10, 6, 0, -16],
      ["front", "A", 10, 6, 0, 16],
    ])
    let item: HardwareItem = { ...articleItem(p, a, { hinge: DEFAULT_MODULE_HARDWARE.hinge, handle: DEFAULT_MODULE_HARDWARE.handle }, { id: "hw-71t", files: a.files.map((f) => f.path) }), machining: m.ops }
    expect(item).toMatchObject({ maker: "Blum", ref: "71T453T", engine: "model", category: "hinge", imported: { maker: "Blum", article: "71T453T", confirmed: false } })
    expect(item.imported!.bbox).toBeDefined()
    // Sense confirmar, cap forat. Al lateral amb el grup «porta» de l'item (com fa «Mecanitzats de» a l'editor).
    const place = (it: HardwareItem) =>
      buildComposition({ modules: [defaultModule("m1", "Baix")], references: [], hardwarePlacements: [{ id: "pl", item: it, targets: [{ part: "front", module: "m1", panel: "side-left" }], p: { from: "max", at: 37 }, q: { from: "min", at: 100 } }] })
    const side = (b: { panels: Panel[] }) => b.panels.find((x) => x.id === "m1:side-left")!
    const pending = place(item)
    expect(side(pending).holes.filter((h) => h.tag === "fitting")).toEqual([])
    expect(pending.warnings.some((w) => w.code === "hardware")).toBe(true)
    expect(confirmProblem(item)).toBeNull()
    item = setConfirmed(item, true)
    const b = place(item)
    const holes = side(b).holes.filter((h) => h.tag === "fitting")
    expect(holes.map((h) => [h.diameter, h.depth, h.face])).toEqual([
      [10, 6, "A"],
      [10, 6, "A"],
    ])
    // Els dos forats a 32 mm, en vertical (Q = alçada al lateral).
    const [h0, h1] = holes as [(typeof holes)[0], (typeof holes)[0]]
    expect(Math.hypot(h1.x - h0.x, h1.y - h0.y)).toBe(32)
    // L'eix llarg del lateral (local x) és l'alçada: els dos forats a la mateixa fondària (y local) del davant.
    const sp = side(b)
    expect(sp.length).toBeGreaterThan(sp.width)
    expect(h0.y).toBe(h1.y)
    // El DXF del taller: dos cercles Ø10 a la capa de 6 mm de fondària.
    const dxf = toDxf(b.panels)
    expect((dxf.match(/^DRILL_D10_P6\r?$/gm) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it("tornar a importar: la clau és Blum + article; un PGM nou no toca un mecanitzat confirmat", async () => {
    const { files, read } = await picked(DIR!)
    const a = groupImport(files).articles.find((x) => x.article === "70T453T.TL")!
    const m = machiningFromXilog(await read.get(a.files.find((f) => f.kind === "pgm")!.path)!(), "side", "pgm")
    const base = { hinge: DEFAULT_MODULE_HARDWARE.hinge, handle: DEFAULT_MODULE_HARDWARE.handle }
    const confirmed = setConfirmed({ ...articleItem(modelProposal(null, []), a, base, { id: "hw-1", files: [] }), machining: m.ops }, true)
    expect(mergePreview([confirmed], a)!.adds).toEqual(expect.arrayContaining(["mecanitzats exactes (Xilog)"]))
    expect(mergePreview([confirmed], { ...a, maker: "Hettich" })).toBeNull()
    const other = { ...articleItem(modelProposal(null, []), a, base, { id: "hw-1", files: [] }), machining: m.ops.map((o) => ({ ...o, d: 8 })) }
    const r = mergeImported(confirmed, other, true)
    expect(r.item.machining).toEqual(m.ops)
    expect(r.item.imported!.confirmed).toBe(true)
    expect(r.pendingUpdate).toBe(true)
    expect(r.item.imported!.update!.machining![0]!.d).toBe(8)
  })
})
