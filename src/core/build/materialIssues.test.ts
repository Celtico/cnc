import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, defaultModule, type Composition } from "../model"
import { buildComposition } from "./buildComposition"
import { materialIssues } from "./materialIssues"

const comp = (over: Parameters<typeof defaultModule>[2] = {}): Composition => ({ modules: [defaultModule("m", "M", { material: "Melamina blanca", backMaterial: "DM (fons)", backThickness: 10, ...over })], references: [] }) as Composition

describe("materials que no lliguen amb Preferències (`materialIssues`)", () => {
  it("un moble amb els materials inicials no avisa", () => {
    const c = comp()
    expect(materialIssues(buildComposition(c), c, DEFAULT_SETTINGS.materials)).toEqual([])
  })

  it("material que no hi és: un avís per nom", () => {
    const c = comp({ material: "Bedoll de Finlàndia" })
    const w = materialIssues(buildComposition(c), c, DEFAULT_SETTINGS.materials)
    expect(w.filter((x) => x.code === "unknown-material")).toHaveLength(1)
    expect(w[0]!.message).toBe("El material «Bedoll de Finlàndia» no és a Preferències: es veu amb un color per defecte i al taller sortirà amb aquest nom.")
    // D'un material que no hi és no se'n mira el gruix.
    expect(w.some((x) => x.code === "thickness-not-listed")).toBe(false)
  })

  it("gruix que no és dels del material: un avís per material i gruix", () => {
    const c = comp({ thickness: 18 })
    const w = materialIssues(buildComposition(c), c, DEFAULT_SETTINGS.materials).filter((x) => x.code === "thickness-not-listed")
    expect(w.map((x) => x.message)).toEqual(["El gruix 18 mm no és dels gruixos de «Melamina blanca» (10 · 16 · 19 · 30 mm)."])
  })

  it("també els objectes de referència amb material", () => {
    const c = { ...comp(), references: [{ id: "r", name: "Caixa", shape: "box", x: 0, y: 0, z: 0, w: 100, h: 100, d: 100, effect: "obstacle", material: "Marbre rosa" }] } as Composition
    expect(materialIssues(buildComposition(c), c, DEFAULT_SETTINGS.materials).map((x) => x.code)).toEqual(["unknown-material"])
  })
})

describe("el catàleg amb les preferències inicials", () => {
  it("cap plantilla avisa de materials o gruixos", async () => {
    const { catalogCorpus } = await import("./testCorpus")
    const { buildComposition } = await import("./buildComposition")
    const { DEFAULT_SETTINGS } = await import("../model/settings")
    const bad: string[] = []
    for (const c of catalogCorpus()) {
      const comp = c.make()
      const iss = materialIssues(buildComposition(comp), comp, DEFAULT_SETTINGS.materials)
      if (iss.length) bad.push(`${c.id}: ${iss.map((i) => i.message).join(" | ")}`)
    }
    expect(bad).toEqual([])
  })
})
