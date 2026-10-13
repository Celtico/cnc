import { describe, expect, it } from "vitest"
import {
  DEFAULT_HARDWARE_LIBRARY,
  DEFAULT_SETTINGS,
  DTC_CATALOGUE_ITEMS,
  DTC_FITTINGS,
  DTC_HINGES,
  DTC_LIFTS,
  DTC_PLATES,
  DTC_PURE_BOX_HL12,
  DTC_PURE_PRO_HQ11,
  DTC_SLIDES,
  DTC_SUPPORTS,
  HardwareItemSchema,
  V28_ITEMS,
  defaultModule,
  fixHardwareDefaults,
  kitFrom,
  machiningProblems,
  parseSettings,
  type Module,
  type Zone,
} from "../model"
import { buildModule } from "./buildModule"
import { planKit } from "./drawerKit"
import { cupSpec, plateSpec, slideSpec } from "./hardware"

/**
 * La resta del catàleg DTC 2026 (v28): frontisses de cassoleta amb la placa, plaques, guies, elevables, portes
 * corredisses, unions, suports, i els jocs PURE-BOX HL i PURE-PRO HQ. Tot passa l'esquema, cada motor en llegeix els
 * números, i els per defecte dels llocs continuen sent els items de l'app.
 */

const byId = (id: string) => DEFAULT_HARDWARE_LIBRARY.find((x) => x.id === id)!

describe("catàleg DTC 2026: items", () => {
  it("tots passen l'esquema, tenen fabricant DTC, pàgines del catàleg i ids únics", () => {
    const ids = new Set<string>()
    for (const it of DTC_CATALOGUE_ITEMS) {
      expect(HardwareItemSchema.safeParse(it).success, it.id).toBe(true)
      expect(it.maker, it.id).toBe("DTC")
      expect(it.tags?.some((t) => /Catàleg DTC 2026/.test(t)), it.id).toBe(true)
      expect(ids.has(it.id), it.id).toBe(false)
      ids.add(it.id)
      if (it.machining) expect(machiningProblems(it.machining), it.id).toEqual([])
    }
    expect(DTC_HINGES.length).toBe(25)
    expect(DTC_PLATES.length).toBe(13)
    expect(DTC_SLIDES.length).toBe(20)
    expect(DTC_LIFTS.length + DTC_FITTINGS.length + DTC_SUPPORTS.length).toBe(12)
    // Per decisió de l'usuari: tot item del catàleg mecanitza alguna cosa (forats del motor o mecanitzats del generador).
    for (const it of DTC_CATALOGUE_ITEMS) expect(it.targets.some((t) => t.ops.length > 0) || (it.machining?.length ?? 0) > 0, it.id).toBe(true)
  })
  it("frontissa C81 110°: cassoleta Ø35 × 11,5 a 22,5 (K 5), dos cargols a 45 i la placa de dos forats euro a la filera", () => {
    const h = cupSpec(byId("hinge-dtc-c81-110"))
    expect(h).toMatchObject({ cupDiameter: 35, cupDepth: 11.5, cupOffset: 22.5 })
    expect(h.plate).toMatchObject({ setback: 37, offset: 0 })
    expect(h.plate!.holes.map((x) => [x.u, x.v, x.d, x.depth])).toEqual([[-16, 0, 5, 12], [16, 0, 5, 12]])
    expect(h.count(700)).toBe(2)
    // Cassoleta petita Ø26 (K + 13) i Ø40 (K + 20).
    expect(cupSpec(byId("hinge-dtc-c80-26-100")).cupOffset).toBe(18)
    expect(cupSpec(byId("hinge-dtc-c80-40-95"))).toMatchObject({ cupDiameter: 40, cupDepth: 13, cupOffset: 25 })
  })
  it("una porta amb la frontissa DTC fa la cassoleta, els dos cargols i els forats de la placa al lateral", () => {
    const base = defaultModule("m", "Porta", { width: 600, height: 720, depth: 500, thickness: 16 })
    const root: Zone = { id: "root", front: { kind: "door", mode: "single", hinge: "left", hardware: structuredClone(byId("hinge-dtc-c82-110")) } }
    const m: Module = { ...base, root }
    const b = buildModule(m)
    const door = b.panels.find((p) => p.role === "door")!
    expect(door.holes.filter((h) => h.tag === "hinge")).toHaveLength(2)
    expect(door.holes.filter((h) => h.tag === "hinge-screw")).toHaveLength(4)
    // Els forats de la placa cauen sobre la filera System 32 (mateix Ø5 × 12): `addPlate` es queda el que ja hi és.
    const side = b.panels.find((p) => p.role === "side")!
    const cupYs = door.holes.filter((h) => h.tag === "hinge").map((h) => h.x)
    for (const y of cupYs) expect(side.holes.some((h) => Math.abs(h.x - y) <= 16.01 && (h.tag === "plate" || h.tag === "system32")), String(y)).toBe(true)
    expect(b.warnings.filter((w) => w.code === "hardware" || /placa/i.test(w.message))).toEqual([])
  })
  it("plaques: dos forats a 32, quatre forats amb els dos de fusta a 11 del davant, en línia a 20 i 52", () => {
    expect(plateSpec(byId("plate-dtc-81h-2")).holes.map((h) => [h.u, h.v])).toEqual([[-16, 0], [16, 0]])
    expect(plateSpec(byId("plate-dtc-89h-4")).holes.map((h) => [h.u, h.v])).toEqual([[-16, 0], [16, 0], [-16, -26], [16, -26]])
    expect(plateSpec(byId("plate-dtc-82h-inline")).holes.map((h) => [h.u, h.v])).toEqual([[0, -17], [0, 15]])
  })
  it("guies: l'oculta TS10 (SKW = LW − 42, 37 + 224) i la de boles 45 (12,7 per costat); un calaix amb la TS10 es construeix", () => {
    const ts = slideSpec(byId("slide-dtc-ts10"))
    expect(ts).toMatchObject({ sideClearance: 21, frontOffset: 37, secondOffset: 224, backClearance: 10 })
    expect(ts.slideLengths).toEqual([250, 270, 300, 350, 400, 450, 500, 550, 600])
    expect(slideSpec(byId("slide-dtc-ts80")).sideClearance).toBe(24.5)
    expect(slideSpec(byId("slide-dtc-bb-45"))).toMatchObject({ sideClearance: 12.7, holeHeight: 22.8, frontOffset: 35 })
    const base = defaultModule("m", "Calaixos", { width: 600, height: 720, depth: 500, thickness: 16 })
    const root: Zone = { id: "root", front: { kind: "drawers", n: 2, heights: ["auto", "auto"], hardware: structuredClone(byId("slide-dtc-ts10")) } }
    const b = buildModule({ ...base, root })
    expect(b.panels.filter((p) => p.role === "drawerSide")).toHaveLength(4)
    expect(b.panels.filter((p) => p.role === "drawerSide")[0]!.length).toBeLessThanOrEqual(490)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
  })
  it("unions: l'excèntrica Ø15 porta la caixera a la cara, el pern al cantell i el forat a la peça que continua", () => {
    const cam = byId("cam-dtc-15")
    expect(cam.machining!.map((o) => [o.part, o.face, o.d, o.depth])).toEqual([["shelf", "A", 15, 12.5], ["shelf", "edge", 8, 36], ["side", "A", 5, 12]])
    expect(byId("shelf-dtc-ac02").engine).toBe("system32")
    expect(byId("hinge-dtc-d").machining!.every((o) => o.kind === "pocket")).toBe(true)
  })
  it("els per defecte dels llocs continuen sent els items de l'app, encara que el catàleg en tingui del mateix motor", () => {
    const hw = kitFrom(DEFAULT_HARDWARE_LIBRARY, DEFAULT_SETTINGS.hardwareDefaults)
    expect(hw.hinge.id).toBe("hinge-cup")
    expect(hw.slide.id).toBe("slide-ball")
    // Sense cap guia triada, torna la de l'app (no la primera DTC).
    const fixed = fixHardwareDefaults(DEFAULT_HARDWARE_LIBRARY.filter((x) => x.id !== "slide-ball"), { ...DEFAULT_SETTINGS.hardwareDefaults })
    expect(fixed.defaults.slide).toBe("slide-ball")
    expect(fixed.library.some((x) => x.id === "slide-ball")).toBe(true)
  })
})

describe("jocs PURE-BOX HL i PURE-PRO HQ", () => {
  it("HL12: només suau, guies GG10<NL>H, laterals HLG (250, 270) / HL, fons LW − 16 × NL − 21, darrere LW − 16 × 97", () => {
    expect(DTC_PURE_BOX_HL12.options.closing).toEqual(["soft"])
    expect(DTC_PURE_BOX_HL12.variants.find((v) => v.nl === 270)!).toMatchObject({ slides: { soft: "GG10270H" }, sideKit: "HLG12270X" })
    expect(DTC_PURE_BOX_HL12.variants.find((v) => v.nl === 450)!.sideKit).toBe("HL12450X")
    const plan = planKit(byId("kit-dtc-hl12"), { LW: 700, depth: 480, G: 16, TB: 16 }).plan!
    expect(plan.nl).toBe(450)
    expect(plan.wood).toEqual([expect.objectContaining({ key: "bottom", width: 684, depth: 429 }), expect.objectContaining({ key: "back", width: 684, height: 97 })])
    expect(plan.frontPilots.map((h) => h.x)).toEqual([27, 27, 27])
    expect(plan.lines.find((l) => l.component === "syncRod")).toBeUndefined()
  })
  it("HQ11: els números de la sèrie de vidre, les guies HD10 i el lateral de vidre HK11062 com a component", () => {
    const v = DTC_PURE_PRO_HQ11.variants.find((x) => x.nl === 450)!
    expect(v.kit).toEqual({ soft: "HQ11450A12", push: "HQ614504A12" })
    expect(v.slides).toEqual({ soft: "HD10450H", push: "HD104504GX" })
    expect(v.sideKit).toBe("HQ11452")
    const plan = planKit(byId("kit-dtc-hq11"), { LW: 700, depth: 480, G: 16, TB: 16 }).plan!
    expect(plan.lines.find((l) => l.component === "glassSide")).toMatchObject({ item: "HK11062", qty: 2 })
    expect(plan.solids.some((s) => s.component.id === "glassSide" && s.component.material === "Vidre")).toBe(true)
  })
})

describe("v28: la resta del catàleg DTC 2026", () => {
  it("unes preferències v27 reben els items nous; unes v28 sense un d'ells no el tornen a rebre; els per defecte no canvien", () => {
    const v27 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 27, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => !V28_ITEMS.some((k) => k.id === x.id)) }
    const res = parseSettings(v27)
    expect(res.migrated).toBe(true)
    for (const k of V28_ITEMS) expect(res.settings.hardwareLibrary.some((x) => x.id === k.id), k.id).toBe(true)
    expect(res.settings.hardwareDefaults).toEqual(DEFAULT_SETTINGS.hardwareDefaults)
    const v28 = { ...JSON.parse(JSON.stringify(res.settings)), hardwareLibrary: res.settings.hardwareLibrary.filter((x) => x.id !== "hinge-dtc-c81-110") }
    expect(parseSettings(v28).settings.hardwareLibrary.some((x) => x.id === "hinge-dtc-c81-110")).toBe(false)
  })
})
