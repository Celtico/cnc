import { describe, expect, it } from "vitest"
import { defaultModule, type Module } from "../model"
import { buildModule } from "./buildModule"
import { panelEntities } from "../export/dxf"
import { toCutList } from "../cutlist/toCutList"

const withDoor = (m: Module): Module => ({ ...m, root: { ...m.root, front: { kind: "door", mode: "single", hinge: "left" } } })

describe("acabats: fronts encastats i cantonades a inglet", () => {
  const base = withDoor(defaultModule("m", "M", { width: 600, height: 720, depth: 560 }))
  const t = base.carcass.thickness

  it("recobrent: la porta va per davant i tapa els laterals", () => {
    const door = buildModule(base).panels.find((p) => p.role === "door")!
    expect(door.placement.origin[2]).toBe(560 + t)
    expect(door.width).toBeGreaterThan(600 - 2 * t)
  })

  it("encastat: la porta va dins de la llum, a nivell amb el davant", () => {
    const m = { ...base, fronts: { ...base.fronts, style: "inset" as const } }
    const b = buildModule(m)
    const door = b.panels.find((p) => p.role === "door")!
    expect(door.placement.origin[2]).toBe(560)
    expect(door.width).toBe(600 - 2 * t - 2 * m.fronts.outerGap)
    expect(door.placement.origin[0]).toBe(t + m.fronts.outerGap)
    expect(b.warnings.some((w) => w.code === "inset")).toBe(true)
  })

  it("inglet: la tapa arriba a fora dels laterals i els cantells van a 45°", () => {
    const m = { ...base, carcass: { ...base.carcass, joint: "mitre" as const } }
    const b = buildModule(m)
    const top = b.panels.find((p) => p.role === "top")!
    const side = b.panels.find((p) => p.id === "side-left")!
    expect(top.length).toBe(600)
    expect(top.mitres).toEqual(["left", "right"])
    // A terra (sense sòcol) la base també va a inglet: el lateral, pels dos caps.
    expect(side.mitres).toEqual(["right", "left"])
    expect(side.edges.right).toBe(false)
    // Sense espigues entre tapa i laterals.
    expect(top.holes.filter((h) => h.face === "edge")).toHaveLength(0)
    expect(panelEntities(top)).toContain("MITRE_45")
    expect(toCutList(b.panels).items.find((i) => i.role === "top")!.mitreNumbers.length).toBe(2)
  })
})

describe("base a inglet", () => {
  const panels = (over: Parameters<typeof defaultModule>[2]) => buildModule(defaultModule("m", "M", { width: 800, height: 700, depth: 500, joint: "mitre", ...over })).panels
  it("sense tapa i amb potes: la base de fora a fora amb 45° i els laterals tallats a baix", () => {
    const ps = panels({ top: { kind: "none" }, base: { kind: "legs", height: 100 } })
    const bottom = ps.find((p) => p.role === "bottom")!
    expect(Math.max(bottom.length, bottom.width)).toBe(800)
    expect(bottom.mitres?.length).toBe(2)
    const side = ps.find((p) => p.id === "side-left")!
    expect(side.mitres?.length).toBe(1)
  })
  it("amb tapa i base: els laterals a inglet pels dos caps", () => {
    const ps = panels({ base: { kind: "legs", height: 100 } })
    expect(ps.find((p) => p.id === "side-left")!.mitres?.length).toBe(2)
  })
  it("amb sòcol la base no és a baix dels laterals: sense inglet a baix", () => {
    const ps = panels({ top: { kind: "none" }, base: { kind: "plinth", height: 80, setback: 30 } })
    expect(ps.find((p) => p.role === "bottom")!.mitres).toBeUndefined()
  })
})

describe("fronts de calaix a inglet", () => {
  const drawers = (joint: "mitre" | "butt"): Module => ({
    ...defaultModule("m", "M", { width: 600, height: 720, depth: 500, joint }),
    root: { id: "r", front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } },
  })
  it("amb cantonades a inglet i només calaixos: fronts de fora a fora i laterals fins a la cara", () => {
    const b = buildModule(drawers("mitre"))
    const fronts = b.panels.filter((p) => p.role === "drawerFront")
    expect(fronts).toHaveLength(3)
    for (const f of fronts) {
      expect(f.mitres?.length).toBe(2)
      expect(Math.max(f.length, f.width)).toBe(600)
    }
    const side = b.panels.find((p) => p.id === "side-left")!
    expect(side.mitres).toContain("top")
    const t = side.thickness
    expect(Math.min(side.length, side.width)).toBe(500 + t)
  })
  it("amb una porta al mòdul, no (la porta toparia en obrir)", () => {
    const m = drawers("mitre")
    const b = buildModule({ ...m, root: { id: "r", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "a", front: { kind: "drawers", n: 1, heights: ["auto"] } }, { id: "b", front: { kind: "door", mode: "single", hinge: "left" } }] } } })
    expect(b.panels.filter((p) => p.role === "drawerFront").every((p) => !p.mitres)).toBe(true)
  })
})
