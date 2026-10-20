import { describe, expect, it } from "vitest"
import { addBottomPlinth, addTopPlinth, bottomPlinthZone, defaultModule, pasteModuleProps, removeBottomPlinth, removeTopPlinth, setPlinthZone, topPlinthZone, withZonePlinths, type Module } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"

const base = (): Module => defaultModule("a", "Moble", { width: 800, height: 900, depth: 500 })

describe("sòcols fets amb zones (0 casos especials)", () => {
  it("el sòcol de baix: sense base, una zona de baix amb un front fix retirat; el divisor fa de base", () => {
    const m = addBottomPlinth(base(), 80, 30)
    expect(m.carcass.noBottom).toBe(true)
    expect(bottomPlinthZone(m)).toMatchObject({ height: 80, setback: 30 })
    const b = buildModule(m)
    const front = b.panels.find((p) => p.role === "panel")!
    expect(front).toBeDefined()
    const box = panelBox(front)
    // Retirat 30 mm del davant de la caixa, dins de la llum (entre els laterals).
    expect(box.max[2]).toBeCloseTo(500 - 30)
    expect(box.min[0]).toBeGreaterThan(m.carcass.thickness - 0.01)
    expect(box.max[0]).toBeLessThan(800 - m.carcass.thickness + 0.01)
    expect(box.max[1]).toBeLessThanOrEqual(80 + 0.01)
    expect(b.panels.some((p) => p.role === "bottom")).toBe(false)
  })
  it("canviar l'alçada i la retirada, i treure'l, torna l'interior d'abans", () => {
    const m0 = base()
    const m = setPlinthZone(addBottomPlinth(m0), "bottom", { height: 100, setback: 40 })
    expect(bottomPlinthZone(m)).toMatchObject({ height: 100, setback: 40 })
    const back = removeBottomPlinth(m)
    expect(back.root).toEqual(m0.root)
    expect(back.carcass.noBottom).toBeUndefined()
  })
  it("el sòcol de dalt: el mòdul creix, sense tapa, una zona de dalt amb un front fix", () => {
    const m0 = base()
    const m = addTopPlinth(m0, 60)
    expect(m.carcass.height).toBe(960)
    expect(m.carcass.top.kind).toBe("none")
    expect(topPlinthZone(m)?.height).toBe(60)
    const b = buildModule(m)
    const front = b.panels.find((p) => p.role === "panel")!
    expect(panelBox(front).max[1]).toBeGreaterThan(900)
    const grown = setPlinthZone(m, "top", { height: 100 })
    expect(grown.carcass.height).toBe(1000)
    const back = removeTopPlinth(grown)
    expect(back.carcass.height).toBe(900)
    expect(back.carcass.top.kind).toBe("full")
    expect(back.root).toEqual(m0.root)
  })
  it("els dos sòcols alhora: germans de l'interior a la mateixa divisió, i es poden treure en qualsevol ordre", () => {
    const m0 = base()
    const both = addTopPlinth(addBottomPlinth(m0, 80, 30), 60)
    expect(bottomPlinthZone(both)).toMatchObject({ height: 80, setback: 30 })
    expect(topPlinthZone(both)?.height).toBe(60)
    expect(both.root.split?.children).toHaveLength(3)
    const other = addBottomPlinth(addTopPlinth(m0, 60), 80, 30)
    expect(bottomPlinthZone(other)?.height).toBe(80)
    expect(topPlinthZone(other)?.height).toBe(60)
    expect(removeBottomPlinth(removeTopPlinth(both)).root).toEqual(m0.root)
    expect(removeTopPlinth(removeBottomPlinth(both)).root).toEqual(m0.root)
    expect(topPlinthZone(removeBottomPlinth(both))?.height).toBe(60)
  })
})

describe("enganxar propietats d'un mòdul", () => {
  it("es queda on és i amb les seves mides; agafa la caixa, els fronts i l'interior (amb ids nous)", () => {
    const src: Module = { ...defaultModule("s", "Font", { width: 600, height: 720, depth: 580 }), root: { id: "r", front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } } }
    const target: Module = { ...defaultModule("t", "Destí", { width: 900, height: 800, depth: 400 }), gapBefore: 50, carcass: { ...defaultModule("t", "Destí", { width: 900, height: 800, depth: 400 }).carcass, base: { kind: "wall", height: 1400 } } }
    const out = pasteModuleProps(target, { ...src, carcass: { ...src.carcass, back: "screwed" } })
    expect(out.id).toBe("t")
    expect(out.name).toBe("Destí")
    expect(out.gapBefore).toBe(50)
    expect([out.carcass.width, out.carcass.height, out.carcass.depth]).toEqual([900, 800, 400])
    expect(out.carcass.base).toEqual({ kind: "wall", height: 1400 })
    expect(out.carcass.back).toBe("screwed")
    expect(out.root.id).toBe(target.root.id)
    expect(out.root.front?.kind).toBe("drawers")
  })
})

describe("mobles nous de plantilla", () => {
  it("fora de la cuina, el sòcol de la caixa passa a ser una zona; a la cuina no es toca", () => {
    const m = defaultModule("a", "Armari", { width: 800, height: 2000, depth: 600, base: { kind: "plinth", height: 80, setback: 30 } })
    const out = withZonePlinths({ kind: "armari" as const, modules: [m] })
    expect(out.modules[0]!.carcass.base.kind).toBe("none")
    expect(bottomPlinthZone(out.modules[0]!)).toMatchObject({ height: 80, setback: 30 })
    const cuina = { kind: "cuina" as const, modules: [m] }
    expect(withZonePlinths(cuina)).toBe(cuina)
  })
})
