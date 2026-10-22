import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { BUILTIN_TEMPLATES } from "../model"
import { buildMobleFile, mobleToJson, parseMobleFile } from "./mobleFile"

/**
 * Fitxers `.moble` malmesos a l'atzar (un camp esborrat, d'un altre tipus, buit, negatiu, enorme…): obrir-los mai llança, i
 * el que s'obre es construeix sense llançar. Llavor fixa: el mateix cada cop.
 */
// Més casos o una altra llavor: FUZZ_N=4000 FUZZ_SEED=7 (així es van trobar les frontisses i el System 32 sense límit).
const N = Number(process.env.FUZZ_N ?? 200)

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Json = unknown
const WEIRD: Json[] = [null, undefined, 0, -1, -500, 1e9, Number.NaN, "", "x", true, [], {}, [1, 2], { a: 1 }, 0.0001, 99999]

/** Tots els camins (objectes i llistes) del JSON. */
function paths(v: Json, at: (string | number)[] = [], out: (string | number)[][] = []): (string | number)[][] {
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, Json>)) {
      const p = [...at, Array.isArray(v) ? Number(k) : k]
      out.push(p)
      paths(x, p, out)
    }
  }
  return out
}

function mutate(root: Json, rand: () => number): Json {
  const copy = structuredClone(root) as Record<string, Json>
  const all = paths(copy).filter((p) => p[0] === "project" && p[1] === "composition")
  const n = 1 + Math.floor(rand() * 3)
  for (let i = 0; i < n && all.length; i++) {
    const p = all[Math.floor(rand() * all.length)]!
    let parent: Json = copy
    for (const k of p.slice(0, -1)) parent = (parent as Record<string | number, Json>)?.[k]
    if (!parent || typeof parent !== "object") continue
    const key = p.at(-1)!
    const obj = parent as Record<string | number, Json>
    const r = rand()
    if (r < 0.3) {
      if (Array.isArray(obj)) obj.splice(Number(key), 1)
      else delete obj[key]
    } else if (r < 0.5 && typeof obj[key] === "number") obj[key] = (obj[key] as number) * (rand() < 0.5 ? -1 : 50)
    else obj[key] = WEIRD[Math.floor(rand() * WEIRD.length)]
  }
  return copy
}

describe("fitxers .moble malmesos", () => {
  const bases = BUILTIN_TEMPLATES.slice(0, 6).map((t) => JSON.parse(mobleToJson(buildMobleFile({ name: t.name, composition: t.make(), references: [] }))) as Json)

  it(`${N} fitxers a l'atzar: cap error en obrir-los ni en construir-los`, () => {
    const rand = rng(Number(process.env.FUZZ_SEED ?? 20261022))
    const failures: string[] = []
    for (let i = 0; i < N; i++) {
      const bad = mutate(bases[i % bases.length], rand)
      const text = JSON.stringify(bad)
      try {
        const res = parseMobleFile(text)
        if (res.ok) buildComposition(res.file.project.composition)
      } catch (e) {
        failures.push(`#${i}: ${(e as Error).message} ${(e as Error).stack?.split("\n")[1]?.trim() ?? ""}`)
      }
    }
    expect(failures.slice(0, 10)).toEqual([])
  }, 600_000)

  /** Un moble de la llista amb un canvi a cada mòdul (sobre el JSON del fitxer), obert i construït. */
  const openWith = (edit: (m: Record<string, any>) => void) => {
    const file = structuredClone(bases[0]) as { project: { composition: { modules: Record<string, any>[] } } }
    for (const m of file.project.composition.modules) edit(m)
    const res = parseMobleFile(JSON.stringify(file))
    if (!res.ok) throw new Error(res.error)
    return buildComposition(res.file.project.composition)
  }

  it("una regla de frontisses de mil milions: com a molt 20 per porta (abans es penjava)", () => {
    let hit = 0
    const b = openWith((m) => {
      if (!m.hardware?.hinge?.count) return
      m.hardware.hinge.count = { steps: [{ upTo: 100000, n: 1e9 }], else: 1e9 }
      hit++
    })
    expect(hit).toBeGreaterThan(0)
    const doors = new Map<string, number>()
    for (const p of b.panels) doors.set(p.id, p.holes.filter((h) => h.tag === "hinge").length)
    expect(Math.max(0, ...doors.values())).toBeLessThanOrEqual(20 * 4)
  })

  it("un pas de System 32 negatiu o zero: el de sempre, 32 (abans es penjava)", () => {
    for (const pitch of [-500, 0, 0.0001]) {
      let hit = 0
      const b = openWith((m) => {
        if (!m.hardware?.system32?.params) return
        m.hardware.system32.params.pitch = pitch
        hit++
      })
      expect(hit).toBeGreaterThan(0)
      expect(b.panels.length).toBeGreaterThan(0)
    }
  })
})
