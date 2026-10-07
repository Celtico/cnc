import { describe, expect, it } from "vitest"
import { buildComposition } from "./buildComposition"
import {
  CompositionSchema,
  DEFAULT_MODULE_HARDWARE,
  defaultModule,
  normalizeComposition,
  repairComposition,
  type Composition,
  type GenOp,
  type HardwareItem,
  type HardwarePlacement,
  type Panel,
} from "../model"
import { buildMobleFile, mobleToJson, parseMobleFile } from "../file/mobleFile"
import { toDxf } from "../export/dxf"

/** Un «només 3D» (perfil de porta corredissa) amb els mecanitzats del generador. */
function profile(ops: GenOp[], extra: Partial<HardwareItem> = {}): HardwareItem {
  return {
    id: "hw-slide",
    name: "Perfil corredissa",
    category: "door-system",
    engine: "model",
    params: {},
    targets: [{ key: "model", label: "Només 3D", ops: [] }],
    version: 1,
    machining: ops,
    ...extra,
  }
}

const groove: GenOp = { id: "g1", part: "top", kind: "groove", face: "A", along: "p", full: true, w: 8, depth: 10, p: { from: "ref", at: 0 }, q: { from: "max", at: 20 } }

function comp(placements: HardwarePlacement[], m = defaultModule("m1", "Baix")): Composition {
  return { modules: [m], references: [], hardwarePlacements: placements }
}
const onTop = (item: HardwareItem, more: Partial<HardwarePlacement> = {}): HardwarePlacement => ({ id: "pl1", item, targets: [{ part: "top", module: "m1", panel: "top" }], p: { from: "min", at: 0 }, q: { from: "min", at: 0 }, ...more })
const panel = (b: { panels: Panel[] }, id: string) => b.panels.find((p) => p.id === id)!
const fit = (x: { tag?: string }) => x.tag === "fitting"

describe("ferratges col·locats a mà", () => {
  it("una ranura de cantell a cantell a 20 mm del davant, a la cara de sota de la tapa", () => {
    const b = buildComposition(comp([onTop(profile([groove]))]))
    const top = panel(b, "m1:top")
    // La tapa: x = X (19…581), y = Z (0…560), cara A cap avall.
    expect(top.grooves.filter(fit)).toEqual([{ x: 0, y: 536, w: 562, h: 8, depth: 10, face: "A", tag: "fitting" }])
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
    // El volum del ferratge al 3D, al punt de referència.
    expect(top.fittings?.[0]).toMatchObject({ kind: "item", face: "A" })
  })

  it("el model 3D: v al llarg de Q (fondària a la tapa) i girat amb `turn`; els mecanitzats no canvien", () => {
    const imported = { maker: "TopSolid", article: "SL1", folders: [], files: [], proposed: [], confirmed: true, asset: "hwa-x", bbox: { min: [-9, 0, 0], max: [9, 3000, 18] } as { min: [number, number, number]; max: [number, number, number] } }
    const item = profile([groove], { imported })
    const top0 = panel(buildComposition(comp([onTop(item)])), "m1:top")
    const top90 = panel(buildComposition(comp([onTop(item, { turn: 90 })])), "m1:top")
    // La tapa: y local = Z (fondària).
    expect(top0.fittings?.[0]).toMatchObject({ kind: "item", asset: "hwa-x", v: [0, 1], face: "A" })
    expect(Math.abs(top90.fittings![0]!.v[0])).toBe(1)
    expect(top90.grooves).toEqual(top0.grooves)
  })

  it("forats a la cara A i B des del punt de referència, i repetits", () => {
    const ops: GenOp[] = [
      { id: "a", part: "top", kind: "drill", face: "A", d: 5, depth: 12, p: { from: "ref", at: 10 }, q: { from: "ref", at: 30 } },
      { id: "b", part: "top", kind: "drill", face: "B", d: 8, depth: 10, p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 } },
    ]
    const b = buildComposition(comp([onTop(profile(ops), { p: { from: "min", at: 50 }, q: { from: "max", at: 100 }, repeat: { axis: "p", count: 3, spacing: 200 } })]))
    const top = panel(b, "m1:top")
    // Referència: X 19 + 50 = 69 (x local 50), Z 560 − 100 = 460.
    expect(top.holes.filter((h) => h.tag === "fitting").map((h) => [h.face, h.x, h.y, h.diameter, h.depth])).toEqual([
      ["A", 60, 490, 5, 12],
      ["B", 50, 460, 8, 10],
      ["A", 260, 490, 5, 12],
      ["B", 250, 460, 8, 10],
      ["A", 460, 490, 5, 12],
      ["B", 450, 460, 8, 10],
    ])
    expect(top.fittings).toHaveLength(3)
  })

  it("forat de cantell al cantell de davant del lateral", () => {
    const op: GenOp = { id: "e", part: "side", kind: "drill", face: "edge", edge: "pmax", d: 8, depth: 30, p: { from: "ref", at: 0 }, q: { from: "min", at: 100 } }
    const b = buildComposition(comp([{ id: "pl", item: profile([op]), targets: [{ part: "side", module: "m1", panel: "side-left" }], p: { from: "min", at: 0 }, q: { from: "min", at: 0 } }]))
    const side = panel(b, "m1:side-left")
    // Lateral esquerre: x = Y, y = Z: el davant (Z = 560) és el cantell de dalt (local).
    expect(side.holes.filter((h) => h.tag === "fitting")).toEqual([{ x: 100, y: 560, diameter: 8, depth: 30, face: "edge", edge: "top", tag: "fitting" }])
  })

  it("tot o res: si una operació surt de la peça, cap de les del ferratge (i avís)", () => {
    const out: GenOp = { id: "x", part: "top", kind: "drill", face: "A", d: 5, depth: 12, p: { from: "max", at: -10 }, q: { from: "center", at: 0 } }
    const b = buildComposition(comp([onTop(profile([groove, out]))]))
    expect(panel(b, "m1:top").grooves.filter(fit)).toEqual([])
    expect(panel(b, "m1:top").holes.some((h) => h.tag === "fitting")).toBe(false)
    expect(b.warnings.find((w) => w.code === "hardware")?.message).toMatch(/fora de la peça.*cap mecanitzat/)
  })

  it("més fonda que el gruix: cap", () => {
    const b = buildComposition(comp([onTop(profile([{ ...groove, depth: 19 }]))]))
    expect(panel(b, "m1:top").grooves.filter(fit)).toEqual([])
    expect(b.warnings.some((w) => w.code === "hardware" && /passant/.test(w.message))).toBe(true)
  })

  it("una ranura passant és un tall (rect)", () => {
    const b = buildComposition(comp([onTop(profile([{ ...groove, through: true }]))]))
    expect(panel(b, "m1:top").cutouts).toEqual([{ kind: "rect", x: 0, y: 536, w: 562, h: 8, tag: "fitting" }])
  })

  it("els grups de l'item sense peça triada no es fan; triats expressament, sí", () => {
    const bottom: GenOp = { ...groove, id: "g2", part: "bottom", face: "A", q: { from: "max", at: 20 } }
    const item = profile([groove, bottom])
    const only = buildComposition(comp([onTop(item)]))
    expect(panel(only, "m1:bottom").grooves.filter(fit)).toEqual([])
    const both = buildComposition(comp([onTop(item, { targets: [{ part: "top", module: "m1", panel: "top" }, { part: "bottom", module: "m1", panel: "bottom" }] })]))
    // La base: x = X, y = −Z des de Z = 560 (cara A amunt): 20 del davant = y 20.
    expect(panel(both, "m1:bottom").grooves.filter(fit)).toEqual([{ x: 0, y: 16, w: 562, h: 8, depth: 10, face: "A", tag: "fitting" }])
  })

  it("importat sense confirmar o «només 3D» sense operacions: cap forat i avís", () => {
    const imported = { maker: "TopSolid", article: "SL1", folders: [], files: [], proposed: [], confirmed: false }
    const pending = buildComposition(comp([onTop(profile([groove], { imported }))]))
    expect(panel(pending, "m1:top").grooves.filter(fit)).toEqual([])
    expect(pending.warnings.find((w) => w.code === "hardware")?.message).toMatch(/no està confirmat/)
    const confirmed = buildComposition(comp([onTop(profile([groove], { imported: { ...imported, confirmed: true } }))]))
    expect(panel(confirmed, "m1:top").grooves.filter(fit)).toHaveLength(1)
    const bare = buildComposition(comp([onTop(profile([]))]))
    expect(panel(bare, "m1:top").grooves.filter(fit)).toEqual([])
    expect(bare.warnings.find((w) => w.code === "hardware")?.message).toMatch(/només 3D/)
  })

  it("una peça que ja no hi és (fons apagat: res amagat compta): cap i avís", () => {
    const m = defaultModule("m1", "Baix")
    m.carcass = { ...m.carcass, back: "none" }
    const op: GenOp = { id: "f", part: "back", kind: "drill", face: "A", d: 5, depth: 5, p: { from: "center", at: 0 }, q: { from: "center", at: 0 } }
    const b = buildComposition(comp([{ id: "pl", item: profile([op]), targets: [{ part: "back", module: "m1", panel: "back" }], p: { from: "min", at: 0 }, q: { from: "min", at: 0 } }], m))
    expect(b.warnings.find((w) => w.code === "hardware")?.message).toMatch(/ja no hi és/)
  })

  it("una peça lliure", () => {
    const c: Composition = {
      modules: [defaultModule("m1", "Baix")],
      references: [],
      parts: [{ id: "p1", name: "Tauler", orient: "flat", w: 800, h: 400, thickness: 19, material: "Melamina blanca", x: 0, y: 900, z: 0 }],
      hardwarePlacements: [{ id: "pl", item: profile([{ ...groove, part: "part" }]), targets: [{ part: "part", freePart: "p1" }], p: { from: "min", at: 0 }, q: { from: "min", at: 0 } }],
    }
    const b = buildComposition(c)
    expect(panel(b, "part:p1").grooves.filter(fit)).toHaveLength(1)
    expect(panel(b, "part:p1").grooves.filter(fit)[0]).toMatchObject({ w: 800, h: 8, depth: 10 })
  })

  it("arriba al DXF a la capa de la ranura", () => {
    const b = buildComposition(comp([onTop(profile([groove]))]))
    const dxf = toDxf([panel(b, "m1:top")])
    expect(dxf).toContain("GROOVE_W8_P10")
  })

  it("sense col·locats, les peces són les mateixes (el golden no canvia)", () => {
    const a = buildComposition({ modules: [defaultModule("m1", "Baix")], references: [] })
    const b = buildComposition(comp([]))
    expect(b.panels).toEqual(a.panels)
  })
})

describe("lectura i fitxer", () => {
  const good = onTop(profile([groove]))
  it("un col·locat dolent es treu sencer (mai mig ferratge) i la resta queda", () => {
    const bad = { ...good, id: "pl2", item: { ...good.item, machining: [{ ...groove, w: "ample" }] } }
    const raw = { ...comp([good]), hardwarePlacements: [good, bad] }
    expect(CompositionSchema.safeParse(raw).success).toBe(false)
    const res = repairComposition(raw)
    expect(res.composition?.hardwarePlacements?.map((p) => p.id)).toEqual(["pl1"])
    expect(res.composition?.hardwarePlacements?.[0]!.item.machining).toHaveLength(1)
    expect(res.problems.join(" ")).toMatch(/Ferratge col·locat/)
  })

  it("migració idempotent: llegir dues vegades dona el mateix", () => {
    const c = comp([good])
    const once = normalizeComposition(CompositionSchema.parse(c))
    const twice = normalizeComposition(CompositionSchema.parse(JSON.parse(JSON.stringify(once))))
    expect(twice).toEqual(once)
    expect(once.hardwarePlacements).toEqual(c.hardwarePlacements)
  })

  it(".moble: v3 amb col·locats (una app d'abans el rebutja) i es torna a llegir igual", () => {
    const file = buildMobleFile({ name: "x", composition: comp([good]), references: [] })
    expect(file.version).toBe(3)
    const res = parseMobleFile(mobleToJson(file))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.project.composition.hardwarePlacements).toEqual([good])
    // Sense col·locats: com abans.
    expect(buildMobleFile({ name: "x", composition: { modules: [defaultModule("m1", "Baix")], references: [] }, references: [] }).version).toBe(1)
    const withImported = { modules: [{ ...defaultModule("m1", "Baix"), hardware: { ...DEFAULT_MODULE_HARDWARE, hinge: { ...DEFAULT_MODULE_HARDWARE.hinge, imported: { maker: "H", article: "1", folders: [], files: [], proposed: [], confirmed: true } } } }], references: [] }
    expect(buildMobleFile({ name: "x", composition: withImported, references: [] }).version).toBe(2)
  })
})
