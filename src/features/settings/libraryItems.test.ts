import { describe, expect, it } from "vitest"
import { MaterialPrefSchema } from "../../core/model"
import { MATERIAL_LIBRARY } from "./libraryItems"

describe("biblioteca de materials", () => {
  it("tots són materials vàlids de preferències i amb nom únic", () => {
    for (const { group: _g, ...m } of MATERIAL_LIBRARY) expect(MaterialPrefSchema.safeParse({ ...m, id: "x" }).success, m.name).toBe(true)
    expect(new Set(MATERIAL_LIBRARY.map((m) => m.name)).size).toBe(MATERIAL_LIBRARY.length)
  })
})
