import { describe, expect, it } from "vitest"
import { applianceById, defaultModule, isApplianceModule, moduleType, setModuleAppliance, setModuleType, type Module } from "."

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
})
