import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS } from "../../core/model/settings"
import { refFromPreset } from "./addElements"
import type { Composition } from "../../core/model"

const comp = (names: string[] = []) => ({ references: names.map((name, i) => ({ id: `r${i}`, name, w: 1, h: 1, d: 1, x: 0, y: 0, z: 0 })) }) as unknown as Composition

describe("objectes de referència de Preferències (+ de l'arbre)", () => {
  it("de paret: les mides de la cara, enganxat a la paret si no en té distància; sense fondària, 5 mm", () => {
    const r = refFromPreset(comp(), { id: "a", name: "A4", w: 210, h: 297, plane: "wall", wallOffset: 0 })
    expect([r.w, r.h, r.d, r.z, r.onWall]).toEqual([210, 297, 5, 0, true])
    const t = refFromPreset(comp(), { id: "b", name: "Tele", w: 1230, h: 710, d: 60, plane: "wall", wallOffset: 40 })
    expect([t.d, t.z, t.onWall]).toEqual([60, 40, undefined])
  })
  it("de terra: estirat a terra", () => {
    const r = refFromPreset(comp(), { id: "c", name: "Rajola", w: 600, h: 600, plane: "floor", wallOffset: 0 })
    expect([r.w, r.h, r.d, r.onFloor]).toEqual([600, 5, 600, true])
  })
  it("el nom no es repeteix", () => {
    expect(refFromPreset(comp(["A4", "A4 2"]), { id: "a", name: "A4", w: 210, h: 297, plane: "wall", wallOffset: 0 }).name).toBe("A4 3")
  })
  it("els inicials de Preferències fan objectes vàlids", () => {
    for (const p of DEFAULT_SETTINGS.references) {
      const r = refFromPreset(comp(), p)
      expect(r.w > 0 && r.h > 0 && r.d > 0, p.name).toBe(true)
    }
  })
})
