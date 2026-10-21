import { describe, expect, it } from "vitest"
import { CompositionSchema, parseSettings, SLICED_GALLERY } from "../model"
import { DEFAULT_SETTINGS } from "../model/settings"
import { buildComposition } from "./buildComposition"
import { materialIssues } from "./materialIssues"

const ALL = SLICED_GALLERY.flatMap((c) => c.items)

describe("galeria Llistons", () => {
  it("cinc categories i ids únics", () => {
    expect(SLICED_GALLERY.map((c) => c.id)).toEqual(["sofas", "cadires", "bancs", "taules", "paret"])
    expect(new Set(ALL.map((t) => t.id)).size).toBe(ALL.length)
    expect(ALL.length).toBeGreaterThan(40)
  })
  for (const t of ALL)
    it(t.name, () => {
      const comp = t.make()
      expect(CompositionSchema.safeParse(comp).success).toBe(true)
      const b = buildComposition(comp)
      // Llistons de roure massís, sense avisos (ni de disseny ni de materials amb les preferències inicials).
      expect(b.warnings.map((w) => `${w.code}: ${w.message}`)).toEqual([])
      expect(materialIssues(b, comp, DEFAULT_SETTINGS.materials)).toEqual([])
      const slats = (comp.parts ?? []).filter((p) => !p.effect && p.name.startsWith("Llistó"))
      expect(slats.length).toBeGreaterThan(5)
      expect(slats.every((p) => p.material === "Roure massís")).toBe(true)
      // La forma queda amagada al grup, i les barres hi són.
      expect(comp.references.some((r) => r.shape === "mesh" && r.hidden)).toBe(true)
      expect(comp.references.filter((r) => r.shape === "cylinder").length).toBeGreaterThan(0)
    })

  it("el «Roure massís» (sense cantell) arriba a unes preferències d'abans (v52)", () => {
    const old = { ...DEFAULT_SETTINGS, version: 51, materials: DEFAULT_SETTINGS.materials.filter((m) => m.name !== "Roure massís") }
    const m = parseSettings(JSON.parse(JSON.stringify(old))).settings.materials.find((x) => x.name === "Roure massís")
    expect(m?.solid).toBe(true)
  })
})
