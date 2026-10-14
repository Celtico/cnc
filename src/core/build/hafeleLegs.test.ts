import { describe, expect, it } from "vitest"
import { HAFELE_LEGS } from "../model/hafele/hafeleLegs"
import { DEFAULT_SETTINGS, HardwareItemSchema, defaultModule, parseSettings, type Module } from "../model"
import { buildModule } from "./buildModule"
import { toWorld } from "./geometry"
import { hardwareMount } from "./hardwareMount"
import { builtinSolids } from "./hardwareSolids"
import { hardwarePreview } from "./hardwarePreview"

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
    // La de cuina: eix a 52 mm dels laterals, 53 del darrere i 83 del davant (el sòcol); a l'esquerra, cargols a −19 / +45 en X (el clip cap al lateral) i ±32 cap al davant; a la
    // dreta, en mirall.
    const W = m.carcass.width, D = m.carcass.depth
    const world = legs.map((h) => toWorld(bottom, [h.x, h.y, 0]))
    const near = (x: number, z: number) => world.some((p) => Math.abs(p[0] - x) < 0.01 && Math.abs(p[2] - z) < 0.01)
    for (const [cx, cz, s] of [[52, 53, 1], [W - 52, 53, -1], [52, D - 83, 1], [W - 52, D - 83, -1]] as const)
      for (const [du, dv] of [[-19, -32], [45, -32], [-19, 32], [45, 32]] as const) expect(near(cx + s * du, cz + dv), `${cx},${cz} ${du},${dv}`).toBe(true)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
  })

  it("una distància per a cada costat: esquerra, dreta, darrere i davant", () => {
    const m = onLegs()
    const it2 = structuredClone(axilo)
    Object.assign(it2.params, { insetLeft: 70, insetRight: 60, insetBack: 65, insetFront: 120 })
    const b = buildModule({ ...m, carcass: { ...m.carcass, base: { kind: "legs", height: 100, hardware: it2 } } })
    const bottom = b.panels.find((p) => p.role === "bottom")!
    const world = bottom.holes.filter((h) => h.tag === "leg").map((h) => toWorld(bottom, [h.x, h.y, 0]))
    const W = m.carcass.width, D = m.carcass.depth
    const near = (x: number, z: number) => world.some((p) => Math.abs(p[0] - x) < 0.01 && Math.abs(p[2] - z) < 0.01)
    expect(near(70 - 19, 65 - 32)).toBe(true)
    expect(near(W - 60 + 19, 65 - 32)).toBe(true)
    expect(near(70 - 19, D - 120 + 32)).toBe(true)
    expect(near(W - 60 + 19, D - 120 + 32)).toBe(true)
  })

  it("la de mobles: la mateixa placa, a la biblioteca, amb el davant per confirmar (com el darrere)", () => {
    const moble = HAFELE_LEGS.find((x) => x.id === "leg-hafele-axilo78-screw-moble")!
    expect(HardwareItemSchema.safeParse(moble).success).toBe(true)
    expect(DEFAULT_SETTINGS.hardwareLibrary.some((x) => x.id === moble.id)).toBe(true)
    expect(moble.name).toMatch(/moble$/)
    expect(axilo.name).toMatch(/cuina$/)
    expect(moble.params.insetFront).toBe(moble.params.insetBack)
    expect(moble.targets).toEqual(axilo.targets)
  })

  it("sòcol davant de les potes: de tota l'amplada, de terra fins a 5 mm sota la base, sense tocar el peu", () => {
    const m = onLegs()
    const b = buildModule({ ...m, carcass: { ...m.carcass, base: { kind: "legs", height: 100, hardware: structuredClone(axilo), plinth: { setback: 20 } } } })
    const plinth = b.panels.find((p) => p.role === "plinth")!
    expect(plinth).toBeDefined()
    expect(plinth.length).toBe(m.carcass.width)
    expect(plinth.width).toBe(95)
    expect(plinth.placement.origin[1]).toBe(-100)
    expect(plinth.placement.origin[2]).toBe(m.carcass.depth - 20 - m.carcass.thickness)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
    // Massa endavant les potes (o massa enrere el sòcol): avís.
    const near = buildModule({ ...m, carcass: { ...m.carcass, base: { kind: "legs", height: 100, hardware: structuredClone(axilo), plinth: { setback: 60 } } } })
    expect(near.warnings.some((w) => w.code === "hardware" && /sòcol/.test(w.message))).toBe(true)
    // Sense sòcol, cap peça de sòcol.
    expect(buildModule(m).panels.some((p) => p.role === "plinth")).toBe(false)
  })

  it("el dibuix de Preferències (peça d'exemple) posa els forats com el moble: davant, darrere i mirall", () => {
    const [base] = hardwarePreview(axilo).panels
    const at = (x: number, y: number) => base!.holes.some((h) => Math.abs(h.x - x) < 0.01 && Math.abs(h.y - y) < 0.01)
    const L = base!.length, Wd = base!.width
    for (const [cx, cy, s] of [[52, 53, 1], [L - 52, 53, -1], [52, Wd - 83, 1], [L - 52, Wd - 83, -1]] as const)
      for (const [du, dv] of [[-19, -32], [45, -32], [-19, 32], [45, 32]] as const) expect(at(cx + s * du, cy + dv), `${cx},${cy}`).toBe(true)
  })

  it("es munta a «Com va muntat» (la base amb les plaques) i es dibuixa: placa, tub i peu a cada pota", () => {
    const mount = hardwareMount(axilo, defaultModule("m", "x"))
    const bottom = mount.panels.find((p) => p.holes.some((h) => h.tag === "leg"))!
    expect(bottom).toBeDefined()
    expect(bottom.fittings?.filter((f) => f.kind === "leg" && f.leg)).toHaveLength(4)
    const solids = builtinSolids(bottom)
    expect(solids.filter((s) => s.kind === "box")).toHaveLength(20)
    expect(solids.filter((s) => s.kind === "cyl")).toHaveLength(32)
    // La placa de cada pota cobreix els seus quatre cargols (a la vista de sota de la base).
    for (const f of bottom.fittings!) {
      // La llosa de sota (la caixa més gran de la pota).
      const plate = solids.filter((s) => s.kind === "box" && Math.hypot(s.c[0] - f.x, s.c[1] - f.y) < 60).sort((a, b) => (b.kind === "box" ? b.size[0] * b.size[1] : 0) - (a.kind === "box" ? a.size[0] * a.size[1] : 0))[0]!
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

  it("una d'una versió anterior de l'item passa a la d'ara, també amb les preferències ja a la versió d'ara", () => {
    const old = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    const i = old.hardwareLibrary.findIndex((x: { id: string }) => x.id === axilo.id)
    old.hardwareLibrary[i] = { ...old.hardwareLibrary[i], version: axilo.version - 1, params: { ...old.hardwareLibrary[i].params, inset: 45 } }
    const res = parseSettings(old)
    expect(res.migrated).toBe(true)
    expect(res.settings.hardwareLibrary.find((x) => x.id === axilo.id)).toEqual(axilo)
    expect(parseSettings(JSON.parse(JSON.stringify(res.settings))).migrated).toBe(false)
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
