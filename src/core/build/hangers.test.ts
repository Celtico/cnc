import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, DEFAULT_SETTINGS, HANGER_ITEM, V45_ITEMS, WALL_RAIL_ITEM, defaultModule, parseSettings, usedHardwareSlots, type Composition, type Module } from "../model"
import { buildComposition } from "./buildComposition"
import { buildModule } from "./buildModule"
import { linearGroups } from "./linearOrders"

/** Un alt penjat de 600 × 720 × 330 amb el fons en ranura a 20 mm del darrere (hi cap la regleta). */
function wallModule(id = "a", patch: Partial<Module["carcass"]> = {}): Module {
  const m = defaultModule(id, "Alt")
  return { ...m, carcass: { ...m.carcass, width: 600, height: 720, depth: 330, back: "groove", backSetback: 20, base: { kind: "wall", height: 1450 }, ...patch } }
}

const hangerHoles = (b: ReturnType<typeof buildModule>, id: string) => b.panels.find((p) => p.id === id)!.holes.filter((h) => h.tag === "hanger")

describe("penjadors dels mòduls penjats (v45)", () => {
  it("per defecte: quatre forats Ø10 a cada lateral, a la cantonada de dalt i darrere, l'osca del fons, el cos i la regleta", () => {
    const b = buildModule(wallModule())
    for (const id of ["side-left", "side-right"]) {
      const hs = hangerHoles(b, id)
      expect(hs).toHaveLength(4)
      expect(hs.every((h) => h.diameter === 10 && h.depth === 12)).toBe(true)
    }
    // El fons porta l'osca a les dues cantonades de dalt (contorn de 8 punts).
    const back = b.panels.find((p) => p.role === "back")!
    expect(back.outline).toHaveLength(8)
    expect(b.extras.filter((p) => /^hanger-(left|right)$/.test(p.id))).toHaveLength(2)
    const rail = b.extras.find((p) => p.id === "wall-rail")!
    expect(rail.length).toBe(600)
    expect(b.linear).toHaveLength(1)
    expect(b.linear[0]!.item.id).toBe(WALL_RAIL_ITEM.id)
    expect(b.fittingOrders.find((l) => l.component === HANGER_ITEM.id)?.qty).toBe(2)
    expect(b.warnings.filter((w) => w.code === "hanging")).toEqual([])
    expect(usedHardwareSlots(wallModule()).get("hanger")?.count).toBe(2)
  })

  it("els forats van a 37 de dalt i del darrere del lateral, a 32 (cara de dins)", () => {
    const b = buildModule(wallModule())
    const side = b.panels.find((p) => p.id === "side-left")!
    // El lateral és 720 (alçada) × 330 (fondària): les coordenades locals depenen de com s'ha girat; n'hi ha prou amb les
    // distàncies entre forats i que caiguin a la cantonada.
    const hs = hangerHoles(b, "side-left")
    const xs = [...new Set(hs.map((h) => h.x))].sort((a, b) => a - b)
    const ys = [...new Set(hs.map((h) => h.y))].sort((a, b) => a - b)
    expect(xs[1]! - xs[0]!).toBeCloseTo(32)
    expect(ys[1]! - ys[0]!).toBeCloseTo(32)
    const near = (v: number, L: number) => Math.min(Math.abs(v - 37), Math.abs(L - v - 37)) < 0.01
    expect(xs.some((x) => near(x, side.length)) && ys.some((y) => near(y, side.width))).toBe(true)
  })

  it("«Cap»: ni forats, ni osca, ni regleta; sense regleta, els penjadors sí", () => {
    const none = buildModule(wallModule("a", { base: { kind: "wall", height: 1450, hanger: "none" } }))
    expect(hangerHoles(none, "side-left")).toHaveLength(0)
    expect(none.panels.find((p) => p.role === "back")!.outline).toBeUndefined()
    expect(none.extras.some((p) => p.id === "wall-rail")).toBe(false)
    expect(none.linear).toHaveLength(0)
    const noRail = buildModule(wallModule("a", { base: { kind: "wall", height: 1450, rail: "none" } }))
    expect(hangerHoles(noRail, "side-left")).toHaveLength(4)
    expect(noRail.linear).toHaveLength(0)
  })

  it("avisa si el fons no deixa lloc a la regleta (cargolat o en ranura a menys de 16 mm)", () => {
    expect(buildModule(wallModule("a", { back: "screwed" })).warnings.some((w) => w.code === "hanging")).toBe(true)
    expect(buildModule(wallModule("a", { backSetback: 10 })).warnings.some((w) => w.code === "hanging")).toBe(true)
  })

  it("un mòdul a terra no en porta", () => {
    const m = wallModule("a", { base: { kind: "none" } })
    expect(hangerHoles(buildModule(m), "side-left")).toHaveLength(0)
    expect(usedHardwareSlots(m).has("hanger")).toBe(false)
  })

  it("la regleta de dos penjats seguits és un sol tros a la comanda", () => {
    const comp: Composition = { id: "c", name: "t", modules: [wallModule("a"), wallModule("b")], references: [], parts: [], models: [] } as unknown as Composition
    const b = buildComposition(comp)
    expect(b.linearOrders).toHaveLength(1)
    const o = b.linearOrders[0]!
    expect(o.cuts).toEqual([1200])
    expect(o.bars).toBe(1)
    expect(o.modules).toEqual([1, 2])
    // Clips (cargols): un cada 300 entre els dels extrems (a 50): 1100 / 300 → 4 + 1.
    expect(o.clips).toBe(5)
    const g = linearGroups(b.linearOrders)[0]!
    expect(g.lines[0]!.name).toContain("barra de 2000")
    expect(g.lines[0]!.note).toContain("1200")
  })

  it("els alts de la cuina del catàleg porten penjadors i la regleta per trams", () => {
    const c = BUILTIN_TEMPLATES.find((t) => t.id === "modern-kitchen")!.make()
    const b = buildComposition(c)
    const walls = c.modules.filter((m) => m.carcass.base.kind === "wall").length
    expect(b.extras.filter((p) => /:hanger-(left|right)$/.test(p.id))).toHaveLength(2 * walls)
    expect(b.linearOrders[0]!.total).toBe(c.modules.filter((m) => m.carcass.base.kind === "wall").reduce((n, m) => n + m.carcass.width, 0))
  })

  it("v45: el penjador, la regleta i els sòcols d'alumini s'afegeixen a unes preferències d'abans", () => {
    const v44 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 44, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => !V45_ITEMS.some((k) => k.id === x.id)) }
    delete v44.hardwareDefaults.hanger
    delete v44.hardwareDefaults.wallRail
    const res = parseSettings(v44)
    expect(res.migrated).toBe(true)
    for (const k of V45_ITEMS) expect(res.settings.hardwareLibrary.filter((x) => x.id === k.id)).toHaveLength(1)
    expect(res.settings.hardwareDefaults.hanger).toBe(HANGER_ITEM.id)
    expect(res.settings.hardwareDefaults.wallRail).toBe(WALL_RAIL_ITEM.id)
    expect(parseSettings(JSON.parse(JSON.stringify(res.settings))).migrated).toBe(false)
  })
})
