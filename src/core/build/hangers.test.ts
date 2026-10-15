import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, DEFAULT_SETTINGS, HANGER_ITEM, V45_ITEMS, WALL_RAIL_ITEM, applySettingsToModule, defaultModule, parseSettings, setModuleMount, usedHardwareSlots, type Composition, type HardwareItem, type Module } from "../model"
import { toWorld } from "./geometry"
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
  it("per defecte (Libra H2): quatre forats Ø10 × 13 a cada lateral, darrere del fons, la ranura del fons, el cos i la regleta", () => {
    const b = buildModule(wallModule())
    for (const id of ["side-left", "side-right"]) {
      const hs = hangerHoles(b, id)
      expect(hs).toHaveLength(4)
      expect(hs.every((h) => h.diameter === 10 && h.depth === 13)).toBe(true)
    }
    // El fons no porta osca: dues ranures de 12 × 54,5 per regular els penjadors des de dins.
    const back = b.panels.find((p) => p.role === "back")!
    expect(back.outline).toBeUndefined()
    const slots = (back.cutouts ?? []).filter((c) => c.tag === "hanger")
    expect(slots).toHaveLength(2)
    expect(slots.every((c) => c.kind === "slot" && [c.w, c.h].sort((x, y) => x - y).join() === "12,54.5")).toBe(true)
    expect(b.extras.filter((p) => /^hanger-(left|right)$/.test(p.id))).toHaveLength(2)
    const rail = b.extras.find((p) => p.id === "wall-rail")!
    expect(rail.length).toBe(600)
    expect(rail.width).toBe(33.5)
    expect(b.linear).toHaveLength(1)
    expect(b.linear[0]!.item.id).toBe(WALL_RAIL_ITEM.id)
    expect(b.fittingOrders.find((l) => l.component === HANGER_ITEM.id)?.qty).toBe(2)
    expect(b.warnings).toEqual([])
    expect(usedHardwareSlots(wallModule()).get("hanger")?.count).toBe(2)
  })

  it("els forats: en columna a 32, el primer a 37 sota la tapa i l'eix a 5 darrere del fons (fons retirat 20: a 15 del darrere)", () => {
    const b = buildModule(wallModule())
    const side = b.panels.find((p) => p.id === "side-left")!
    const world = hangerHoles(b, "side-left").map((h) => toWorld(side, [h.x, h.y, 0]))
    // Mòdul de 720 amb tapa de 19: sota la tapa a 701.
    expect(world.map((w) => w[1]).sort((x, y) => y - x)).toEqual([664, 632, 600, 568])
    expect(new Set(world.map((w) => w[2]))).toEqual(new Set([15]))
  })

  it("el penjador d'abans (còpia v1 desada al mòdul): els forats de sempre i l'osca del fons", () => {
    const v1: HardwareItem = {
      ...HANGER_ITEM,
      params: { fromTop: 37, fromBack: 37, pitch: 32, holeDiameter: 10, holeDepth: 12, gap: 16, railTop: 30, notchWidth: 20, notchHeight: 110, bodyWidth: 20, bodyHeight: 90, bodyDepth: 60 },
      targets: [{ key: "side", label: "Lateral", ops: [[0, 0], [0, "pitch"], ["pitch", 0], ["pitch", "pitch"]].map(([u, v]) => ({ kind: "drill" as const, face: "A" as const, u: u!, v: v!, d: "holeDiameter", depth: "holeDepth", tag: "hanger" })) }],
      version: 1,
    }
    const b = buildModule(wallModule("a", { base: { kind: "wall", height: 1450, hanger: v1 } }))
    expect(hangerHoles(b, "side-left").every((h) => h.depth === 12)).toBe(true)
    expect(b.panels.find((p) => p.role === "back")!.outline).toHaveLength(8)
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

  it("avisa si el fons no deixa lloc al penjador i la regleta (cargolat o en ranura a menys de 15 mm), sense forats", () => {
    for (const patch of [{ back: "screwed" as const }, { backSetback: 10 }]) {
      const b = buildModule(wallModule("a", patch))
      expect(b.warnings.map((w) => w.code)).toEqual(["hanging"])
      expect(hangerHoles(b, "side-left")).toHaveLength(0)
    }
  })

  it("un mòdul penjat nou porta el fons estàndard (en ranura, retirat 20); els desats no es toquen", () => {
    const m = defaultModule("n", "Alt", { back: "screwed", base: { kind: "wall", height: 1450 } })
    expect([m.carcass.back, m.carcass.backSetback]).toEqual(["groove", 20])
    const hung = setModuleMount(defaultModule("f", "Baix"), "hung", 0)
    expect([hung.carcass.back, hung.carcass.backSetback]).toEqual(["groove", 20])
    expect(applySettingsToModule(DEFAULT_SETTINGS, m).carcass.backSetback).toBe(20)
    expect(defaultModule("g", "Baix").carcass.backSetback).toBe(10)
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

  it("els items inicials d'abans (v1: penjador, regleta, sòcols) passen a l'estàndard en llegir les preferències", () => {
    const old = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    old.hardwareLibrary = old.hardwareLibrary.map((x: HardwareItem) => (V45_ITEMS.some((k) => k.id === x.id) ? { ...x, version: 1, params: { ...x.params, gap: 16 } } : x))
    const res = parseSettings(old)
    expect(res.migrated).toBe(true)
    for (const k of V45_ITEMS) expect(res.settings.hardwareLibrary.find((x) => x.id === k.id)).toEqual(k)
  })
})
