import { describe, expect, it } from "vitest"
import { buildCabinet } from "../build/buildCabinet"
import { DEFAULT_CABINET } from "../model"
import { toCutList } from "./toCutList"

describe("toCutList", () => {
  const panels = buildCabinet({ ...DEFAULT_CABINET, doors: 2, shelves: 2 })
  const list = toCutList(panels)

  it("agrupa els dos laterals en una fila de 2 tot i ser mirall", () => {
    const sides = list.items.filter((i) => i.role === "side")
    expect(sides).toHaveLength(1)
    expect(sides[0]!.qty).toBe(2)
    expect(sides[0]!.panelIds).toEqual(["side-left", "side-right"])
    expect(sides[0]!.holes).toBe(92)
  })

  it("agrupa les dues portes i els dos prestatges", () => {
    expect(list.items.find((i) => i.role === "door")?.qty).toBe(2)
    expect(list.items.find((i) => i.role === "shelf")?.qty).toBe(2)
  })

  it("no agrupa base i sostre perquè el cantell folrat és diferent", () => {
    expect(list.items.filter((i) => i.role === "bottom")).toHaveLength(1)
    expect(list.items.filter((i) => i.role === "top")).toHaveLength(1)
  })

  it("el total de peces és el nombre de panells", () => {
    expect(list.totalPanels).toBe(9)
    expect(list.items.reduce((s, i) => s + i.qty, 0)).toBe(9)
  })

  it("cantells en numeració del taller i metres lineals", () => {
    const door = list.items.find((i) => i.role === "door")!
    expect(door.edgeNumbers).toEqual([1, 2, 3, 4])
    // 2 portes × (2·716 + 2·296,5) mm = 4,05 m
    expect(door.edgeLength).toBe(4.05)
    const back = list.items.find((i) => i.role === "back")!
    expect(back.edgeNumbers).toEqual([])
    expect(back.edgeLength).toBe(0)
  })

  it("superfície en m²", () => {
    const sides = list.items.find((i) => i.role === "side")!
    expect(sides.area).toBe(round4((720 * 560 * 2) / 1e6))
    expect(list.totalArea).toBeGreaterThan(sides.area)
  })

  it("ordre: laterals, base, sostre, prestatges, portes, fons", () => {
    expect(list.items.map((i) => i.role)).toEqual([
      "side",
      "bottom",
      "top",
      "shelf",
      "door",
      "back",
    ])
  })
})

const round4 = (v: number): number => Math.round(v * 10000) / 10000
