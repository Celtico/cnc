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
    expect(side.mitres).toEqual(["right"])
    expect(side.edges.right).toBe(false)
    // Sense espigues entre tapa i laterals.
    expect(top.holes.filter((h) => h.face === "edge")).toHaveLength(0)
    expect(panelEntities(top)).toContain("MITRE_45")
    expect(toCutList(b.panels).items.find((i) => i.role === "top")!.mitreNumbers.length).toBe(2)
  })
})
