/**
 * Amb les descàrregues reals de Hettich que no són de frontisses (ZIP tal com es baixen de hettich.com, a `HETTICH2_DIR`:
 * `STEP_Griffe.zip`, `STEP_Tischgestelle_-beine_Moebelfuesse_Tischausziehfuehrungen.zip`,
 * `STEP_Cadro_Aluminiumrahmensystem.zip` i, si hi són, `STEP_Schiebetuersysteme.zip` i `STEP_Falttuersysteme.zip`). Són
 * dades del fabricant: **no es copien al repo**; sense la carpeta (o sense un ZIP), se salta.
 * `HETTICH2_DIR=/camí/als/zips pnpm exec vitest run src/core/import/hettich2.roundtrip.test.ts`
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildModule } from "../build/buildModule"
import { listZip, readZipEntry } from "../file/zip"
import { DEFAULT_HARDWARE_KIT, defaultModule, type Panel, type Zone } from "../model"
import { groupHettich, hettichFileKind, type HettichArticle } from "./hettich"
import { articleItem, proposalPlan, proposeArticle, setConfirmed } from "./importItem"
import type { HardwareProposal } from "./proposal"
import { stepFeatures } from "./stepGeometry"

const DIR = process.env.HETTICH2_DIR ?? ""
const zip = (name: string) => join(DIR, name)
const has = (name: string) => DIR !== "" && existsSync(zip(name))
const GRIFFE = "STEP_Griffe.zip"
const LEGS = "STEP_Tischgestelle_-beine_Moebelfuesse_Tischausziehfuehrungen.zip"
const CADRO = "STEP_Cadro_Aluminiumrahmensystem.zip"
const SLIDING = "STEP_Schiebetuersysteme.zip"
const FOLDING = "STEP_Falttuersysteme.zip"

function open(name: string) {
  const bytes = new Uint8Array(readFileSync(zip(name)))
  const index = listZip(bytes)
  const base = name.replace(/\.zip$/i, "")
  const articles = groupHettich(index.map((e) => ({ path: `${base}/${e.name}`, kind: hettichFileKind(e.name), size: e.size })))
  const article = (art: string) => articles.find((a) => a.article === art)!
  const propose = async (a: HettichArticle): Promise<HardwareProposal> => {
    const step = a.files.find((f) => f.kind === "step")!
    const e = index.find((x) => `${base}/${x.name}` === step.path)!
    return proposeArticle(a, stepFeatures(new TextDecoder("latin1").decode(await readZipEntry(bytes, e))))
  }
  return { articles, article, propose }
}

const count = (as: HettichArticle[]) => {
  const c: Record<string, number> = {}
  for (const a of as) c[a.kind] = (c[a.kind] ?? 0) + 1
  return c
}
const dist = (p: HardwareProposal) => (p.holes.length === 2 ? Math.abs(p.holes[1]!.u - p.holes[0]!.u) : 0)

describe.skipIf(!has(GRIFFE))("tiradors (STEP_Griffe.zip)", () => {
  const z = has(GRIFFE) ? open(GRIFFE) : null!

  it("tots els articles es poden importar: tiradors i els accessoris, només 3D; cap «carpeta desconeguda»", () => {
    expect(z.articles.length).toBeGreaterThan(700)
    expect(count(z.articles)).toEqual({ handle: z.articles.length - 5, model: 5 })
    expect(z.articles.every((a) => a.category === "handle")).toBe(true)
    expect(z.articles.some((a) => /desconeguda/i.test(`${a.plan} ${a.reason ?? ""}`))).toBe(false)
    expect(z.article("115001")).toMatchObject({ label: "Tirador Classic 115001", group: "Classic", plan: "Tirador · distància dels forats del STEP" })
    expect(z.article("9086698")).toMatchObject({ kind: "handle", label: "Tirador Touch-in 9086698" })
  })

  it("distància entre forats del STEP (a la de catàleg) i forat passant al front", async () => {
    const cases: [string, number, number][] = [
      ["115001", 160, 5], // Classic, M4
      ["9070102", 96, 5],
      ["115147", 128, 6], // Modern, M5 → Ø6
      ["9113674", 96, 5], // 4 forats: 96 (i 128)
      ["9064670", 360, 5], // 3 forats: el parell centrat
      ["9132268", 128, 5], // forats que comencen 2,8 mm endins
    ]
    for (const [art, d, through] of cases) {
      const p = await z.propose(z.article(art))
      expect([art, p.kind, dist(p), p.holes.map((h) => h.d)]).toEqual([art, "handle", d, [through, through]])
    }
    expect((await z.propose(z.article("9113674"))).notes.join(" ")).toMatch(/128 mm/)
    expect(proposalPlan(await z.propose(z.article("115001")))).toBe("Tirador · 160 mm")
  })

  it("un pom: un sol forat al centre", async () => {
    const p = await z.propose(z.article("115158"))
    expect(p.kind).toBe("handle")
    expect(p.holes).toHaveLength(1)
    expect(proposalPlan(p)).toBe("Pom · 1 forat")
  })

  it("sense patró de dos forats (perfils, fitxers que no es llegeixen): només 3D, mai cap forat", async () => {
    for (const art of ["9131455", "9071053"]) {
      const p = await z.propose(z.article(art))
      expect(p.kind).toBe("model")
      expect(p.holes).toEqual([])
      expect(proposalPlan(p)).toMatch(/^Només 3D/)
    }
  })

  it("de tot el ZIP, la majoria donen la distància; cap distància absurda", async () => {
    const res = { handle: 0, knob: 0, model: 0 }
    for (const a of z.articles) {
      if (a.kind !== "handle") continue
      const p = await z.propose(a)
      if (p.kind === "model") res.model++
      else if (p.holes.length === 1) res.knob++
      else {
        res.handle++
        expect(dist(p)).toBeGreaterThanOrEqual(16)
        expect(dist(p)).toBeLessThanOrEqual(2000)
      }
    }
    expect(res.handle).toBeGreaterThan(550)
    expect(res.knob).toBeGreaterThan(50)
    expect(res.model).toBeLessThan(100)
  })

  it("un tirador real confirmat, a una porta i a un calaix: els forats a la seva distància", async () => {
    const a = z.article("9070102")
    const item = setConfirmed(articleItem(await z.propose(a), a, DEFAULT_HARDWARE_KIT, { id: "hw-r", files: [] }), true)
    const base = defaultModule("m", "x", { width: 500, height: 720, depth: 560 })
    const cut = (p: Panel) => (p.cutouts ?? []).filter((c): c is Extract<NonNullable<Panel["cutouts"]>[number], { kind: "circle" }> => c.kind === "circle" && c.tag === "handle")
    for (const front of [{ kind: "door", mode: "single", hinge: "right", handle: item }, { kind: "drawers", n: 2, heights: ["auto", "auto"], handle: item }] as NonNullable<Zone["front"]>[]) {
      const b = buildModule({ ...base, root: { id: "r", front } as Zone })
      for (const p of b.panels.filter((x) => x.role === "door" || x.role === "drawerFront")) {
        const hs = cut(p)
        expect(hs).toHaveLength(2)
        expect(Math.hypot(hs[1]!.x - hs[0]!.x, hs[1]!.y - hs[0]!.y)).toBeCloseTo(96)
      }
    }
  })
})

describe.skipIf(!has(LEGS))("potes i taules (STEP_Tischgestelle_…zip)", () => {
  const z = has(LEGS) ? open(LEGS) : null!

  it("potes de moble i de taula; estructures i guies de taula, només 3D; electrònica i accessoris, «Accessori»", () => {
    expect(z.article("1225")).toMatchObject({ kind: "leg", category: "leg", label: "Pota d'acer 1225" })
    expect(z.article("45084")).toMatchObject({ kind: "leg", category: "leg" })
    expect(z.article("46048")).toMatchObject({ kind: "leg", category: "leg", label: "Pota de taula 46048" })
    expect(z.article("48443")).toMatchObject({ kind: "model", category: "table" })
    expect(z.article("45823")).toMatchObject({ kind: "model", category: "table" })
    expect(z.article("9079740")).toMatchObject({ kind: "model", category: "table", label: expect.stringMatching(/^Guia de taula/) })
    expect(z.article("9309936")).toMatchObject({ kind: "model", category: "misc", label: expect.stringMatching(/^Accessori/) })
    expect(z.article("9309797")).toMatchObject({ kind: "model", category: "misc" })
    expect(count(z.articles)).toEqual({ leg: 71, model: 106 })
  })

  it("pota d'acer 1225: quatre forats a ±22,5 de l'eix → pilots Ø2,5 × 12", async () => {
    const p = await z.propose(z.article("1225"))
    expect(p.kind).toBe("leg")
    expect(p.holes.map((h) => [Math.abs(h.u), Math.abs(h.v), h.d, h.depth])).toEqual(Array(4).fill([22.5, 22.5, 2.5, 12]))
    // n cap a la pota (avall del fitxer) i la caixa: la pota fa 250 mm.
    expect(p.frame.n.map((x) => x + 0)).toEqual([0, 0, -1])
    expect(p.bbox.max[2]).toBeCloseTo(250)
  })

  it("pota d'alumini 45084: els set forats de la placa; una estructura de 32 forats, només 3D", async () => {
    expect((await z.propose(z.article("45084"))).holes).toHaveLength(7)
    const frame = await z.propose(z.article("70147"))
    expect(frame.kind).toBe("model")
  })
})

describe.skipIf(!has(CADRO))("Cadro (STEP_Cadro_Aluminiumrahmensystem.zip)", () => {
  it("marc d'alumini: tot només 3D", () => {
    const z = open(CADRO)
    expect(z.articles.length).toBe(70)
    expect(z.articles.every((a) => a.kind === "model" && a.category === "profile" && a.label.startsWith("Marc d'alumini (Cadro)"))).toBe(true)
  })
})

describe.skipIf(!has(SLIDING) && !has(FOLDING))("portes corredisses i plegables", () => {
  it("tot només 3D, a «Portes corredisses i plegables»", () => {
    for (const [name, noun] of [[SLIDING, "Porta corredissa"], [FOLDING, "Porta plegable"]] as const) {
      if (!has(name)) continue
      const z = open(name)
      expect(z.articles.length).toBeGreaterThan(100)
      expect(z.articles.every((a) => a.kind === "model" && a.category === "door-system")).toBe(true)
      expect(z.articles.filter((a) => a.label.startsWith(noun)).length).toBeGreaterThan(z.articles.length * 0.9)
    }
  })
})
