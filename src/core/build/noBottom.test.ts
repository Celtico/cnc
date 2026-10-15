import { describe, expect, it } from "vitest"
import { applianceById, carcassBounds, defaultModule, hasBottom, isApplianceModule, moduleApplianceCarcass, visibleModule, type Carcass, type Module } from "../model"
import { buildModule } from "./buildModule"

const mod = (c: Partial<Carcass>, root: Module["root"] = { id: "root" }): Module => ({ ...defaultModule("m", "M", c), root })
const roles = (m: Module) => buildModule(m).panels.map((p) => `${p.role}:${p.length}x${p.width}`).sort()

describe("«Sense base» (Carcass.noBottom) a qualsevol suport", () => {
  it("el `open` d'abans és el mateix que directe a terra sense base (mateixes peces i la mateixa forma visible)", () => {
    const old = mod({ base: { kind: "open" } })
    const now = mod({ base: { kind: "none" }, noBottom: true })
    expect(roles(old)).toEqual(roles(now))
    expect(visibleModule(old).carcass).toEqual(visibleModule(now).carcass)
    expect(hasBottom(old.carcass)).toBe(false)
  })

  it("penjat sense base: cap peça de baix, sense llum a sota; la resta igual", () => {
    const hung = mod({ base: { kind: "wall", height: 1450 }, underLight: {} })
    const off = mod({ base: { kind: "wall", height: 1450 }, underLight: {}, noBottom: true })
    expect(buildModule(hung).panels.some((p) => p.role === "bottom")).toBe(true)
    expect(buildModule(off).panels.some((p) => p.role === "bottom")).toBe(false)
    expect(visibleModule(off).carcass.underLight).toBeUndefined()
    expect(carcassBounds(off.carcass).noBase).toBe(true)
  })

  it("amb sòcol sense base: el sòcol hi és i l'interior comença a dalt del sòcol", () => {
    const m = mod({ base: { kind: "plinth", height: 80, setback: 30 }, noBottom: true })
    const b = buildModule(m)
    expect(b.panels.some((p) => p.role === "bottom")).toBe(false)
    expect(b.panels.some((p) => p.role === "plinth")).toBe(true)
    expect(b.layout.rects.get("root")!.y0).toBe(80)
  })

  it("amb potes, la base hi és sempre (s'hi cargolen): el «Sense base» no compta i es conserva", () => {
    const legs = mod({ base: { kind: "legs", height: 100 } })
    const off = mod({ base: { kind: "legs", height: 100 }, noBottom: true })
    expect(roles(off)).toEqual(roles(legs))
    expect(visibleModule(off).carcass).toEqual(visibleModule(legs).carcass)
  })
})

describe("la caixa que demana l'electrodomèstic (mòdul sense dividir)", () => {
  const withAppliance = (c: Partial<Carcass>, id: string): Module => mod(c, { id: "root", appliance: { hardware: applianceById(id) } })

  it("rentaplats en un mòdul sencer: només el nínxol (sense base, tapa, fons, sòcol ni potes); els valors es conserven", () => {
    const m = withAppliance({ base: { kind: "legs", height: 100 }, sides: { left: false, right: false } }, "appliance-bosch-smh6ycx02e")
    expect(isApplianceModule(m)).toBe(true)
    expect(moduleApplianceCarcass(m)!.rule).toEqual({ support: false, bottom: false, top: false, back: false, niche: true })
    const v = visibleModule(m).carcass
    expect(v.base).toEqual({ kind: "none" })
    expect(v.noBottom).toBe(true)
    expect(v.top.kind).toBe("none")
    expect(v.back).toBe("none")
    // Res de fusta de la caixa: només el front de moble.
    expect(buildModule(m).panels.map((p) => p.role)).toEqual(["flap"])
    // Els de l'usuari no es toquen (tornen si es treu l'aparell).
    expect(m.carcass.base.kind).toBe("legs")
    expect(m.carcass.top.kind).toBe("full")
  })

  it("frigorífic de columna sense dividir: els dos laterals, base i tapa fixos; el fons es tria", () => {
    const m = withAppliance({ height: 2100, sides: { left: false, right: true }, top: { kind: "none" }, back: "none" }, "appliance-bosch-kin86add0")
    const { rule } = moduleApplianceCarcass(m)!
    expect(rule).toEqual({ sides: true, bottom: true, top: true })
    const v = visibleModule(m).carcass
    expect(v.sides).toEqual({ left: true, right: true })
    expect(v.top.kind).toBe("full")
    expect(v.back).toBe("none")
  })

  it("microones al moble penjat: paret del darrere oberta (sense fons); en un altre lloc, el fons es tria", () => {
    const hung = withAppliance({ base: { kind: "wall", height: 1450 } }, "appliance-bosch-bfl7221b1")
    expect(visibleModule(hung).carcass.back).toBe("none")
    const floor = withAppliance({}, "appliance-bosch-bfl7221b1")
    expect(moduleApplianceCarcass(floor)!.rule.back).toBeUndefined()
  })

  it("la placa no ocupa el mòdul: cap part fixa", () => {
    const m = withAppliance({}, "appliance-bosch-pie631hc1e")
    expect(moduleApplianceCarcass(m)).toBeUndefined()
    expect(visibleModule(m).carcass.top.kind).toBe("full")
  })
})
