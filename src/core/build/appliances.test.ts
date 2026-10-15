import { describe, expect, it } from "vitest"
import { APPLIANCE_ITEMS, DEFAULT_HARDWARE_LIBRARY, boardDensity, DEFAULT_SETTINGS, V46_ITEMS, applianceById, defaultModule, dishwasherModule, fridgeColumn, isApplianceModule, nicheAppliance, zoneAppliance, nicheModule, ovenColumn, parseSettings, usedHardwareSlots, visibleModule, type Module, type Zone } from "../model"
import { buildComposition } from "./buildComposition"
import { buildModule } from "./buildModule"
import { hardwarePreview } from "./hardwarePreview"
import { hardwareMount } from "./hardwareMount"

const warns = (b: ReturnType<typeof buildModule>) => b.warnings.filter((w) => w.code === "appliance").map((w) => w.message)
const withZone = (m: Module, root: Zone): Module => ({ ...m, root })

describe("electrodomèstics (v46)", () => {
  it("el catàleg: 36 models, tots a la biblioteca inicial i a la migració de la v46, amb ids únics", () => {
    expect(APPLIANCE_ITEMS).toHaveLength(36)
    expect(new Set(APPLIANCE_ITEMS.map((x) => x.id)).size).toBe(36)
    for (const it of APPLIANCE_ITEMS) {
      expect(it.engine).toBe("appliance")
      expect(it.category).toBe("appliance")
      expect(DEFAULT_HARDWARE_LIBRARY.some((x) => x.id === it.id)).toBe(true)
      expect(hardwarePreview(it).error, it.id).toBeUndefined()
    }
    // Unes preferències de la v45 reben els electrodomèstics (additiu) i les de l'usuari no es toquen.
    const res = parseSettings({ ...DEFAULT_SETTINGS, version: 45, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => x.engine !== "appliance") })
    expect(res.migrated).toBe(true)
    for (const it of V46_ITEMS) expect(res.settings.hardwareLibrary.some((x) => x.id === it.id)).toBe(true)
  })

  it("rentaplats en un mòdul sense res: el nínxol, el front amb el sòcol, cargolat amb la plantilla de l'aparell (sense prebroques ni frontisses) i cap avís", () => {
    const b = buildModule(dishwasherModule())
    const front = b.panels.find((p) => p.role === "flap")!
    // 600 sense laterals: el front fa l'ample menys la folgança; de 103 (sòcol) a 870 − folgança.
    expect(front.width).toBe(596)
    expect(front.length).toBe(765)
    expect(front.placement.origin[1]).toBe(103)
    expect(front.material).toBe("Melamina blanca")
    // L'estàndard: els cargols del front es foraden amb la plantilla de l'aparell (cap prebroca de l'app).
    expect(front.holes.filter((h) => h.tag === "appliance")).toHaveLength(0)
    expect(front.holes.some((h) => h.tag === "hinge")).toBe(false)
    // Cap peça de la caixa: només el front.
    expect(b.panels).toHaveLength(1)
    const body = b.extras.find((p) => p.id === "appliance-1")!
    expect(body.role).toBe("hardware")
    expect(body.photo?.src).toBe("appliances/bosch-smh6ycx02e.webp")
    const line = b.fittingOrders.find((l) => l.component === "appliance-bosch-smh6ycx02e")!
    expect(line).toMatchObject({ qty: 1, item: "SMH6YCX02E" })
    // Com es munta i el sòcol corregut: a la nota de la comanda, no als avisos.
    expect(line.note).toContain("plantilla de l'aparell")
    expect(line.note).toContain("sòcol de 103")
    expect(b.warnings).toEqual([])
  })

  it("rentaplats amb prebroques (opció de l'item, `pilotHoles` 1): 4 al darrere del front", () => {
    const m = dishwasherModule()
    const hw = m.root.appliance!.hardware
    const b = buildModule({ ...m, root: { ...m.root, appliance: { ...m.root.appliance!, hardware: { ...hw, params: { ...hw.params, pilotHoles: 1 } } } } })
    expect(b.panels.find((p) => p.role === "flap")!.holes.filter((h) => h.tag === "appliance")).toHaveLength(4)
  })

  it("rentaplats: el front massa alt i el sòcol fora del rang avisen; el nínxol estret també", () => {
    const fixed = nicheModule("Rentaplats", "appliance-bosch-smv6zcx10e", 60)
    const w = warns(buildModule(fixed))
    expect(w.some((m) => m.includes("sòcol de 60") && m.includes("90–220"))).toBe(true)
    expect(w.some((m) => m.includes("front del rentaplats fa 808") && m.includes("655–725"))).toBe(true)
    const narrow = nicheModule("Rentaplats", "appliance-bosch-smv6zcx10e", 143, { width: 580 })
    expect(warns(buildModule(narrow)).some((m) => m.includes("580 mm d'ample") && m.includes("≥ 600"))).toBe(true)
  })

  it("combi de porta fixa: dos fronts amb les alçades del catàleg (+A, +S), junta de 4 i la sortida d'aire a la peça de sobre", () => {
    const m = fridgeColumn()
    const b = buildModule(m)
    const lower = b.panels.find((p) => p.id.includes("-lower-door-right"))!
    const upper = b.panels.find((p) => p.id.includes("-upper-door-right"))!
    // Base i travesser de 19: el de baix 703 + 19 = 722 (el més curt del rang), el de dalt el que sobra.
    expect(lower.length).toBe(722)
    expect(upper.placement.origin[1] - (lower.placement.origin[1] + lower.length)).toBe(4)
    expect(upper.length).toBeGreaterThanOrEqual(1041 + 19)
    expect(upper.length).toBeLessThanOrEqual(1065 + 19)
    expect(lower.holes.filter((h) => h.tag === "appliance")).toHaveLength(0)
    expect(upper.holes.filter((h) => h.tag === "appliance")).toHaveLength(0)
    // La sortida d'aire: un retall a la peça de sobre (el travesser), arran del fons.
    const shelf = b.panels.find((p) => p.role === "fixedShelf")!
    const vent = shelf.cutouts?.find((c) => c.tag === "vent")
    expect(vent && vent.kind === "rect" ? vent.w * vent.h : 0).toBeGreaterThanOrEqual(20000)
    // Sense sòcol al mòdul (potes sense sòcol): l'entrada d'aire, a la nota i la reixeta a la comanda; cap avís.
    expect(b.warnings).toEqual([])
    expect(b.fittingOrders.find((l) => l.component === "appliance-bosch-kin86add0")!.note).toContain("entrada d'aire")
    expect(b.fittingOrders.find((l) => l.component === "appliance-bosch-kin86add0:vent")).toMatchObject({ qty: 1, name: "Reixeta de ventilació de sòcol" })
  })

  it("combi amb el sòcol de fusta del tram: l'entrada d'aire és un retall de ≥ 200 cm² al sòcol, davant del frigorífic", () => {
    const m = fridgeColumn()
    const b = buildComposition({ modules: [m], references: [], support: { kind: "plinth", height: 100, plinth: { setback: 24 } } })
    const plinth = b.panels.find((p) => p.role === "plinth")!
    const vent = plinth.cutouts?.find((c) => c.tag === "vent")
    expect(vent && vent.kind === "rect" ? vent.w * vent.h : 0).toBeGreaterThanOrEqual(20000)
    expect(b.warnings.filter((w) => w.code === "appliance" || w.code === "layout")).toEqual([])
  })

  it("frigorífic de porta lliscant: frontisses de moble (la filera i les plaques al lateral) i la guia lliscant", () => {
    const m = fridgeColumn()
    const root = m.root.split!.children[0]!
    const sliding = withZone(m, { ...m.root, split: { ...m.root.split!, children: [{ ...root, appliance: { hardware: applianceById("appliance-bosch-kin86vse0"), hinge: "right" } }, m.root.split!.children[1]!] } })
    const b = buildModule(sliding)
    const fronts = b.panels.filter((p) => p.id.startsWith("appliance-1-"))
    expect(fronts).toHaveLength(2)
    for (const f of fronts) {
      expect(f.holes.filter((h) => h.tag === "hinge").length).toBeGreaterThanOrEqual(2)
      // La guia es cargola amb la plantilla de l'aparell: cap prebroca per defecte.
      expect(f.holes.filter((h) => h.tag === "appliance")).toHaveLength(0)
    }
    expect(usedHardwareSlots(sliding).get("hinge")?.what).toContain("frigorífics")
    expect(b.fittingOrders.some((l) => l.component === "hinge-cup")).toBe(true)
  })

  it("columna de forn i microones: el nínxol en columna, sense front de moble, la foto a la cara de davant", () => {
    const b = buildModule(ovenColumn())
    expect(warns(b).filter((m) => m.includes("no hi cap"))).toEqual([])
    const bodies = b.extras.filter((p) => p.name === "electrodomèstic")
    expect(bodies).toHaveLength(2)
    expect(bodies.every((p) => p.photo?.face === "front")).toBe(true)
    // Cap front als compartiments del forn i del microones.
    expect(b.panels.filter((p) => ["door", "flap", "panel"].includes(p.role))).toHaveLength(1)
  })

  it("forn en un nínxol baix de columna: avisa amb l'alçada de columna del catàleg", () => {
    const m = ovenColumn()
    const kids = m.root.split!.children
    const low = withZone(m, { ...m.root, split: { ...m.root.split!, sizes: ["auto", 560, 380, 420], children: kids } })
    expect(warns(buildModule(low)).some((x) => x.includes("560 mm d'alt") && x.includes("585–595") && x.includes("en columna"))).toBe(true)
  })

  it("placa sobre calaixos: el retall a la tapa del mòdul (a 50 del davant) i la nota dels 65 mm", () => {
    const m = defaultModule("hob", "Fogons", { width: 600, height: 770, depth: 600, base: { kind: "legs", height: 100 } })
    const b = buildModule(withZone(m, { id: "r", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] }, appliance: { hardware: applianceById("appliance-bosch-pie631hc1e") } }))
    const top = b.panels.find((p) => p.role === "top")!
    const cut = top.cutouts?.find((c) => c.tag === "appliance")
    expect(cut && cut.kind === "rect" ? [cut.w, cut.h].sort() : []).toEqual([490, 560])
    // Els calaixos es fan igual (la placa no ocupa el compartiment).
    expect(b.panels.filter((p) => p.role === "drawerFront")).toHaveLength(2)
    expect(b.fittingOrders.find((l) => l.component === "appliance-bosch-pie631hc1e")!.note).toContain("65 mm")
    expect(warns(b)).toEqual([])
    expect(b.extras.find((p) => p.name === "electrodomèstic")?.photo?.face).toBe("top")
  })

  it("grup filtrant: el retall a la base del moble penjat", () => {
    const m = defaultModule("hood", "Campana", { width: 600, height: 720, depth: 330, backThickness: 10, base: { kind: "wall", height: 1450 } })
    const b = buildModule(withZone(m, { id: "r", front: { kind: "door", mode: "single", hinge: "left" }, appliance: { hardware: applianceById("appliance-bosch-dln57pc60") } }))
    const bottom = b.panels.find((p) => p.role === "bottom")!
    expect(bottom.cutouts?.some((c) => c.tag === "appliance" && c.kind === "rect" && [c.w, c.h].sort().join() === "264,496")).toBe(true)
    expect(b.panels.some((p) => p.role === "door")).toBe(true)
  })

  it("rentadora: les cassoletes de la fitxa (a 21 del panell de 592 de l'aparell, a 202 i +338,6 de dalt) i el nínxol estàndard", () => {
    const m = nicheModule("Rentadora", "appliance-bosch-wiw24307es", 103)
    const b = buildModule({ ...m, root: { ...m.root, appliance: { ...m.root.appliance!, hinge: "left" } } })
    const front = b.panels.find((p) => p.role === "door")!
    const cups = front.holes.filter((h) => h.tag === "hinge")
    expect(cups).toHaveLength(2)
    // Front de 596 centrat a l'aparell: el panell de 592 queda a 2 del cantell → 21 + 2.
    expect(cups.every((h) => h.diameter === 35 && h.y === 23)).toBe(true)
    // L'aparell (818) seu a terra; el front comença a 103: les cassoletes a 818 − 202 − 103 i 338,6 més avall.
    expect(cups.map((h) => h.x).sort((a, z) => z - a)).toEqual([513, 174.4])
    // El nínxol (600 × 870 × 560) és bo: cap avís.
    expect(b.warnings).toEqual([])
    // La rentadora-assecadora: Ø38 a 24,5 i +420.
    const k = nicheModule("Rentadora", "appliance-bosch-wkd28490es", 103)
    const kb = buildModule({ ...k, root: { ...k.root, appliance: { ...k.root.appliance!, hinge: "right" } } })
    const kc = kb.panels.find((p) => p.role === "door")!.holes.filter((h) => h.tag === "hinge")
    expect(kc.map((h) => [h.diameter, h.y])).toEqual([[38, 596 - 26.5], [38, 596 - 26.5]])
    expect(kc.map((h) => h.x).sort((a, z) => z - a)).toEqual([820 - 202 - 103, 820 - 202 - 420 - 103])
  })

  it("el pes del front, amb la densitat estàndard del tauler", () => {
    expect([boardDensity("Melamina blanca"), boardDensity("MDF lacat"), boardDensity("DM (fons)"), boardDensity("Roure massís / xapat")]).toEqual([660, 750, 750, 675])
  })

  it("sense front de moble: l'aparell a la vista (amb la foto) i cap peça; res amagat compta", () => {
    const m = dishwasherModule()
    const off = { ...m, root: { ...m.root, appliance: { ...m.root.appliance!, front: false, plinth: 140, hinge: "right" as const } } }
    const b = buildModule(off)
    expect(b.panels).toHaveLength(0)
    expect(visibleModule(off).root.appliance).toEqual({ hardware: m.root.appliance!.hardware, front: false })
    // Amb l'aparell que ocupa el compartiment, el seu Front, prestatges i accessoris no compten (es conserven).
    const hidden = { ...m, root: { ...m.root, front: { kind: "door" as const, mode: "single" as const, hinge: "left" as const }, shelves: { n: 2, adjustable: true } } }
    expect(visibleModule(hidden).root.front).toBeUndefined()
    expect(visibleModule(hidden).root.shelves).toBeUndefined()
    expect(buildModule(hidden).panels).toEqual(buildModule(m).panels)
  })

  it("«Com va muntat» de Preferències: el mòdul d'exemple amb l'aparell i el front", () => {
    const mount = hardwareMount(applianceById("appliance-bosch-smv6zcx10e"))
    expect(mount.error).toBeUndefined()
    expect(mount.panels.some((p) => p.id.startsWith("appliance-"))).toBe(true)
  })

  it("un sol lloc per decisió: el mòdul sense dividir que ocupa l'aparell és l'electrodomèstic (sense «Interior»); la placa no", () => {
    expect(isApplianceModule(dishwasherModule())).toBe(true)
    // Una columna dividida tria l'aparell a cada compartiment: el mòdul no ho és.
    const col = ovenColumn()
    expect(isApplianceModule(col)).toBe(false)
    expect(col.root.split!.children.filter((c) => nicheAppliance(c)).map((c) => zoneAppliance(c)!.kind)).toEqual(["oven", "microwave"])
    // La placa sobre els calaixos no ocupa el mòdul: l'«Interior» conserva els calaixos.
    const hob = withZone(defaultModule("h", "Fogons"), { id: "r", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] }, appliance: { hardware: applianceById("appliance-bosch-pie631hc1e") } })
    expect(zoneAppliance(hob.root)?.kind).toBe("hob")
    expect(isApplianceModule(hob)).toBe(false)
    // Una arrel dividida no allotja cap aparell (el que hi hagués no es fa).
    const m = dishwasherModule()
    expect(isApplianceModule({ root: { ...m.root, split: { dir: "v", sizes: ["auto"], children: [{ id: "c" }] } } })).toBe(false)
  })
})
