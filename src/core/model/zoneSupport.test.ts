import { describe, expect, it } from "vitest"
import { defaultModule, splitZone, type Module } from "."
import { canHoldAccessories, canHoldFront, canHoldShelves, carcassBounds, frontLimitsHelp, splitDirsFor, zoneBounds, zoneBoundsMap } from "./zoneSupport"

/** El mòdul nou de l'arbre (per decisió de l'usuari): sense laterals, tapa ni fons, directe a terra. */
const bare = (patch: Partial<Module["carcass"]> = {}): Module => {
  const m = defaultModule("m", "M", { width: 600, height: 100, depth: 560, base: { kind: "none" }, back: "none", top: { kind: "none" }, sides: { left: false, right: false }, ...patch })
  return { ...m, root: { id: "r", shelves: { n: 0, adjustable: true } } }
}

describe("què aguanta cada compartiment (opcions en cascada)", () => {
  it("la caixa: laterals, base (menys «Sense base») i tapa (menys «Sense tapa»)", () => {
    expect(carcassBounds(bare().carcass)).toEqual({ left: false, right: false, bottom: true, top: false })
    expect(carcassBounds(defaultModule("a", "A").carcass)).toEqual({ left: true, right: true, bottom: true, top: true })
    expect(carcassBounds({ sides: { left: true, right: false }, base: { kind: "open" }, top: { kind: "ventSlot", gap: 40 } })).toEqual({ left: true, right: false, bottom: false, top: true })
  })
  it("el mòdul nou sense caixa: ni prestatges, ni accessoris, ni dividir; només obert", () => {
    const b = zoneBounds(bare(), "r")!
    expect([canHoldShelves(b), canHoldAccessories(b), splitDirsFor(b)]).toEqual([false, false, []])
    expect((["none", "door", "drawers", "flap", "grille", "panel"] as const).filter((k) => canHoldFront(b, k))).toEqual(["none", "grille", "panel"])
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
    expect(map.get(low!.id)).toEqual({ left: true, right: true, bottom: true, top: true })
    expect(map.get(high!.id)).toEqual({ left: true, right: true, bottom: true, top: false })
  })
  it("fronts: porta i abatible amb un lateral; calaixos amb els dos; l'ajuda diu per què", () => {
    const one = { left: true, right: false, bottom: false, top: false }
    expect(canHoldFront(one, "door") && canHoldFront(one, "flap")).toBe(true)
    expect(canHoldFront(one, "drawers")).toBe(false)
    expect(frontLimitsHelp(one, ["none", "door", "drawers"])).toMatch(/calaixos/)
    expect(frontLimitsHelp({ ...one, right: true }, ["none", "door", "drawers"])).toBeUndefined()
    expect(frontLimitsHelp({ left: false, right: false, bottom: false, top: false }, ["none", "door", "panel"])).toMatch(/porta.*front fix/)
  })
})
