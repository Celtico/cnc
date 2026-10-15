import { beforeAll, describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, HAFELE_LOOX_ITEMS, HAFELE_LOOX_SYSTEM, HardwareItemSchema, LightKitSchema, defaultModule, hardwareParams, hardwareSummary, parseSettings, type HardwareItem, type Machine, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { buildComposition } from "./buildComposition"
import { hardwareMount } from "./hardwareMount"
import { hardwarePreview } from "./hardwarePreview"
import { electricalLines, lightGroups, lightReadmeLines } from "./lightOrders"
import { planLights } from "./lightKit"
import { materialIssues } from "./materialIssues"
import { toMaestroNestXcs } from "../export/maestroNestXcs"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { defaultMachine } from "../model/machine"
import { machineFromContext } from "../machine/maestro"
import { bytes, read } from "../machine/testContext"

const item = (id: string): HardwareItem => structuredClone(HAFELE_LOOX_ITEMS.find((x) => x.id === id)!)

let M: Machine | undefined
beforeAll(async () => {
  M = (await machineFromContext({ tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" }, "m")).machine
})
const mod = (root: Omit<Zone, "id">, size = { width: 800, height: 1200, depth: 400 }) => ({ ...defaultModule("m", "Vitrina", size), root: { id: "z", ...root } })

describe("jocs de llum Häfele Loox (v31)", () => {
  it("passen l'esquema, són del motor ledProfile i només ensenyen els paràmetres del joc", () => {
    for (const it of HAFELE_LOOX_ITEMS) {
      expect(HardwareItemSchema.safeParse(it).success, it.id).toBe(true)
      expect(LightKitSchema.safeParse(it.light).success, it.id).toBe(true)
      expect(it.engine).toBe("ledProfile")
      expect(it.category).toBe("light")
      expect(hardwareParams(it).map((p) => p.key)).toContain("depth")
      expect(hardwareSummary(it)).toMatch(/W/)
    }
    // El perfil de sempre no ensenya «Rebaix» ni «Entre llums».
    const plain = DEFAULT_SETTINGS.hardwareLibrary.find((x) => x.id === "led-profile-16x8")!
    expect(hardwareParams(plain).map((p) => p.key)).toEqual(["width", "height", "setback"])
    expect(new Set(HAFELE_LOOX_ITEMS.map((x) => x.id)).size).toBe(HAFELE_LOOX_ITEMS.length)
  })

  it("v31: s'afegeixen a unes preferències d'abans (per id) i el lloc «Llum» continua sent el perfil de l'app", () => {
    const v30 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 30, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => !x.light) }
    const res = parseSettings(v30)
    expect(res.migrated).toBe(true)
    expect(res.settings.version).toBe(47)
    for (const it of HAFELE_LOOX_ITEMS) expect(res.settings.hardwareLibrary.some((x) => x.id === it.id)).toBe(true)
    expect(res.settings.hardwareDefaults.led).toBe("led-profile-16x8")
    expect(parseSettings(JSON.parse(JSON.stringify(res.settings))).migrated).toBe(false)
  })

  it("el pla: focus cada 400 centrats, encastats si el tauler ho permet; si no, la caixa i només el cable", () => {
    const k = item("light-loox-3038-ww").light!
    const p = { setback: 60, spacing: 400, depth: 0 }
    const ok = planLights(k, p, { length: 762, depth: 381 }, 19)
    expect(ok.xs).toEqual([190.5, 571.5])
    expect(ok.recessed).toBe(true)
    expect(ok.depth).toBe(12)
    expect(ok.z).toBe(60)
    expect(ok.watts).toBe(6)
    expect(ok.lines.map((l) => l.component)).toEqual(["lamp:833.75.120"])
    const thin = planLights(k, p, { length: 762, depth: 381 }, 10)
    expect(thin.recessed).toBe(false)
    expect(thin.lines.map((l) => l.component)).toEqual(["lamp:833.75.120", "box:833.72.803"])
    expect(thin.warnings[0]).toMatch(/munta a sobre/)
    // Massa estret per al cos de la làmpada: cap.
    expect(planLights(k, p, { length: 70, depth: 381 }, 19).xs).toEqual([])
    // La 3010 compta 5 W en encendre.
    const p10 = planLights(item("light-loox-3010-ww").light!, p, { length: 762, depth: 381 }, 19)
    expect(p10.peakWatts).toBe(10)
    expect(p10.watts).toBe(6.5)
  })

  it("el pla d'una barra: la més curta que arriba, el perfil a la llum − 20 i la tira al múltiple de 50 dins de perfil − 5", () => {
    const k = item("light-loox-1088-ww").light!
    const b = planLights(k, { setback: 30, spacing: 0, depth: 0 }, { length: 1162, depth: 381 }, 19)
    expect(b.bar).toMatchObject({ length: 1500, article: "833.03.101", cut: 1142, strip: 1100 })
    expect(b.recessed).toBe(true)
    expect(b.watts).toBeCloseTo(27.9 * (1100 / 1500), 1)
    expect(b.lines[0]).toMatchObject({ qty: 1, item: "833.03.101", cutLength: 1142 })
    const long = planLights(k, { setback: 30, spacing: 0, depth: 0 }, { length: 2600, depth: 381 }, 19)
    expect(long.bar?.short).toBe(true)
    expect(long.bar?.cut).toBe(2000)
  })

  it("al moble: forat Ø55 × 12 i passant Ø8 a la cara de sota del prestatge i de la tapa, el cos de la llum a extras, la comanda amb l'interruptor", () => {
    const b = buildModule(mod({ shelves: { n: 1, adjustable: false }, led: { hardware: item("light-loox-3038-ww") }, front: { kind: "door", mode: "double", hinge: "left" } }))
    const shelf = b.panels.find((p) => p.role === "shelf")!
    const top = b.panels.find((p) => p.role === "top")!
    for (const p of [shelf, top]) {
      const lights = p.holes.filter((h) => h.tag === "light")
      expect(lights, p.id).toHaveLength(2)
      expect(lights.every((h) => h.diameter === 55 && h.depth === 12)).toBe(true)
      // El cable de cada làmpada: el passant Ø8 o, si va per dins del tauler, el forat de cantell Ø8 des del darrere.
      expect((p.cutouts ?? []).filter((c) => c.tag === "cable" && c.kind === "circle" && c.diameter === 8).length + p.holes.filter((h) => h.tag === "cable-run" && h.diameter === 8).length, p.id).toBe(2)
    }
    // Al prestatge (cara A a dalt), els forats van a la cara B; a 60 del davant.
    expect(shelf.holes.filter((h) => h.tag === "light").every((h) => h.face === "B" && Math.abs(h.y - 60) < 0.01)).toBe(true)
    expect(b.extras.filter((p) => p.label === "Llum Loox LED 3038")).toHaveLength(4)
    expect(b.extras.filter((p) => p.label === "Tira LED")).toHaveLength(0)
    expect(materialIssues({ panels: b.panels, extras: b.extras }, { references: [] }, DEFAULT_SETTINGS.materials)).toEqual([])
    expect(b.lightKits).toHaveLength(1)
    expect(b.lightKits[0]).toMatchObject({ lamps: 4, watts: 12, switch: "door", maker: "Häfele" })
    // L'interruptor de porta: Ø12 × 47 al cantell de davant del lateral esquerre.
    const sw = b.panels.find((p) => p.id === "side-left")!.holes.find((h) => h.tag === "light-switch")!
    expect(sw).toMatchObject({ face: "edge", diameter: 12, depth: 47 })
    expect(b.warnings.filter((w) => w.code === "light")).toEqual([])
    // Sense portes: interruptor de proximitat, cap forat.
    const open = buildModule(mod({ shelves: { n: 1, adjustable: false }, led: { hardware: item("light-loox-3038-ww") } }))
    expect(open.lightKits[0]!.switch).toBe("touch")
    expect(open.panels.find((p) => p.id === "side-left")!.holes.some((h) => h.tag === "light-switch")).toBe(false)
  })

  it("làmpada quadrada: rebaix de 205 × 205 × 6,5 (ranura) i barra: ranura de 16 × 11 al llarg", () => {
    const sq = buildModule(mod({ led: { hardware: item("light-loox-3024-ww") } }, { width: 800, height: 600, depth: 450 }))
    const top = sq.panels.find((p) => p.role === "top")!
    const g = top.grooves.filter((x) => x.tag === "light")
    // 762 de llum amb una làmpada cada 600: una, al mig.
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ w: 205, h: 205, depth: 6.5 })
    expect(g[0]!.x + 102.5).toBeCloseTo(762 / 2, 1)
    expect((top.cutouts ?? []).filter((c) => c.tag === "cable").length + top.holes.filter((h) => h.tag === "cable-run").length).toBe(1)
    const bar = buildModule(mod({ led: { hardware: item("light-loox-1088-ww") } }, { width: 800, height: 600, depth: 450 }))
    const bg = bar.panels.find((p) => p.role === "top")!.grooves.filter((x) => x.tag === "light")
    expect(bg).toHaveLength(1)
    expect(bg[0]).toMatchObject({ w: 742, h: 16, depth: 11 })
    expect(bar.lightKits[0]!.lines[0]).toMatchObject({ item: "833.03.100", cutLength: 742 })
  })

  it("un prestatge de 10 mm no s'encasta: caixa de sota el prestatge, només el forat del cable i avís light", () => {
    const m = mod({ shelves: { n: 1, adjustable: false }, led: { hardware: item("light-loox-3010-ww") } })
    const b = buildModule({ ...m, carcass: { ...m.carcass, thickness: 10 } })
    const shelf = b.panels.find((p) => p.role === "shelf")!
    expect(shelf.holes.filter((h) => h.tag === "light")).toHaveLength(0)
    expect((shelf.cutouts ?? []).filter((c) => c.tag === "cable")).toHaveLength(2)
    expect(b.warnings.some((w) => w.code === "light" && /munta a sobre/.test(w.message))).toBe(true)
    expect(b.lightKits[0]!.lines.some((l) => l.item === "833.77.730")).toBe(true)
  })

  it("res amagat compta: amb calaixos o front fix, cap llum ni comanda; sense tapa, avís", () => {
    expect(buildModule(mod({ led: { hardware: item("light-loox-3038-ww") }, front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } })).lightKits).toEqual([])
    const m = mod({ led: { hardware: item("light-loox-3038-ww") } })
    const noTop = buildModule({ ...m, carcass: { ...m.carcass, top: { kind: "none" } } })
    expect(noTop.lightKits).toEqual([])
    expect(noTop.warnings.some((w) => w.code === "light")).toBe(true)
  })

  it("el sistema elèctric: alimentador per la potència (amb el pic), distribuïdor passades les 6 ranures, interruptor i cable", () => {
    const sys = HAFELE_LOOX_SYSTEM
    const small = electricalLines(sys, 4, 12, "door")
    expect(small.map((l) => l.item)).toEqual(["833.77.951", "833.74.795", "833.89.128", "833.89.142"])
    const mid = electricalLines(sys, 8, 26, "touch")
    expect(mid.map((l) => [l.item, l.qty])).toEqual([["833.77.952", 1], ["833.77.724", 1], ["833.74.795", 1], ["833.89.136", 1], ["833.89.142", 1]])
    // 100 W: dos alimentadors de 90.
    const big = electricalLines(sys, 30, 100, "none")
    expect(big[0]).toMatchObject({ item: "833.77.953", qty: 2 })
    expect(big[1]).toMatchObject({ item: "833.77.724", qty: 4 })
    expect(electricalLines(sys, 0, 0, "door")).toEqual([])
  })

  it("la comanda per mòdul (Peces i LLEGEIX-ME) suma les làmpades iguals i hi posa el sistema", () => {
    const base = mod({ shelves: { n: 1, adjustable: false }, led: { hardware: item("light-loox-3038-ww") }, front: { kind: "door", mode: "single", hinge: "left" } })
    const comp = { id: "c", name: "C", kind: "moble" as const, modules: [{ ...base, id: "a" }, { ...base, id: "b", name: "B" }], parts: [], references: [], models: [] }
    const cb = buildComposition(comp as Parameters<typeof buildComposition>[0])
    expect(cb.lightKits).toHaveLength(2)
    const groups = lightGroups(cb.lightKits)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.title).toMatch(/Häfele Loox 24 V · 4 làmpades · 12 W \(mòdul 1\)/)
    expect(groups[0]!.lines.find((l) => l.component === "lamp:833.75.120")!.qty).toBe(4)
    expect(groups[0]!.lines.some((l) => l.item === "833.77.951")).toBe(true)
    const readme = lightReadmeLines(cb.lightKits)
    expect(readme.some((l) => /4 x Häfele Loox LED 3038 Blanc càlid 3000 K · 833.75.120/.test(l))).toBe(true)
    const xcs = toMaestroNestXcs(cb.panels, nest(cb.panels, DEFAULT_NEST_OPTIONS), defaultMachine(DEFAULT_SETTINGS.machines) ?? M!, { project: "C", kits: cb.hardwareKits, lights: cb.lightKits })
    expect(xcs.files.find((f) => f.name === "LLEGEIX-ME.txt")!.text).toMatch(/Llums i instal·lació elèctrica \(comanda\)/)
  })

  it("Preferències: la peça d'exemple i «Com va muntat» ensenyen els forats de la làmpada", () => {
    const prev = hardwarePreview(item("light-loox-3038-ww")).panels
    expect(prev).toHaveLength(1)
    expect(prev[0]!.holes.filter((h) => h.tag === "light" && h.face === "B").length).toBeGreaterThan(0)
    const m = hardwareMount(item("light-loox-3038-ww"))
    expect(m.error).toBeUndefined()
    expect(m.panels.some((p) => p.holes.some((h) => h.tag === "light"))).toBe(true)
    expect(m.focus?.hole.tag).toBe("light")
    const bar = hardwareMount(item("light-loox-1088-ww"))
    expect(bar.error).toBeUndefined()
    expect(bar.panels.some((p) => p.grooves.some((g) => g.tag === "light"))).toBe(true)
  })
})

describe("Maestro: forat gros sense broca → caixera rodona amb la fresa", () => {
  it("el Ø55 × 12 d'una làmpada surt com a CreateCircleCenterRadius + CreateContourPocket (context real del taller)", () => {
    const b = buildModule(mod({ led: { hardware: item("light-loox-3038-ww") } }, { width: 800, height: 600, depth: 450 }))
    const top = b.panels.find((p) => p.role === "top")!
    const lights = top.holes.filter((h) => h.tag === "light")
    expect(lights).toHaveLength(2)
    // La cara mecanitzada al nesting és l'A: si els forats de la tapa cauen a la B, es giren per al test.
    const face = lights[0]!.face
    const panel = face === "A" ? top : { ...top, holes: top.holes.map((h) => (h.face === "B" ? { ...h, face: "A" as const } : h.face === "A" ? { ...h, face: "B" as const } : h)) }
    const x = toMaestroNestXcs([panel], nest([panel], DEFAULT_NEST_OPTIONS), M!, { project: "L" })
    const text = x.files.map((f) => f.text).join("\n")
    expect(text).toMatch(/CreateCircleCenterRadius\("[^"]*_Caixera_1_G", [\d.]+, [\d.]+, 27\.5, (true|false)\);\s*CreateContourPocket\("[^"]*_Caixera_1", 12,/)
    expect(x.warnings.filter((w) => /Ø55/.test(w))).toEqual([])
  })
})

describe("llum a sota del moble", () => {
  it("un penjat amb un joc de llum a sota: el forat de la làmpada i el del cable a la cara de sota de la base, i la comanda", () => {
    const item = structuredClone(HAFELE_LOOX_ITEMS.find((x) => x.light && x.light.recess.shape === "round")!)
    const m = { ...defaultModule("m", "Alt", { width: 800, height: 600, depth: 330 }) }
    m.carcass = { ...m.carcass, base: { kind: "wall", height: 1400 }, underLight: { hardware: item } }
    const b = buildModule(m)
    const base = b.panels.find((p) => p.role === "bottom")!
    expect(base.holes.some((h) => h.tag === "light")).toBe(true)
    expect(b.lightKits.length).toBe(1)
    // Amb la base a terra (sense aire a sota), no es fa (es conserva).
    const floor = buildModule({ ...m, carcass: { ...m.carcass, base: { kind: "none" } } })
    expect(floor.panels.find((p) => p.role === "bottom")!.holes.some((h) => h.tag === "light")).toBe(false)
    // El perfil LED de l'app: la tira a sota de la base.
    const strip = buildModule({ ...m, carcass: { ...m.carcass, underLight: {} } })
    expect(strip.extras.some((p) => p.id === "led-under")).toBe(true)
  })
})

describe("recorregut dels cables dels llums", () => {
  it("el cable baixa per la cantonada (passants als prestatges fixos), l'alimentador sobre la base i la sortida pel fons", () => {
    const item = structuredClone(HAFELE_LOOX_ITEMS.find((x) => x.light && x.light.recess.shape === "round")!)
    const m = { ...defaultModule("m", "Alt", { width: 800, height: 720, depth: 330 }), root: { id: "z", shelves: { n: 1, adjustable: false }, led: { hardware: item } } } as never as ReturnType<typeof defaultModule>
    const b = buildModule(m)
    const shelf = b.panels.find((p) => p.role === "shelf" || p.role === "fixedShelf")!
    expect((shelf.cutouts ?? []).filter((c) => c.tag === "cable-run").length).toBeGreaterThan(0)
    const back = b.panels.find((p) => p.role === "back")!
    expect((back.cutouts ?? []).some((c) => c.tag === "cable-mains" && c.kind === "slot")).toBe(true)
    expect(b.wiring?.runs.length).toBe(b.lightKits.reduce((a, k) => a + k.lamps, 0))
    expect(b.wiring!.runs.every((r) => r.length > 0)).toBe(true)
    // Es veu al 3D: l'alimentador, els cables i la tapa passacables (de només veure).
    expect(b.extras.some((p) => p.id === "wiring-driver" && p.role === "hardware")).toBe(true)
    expect(b.extras.filter((p) => p.id.startsWith("wiring-0-")).length).toBeGreaterThan(2)
    // La base no es forada pel recorregut (l'alimentador hi va a sobre).
    expect((b.panels.find((p) => p.role === "bottom")!.cutouts ?? []).some((c) => c.tag === "cable-run")).toBe(false)
  })
})

describe("cables per la cambra de darrere del fons", () => {
  it("penjat amb el fons en ranura: el cable passa del prestatge al fons i puja per la cambra fins a sobre de la tapa, sense tapa passacables", () => {
    const item = structuredClone(HAFELE_LOOX_ITEMS.find((x) => x.light && x.light.recess.shape === "round")!)
    const m = { ...defaultModule("m", "Alt", { width: 800, height: 720, depth: 330 }), root: { id: "z", shelves: { n: 1, adjustable: false }, led: { hardware: item } } } as never as ReturnType<typeof defaultModule>
    m.carcass = { ...m.carcass, base: { kind: "wall", height: 1400 }, back: "groove", backSetback: 16 }
    const b = buildModule(m)
    const back = b.panels.find((p) => p.role === "back")!
    expect((back.cutouts ?? []).some((c) => c.tag === "cable-run")).toBe(true)
    expect(b.extras.some((p) => p.id.startsWith("wiring-cover"))).toBe(false)
    expect(b.wiring!.driver.where).toBe("a sobre de la tapa")
    expect(b.wiring!.notes.some((n) => n.includes("cambra"))).toBe(true)
  })
})
