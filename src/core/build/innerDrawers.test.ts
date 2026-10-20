import { describe, expect, it } from "vitest"
import { addSideMargin, defaultModule, type Module } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"

const col = (patch: Partial<NonNullable<Module["root"]["innerDrawers"]>> = {}, hinge: "left" | "right" = "left"): Module => {
  const m = defaultModule("c", "Columna", { width: 600, height: 2100, depth: 560 })
  return { ...m, root: { id: "r", front: { kind: "door", mode: "single", hinge } as never, shelves: { n: 3, adjustable: true }, innerDrawers: { n: 2, height: 200, ...patch } } }
}

describe("calaixos interiors darrere d'una porta", () => {
  it("dos calaixos a baix, amb front interior retirat 25 mm i els prestatges per sobre", () => {
    const b = buildModule(col())
    const fronts = b.panels.filter((p) => p.label.startsWith("Front interior"))
    expect(fronts).toHaveLength(2)
    const door = b.panels.find((p) => p.role === "door")!
    const D = 560
    for (const f of fronts) expect(panelBox(f).max[2]).toBeCloseTo(D - 25)
    expect(panelBox(door).min[2]).toBeGreaterThanOrEqual(D - 0.01)
    // Cap suplement (0 casos especials): el marge per a les frontisses és una zona.
    expect(b.panels.some((p) => p.name === "suplement")).toBe(false)
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
  it("el marge a les frontisses és una zona oberta: la porta tapa les dues, la guia va al divisor i no avisa", () => {
    const m = col()
    const root = addSideMargin(m.root, m.root.id, "left")
    expect(root.front?.kind).toBe("door")
    expect(root.split?.sizes).toEqual([50, "auto"])
    expect(root.split?.children[1]?.innerDrawers?.n).toBe(2)
    const b = buildModule({ ...m, root })
    expect(b.panels.filter((p) => p.label.startsWith("Front interior"))).toHaveLength(2)
    expect(b.panels.filter((p) => p.role === "door")).toHaveLength(1)
    const divider = b.panels.find((p) => p.role === "divider")!
    expect(divider.holes.length).toBeGreaterThan(0)
    expect(b.warnings.some((w) => w.code === "inner-drawers" && w.message.includes("topen"))).toBe(false)
  })
})

describe("calaixos interiors amb un joc de calaix", () => {
  it("el joc va al lateral i el front interior fa l'alçada del joc", async () => {
    const { DEFAULT_HARDWARE_LIBRARY } = await import("../model")
    const kit = DEFAULT_HARDWARE_LIBRARY.find((h) => h.engine === "drawerKit")!
    const b = buildModule(col({ hardware: kit }))
    const fronts = b.panels.filter((p) => p.label.startsWith("Front interior"))
    expect(fronts.length).toBe(2)
    const side = b.panels.find((p) => p.id === "side-left")!
    expect(side.holes.some((h) => h.tag === "kit-slide")).toBe(true)
    expect(b.hardwareKits.length).toBe(2)
  })
})

describe("calaixos interiors: front metàl·lic i avís sense marge", () => {
  it("amb el front del fabricant, cap front de fusta, es veu i la comanda el demana", async () => {
    const { DEFAULT_HARDWARE_LIBRARY } = await import("../model")
    const kit = DEFAULT_HARDWARE_LIBRARY.find((h) => h.engine === "drawerKit")!
    const b = buildModule(col({ hardware: kit, front: "kit" }))
    expect(b.panels.some((p) => p.label.startsWith("Front interior"))).toBe(false)
    expect(b.extras.filter((p) => p.id.endsWith("kit-innerFront"))).toHaveLength(2)
    expect(b.hardwareKits.every((k) => k.lines.some((l) => l.component === "innerFront"))).toBe(true)
  })
  it("tocant el lateral de les frontisses, avisa", () => {
    expect(buildModule(col()).warnings.some((w) => w.code === "inner-drawers" && w.message.includes("topen"))).toBe(true)
  })
})

describe("calaixos interiors amb les opcions de Front › Calaixos", () => {
  it("l'alçada de cada calaix: el de dalt acaba més amunt amb les alçades a mida", () => {
    const topOf = (m: Module) => Math.max(...buildModule(m).panels.filter((p) => p.label.startsWith("Front interior")).map((f) => panelBox(f).max[1]))
    expect(topOf(col({ heights: [150, 300] })) - topOf(col())).toBeCloseTo(50)
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
