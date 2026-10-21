import { describe, expect, it } from "vitest"
import { defaultModule, splitZone, type Module } from "."
import { canHoldAccessories, canHoldFront, canHoldShelves, carcassBounds, frontHeld, frontLimitsHelp, splitDirsFor, zoneBounds, zoneBoundsMap, type ZoneBounds } from "./zoneSupport"

/** El mòdul nou de l'arbre (per decisió de l'usuari): sense laterals, tapa ni fons, directe a terra. */
const bare = (patch: Partial<Module["carcass"]> = {}): Module => {
  const m = defaultModule("m", "M", { width: 600, height: 100, depth: 560, base: { kind: "none" }, back: "none", top: { kind: "none" }, sides: { left: false, right: false }, ...patch })
  return { ...m, root: { id: "r", shelves: { n: 0, adjustable: true } } }
}

describe("què aguanta cada compartiment (opcions en cascada)", () => {
  it("la caixa: laterals, base (menys «Sense base») i tapa (menys «Sense tapa»)", () => {
    expect(carcassBounds(bare().carcass)).toEqual({ left: false, right: false, bottom: true, top: false, noBase: false, noTop: true })
    expect(carcassBounds(defaultModule("a", "A").carcass)).toEqual({ left: true, right: true, bottom: true, top: true, noBase: false, noTop: false })
    expect(carcassBounds({ sides: { left: true, right: false }, base: { kind: "open" }, top: { kind: "ventSlot", gap: 40 } })).toEqual({ left: true, right: false, bottom: false, top: true, noBase: true, noTop: false })
  })
  it("el mòdul nou sense caixa: ni prestatges, ni accessoris, ni dividir; només obert", () => {
    const b = zoneBounds(bare(), "r")!
    expect([canHoldShelves(b), canHoldAccessories(b), splitDirsFor(b)]).toEqual([false, false, []])
    expect((["none", "door", "drawers", "flap", "grille", "panel"] as const).filter((k) => canHoldFront(b, k))).toEqual(["none"])
  })
  it("amb els dos laterals: prestatges, accessoris i el travesser; amb tapa també el divisor vertical", () => {
    const sides = zoneBounds(bare({ sides: { left: true, right: true } }), "r")!
    expect([canHoldShelves(sides), canHoldAccessories(sides), splitDirsFor(sides)]).toEqual([true, true, ["h"]])
    expect(splitDirsFor(zoneBounds(bare({ sides: { left: true, right: true }, top: { kind: "full" } }), "r")!)).toEqual(["v", "h"])
    // Base i tapa sense laterals: el divisor vertical sí, prestatges no.
    const bt = zoneBounds(bare({ top: { kind: "full" } }), "r")!
    expect([canHoldShelves(bt), splitDirsFor(bt)]).toEqual([false, ["v"]])
  })
  it("els divisors aguanten com un lateral: els compartiments de dins d'una divisió vertical", () => {
    const m = bare({ top: { kind: "full" } })
    const root = splitZone(m.root, "r", "v", 3)
    const [a, b, c] = root.split!.children
    const map = zoneBoundsMap({ ...m, root })
    expect([map.get(a!.id)!.left, map.get(a!.id)!.right]).toEqual([false, true])
    expect(canHoldShelves(map.get(b!.id)!)).toBe(true)
    expect([map.get(c!.id)!.left, map.get(c!.id)!.right]).toEqual([true, false])
  })
  it("divisió horitzontal: un travesser a sota o a sobre de cada compartiment de dins", () => {
    const m = bare({ sides: { left: true, right: true } })
    const root = splitZone(m.root, "r", "h", 2)
    const [low, high] = root.split!.children
    const map = zoneBoundsMap({ ...m, root })
    // `inner`: el travesser és de la divisió (la zona el pot treure, Caixa de la zona).
    expect(map.get(low!.id)).toEqual({ left: true, right: true, bottom: true, top: true, noBase: false, noTop: false, inner: ["top"] })
    // A sobre del de dalt hi ha la tapa que el mòdul no té.
    expect(map.get(high!.id)).toEqual({ left: true, right: true, bottom: true, top: false, noBase: false, noTop: true, inner: ["bottom"] })
  })
  it("fronts: només amb el compartiment aguantat pels quatre costats; l'ajuda diu per què", () => {
    const all = { left: true, right: true, bottom: true, top: true, noBase: false, noTop: false }
    const one: ZoneBounds = { ...all, right: false }
    // Un sol lateral: cap front (ni porta, ni abatible, ni reixeta, ni front fix), obert sí.
    expect((["none", "door", "drawers", "flap", "grille", "panel"] as const).filter((k) => canHoldFront(one, k))).toEqual(["none"])
    expect(frontLimitsHelp(one, ["none", "door", "drawers"])).toMatch(/quatre costats.*a la dreta/)
    expect(frontLimitsHelp(one, ["none", "door"], "door")).toMatch(/^El front triat no es fa/)
    expect(frontLimitsHelp(all, ["none", "door", "drawers"])).toBeUndefined()
    expect(frontLimitsHelp(one, ["none"])).toBeUndefined()
    // Sense peça a sota o a sobre (i no és la base o la tapa que falta): tampoc.
    expect(frontHeld({ ...all, bottom: false })).toBe(false)
    expect(frontHeld({ ...all, top: false })).toBe(false)
    expect(frontLimitsHelp({ ...all, top: false }, ["none", "panel"])).toMatch(/una peça a sobre/)
  })
  it("«si no té tapa o no té base, es queda com està»: la tapa o la base que falten compten com a aguantades", () => {
    // Moble de cuina «Sense tapa» i cobreradiador sense base: amb els dos laterals, tots els fronts.
    const kitchen = zoneBounds(bare({ sides: { left: true, right: true }, top: { kind: "none" }, base: { kind: "plinth", height: 100, setback: 50 } }), "r")!
    const radiator = zoneBounds(bare({ sides: { left: true, right: true }, top: { kind: "full" }, base: { kind: "open" } }), "r")!
    for (const b of [kitchen, radiator]) expect((["door", "drawers", "flap", "grille", "panel"] as const).every((k) => canHoldFront(b, k))).toBe(true)
    // Ni tapa ni base, però amb laterals: també.
    expect(frontHeld(zoneBounds(bare({ sides: { left: true, right: true }, base: { kind: "open" } }), "r")!)).toBe(true)
    // Sense un lateral, no (la tapa o la base que falten no salven els costats).
    expect(frontHeld(zoneBounds(bare({ sides: { left: true, right: false } }), "r")!)).toBe(false)
  })
  it("divisions: els travessers i divisors de dins sempre aguanten; la tapa o la base que falten, només als de la vora", () => {
    const m = bare({ sides: { left: true, right: true }, base: { kind: "open" } })
    const root = splitZone(m.root, "r", "h", 3)
    const ids = root.split!.children.map((c) => c.id)
    const map = zoneBoundsMap({ ...m, root })
    expect(ids.map((id) => [map.get(id)!.noBase, map.get(id)!.noTop])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ])
    expect(ids.every((id) => frontHeld(map.get(id)!))).toBe(true)
    // Divisió vertical sense laterals: només el compartiment del mig (un divisor a cada costat) pot portar un front.
    const v = bare({ top: { kind: "full" } })
    const vroot = splitZone(v.root, "r", "v", 3)
    const vmap = zoneBoundsMap({ ...v, root: vroot })
    expect(vroot.split!.children.map((c) => frontHeld(vmap.get(c.id)!))).toEqual([false, true, false])
  })
})
