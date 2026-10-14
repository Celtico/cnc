import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, HardwareItemSchema, defaultModule, parseSettings, type HardwareItem, type Zone } from "../model"
import { HAFELE_CATALOGUE_ITEMS, HAFELE_GLASS_FRAMES, HAFELE_HANDLES } from "../model/hafele/hafeleCatalog"
import { HAFELE_LOOX_PROFILES } from "../model/lights/hafeleLoox"
import { V35_ITEMS } from "../model/hardware"
import { buildModule } from "./buildModule"
import { handleSpec } from "./hardware"
import { hardwareMount } from "./hardwareMount"

/** Ferratges del catàleg general Häfele (preferències v35): marcs d'alumini, tiradors, suports i el perfil Loox per encastar. */
const item = (id: string): HardwareItem => structuredClone(V35_ITEMS.find((x) => x.id === id)!)
const mod = (root: Omit<Zone, "id">, size = { width: 500, height: 720, depth: 400 }) => ({ ...defaultModule("m", "Vitrina", size), root: { id: "z", ...root } })

describe("catàleg Häfele (v35)", () => {
  it("items vàlids, a la biblioteca inicial, ids únics i amb el seu mecanitzat", () => {
    expect(V35_ITEMS.length).toBeLessThanOrEqual(20)
    expect(new Set(V35_ITEMS.map((x) => x.id)).size).toBe(V35_ITEMS.length)
    for (const it of V35_ITEMS) {
      expect(HardwareItemSchema.safeParse(it).success, it.id).toBe(true)
      expect(DEFAULT_SETTINGS.hardwareLibrary.some((x) => x.id === it.id), it.id).toBe(true)
      expect(it.targets.some((t) => t.ops.length > 0), it.id).toBe(true)
    }
    expect(HAFELE_CATALOGUE_ITEMS.every((x) => x.maker === "Häfele" && x.builtin)).toBe(true)
  })

  it("porta de vidre amb un marc Häfele: la placa de la Metallamat A al lateral de les frontisses, a la filera; el marc de l'app, res", () => {
    const frame = HAFELE_GLASS_FRAMES[0]!
    const door = { kind: "door" as const, mode: "single" as const, hinge: "left" as const, glass: true }
    // Amb la placa de l'item (Ø5 × 12), els forats cauen a la filera System 32 (els mateixos forats): res de nou, cap avís.
    const b = buildModule(mod({ front: { ...door, frame: structuredClone(frame) } }))
    const left = b.panels.find((p) => p.id === "side-left")!
    const plainLeft = buildModule(mod({ front: door })).panels.find((p) => p.id === "side-left")!
    const geo = (hs: typeof left.holes) => hs.map(({ tag: _t, ...h }) => h)
    expect(geo(left.holes)).toEqual(geo(plainLeft.holes))
    // …però els quatre forats de les dues plaques ja són de la placa (hi va el seu cargol).
    expect(left.holes.filter((h) => h.tag === "plate")).toHaveLength(4)
    expect(b.warnings.filter((w) => w.code === "hinge")).toEqual([])
    // Una placa més fonda que la filera (13): es veu on va, dos forats per frontissa (±16, 32 entre ells), només al lateral esquerre.
    const deep = structuredClone(frame)
    for (const op of deep.targets.find((t) => t.key === "side")!.ops) if (op.kind === "drill") op.depth = 13
    const d = buildModule(mod({ front: { ...door, frame: deep } }))
    const plate = d.panels.find((p) => p.id === "side-left")!.holes.filter((h) => h.tag === "plate")
    // Porta de ~720: dues frontisses.
    expect(plate).toHaveLength(4)
    const ys = plate.map((h) => h.x).sort((a, c) => a - c)
    expect(ys[1]! - ys[0]!).toBeCloseTo(32, 6)
    expect(d.panels.find((p) => p.id === "side-right")!.holes.filter((h) => h.tag === "plate")).toHaveLength(0)
    expect(d.extras.some((p) => p.name === "vidre vitrina")).toBe(true)
    // El marc de l'app (sense placa): cap forat de placa, com abans.
    const plain = buildModule(mod({ front: door }))
    expect(plain.panels.flatMap((p) => p.holes).filter((h) => h.tag === "plate")).toHaveLength(0)
    // El perfil fa l'amplada del marc.
    expect(b.extras.find((p) => p.id.endsWith("-left") && p.name === "perfil vitrina")!.width).toBe(frame.params.frame)
  })

  it("tiradors: la distància entre centres més gran que hi cap al front", () => {
    const h1935 = handleSpec(HAFELE_HANDLES.find((x) => x.id === "handle-hafele-h1935")!)
    expect(h1935.pitch(150)).toBe(128)
    expect(h1935.pitch(230)).toBe(160)
    expect(h1935.pitch(500)).toBe(192)
    const b = buildModule(mod({ front: { kind: "drawers", n: 1, heights: ["auto"], handle: item("handle-hafele-d12") } }, { width: 600, height: 200, depth: 500 }))
    const front = b.panels.find((p) => p.role === "drawerFront")!
    const holes = (front.cutouts ?? []).filter((c) => c.tag === "handle")
    expect(holes).toHaveLength(2)
    if (holes[0]!.kind === "circle" && holes[1]!.kind === "circle") expect(Math.abs(holes[0]!.x - holes[1]!.x)).toBe(480)
  })

  it("perfil Loox d'11 mm per encastar: la ranura de 18 × 11 a la tapa i la tira a la comanda", () => {
    const b = buildModule(mod({ led: { hardware: structuredClone(HAFELE_LOOX_PROFILES[0]!) } }, { width: 800, height: 600, depth: 450 }))
    const g = b.panels.find((p) => p.role === "top")!.grooves.filter((x) => x.tag === "light")
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ h: 18, depth: 11 })
    expect(b.lightKits[0]!.lines[0]).toMatchObject({ item: "833.72.846" })
  })

  it("«Com va muntat» de tots, sense error", () => {
    for (const it of V35_ITEMS) expect(hardwareMount(it).error, it.id).toBeUndefined()
  })

  it("v35: s'afegeixen a unes preferències d'abans (per id)", () => {
    const v34 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 34, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => !V35_ITEMS.some((k) => k.id === x.id)) }
    const res = parseSettings(v34)
    expect(res.migrated).toBe(true)
    for (const it of V35_ITEMS) expect(res.settings.hardwareLibrary.some((x) => x.id === it.id), it.id).toBe(true)
    expect(parseSettings(JSON.parse(JSON.stringify(res.settings))).migrated).toBe(false)
  })
})
