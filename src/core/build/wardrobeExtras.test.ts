import { describe, expect, it } from "vitest"
import { DEFAULT_HARDWARE_LIBRARY, defaultModule, type Module } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"

const base = (): Module => defaultModule("a", "Armari", { width: 800, height: 2000, depth: 560 })

describe("sòcol de dalt (fins al sostre)", () => {
  it("un tauler dret sobre la tapa, de tota l'amplada, retirat del davant", () => {
    const m = base()
    const b = buildModule({ ...m, carcass: { ...m.carcass, topFiller: { height: 80, setback: 10 } } })
    const f = b.panels.find((p) => p.id === "top-filler")!
    expect(f).toBeDefined()
    const box = panelBox(f)
    expect(box.min[1]).toBeCloseTo(2000)
    expect(box.max[1]).toBeCloseTo(2080)
    expect(box.max[0] - box.min[0]).toBeCloseTo(800)
    expect(box.max[2]).toBeCloseTo(560 - 10)
  })
  it("sense tapa, no es fa", () => {
    const m = base()
    const b = buildModule({ ...m, carcass: { ...m.carcass, top: { kind: "none" }, topFiller: { height: 80, setback: 0 } } })
    expect(b.panels.some((p) => p.id === "top-filler")).toBe(false)
  })
})

describe("fronts de calaix de vidre (l'armari de la foto: el vidre és el front, en ranura, sense marc)", () => {
  it.each([2, 4])("cap front de fusta; els laterals amb la ranura del vidre; el vidre a part (%i calaixos)", (n) => {
    const m = base()
    const b = buildModule({ ...m, root: { id: "r", front: { kind: "drawers", n, heights: Array(n).fill("auto"), glass: true } as never } })
    expect(b.panels.filter((p) => p.role === "drawerFront")).toHaveLength(0)
    const sides = b.panels.filter((p) => p.role === "drawerSide")
    expect(sides).toHaveLength(2 * n)
    for (const s of sides) expect(s.grooves.some((g) => g.tag === "glass")).toBe(true)
    expect(b.extras.filter((p) => p.material === "Vidre")).toHaveLength(n)
  })
  it("amb tirador, els forats al vidre", () => {
    const m = base()
    const handle = DEFAULT_HARDWARE_LIBRARY.find((h) => h.category === "handle")!
    const b = buildModule({ ...m, root: { id: "r", front: { kind: "drawers", n: 2, heights: ["auto", "auto"], glass: true, handle } as never } })
    expect(b.extras.filter((p) => p.material === "Vidre").every((g) => (g.cutouts ?? []).some((h) => h.tag === "handle"))).toBe(true)
  })
})
