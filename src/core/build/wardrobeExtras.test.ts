import { describe, expect, it } from "vitest"
import { defaultModule, type Module } from "../model"
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

describe("fronts de calaix de vidre", () => {
  it.each([2, 4])("el front porta la finestra calada, el galze i el vidre a part; els forats queden al marc (%i calaixos)", (n) => {
    const m = base()
    const b = buildModule({ ...m, root: { id: "r", front: { kind: "drawers", n, heights: Array(n).fill("auto"), glass: true } as never } })
    const fronts = b.panels.filter((p) => p.role === "drawerFront")
    expect(fronts).toHaveLength(n)
    for (const f of fronts) {
      const win = f.cutouts?.find((c) => c.tag === "glass")
      expect(win?.kind).toBe("rect")
      if (win?.kind !== "rect") continue
      expect(f.grooves.some((g) => g.tag === "glass-rebate")).toBe(true)
      for (const h of f.holes) expect(h.x < win.x || h.x > win.x + win.w || h.y < win.y || h.y > win.y + win.h).toBe(true)
    }
    expect(b.extras.filter((p) => p.material === "Vidre")).toHaveLength(n)
  })
})
