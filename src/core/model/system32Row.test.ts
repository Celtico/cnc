import { describe, expect, it } from "vitest"
import { defaultModule, setFront, setShelves, splitZone, system32RowPlace, type Carcass, type Front, type Module, type Zone } from "."

/**
 * On surt la «Filera System 32» del mòdul (`system32RowPlace`): no a l'inspector del mòdul sinó als
 * Prestatges (regulables que es fan) o, sense, al Front de la porta que la fa servir. Mai als dos; si no, enlloc.
 */

const mod = (overrides: Partial<Carcass> = {}): Module => defaultModule("m1", "M", overrides)
const door: Front = { kind: "door", mode: "single", hinge: "left" }
const fixed = (m: Module): Module => ({ ...m, root: setShelves(m.root, m.root.id, { n: 2, adjustable: false }) })
const zones = (m: Module) => [...(system32RowPlace(m)?.zones ?? [])].sort()
function divided(a: Front | null, b: Front | null, base: Module = mod()): Module {
  let root: Zone = splitZone(base.root, base.root.id, "v", 2)
  const [l, r] = root.split!.children
  root = setFront(root, l!.id, a)
  root = setFront(root, r!.id, b)
  return { ...base, root }
}

describe("on surt la filera System 32 (`system32RowPlace`)", () => {
  it("prestatges regulables (també sense cap prestatge): als Prestatges d'aquell compartiment", () => {
    const m = mod()
    expect(system32RowPlace(m)).toMatchObject({ at: "shelves" })
    expect(zones(m)).toEqual([m.root.id])
  })
  it("regulables i porta al mateix compartiment: només als Prestatges (mai dos llocs)", () => {
    const m: Module = { ...mod(), root: setFront(mod().root, mod().root.id, door) }
    expect(system32RowPlace(m)?.at).toBe("shelves")
    expect(system32RowPlace(m)?.what).toBe("prestatges regulables, portes")
  })
  it("sense regulables, amb porta: al Front de la porta", () => {
    const base = fixed(mod())
    const m: Module = { ...base, root: setFront(base.root, base.root.id, door) }
    expect(system32RowPlace(m)).toMatchObject({ at: "front", what: "portes" })
    expect(zones(m)).toEqual([m.root.id])
  })
  it("porta de tota la zona sobre una divisió sense regulables: al Front de la zona pare", () => {
    let m = divided(null, null)
    m = { ...m, root: { ...m.root, front: door, split: { ...m.root.split!, children: m.root.split!.children.map((c) => ({ ...c, shelves: { n: 1, adjustable: false } })) } } }
    expect(system32RowPlace(m)?.at).toBe("front")
    expect(zones(m)).toEqual([m.root.id])
  })
  it("un compartiment amb regulables mana sobre la porta d'un altre: només als Prestatges", () => {
    const m = divided(door, null)
    const [l, r] = m.root.split!.children
    const root = setShelves(setShelves(m.root, l!.id, { n: 1, adjustable: false }), r!.id, { n: 1, adjustable: true })
    const place = system32RowPlace({ ...m, root })
    expect(place?.at).toBe("shelves")
    expect([...place!.zones]).toEqual([r!.id])
  })
  it("reixeta amb frontisses: al Front; desmuntable (imants): enlloc", () => {
    const grille = (mount: "hinged" | "removable"): Front => ({ kind: "grille", mount, hinge: "left", pattern: { kind: "slotsV", slotWidth: 8, slotGap: 8, margin: 40, holeDiameter: 8, holePitch: 16 } })
    const base = fixed(mod())
    expect(system32RowPlace({ ...base, root: setFront(base.root, base.root.id, grille("hinged")) })?.at).toBe("front")
    expect(system32RowPlace({ ...base, root: setFront(base.root, base.root.id, grille("removable")) })).toBeUndefined()
  })
  it("porta de vidre, calaixos o prestatges fixos sense porta: enlloc", () => {
    const base = fixed(mod())
    expect(system32RowPlace(base)).toBeUndefined()
    expect(system32RowPlace({ ...base, root: setFront(base.root, base.root.id, { ...door, glass: true }) })).toBeUndefined()
    // Els calaixos omplen el compartiment: els seus regulables no es fan.
    expect(system32RowPlace({ ...mod(), root: setFront(mod().root, mod().root.id, { kind: "drawers", n: 2, heights: ["auto", "auto"] }) })).toBeUndefined()
  })
  it("el fons encastat sol (només en llegeix els números per a un avís): enlloc", () => {
    const m = fixed(mod({ back: "inset" }))
    expect(system32RowPlace(m)).toBeUndefined()
  })
})
