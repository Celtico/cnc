import { describe, expect, it } from "vitest"
import { defaultModule, modulePlacements, type Composition, type RefObject } from "./composition"
import { makeRoomForRef, refBlocksRow } from "./refRow"

/** Tres baixos de 600 tocant-se (A · B · C) i un rentaplats de 600 al terra, a la paret. */
const comp = (x: number, extra: Partial<RefObject> = {}, gapC = 0): Composition => ({
  modules: [
    { ...defaultModule("a", "A", { width: 600 }), gapBefore: 0 },
    { ...defaultModule("b", "B", { width: 600 }), gapBefore: 0 },
    { ...defaultModule("c", "C", { width: 600 }), gapBefore: gapC },
  ],
  references: [{ id: "r", name: "Rentaplats", w: 600, h: 820, d: 560, x, y: 0, z: 0, onFloor: true, onWall: true, ...extra }],
})
const xs = (c: Composition) => modulePlacements(c).map((p) => p.x)

describe("objectes de referència entre mòduls", () => {
  it("deixat sobre B (més cap a la dreta), es posa entre B i C i C es desplaça", () => {
    const c = comp(700)
    expect(refBlocksRow(c, "r")).toBe(true)
    const r = makeRoomForRef(c, "r")
    expect(r.references[0]!.x).toBe(1200)
    expect(xs(r)).toEqual([0, 600, 1800])
    expect(refBlocksRow(r, "r")).toBe(false)
  })
  it("deixat més cap a l'esquerra de B, es posa entre A i B", () => {
    const r = makeRoomForRef(comp(500), "r")
    expect(r.references[0]!.x).toBe(600)
    expect(xs(r)).toEqual([0, 1200, 1800])
  })
  it("si ja hi ha forat, l'objecte s'hi encabeix sense moure cap mòdul", () => {
    const c = comp(1350, {}, 700)
    const r = makeRoomForRef(c, "r")
    expect(xs(r)).toEqual(xs(c))
    expect(r.references[0]!.x).toBe(1300)
  })
  it("un forat massa estret s'eixampla només el que falta", () => {
    const r = makeRoomForRef(comp(1200, {}, 200), "r")
    expect(r.references[0]!.x).toBe(1200)
    expect(xs(r)).toEqual([0, 600, 1800])
  })
  it("no toca els penjats ni els objectes que tallen, ni el que no és a la fila", () => {
    expect(makeRoomForRef(comp(700, { effect: "cut" }), "r")).toEqual(comp(700, { effect: "cut" }))
    expect(refBlocksRow(comp(700, { effect: "cut" }), "r")).toBe(false)
    // Al davant del moble (més enllà de la fondària dels mòduls): no és a la fila.
    const front = comp(700, { onWall: undefined, z: 2000 })
    expect(refBlocksRow(front, "r")).toBe(false)
    expect(makeRoomForRef(front, "r")).toEqual(front)
  })
})
