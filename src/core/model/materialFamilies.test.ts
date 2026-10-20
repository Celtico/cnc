import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS } from "./settings"
import { MATERIAL_CATEGORIES, materialCategory, withCategory } from "./settingsSchema"
import { MATERIAL_FAMILIES, colorTone, familyGroups, materialFamily } from "./materialFamilies"

const byName = (name: string) => DEFAULT_SETTINGS.materials.find((m) => m.name === name)!

describe("materialFamilies", () => {
  it("els materials inicials tenen una subfamília pròpia (cap a «Altres»)", () => {
    for (const m of DEFAULT_SETTINGS.materials) {
      const f = materialFamily(m)
      if (materialCategory(m) === "back") expect(f).toBeNull()
      else expect(f, m.name).not.toBe("other")
    }
  })

  it("agrupa pel nom i per l'acabat", () => {
    expect(materialFamily(byName("Melamina roure"))).toBe("melamine")
    expect(materialFamily(byName("MDF lacat antracita"))).toBe("lacquer")
    expect(materialFamily(byName("Noguera xapada"))).toBe("wood")
    expect(materialFamily(byName("Pedra de paret"))).toBe("stone")
    expect(materialFamily(byName("Electrodomèstic inox"))).toBe("appliance")
    expect(materialFamily(byName("Bombeta"))).toBe("light")
    expect(materialFamily(byName("Fulles de pi"))).toBe("plant")
  })

  it("els Corian, pel to", () => {
    expect(colorTone("#f8f7f0")).toBe("white")
    expect(colorTone("#ece1c5")).toBe("beige")
    expect(colorTone("#979494")).toBe("gray")
    expect(colorTone("#9e8978")).toBe("brown")
    expect(colorTone("#110f0f")).toBe("dark")
    expect(colorTone("#001b52")).toBe("color")
    expect(colorTone(undefined)).toBe("other")
  })

  it("la triada mana si és de la seva categoria; en canviar de categoria es torna a deduir", () => {
    const m = { ...byName("Melamina gris"), family: "lacquer" }
    expect(materialFamily(m)).toBe("lacquer")
    expect(materialFamily({ ...m, family: "metal" })).toBe("melamine")
    expect(withCategory(m, "sim").family).toBeUndefined()
  })

  it("els Fons es mostren plans i una sola subfamília no fa grup", () => {
    const backs = DEFAULT_SETTINGS.materials.filter((m) => materialCategory(m) === "back")
    expect(familyGroups("back", backs)).toEqual([])
    const lacquers = DEFAULT_SETTINGS.materials.filter((m) => /lacat/i.test(m.name) && materialCategory(m) === "board")
    expect(familyGroups("board", lacquers)).toEqual([])
  })

  it("cada categoria amb subfamílies les té totes amb ids únics", () => {
    for (const c of MATERIAL_CATEGORIES) {
      const ids = MATERIAL_FAMILIES[c.id].map((f) => f.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
