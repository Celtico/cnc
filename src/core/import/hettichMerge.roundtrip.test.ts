/**
 * Tornar a importar amb les descàrregues reals de Hettich (STEP i DWG/DXF de la mateixa família, junts o l'un després de
 * l'altre). Els ZIP es busquen a `HETTICH_DIR`, `HETTICH2_DIR` i `HETTICH_DXF_DIR` (el primer que el tingui): són dades del
 * fabricant, **no es copien al repo**; sense els ZIP, se salta.
 * `HETTICH_DIR=… HETTICH2_DIR=… HETTICH_DXF_DIR=… pnpm exec vitest run src/core/import/hettichMerge.roundtrip.test.ts`
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { modelCamera } from "../build/hardwareMount"
import { listZip, readZipEntry, type ZipEntry } from "../file/zip"
import { DEFAULT_HARDWARE_KIT } from "../model"
import { readDxf } from "./dxf"
import { groupHettich, hettichCandidate, hettichFileKind, type HettichArticle } from "./hettich"
import { articleItem, proposeArticle } from "./importItem"
import { mergeImported, mergePreview } from "./merge"
import { modelProposal } from "./proposal"
import { stepFeatures } from "./stepGeometry"
import { registerStoredView, viewFromDxf } from "./views"

const DIRS = [process.env.HETTICH_DIR, process.env.HETTICH2_DIR, process.env.HETTICH_DXF_DIR].filter((d): d is string => !!d)
const find = (name: string) => DIRS.map((d) => join(d, name)).find((p) => existsSync(p)) ?? null
const has = (...names: string[]) => names.every((n) => find(n) !== null)

interface Opened {
  entries: Map<string, { bytes: Uint8Array; e: ZipEntry }>
  files: { path: string; kind: ReturnType<typeof hettichFileKind> }[]
}
/** Un ZIP com el llegeix l'app (`sourceFromPicked`), dins d'una carpeta «ferratges» (com la de l'usuari). */
function open(name: string): Opened {
  const bytes = new Uint8Array(readFileSync(find(name)!))
  const base = `ferratges/${name.replace(/\.zip$/i, "")}`
  const entries = new Map<string, { bytes: Uint8Array; e: ZipEntry }>()
  const files: Opened["files"] = []
  for (const e of listZip(bytes)) {
    const path = `${base}/${e.name}`
    if (e.name.endsWith("/") || !hettichCandidate(path)) continue
    entries.set(path, { bytes, e })
    files.push({ path, kind: hettichFileKind(path) })
  }
  return { entries, files }
}
const text = async (o: Opened[], path: string) => {
  for (const z of o) {
    const x = z.entries.get(path)
    if (x) return new TextDecoder("latin1").decode(await readZipEntry(x.bytes, x.e))
  }
  throw new Error(path)
}
const base = { hinge: DEFAULT_HARDWARE_KIT.hinge, handle: DEFAULT_HARDWARE_KIT.handle }
const names = (a: HettichArticle) => a.files.map((f) => f.path.split("/").pop()!)

describe.skipIf(!has("DWG_DXF_Griffe.zip", "STEP_Griffe.zip"))("tiradors: DWG_DXF_Griffe.zip i STEP_Griffe.zip", { timeout: 60000 }, () => {
  const dxf = has("DWG_DXF_Griffe.zip") ? open("DWG_DXF_Griffe.zip") : null!
  const stp = has("STEP_Griffe.zip") ? open("STEP_Griffe.zip") : null!

  it("el ZIP DWG/DXF sol: tots els articles amb vistes s'importen («només 2D»), amb noms nets", () => {
    const g = groupHettich(dxf.files)
    expect(g.length).toBeGreaterThan(700)
    const with2d = g.filter((a) => a.only2d)
    expect(with2d.length).toBeGreaterThan(700)
    expect(with2d.every((a) => a.kind === "model" && a.category === "handle")).toBe(true)
    expect(g.some((a) => /ferratges|DWG|DXF|STEP/.test(a.label))).toBe(false)
    expect(g.find((a) => a.article === "9070102")?.label).toBe("Tirador Classic · 9070102")
  })

  it("STEP i DWG/DXF junts: un article per número amb tots els fitxers (cap repetit)", () => {
    const g = groupHettich([...stp.files, ...dxf.files])
    const a = g.find((x) => x.article === "9070102")!
    expect(new Set(a.files.map((f) => f.kind))).toEqual(new Set(["step", "front", "side", "top", "dxf3d", "dwg"]))
    expect(a.kind).toBe("handle")
    expect(new Set(g.map((x) => x.article)).size).toBe(g.length)
    // Els que només són al DWG/DXF també s'hi poden importar (només 2D).
    const onlyDxf = g.filter((x) => x.only2d)
    // Cap de no importable que porti el STEP o les vistes (només n'hi ha amb el 3D DWG/DXF sol).
    expect(g.filter((x) => x.kind === "none" && x.files.some((f) => ["step", "front", "side", "top"].includes(f.kind)))).toEqual([])
    console.info(`Griffe: ${g.length} articles, ${onlyDxf.length} només al DWG/DXF`)
  })

  it("l'un després de l'altre: el DXF primer (només 2D) i el STEP després → tirador amb la distància, mateix id", async () => {
    const o = [dxf, stp]
    const a2d = groupHettich(dxf.files).find((x) => x.article === "9070102")!
    const views = []
    for (const k of ["front", "side", "top"] as const) {
      const f = a2d.files.find((x) => x.kind === k)
      if (f) views.push(viewFromDxf(k, readDxf(await text(o, f.path)), []))
    }
    const first = articleItem(modelProposal(null, [a2d.plan!]), a2d, base, { id: "hw-1", files: names(a2d), ...(views[0]?.points.length ? { points: views[0].points } : {}) })
    expect(first.engine).toBe("model")
    expect(first.imported!.bbox).toBeUndefined()
    const a3d = groupHettich(stp.files).find((x) => x.article === "9070102")!
    expect(mergePreview([first], a3d)!.adds).toEqual(["3D i forats proposats"])
    const p = proposeArticle(a3d, stepFeatures(await text(o, a3d.files.find((f) => f.kind === "step")!.path)))
    const r = mergeImported(first, articleItem(p, a3d, base, { id: "hw-1", files: names(a3d) }), true)
    expect(r.item).toMatchObject({ id: "hw-1", engine: "barHandle", name: "Tirador Classic · 9070102" })
    expect(r.item.pitch!.else).toBe(96)
    expect(r.item.imported!.confirmed).toBe(false)
    expect(r.item.imported!.files).toEqual(expect.arrayContaining(["9070102.stp", "9070102_2d_front_view.dxf"]))
  })
})

describe.skipIf(!has("DWG_DXF_Scharniere.zip", "STEP_Scharniere.zip"))("frontisses: la vista frontal desada abans del STEP es registra quan arriba", { timeout: 60000 }, () => {
  it("Sensys 9071205: DXF primer (sense registrar), STEP després (registrada sobre els forats)", async () => {
    const dxf = open("DWG_DXF_Scharniere.zip")
    const stp = open("STEP_Scharniere.zip")
    const a2d = groupHettich(dxf.files).find((x) => x.article === "9071205")!
    expect(a2d).toMatchObject({ only2d: true, category: "hinge", label: "Frontissa Sensys 110° · 9071205" })
    const front = viewFromDxf("front", readDxf(await text([dxf], a2d.files.find((f) => f.kind === "front")!.path)), [])
    expect(front.registered).toBe(false)
    expect(front.circles?.length).toBeGreaterThan(0)
    const a3d = groupHettich(stp.files).find((x) => x.article === "9071205")!
    const p = proposeArticle(a3d, stepFeatures(await text([stp], a3d.files.find((f) => f.kind === "step")!.path)))
    const reg = registerStoredView(front, p.holes)
    expect(reg.registered).toBe(true)
    expect(reg.circles).toBeUndefined()
  })
})

describe.skipIf(!has("STEP_Schiebetuersysteme.zip"))("portes corredisses: un perfil llarg i prim", () => {
  it("SlideLine 55 9060402: «Porta corredissa SlideLine 55 · 9060402», i la càmera en veu la secció", { timeout: 60000 }, async () => {
    const stp = open("STEP_Schiebetuersysteme.zip")
    const extra = has("DWG_DXF_Schiebetuersysteme.zip") ? [open("DWG_DXF_Schiebetuersysteme.zip")] : []
    const g = groupHettich([...stp.files, ...extra.flatMap((x) => x.files)])
    const a = g.find((x) => x.article === "9060402")!
    expect(a.label).toBe("Porta corredissa SlideLine 55 · 9060402")
    const p = proposeArticle(a, stepFeatures(await text([stp], a.files.find((f) => f.kind === "step")!.path)))
    const size = p.bbox.max.map((v, i) => v - p.bbox.min[i]!).sort((x, y) => y - x)
    console.info(`9060402: ${size.map((v) => v.toFixed(1)).join(" × ")} mm`)
    expect(size[0]! / size[1]!).toBeGreaterThan(20)
    const c = modelCamera(p.bbox, 1.6)
    expect(c.dist).toBeGreaterThan(0)
  })
})
