import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { listZip, readZipEntry } from "../file/zip"
import { groupHettich, hettichFileKind } from "../import/hettich"
import { articleItem, proposeArticle } from "../import/importItem"
import { setConfirmed } from "../model/hardwareEdit"
import { groupImport, importCandidate, importFileKind } from "../import/makers"
import { modelProposal } from "../import/proposal"
import { stepFeatures } from "../import/stepGeometry"
import { DEFAULT_MODULE_HARDWARE } from "../model"
import { expectFramed } from "./mountCameraCheck"

/**
 * La càmera de «Com va muntat» amb els ferratges **de debò** (no es copien al repo; sense les carpetes, se salta):
 * `HETTICH_DIR=… BLUM_DIR=… pnpm exec vitest run src/core/build/mountCamera.roundtrip.test.ts`
 */
const HZ = process.env.HETTICH_DIR ?? ""
const BLUM = process.env.BLUM_DIR ?? ""
const base = { hinge: DEFAULT_MODULE_HARDWARE.hinge, handle: DEFAULT_MODULE_HARDWARE.handle }

describe.skipIf(!HZ || !existsSync(join(HZ, "STEP_Scharniere.zip")))("Hettich (descàrregues reals)", () => {
  it("frontisses, plaques i els sistemes de calaix (només 3D): la càmera els enquadra", { timeout: 120000 }, async () => {
    let n = 0
    for (const zipName of ["STEP_Scharniere.zip", "STEP_Schubkastensysteme.zip"]) {
      const path = join(HZ, zipName)
      if (!existsSync(path)) continue
      const bytes = new Uint8Array(readFileSync(path))
      const index = listZip(bytes)
      const prefix = zipName.replace(/\.zip$/, "")
      const articles = groupHettich(index.map((e) => ({ path: `${prefix}/${e.name}`, kind: hettichFileKind(e.name), size: e.size })))
      // Una mostra repartida (llegir tots els STEP trigaria minuts).
      const step = articles.filter((a) => a.files.some((f) => f.kind === "step"))
      const every = Math.max(1, Math.floor(step.length / 25))
      for (let i = 0; i < step.length; i += every) {
        const a = step[i]!
        const e = index.find((x) => `${prefix}/${x.name}` === a.files.find((f) => f.kind === "step")!.path)!
        const p = proposeArticle(a, stepFeatures(new TextDecoder("latin1").decode(await readZipEntry(bytes, e))))
        const item = articleItem(p, a, base, { id: `hw-${a.article}`, asset: `hwa-${a.article}`, files: [] })
        expectFramed(item, `${a.article} ${a.kind}`)
        if (item.engine !== "model") expectFramed(setConfirmed(item, true), `${a.article} ${a.kind} confirmat`)
        n++
      }
    }
    expect(n).toBeGreaterThan(20)
  })
})

describe.skipIf(!BLUM || !existsSync(BLUM))("Blum (descàrregues reals)", () => {
  it("tots els articles amb STEP: la càmera els enquadra", { timeout: 120000 }, async () => {
    const files: { path: string; kind: ReturnType<typeof importFileKind> }[] = []
    const read = new Map<string, () => Promise<Uint8Array>>()
    for (const name of readdirSync(BLUM)) {
      const full = join(BLUM, name)
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
    const { articles } = groupImport(files)
    let n = 0
    for (const a of articles) {
      const step = a.files.find((f) => f.kind === "step")
      if (!step) continue
      const p = a.kind === "none" ? modelProposal(stepFeatures(new TextDecoder("latin1").decode(await read.get(step.path)!())), []) : proposeArticle(a, stepFeatures(new TextDecoder("latin1").decode(await read.get(step.path)!())))
      const item = articleItem(p, a, base, { id: `hw-${a.article}`, asset: `hwa-${a.article}`, files: [] })
      expectFramed(item, `Blum ${a.article} ${a.kind}`)
      if (item.engine !== "model") expectFramed(setConfirmed(item, true), `Blum ${a.article} ${a.kind} confirmat`)
      n++
    }
    expect(n).toBeGreaterThan(5)
  })
})
