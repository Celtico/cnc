import { describe, expect, it } from "vitest"
import { HAFELE_LEGS } from "../model/hafele/hafeleLegs"
import { DEFAULT_SETTINGS, HardwareItemSchema, defaultModule, parseSettings, type Module } from "../model"
import { buildModule } from "./buildModule"
import { toWorld } from "./geometry"
import { hardwareMount } from "./hardwareMount"

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
    expect(legs.every((h) => h.diameter === 3 && h.depth === 12)).toBe(true)
    // La pota del davant a l'esquerra: eix a 60 mm dels cantells, cargols a ±32 en X i a −45 / +19 cap al davant.
    const W = m.carcass.width, D = m.carcass.depth
    const world = legs.map((h) => toWorld(bottom, [h.x, h.y, 0]))
    const near = (x: number, z: number) => world.some((p) => Math.abs(p[0] - x) < 0.01 && Math.abs(p[2] - z) < 0.01)
    for (const [cx, cz] of [[60, 60], [W - 60, 60], [60, D - 60], [W - 60, D - 60]] as const)
      for (const [du, dv] of [[-32, -45], [32, -45], [-32, 19], [32, 19]] as const) expect(near(cx + du, cz + dv)).toBe(true)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
  })

  it("es munta a «Com va muntat» (la base amb les plaques)", () => {
    const mount = hardwareMount(axilo, defaultModule("m", "x"))
    expect(mount.panels.some((p) => p.holes.some((h) => h.tag === "leg"))).toBe(true)
  })

  it("v34: s'afegeix a unes preferències d'abans (per id)", () => {
    const v33 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 33, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => x.id !== axilo.id) }
    const res = parseSettings(v33)
    expect(res.migrated).toBe(true)
    expect(res.settings.hardwareLibrary.some((x) => x.id === axilo.id)).toBe(true)
    expect(parseSettings(JSON.parse(JSON.stringify(res.settings))).migrated).toBe(false)
  })
})
