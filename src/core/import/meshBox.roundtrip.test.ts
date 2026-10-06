import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import occtimportjs from "occt-import-js"
import { listZip, readZipEntry } from "../file/zip"
import { proposeArticle } from "./importItem"
import { meshesFrameBox, meshToFrame, modelProposal, positionsBox, type HardwareProposal } from "./proposal"
import { stepFeatures, type StepFeatures } from "./stepGeometry"

/**
 * **La caixa i el model 3D coincideixen** (`meshesFrameBox` i `meshesToGlb` fan servir la mateixa malla i el mateix marc,
 * `meshToFrame`), amb STEP reals: Hettich 9071205 (frontissa, marc de la proposta) i Blum 20K1101T i 71T453T (conjunts,
 * marc del fitxer). Abans la caixa sortia dels punts del STEP: als conjunts de Blum, a les coordenades de cada peça.
 * HETTICH_DIR=/tmp/claude-0/hz BLUM_DIR=/tmp/claude-0/blum pnpm exec vitest run src/core/import/meshBox.roundtrip.test.ts
 */
const HZ = process.env.HETTICH_DIR ?? ""
const BLUM = process.env.BLUM_DIR ?? ""
const STEP_ZIP = join(HZ, "STEP_Scharniere.zip")
const hasHettich = HZ !== "" && existsSync(STEP_ZIP)
const hasBlum = BLUM !== "" && existsSync(join(BLUM, "20K1101T_49480533.step"))

type V3 = [number, number, number]
const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b)

async function meshes(bytes: Uint8Array) {
  const o = await occtimportjs()
  const r = o.ReadStepFile(bytes, { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.002, angularDeflection: 0.5 })
  expect(r.success).toBe(true)
  return r.meshes.map((m) => ({ position: new Float32Array(m.attributes.position.array) }))
}

/** Límits (mm) del que va al GLB: les posicions en metres (Float32) que fa `meshesToGlb`. */
function glbBounds(ms: { position: Float32Array }[], p: HardwareProposal): { min: V3; max: V3 } {
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  for (const m of ms) {
    const pos = meshToFrame(m.position, p.frame, 0.001)
    for (let i = 0; i < pos.length; i += 3)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k]!, pos[i + k]! * 1000)
        max[k] = Math.max(max[k]!, pos[i + k]! * 1000)
      }
  }
  return { min, max }
}

/** La caixa desada (la de la importació) és la del model al seu marc, a 0,02 mm; i la que es refà del GLB desat, també. */
async function check(bytes: Uint8Array, propose: (f: StepFeatures) => HardwareProposal) {
  const f = stepFeatures(latin1(bytes))
  const p = propose(f)
  const ms = await meshes(bytes)
  const box = meshesFrameBox(ms, p.frame)!
  const g = glbBounds(ms, p)
  for (let k = 0; k < 3; k++) {
    expect(box.min[k]).toBeCloseTo(g.min[k]!, 1)
    expect(box.max[k]).toBeCloseTo(g.max[k]!, 1)
    expect(box.min[k]! - 1e-3).toBeLessThanOrEqual(g.min[k]!)
    expect(box.max[k]! + 1e-3).toBeGreaterThanOrEqual(g.max[k]!)
  }
  // La reparació dels d'abans (`hardwareBoxes.ts`): la caixa del GLB en metres → mm, la mateixa.
  const fromGlb = positionsBox([[g.min[0] / 1000, g.min[1] / 1000, g.min[2] / 1000, g.max[0] / 1000, g.max[1] / 1000, g.max[2] / 1000]], 1000)!
  for (let k = 0; k < 3; k++) {
    expect(fromGlb.min[k]).toBeCloseTo(box.min[k]!, 1)
    expect(fromGlb.max[k]).toBeCloseTo(box.max[k]!, 1)
  }
  return { box, old: p.bbox }
}

const size = (b: { min: V3; max: V3 }) => b.max.map((x, k) => Math.round(x - b.min[k]!))

describe.skipIf(!hasHettich)("caixa = model (Hettich)", () => {
  it("9071205: la caixa al marc de la frontissa (u, v, n) és la del GLB", async () => {
    const zip = new Uint8Array(readFileSync(STEP_ZIP))
    const e = listZip(zip).find((x) => /\/9071205\.stp$/.test(x.name))!
    const { box } = await check(await readZipEntry(zip, e), (f) => proposeArticle({ kind: "hinge" }, f))
    // La cassoleta (n < 0, dins de la porta) i el braç (n > 0) hi són.
    expect(box.min[2]).toBeLessThan(-10)
    expect(box.max[2]).toBeGreaterThan(5)
  }, 60_000)
})

describe.skipIf(!hasBlum)("caixa = model (Blum, conjunts)", () => {
  it("20K1101T (AVENTOS HK-XS): la caixa és la del model, no la dels punts del STEP (20 × 183 × 153 mm)", async () => {
    const { box, old } = await check(new Uint8Array(readFileSync(join(BLUM, "20K1101T_49480533.step"))), (f) => modelProposal(f, []))
    expect(size(box)).toEqual([20, 174, 110])
    // La d'abans (els punts, a les coordenades de cada peça) no hi coincidia.
    expect(size(old)).not.toEqual(size(box))
  }, 60_000)

  it("71T453T (CLIP top): ídem (la d'abans era més gran i desplaçada respecte del model)", async () => {
    const { box, old } = await check(new Uint8Array(readFileSync(join(BLUM, "71T453T_46020103.step"))), (f) => modelProposal(f, []))
    expect(size(box)).toEqual([46, 44, 83])
    expect(old.min[0]).not.toBeCloseTo(box.min[0], 0)
  }, 60_000)
})
