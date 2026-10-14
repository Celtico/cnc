import { describe, expect, it } from "vitest"
import { DEFAULT_HARDWARE_KITS, DEFAULT_MODULE_HARDWARE, DTC_MAGIC_PRO_HT11, HardwareItemSchema, KIT_RAIL_MATERIAL, KIT_RUNNER_MATERIAL, chooseVariant, defaultModule, fixHardwareDefaults, kitFrom, kitItem, visibleModule, widthRule, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { kitLineText, planKit } from "./drawerKit"
import { slotSpec } from "./hardware"
import { ruleHardwareCounts } from "./hardwareSummary"
import { hardwareMount } from "./hardwareMount"
import { hardwarePreview } from "./hardwarePreview"

/**
 * Calaix amb joc paramètric (DTC MAGIC-PRO HT11 M): la NL per la fondària, la fusta per fórmula (sense laterals), les
 * prebroques Ø2 × 10 als laterals del moble, al front i al darrere, els components amb el número d'article i tot o res.
 */

const HT11 = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-ht11")!

/** Mòdul de 732 × 720 × 500 (tauler 16: LW 700) amb una pila de 2 calaixos amb el joc. */
function kitModule(n = 2, overrides: Partial<Module["carcass"]> = {}, kit = HT11, options?: { closing?: "soft" | "push" | "pushSoft"; back?: "wood" | "metal"; finish?: "white" | "grey" }): Module {
  const base = defaultModule("m", "Calaixos", { width: 732, height: 720, depth: 500, thickness: 16, ...overrides })
  const root: Zone = { id: "root", front: { kind: "drawers", n, heights: Array.from({ length: n }, () => "auto"), hardware: structuredClone(kit), ...(options ? { kit: options } : {}) } }
  return { ...base, root }
}

describe("joc paramètric: regles", () => {
  it("tria la NL més gran que hi cap (NL + 3 ≤ fondària) i només si es ven amb el tancament", () => {
    expect(chooseVariant(DTC_MAGIC_PRO_HT11, 480, "soft")?.nl).toBe(450)
    expect(chooseVariant(DTC_MAGIC_PRO_HT11, 453, "soft")?.nl).toBe(450)
    expect(chooseVariant(DTC_MAGIC_PRO_HT11, 452, "soft")?.nl).toBe(400)
    expect(chooseVariant(DTC_MAGIC_PRO_HT11, 320, "pushSoft")).toBeNull() // push + suau només des de 350
    expect(chooseVariant(DTC_MAGIC_PRO_HT11, 200, "soft")).toBeNull()
  })
  it("taula d'amplades: fins a 600 cap estabilitzador i barra recomanada; 800–1200 estabilitzador recomanat i barra molt recomanada", () => {
    expect(widthRule(DTC_MAGIC_PRO_HT11, 600)).toMatchObject({ stabilizer: 0, syncRod: 1 })
    expect(widthRule(DTC_MAGIC_PRO_HT11, 732)).toMatchObject({ stabilizer: 1, syncRod: 2 })
    expect(widthRule(DTC_MAGIC_PRO_HT11, 1300)).toBeNull()
  })
  it("números d'article del catàleg (pp. 233–234)", () => {
    const v = DTC_MAGIC_PRO_HT11.variants.find((x) => x.nl === 450)!
    expect(v.kit).toEqual({ soft: "HT114504A11", push: "HT614504A11", pushSoft: "HT514504A11" })
    expect(v.slides).toEqual({ soft: "HT104504H", push: "HT104504GX", pushSoft: "HT504504H" })
    expect(v.sideKit).toBe("HT114501")
    expect(DTC_MAGIC_PRO_HT11.variants.find((x) => x.nl === 270)!.kit).toEqual({ soft: "HT112704A11", push: "HT612704A11" })
  })
  it("pla: NL 450, fusta A 681 × 421 i B 660 × 63, comanda amb la barra tallada a LW − 167 en push-open", () => {
    const res = planKit(HT11, { LW: 700, depth: 480, G: 16, TB: 16, options: { closing: "push" } })
    const plan = res.plan!
    expect(plan.nl).toBe(450)
    expect(plan.wood).toEqual([
      expect.objectContaining({ key: "bottom", width: 681, depth: 421, thickness: 16 }),
      expect.objectContaining({ key: "back", width: 660, height: 63, thickness: 16 }),
    ])
    expect(plan.syncRod).toBe(533)
    const items = Object.fromEntries(plan.lines.map((l) => [l.component, l.item]))
    expect(items).toMatchObject({ kit: "HT614504A11", slide: "HT104504GX", boxSide: "HT114501", frontBracket: "TB01011", backBracket: "HT11031", syncRod: "GG0FH01" })
    expect(plan.lines.find((l) => l.component === "stabilizer")).toBeUndefined() // només amb tancament suau
    expect(plan.lines.find((l) => l.component === "metalBack")).toBeUndefined()
    expect(kitLineText(plan.lines.find((l) => l.component === "syncRod")!)).toContain("tallar a 533 mm")
    // Prebroques: 37 i les dues columnes del darrere a les dues fileres, 69 i 165 a la de dalt.
    expect(plan.sidePilots.map((h) => h.z)).toEqual([37, 37, 261, 261, 293, 293, 69, 165])
    expect(res.warnings).toEqual([])
  })
  it("darrere metàl·lic: fons NL − 27, número per amplada KB, sense darrere de fusta; avisa amb laterals de 19", () => {
    const res = planKit(HT11, { LW: 700, depth: 480, G: 19, TB: 16, options: { back: "metal" } })
    const plan = res.plan!
    expect(plan.wood).toEqual([expect.objectContaining({ key: "bottom", width: 681, depth: 423 })])
    expect(plan.lines.find((l) => l.component === "metalBack")!.item).toBe("HT11034800")
    expect(plan.lines.find((l) => l.component === "stabilizer")).toMatchObject({ note: expect.stringContaining("recomanat") })
    expect(res.warnings.some((w) => w.includes("laterals de 16"))).toBe(true)
  })
  it("cap NL que hi càpiga: cap pla i l'avís", () => {
    const res = planKit(HT11, { LW: 700, depth: 250, G: 16, TB: 16 })
    expect(res.plan).toBeNull()
    expect(res.warnings[0]).toContain("cap llargada")
  })
  it("l'item passa l'esquema i la prebroca a 0 no fa cap forat", () => {
    expect(HardwareItemSchema.safeParse(HT11).success).toBe(true)
    const off = kitItem("k", "Sense prebroca", DTC_MAGIC_PRO_HT11, { pilotDiameter: 0, pilotDepth: 10 })
    expect(planKit(off, { LW: 700, depth: 480, G: 16, TB: 16 }).plan!.pilot).toBeNull()
  })
})

describe("joc paramètric: construcció", () => {
  it("732 × 500 amb tauler de 16: NL 450, fons 681 × 421 × 16, darrere 660 × 63, cap lateral de fusta", () => {
    const b = buildModule(kitModule(2))
    const roles = b.panels.map((p) => p.role)
    expect(roles.filter((x) => x === "drawerSide")).toHaveLength(0)
    expect(roles.filter((x) => x === "drawerFront")).toHaveLength(2)
    const bottoms = b.panels.filter((p) => p.role === "drawerBottom")
    const backs = b.panels.filter((p) => p.role === "drawerBack")
    expect(bottoms).toHaveLength(2)
    expect(bottoms.map((p) => [p.length, p.width, p.thickness])).toEqual([[681, 421, 16], [681, 421, 16]])
    expect(backs.map((p) => [p.length, p.width, p.thickness])).toEqual([[660, 63, 16], [660, 63, 16]])
    // El fons del material del cos (mateix gruix).
    expect(bottoms[0]!.material).toBe(b.panels[0]!.material)
    expect(b.hardwareKits).toHaveLength(2)
    expect(b.hardwareKits[0]).toMatchObject({ drawer: 1, nl: 450, options: { closing: "soft", back: "wood" } })
    // Components de només veure: la guia fixa al moble (`kitfix-`), la resta surt amb el calaix (`drawer-`).
    const solids = b.extras.filter((p) => p.role === "hardware")
    expect(solids.length).toBeGreaterThan(8)
    expect(solids.every((p) => /^(drawer|kitfix)-[12]-kit-/.test(p.id))).toBe(true)
    expect(solids.filter((p) => p.id.startsWith("kitfix-")).every((p) => p.id.includes("-kit-slide-"))).toBe(true)
    const slide = solids.find((p) => p.id.startsWith("kitfix-1-kit-slide-left"))!
    expect(slide.thickness).toBe(450)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
  })
  it("prebroques Ø2 × 10 als dos laterals (mirall), al darrere del front i al darrere del calaix", () => {
    const b = buildModule(kitModule(1))
    const left = b.panels.find((p) => p.id === "side-left")!
    const right = b.panels.find((p) => p.id === "side-right")!
    const l = left.holes.filter((h) => h.tag === "kit-slide")
    const rr = right.holes.filter((h) => h.tag === "kit-slide")
    expect(l).toHaveLength(8)
    expect(rr).toHaveLength(8)
    expect(l.every((h) => h.diameter === 2 && h.depth === 10)).toBe(true)
    // Mirall: al lateral (u = alçada, v = fondària) l'esquerre mesura v des del darrere i el dret des del davant.
    const key = (h: { x: number; y: number }, fromFront: number) => `${h.x}:${fromFront}`
    expect(l.map((h) => key(h, left.width - h.y)).sort()).toEqual(rr.map((h) => key(h, h.y)).sort())
    // Les columnes a 37, 69, 165, 261 i 293 del cantell de davant del lateral.
    const zs = [...new Set(rr.map((h) => Math.round(h.y)))].sort((a, b) => a - b)
    expect(zs).toEqual([37, 69, 165, 261, 293])
    // Dues fileres: a 10 i 38 per sobre de la vora inferior de la guia.
    const ys = [...new Set(rr.map((h) => h.x))].sort((a, b) => a - b)
    expect(ys[1]! - ys[0]!).toBe(28)
    const front = b.panels.find((p) => p.role === "drawerFront")!
    const f = front.holes.filter((h) => h.tag === "kit-front")
    expect(f).toHaveLength(4)
    expect(f.every((h) => h.face === "A")).toBe(true)
    // El forat de baix a ≥ 51 del cantell de baix del front (y local cap avall: el cantell de baix és y = ample).
    expect(Math.min(...f.map((h) => front.width - h.y))).toBeGreaterThanOrEqual(51)
    const back = b.panels.find((p) => p.role === "drawerBack")!
    const bk = back.holes.filter((h) => h.tag === "kit-back")
    expect(bk.map((h) => [h.x, h.y]).sort()).toEqual([[9, 19], [9, 51], [651, 19], [651, 51]].sort())
  })
  it("tot o res: sense fondària, només els fronts i l'avís; sense un lateral, ni el front (`zoneSupport.ts`)", () => {
    const shallow = buildModule(kitModule(1, { depth: 260 }))
    expect(shallow.panels.filter((p) => p.role === "drawerBottom")).toHaveLength(0)
    expect(shallow.panels.filter((p) => p.role === "drawerFront")).toHaveLength(1)
    expect(shallow.hardwareKits).toHaveLength(0)
    expect(shallow.warnings.some((w) => w.code === "hardware" && w.message.includes("cap llargada"))).toBe(true)
    // Sense un lateral el compartiment no aguanta cap front: ni calaix ni front ni avís del joc; amb els dos, el calaix sencer.
    const noSide = buildModule(kitModule(1, { sides: { left: true, right: false } }))
    expect(noSide.panels.filter((p) => p.role === "drawerBottom" || p.role === "drawerFront")).toHaveLength(0)
    expect(noSide.hardwareKits).toHaveLength(0)
    expect(noSide.warnings.filter((w) => w.code === "hardware")).toEqual([])
    const sides = buildModule(kitModule(1))
    expect(sides.panels.filter((p) => p.role === "drawerBottom")).toHaveLength(1)
    expect(sides.hardwareKits).toHaveLength(1)
    // Massa calaixos per a l'alçada: els que no hi caben, només el front.
    const many = buildModule(kitModule(6))
    expect(many.warnings.some((w) => w.code === "hardware" && w.message.includes("no cap al calaix"))).toBe(true)
  })
  it("opcions: push-open amb barra de sincronització i darrere metàl·lic", () => {
    const b = buildModule(kitModule(1, {}, HT11, { closing: "push", back: "metal" }))
    expect(b.panels.filter((p) => p.role === "drawerBack")).toHaveLength(0)
    expect(b.hardwareKits[0]).toMatchObject({ syncRod: 533, options: { closing: "push", back: "metal" } })
    expect(b.extras.some((p) => p.id.includes("-kit-syncRod-"))).toBe(true)
    expect(b.extras.some((p) => p.id.includes("-kit-metalBack-"))).toBe(true)
    // Avís del catàleg: darrere metàl·lic només per a laterals de 16 (aquí 16: cap avís).
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
  })
  it("la guia normal del mòdul no canvia: una pila sense joc fa laterals de fusta com sempre", () => {
    const m = kitModule(2)
    const root = m.root as Zone & { front: { hardware?: unknown } }
    delete root.front.hardware
    const b = buildModule({ ...m, hardware: DEFAULT_MODULE_HARDWARE })
    expect(b.panels.filter((p) => p.role === "drawerSide")).toHaveLength(4)
    expect(b.hardwareKits).toEqual([])
  })
  it("la guia telescòpica: el cos fix al moble (acer fosc) i la corredora que surt amb el calaix (acer clar), totes dues NL; els laterals de l'acabat triat", () => {
    const b = buildModule(kitModule(1))
    const solids = b.extras.filter((p) => p.role === "hardware")
    const rails = solids.filter((p) => p.id.includes("-kit-slide-"))
    const fixed = rails.filter((p) => p.id.startsWith("kitfix-1-"))
    const runners = rails.filter((p) => p.id.startsWith("drawer-1-"))
    expect(fixed).toHaveLength(2)
    expect(runners).toHaveLength(2)
    expect(fixed.every((p) => p.thickness === 450 && p.material === KIT_RAIL_MATERIAL)).toBe(true)
    expect(runners.every((p) => p.thickness === 450 && p.material === KIT_RUNNER_MATERIAL)).toBe(true)
    // El cos contra el lateral del moble (x 0–7,6 de la cara interior) i la corredora sota el lateral de doble paret.
    const railL = fixed.find((p) => p.id.includes("-left-"))!
    const runnerL = runners.find((p) => p.id.includes("-left-"))!
    expect(railL.placement.origin[0]).toBe(16)
    expect(railL.length).toBe(7.6)
    expect(runnerL.placement.origin[0]).toBeCloseTo(16 + 7.6)
    // Els laterals de doble paret prenen l'acabat: blanc seda per defecte, gris si es tria.
    const sides = solids.filter((p) => p.id.includes("-kit-boxSide-"))
    expect(sides.length).toBe(6)
    expect(sides.every((p) => p.material === "Blanc seda")).toBe(true)
    const grey = buildModule(kitModule(1, {}, HT11, { finish: "grey" }))
    expect(grey.extras.filter((p) => p.id.includes("-kit-boxSide-")).every((p) => p.material === "Gris mat")).toBe(true)
    expect(grey.hardwareKits[0]!.options.finish).toBe("grey")
    // La comanda no canvia amb l'acabat ni amb els dos cossos (un sol article de guia).
    expect(grey.hardwareKits[0]!.lines.map((l) => l.component)).toEqual(b.hardwareKits[0]!.lines.map((l) => l.component))
    expect(b.hardwareKits[0]!.lines.filter((l) => l.component === "slide")).toHaveLength(1)
  })
  it("el joc com a «Guia de calaix» del mòdul: els calaixos sense guia pròpia es fan amb el joc, sense avís", () => {
    const m = kitModule(2)
    const root = m.root as Zone & { front: { hardware?: unknown } }
    delete root.front.hardware
    const withKit = { ...m, hardware: { ...DEFAULT_MODULE_HARDWARE, slide: structuredClone(HT11) } }
    const b = buildModule(withKit)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
    expect(b.panels.filter((p) => p.role === "drawerSide")).toHaveLength(0)
    expect(b.hardwareKits).toHaveLength(2)
    expect(b.hardwareKits[0]).toMatchObject({ drawer: 1, nl: 450, options: { closing: "soft", back: "wood" } })
    const bottoms = b.panels.filter((p) => p.role === "drawerBottom")
    expect(bottoms.map((p) => [p.length, p.width, p.thickness])).toEqual([[681, 421, 16], [681, 421, 16]])
    expect(b.panels.filter((p) => p.role === "drawerBack").map((p) => [p.length, p.width])).toEqual([[660, 63], [660, 63]])
    expect(b.panels.find((p) => p.id === "side-left")!.holes.filter((h) => h.tag === "kit-slide")).toHaveLength(16)
    // Exactament el mateix que triat al front.
    const front = buildModule(kitModule(2))
    const digest = (x: typeof b) => x.panels.map((p) => [p.id, p.length, p.width, p.thickness, p.holes.length]).concat(x.extras.map((p) => [p.id, p.material]))
    expect(digest(b)).toEqual(digest(front))
    // Les opcions del joc al calaix compten amb el joc del mòdul («res amagat compta»).
    const opts = { ...withKit, root: { ...withKit.root, front: { ...withKit.root.front!, kit: { closing: "push", back: "metal" } } } } as Module
    expect((visibleModule(opts).root.front as { kit?: unknown }).kit).toEqual({ closing: "push", back: "metal" })
    expect(buildModule(opts).hardwareKits[0]!.options).toMatchObject({ closing: "push", back: "metal" })
    // Una guia normal triada al calaix guanya el joc del mòdul.
    const normal = { ...withKit, root: { ...withKit.root, front: { ...withKit.root.front!, hardware: structuredClone(DEFAULT_MODULE_HARDWARE.slide) } } } as Module
    expect(buildModule(normal).panels.filter((p) => p.role === "drawerSide")).toHaveLength(4)
    // El lloc accepta el joc (cap avís, l'item és el joc) i les preferències també el poden tenir per defecte.
    const warnings: string[] = []
    const spec = slotSpec("slide", HT11, (w) => warnings.push(w))
    expect(warnings).toEqual([])
    expect(spec.item).toBe(HT11)
    expect(spec.failed).toBeUndefined()
    const lib = [...Object.values(DEFAULT_MODULE_HARDWARE), HT11]
    expect(kitFrom(lib, { hinge: "hinge-cup", system32: "system32", dowel: "dowel", slide: "kit-dtc-ht11", flap: "flap-arm", magnet: "magnet", handle: "handle-bar" }).slide.id).toBe("kit-dtc-ht11")
    expect(fixHardwareDefaults(lib, { slide: "kit-dtc-ht11" }).defaults.slide).toBe("kit-dtc-ht11")
    // El resum de «Ferratges» compta els jocs de calaix (un per calaix).
    expect(ruleHardwareCounts(b.panels, 0, b.extras, b.hardwareKits).find((c) => c.id === "kit")).toMatchObject({ count: 2 })
  })
  it("«Com va muntat» i la peça d'exemple: el lateral amb les prebroques i els components", () => {
    const m = hardwareMount(HT11)
    expect(m.error).toBeUndefined()
    expect(m.panels.some((p) => p.id === "side-left" && p.holes.some((h) => h.tag === "kit-slide"))).toBe(true)
    expect(m.panels.some((p) => p.role === "hardware")).toBe(true)
    expect(m.focus?.hole.tag).toBe("kit-slide")
    const pv = hardwarePreview(HT11)
    expect(pv.error).toBeUndefined()
    expect(pv.panels[0]!.holes.filter((h) => h.tag === "kit-slide")).toHaveLength(8)
  })
})

describe("joc paramètric: alçades dels fronts a mà", () => {
  const HT12 = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-ht12")!
  const withHeights = (heights: (number | "auto")[]): Module => {
    const m = kitModule(3, {}, HT12)
    return { ...m, root: { ...m.root, front: { ...(m.root.front as Extract<Zone["front"], { kind: "drawers" }>), heights } } }
  }

  it("l'alçada del calaix mana: un calaix massa baix per al K porta el joc més alt de la sèrie que hi cap (M)", () => {
    const b = buildModule(withHeights([270, 270, "auto"]))
    expect(b.drawerHeights.root![2]).toBeLessThan(180)
    expect(b.hardwareKits.map((k) => k.kit)).toEqual(["DTC MAGIC-PRO HT12 K", "DTC MAGIC-PRO HT12 K", "DTC MAGIC-PRO HT11 M"])
    expect(b.hardwareKits[2]!.item).toBe("DTC MAGIC-PRO HT11 M (88)")
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
    // El calaix 3 té els seus forats de guia als laterals, i el joc M no passa de la tapa.
    const top = Math.max(...b.extras.filter((p) => p.id.startsWith("drawer-3-") || p.id.startsWith("kitfix-3-")).map((p) => p.placement.origin[1]))
    expect(top).toBeLessThan(720)
  })

  it("si ni el joc més baix de la sèrie hi cap, només el front i un avís que ho diu", () => {
    const b = buildModule(withHeights([340, 300, "auto"]))
    expect(b.hardwareKits.map((k) => k.drawer)).toEqual([1, 2])
    expect(b.warnings.some((w) => w.code === "hardware" && w.message.includes("ni tampoc el joc més baix de la sèrie"))).toBe(true)
  })

  it("cada calaix pot tenir la seva guia: els de sobre segueixen el de sota", () => {
    const m = withHeights([270, 270, "auto"])
    const f = m.root.front as Extract<Zone["front"], { kind: "drawers" }>
    const HT10 = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-ht10")!
    const DP = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-hb01")!
    const own = (drawerSlides: (typeof HT10 | null)[]) => buildModule({ ...m, root: { ...m.root, front: { ...f, drawerSlides } } })
    // El calaix 2 amb el N: el 3, sense guia pròpia, també.
    expect(own([null, HT10, null]).hardwareKits.map((k) => k.kit)).toEqual(["DTC MAGIC-PRO HT12 K", "DTC MAGIC-PRO HT10 N", "DTC MAGIC-PRO HT10 N"])
    // Una altra sèrie al calaix 3, amb els seus components al 3D (no els del joc del calaix 1).
    const b = own([null, null, DP])
    expect(b.hardwareKits.map((k) => k.kit)).toEqual(["DTC MAGIC-PRO HT12 K", "DTC MAGIC-PRO HT12 K", "DTC DRAGON-PRO HB01 M"])
    const side = (k: number) => b.extras.find((p) => p.id.startsWith(`drawer-${k}-kit-boxSide`))!
    expect(side(3).width).not.toBe(side(1).width)
    // Amb una guia normal, el camp no compta.
    const plain = { ...m, root: { ...m.root, front: { ...f, hardware: undefined, drawerSlides: [null, HT10] } } }
    expect(visibleModule(plain).root.front).not.toHaveProperty("drawerSlides")
    // Amb totes les alçades «Auto», una sola guia: la de cada calaix no surt ni compta.
    const auto = { ...m, root: { ...m.root, front: { ...f, heights: ["auto", "auto", "auto"] as ("auto" | number)[], drawerSlides: [null, HT10] } } }
    expect(visibleModule(auto).root.front).not.toHaveProperty("drawerSlides")
  })
})
