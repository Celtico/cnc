import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { CompositionSchema, DEFAULT_SETTINGS, findZone, type Composition } from "../model"
import { summarizeMoble } from "./summary"
import { assistantTools, runAssistantTool, toolResultPayload, TOOL_NAMES, type ToolOutcome } from "./tools"

const ctx = { settings: DEFAULT_SETTINGS }
const blank = (): Composition => ({ kind: "moble", modules: [], references: [] })

/** Aplica una eina que ha d'anar bé i en torna la composició. */
function ok(comp: Composition, name: string, input: unknown): Extract<ToolOutcome, { ok: true }> {
  const r = runAssistantTool(comp, name, input, ctx)
  if (!r.ok) throw new Error(`${name}: ${r.error}`)
  expect(CompositionSchema.safeParse(r.comp).success).toBe(true)
  return r
}
function err(comp: Composition, name: string, input: unknown): string {
  const r = runAssistantTool(comp, name, input, ctx)
  expect(r.ok).toBe(false)
  return r.ok ? "" : r.error
}
/** Un moble amb un mòdul de caixa de 800 × 2000 × 560. */
function wardrobe() {
  const r = ok(blank(), "add_module", { name: "Armari", width: 800, height: 2000, depth: 560 })
  return { comp: r.comp, id: r.result.module_id as string, root: r.result.interior_zone as string }
}

describe("assistent IA: definicions de les eines", () => {
  it("cada eina té un JSON Schema d'objecte, descripció i nom únic", () => {
    const tools = assistantTools()
    expect(tools.map((t) => t.name)).toEqual(TOOL_NAMES)
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length)
    for (const t of tools) {
      expect(t.input_schema.type).toBe("object")
      expect(t.description.length).toBeGreaterThan(10)
      expect(JSON.parse(JSON.stringify(t.input_schema))).toEqual(t.input_schema)
      expect("$schema" in t.input_schema).toBe(false)
    }
    // Els camps amb valor per defecte no són obligatoris (esquema d'entrada).
    const add = tools.find((t) => t.name === "add_module")!.input_schema as { required?: string[] }
    expect(add.required).toEqual(["width", "height", "depth"])
  })

  it("una entrada dolenta o una eina desconeguda tornen un error que s'entén, sense tocar res", () => {
    expect(err(blank(), "add_module", { width: 50, height: 700, depth: 500 })).toMatch(/width/)
    expect(err(blank(), "fly", {})).toMatch(/Eina desconeguda/)
    expect(err(blank(), "set_module_size", { module: "nope", width: 500 })).toMatch(/No hi ha cap mòdul/)
  })
})

describe("assistent IA: operacions", () => {
  it("add_module fa una caixa amb els materials de Preferències i get_moble la resumeix amb el catàleg", () => {
    const { comp, id, root } = wardrobe()
    const m = comp.modules[0]!
    expect(m.id).toBe(id)
    expect(m.root.id).toBe(root)
    expect(m.carcass).toMatchObject({ width: 800, height: 2000, depth: 560, material: DEFAULT_SETTINGS.defaults.material, thickness: DEFAULT_SETTINGS.defaults.thickness, back: "groove" })
    expect(m.carcass.sides).toEqual({ left: true, right: true })
    const r = ok(comp, "get_moble", {})
    const payload = toolResultPayload("get_moble", comp, r, ctx)
    expect(payload.moble.modules[0]).toMatchObject({ id, name: "Armari", mount: "wall", width: 800 })
    // La llum de l'Interior: 800 − 2 × 19.
    expect(payload.moble.modules[0]!.interior.w).toBe(762)
    expect(payload.catalog!.board_materials.some((x) => x.name === DEFAULT_SETTINGS.defaults.material)).toBe(true)
    expect(payload.catalog!.drawer_kits.length).toBeGreaterThan(0)
  })

  it("les eines són pures: la composició d'entrada no canvia", () => {
    const { comp, id } = wardrobe()
    const before = JSON.stringify(comp)
    ok(comp, "split_zone", { module: id, dir: "h", n: 3, sizes: [700] })
    ok(comp, "set_module_size", { module: "Armari", width: 900 })
    ok(comp, "set_material", { body: "Melamina gris" })
    expect(JSON.stringify(comp)).toBe(before)
  })

  it("split_zone: n zones, les n−1 primeres amb mida i l'última el que sobra; no torna a dividir una de dividida", () => {
    const { comp, id, root } = wardrobe()
    const r = ok(comp, "split_zone", { module: id, dir: "h", n: 3, sizes: [700] })
    const z = findZone(r.comp.modules[0]!.root, root)!
    expect(z.split!.sizes).toEqual([700, "auto", "auto"])
    expect(r.result.children).toHaveLength(3)
    // La construcció dona 700 de llum a la primera.
    const rect = buildComposition(r.comp).modules[0]!.build.layout.rects.get(z.split!.children[0]!.id)!
    expect(rect.y1 - rect.y0).toBeCloseTo(700, 5)
    expect(err(r.comp, "split_zone", { module: id, dir: "v", n: 2 })).toMatch(/ja és dividit/)
    expect(err(comp, "split_zone", { module: id, dir: "v", n: 2, sizes: [100, 200] })).toMatch(/com a molt 1 mides/)
  })

  it("dividir, prestatges i fronts segueixen el que aguanta cada compartiment (com la UI)", () => {
    const added = ok(blank(), "add_module", { name: "Buit", width: 600, height: 400, depth: 400, preset: "empty" })
    const id = added.result.module_id as string
    // Sense laterals, tapa ni fons (el mòdul nou ja en porta).
    const r = ok(added.comp, "set_carcass", { module: id, sides: { left: false, right: false }, top: "none", back: "none" })
    expect(err(r.comp, "split_zone", { module: id, dir: "h", n: 2 })).toMatch(/no es pot dividir/)
    expect(err(r.comp, "set_shelves", { module: id, n: 2 })).toMatch(/lateral o un divisor a cada costat/)
    expect(err(r.comp, "set_front", { module: id, kind: "drawers" })).toMatch(/quatre costats/)
    // Amb laterals i tapa, sí.
    const boxed = ok(r.comp, "set_carcass", { module: id, sides: { left: true, right: true }, top: "full", back: "groove" })
    ok(boxed.comp, "set_front", { module: id, kind: "drawers", drawers: { n: 2 } })
  })

  it("set_front: calaixos amb alçades i joc; portes de tot el mòdul a l'Interior dividit; un compartiment tapat no en porta", () => {
    const { comp, id, root } = wardrobe()
    const split = ok(comp, "split_zone", { module: id, dir: "h", n: 2, sizes: [600] })
    const [low, high] = findZone(split.comp.modules[0]!.root, root)!.split!.children.map((c) => c.id)
    const kit = DEFAULT_SETTINGS.hardwareLibrary.find((x) => x.engine === "drawerKit")!
    const drawers = ok(split.comp, "set_front", { module: id, zone: low, kind: "drawers", drawers: { n: 3, heights: [180, 200], kit: kit.name } })
    const f = findZone(drawers.comp.modules[0]!.root, low!)!.front!
    expect(f).toMatchObject({ kind: "drawers", n: 3, heights: [180, 200, "auto"] })
    expect(f.kind === "drawers" && f.hardware?.id).toBe(kit.id)
    // A l'Interior dividit, només portes (de dalt a baix).
    expect(err(drawers.comp, "set_front", { module: id, kind: "drawers" })).toMatch(/només hi van portes/)
    const doors = ok(drawers.comp, "set_front", { module: id, kind: "door", door: { mode: "double" } })
    const sum = summarizeMoble(doors.comp, DEFAULT_SETTINGS)
    expect(sum.modules[0]!.module_doors).toMatchObject({ kind: "door", mode: "double" })
    expect(sum.modules[0]!.interior.split!.children[1]!.covered).toBe(true)
    expect(err(doors.comp, "set_front", { module: id, zone: high, kind: "flap" })).toMatch(/tapat per les portes/)
    // Prestatges a sobre dels calaixos: no; al compartiment de dalt (tapat), sí.
    expect(err(doors.comp, "set_shelves", { module: id, zone: low, n: 2 })).toMatch(/calaixos/)
    ok(doors.comp, "set_shelves", { module: id, zone: high, n: 3, adjustable: false })
  })

  it("set_zone_size: canvia una zona; l'última és el que sobra", () => {
    const { comp, id, root } = wardrobe()
    const split = ok(comp, "split_zone", { module: id, dir: "v", n: 2 })
    const [a, b] = findZone(split.comp.modules[0]!.root, root)!.split!.children.map((c) => c.id)
    const r = ok(split.comp, "set_zone_size", { module: id, zone: a, size: 300 })
    expect(findZone(r.comp.modules[0]!.root, root)!.split!.sizes).toEqual([300, "auto"])
    expect(err(split.comp, "set_zone_size", { module: id, zone: b, size: 300 })).toMatch(/el que sobra/)
    expect(err(split.comp, "set_zone_size", { module: id, zone: root, size: 300 })).toMatch(/no és dins de cap divisió/)
  })

  it("set_material: només els de Preferències, gruix del material; fons com el cos", () => {
    const { comp, id } = wardrobe()
    expect(err(comp, "set_material", { body: "Fusta de Mart" })).toMatch(/no és a Preferències/)
    const r = ok(comp, "set_material", { module: id, fronts: "Lacat negre brillant", back: "same" })
    expect(r.comp.modules[0]!.carcass).toMatchObject({ frontMaterial: "Lacat negre brillant", backMaterial: DEFAULT_SETTINGS.defaults.material, backThickness: DEFAULT_SETTINGS.defaults.thickness })
    expect(err(comp, "set_material", { module: id, thickness: 23 })).toMatch(/no té gruix de 23/)
  })

  it("posició, mides, nom i eliminar", () => {
    const { comp, id } = wardrobe()
    const hung = ok(comp, "set_module_position", { module: id, mount: "hung", floor_height: 1500 })
    expect(hung.comp.modules[0]!.carcass.base).toEqual({ kind: "wall", height: 1500 })
    expect(err(hung.comp, "set_carcass", { module: id, base: { kind: "legs" } })).toMatch(/penjat/)
    const floor = ok(comp, "set_module_position", { module: id, mount: "floor", wall_gap: 300 })
    expect(floor.comp.modules[0]).toMatchObject({ wallGap: 300, x: 0 })
    const sized = ok(comp, "set_module_size", { module: id, height: 720 })
    expect(sized.comp.modules[0]!.carcass.height).toBe(720)
    const named = ok(comp, "rename_module", { module: id, name: "Baix" })
    expect(named.comp.modules[0]!.name).toBe("Baix")
    const second = ok(comp, "add_module", { width: 400, height: 2000, depth: 560, after: id })
    expect(second.comp.modules.map((m) => m.name)).toEqual(["Armari", "Mòdul 2"])
    const removed = ok(second.comp, "remove_module", { module: "Armari" })
    expect(removed.comp.modules.map((m) => m.name)).toEqual(["Mòdul 2"])
  })

  it("el resultat d'una eina porta els avisos de fusteria nous (per corregir-se)", () => {
    const { comp, id } = wardrobe()
    // Una sola porta de 2000 × 800: massa ampla i alta per a una porta.
    const r = ok(comp, "set_front", { module: id, kind: "door" })
    const payload = toolResultPayload("set_front", comp, r, ctx)
    expect(payload.new_warnings!.length).toBeGreaterThan(0)
    expect(payload.new_warnings!.some((w) => w.code.startsWith("door-too"))).toBe(true)
    // Els que ja hi eren no tornen a sortir com a nous.
    const again = ok(r.comp, "rename_module", { module: id, name: "Armari 2" })
    expect(toolResultPayload("rename_module", r.comp, again, ctx).new_warnings).toEqual([])
  })

  it("en un objecte (només peces lliures) no s'hi posen mòduls", () => {
    expect(err({ kind: "objecte", modules: [], references: [] }, "add_module", { width: 600, height: 600, depth: 400 })).toMatch(/peces lliures/)
  })
})

describe("assistent IA: el resum diu quina llum i quina barra porta cada compartiment", () => {
  it("el nom del ferratge propi o, «Com el mòdul», el del mòdul", () => {
    const { comp } = wardrobe()
    const own = DEFAULT_SETTINGS.hardwareLibrary.find((h) => h.engine === "ledProfile")!
    const m = comp.modules[0]!
    const withOwn: Composition = { ...comp, modules: [{ ...m, root: { ...m.root, led: { hardware: { ...own, name: "LED de prova" } } } }] }
    expect(JSON.stringify(summarizeMoble(withOwn, DEFAULT_SETTINGS))).toContain("LED de prova")
    const inherited: Composition = { ...comp, modules: [{ ...m, root: { ...m.root, led: {} } }] }
    expect(JSON.stringify(summarizeMoble(inherited, DEFAULT_SETTINGS))).toContain("com el mòdul")
  })
})
