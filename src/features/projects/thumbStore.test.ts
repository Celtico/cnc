import { describe, expect, it } from "vitest"
import { AMBIENT_TEMPLATES, BUILTIN_TEMPLATES, OBJECT_TEMPLATES, TV_LIVING_ROOM } from "../../core/model"
import { MAG_FURNITURE } from "../../core/model/magFurniture"
import { templatePrint } from "./thumbStore"

const allTemplates = () => [...BUILTIN_TEMPLATES, TV_LIVING_ROOM, ...OBJECT_TEMPLATES, ...MAG_FURNITURE]

describe("empremta de les miniatures de plantilla", () => {
  it("és la mateixa cada cop que es fa la plantilla (ids nous) i diferent entre plantilles", () => {
    const tpls = allTemplates()
    const prints = tpls.map((t) => templatePrint(t.make()))
    expect(tpls.map((t) => templatePrint(t.make()))).toEqual(prints)
    expect(new Set(prints).size).toBeGreaterThan(tpls.length * 0.9)
    expect(templatePrint(AMBIENT_TEMPLATES[0])).toBe(templatePrint(AMBIENT_TEMPLATES[0]))
  })
  it("canvia si canvia una mida", () => {
    const c = allTemplates()[0]!.make()
    const m = c.modules[0]!
    expect(templatePrint({ ...c, modules: [{ ...m, carcass: { ...m.carcass, width: m.carcass.width + 1 } }] })).not.toBe(templatePrint(c))
  })
})
