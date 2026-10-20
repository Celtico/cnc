import { describe, expect, it } from "vitest"
import { applianceById, carcassBounds, defaultModule, hasBottom, isApplianceModule, moduleApplianceCarcass, setModuleAppliance, visibleModule, type Carcass, type Module } from "../model"
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

describe("la caixa que demana l'electrodomèstic (cas 12 del model únic: drecera un cop, després normal)", () => {
  const withAppliance = (c: Partial<Carcass>, id: string): Module => mod(c, { id: "root", appliance: { hardware: applianceById(id) } })
  const picked = (c: Partial<Carcass>, id: string): Module => setModuleAppliance(mod(c), applianceById(id), 0)

  it("rentaplats en un mòdul sencer: en triar-lo, la caixa queda sense base, tapa, fons ni potes (directe a terra)", () => {
    const m = picked({ base: { kind: "legs", height: 100 }, sides: { left: false, right: false } }, "appliance-bosch-smh6ycx02e")
    expect(isApplianceModule(m)).toBe(true)
    expect(m.carcass.base).toEqual({ kind: "none" })
    expect(m.carcass.noBottom).toBe(true)
    expect(m.carcass.top.kind).toBe("none")
    expect(m.carcass.back).toBe("none")
    // Res de fusta de la caixa: només el front de moble.
    expect(buildModule(m).panels.map((p) => p.role)).toEqual(["flap"])
  })

  it("després són opcions normals: l'aparell no canvia la caixa (una tapa posada a mà es fa)", () => {
    const m = picked({}, "appliance-bosch-smh6ycx02e")
    const withTop = { ...m, carcass: { ...m.carcass, top: { kind: "full" as const } } }
    expect(visibleModule(withTop).carcass.top.kind).toBe("full")
    expect(buildModule(withTop).panels.some((p) => p.role === "top")).toBe(true)
  })

  it("frigorífic de columna: en triar-lo, els dos laterals, base i tapa; el fons es queda com era", () => {
    const m = picked({ height: 2100, sides: { left: false, right: true }, top: { kind: "none" }, back: "none" }, "appliance-bosch-kin86add0")
    expect(m.carcass.sides).toEqual({ left: true, right: true })
    expect(m.carcass.top.kind).toBe("full")
    expect(m.carcass.back).toBe("none")
  })

  it("microones: al moble penjat es queda penjat i sense fons; a terra, amb fons; després el fons es pot canviar", () => {
    const m = picked({ base: { kind: "wall", height: 1450 } }, "appliance-bosch-bfl7221b1")
    expect(m.carcass.base.kind).toBe("wall")
    expect(m.carcass.back).toBe("none")
    expect(picked({}, "appliance-bosch-bfl7221b1").carcass.back).not.toBe("none")
    const back = { ...m, carcass: { ...m.carcass, back: "screwed" as const } }
    expect(visibleModule(back).carcass.back).toBe("screwed")
  })

  it("la placa no ocupa el mòdul: cap part fixa", () => {
    const m = withAppliance({}, "appliance-bosch-pie631hc1e")
    expect(moduleApplianceCarcass(m)).toBeUndefined()
    expect(visibleModule(m).carcass.top.kind).toBe("full")
    expect(setModuleAppliance(mod({}), applianceById("appliance-bosch-pie631hc1e"), 0).carcass.top.kind).toBe("full")
  })
})
