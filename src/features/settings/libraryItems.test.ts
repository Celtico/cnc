import { describe, expect, it } from "vitest"
import { BUILTIN_MATERIALS, MaterialPrefSchema } from "../../core/model"
import { MATERIAL_LIBRARY, ownedMaterial } from "./libraryItems"

describe("biblioteca de materials", () => {
  it("tots són materials vàlids de preferències i amb nom únic", () => {
    for (const { group: _g, ...m } of MATERIAL_LIBRARY) expect(MaterialPrefSchema.safeParse({ ...m, id: "x" }).success, m.name).toBe(true)
    expect(new Set(MATERIAL_LIBRARY.map((m) => m.name)).size).toBe(MATERIAL_LIBRARY.length)
  })

  it("«Ja el tens»: pel nom (sense majúscules ni espais) o per l'acabat", () => {
    const item = (n: string) => MATERIAL_LIBRARY.find((m) => m.name === n)!
    // «Roure natural» fa servir la mateixa foto que «Melamina roure» i «Roure massís / xapat» (inicials).
    expect(ownedMaterial(item("Roure natural"), BUILTIN_MATERIALS)?.finish).toEqual(item("Roure natural").finish)
    expect(ownedMaterial({ name: " marbre  BLANC ", finish: { kind: "color", color: "#123456" } }, [{ ...BUILTIN_MATERIALS[0]!, name: "Marbre blanc" }])?.name).toBe("Marbre blanc")
    expect(ownedMaterial(item("Coure martellejat"), BUILTIN_MATERIALS)).toBeUndefined()
  })
})
