import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { applianceById, defaultModule, emptyModule, isApplianceModule, moduleType, setModuleAppliance, setModuleType, withMobleMaterials, type Module } from "."

const base = (h = 770): Module => defaultModule("m", "M", { width: 600, height: h, depth: 560 })

describe("tipus del mòdul", () => {
  it("es dedueix: baix, columna (per l'alçada), penjat i electrodomèstic", () => {
    expect(moduleType(base())).toBe("base")
    expect(moduleType(base(2100))).toBe("tall")
    const hung = base()
    expect(moduleType({ ...hung, carcass: { ...hung.carcass, base: { kind: "wall", height: 1450 } } })).toBe("wall")
    expect(moduleType(setModuleAppliance(base(), applianceById("appliance-bosch-smh6ycx02e"), 0))).toBe("appliance")
  })

  it("Baix ↔ Columna: l'alçada per defecte si la que té no hi escau", () => {
    const t = setModuleType(base(), "tall", 0)
    expect([moduleType(t), t.carcass.height]).toEqual(["tall", 2100])
    const b = setModuleType(t, "base", 0)
    expect([moduleType(b), b.carcass.height]).toEqual(["base", 770])
  })

  it("Penjat: a la paret; i tornar a Baix l'arramba a la paret", () => {
    const w = setModuleType(base(), "wall", 0)
    expect(w.carcass.base.kind).toBe("wall")
    const b = setModuleType(w, "base", 0)
    expect(b.carcass.base.kind).not.toBe("wall")
    expect(moduleType(b)).toBe("base")
  })

  it("Electrodomèstic: l'aparell fa el nínxol (sense laterals); deixar-ho el treu", () => {
    const e = setModuleType(base(), "appliance", 0)
    expect([moduleType(e), isApplianceModule(e)]).toEqual(["appliance", false])
    const dw = setModuleAppliance(e, applianceById("appliance-bosch-smh6ycx02e"), 0)
    expect(isApplianceModule(dw)).toBe(true)
    expect(dw.carcass.sides).toEqual({ left: false, right: false })
    const back = setModuleType(dw, "base", 0)
    expect([moduleType(back), isApplianceModule(back), back.root.appliance]).toEqual(["base", false, undefined])
  })

  it("la placa i la campana també són Electrodomèstic (el Baix i el Penjat no en porten); la campana penja el mòdul", () => {
    const hob = setModuleAppliance(base(), applianceById("appliance-bosch-pie631hc1e"), 0)
    expect([moduleType(hob), isApplianceModule(hob)]).toEqual(["appliance", false])
    expect(setModuleType(hob, "base", 0).root.appliance).toBeUndefined()
    const hood = setModuleAppliance(base(), applianceById("appliance-bosch-dln57pc60"), 0)
    expect(hood.carcass.base.kind).toBe("wall")
    expect(moduleType(hood)).toBe("appliance")
  })

  it("el rentaplats en un buc sobre potes: el nínxol va de terra fins on arribava el buc (720 + 100 = 820), sense avís", () => {
    const e = emptyModule("m", "M")
    const dw = setModuleAppliance({ ...e, carcass: { ...e.carcass, base: { kind: "legs", height: 100 } } }, applianceById("appliance-bosch-smh6ycx02e"), 0)
    expect(dw.carcass.height).toBe(820)
    // Tornar a triar l'aparell (o un altre) no l'aixeca cada vegada.
    expect(setModuleAppliance(dw, applianceById("appliance-bosch-smh6ycx02e"), 0).carcass.height).toBe(820)
    const b = buildComposition({ modules: [dw], references: [], support: { kind: "plinth", height: 100, plinth: { setback: 24 } } })
    expect(b.warnings.filter((w) => w.code === "appliance")).toEqual([])
    // Va directe a terra (no sobre les potes del moble: si no, s'aixecaria).
    expect(b.modules[0]!.y).toBe(0)
  })

  it("un mòdul nou pren els materials del moble (el darrer de terra)", () => {
    const old = base()
    const dark = { ...old, carcass: { ...old.carcass, material: "MDF lacat antracita", frontMaterial: "Roure", thickness: 19 } }
    const n = withMobleMaterials(emptyModule("n", "N"), [dark])
    expect([n.carcass.material, n.carcass.frontMaterial]).toEqual(["MDF lacat antracita", "Roure"])
    expect(withMobleMaterials(emptyModule("n", "N"), [])).toEqual(emptyModule("n", "N"))
  })
})

describe("Tipus de l'inspector: Moble o Electrodomèstic", () => {
  it("Moble treu l'aparell i deixa l'alçada i on va; Electrodomèstic el marca", async () => {
    const { setModuleKind } = await import(".")
    const col = { ...defaultModule("c", "c"), carcass: { ...defaultModule("c", "c").carcass, height: 2100 } }
    const e = setModuleKind(col, "appliance", 0)
    expect(moduleType(e)).toBe("appliance")
    const m = setModuleKind(e, "moble", 0)
    expect(moduleType(m)).toBe("tall")
    expect(m.carcass.height).toBe(2100)
    expect(setModuleKind(col, "moble", 0)).toBe(col)
  })
})
