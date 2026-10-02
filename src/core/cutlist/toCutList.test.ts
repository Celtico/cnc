import { describe, expect, it } from "vitest"
import { buildCabinet } from "../build/buildCabinet"
import { DEFAULT_CABINET, NO_EDGES, type Panel } from "../model"
import { edgeLengthOf, toCutList } from "./toCutList"

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

describe("metres de cantell amb contorn", () => {
  it("amb els quatre cantells i contorn, el perímetre real; si no, el rectangle", () => {
    const all = { top: true, right: true, bottom: true, left: true }
    expect(edgeLengthOf(400, 300, all, [[0, 0], [400, 0], [0, 300]])).toBeCloseTo(1200, 6)
    expect(edgeLengthOf(400, 300, all)).toBe(1400)
    expect(edgeLengthOf(400, 300, { ...all, left: false }, [[0, 0], [400, 0], [0, 300]])).toBe(1100)
  })
  it("toCutList fa servir el contorn de la peça", () => {
    const [p] = buildCabinet({ ...DEFAULT_CABINET })
    const tri = { ...p!, role: "part" as const, label: "Triangle", length: 400, width: 300, edges: { top: true, right: true, bottom: true, left: true }, outline: [[0, 0], [400, 0], [0, 300]] as [number, number][] }
    expect(toCutList([tri]).items[0]!.edgeLength).toBeCloseTo(1.2, 4)
  })
})

describe("toCutList · agrupació coherent", () => {
  const [base] = buildCabinet({ ...DEFAULT_CABINET })
  const P = (id: string, extra: Partial<Panel> = {}): Panel => ({ ...base!, id, label: id, role: "side", length: 700, width: 500, holes: [], grooves: [], edges: { ...NO_EDGES }, mitres: undefined, outline: undefined, cutouts: undefined, assembly: undefined, push: undefined, ...extra })
  const same = (items: ReturnType<typeof toCutList>["items"]) => items.map((i) => [i.qty, i.processes, i.mitreNumbers, i.edgeNumbers])

  it("inglets a costats diferents (llarg i curt) no s'agrupen; mirall sí, i la fila diu el mateix", () => {
    const a = P("a", { role: "facing", mitres: ["left"] })
    const b = P("b", { role: "facing", mitres: ["top"] })
    expect(toCutList([a, b]).items).toHaveLength(2)
    const c = P("c", { role: "facing", mitres: ["right"] })
    const ac = toCutList([a, c]).items
    expect(ac).toHaveLength(1)
    expect(ac[0]!.qty).toBe(2)
    expect(same(toCutList([a, c]).items)).toEqual(same(toCutList([c, a]).items))
  })

  it("cantells i inglets es normalitzen junts", () => {
    // Cantell a dalt + inglet a l'esquerra vs. cantell a dalt + inglet a la dreta: mirall → mateixa fila.
    const a = P("a", { edges: { ...NO_EDGES, top: true }, mitres: ["left"] })
    const b = P("b", { edges: { ...NO_EDGES, top: true }, mitres: ["right"] })
    expect(toCutList([a, b]).items).toHaveLength(1)
    // Cantell i inglet al mateix costat llarg vs. a costats llargs oposats: no.
    const c = P("c", { edges: { ...NO_EDGES, top: true }, mitres: ["top"] })
    const d = P("d", { edges: { ...NO_EDGES, top: true }, mitres: ["bottom"] })
    expect(toCutList([c, d]).items).toHaveLength(2)
  })

  it("la 2a cara i els forats de cantell separen files (els processos no depenen de l'ordre)", () => {
    const a = P("a")
    const b = P("b", { holes: [{ x: 10, y: 10, diameter: 5, depth: 12, face: "B" }, { x: 0, y: 30, diameter: 8, depth: 30, face: "edge", edge: "left" }] })
    expect(toCutList([a, b]).items).toHaveLength(2)
    expect(same(toCutList([a, b]).items).sort()).toEqual(same(toCutList([b, a]).items).sort())
    const e1 = P("e1", { holes: [{ x: 0, y: 30, diameter: 8, depth: 30, face: "edge", edge: "left" }] })
    const e2 = P("e2", { holes: [{ x: 0, y: 30, diameter: 8, depth: 30, face: "edge", edge: "left" }, { x: 0, y: 60, diameter: 8, depth: 30, face: "edge", edge: "left" }] })
    expect(toCutList([e1, e2]).items).toHaveLength(2)
  })

  it("una peça amb forma no s'agrupa amb un rectangle, sigui del rol que sigui", () => {
    const all = { top: true, bottom: true, left: true, right: true }
    const a = P("a", { role: "worktop", length: 1200, width: 800, edges: all, outline: [[0, 0], [1200, 0, 1], [1200, 800], [0, 800, 1]] as Panel["outline"] })
    const b = P("b", { role: "worktop", length: 1200, width: 800, edges: all })
    const items = toCutList([b, a]).items
    expect(items).toHaveLength(2)
    const c = P("c", { role: "door", cutouts: [{ kind: "circle", x: 100, y: 100, diameter: 5 }] })
    expect(toCutList([c, P("d", { role: "door" })]).items).toHaveLength(2)
  })
})
