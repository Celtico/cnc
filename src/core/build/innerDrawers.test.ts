import { describe, expect, it } from "vitest"
import { defaultModule, type Module } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"

const col = (patch: Partial<NonNullable<Module["root"]["innerDrawers"]>> = {}, hinge: "left" | "right" = "left"): Module => {
  const m = defaultModule("c", "Columna", { width: 600, height: 2100, depth: 560 })
  return { ...m, root: { id: "r", front: { kind: "door", mode: "single", hinge } as never, shelves: { n: 3, adjustable: true }, innerDrawers: { n: 2, height: 200, ...patch } } }
}

describe("calaixos interiors darrere d'una porta", () => {
  it("dos calaixos a baix, amb front interior retirat 25 mm, suplement al costat de les frontisses i els prestatges per sobre", () => {
    const b = buildModule(col())
    const fronts = b.panels.filter((p) => p.label.startsWith("Front interior"))
    expect(fronts).toHaveLength(2)
    const door = b.panels.find((p) => p.role === "door")!
    const D = 560
    for (const f of fronts) expect(panelBox(f).max[2]).toBeCloseTo(D - 25)
    expect(panelBox(door).min[2]).toBeGreaterThanOrEqual(D - 0.01)
    const shims = b.panels.filter((p) => p.name === "suplement")
    expect(shims).toHaveLength(1)
    expect(shims[0]!.label).toContain("esquerre")
    // La guia va al suplement, no al lateral, a l'alçada dels calaixos.
    expect(shims[0]!.holes.length).toBeGreaterThan(0)
    // Els calaixos ocupen 2 × 200 + la folgança entre fronts; els prestatges, per sobre.
    const top = Math.max(...fronts.map((f) => panelBox(f).max[1]))
    for (const s of b.panels.filter((p) => p.role === "shelf")) expect(panelBox(s).min[1]).toBeGreaterThan(top)
    // Cap tirador als fronts interiors.
    expect(fronts.every((f) => !f.holes.some((h) => h.tag === "handle"))).toBe(true)
  })
  it("sense porta, no es fan (es conserven)", () => {
    const m = col()
    const open = { ...m, root: { ...m.root, front: undefined } }
    expect(buildModule(open).panels.some((p) => p.label.startsWith("Front interior"))).toBe(false)
  })
  it("dues portes: suplements als dos costats; sense suplement (0), cap", () => {
    const m = col()
    const two = { ...m, root: { ...m.root, front: { kind: "door", mode: "double", hinge: "left" } as never } }
    expect(buildModule(two).panels.filter((p) => p.name === "suplement")).toHaveLength(2)
    expect(buildModule(col({ shim: 0 })).panels.filter((p) => p.name === "suplement")).toHaveLength(0)
  })
})

describe("calaixos interiors amb un joc de calaix", () => {
  it("el joc va al suplement i el front interior fa l'alçada del joc", async () => {
    const { DEFAULT_HARDWARE_LIBRARY } = await import("../model")
    const kit = DEFAULT_HARDWARE_LIBRARY.find((h) => h.engine === "drawerKit")!
    const b = buildModule(col({ hardware: kit }))
    const fronts = b.panels.filter((p) => p.label.startsWith("Front interior"))
    expect(fronts.length).toBe(2)
    const shim = b.panels.find((p) => p.name === "suplement")!
    expect(shim.holes.some((h) => h.tag === "kit-slide")).toBe(true)
    expect(b.hardwareKits.length).toBe(2)
  })
})
