import { describe, expect, it } from "vitest"
import { OBJECT_TEMPLATES } from "./ambient"
import { OBJECT_CATEGORIES, objectCategory } from "./objectCategories"

describe("categories dels objectes", () => {
  it("cada objecte del catàleg té una categoria pròpia (només el bloc genèric va a «Blocs»)", () => {
    const blocs = OBJECT_TEMPLATES.filter((t) => objectCategory(t) === "blocs").map((t) => t.id)
    expect(blocs).toEqual(["object-box"])
    for (const c of OBJECT_CATEGORIES) expect(OBJECT_TEMPLATES.some((t) => objectCategory(t) === c.id)).toBe(true)
  })
})
