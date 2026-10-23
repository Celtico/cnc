import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { BUILTIN_TEMPLATES } from "../model"
import { mutate, rng } from "./fuzz"
import { buildMobleFile, mobleToJson, parseMobleFile } from "./mobleFile"

/**
 * Fitxers `.moble` malmesos a l'atzar (un camp esborrat, d'un altre tipus, buit, negatiu, enorme…): obrir-los mai llança, i
 * el que s'obre es construeix sense llançar. Llavor fixa: el mateix cada cop.
 */
// Més casos o una altra llavor: FUZZ_N=4000 FUZZ_SEED=7 (així es van trobar les frontisses i el System 32 sense límit).
const N = Number(process.env.FUZZ_N ?? 200)

describe("fitxers .moble malmesos", () => {
  const bases = BUILTIN_TEMPLATES.slice(0, 6).map((t) => JSON.parse(mobleToJson(buildMobleFile({ name: t.name, composition: t.make(), references: [] }))) as unknown)

  it(`${N} fitxers a l'atzar: cap error en obrir-los ni en construir-los`, () => {
    const rand = rng(Number(process.env.FUZZ_SEED ?? 20261022))
    const failures: string[] = []
    for (let i = 0; i < N; i++) {
      const bad = mutate(bases[i % bases.length], rand, ["project", "composition"])
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
