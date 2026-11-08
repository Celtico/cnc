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

describe("el «Buc bàsic» del Taulell", () => {
  // La plantilla de fàbrica del Taulell (FACTORY_PRESETS «buc»).
  const buc = { id: 0, name: "Buc bàsic", D: 560, H: 860, W: 1000, back: "inside", bdep: 8, bset: 49, cm: "mel", cols: 1, dm: "mel", doors: false, drawerH: 181, drawers: 0, feet: "axilo", plinth: false, pl: 100, railV: "none", railW: 200, s32: true, shelves: 0, t: 19, tb: 19, topT: "front", pos: [0, 0, 0] as [number, number, number] }
  const r = fromTaulell({ cabs: [buc], parts: [], sketches: [], hw: [{ kind: "cabineo" }, { kind: "cabineo" }, { kind: "screw" }] }, () => "Melamina blanca")
  const m = r.composition.modules[0]!

  it("potes AXILO (de la biblioteca), fons per dins retirat i tapa amb només el travesser de davant", () => {
    expect(m.carcass.height).toBe(760)
    expect(m.carcass.base).toMatchObject({ kind: "legs", height: 100, hardware: { id: "leg-hafele-axilo78-screw-moble" } })
    expect(m.carcass.base.kind === "legs" && m.carcass.base.plinth).toBeFalsy()
    expect(m.carcass).toMatchObject({ back: "inset", backInsetSetback: 49, backThickness: 19, top: { kind: "rails", width: 200, back: false } })
  })

  it("el cnc el construeix com el Taulell: travesser de davant de 200 i el fons fins a dalt", () => {
    const ps = buildComposition(r.composition).panels
    const rail = ps.find((p) => p.id.endsWith(":top-front"))
    expect(rail).toBeDefined()
    expect(rail!.width).toBe(200)
    expect(ps.some((p) => p.id.endsWith(":top") || p.id.endsWith(":top-back"))).toBe(false)
    const back = ps.find((p) => p.role === "back")!
    expect(back.width).toBeCloseTo(760 - 19, 0)
  })

  it("diu el que encara no passa (les unions del Taulell)", () => {
    expect(r.warnings.join(" ")).toContain("2 × Cabineo, 1 × cargols")
  })
})

describe("la unió amb Cabineo del Taulell (cel, 2026-11-08)", () => {
  const buc = { id: 7, name: "Buc", D: 560, H: 860, W: 1000, back: "over", cm: "mel", dm: "mel", doors: false, drawers: 0, plinth: true, pl: 100, shelves: 0, t: 19, tb: 8, topT: "full", pos: [0, 0, 0] as [number, number, number] }
  const r = fromTaulell({ cabs: [buc], parts: [], sketches: [], hw: [{ kind: "cabineo", ref: { cab: 7, name: "Base" } }] }, () => "Melamina blanca")
  const m = r.composition.modules[0]!

  it("el mòdul fa la caixa amb Cabineo i ja no ho diu com a pendent", () => {
    expect(m.carcass.union).toBe("cabineo")
    expect(r.warnings.join(" ")).not.toContain("Cabineo")
  })

  it("la base i la tapa porten els tres buidats Ø15 a la cara que no es veu, i els laterals el forat del cargol", () => {
    const ps = buildComposition(r.composition).panels
    // Amb sòcol, la base és el prestatge fix de sobre la zona del sòcol.
    const bottom = ps.find((p) => p.role === "fixedShelf")!
    const top = ps.find((p) => p.role === "top")!
    const sides = ps.filter((p) => p.role === "side")
    const pockets = (p: typeof bottom) => p.holes.filter((h) => h.tag === "cabineo" && h.diameter === 15)
    // Fondària 560: a 50 dels caps i un al mig (la separació passa de 300) → 3 per costat, 2 costats, 3 buidats cadascun.
    expect(pockets(bottom)).toHaveLength(18)
    expect(pockets(top)).toHaveLength(18)
    expect(bottom.holes.some((h) => h.tag === "dowel")).toBe(false)
    // Totes dues, a la cara de sota (la de la base dona al sòcol; la de la tapa, a dins).
    const up = (p: typeof bottom, face: "A" | "B") => (face === "A" ? 1 : -1) * p.placement.zAxis[1]!
    expect(pockets(bottom).every((h) => up(bottom, h.face as "A" | "B") < 0)).toBe(true)
    expect(pockets(top).every((h) => up(top, h.face as "A" | "B") < 0)).toBe(true)
    for (const s of sides) expect(s.holes.filter((h) => h.tag === "cabineo" && h.diameter === 5)).toHaveLength(6)
  })
})
