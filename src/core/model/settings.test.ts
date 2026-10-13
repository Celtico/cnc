import { describe, expect, it } from "vitest"
import { defaultModule } from "./composition"
import { DEFAULT_HARDWARE_KITS, DEFAULT_MODULE_HARDWARE, DEFAULT_LEGACY_HARDWARE, copyHardwareItem, setKitPilot } from "./hardware"
import {
  BUILTIN_REFERENCES,
  SETTINGS_VERSION,
  materialCategory,
  withCategory,
  DEFAULT_SETTINGS,
  SettingsSchema,
  applySettingsToModule,
  canBeGhost,
  parseSettings,
  settingsFromJson,
  settingsToJson,
  sheetFor,
  visibleReferences,
  importSettingsJson,
  SIM_MATERIALS,
  SIM_MATERIALS_SINCE,
  type MaterialPref,
  type Settings,
} from "./settings"
import type { Machine } from "./machine"

describe("preferències", () => {
  it("els valors inicials són vàlids", () => {
    expect(SettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
    expect(DEFAULT_SETTINGS.references.find((r) => r.id === "radiator-800")).toMatchObject({ w: 800, h: 600, d: 100, wallOffset: 40 })
    expect(DEFAULT_SETTINGS.references.filter((r) => /tele|tv/i.test(r.name)).map((r) => r.name)).toEqual(["Tele 55″"])
  })

  it("treu les teles Sony de les proves (també les còpies), no les altres de l'usuari", () => {
    const sony = { id: "tv-sony-55-screen", name: "TV Sony KD-55XD8505 (pantalla)", w: 1231, h: 717, plane: "wall", wallOffset: 200, builtin: true }
    const copy = { id: "refx", name: "TV Sony KD-55XD8505 (pantalla)", w: 1231, h: 717, plane: "wall", wallOffset: 200 }
    const mine = { id: "tv-sony-55-stand", name: "La meva tele", w: 1231, h: 770, plane: "wall", wallOffset: 0 }
    const res = parseSettings({ ...DEFAULT_SETTINGS, references: [sony, copy, mine] })
    expect(res.migrated).toBe(true)
    expect(res.settings.references.some((r) => r.name.includes("Sony"))).toBe(false)
    expect(res.settings.references.some((r) => r.name === "La meva tele")).toBe(true)
    expect(res.settings.references.some((r) => r.id === "radiator-800")).toBe(true)
  })

  it("migra unes preferències d'una versió anterior (sense version i amb `wall`)", () => {
    const old = {
      references: [{ id: "x", name: "Tele vella", w: 1000, h: 600, plane: "wall", wall: 150 }],
      hardware: DEFAULT_LEGACY_HARDWARE,
    }
    const res = parseSettings(old)
    expect(res.migrated).toBe(true)
    expect(res.problems).toEqual([])
    expect(res.settings.version).toBe(SETTINGS_VERSION)
    expect(res.settings.references[0]).toMatchObject({ name: "Tele vella", wallOffset: 150 })
    // Els valors inicials no es perden mai.
    for (const b of BUILTIN_REFERENCES) expect(res.settings.references.some((r) => r.id === b.id)).toBe(true)
    expect(res.settings.label).toEqual({ w: 99, h: 68 })
  })

  it("importar un JSON invàlid no trenca res i ho diu", () => {
    const bad = settingsFromJson("{ no és json")
    expect(bad.settings).toEqual(DEFAULT_SETTINGS)
    expect(bad.problems[0]).toMatch(/JSON/)

    const partial = settingsFromJson(JSON.stringify({ version: 1, materials: [{ id: "m", name: "Sense gruixos", thicknesses: [], hasGrain: false, finish: { kind: "color", color: "#fff" }, edge: "" }], label: { w: 5, h: 5 } }))
    expect(partial.problems.length).toBeGreaterThanOrEqual(2)
    expect(partial.settings.materials.length).toBeGreaterThan(0)
    expect(partial.settings.label).toEqual({ w: 99, h: 68 })
    expect(SettingsSchema.safeParse(partial.settings).success).toBe(true)
  })

  it("exportar i tornar a importar és idèntic", () => {
    const res = settingsFromJson(settingsToJson(DEFAULT_SETTINGS))
    expect(res.settings).toEqual(DEFAULT_SETTINGS)
    expect(res.problems).toEqual([])
  })

  it("una referència creada per l'usuari surt a la llista i les amagades no", () => {
    const s = parseSettings({
      ...DEFAULT_SETTINGS,
      references: [{ id: "u1", name: "Radiador menjador", w: 650, h: 1100, d: 110, plane: "wall", wallOffset: 0 }, ...DEFAULT_SETTINGS.references.map((r) => (r.id === "a4-v" ? { ...r, hidden: true } : r))],
    }).settings
    const visible = visibleReferences(s)
    expect(visible[0]!.name).toBe("Radiador menjador")
    expect(visible.some((r) => r.id === "a4-v")).toBe(false)
  })

  it("només els objectes amb fondària poden ser fantasma 3D", () => {
    expect(canBeGhost(DEFAULT_SETTINGS.references.find((r) => r.id === "a4-v")!)).toBe(false)
    expect(canBeGhost(DEFAULT_SETTINGS.references.find((r) => r.id === "radiator-800")!)).toBe(true)
  })

  it("un mòdul nou pren ferratges, jocs i materials de les preferències", () => {
    const s = { ...DEFAULT_SETTINGS, gaps: { ...DEFAULT_SETTINGS.gaps, outerGap: 3 }, defaults: { ...DEFAULT_SETTINGS.defaults, material: "MDF lacat", thickness: 22 } }
    const m = applySettingsToModule(s, defaultModule("m", "Nou"))
    expect(m.fronts.outerGap).toBe(3)
    expect(m.carcass.material).toBe("MDF lacat")
    expect(m.carcass.thickness).toBe(22)
    expect(m.hardware).toEqual(DEFAULT_MODULE_HARDWARE)
  })

  it("mida de tauler per material, amb la regla buida com a comodí", () => {
    const s = { ...DEFAULT_SETTINGS, boards: { ...DEFAULT_SETTINGS.boards, sheets: [{ material: "", w: 2800, h: 2070 }, { material: "DM (fons)", w: 2440, h: 1220 }] } }
    expect(sheetFor(s, "DM (fons)")).toEqual({ w: 2440, h: 1220 })
    expect(sheetFor(s, "Melamina blanca")).toEqual({ w: 2800, h: 2070 })
  })
})

describe("categories de materials", () => {
  it("dedueix la categoria dels antics i afegeix els de simulació (v3)", () => {
    expect(materialCategory({ forBacks: true })).toBe("back")
    expect(materialCategory({ cnc: false })).toBe("sim")
    expect(materialCategory({ category: "hard", cnc: false })).toBe("sim")
    expect(materialCategory({})).toBe("board")
    const v2 = { version: 2, materials: [{ id: "m", name: "Meu", thicknesses: [19], hasGrain: false, finish: { kind: "color", color: "#fff" }, edge: "" }] }
    const res = parseSettings(v2)
    expect(res.settings.materials.some((m) => m.name === "Teixit gris" && m.category === "sim" && m.cnc === false)).toBe(true)
    expect(res.settings.materials[0]!.name).toBe("Meu")
    expect(withCategory(res.settings.materials[0]!, "back")).toMatchObject({ category: "back", forBacks: true })
    expect(withCategory({ ...res.settings.materials[0]!, forBacks: true }, "board").forBacks).toBeUndefined()
  })
})

describe("materials de foto (v6)", () => {
  it("són vàlids, amb els fitxers i sense noms repetits", async () => {
    const fsMod = "node:fs"
    const { existsSync } = (await import(/* @vite-ignore */ fsMod)) as { existsSync: (p: string) => boolean }
    const { PHOTO_MATERIALS, TEXTURE_SETS, textureSetFile } = await import("./textureSets")
    const { MaterialPrefSchema } = await import("./settings")
    for (const m of PHOTO_MATERIALS) expect(MaterialPrefSchema.safeParse(m).success, m.name).toBe(true)
    const names = DEFAULT_SETTINGS.materials.map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
    for (const t of TEXTURE_SETS) for (const k of ["diff", "nor", "rough"] as const) expect(existsSync(`public/${textureSetFile(t.id, k)}`), t.id).toBe(true)
  })
  it("la migració afegeix els que falten sense tocar els de l'usuari", () => {
    const mine = { id: "photo-oak_veneer_01", name: "Roure (foto)", thicknesses: [19], hasGrain: true, finish: { kind: "color", color: "#123456" }, edge: "" }
    const res = parseSettings({ version: 5, materials: [mine] })
    // v7: sense el de sempre, el «Roure (foto)» de l'usuari agafa el nom del de sempre (el dels àlies), amb el seu acabat.
    const oak = res.settings.materials.filter((m) => m.id === "photo-oak_veneer_01")
    expect(oak).toHaveLength(1)
    expect(oak[0]!.name).toBe("Roure massís / xapat")
    expect(oak[0]!.finish).toEqual({ kind: "color", color: "#123456" })
    expect(res.settings.materials.some((m) => m.name === "Noguera fumada")).toBe(true)
    // Si l'usuari n'esborra un, no torna.
    const again = parseSettings({ ...res.settings, materials: res.settings.materials.filter((m) => m.name !== "Noguera fumada") })
    expect(again.settings.materials.some((m) => m.name === "Noguera fumada")).toBe(false)
  })
})

describe("reparació camp a camp", () => {
  const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))

  it("un valor de ferratges dolent (d'abans de la v19) no torna tots els ferratges als inicials", () => {
    const { hardwareLibrary: _l, hardwareDefaults: _d, ...rest } = plain(DEFAULT_SETTINGS)
    const s = { ...rest, version: 18, hardware: plain(DEFAULT_LEGACY_HARDWARE) } as Record<string, any>
    s.hardware.hinge.cupDiameter = 40
    s.hardware.drawer.slideLengths = [300, 0]
    s.hardware.magnet.depth = "x"
    const r = parseSettings(s)
    const item = (id: string) => r.settings.hardwareLibrary.find((x) => x.id === id)!
    expect(item("hinge-cup").params.cupDiameter).toBe(40)
    expect(item("slide-ball").lengths).toEqual([300])
    expect(item("magnet").params.depth).toBe(DEFAULT_LEGACY_HARDWARE.magnet.depth)
    expect(r.problems.some((p) => p.startsWith("Ferratges"))).toBe(true)
  })

  it("un item de la biblioteca de ferratges dolent només treu aquell item", () => {
    const s = plain(DEFAULT_SETTINGS) as Record<string, any>
    s.hardwareLibrary.push({ ...s.hardwareLibrary[0], id: "hw-meva", name: "La meva", params: { cupDiameter: "x" } })
    s.hardwareLibrary.find((x: any) => x.id === "slide-ball").lengths = []
    const r = parseSettings(s)
    expect(r.settings.hardwareLibrary.some((x) => x.id === "hw-meva")).toBe(false)
    // La guia dolenta es treu i, com que el lloc es quedaria sense guia, torna la inicial.
    expect(r.settings.hardwareLibrary.find((x) => x.id === "slide-ball")).toEqual(DEFAULT_SETTINGS.hardwareLibrary.find((x) => x.id === "slide-ball"))
    expect(r.settings.hardwareLibrary.filter((x) => x.id !== "slide-ball").map((x) => x.id)).toEqual(DEFAULT_SETTINGS.hardwareLibrary.filter((x) => x.id !== "slide-ball").map((x) => x.id))
    expect(r.problems.filter((p) => p.startsWith("Ferratges"))).toHaveLength(2)
  })

  it("un tauler dolent es treu sol: el gruix de tall i la resta es queden", () => {
    const s = plain(DEFAULT_SETTINGS) as Record<string, any>
    s.boards.kerf = 4
    s.boards.sheets = [{ material: "", w: 2800, h: 2070 }, { material: "Roure massís / xapat", w: 100, h: 2000 }]
    const r = parseSettings(s)
    expect(r.settings.boards.kerf).toBe(4)
    expect(r.settings.boards.sheets).toEqual([{ material: "", w: 2800, h: 2070 }])
    // Sense cap tauler bo (en cal un): els inicials, però el gruix de tall es queda.
    const none = parseSettings({ ...s, boards: { ...s.boards, sheets: [{ w: 1 }] } })
    expect(none.settings.boards.sheets).toEqual(DEFAULT_SETTINGS.boards.sheets)
    expect(none.settings.boards.kerf).toBe(4)
  })

  it("jocs i materials per defecte: només el camp dolent", () => {
    const s = plain(DEFAULT_SETTINGS) as Record<string, any>
    s.gaps.outerGap = 3
    s.gaps.grooveDepth = 99
    s.defaults.material = "El meu"
    s.defaults.thickness = "gruixut"
    const r = parseSettings(s)
    expect(r.settings.gaps.outerGap).toBe(3)
    expect(r.settings.gaps.grooveDepth).toBe(DEFAULT_SETTINGS.gaps.grooveDepth)
    expect(r.settings.defaults.material).toBe("El meu")
    expect(r.settings.defaults.thickness).toBe(DEFAULT_SETTINGS.defaults.thickness)
  })
})

describe("materials de simulació per versió (v3, v4, v5)", () => {
  const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  const since = (v: number) => SIM_MATERIALS.filter((m) => SIM_MATERIALS_SINCE[m.id] === v)
  const simIds = (ms: { id: string }[]) => ms.filter((m) => m.id in SIM_MATERIALS_SINCE).map((m) => m.id)
  const user = (version: number, sims: MaterialPref[]) => {
    const { machines: _m, ...rest } = plain(DEFAULT_SETTINGS)
    void _m
    return { ...rest, version, materials: [...plain(DEFAULT_SETTINGS.materials.filter((m) => !(m.id in SIM_MATERIALS_SINCE))), ...plain(sims)] }
  }

  it("cada material de simulació té la seva versió", () => {
    expect(since(3).length + since(4).length + since(5).length).toBe(SIM_MATERIALS.length)
    expect(since(3)[0]!.id).toBe("sim-fabric-grey")
    expect(since(5).map((m) => m.id)).toEqual(["sim-lampshade", "sim-bulb"])
  })

  it("els esborrats no tornen a qui ja tenia la versió que els va portar", () => {
    const one = [SIM_MATERIALS[0]!]
    // v4: ja tenia els de la v3 i la v4 (n'ha esborrat tots menys un); només li falten els llums de la v5.
    expect(simIds(parseSettings(user(4, one)).settings.materials).sort()).toEqual([one[0]!.id, ...since(5).map((m) => m.id)].sort())
    // v5 i posteriors: res de nou.
    for (const v of [5, 6, 9]) expect(simIds(parseSettings(user(v, one)).settings.materials)).toEqual([one[0]!.id])
    // v3: li falten els de la v4 i la v5, no els de la v3 que ha esborrat.
    expect(simIds(parseSettings(user(3, one)).settings.materials).sort()).toEqual([one[0]!.id, ...since(4).map((m) => m.id), ...since(5).map((m) => m.id)].sort())
    // v2: tots.
    expect(simIds(parseSettings(user(2, one)).settings.materials)).toHaveLength(SIM_MATERIALS.length)
  })
})

describe("importar preferències", () => {
  it("les seccions que el fitxer no porta es queden (les màquines!)", () => {
    const machine = { name: "SCM" } as unknown as Machine
    const current: Settings = { ...DEFAULT_SETTINGS, machines: [machine], label: { w: 120, h: 80 } }
    const file = { version: 9, boards: { ...DEFAULT_SETTINGS.boards, kerf: 3 } }
    const r = importSettingsJson(current, JSON.stringify(file))
    expect(r.settings.machines).toEqual([machine])
    expect(r.settings.label).toEqual({ w: 120, h: 80 })
    expect(r.settings.boards.kerf).toBe(3)
    expect(r.settings.materials).toBe(current.materials)
    expect(r.settings.version).toBe(SETTINGS_VERSION)
  })

  it("ferratges: els per defecte es comproven contra la biblioteca que queda, no la inicial", () => {
    const mine = copyHardwareItem(DEFAULT_SETTINGS.hardwareLibrary.find((x) => x.id === "hinge-cup")!, "hw-mine", "Meva")
    const current: Settings = { ...DEFAULT_SETTINGS, hardwareLibrary: [...DEFAULT_SETTINGS.hardwareLibrary, mine], hardwareDefaults: { ...DEFAULT_SETTINGS.hardwareDefaults, hinge: "hw-mine" } }
    // Només els per defecte, apuntant a un item teu que hi és: es queda.
    const onlyDefaults = importSettingsJson(current, JSON.stringify({ version: SETTINGS_VERSION, hardwareDefaults: { ...current.hardwareDefaults } }))
    expect(onlyDefaults.settings.hardwareDefaults.hinge).toBe("hw-mine")
    expect(onlyDefaults.settings.hardwareLibrary).toBe(current.hardwareLibrary)
    // Un per defecte que no hi és: el primer del mateix motor.
    const missing = importSettingsJson(current, JSON.stringify({ version: SETTINGS_VERSION, hardwareDefaults: { ...current.hardwareDefaults, slide: "hw-cap" } }))
    expect(missing.settings.hardwareDefaults.slide).toBe("slide-ball")
    expect(missing.settings.hardwareDefaults.hinge).toBe("hw-mine")
    // Només la biblioteca (sense el teu): el per defecte que hi apuntava passa a un que hi és.
    const onlyLibrary = importSettingsJson(current, JSON.stringify({ version: SETTINGS_VERSION, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary }))
    const lib = onlyLibrary.settings.hardwareLibrary
    expect(lib.some((x) => x.id === "hw-mine")).toBe(false)
    expect(onlyLibrary.settings.hardwareDefaults.hinge).toBe("hinge-cup")
    for (const [slot, id] of Object.entries(onlyLibrary.settings.hardwareDefaults)) expect(lib.some((x) => x.id === id), slot).toBe(true)
    expect(SettingsSchema.safeParse(onlyLibrary.settings).success).toBe(true)
  })

  it("un fitxer que no és JSON no toca res", () => {
    const r = importSettingsJson(DEFAULT_SETTINGS, "{ no")
    expect(r.settings).toBe(DEFAULT_SETTINGS)
    expect(r.problems[0]).toMatch(/JSON/)
  })
})

describe("v12: duplicats fora i noms únics", () => {
  const v11 = (materials: MaterialPref[], extra: Partial<Settings> = {}) => ({ ...DEFAULT_SETTINGS, version: 11, materials, ...extra })
  const mel19: MaterialPref = { id: "mel-19", name: "Melamina 19", thicknesses: [16, 19], hasGrain: false, finish: { kind: "color", color: "#f2f0eb" }, edge: "PVC blanc 1 mm" }
  const dm10: MaterialPref = { id: "dm-10", name: "DM 10", thicknesses: [10], hasGrain: false, finish: { kind: "color", color: "#c9b79a" }, edge: "", forBacks: true }
  const pine = (name: string): MaterialPref => ({ ...SIM_MATERIALS.find((m) => m.id === "sim-pine")!, name })
  const base = DEFAULT_SETTINGS.materials.filter((m) => m.id !== "sim-pine")

  it("els valors inicials ja no porten «Melamina 19», «DM 10» ni «Pi» i tenen noms únics", () => {
    const names = DEFAULT_SETTINGS.materials.map((m) => m.name)
    expect(names).not.toContain("Melamina 19")
    expect(names).not.toContain("DM 10")
    expect(names).not.toContain("Pi")
    expect(names).toContain("Fulles de pi")
    expect(SETTINGS_VERSION).toBe(28)
  })

  it("«Melamina 19» i «DM 10» inicials passen als de sempre (amb les referències de les preferències) i «Pi» a «Fulles de pi»", () => {
    const res = parseSettings(v11([...base, mel19, dm10, pine("Pi")], {
      defaults: { material: "Melamina 19", thickness: 16, backMaterial: "DM 10", backThickness: 10 },
      boards: { ...DEFAULT_SETTINGS.boards, sheets: [{ material: "Melamina 19", w: 2440, h: 1220 }, { material: "", w: 2800, h: 2070 }] },
    }))
    expect(res.problems).toEqual([])
    expect(res.migrated).toBe(true)
    const names = res.settings.materials.map((m) => m.name)
    expect(names).not.toContain("Melamina 19")
    expect(names).not.toContain("DM 10")
    expect(names).toContain("Fulles de pi")
    expect(res.settings.defaults).toEqual({ material: "Melamina blanca", thickness: 16, backMaterial: "DM (fons)", backThickness: 10 })
    expect(res.settings.boards.sheets[0]!.material).toBe("Melamina blanca")
    expect(res.renames).toEqual([["Melamina 19", "Melamina blanca"], ["DM 10", "DM (fons)"], ["Pi", "Fulles de pi"]])
    // Els gruixos del duplicat passen al de sempre (ja els tenia).
    expect(res.settings.materials.find((m) => m.name === "Melamina blanca")!.thicknesses).toEqual([10, 16, 19, 30])
    expect(SettingsSchema.safeParse(res.settings).success).toBe(true)
  })

  it("si l'usuari els ha retocat (o el de sempre no hi és), es queden; i es fa un sol cop", () => {
    const mine = { ...mel19, finish: { kind: "color" as const, color: "#ffffff" } }
    const res = parseSettings(v11([...base.filter((m) => m.name !== "DM (fons)"), mine, dm10, pine("Pi"), { ...pine("Fulles de pi"), id: "u-pi" }]))
    const names = res.settings.materials.map((m) => m.name)
    expect(names).toContain("Melamina 19")
    expect(names).toContain("DM 10")
    // «Fulles de pi» ja és d'un altre: «Pi» es queda.
    expect(names).toContain("Pi")
    expect(res.renames).toEqual([])
    // Desades ja a la v12: res no es torna a migrar.
    const again = parseSettings({ ...DEFAULT_SETTINGS, materials: [...base, mel19, dm10] })
    expect(again.settings.materials.map((m) => m.name)).toContain("Melamina 19")
    expect(again.renames).toEqual([])
  })

  it("l'esquema rebutja noms repetits (majúscules i espais a part)", () => {
    const dup = { ...DEFAULT_SETTINGS, materials: [...DEFAULT_SETTINGS.materials, { ...DEFAULT_SETTINGS.materials[0]!, id: "x", name: " melamina  BLANCA" }] }
    const r = SettingsSchema.safeParse(dup)
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]!.message).toMatch(/Nom repetit/)
  })

  it("en llegir-les, un nom repetit passa a «X 2» amb un avís (sense perdre el material)", () => {
    const copy = { ...DEFAULT_SETTINGS.materials[0]!, id: "x", name: "Melamina Blanca", finish: { kind: "color" as const, color: "#fafafa" } }
    const res = parseSettings({ ...DEFAULT_SETTINGS, materials: [...DEFAULT_SETTINGS.materials, copy] })
    expect(res.problems).toEqual(["Materials: «Melamina Blanca» estava repetit; l'altre ara es diu «Melamina Blanca 2»."])
    expect(res.settings.materials.find((m) => m.id === "x")).toMatchObject({ name: "Melamina Blanca 2", finish: { color: "#fafafa" } })
    expect(res.settings.materials.find((m) => m.id === "mel-white")!.name).toBe("Melamina blanca")
    expect(SettingsSchema.safeParse(res.settings).success).toBe(true)
  })
})

describe("v13: gruixos del catàleg", () => {
  it("s'afegeixen als materials inicials, una sola vegada", async () => {
    const { addCatalogThicknesses } = await import("./settings")
    const once = addCatalogThicknesses([{ id: "ash", name: "Freixe xapat", thicknesses: [19], hasGrain: true, finish: { kind: "wood", species: "ash" }, edge: "" }])
    expect(once[0]!.thicknesses).toEqual([16, 19, 30])
    expect(addCatalogThicknesses(once)[0]).toBe(once[0])
  })
})

describe("v14: llum LED dels mobles", () => {
  it("«Tira LED» s'afegeix a les preferències antigues (fa llum) i no es repeteix", () => {
    const old = { ...DEFAULT_SETTINGS, version: 13, materials: DEFAULT_SETTINGS.materials.filter((m) => m.name !== "Tira LED") }
    const res = parseSettings(JSON.parse(JSON.stringify(old)))
    const led = res.settings.materials.filter((m) => m.name === "Tira LED")
    expect(led).toHaveLength(1)
    expect(led[0]!.glow).toBeGreaterThan(0)
    expect(parseSettings(JSON.parse(JSON.stringify(res.settings))).settings.materials.filter((m) => m.name === "Tira LED")).toHaveLength(1)
  })
})

describe("v23: jocs de calaix de doble paret", () => {
  it("unes preferències v22 reben els jocs inicials; unes v23 sense jocs no els tornen a rebre", () => {
    const v22 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 22, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => x.engine !== "drawerKit") }
    const res = parseSettings(v22)
    expect(res.migrated).toBe(true)
    expect(res.settings.hardwareLibrary.filter((x) => x.engine === "drawerKit").map((x) => x.id)).toEqual(DEFAULT_HARDWARE_KITS.map((k) => k.id))
    const v23 = { ...JSON.parse(JSON.stringify(res.settings)), hardwareLibrary: res.settings.hardwareLibrary.filter((x) => x.id !== "kit-dtc-ht14") }
    expect(parseSettings(v23).settings.hardwareLibrary.some((x) => x.id === "kit-dtc-ht14")).toBe(false)
    // Un joc amb el camp `kit` dolent només treu aquell item.
    const bad = { ...v23, hardwareLibrary: v23.hardwareLibrary.map((x: { id: string }) => (x.id === "kit-dtc-ht11" ? { ...x, kit: { maker: 1 } } : x)) }
    const r2 = parseSettings(bad)
    expect(r2.settings.hardwareLibrary.some((x) => x.id === "kit-dtc-ht11")).toBe(false)
    expect(r2.settings.hardwareLibrary.some((x) => x.id === "kit-dtc-ht12")).toBe(true)
  })
  it("v24: els jocs inicials reben les dades d'ara (guia de dos cossos, acabats) i es queda la prebroca de l'usuari, que passa a ser la regla `kitPilot`", () => {
    const ht11 = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-ht11")!
    const oldKit = { ...structuredClone(ht11.kit!), options: { closing: ["soft"], back: ["wood"] }, components: ht11.kit!.components.map((c) => ({ ...c, shapes: c.id === "slide" ? [c.shapes[0]!] : c.shapes })) }
    // Unes preferències d'abans: sense la regla, i la prebroca de l'usuari (3 × 12) a tots els jocs (com la posava `setKitPilot`).
    const { kitPilot: _k, ...rest } = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    const v23 = { ...rest, version: 23, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.map((x) => (x.engine === "drawerKit" ? { ...x, params: { pilotDiameter: 3, pilotDepth: 12 }, ...(x.id === "kit-dtc-ht11" ? { kit: oldKit } : {}) } : x)) }
    const res = parseSettings(v23)
    expect(res.migrated).toBe(true)
    const got = res.settings.hardwareLibrary.find((x) => x.id === "kit-dtc-ht11")!
    expect(got.kit).toEqual(ht11.kit)
    expect(got.params).toEqual({ pilotDiameter: 3, pilotDepth: 12 })
    expect(res.settings.kitPilot).toEqual({ enabled: true, diameter: 3, depth: 12 })
    // Una sola font: canviar la regla posa els números a tots els jocs.
    const off = setKitPilot(res.settings.hardwareLibrary, { enabled: false, diameter: 3, depth: 12 })
    expect(off.filter((x) => x.engine === "drawerKit").every((x) => x.params.pilotDiameter === 0)).toBe(true)
  })
})

describe("v26: assistent IA", () => {
  const key = "sk-ant-api03-secret-abcd"
  const withKey: Settings = { ...DEFAULT_SETTINGS, assistant: { apiKey: key, model: "claude-opus-5-5" } }

  it("les preferències d'abans reben l'assistent sense clau i amb Sonnet; un model desconegut torna al per defecte", () => {
    const { assistant: _a, ...old } = DEFAULT_SETTINGS
    void _a
    const res = parseSettings({ ...old, version: 25 })
    expect(res.settings.assistant).toEqual({ model: "claude-sonnet-5-5" })
    expect(res.problems).toEqual([])
    const odd = parseSettings({ ...DEFAULT_SETTINGS, assistant: { apiKey: key, model: "claude-x-9" } })
    expect(odd.settings.assistant.model).toBe("claude-sonnet-5-5")
    expect(odd.settings.assistant.apiKey).toBe(key)
    expect(SettingsSchema.safeParse(res.settings).success).toBe(true)
  })

  it("la clau no surt mai a l'export i importar-ne unes no la canvia ni la treu", () => {
    const json = settingsToJson(withKey)
    expect(json).not.toContain(key)
    expect(JSON.parse(json).assistant).toEqual({ model: "claude-opus-5-5" })
    // Importar el mateix fitxer (sense clau) conserva la clau d'aquest dispositiu.
    expect(importSettingsJson(withKey, json).settings.assistant).toEqual({ apiKey: key, model: "claude-opus-5-5" })
    // Un fitxer que en porti una (fet a mà) no la posa.
    const foreign = JSON.stringify({ ...DEFAULT_SETTINGS, assistant: { apiKey: "sk-ant-other", model: "claude-sonnet-5-5" } })
    expect(importSettingsJson(withKey, foreign).settings.assistant).toEqual({ apiKey: key, model: "claude-sonnet-5-5" })
    expect(importSettingsJson(DEFAULT_SETTINGS, foreign).settings.assistant.apiKey).toBeUndefined()
  })
})
