import { describe, expect, it } from "vitest"
import { applySettingsToModule, compositionDims, emptyModule, normalizeComposition, repairComposition, visibleModule, zoneBounds, type Composition } from "../model"
import { DEFAULT_SETTINGS } from "../model/settings"
import { buildComposition } from "./buildComposition"
import { toCutList } from "../cutlist/toCutList"
import { nest } from "../nesting/nest"
import { toDxf } from "../export/dxf"
import { buildMobleFile, mobleToJson, parseMobleFile } from "../file/mobleFile"

/** Els documents nous (per decisió de l'usuari: «que no fiqui res»). */
const EMPTY: Composition[] = [
  { kind: "moble", modules: [], references: [] },
  { kind: "taula", modules: [], references: [] },
  { kind: "objecte", modules: [], references: [], parts: [] },
]

describe("mobles i objectes amb 0 mòduls", () => {
  it("es construeixen sense peces ni avisos, i el llistat, el nesting i el DXF no fallen", () => {
    for (const c of EMPTY) {
      const b = buildComposition(c)
      expect([b.panels.length, b.warnings.length, b.modules.length, b.extras.length], c.kind).toEqual([0, 0, 0, 0])
      expect(toCutList(b.panels).items).toEqual([])
      expect(nest(b.panels).boards).toEqual([])
      expect(() => toDxf(b.panels)).not.toThrow()
    }
  })
  it("es llegeixen i es desen igual (reparació, normalització i .moble)", () => {
    for (const c of EMPTY) {
      expect(repairComposition(c).composition?.modules).toEqual([])
      expect(normalizeComposition(c).modules).toEqual([])
      const back = parseMobleFile(mobleToJson(buildMobleFile({ name: "Buit", composition: c, references: [] })))
      expect(back.ok && back.file.project.composition.modules).toEqual([])
    }
  })
  it("les mides de la targeta són zero", () => {
    expect(compositionDims({ kind: "moble", modules: [], references: [] })).toBe("0 × 0 × 0")
  })
})

describe("mòdul nou del + de «Mòduls»", () => {
  const m = applySettingsToModule(DEFAULT_SETTINGS, emptyModule("m1", "Mòdul 1"))
  it("és el que es va deixar preparat: 600 × 100 × 560, directe a terra, sense laterals, tapa ni fons, obert", () => {
    const c = m.carcass
    expect([c.width, c.height, c.depth, c.base, c.back, c.top, c.sides]).toEqual([600, 100, 560, { kind: "none" }, "none", { kind: "none" }, { left: false, right: false }])
    expect(m.root.front).toBeUndefined()
    expect(m.root.shelves?.n).toBe(0)
    // Material, gruix i folgances de Preferències.
    expect([c.material, c.thickness, c.backMaterial]).toEqual([DEFAULT_SETTINGS.defaults.material, DEFAULT_SETTINGS.defaults.thickness, DEFAULT_SETTINGS.defaults.backMaterial])
  })
  it("només fa la base; sense on aguantar-los, cap prestatge ni filera ni avís", () => {
    const b = buildComposition({ kind: "moble", modules: [m], references: [] })
    expect(b.panels.map((p) => p.role)).toEqual(["bottom"])
    expect(b.warnings).toEqual([])
    expect(visibleModule(m).root.shelves).toBeUndefined()
    expect(zoneBounds(m, m.root.id)).toEqual({ left: false, right: false, bottom: true, top: false, noBase: false, noTop: true })
  })
})
