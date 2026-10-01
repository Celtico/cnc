import { describe, expect, it } from "vitest"
import { COLLECTION_PIECES, CompositionSchema, FURNITURE_COLLECTIONS } from "../model"
import { buildComposition } from "./buildComposition"

// Els mateixos avisos que el catàleg de botiga: un disseny mal fet.
const BAD = ["layout", "collision", "ref-cut", "door-too-wide", "door-too-tall", "shelf-span", "drawer-no-slide", "hole-clash", "no-side", "rail", "hollow-thin", "cable-hole", "invalid-part", "hinge"]

describe("col·leccions de mobles", () => {
  it("dues col·leccions, ids únics i fitxa completa", () => {
    expect(FURNITURE_COLLECTIONS.map((c) => c.id)).toEqual(["arquitectonic", "comercial"])
    expect(new Set(COLLECTION_PIECES.map((t) => t.id)).size).toBe(COLLECTION_PIECES.length)
    for (const p of COLLECTION_PIECES) {
      const s = p.study
      for (const k of ["reference", "language", "geometry", "proportions", "materials", "finishes", "combination", "surfaces", "thickness", "hardware", "feeling", "architecture", "quality"] as const) expect(s[k], `${p.name}: ${k}`).toBeTruthy()
      for (const k of ["minimalism", "sophistication", "warmth", "functionality"] as const) expect(s[k]).toBeGreaterThanOrEqual(1)
    }
  })
  it("la col·lecció comercial es fa per famílies amb mides i acabats", () => {
    for (const p of FURNITURE_COLLECTIONS[1]!.pieces) expect(p.study.family && p.study.sizes && p.study.finishOptions, p.name).toBeTruthy()
  })
  for (const t of COLLECTION_PIECES)
    it(t.name, () => {
      const comp = t.make()
      expect(CompositionSchema.safeParse(comp).success).toBe(true)
      const b = buildComposition(comp)
      expect(b.warnings.filter((w) => BAD.includes(w.code)).map((w) => `${w.code}: ${w.message}`)).toEqual([])
      expect(b.panels.length + b.extras.length).toBeGreaterThan(0)
    })
})
