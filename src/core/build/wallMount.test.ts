import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, compositionHeight, compositionWidth, moduleElevation, modulePlacements, normalizeComposition } from "../model"
import { buildComposition } from "./buildComposition"
import { panelBox } from "./geometry"

describe("mòdul penjat a la paret", () => {
  const comp = () => BUILTIN_TEMPLATES.find((t) => t.id === "wardrobe-2-doors")!.make()

  it("aixeca totes les peces l'alçada indicada i no afegeix peces de base", () => {
    const floor = buildComposition(comp())
    const c = comp()
    c.modules[0]!.carcass.base = { kind: "wall", height: 1200 }
    const hung = buildComposition(c)
    expect(moduleElevation(c.modules[0]!.carcass)).toBe(1200)
    expect(hung.panels.some((p) => p.role === "plinth")).toBe(false)
    const minY = Math.min(...hung.panels.map((p) => panelBox(p).min[1]))
    expect(minY).toBeGreaterThanOrEqual(1200 - 0.001)
    expect(hung.panels.length).toBeLessThanOrEqual(floor.panels.length)
  })

  it("sense penjadors («Cap»), avisa si el fons és massa prim per penjar-lo", () => {
    const c = comp()
    c.modules[0]!.carcass.base = { kind: "wall", height: 1200, hanger: "none" }
    c.modules[0]!.carcass.backThickness = 3
    expect(buildComposition(c).warnings.some((w) => w.code === "hanging")).toBe(true)
    c.modules[0]!.carcass.backThickness = 10
    c.modules[0]!.carcass.back = "screwed"
    expect(buildComposition(c).warnings.some((w) => w.code === "hanging")).toBe(false)
  })
})

describe("dues files: a terra i penjats", () => {
  const two = () => {
    const c = BUILTIN_TEMPLATES.find((t) => t.id === "wardrobe-2-doors")!.make()
    const a = c.modules[0]!
    const b = { ...structuredClone(a), id: "top", name: "Alt" }
    c.modules.push(b)
    return c
  }

  it("els penjats fan la seva fila, independent de la de terra", () => {
    const c = two()
    const w = c.modules[0]!.carcass.width
    c.modules[1]!.carcass.base = { kind: "wall", height: 1500 }
    expect(modulePlacements(c)[1]).toEqual({ x: 0, y: 1500 })
    c.modules[1]!.gapBefore = 200
    expect(modulePlacements(c)[1]).toEqual({ x: 200, y: 1500 })
    expect(compositionWidth(c)).toBe(Math.max(w, 200 + c.modules[1]!.carcass.width))
    expect(compositionHeight(c)).toBe(1500 + c.modules[1]!.carcass.height)
  })

  it("a terra, van un al costat de l'altre", () => {
    const c = two()
    expect(modulePlacements(c)[1]!.x).toBe(c.modules[0]!.carcass.width)
  })

  it("migra els ancoratges antics sense moure res", () => {
    const c = two()
    const base = c.modules[0]!
    // Antic: «a sobre de» (s'hi recolza) amb desplaçament de 50.
    c.modules[1]!.anchor = { module: base.id, dx: 50 }
    const n = normalizeComposition(c)
    expect(n.modules.every((m) => !m.anchor)).toBe(true)
    const top = n.modules.find((m) => m.id === "top")!
    expect(top.carcass.base).toEqual({ kind: "wall", height: base.carcass.height })
    const ps = modulePlacements(n)
    expect(ps[n.modules.indexOf(top)]).toEqual({ x: 50, y: base.carcass.height })
  })

  it("la cuina: cada alt sobre el seu baix i el forat de la campana sobre els fogons", () => {
    const c = BUILTIN_TEMPLATES.find((t) => t.id === "modern-kitchen")!.make()
    const ps = modulePlacements(c)
    const at = (name: string) => ps[c.modules.findIndex((m) => m.name === name)]!
    expect(at("Alt 1").x).toBe(at("Calaixos").x)
    expect(at("Alt escorreplats").x).toBe(at("Fregadera").x)
    expect(at("Alt 3").x).toBe(at("Forn").x)
    expect(at("Alt 4").x).toBe(at("Rebost").x)
  })
})
