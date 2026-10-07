import { describe, expect, it } from "vitest"
import { ACCESSORY_ITEMS, DEFAULT_HARDWARE_KITS, DEFAULT_MODULE_HARDWARE, ZoneSchema, defaultModule, fixHardwareDefaults, libraryFromLegacy, DEFAULT_LEGACY_HARDWARE, repairComposition, setFront, usedHardwareSlots, type HardwareItem, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { buildComposition } from "./buildComposition"
import { ruleHardwareCounts } from "./hardwareSummary"

/**
 * Auditoria de coherència B: la barra de penjar, la tira LED i el marc de vitrina són ferratges de la biblioteca (motors
 * `rail`, `ledProfile`, `glassFrame`), no interruptors de fusta; el push és una tria del tirador, una sola font amb el
 * tancament del joc; l'imant de la reixeta i la pota es trien com la resta.
 */

const mod = (root: Partial<Zone>, patch: Partial<Module> = {}): Module => {
  const m = defaultModule("m1", "M", { width: 1000, height: 2000, depth: 500 })
  return { ...m, ...patch, root: { ...m.root, ...root } }
}
const extras = (m: Module) => buildModule(m).extras

describe("barra i LED com a ferratges", () => {
  it("els booleans d'abans es llegeixen com a accessori (true → {}, false → cap), idempotent", () => {
    expect(ZoneSchema.parse({ id: "a", rail: true, led: false })).toEqual({ id: "a", rail: {} })
    const once = ZoneSchema.parse({ id: "a", rail: true })
    expect(ZoneSchema.parse(once)).toEqual(once)
    // Una còpia pròpia es llegeix sencera o res.
    const bad = { id: "a", rail: { hardware: { ...DEFAULT_MODULE_HARDWARE.rail, params: "x" } } }
    const rep = repairComposition({ modules: [mod(bad as unknown as Zone)], references: [] })
    expect(rep.composition!.modules[0]!.root.rail).toEqual({})
  })
  it("la geometria d'ara surt de l'item: Ø25 a 50 del sostre, perfil 16 × 8 a 20 del davant", () => {
    const a = extras(mod({ rail: {}, led: {}, shelves: { n: 1, adjustable: false } }))
    const rail = a.find((p) => p.id.startsWith("rail-"))!
    expect([rail.length, rail.width]).toEqual([25, 25])
    const leds = a.filter((p) => p.id.startsWith("led-"))
    expect(leds).toHaveLength(2)
    expect([leds[0]!.width, leds[0]!.thickness]).toEqual([16, 8])
    // Un item propi canvia la geometria; el del mòdul també.
    const fat = { ...DEFAULT_MODULE_HARDWARE.rail, params: { diameter: 30, drop: 80 } }
    const b = extras(mod({ rail: { hardware: fat } }))
    expect(b.find((p) => p.id.startsWith("rail-"))!.length).toBe(30)
    const c = extras({ ...mod({ rail: {} }), hardware: { ...DEFAULT_MODULE_HARDWARE, rail: fat } })
    expect(c.find((p) => p.id.startsWith("rail-"))!.length).toBe(30)
    // Sense còpia al mòdul (mòdul d'abans), l'item d'inici.
    const { rail: _r, led: _l, glassFrame: _g, ...old } = DEFAULT_MODULE_HARDWARE
    expect(extras({ ...mod({ rail: {} }), hardware: old }).find((p) => p.id.startsWith("rail-"))!.length).toBe(25)
  })
  it("els llocs i els comptes de «Ferratges»", () => {
    const m = mod({ rail: {}, led: {}, shelves: { n: 2, adjustable: false } })
    const used = usedHardwareSlots(m)
    expect(used.get("rail")).toEqual({ count: 1, what: "barres de penjar" })
    expect(used.get("led")).toEqual({ count: 1, what: "llums" })
    const b = buildComposition({ modules: [m], references: [] })
    const counts = ruleHardwareCounts(b.panels, 0, b.extras)
    expect(counts.find((c) => c.id === "rail")).toMatchObject({ count: 1 })
    expect(counts.find((c) => c.id === "led")).toMatchObject({ count: 3 })
    expect(counts.find((c) => c.id === "led")!.detail).toMatch(/m de perfil/)
  })
  it("la biblioteca inicial porta els accessoris i unes preferències d'abans els reben (per defecte de cada lloc)", () => {
    expect(ACCESSORY_ITEMS.map((x) => x.category)).toEqual(["wall", "profile", "profile"])
    const fixed = fixHardwareDefaults(libraryFromLegacy(DEFAULT_LEGACY_HARDWARE), {})
    expect(fixed.changed).toBe(true)
    expect(fixed.defaults.rail).toBe("rail-inox-25")
    expect(fixed.library.some((x) => x.engine === "ledProfile")).toBe(true)
  })
})

describe("marc de vitrina i imant de la reixeta", () => {
  it("la porta de vidre llegeix el marc (perfil i vidre) de l'item", () => {
    const glass = (frame?: HardwareItem) => extras(mod({ front: { kind: "door", mode: "single", hinge: "left", glass: true, ...(frame ? { frame } : {}) } }))
    const a = glass()
    expect(a.find((p) => p.id.endsWith("-left"))!.width).toBe(20)
    expect(a.find((p) => p.id.endsWith("-glass"))!.thickness).toBe(5)
    const b = glass({ ...DEFAULT_MODULE_HARDWARE.glassFrame, params: { frame: 30, glass: 6 } })
    expect(b.find((p) => p.id.endsWith("-left"))!.width).toBe(30)
    expect(b.find((p) => p.id.endsWith("-glass"))!.thickness).toBe(6)
    expect(usedHardwareSlots(mod({ front: { kind: "door", mode: "double", hinge: "left", glass: true } })).get("glassFrame")?.count).toBe(2)
    const c = buildComposition({ modules: [mod({ front: { kind: "door", mode: "double", hinge: "left", glass: true } })], references: [] })
    expect(ruleHardwareCounts(c.panels, 0, c.extras).find((x) => x.id === "glassFrame")).toMatchObject({ count: 2 })
  })
  it("la reixeta desmuntable fa servir l'imant triat", () => {
    const grille = (hardware?: HardwareItem): Module => mod({ front: { kind: "grille", pattern: { kind: "slotsV", slotWidth: 8, slotGap: 8, margin: 60, holeDiameter: 10, holePitch: 16 }, mount: "removable", hinge: "left", ...(hardware ? { hardware } : {}) } })
    const d = (m: Module) => buildModule(m).panels.find((p) => p.role === "grille")!.holes.filter((h) => h.tag === "magnet").map((h) => h.diameter)
    expect(new Set(d(grille()))).toEqual(new Set([10]))
    expect(new Set(d(grille({ ...DEFAULT_MODULE_HARDWARE.magnet, params: { ...DEFAULT_MODULE_HARDWARE.magnet.params, diameter: 20 } })))).toEqual(new Set([20]))
  })
})

describe("push: una sola font", () => {
  const kit14 = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-ht14")!
  const fronts = (m: Module) => buildModule(m).panels.filter((p) => p.role === "drawerFront")
  const holes = (m: Module) => fronts(m).map((p) => (p.cutouts ?? []).filter((c) => c.tag === "handle").length)
  it("«Cap (push)» al front: cap forat, `push`, i l'avís del ferratge push", () => {
    const m = mod({}, {})
    const none = { ...m, root: setFront(m.root, m.root.id, { kind: "drawers", n: 2, heights: ["auto", "auto"], handle: "none" }) }
    expect(holes(none)).toEqual([0, 0])
    expect(fronts(none).every((p) => p.push)).toBe(true)
    expect(buildModule(none).warnings.some((w) => w.code === "push")).toBe(true)
    expect(usedHardwareSlots(none).has("handle")).toBe(false)
  })
  it("un joc push-open: cap tirador ni forats, sense l'avís (el push el posa el joc); suau: tirador", () => {
    const m = mod({}, {})
    const push = { ...m, root: setFront(m.root, m.root.id, { kind: "drawers", n: 2, heights: ["auto", "auto"], hardware: structuredClone(kit14), kit: { closing: "push", back: "metal" } }) }
    expect(holes(push)).toEqual([0, 0])
    expect(fronts(push).every((p) => p.push)).toBe(true)
    expect(buildModule(push).warnings.some((w) => w.code === "push")).toBe(false)
    expect(usedHardwareSlots(push).has("handle")).toBe(false)
    const soft = { ...m, root: setFront(m.root, m.root.id, { kind: "drawers", n: 2, heights: ["auto", "auto"], hardware: structuredClone(kit14), kit: { closing: "soft", back: "metal" } }) }
    expect(holes(soft)).toEqual([2, 2])
    expect(usedHardwareSlots(soft).has("handle")).toBe(true)
  })
})
