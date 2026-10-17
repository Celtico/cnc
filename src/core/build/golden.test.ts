import { beforeAll, describe, expect, it } from "vitest"
import { toDxf, parseDxfEntities } from "../export/dxf"
import { cncNestOptions, toMaestroNestXcs } from "../export/maestroNestXcs"
import { toTopsolidCsv } from "../export/topsolidCsv"
import { machineFromContext } from "../machine/maestro"
import { bytes, read } from "../machine/testContext"
import type { Composition, Machine, Panel } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { buildComposition } from "./buildComposition"
import { catalogCorpus, randomComposition } from "./testCorpus"

/**
 * Proves d'or («regles d'or»): un resum compacte i determinista de tot el que es fabrica (peces, mecanitzats, avisos)
 * per a totes les plantilles del catàleg i 200 variacions aleatòries amb llavor, i dels fitxers del taller (CSV de
 * TopSolid, .xcs per tauler, DXF) per a uns quants. Es compara amb `__golden__/*.json`: qualsevol canvi a la
 * fabricació hi surt. Si el canvi és volgut: `UPDATE_GOLDEN=1 pnpm test` i revisar el diff dels JSON.
 */

const fsMod = "node:fs"
const fs = (await import(/* @vite-ignore */ fsMod)) as {
  readFileSync: (p: URL, enc: "utf8") => string
  writeFileSync: (p: URL, s: string) => void
  existsSync: (p: URL) => boolean
  mkdirSync: (p: URL, o: { recursive: boolean }) => void
}
const UPDATE = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.UPDATE_GOLDEN === "1"
const DIR = new URL("./__golden__/", import.meta.url)

/** FNV-1a de 32 bits en hexadecimal. */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}
const n1 = (v: number) => String(Math.round(v * 10) / 10)
const n2 = (v: number) => String(Math.round(v * 100) / 100)
/** Hash d'una llista sense ordre (cada element ja en text). */
const setHash = (xs: string[]) => (xs.length ? `${xs.length}:${hash([...xs].sort().join(";"))}` : "0")

/** Una línia per peça: tot el que es fabrica, sense ids (les plantilles fan ids nous a cada `make`). */
function panelLine(p: Panel): string {
  const e = p.edges
  const edges = `${e.top ? 1 : 0}${e.right ? 1 : 0}${e.bottom ? 1 : 0}${e.left ? 1 : 0}`
  const holes = setHash(p.holes.map((h) => [h.face, n2(h.x), n2(h.y), n2(h.diameter), n2(h.depth), h.edge ?? "", h.tag ?? ""].join(",")))
  const grooves = setHash(p.grooves.map((g) => [g.face, n2(g.x), n2(g.y), n2(g.w), n2(g.h), n2(g.depth), g.tag ?? ""].join(",")))
  const cutouts = setHash((p.cutouts ?? []).map((c) => JSON.stringify(c, (_, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v))))
  const outline = p.outline ? hash(p.outline.map((q) => q.map(n2).join(",")).join(";")) : "-"
  const pl = p.placement
  const place = hash([...pl.origin, ...pl.xAxis, ...pl.yAxis, ...pl.zAxis].map(n1).join(","))
  const extra = [p.mitres?.length ? `m:${[...p.mitres].sort().join(",")}` : "", p.assembly ? "glue" : "", p.push ? "push" : "", p.solidCuts?.length ? `solid:${p.solidCuts.length}` : "", p.pockets?.length ? `k:${setHash(p.pockets.map((k) => JSON.stringify(k, (_, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v))))}` : ""].filter(Boolean).join(" ")
  return `${p.role}|${p.name}|${n1(p.length)}x${n1(p.width)}x${n1(p.thickness)}|${p.material}|${p.grain}|e${edges}|h${holes}|g${grooves}|c${cutouts}|o${outline}|@${place}${extra ? `|${extra}` : ""}`
}

interface Digest {
  panels: number
  extras: number
  warnings: string[]
  p: string[]
}

function digest(c: Composition): Digest {
  const b = buildComposition(c)
  // Peces iguals juntes (`3× …`): fitxers petits i diffs que diuen què ha canviat.
  const count = new Map<string, number>()
  for (const p of b.panels) count.set(panelLine(p), (count.get(panelLine(p)) ?? 0) + 1)
  return {
    panels: b.panels.length,
    extras: b.extras.length,
    warnings: b.warnings.map((w) => w.code).sort(),
    p: [...count].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([l, k]) => (k > 1 ? `${k}× ${l}` : l)),
  }
}

function compare(file: string, actual: unknown): void {
  const url = new URL(file, DIR)
  const text = JSON.stringify(actual, null, 1) + "\n"
  if (UPDATE || !fs.existsSync(url)) {
    if (!UPDATE) throw new Error(`Falta ${file}: UPDATE_GOLDEN=1 pnpm test per crear-lo (i revisa'l).`)
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(url, text)
    return
  }
  expect(actual, `${file} ha canviat: si és volgut, UPDATE_GOLDEN=1 pnpm test i revisa el diff`).toEqual(JSON.parse(fs.readFileSync(url, "utf8")))
}

// --- Corpus: plantilles (per grups) i 200 variacions -------------------------------------------------------------

const catalog = catalogCorpus()
const groups: [string, typeof catalog][] = [
  ["catalog-app", catalog.filter((t) => !t.id.startsWith("store-") && !t.id.startsWith("col:") && !t.id.startsWith("mag:"))],
  ["catalog-collections", catalog.filter((t) => t.id.startsWith("col:"))],
  ["catalog-mag", catalog.filter((t) => t.id.startsWith("mag:"))],
]
const store = catalog.filter((t) => t.id.startsWith("store-"))
for (let i = 0; i < store.length; i += 50) groups.push([`catalog-store-${i / 50 + 1}`, store.slice(i, i + 50)])
const RANDOM = 200
const CHUNK = 50

describe("proves d'or: peces i avisos", () => {
  it("ids únics al corpus", () => {
    expect(new Set(catalog.map((t) => t.id)).size).toBe(catalog.length)
  })
  for (const [name, items] of groups)
    it(name, () => {
      compare(`${name}.json`, Object.fromEntries(items.map((t) => [t.id, digest(t.make())])))
    })
  for (let s = 1; s <= RANDOM; s += CHUNK)
    it(`random-${(s - 1) / CHUNK + 1}`, () => {
      const out: Record<string, Digest> = {}
      for (let seed = s; seed < s + CHUNK; seed++) out[`seed-${seed}`] = digest(randomComposition(seed))
      compare(`random-${(s - 1) / CHUNK + 1}.json`, out)
    })
})

// --- Fitxers del taller per a uns quants -----------------------------------------------------------------------------

let M: Machine
beforeAll(async () => {
  M = (await machineFromContext({ tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" }, "m")).machine
})

const EXPORT_IDS = ["sideboard-iron", "floating-tv", "bath-vanity", "walnut-console", "modern-kitchen", "flatpack-desk", "store-salo-moble-tv-1", "store-dormitori-c-moda-2", "store-dormitori-armari-1", "store-menjador-aparador-3"]

function exportDigest(c: Composition) {
  const panels = buildComposition(c).panels
  const { options } = cncNestOptions(panels, M, DEFAULT_NEST_OPTIONS)
  const nesting = nest(panels, options)
  const csv = toTopsolidCsv(panels, nesting, { project: "Or" })
  const xcs = toMaestroNestXcs(panels, nesting, M, { project: "Or", date: new Date("2026-10-02T00:00:00Z") })
  const layers = new Map<string, number>()
  for (const e of parseDxfEntities(toDxf(panels))) layers.set(`${e.type}@${e.layer ?? "-"}`, (layers.get(`${e.type}@${e.layer ?? "-"}`) ?? 0) + 1)
  return {
    boards: nesting.boards.length,
    csv: { rows: csv.rows.length, unplaced: csv.unplaced.length, hash: hash(csv.text) },
    xcs: {
      warnings: xcs.warnings.length,
      sheets: xcs.sheets.map((s) => {
        const ops = new Map<string, number>()
        for (const o of s.ops) ops.set(`${o.stage}:${o.kind}`, (ops.get(`${o.stage}:${o.kind}`) ?? 0) + 1)
        return `${s.file} parts:${s.parts.length} ${[...ops].sort().map(([k, v]) => `${k}=${v}`).join(" ")} #${hash(s.text)}`
      }),
    },
    dxf: [...layers].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}=${v}`),
  }
}

describe("proves d'or: fitxers del taller", () => {
  it("CSV de TopSolid, .xcs per tauler i DXF", () => {
    const byId = new Map(catalog.map((t) => [t.id, t]))
    const out: Record<string, unknown> = {}
    for (const id of EXPORT_IDS) out[id] = exportDigest(byId.get(id)!.make())
    for (const seed of [3, 17]) out[`seed-${seed}`] = exportDigest(randomComposition(seed))
    compare("exports.json", out)
  })
})
