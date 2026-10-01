import { describe, expect, it } from "vitest"
import { COLLECTION_PIECES, CompositionSchema, FURNITURE_COLLECTIONS, storeBuilders as B } from "../model"
import { buildComposition } from "./buildComposition"

// Els mateixos avisos que el catàleg de botiga: un disseny mal fet.
const BAD = ["layout", "collision", "ref-cut", "door-too-wide", "door-too-tall", "shelf-span", "drawer-no-slide", "hole-clash", "no-side", "rail", "hollow-thin", "cable-hole", "invalid-part", "hinge", "grille-open-ratio"]

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
      // Parets buides massa primes: es fan massisses (el disseny no és el que diu la fitxa).
      expect(b.warnings.filter((w) => w.code === "hollow" && /massisses/.test(w.message)).map((w) => w.message)).toEqual([])
      expect(b.panels.length + b.extras.length).toBeGreaterThan(0)
    })
  it("noms de peça únics (la targeta en mostra el nom)", () => {
    expect(new Set(COLLECTION_PIECES.map((t) => t.name)).size).toBe(COLLECTION_PIECES.length)
  })
})

describe("fronts sense tirador (push)", () => {
  const zone = B.v(B.auto(3), [B.door("left", 1), B.drawers(2), B.flap("down")])
  const fronts = (push: boolean) => buildComposition(B.one(B.box("Moble", { w: 1500, h: 700, d: 450, mat: "Roure massís / xapat", push }, zone))).panels.filter((p) => p.role === "door" || p.role === "drawerFront" || p.role === "flap")
  it("per defecte, tirador de barra: dos forats Ø5 a cada front", () => {
    for (const p of fronts(false)) expect((p.cutouts ?? []).filter((c) => c.kind === "circle" && c.tag === "handle")).toHaveLength(2)
  })
  it("sense tirador: cap forat, front marcat i un sol avís del ferratge push", () => {
    const fs = fronts(true)
    expect(fs.length).toBe(4)
    for (const p of fs) {
      expect((p.cutouts ?? []).some((c) => c.kind === "circle" && c.tag === "handle")).toBe(false)
      expect(p.push).toBe(true)
    }
    const b = buildComposition(B.one(B.box("Moble", { w: 1500, h: 700, d: 450, mat: "Roure massís / xapat", push: true }, zone)))
    expect(b.warnings.filter((w) => w.code === "push")).toHaveLength(1)
  })
})
