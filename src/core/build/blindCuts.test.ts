import { describe, expect, it } from "vitest"
import type { Composition } from "../model"
import { buildComposition } from "./buildComposition"

/** Un tauler estirat de 600 × 400 × 30 (de y 0 a 30) i un objecte que talla de dalt a baix (eix Y). */
function comp(cutter: Record<string, unknown>): Composition {
  return {
    kind: "moble",
    modules: [],
    parts: [{ id: "p", name: "Tauler", orient: "flat", w: 600, h: 400, thickness: 30, material: "Fusta fosca", x: 0, y: 0, z: 0 }],
    references: [{ id: "c", name: "Tall", effect: "cut", axis: "y", ...cutter }],
  } as unknown as Composition
}
const board = (b: ReturnType<typeof buildComposition>) => b.panels.find((p) => p.id === "part:p")!

describe("objectes que tallen de cara sense travessar (per decisió de l'usuari, 2026-10-17: «que no foradi si no traspassa»)", () => {
  it("de banda a banda: forat passant, com sempre", () => {
    const b = buildComposition(comp({ shape: "cylinder", w: 30, h: 100, d: 30, x: 100, y: -20, z: 100 }))
    expect(board(b).cutouts?.map((c) => c.kind)).toEqual(["circle"])
  })

  it("cilindre de Ø30 que entra 12 per dalt: un forat de 12, no passant", () => {
    const b = buildComposition(comp({ shape: "cylinder", w: 30, h: 50, d: 30, x: 100, y: 18, z: 100 }))
    const p = board(b)
    expect(p.cutouts ?? []).toEqual([])
    expect(p.holes.filter((h) => h.tag === "ref").map((h) => [h.diameter, h.depth])).toEqual([[30, 12]])
    expect(b.warnings.filter((w) => w.code === "ref-cut")).toEqual([])
  })

  it("caixa que entra 10: un buidat rectangular de 10", () => {
    const b = buildComposition(comp({ w: 80, h: 40, d: 50, x: 100, y: 20, z: 100 }))
    const p = board(b)
    expect(p.cutouts ?? []).toEqual([])
    expect(p.grooves.filter((g) => g.tag === "ref").map((g) => [g.w * g.h, g.depth])).toEqual([[4000, 10]])
  })

  it("rodó gros o fins al cantell: es veu al 3D (booleà) i s'avisa", () => {
    const b = buildComposition(comp({ shape: "cylinder", w: 100, h: 50, d: 100, x: -50, y: 15, z: 100 }))
    const p = board(b)
    expect(p.cutouts ?? []).toEqual([])
    expect(p.outline).toBeUndefined()
    expect(p.solidCuts).toHaveLength(1)
    expect(b.warnings.some((w) => w.code === "ref-cut" && w.message.includes("sense travessar"))).toBe(true)
  })
})
