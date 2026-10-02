import { describe, expect, it } from "vitest"
import { COLLECTION_PIECES, defaultModule, type Composition, type FreePart, type Panel } from "../model"
import { buildComposition } from "./buildComposition"
import { sameMachining, sameSizeConflicts } from "./sameSize"

const panel = (id: string, holes: Panel["holes"], extra: Partial<Panel> = {}): Panel => ({
  id,
  name: id,
  label: id,
  role: "side",
  length: 600,
  width: 400,
  thickness: 19,
  material: "Roure",
  grain: "x",
  edges: { top: false, right: false, bottom: false, left: false },
  holes,
  grooves: [],
  module: 1,
  placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 0] },
  ...extra,
})
const hole = (x: number, y: number, face: "A" | "B" = "A") => ({ x, y, diameter: 5, depth: 12, face })

describe("peces de la mateixa mida amb mecanitzats diferents (el taller casa per mida)", () => {
  it("mirall (girada en u o en v, o capgirada) no és conflicte", () => {
    const a = panel("a", [hole(37, 50), hole(37, 350)])
    expect(sameMachining(a, panel("b", [hole(563, 50), hole(563, 350)]))).toBe(true)
    expect(sameMachining(a, panel("c", [hole(37, 50, "B"), hole(37, 350, "B")]))).toBe(true)
    expect(sameSizeConflicts([a, panel("b", [hole(563, 50), hole(563, 350)])])).toEqual([])
  })
  it("forats diferents a la mateixa mida i material: conflicte; amb un altre material, no", () => {
    const a = panel("a", [hole(37, 50)])
    const b = panel("b", [hole(100, 50)])
    expect(sameSizeConflicts([a, b])).toHaveLength(1)
    expect(sameSizeConflicts([a, { ...b, material: "Noguera" }])).toEqual([])
    expect(sameSizeConflicts([a, { ...b, length: 601 }])).toEqual([])
  })
  it("avís a buildComposition", () => {
    const part = (p: Partial<FreePart> & Pick<FreePart, "id" | "w" | "h" | "x">): FreePart => ({ name: p.id, orient: "front", thickness: 19, material: "Roure", y: 0, z: 0, ...p })
    const comp: Composition = {
      kind: "lliure",
      modules: [defaultModule("m1", "M")],
      references: [],
      parts: [part({ id: "a", w: 600, h: 400, x: 0 }), part({ id: "b", w: 600, h: 400, x: 1000 }), { ...part({ id: "c", w: 100, h: 100, x: 1200 }), effect: "cut" as const, y: 150, z: -10, thickness: 40 }],
    }
    const w = buildComposition(comp).warnings.filter((x) => x.code === "same-size")
    expect(w).toHaveLength(1)
    expect(w[0]!.message).toMatch(/només per la mida/)
  })
  it("la cadira Línia: seient i laterals ja no fan la mateixa mida", () => {
    const t = COLLECTION_PIECES.find((p) => p.id === "col-comercial-linea-chair")!
    const b = buildComposition(t.make())
    expect(b.warnings.filter((w) => w.code === "same-size")).toEqual([])
    const seat = b.panels.find((p) => p.label === "Seient")!
    const side = b.panels.find((p) => p.label === "Lateral")!
    expect([seat.length, seat.width]).not.toEqual([side.length, side.width])
  })
})
