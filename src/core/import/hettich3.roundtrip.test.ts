import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { meshFileMeshes, meshesBox } from "../../components/viewer/modelMeshes"
import { listZip, readZipEntry } from "../file/zip"
import type { HettichFile } from "./hettich"
import { groupImport, importCandidate, importFileKind } from "./makers"

/**
 * Els formats de més de la descàrrega sencera de Hettich (`HETTICH3_DIR` = carpeta amb `IGES_Griffe.zip`,
 * `3DS_Griffe.zip` i, si hi és, `IGES_Tischgestelle_….zip`; es baixen de hettich.com › Planning/CAD-Files i CAD):
 * HETTICH3_DIR=/tmp/claude-0/hz3 pnpm exec vitest run src/core/import/hettich3.roundtrip.test.ts
 */
const DIR = process.env.HETTICH3_DIR
const run = DIR && existsSync(join(DIR, "3DS_Griffe.zip")) ? describe : describe.skip

function zipFiles(name: string): { files: HettichFile[]; bytes: Uint8Array } {
  const bytes = new Uint8Array(readFileSync(join(DIR!, name)))
  const files = listZip(bytes)
    .map((e) => `${name.replace(/\.zip$/, "")}/${e.name}`)
    .filter((p) => !p.endsWith("/") && importCandidate(p))
    .map((path) => ({ path, kind: importFileKind(path) }))
  return { files, bytes }
}

run("Hettich: IGES i 3DS", () => {
  it("sense STEP, cada article d'IGES o 3DS entra «només 3D»; amb tots dos, un sol article", () => {
    const iges = zipFiles("IGES_Griffe.zip").files
    const tds = zipFiles("3DS_Griffe.zip").files
    expect(iges.filter((f) => f.kind === "iges").length).toBeGreaterThan(700)
    expect(tds.every((f) => f.kind === "3ds")).toBe(true)
    const { articles } = groupImport([...iges, ...tds])
    expect(articles.length).toBeGreaterThan(700)
    expect(articles.filter((a) => !(a.kind === "model" && a.category === "handle")).map((a) => a.article)).toEqual([])
    const a = articles.find((x) => x.article === "115169")!
    expect(a.files.map((f) => f.kind).sort()).toEqual(["3ds", "iges"])
    expect(a.plan).toMatch(/^Només 3D \(IGES\)/)
  })

  it("el 3DS és en mm, a les coordenades del STEP (Classic 115169: 133 × 26,5 × 22 al STEP)", async () => {
    const { bytes } = zipFiles("3DS_Griffe.zip")
    const e = listZip(bytes).find((x) => x.name.includes("/115169_"))!
    const box = meshesBox(await meshFileMeshes("3ds", await readZipEntry(bytes, e)))!
    expect(box.max[0] - box.min[0]).toBeGreaterThan(130)
    expect(box.max[0] - box.min[0]).toBeLessThan(140)
    expect(box.min[2]).toBeCloseTo(-11, 0)
    expect(box.max[2]).toBeCloseTo(11, 0)
  })
})
