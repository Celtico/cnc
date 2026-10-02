import { describe, expect, it } from "vitest"
import { defaultModule } from "./composition"
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
} from "./settings"

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
      hardware: DEFAULT_SETTINGS.hardware,
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
    expect(m.hardware).toEqual(DEFAULT_SETTINGS.hardware)
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
    expect(materialCategory({ cnc: false })).toBe("hard")
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
