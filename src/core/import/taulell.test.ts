import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { fromTaulell, type TaulellDoc } from "./taulell"

const mat = (k: string | undefined) => (k === "roure" ? "Roure" : "Melamina blanca")
const HOR: [number, number, number, number] = [0, 0, 0, 1]
// quatFromBasis(QZ, QX, QY): x local → z del món, y local (gruix) → x del món.
const SID: [number, number, number, number] = [0.5, 0.5, 0.5, -0.5]

describe("Taulell 3D → cnc", () => {
  const doc: TaulellDoc = {
    name: "Cuina del Taulell",
    cabs: [
      { id: 2, name: "Calaixera", W: 600, H: 860, D: 560, t: 19, pl: 100, plinth: true, back: "over", cols: 1, shelves: 0, drawers: 4, drawerH: 180, doors: false, cm: "mel", dm: "roure", pos: [1300, 0, 0] },
      { id: 1, name: "Buc", W: 1000, H: 860, D: 560, t: 19, tb: 8, pl: 100, plinth: false, feet: "axilo", back: "inside", cols: 2, shelves: 1, drawers: 1, drawerH: 180, doors: true, cm: "mel", dm: "roure", pos: [200, 0, 0] },
    ],
    parts: [
      { id: 10, name: "Tauler de dalt", prof: { type: "rect", L: 1700, W: 600 }, T: 30, pos: [200, 860, 0], quat: HOR, mat: "roure" },
      { id: 11, name: "Lateral solt", prof: { type: "rect", L: 560, W: 860 }, T: 19, pos: [1900, 0, 0], quat: SID, mat: "mel" },
      { id: 12, name: "Forma", prof: { type: "poly", pts: [[0, 0], [100, 0], [0, 100]] }, T: 19, pos: [0, 0, 0], quat: HOR },
      { id: 13, name: "Lateral", prof: { type: "rect", L: 560, W: 760 }, T: 19, pos: [0, 0, 0], quat: SID, cab: 1 },
    ],
  }
  const r = fromTaulell(doc, mat)

  it("passa els mobles paramètrics a mòduls, d'esquerra a dreta, amb l'espai entre ells", () => {
    expect(r.modules).toBe(2)
    const [a, b] = r.composition.modules
    expect(a!.name).toBe("Buc")
    expect(a!.carcass).toMatchObject({ width: 1000, height: 760, depth: 560, thickness: 19, back: "inset", backThickness: 8, frontMaterial: "Roure" })
    expect(a!.root.split?.dir).toBe("v")
    expect(a!.root.split?.children).toHaveLength(2)
    expect(b!.gapBefore).toBe(100)
    expect(b!.carcass.height).toBe(860)
  })

  it("passa les peces soltes rectes i alineades; les altres, comptades", () => {
    expect(r.parts).toBe(2)
    const [top, side] = r.composition.parts!
    expect(top).toMatchObject({ orient: "flat", w: 1700, h: 600, thickness: 30, x: 0, y: 860, z: 0, material: "Roure" })
    expect(side).toMatchObject({ orient: "side", w: 560, h: 860, thickness: 19, x: 1700, y: 0 })
    expect(r.skipped.shapes).toBe(1)
  })

  it("el cnc el construeix: calaixos a baix i portes a dalt", () => {
    const build = buildComposition(r.composition)
    const panels = build.panels
    const fronts = panels.filter((p) => p.role === "drawerFront")
    const doors = panels.filter((p) => p.role === "door")
    expect(fronts.length).toBe(2 + 4)
    expect(doors.length).toBeGreaterThanOrEqual(2)
    // Els avisos de disseny del cnc (fons encastat de 8 mm, fons de calaix) són de debò: el Taulell no els fa.
    expect(new Set(build.warnings.map((w) => w.code))).toEqual(new Set(["back-inset", "drawer-bottom"]))
  })
})

describe("ordre de la divisió", () => {
  it("al Buc, els calaixos queden per sota de les portes", () => {
    const r = fromTaulell({ cabs: [{ id: 1, W: 600, H: 860, D: 560, t: 19, pl: 100, plinth: true, shelves: 1, drawers: 1, drawerH: 180, doors: true, pos: [0, 0, 0] }] }, () => "Melamina blanca")
    const ps = buildComposition(r.composition).panels
    const yOf = (role: string) => Math.min(...ps.filter((p) => p.role === role).map((p) => p.placement.origin[1]))
    expect(yOf("drawerFront")).toBeLessThan(yOf("door"))
  })
})
