import { describe, expect, it } from "vitest"
import { addCorner, defaultModule, type Composition, type Module } from "../model"
import { buildComposition } from "./buildComposition"
import { panelBox } from "./geometry"

// El braç de la fila de l'armari en L de cel (2026-10-20): una porta, 1000 mm, 560 de fons.
const row = (): Composition => {
  const m: Module = defaultModule("a", "Armari", { width: 1000, height: 2000, depth: 560 })
  return { kind: "moble", modules: [{ ...m, root: { id: "r", front: { kind: "door", mode: "single", hinge: "left" } as never } }], references: [] }
}

describe("cantonada en L amb dos mòduls (`addCorner`)", () => {
  it.each(["left", "right"] as const)("cantonada a la %s: dues portes a 90° que es toquen al racó sense trepitjar-se", (side) => {
    const res = addCorner(row(), "a", side)!
    const a = res.comp.modules.find((m) => m.id === "a")!
    expect(a.carcass.sides[side]).toBe(false)
    const arm = res.comp.modules.find((m) => m.id === res.id)!
    expect(arm.rot).toBe(side === "right" ? 270 : 90)
    const doors = buildComposition(res.comp).panels.filter((p) => p.role === "door").map(panelBox)
    expect(doors).toHaveLength(2)
    // Una mira endavant (prima en Z) i l'altra de costat (prima en X).
    const front = doors.find((b) => b.max[2] - b.min[2] < 30)!
    const turned = doors.find((b) => b.max[0] - b.min[0] < 30)!
    expect(front && turned).toBeTruthy()
    // No es trepitgen.
    const overlap = [0, 2].every((k) => Math.min(front.max[k]!, turned.max[k]!) - Math.max(front.min[k]!, turned.min[k]!) > 0.5)
    expect(overlap).toBe(false)
    // Es toquen al racó: a menys de 10 mm en planta.
    const gapX = side === "right" ? turned.min[0]! - front.max[0]! : front.min[0]! - turned.max[0]!
    const gapZ = turned.min[2]! - front.max[2]!
    expect(Math.abs(gapX)).toBeLessThan(10)
    expect(Math.abs(gapZ)).toBeLessThan(10)
  })
})
