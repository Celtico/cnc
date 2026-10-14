import { describe, expect, it } from "vitest"
import { HAFELE_LEGS } from "../model/hafele/hafeleLegs"
import { DEFAULT_SETTINGS, HardwareItemSchema, defaultModule, parseSettings, type Module } from "../model"
import { buildModule } from "./buildModule"
import { toWorld } from "./geometry"
import { hardwareMount } from "./hardwareMount"
import { builtinSolids } from "./hardwareSolids"

/** Pota de sòcol Häfele AXILO 78 amb la placa rectangular per cargolar (catàleg Häfele, p. FF 11.79). */
const axilo = HAFELE_LEGS.find((x) => x.id === "leg-hafele-axilo78-screw")!
const onLegs = (m: Module = defaultModule("m", "x")): Module => ({ ...m, carcass: { ...m.carcass, base: { kind: "legs", height: 100, hardware: structuredClone(axilo) } } })

describe("pota AXILO 78 (placa rectangular per cargolar)", () => {
  it("és un item vàlid de l'app, a la biblioteca inicial", () => {
    expect(HardwareItemSchema.safeParse(axilo).success).toBe(true)
    expect(DEFAULT_SETTINGS.hardwareLibrary.some((x) => x.id === axilo.id)).toBe(true)
  })

  it("fa els 4 forats de la placa a cada cantonada, a la cara de sota de la base", () => {
    const m = onLegs()
    const b = buildModule(m)
    const bottom = b.panels.find((p) => p.role === "bottom")!
    const legs = bottom.holes.filter((h) => h.tag === "leg")
    expect(legs).toHaveLength(16)
    expect(legs.every((h) => h.diameter === 3 && h.depth === 10)).toBe(true)
    // Eix a 45 mm dels cantells; a l'esquerra, cargols a −19 / +45 en X (el clip cap al lateral) i ±32 cap al davant; a la
    // dreta, en mirall.
    const W = m.carcass.width, D = m.carcass.depth
    const world = legs.map((h) => toWorld(bottom, [h.x, h.y, 0]))
    const near = (x: number, z: number) => world.some((p) => Math.abs(p[0] - x) < 0.01 && Math.abs(p[2] - z) < 0.01)
    for (const [cx, cz, s] of [[45, 45, 1], [W - 45, 45, -1], [45, D - 45, 1], [W - 45, D - 45, -1]] as const)
      for (const [du, dv] of [[-19, -32], [45, -32], [-19, 32], [45, 32]] as const) expect(near(cx + s * du, cz + dv), `${cx},${cz} ${du},${dv}`).toBe(true)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
  })

  it("es munta a «Com va muntat» (la base amb les plaques) i es dibuixa: placa, tub i peu a cada pota", () => {
    const mount = hardwareMount(axilo, defaultModule("m", "x"))
    const bottom = mount.panels.find((p) => p.holes.some((h) => h.tag === "leg"))!
    expect(bottom).toBeDefined()
    expect(bottom.fittings?.filter((f) => f.kind === "leg" && f.leg)).toHaveLength(4)
    const solids = builtinSolids(bottom)
    expect(solids.filter((s) => s.kind === "box")).toHaveLength(4)
    expect(solids.filter((s) => s.kind === "cyl")).toHaveLength(12)
    // La placa de cada pota cobreix els seus quatre cargols (a la vista de sota de la base).
    for (const f of bottom.fittings!) {
      const plate = solids.find((s) => s.kind === "box" && Math.hypot(s.c[0] - f.x, s.c[1] - f.y) < 60)!
      expect(plate).toBeDefined()
      const mine = bottom.holes.filter((h) => h.tag === "leg" && Math.hypot(h.x - f.x, h.y - f.y) < 60)
      expect(mine).toHaveLength(4)
      for (const h of mine) {
        if (plate.kind !== "box") continue
        const dx = h.x - plate.c[0], dy = h.y - plate.c[1]
        const [a, b] = plate.axes
        const pu = Math.abs(dx * a[0] + dy * a[1]), pv = Math.abs(dx * b[0] + dy * b[1])
        expect(pu <= plate.size[0] / 2 && pv <= plate.size[1] / 2).toBe(true)
      }
    }
  })

  it("v37: la de la v34 desada (version 1) passa a la d'ara", () => {
    const old = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    old.version = 36
    const i = old.hardwareLibrary.findIndex((x: { id: string }) => x.id === axilo.id)
    old.hardwareLibrary[i] = { ...old.hardwareLibrary[i], version: 1, params: { inset: 60 } }
    old.version = 36
    const res = parseSettings(old)
    expect(res.settings.hardwareLibrary.find((x) => x.id === axilo.id)).toEqual(axilo)
  })

  it("v34: s'afegeix a unes preferències d'abans (per id)", () => {
    const v33 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 33, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => x.id !== axilo.id) }
    const res = parseSettings(v33)
    expect(res.migrated).toBe(true)
    expect(res.settings.hardwareLibrary.some((x) => x.id === axilo.id)).toBe(true)
    expect(parseSettings(JSON.parse(JSON.stringify(res.settings))).migrated).toBe(false)
  })
})
