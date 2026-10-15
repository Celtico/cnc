import { describe, expect, it } from "vitest"
import { APPLIANCE_ITEMS, DEFAULT_SETTINGS, applianceBodyMaterial, applianceById, dishwasherModule, fridgeColumn, isCopyOf, moduleRows, normalizeComposition, ovenColumn, parseSettings, visibleModule, type Composition, type HardwareItem, type Module } from "../model"
import { buildModule } from "./buildModule"

/** El rentaplats del mòdul amb canvis al seu `ZoneAppliance`. */
const dishwasher = (patch: Record<string, unknown>): Module => {
  const m = dishwasherModule()
  return { ...m, root: { ...m.root, appliance: { ...m.root.appliance!, ...patch } } }
}

describe("electrodomèstics: material del cos, foto i material del front (v47)", () => {
  it("el cos: el de la família si l'item no en porta; el de l'item si en porta", () => {
    expect(applianceBodyMaterial({ kind: "dishwasher" })).toBe("Electrodomèstic inox")
    expect(applianceBodyMaterial({ kind: "fridge" })).toBe("Electrodomèstic blanc")
    expect(applianceBodyMaterial({ kind: "washer" })).toBe("Electrodomèstic blanc")
    expect(applianceBodyMaterial({ kind: "oven" })).toBe("Electrodomèstic negre")
    expect(applianceBodyMaterial({ kind: "microwave" })).toBe("Electrodomèstic negre")
    expect(applianceBodyMaterial({ kind: "hob" })).toBe("Electrodomèstic negre")
    expect(applianceBodyMaterial({ kind: "hood" })).toBe("Electrodomèstic inox")
    // Els tres són a Preferències › Materials (els de simulació).
    for (const n of ["Electrodomèstic inox", "Electrodomèstic blanc", "Electrodomèstic negre"]) expect(DEFAULT_SETTINGS.materials.some((x) => x.name === n), n).toBe(true)
    const b = buildModule(ovenColumn())
    expect(b.extras.filter((p) => p.name === "electrodomèstic").map((p) => p.material)).toEqual(["Electrodomèstic negre", "Electrodomèstic negre"])
    const hw = applianceById("appliance-bosch-smh6ycx02e")
    const own = buildModule(dishwasher({ hardware: { ...hw, material: "Acer inox" } }))
    expect(own.extras.find((p) => p.id === "appliance-1")!.material).toBe("Acer inox")
  })

  it("la foto pròpia (data URL) va a la cara vista com la del catàleg", () => {
    const hw = applianceById("appliance-bosch-smh6ycx02e")
    const src = "data:image/webp;base64,AAAA"
    const b = buildModule(dishwasher({ hardware: { ...hw, appliance: { ...hw.appliance!, image: src } } }))
    expect(b.extras.find((p) => p.id === "appliance-1")!.photo).toEqual({ src, face: "front" })
  })

  it("material del front: sense, el dels fronts del mòdul (com fins ara); amb, el triat, també als dos fronts d'un combi", () => {
    const base = buildModule(dishwasherModule())
    expect(base.panels.find((p) => p.role === "flap")!.material).toBe("Melamina blanca")
    const b = buildModule(dishwasher({ panelMaterial: "Melamina roure" }))
    const front = b.panels.find((p) => p.role === "flap")!
    expect(front.material).toBe("Melamina roure")
    // La resta de la peça (mides, gruix, cantells, forats) no canvia: només el material.
    expect({ ...front, material: "" }).toEqual({ ...base.panels.find((p) => p.role === "flap")!, material: "" })
    const m = fridgeColumn()
    const kids = m.root.split!.children
    const combi: Module = { ...m, root: { ...m.root, split: { ...m.root.split!, children: [{ ...kids[0]!, appliance: { ...kids[0]!.appliance!, panelMaterial: "Freixe xapat" } }, ...kids.slice(1)] } } }
    const fronts = buildModule(combi).panels.filter((p) => p.id.startsWith("appliance-1-"))
    expect(fronts).toHaveLength(2)
    expect(fronts.every((p) => p.material === "Freixe xapat")).toBe(true)
  })

  it("res amagat compta: sense front de moble, el material del front no hi és; Materials › «Fronts» només si algun front el fa servir", () => {
    expect(visibleModule(dishwasher({ panelMaterial: "Melamina roure", front: false })).root.appliance).not.toHaveProperty("panelMaterial")
    expect(visibleModule(dishwasher({ panelMaterial: "Melamina roure" })).root.appliance?.panelMaterial).toBe("Melamina roure")
    expect(moduleRows(dishwasherModule()).frontMaterial).toBe(true)
    // L'únic front és el del rentaplats amb el seu material: el dels fronts del mòdul no el fa servir ningú.
    expect(moduleRows(dishwasher({ panelMaterial: "Melamina roure" })).frontMaterial).toBe(false)
    // L'estil i les folgances dels fronts sí (el front de moble és un front).
    expect(moduleRows(dishwasher({ panelMaterial: "Melamina roure" })).style).toBe(true)
  })

  it("sense front de moble: la cara de l'aparell (la foto) enrasada amb els fronts i res al davant", () => {
    const m = dishwasher({ front: false })
    const b = buildModule(m)
    const body = b.extras.find((p) => p.id === "appliance-1")!
    // La cara +z de la caixa: origen en z + gruix (la fondària de l'aparell).
    const zFace = body.placement.origin[2] + body.thickness
    const ref = buildModule(dishwasherModule()).panels.find((p) => p.role === "flap")!
    // El front de moble (quan hi és) té la cara de fora al mateix pla: sense, l'aparell queda on queden els fronts.
    expect(zFace).toBe(ref.placement.origin[2])
    expect(b.panels.some((p) => p.placement.origin[2] > zFace - 1)).toBe(false)
  })

  it("la migració de la v46 afegeix «Electrodomèstic negre» (additiu: un que ja hi és no es toca)", () => {
    const without = DEFAULT_SETTINGS.materials.filter((x) => x.id !== "sim-appliance-black")
    const res = parseSettings({ ...DEFAULT_SETTINGS, version: 46, materials: without })
    expect(res.settings.materials.some((x) => x.name === "Electrodomèstic negre")).toBe(true)
    const mine = parseSettings({ ...DEFAULT_SETTINGS, version: 46, materials: [...without, { ...DEFAULT_SETTINGS.materials.find((x) => x.id === "sim-appliance-black")!, id: "mine", finish: { kind: "color", color: "#000000" } }] })
    expect(mine.settings.materials.filter((x) => x.name === "Electrodomèstic negre")).toHaveLength(1)
    expect(mine.settings.materials.find((x) => x.name === "Electrodomèstic negre")!.id).toBe("mine")
  })

  it("v3 dels items: la biblioteca i les còpies dels mobles desats passen del cos «Acer inox» al de la família (continuen sent l'item)", () => {
    const fresh = applianceById("appliance-bosch-hba514es4")
    expect(fresh.material).toBe("Electrodomèstic negre")
    const old: HardwareItem = { ...fresh, material: "Acer inox", version: 2 }
    // La biblioteca: l'item del catàleg d'abans passa al d'ara (com els altres canvis de versió dels items de l'app).
    const lib = parseSettings({ ...DEFAULT_SETTINGS, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.map((x) => (x.id === fresh.id ? old : x)) })
    expect(lib.settings.hardwareLibrary.find((x) => x.id === fresh.id)!.material).toBe("Electrodomèstic negre")
    // Un moble desat amb la còpia d'abans.
    const m = ovenColumn()
    const kids = m.root.split!.children
    const withOld = kids.map((k) => (k.appliance?.hardware.id === fresh.id ? { ...k, appliance: { ...k.appliance, hardware: old } } : k))
    const comp = { modules: [{ ...m, root: { ...m.root, split: { ...m.root.split!, children: withOld } } }] } as unknown as Composition
    const up = normalizeComposition(comp)
    const hw = up.modules[0]!.root.split!.children.find((k) => k.appliance?.hardware.id === fresh.id)!.appliance!.hardware
    expect(hw.material).toBe("Electrodomèstic negre")
    expect(isCopyOf(hw, fresh)).toBe(true)
    // Idempotent; una còpia de la v3 amb «Acer inox» triat a mà no es toca.
    expect(normalizeComposition(up)).toBe(up)
    const mine = { modules: [{ ...m, root: { ...m.root, split: { ...m.root.split!, children: kids.map((k) => (k.appliance?.hardware.id === fresh.id ? { ...k, appliance: { ...k.appliance, hardware: { ...fresh, material: "Acer inox" } } } : k)) } } }] } as unknown as Composition
    expect(normalizeComposition(mine)).toBe(mine)
    expect(APPLIANCE_ITEMS.every((x) => x.version === 3 && x.material === applianceBodyMaterial(x.appliance!))).toBe(true)
  })
})
