import { describe, expect, it } from "vitest"
import { applySettingsToModule, compositionDims, emptyModule, normalizeComposition, repairComposition, zoneBounds, type Composition } from "../model"
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
  it("és un buc estàndard (com el «Mòdul 2» de l'usuari): 600 × 720 × 580, els dos laterals, tapa, fons en ranura, obert", () => {
    const c = m.carcass
    expect([m.type, c.width, c.height, c.depth, c.base, c.back, c.top, c.sides]).toEqual(["base", 600, 720, 580, { kind: "none" }, "groove", { kind: "full" }, { left: true, right: true }])
    expect(m.root.front).toBeUndefined()
    expect(m.root.shelves?.n).toBe(0)
    // Material, gruix i folgances de Preferències.
    expect([c.material, c.thickness, c.backMaterial]).toEqual([DEFAULT_SETTINGS.defaults.material, DEFAULT_SETTINGS.defaults.thickness, DEFAULT_SETTINGS.defaults.backMaterial])
  })
  it("fa la caixa sencera, sense prestatges ni avisos", () => {
    const b = buildComposition({ kind: "moble", modules: [m], references: [] })
    expect(b.panels.map((p) => p.role).sort()).toEqual(["back", "bottom", "side", "side", "top"])
    expect(b.warnings).toEqual([])
    expect(zoneBounds(m, m.root.id)).toMatchObject({ left: true, right: true, bottom: true, top: true })
  })
})
