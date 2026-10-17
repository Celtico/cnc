import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type Module, type RefObject } from "../model"
import { buildComposition } from "./buildComposition"

/** Un alt penjat de 600 × 720 × 330 (fons en ranura a 20: hi cap la regleta) i una columna a la cantonada esquerra del darrere. */
function wallModule(): Module {
  const m = defaultModule("a", "Alt")
  return { ...m, carcass: { ...m.carcass, width: 600, height: 720, depth: 330, back: "groove", backSetback: 20, base: { kind: "wall", height: 1450 } } }
}
const column = (w: number): RefObject => ({ id: "c", name: "Columna", w, h: 2600, d: 120, x: -100, y: 0, z: 0, effect: "cut", axis: "y" })
const comp = (refs: RefObject[]) => ({ id: "c", name: "t", modules: [wallModule()], references: refs, parts: [], models: [] }) as unknown as Composition

describe("penjadors i regleta davant d'una columna (per decisió de l'usuari, 2026-10-17)", () => {
  it("la regleta es parteix i deixa lliure la columna; la comanda per metres, el tros que queda", () => {
    const b = buildComposition(comp([column(250)]))
    const rails = b.extras.filter((p) => /wall-rail/.test(p.id))
    expect(rails).toHaveLength(1)
    expect(rails[0]!.length).toBe(450)
    expect(rails[0]!.placement.origin[0]).toBe(150)
    expect(b.linearOrders[0]!.cuts).toEqual([450])
  })

  it("el penjador que hi topa no es dibuixa i s'avisa; el de l'altra banda, sí", () => {
    const b = buildComposition(comp([column(250)]))
    expect(b.extras.some((p) => p.id.endsWith(":hanger-left"))).toBe(false)
    expect(b.extras.some((p) => p.id.endsWith(":hanger-right"))).toBe(true)
    expect(b.warnings.some((w) => w.code === "hanging" && w.message.includes("esquerre"))).toBe(true)
    expect(b.fittingOrders.filter((l) => /penjador/i.test(l.name)).map((l) => l.qty)).toEqual([1])
  })

  it("sense columna, res no canvia", () => {
    const b = buildComposition(comp([]))
    expect(b.extras.filter((p) => /wall-rail/.test(p.id)).map((p) => p.length)).toEqual([600])
    expect(b.extras.filter((p) => /:hanger-(left|right)$/.test(p.id))).toHaveLength(2)
  })
})
