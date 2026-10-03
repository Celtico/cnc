import { describe, expect, it } from "vitest"
import { mergeSaved } from "./renderPrefs"

describe("configuració del Render desada", () => {
  it("només els valors del mateix tipus; els que falten, els de base", () => {
    const base = { bounces: 6, lamps: true, view: "garden", focal: 0 }
    expect(mergeSaved(base, { bounces: 10, lamps: "sí", view: "sea", nope: { a: 1 }, focal: Number.NaN })).toEqual({ bounces: 10, lamps: true, view: "sea", focal: 0 })
    expect(mergeSaved(base, undefined)).toBe(base)
  })
})
