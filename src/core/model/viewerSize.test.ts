import { describe, expect, it } from "vitest"
import { defaultModule, isEmptyComposition, viewerSize, type Composition } from "."

describe("document buit (moble o objecte nou)", () => {
  it("sense mòduls, peces, objectes ni models és buit i la mida no és negativa", () => {
    const c: Composition = { kind: "moble", modules: [], references: [] }
    expect(isEmptyComposition(c)).toBe(true)
    expect(viewerSize(c)).toEqual({ width: 1, height: 1, depth: 1 })
    expect(isEmptyComposition({ kind: "objecte", modules: [], references: [], parts: [] })).toBe(true)
  })
  it("amb qualsevol element ja no ho és; els mòduls d'un objecte no compten", () => {
    expect(isEmptyComposition({ kind: "moble", modules: [defaultModule("m", "M")], references: [] })).toBe(false)
    expect(isEmptyComposition({ kind: "objecte", modules: [defaultModule("m", "M")], references: [] })).toBe(true)
    expect(isEmptyComposition({ modules: [], references: [{ id: "r", name: "R", x: 0, y: 0, z: 0, w: 1, h: 1, d: 1 }] })).toBe(false)
  })
})
