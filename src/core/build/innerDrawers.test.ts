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

describe("calaixos interiors: front metàl·lic i avís sense suplement", () => {
  it("amb el front del fabricant, cap front de fusta, es veu i la comanda el demana", async () => {
    const { DEFAULT_HARDWARE_LIBRARY } = await import("../model")
    const kit = DEFAULT_HARDWARE_LIBRARY.find((h) => h.engine === "drawerKit")!
    const b = buildModule(col({ hardware: kit, front: "kit" }))
    expect(b.panels.some((p) => p.label.startsWith("Front interior"))).toBe(false)
    expect(b.extras.filter((p) => p.id.endsWith("kit-innerFront"))).toHaveLength(2)
    expect(b.hardwareKits.every((k) => k.lines.some((l) => l.component === "innerFront"))).toBe(true)
  })
  it("sense suplement al costat de les frontisses, avisa", () => {
    expect(buildModule(col({ shim: 0 })).warnings.some((w) => w.code === "inner-drawers" && w.message.includes("topen"))).toBe(true)
    expect(buildModule(col()).warnings.some((w) => w.message.includes("topen"))).toBe(false)
  })
})

describe("calaixos interiors amb les opcions de Front › Calaixos", () => {
  it("l'alçada de cada calaix: els suplements fan la suma de les alçades", () => {
    const shimH = (m: Module) => buildModule(m).panels.find((p) => p.name === "suplement")!
    const same = panelBox(shimH(col())), own = panelBox(shimH(col({ heights: [150, 300] })))
    expect(own.max[1] - own.min[1] - (same.max[1] - same.min[1])).toBeCloseTo(50)
  })
  it("amb un joc: el tancament i la guia de cada calaix arriben a la comanda", async () => {
    const { DEFAULT_HARDWARE_LIBRARY } = await import("../model")
    const kits = DEFAULT_HARDWARE_LIBRARY.filter((h) => h.engine === "drawerKit")
    const kit = kits[0]!
    const closing = kit.kit!.options.closing.at(-1)!
    const b = buildModule(col({ hardware: kit, kit: { closing } }))
    expect(b.hardwareKits.every((k) => k.options.closing === closing)).toBe(true)
    const other = kits.find((h) => h.name !== kit.name)
    if (!other) return
    const per = buildModule(col({ hardware: kit, heights: [200, 300], drawerSlides: [null, other] }))
    expect(per.hardwareKits.map((k) => k.item)).toContain(other.name)
  })
})

describe("suplement de cada costat: tira o caixa, tapada o amb prestatges", () => {
  const box = (b: ReturnType<typeof buildModule>) => b.panels.filter((p) => p.assembly?.startsWith("Suplement dels calaixos interiors"))
  it("fins a dos gruixos, una tira massissa; més, una caixa tapada amb la guia a la pell i el cantell de dalt cantejat", () => {
    expect(box(buildModule(col({ shim: 19 })))).toHaveLength(0)
    const b = buildModule(col({ shim: 50 }))
    const parts = box(b)
    expect(parts.map((p) => p.name).sort()).toEqual(["davant suplement", "suplement", "tapa suplement"])
    expect(parts.every((p) => p.thickness === 19)).toBe(true)
    const skin = parts.find((p) => p.name === "suplement")!
    expect(skin.holes.length).toBeGreaterThan(0)
    expect(skin.edges.top).toBe(true)
    // La pell, a 50 mm del lateral (cara de dins del lateral esquerre + 50).
    const plain = buildModule(col({ shim: 19 })).panels.find((p) => p.name === "suplement")!
    expect(panelBox(skin).max[0] - panelBox(plain).min[0]).toBeCloseTo(50)
    expect(plain.edges.top).toBe(true)
  })
  it("cada costat el seu: el dret amb prestatges encara que no hi hagi frontisses, i més de 60 mm", () => {
    const b = buildModule(col({ sides: { left: { thickness: 19 }, right: { thickness: 120, box: "shelves", shelves: 2 } } }))
    const parts = box(b)
    expect(parts.some((p) => p.name === "davant suplement")).toBe(false)
    expect(parts.filter((p) => p.name === "prestatge suplement")).toHaveLength(2)
    expect(parts.every((p) => p.label.includes("dret"))).toBe(true)
    expect(b.panels.filter((p) => p.name === "suplement")).toHaveLength(2)
    expect(b.warnings.some((w) => w.code === "inner-drawers" && w.message.includes("deixen"))).toBe(false)
  })
  it("si als calaixos no els queda lloc, avisa", () => {
    const b = buildModule(col({ sides: { left: { thickness: 250 }, right: { thickness: 250 } } }))
    expect(b.warnings.some((w) => w.code === "inner-drawers" && w.message.includes("deixen"))).toBe(true)
  })
})
