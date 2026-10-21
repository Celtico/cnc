import { describe, expect, it } from "vitest"
import { storeBuilders, type Composition, type Module } from "../model"
import { buildComposition } from "./buildComposition"
import { JOIN_MAX_LENGTH } from "./joinPanels"

// Peces unides (per decisió de l'usuari, 2026-10-21): dos mòduls que es toquen sense cap lateral entre ells.
const { box, h, open } = storeBuilders
const mod = (name: string, sides: { left: boolean; right: boolean }, o: { w?: number; d?: number; mat?: string } = {}): Module =>
  box(name, { w: o.w ?? 600, h: 800, d: o.d ?? 400, mat: o.mat ?? "Melamina blanca", sides }, h(["auto", "auto"], [open(1), open(1)]))
const comp = (...modules: Module[]): Composition => ({ kind: "moble", modules, references: [] })
const of = (c: Composition, role: string) => buildComposition(c).panels.filter((p) => p.role === role)

describe("peces unides de mòduls que es toquen", () => {
  it("sense lateral entre ells: la base, la tapa i el prestatge fix, d'una peça", () => {
    const c = comp(mod("A", { left: true, right: false }), mod("B", { left: false, right: true }))
    for (const role of ["bottom", "top", "fixedShelf"]) {
      const ps = of(c, role)
      expect(ps, role).toHaveLength(1)
      expect(ps[0]!.length).toBe(1200 - 2 * 19)
      expect(ps[0]!.label).toContain("mòduls 1 + 2")
    }
    // Els forats de les dues meitats hi són.
    const b = buildComposition(comp(mod("A", { left: true, right: true }), mod("B", { left: true, right: true })))
    const holes = b.panels.filter((p) => p.role === "bottom").reduce((n, p) => n + p.holes.length, 0)
    expect(of(c, "bottom")[0]!.holes.length).toBeLessThanOrEqual(holes)
    expect(of(c, "bottom")[0]!.holes.length).toBeGreaterThan(0)
  })

  it("tres en cadena: una sola peça", () => {
    const c = comp(mod("A", { left: true, right: false }), mod("B", { left: false, right: false }), mod("C", { left: false, right: true }))
    const ps = of(c, "bottom")
    expect(ps).toHaveLength(1)
    expect(ps[0]!.length).toBe(1800 - 2 * 19)
    expect(ps[0]!.label).toContain("mòduls 1 + 2 + 3")
  })

  it("amb un lateral entre ells, d'un altre material o fondària, o massa llarga: cadascuna la seva", () => {
    expect(of(comp(mod("A", { left: true, right: false }), mod("B", { left: true, right: true })), "bottom")).toHaveLength(2)
    expect(of(comp(mod("A", { left: true, right: false }), mod("B", { left: false, right: true }, { mat: "Roure massís / xapat" })), "bottom")).toHaveLength(2)
    expect(of(comp(mod("A", { left: true, right: false }), mod("B", { left: false, right: true }, { d: 450 })), "bottom")).toHaveLength(2)
    const w = Math.ceil(JOIN_MAX_LENGTH / 2) + 50
    expect(of(comp(mod("A", { left: true, right: false }, { w }), mod("B", { left: false, right: true }, { w })), "bottom")).toHaveLength(2)
  })
})
