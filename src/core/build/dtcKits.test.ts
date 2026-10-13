import { describe, expect, it } from "vitest"
import {
  DEFAULT_HARDWARE_KITS,
  DEFAULT_SETTINGS,
  DTC_DRAGON_PRO_HB01,
  DTC_DRAGON_PRO_HB0C,
  DTC_MAGIC_PRO_HT11,
  DTC_MAGIC_STAR_HD11,
  DTC_PURE_PRO_HK11,
  HardwareItemSchema,
  V27_ITEMS,
  chooseVariant,
  defaultModule,
  kitOptionsOf,
  parseSettings,
  widthRule,
  type Module,
  type Zone,
} from "../model"
import { buildModule } from "./buildModule"
import { planKit } from "./drawerKit"

/**
 * Els jocs llegits del catàleg DTC 2026 a més del MAGIC-PRO: MAGIC-STAR ULTRA (HD), DRAGON-PRO (HB) i PURE-PRO HK, i els
 * push latch MS. Números d'article, fusta per fórmula, prebroques, opcions i la migració v27 de les preferències.
 */

const byId = (id: string) => DEFAULT_HARDWARE_KITS.find((k) => k.id === id)!

function kitModule(kitId: string, n = 1, size: Partial<Module["carcass"]> = {}): Module {
  const base = defaultModule("m", "Calaixos", { width: 732, height: 720, depth: 500, thickness: 16, ...size })
  const root: Zone = { id: "root", front: { kind: "drawers", n, heights: Array.from({ length: n }, () => "auto"), hardware: structuredClone(byId(kitId)) } }
  return { ...base, root }
}

describe("MAGIC-STAR ULTRA HD (pp. 273–310)", () => {
  it("números d'article: joc, guies (HD10<NL>H / 04GX / 04K) i laterals; push + suau només des de 350", () => {
    const v = DTC_MAGIC_STAR_HD11.variants.find((x) => x.nl === 450)!
    expect(v.kit).toEqual({ soft: "HD114504A11", push: "HD614504A11", pushSoft: "HD714504A11" })
    expect(v.slides).toEqual({ soft: "HD10450H", push: "HD104504GX", pushSoft: "HD104504K" })
    expect(v.sideKit).toBe("HD1145011")
    expect(DTC_MAGIC_STAR_HD11.variants.find((x) => x.nl === 270)!.kit).toEqual({ soft: "HD112704A11", push: "HD612704A11" })
    expect(chooseVariant(DTC_MAGIC_STAR_HD11, 320, "pushSoft")).toBeNull()
  })
  it("fusta: fons LW − 19 × NL − 13 (amb els dos darreres), darrere LW − 40 × 58; sense suports de darrere; barra ○/● sense estabilitzador", () => {
    const res = planKit(byId("kit-dtc-hd11"), { LW: 700, depth: 480, G: 16, TB: 16, options: { closing: "push" } })
    const plan = res.plan!
    expect(plan.nl).toBe(450)
    expect(plan.wood).toEqual([expect.objectContaining({ key: "bottom", width: 681, depth: 437, thickness: 16 }), expect.objectContaining({ key: "back", width: 660, height: 58, thickness: 16 })])
    const items = Object.fromEntries(plan.lines.map((l) => [l.component, l.item]))
    expect(items).toMatchObject({ kit: "HD614504A11", slide: "HD104504GX", boxSide: "HD1145011", frontBracket: "HE11011X", syncRod: "GG0FH01" })
    expect(plan.lines.find((l) => l.component === "backBracket")).toBeUndefined()
    expect(plan.lines.find((l) => l.component === "stabilizer")).toBeUndefined()
    expect(widthRule(DTC_MAGIC_STAR_HD11, 732)).toMatchObject({ stabilizer: 0, syncRod: 2 })
    expect(plan.syncRod).toBe(533)
    const metal = planKit(byId("kit-dtc-hd11"), { LW: 700, depth: 480, G: 16, TB: 16, options: { back: "metal" } }).plan!
    expect(metal.wood).toEqual([expect.objectContaining({ key: "bottom", width: 681, depth: 437 })])
    expect(metal.lines.find((l) => l.component === "metalBack")!.item).toBe("HD11034800")
    expect(res.warnings).toEqual([])
  })
  it("acabat negre mat (E36) als laterals: també al MAGIC-PRO", () => {
    expect(kitOptionsOf(DTC_MAGIC_STAR_HD11, { closing: "soft", back: "wood", finish: "black" }).finish).toBe("black")
    expect(kitOptionsOf(DTC_MAGIC_PRO_HT11, { closing: "soft", back: "wood", finish: "black" }).finish).toBe("black")
    // PURE-PRO HK només blanc i gris: el negre torna al primer.
    expect(kitOptionsOf(DTC_PURE_PRO_HK11, { closing: "soft", back: "wood", finish: "black" }).finish).toBe("white")
  })
})

describe("DRAGON-PRO HB (pp. 341–374)", () => {
  it("NL de 250 a 650, només suau i push-open; números del joc, de les guies (iguals a totes les alçades) i dels laterals", () => {
    expect(DTC_DRAGON_PRO_HB01.variants.map((v) => v.nl)).toEqual([250, 270, 300, 350, 400, 450, 500, 550, 600, 650])
    const v = DTC_DRAGON_PRO_HB01.variants.find((x) => x.nl === 450)!
    expect(v.kit).toEqual({ soft: "HB014504AX", push: "HB614504AX" })
    expect(v.slides).toEqual({ soft: "HB014504H-1", push: "HB014504GX" })
    expect(v.sideKit).toBe("HB01450X")
    expect(DTC_DRAGON_PRO_HB0C.variants.find((x) => x.nl === 250)!.kit).toEqual({ soft: "HB0C2504AX", push: "HB6C2504AX" })
    expect(DTC_DRAGON_PRO_HB01.options.closing).toEqual(["soft", "push"])
    expect(chooseVariant(DTC_DRAGON_PRO_HB01, 653, "soft")?.nl).toBe(650)
  })
  it("fusta: fons LW − 75 × NL − 24 (fusta) o NL − 22 (metàl·lic), darrere LW − 87 × 84; suports TB01031; barra tallada a LW − 106", () => {
    const res = planKit(byId("kit-dtc-hb01"), { LW: 700, depth: 480, G: 16, TB: 16, options: { closing: "push" } })
    const plan = res.plan!
    expect(plan.wood).toEqual([expect.objectContaining({ key: "bottom", width: 625, depth: 426 }), expect.objectContaining({ key: "back", width: 613, height: 84 })])
    const items = Object.fromEntries(plan.lines.map((l) => [l.component, l.item]))
    expect(items).toMatchObject({ kit: "HB614504AX", slide: "HB014504GX", boxSide: "HB01450X", frontBracket: "HE11011X", backBracket: "TB01031", syncRod: "GG0FH01" })
    expect(plan.syncRod).toBe(594)
    const metal = planKit(byId("kit-dtc-hb01"), { LW: 700, depth: 480, G: 16, TB: 16, options: { back: "metal" } }).plan!
    expect(metal.wood).toEqual([expect.objectContaining({ key: "bottom", width: 625, depth: 428 })])
    expect(metal.lines.find((l) => l.component === "metalBack")!.item).toBe("TB0134800")
    expect(metal.lines.find((l) => l.component === "stabilizer")).toMatchObject({ note: expect.stringContaining("recomanat") })
    expect(res.warnings).toEqual([])
  })
  it("els C (209) i F (238) no tenen darrere metàl·lic al catàleg: només darrere de fusta", () => {
    expect(DTC_DRAGON_PRO_HB0C.options.back).toEqual(["wood"])
    expect(DTC_DRAGON_PRO_HB0C.components.some((c) => c.id === "metalBack")).toBe(false)
    expect(kitOptionsOf(DTC_DRAGON_PRO_HB0C, { closing: "soft", back: "metal" }).back).toBe("wood")
  })
})

describe("PURE-PRO HK (pp. 407–414)", () => {
  it("números: joc HK1s<NL>A11 / HK6s<NL/10>04A11, guies HD10 i laterals HK1s<NL/10>01; NL fins a 550", () => {
    const v = DTC_PURE_PRO_HK11.variants.find((x) => x.nl === 450)!
    expect(v.kit).toEqual({ soft: "HK11450A11", push: "HK614504A11" })
    expect(v.slides).toEqual({ soft: "HD10450H", push: "HD104504GX" })
    expect(v.sideKit).toBe("HK114501")
    expect(DTC_PURE_PRO_HK11.variants.at(-1)!.nl).toBe(550)
    expect(DTC_PURE_PRO_HK11.options.finish).toEqual(["white", "grey"])
  })
  it("fusta: fons i darrere LW − 16 (× NL − 27 i × 64); pius del front a 20 del lateral i a 23 / 39 del joc (≥ 61 del cantell de baix)", () => {
    const plan = planKit(byId("kit-dtc-hk11"), { LW: 700, depth: 480, G: 16, TB: 16 }).plan!
    expect(plan.wood).toEqual([expect.objectContaining({ key: "bottom", width: 684, depth: 423 }), expect.objectContaining({ key: "back", width: 684, height: 64 })])
    expect(plan.frontPilots).toEqual([{ x: 20, y: 23 }, { x: 20, y: 39 }])
    expect(plan.backPilots.map((h) => h.y)).toEqual([21, 53])
    expect(plan.lines.find((l) => l.component === "metalBack")).toBeUndefined()
    expect(planKit(byId("kit-dtc-hk11"), { LW: 700, depth: 480, G: 16, TB: 16, options: { back: "metal" } }).plan!.lines.find((l) => l.component === "metalBack")!.item).toBe("HK11034800")
  })
})

describe("tots els jocs DTC", () => {
  it("passen l'esquema i es construeixen en un mòdul de 732 × 720 × 500 (tauler de 16) sense laterals de fusta ni avisos de ferratge", () => {
    for (const k of DEFAULT_HARDWARE_KITS) {
      expect(HardwareItemSchema.safeParse(k).success, k.id).toBe(true)
      const b = buildModule(kitModule(k.id))
      expect(b.panels.filter((p) => p.role === "drawerSide"), k.id).toHaveLength(0)
      expect(b.panels.filter((p) => p.role === "drawerBottom"), k.id).toHaveLength(1)
      expect(b.panels.filter((p) => p.role === "drawerBack"), k.id).toHaveLength(1)
      expect(b.hardwareKits, k.id).toHaveLength(1)
      expect(b.hardwareKits[0]!.nl, k.id).toBe(k.kit!.variants.map((v) => v.nl).filter((nl) => nl + 3 <= 500 - 16).sort((a, b) => b - a)[0])
      expect(b.warnings.filter((w) => w.code === "hardware"), k.id).toEqual([])
      // Prebroques Ø2 als dos laterals, al front i al darrere.
      const sides = b.panels.filter((p) => p.role === "side")
      expect(sides.every((p) => p.holes.some((h) => h.tag === "kit-slide")), k.id).toBe(true)
      expect(b.panels.find((p) => p.role === "drawerFront")!.holes.some((h) => h.tag === "kit-front"), k.id).toBe(true)
    }
    expect(DEFAULT_HARDWARE_KITS.map((k) => k.id.replace(/^kit-dtc-/, ""))).toEqual(["ht10", "ht11", "ht12", "ht13", "ht14", "hd11", "hd12", "hd13", "hd14", "hb01", "hb02", "hb03", "hb0c", "hb04", "hk11", "hk12", "hk13", "hq11", "hq13", "hl11", "hl12", "hl13"])
  })
})

describe("v27: catàleg DTC 2026", () => {
  it("unes preferències v26 reben els jocs nous; unes v27 sense un d'ells no el tornen a rebre", () => {
    const v26 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 26, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => !V27_ITEMS.some((k) => k.id === x.id)) }
    const res = parseSettings(v26)
    expect(res.migrated).toBe(true)
    for (const k of V27_ITEMS) expect(res.settings.hardwareLibrary.some((x) => x.id === k.id), k.id).toBe(true)
    // El MAGIC-PRO d'abans es queda (amb l'acabat negre al joc de la biblioteca, no es toca: les còpies manen).
    expect(res.settings.hardwareLibrary.filter((x) => x.engine === "drawerKit")).toHaveLength(DEFAULT_HARDWARE_KITS.length)
    const v27 = { ...JSON.parse(JSON.stringify(res.settings)), hardwareLibrary: res.settings.hardwareLibrary.filter((x) => x.id !== "kit-dtc-hb01") }
    const r2 = parseSettings(v27)
    expect(r2.settings.hardwareLibrary.some((x) => x.id === "kit-dtc-hb01")).toBe(false)
  })
})
