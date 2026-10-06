/**
 * Marc de muntatge estimat de la **malla** (`meshFrame.ts`) amb els fitxers reals, tessel·lats amb OpenCascade al Node
 * (`occt-import-js`, el mateix WASM que el navegador): Hettich (`HETTICH_DIR`: `STEP_Scharniere.zip`) i Blum (`BLUM_DIR`:
 * `71T453T_….step`). Són dades del fabricant: **no es copien al repo**; sense les carpetes, se salta.
 * `HETTICH_DIR=… BLUM_DIR=… pnpm exec vitest run src/core/import/meshFrame.roundtrip.test.ts`
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { listZip, readZipEntry } from "../file/zip"
import { frameFromMesh, hingeFrameFromMesh, plateFrameFromMesh, type MeshLike } from "./meshFrame"
import { proposeHinge, proposePlate, type HardwareProposal } from "./proposal"
import { stepFeatures } from "./stepGeometry"

const HZ = process.env.HETTICH_DIR ?? ""
const BLUM = process.env.BLUM_DIR ?? ""
const STEP_ZIP = join(HZ, "STEP_Scharniere.zip")
const hasHz = HZ !== "" && existsSync(STEP_ZIP)
const blumStep = BLUM !== "" && existsSync(BLUM) ? readdirSync(BLUM).find((f) => /^71T453T_\d+\.step$/i.test(f)) : undefined

type Occt = { ReadStepFile: (bytes: Uint8Array, params: null) => { success: boolean; meshes: { attributes: { position: { array: ArrayLike<number> } }; index: { array: ArrayLike<number> } }[] } }
let occt: Promise<Occt> | null = null
/** La malla d'un STEP amb OpenCascade (mm, coordenades del fitxer), com fa `stepMesh.ts` al navegador. */
async function meshesOf(bytes: Uint8Array): Promise<MeshLike[]> {
  occt ??= (import("occt-import-js/dist/occt-import-js.js") as Promise<{ default: () => Promise<Occt> }>).then((m) => m.default())
  const r = (await occt).ReadStepFile(bytes, null)
  if (!r.success) throw new Error("OpenCascade no ha llegit el STEP")
  return r.meshes.map((m) => ({ position: Float32Array.from(m.attributes.position.array) }))
}
const ok = (p: HardwareProposal | { error: string }): HardwareProposal => {
  if ("error" in p) throw new Error(p.error)
  return p
}
const holes = (p: HardwareProposal) => p.holes.map((h) => [h.role, h.u, h.v, h.d, h.depth])
const near = (a: readonly number[], b: readonly number[], tol = 0.02) => a.every((x, i) => Math.abs(x - b[i]!) <= tol)

describe.skipIf(!hasHz)("marc de la malla: Hettich (el mateix que el dels cilindres del STEP)", () => {
  const bytes = hasHz ? new Uint8Array(readFileSync(STEP_ZIP)) : null!
  const index = hasHz ? listZip(bytes) : []
  const read = async (art: string) => readZipEntry(bytes, index.find((e) => new RegExp(`/${art}\\.stp$`).test(e.name))!)

  it("Sensys 9071205: cassoleta Ø35 × 13 i cargols a ±26 / 5,5, al mateix marc", async () => {
    const raw = await read("9071205")
    const fromStep = ok(proposeHinge(stepFeatures(new TextDecoder("latin1").decode(raw))))
    const fromMesh = hingeFrameFromMesh(await meshesOf(raw))!
    expect(fromMesh).not.toBeNull()
    expect(holes(fromMesh)).toEqual(holes(fromStep))
    for (const k of ["origin", "u", "v", "n"] as const) expect(near(fromMesh.frame[k], fromStep.frame[k]), k).toBe(true)
  }, 120_000)

  it("Ø26 (72966): la cassoleta Ø26 × 11 a l'eix Y, cara a l'origen", async () => {
    const raw = await read("72966")
    const fromStep = ok(proposeHinge(stepFeatures(new TextDecoder("latin1").decode(raw))))
    const fromMesh = hingeFrameFromMesh(await meshesOf(raw))!
    expect(fromMesh.holes[0]).toMatchObject({ role: "cup", d: 26, depth: 11 })
    for (const k of ["origin", "u", "v", "n"] as const) expect(near(fromMesh.frame[k], fromStep.frame[k]), k).toBe(true)
  }, 120_000)

  it("placa 9071615: les dues espigues Ø10 × 11,5 a ±16, al mateix marc", async () => {
    const raw = await read("9071615")
    const fromStep = ok(proposePlate(stepFeatures(new TextDecoder("latin1").decode(raw))))
    const fromMesh = plateFrameFromMesh(await meshesOf(raw))!
    expect(fromMesh).not.toBeNull()
    expect(holes(fromMesh)).toEqual(holes(fromStep))
    for (const k of ["origin", "u", "v", "n"] as const) expect(near(fromMesh.frame[k], fromStep.frame[k]), k).toBe(true)
  }, 120_000)
})

describe.skipIf(!blumStep)("marc de la malla: Blum 71T453T (CLIP top EXPANDO T, sense cassoleta rodona)", () => {
  it("el parell d'espigues Ø10 a ±16 dona la cara de la porta (z = 38,5, cos cap a −z) i la cassoleta al mig", async () => {
    const raw = new Uint8Array(readFileSync(join(BLUM, blumStep!)))
    // Dels cilindres del STEP no en surt res (la cassoleta no és cap `CYLINDRICAL_SURFACE`).
    expect("error" in proposeHinge(stepFeatures(new TextDecoder("latin1").decode(raw)))).toBe(true)
    const p = frameFromMesh("hinge", await meshesOf(raw))!
    expect(p).not.toBeNull()
    expect(near(p.frame.origin, [-27, 0, 38.5], 0.05)).toBe(true)
    expect(near(p.frame.n, [0, 0, -1])).toBe(true)
    expect(p.holes.map((h) => [h.role, Math.abs(h.u), h.v, h.d])).toEqual([
      ["cup", 0, 0, 35],
      ["dowel", 16, 0, 10],
      ["dowel", 16, 0, 10],
    ])
    // El braç s'allarga cap al cos del moble (n fins a uns 77 mm) i les espigues entren a la porta (n negatiu).
    expect(p.bbox.max[2]).toBeGreaterThan(60)
    expect(p.bbox.min[2]).toBeLessThan(-4)
    expect(p.notes[0]).toMatch(/sense cassoleta rodona/)
  }, 120_000)
})
