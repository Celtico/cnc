import { afterEach, describe, expect, it } from "vitest"
import { normalizeComposition, type Composition } from "./composition"
import { parseAmbient } from "./ambient"
import { aliasMaterialRefs, PHOTO_UPGRADES, rescalePhotoTiles, resolveMaterialAlias, restorePhotoThicknesses, setKnownMaterialNames, upgradeToPhoto } from "./photoUpgrade"
import { BUILTIN_MATERIALS, DEFAULT_SETTINGS, NON_CNC_MATERIALS, parseSettings, SIM_MATERIALS, TEMPLATE_MATERIALS, type MaterialPref } from "./settings"
import { STORE_TEMPLATES } from "./storeCatalog"
import { INSPIRED_TEMPLATES } from "./inspiredTemplates"
import { MAG_FURNITURE } from "./magFurniture"
import { MAG_OBJECTS } from "./magObjects"
import { COLLECTION_PIECES } from "./collections"
import { OBJECT_TEMPLATES } from "./ambient"
import { AMBIENT_TEMPLATES } from "./ambientTemplates"
import { PHOTO_MATERIALS, TEXTURE_SETS } from "./textureSets"
import { BUILTIN_TEMPLATES } from "./templates"

const CLASSIC: MaterialPref[] = [
  { id: "mel-white", name: "Melamina blanca", thicknesses: [10, 16, 19], hasGrain: false, finish: { kind: "color", color: "#f2f0eb" }, edge: "PVC blanc 1 mm" },
  { id: "oak", name: "Roure massís / xapat", thicknesses: [19, 30], hasGrain: true, finish: { kind: "wood", species: "oak" }, edge: "Xapa de roure" },
  { id: "walnut", name: "Noguera xapada", thicknesses: [19], hasGrain: true, finish: { kind: "wood", species: "walnut" }, edge: "Xapa de noguera" },
  { id: "ash", name: "Freixe xapat", thicknesses: [19], hasGrain: true, finish: { kind: "wood", species: "ash" }, edge: "Xapa de freixe" },
  { id: "mdf-back", name: "DM (fons)", thicknesses: [10, 12], hasGrain: false, finish: { kind: "color", color: "#c9b79a" }, edge: "", forBacks: true },
]
/** Preferències desades a la v6: els de sempre i els «(foto)» repetits. */
const V6 = { version: 6, materials: [...CLASSIC, ...NON_CNC_MATERIALS, ...SIM_MATERIALS, ...PHOTO_MATERIALS], defaults: { material: "Roure (foto)", thickness: 19, backMaterial: "DM (fons)", backThickness: 10 } }

describe("materials de sempre amb foto (v7)", () => {
  it("la taula només apunta a jocs i materials que existeixen", () => {
    const all = [...CLASSIC, ...NON_CNC_MATERIALS, ...SIM_MATERIALS].map((m) => m.name)
    for (const u of PHOTO_UPGRADES) {
      expect(TEXTURE_SETS.some((t) => t.id === u.set), u.set).toBe(true)
      for (const n of u.names) expect(all.includes(n) || n === "Melamina roure" || n === "Revestiment de roure", n).toBe(true)
    }
  })

  it("migra una v6: els de sempre agafen la foto, els «(foto)» repetits fora i la resta sense «(foto)»", () => {
    const res = parseSettings(V6)
    expect(res.migrated).toBe(true)
    const ms = res.settings.materials
    const oak = ms.find((m) => m.name === "Roure massís / xapat")!
    // Els gruixos del «Roure (foto)» que desapareix (16 · 19 · 30) passen al de sempre.
    expect(oak).toMatchObject({ id: "oak", thicknesses: [16, 19, 30], hasGrain: true, edge: "Xapa de roure" })
    expect(ms.find((m) => m.name === "Noguera xapada")!.thicknesses).toEqual([16, 19, 30])
    expect(oak.finish).toMatchObject({ kind: "image", src: "textures/oak_veneer_01/diff.jpg", normalMap: "textures/oak_veneer_01/nor.jpg", grain: "y" })
    expect(ms.find((m) => m.name === "Parquet de roure")!.finish).toMatchObject({ kind: "image", src: "textures/wood_floor/diff.jpg" })
    expect(ms.find((m) => m.name === "Jute")).toMatchObject({ category: "sim", translucent: 0.35 })
    // Sense foto fidel: igual que abans.
    expect(ms.find((m) => m.name === "Freixe xapat")!.finish).toEqual({ kind: "wood", species: "ash" })
    expect(ms.find((m) => m.name === "Estuc greige")!.finish.kind).toBe("color")
    expect(ms.find((m) => m.name === "Melamina blanca")!.finish.kind).toBe("color")
    // Cap «(foto)» ni noms repetits; els que no tenen parella, reanomenats amb el mateix id.
    expect(ms.filter((m) => m.name.endsWith("(foto)"))).toEqual([])
    expect(new Set(ms.map((m) => m.name)).size).toBe(ms.length)
    expect(ms.find((m) => m.id === "photo-dark_wood")).toMatchObject({ name: "Fusta fosca", category: "board" })
    expect(ms.some((m) => m.id === "photo-oak_veneer_01")).toBe(false)
    // Material per defecte: el nom nou.
    expect(res.settings.defaults.material).toBe("Roure massís / xapat")
    // Cada nom antic porta a un material que hi és.
    for (const t of TEXTURE_SETS) expect(ms.some((m) => m.name === resolveMaterialAlias(t.label)), t.label).toBe(true)
  })

  it("és idempotent", () => {
    const once = parseSettings(V6).settings
    const twice = parseSettings({ ...once, version: 6 }).settings
    expect(twice.materials).toEqual(once.materials)
    expect(upgradeToPhoto(once.materials)).toEqual(once.materials)
    expect(parseSettings(once).settings).toEqual(once)
  })

  it("no toca una foto pròpia ni un nom que ja és d'un altre material", () => {
    const mine: MaterialPref = { ...CLASSIC[1]!, finish: { kind: "image", src: "data:image/jpeg;base64,AAAA", tileMm: 800 } }
    const terratzo: MaterialPref = { id: "u1", name: "Terratzo", thicknesses: [10], hasGrain: false, finish: { kind: "color", color: "#777777" }, edge: "" }
    const out = upgradeToPhoto([mine, terratzo, ...PHOTO_MATERIALS])
    expect(out.find((m) => m.id === "oak")!.finish).toEqual(mine.finish)
    // El «Roure (foto)» es queda: el de sempre fa servir una altra foto.
    expect(out.some((m) => m.name === "Roure (foto)")).toBe(true)
    expect(out.find((m) => m.id === "photo-concrete_floor_01")!.name).toBe("Terratzo (foto)")
  })

  it("instal·lació nova: el mateix resultat, sense duplicats", () => {
    const names = BUILTIN_MATERIALS.map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.filter((n) => n.endsWith("(foto)"))).toEqual([])
    expect(DEFAULT_SETTINGS.materials.find((m) => m.name === "Noguera xapada")!.finish).toMatchObject({ src: "textures/walnut_veneer_02/diff.jpg" })
  })
})

describe("àlies dels noms antics", () => {
  it("resolveMaterialAlias", () => {
    expect(resolveMaterialAlias("Roure (foto)")).toBe("Roure massís / xapat")
    expect(resolveMaterialAlias("Parquet de roure (foto)")).toBe("Parquet de roure")
    expect(resolveMaterialAlias("Llana espiga (foto)")).toBe("Teixit gris")
    expect(resolveMaterialAlias("Fusta fosca (foto)")).toBe("Fusta fosca")
    expect(resolveMaterialAlias("Melamina blanca")).toBe("Melamina blanca")
    expect(resolveMaterialAlias("Coses (foto)")).toBe("Coses (foto)")
  })

  it("composició: mòduls, fronts, fons, peces, objectes i escena", () => {
    const base = BUILTIN_TEMPLATES[0]!.make()
    const m0 = base.modules[0]!
    const comp: Composition = {
      ...base,
      modules: [{ ...m0, carcass: { ...m0.carcass, material: "Roure (foto)", frontMaterial: "Noguera (foto)", backMaterial: "DM (fons)" } }, ...base.modules.slice(1)],
      parts: [{ id: "p1", name: "Peça", orient: "flat", material: "Pedra calcària (foto)", w: 600, h: 600, thickness: 20, x: 0, y: 0, z: 0 } as NonNullable<Composition["parts"]>[number]],
      scene: { floor: "Parquet de roure (foto)", wall: "Estuc antracita (foto)" },
    }
    const out = normalizeComposition(comp)
    expect(out.modules[0]!.carcass).toMatchObject({ material: "Roure massís / xapat", frontMaterial: "Noguera xapada", backMaterial: "DM (fons)" })
    expect(out.parts![0]!.material).toBe("Pedra calcària")
    expect(out.scene).toEqual({ floor: "Parquet de roure", wall: "Estuc antracita" })
    // Sense noms antics, el mateix objecte.
    expect(aliasMaterialRefs(base)).toBe(base)
  })

  it("ambient: terra, parets, sostre i blocs", () => {
    const a = parseAmbient({
      walls: [{ id: "w1", a: [0, 0], b: [1000, 0], thickness: 100, height: 2500, material: "Mur de pedra (foto)" }],
      items: [{ id: "b1", kind: "block", name: "Sofà", shape: "sofa", w: 2000, h: 800, d: 900, material: "Llana espiga (foto)", material2: "Jute (foto)", x: 0, y: 0, rot: 0 }],
      floorMaterial: "Parquet de roure (foto)",
      wallMaterial: "Microciment (foto)",
      ceilingMaterial: "Estuc antracita (foto)",
    })
    expect(a).toMatchObject({ floorMaterial: "Parquet de roure", wallMaterial: "Microciment gris", ceilingMaterial: "Estuc antracita" })
    expect(a.walls[0]!.material).toBe("Mur de pedra")
    expect(a.items[0]).toMatchObject({ material: "Teixit gris", material2: "Jute" })
  })
})

describe("mida de les xapes de foto (v8)", () => {
  const photo = (id: string, name: string, set: string, tileMm: number): MaterialPref => {
    const t = TEXTURE_SETS.find((x) => x.id === set)!
    const base = PHOTO_MATERIALS.find((m) => m.id === `photo-${t.id}`)!
    return { ...base, id, name, finish: { ...base.finish, tileMm } as MaterialPref["finish"] }
  }

  it("actualitza només els que tenen la mida d'abans, i és idempotent", () => {
    const v7 = {
      ...DEFAULT_SETTINGS,
      version: 7,
      materials: [
        photo("oak", "Roure massís / xapat", "oak_veneer_01", 1100),
        photo("u1", "El meu roure", "oak_veneer_01", 1500),
        photo("wal", "Noguera xapada", "walnut_veneer_02", 1200),
        photo("dark", "Fusta fosca", "dark_wood", 1000),
      ],
    }
    const res = parseSettings(v7)
    expect(res.migrated).toBe(true)
    const tile = (id: string) => (res.settings.materials.find((m) => m.id === id)!.finish as { tileMm: number }).tileMm
    expect(tile("oak")).toBe(TEXTURE_SETS.find((t) => t.id === "oak_veneer_01")!.tileMm)
    expect(tile("oak")).toBeLessThan(1100)
    expect(tile("u1")).toBe(1500)
    expect(tile("wal")).toBe(TEXTURE_SETS.find((t) => t.id === "walnut_veneer_02")!.tileMm)
    expect(tile("dark")).toBe(1000)
    expect(parseSettings(res.settings).settings).toEqual(res.settings)
    expect(rescalePhotoTiles(res.settings.materials)).toBe(res.settings.materials)
  })
})

describe("acabats retocats i gruixos (v7 per a migracions futures, v9)", () => {
  it("v7 no toca un acabat de sempre retocat per l'usuari i hi deixa el «(foto)» al costat", () => {
    const mine: MaterialPref = { ...CLASSIC[2]!, finish: { kind: "wood", species: "walnut", gen: { base: "#5a3c28", dark: "#2c1a10", lines: 20, wobble: 0.05, bands: 20, contrast: 0.6, figure: 2, pores: 1000, grain: 6, tileMm: 700, seed: 9 } } }
    const out = upgradeToPhoto([CLASSIC[1]!, mine, ...PHOTO_MATERIALS])
    expect(out.find((m) => m.id === "walnut")!.finish).toEqual(mine.finish)
    expect(out.some((m) => m.name === "Noguera (foto)")).toBe(true)
    // El que tenia l'acabat per defecte sí que passa a la foto.
    expect(out.find((m) => m.id === "oak")!.finish.kind).toBe("image")
    expect(out.some((m) => m.name === "Roure (foto)")).toBe(false)
  })

  it("v9 torna els gruixos de les xapes de foto i afegeix només els materials de plantilla que falten", () => {
    const oak = { ...DEFAULT_SETTINGS.materials.find((m) => m.id === "oak")!, thicknesses: [19, 30] }
    const walnut = { ...DEFAULT_SETTINGS.materials.find((m) => m.id === "walnut")!, thicknesses: [19] }
    const myMel: MaterialPref = { id: "u-mel", name: "Melamina 19", thicknesses: [19], hasGrain: false, finish: { kind: "color", color: "#ffffff" }, edge: "PVC" }
    const ash = DEFAULT_SETTINGS.materials.find((m) => m.id === "ash")!
    const res = parseSettings({ ...DEFAULT_SETTINGS, version: 8, materials: [oak, walnut, ash, myMel] })
    const ms = res.settings.materials
    expect(ms.find((m) => m.id === "oak")!.thicknesses).toEqual([16, 19, 30])
    expect(ms.find((m) => m.id === "walnut")!.thicknesses).toEqual([16, 19, 30])
    expect(ms.find((m) => m.id === "ash")!.thicknesses).toEqual([19])
    // El de l'usuari amb el mateix nom no es toca ni es duplica.
    expect(ms.filter((m) => m.name === "Melamina 19")).toEqual([myMel])
    for (const t of TEMPLATE_MATERIALS) expect(ms.some((m) => m.name === t.name), t.name).toBe(true)
    // Idempotent; una v9 no s'hi torna a fer.
    expect(restorePhotoThicknesses(ms)).toBe(ms)
    expect(parseSettings(res.settings).settings).toEqual(res.settings)
    const without = { ...res.settings, materials: ms.filter((m) => m.name !== "MDF lacat negre") }
    expect(parseSettings(without).settings.materials.some((m) => m.name === "MDF lacat negre")).toBe(false)
  })
})

describe("àlies segons els materials de l'usuari", () => {
  afterEach(() => setKnownMaterialNames(null))

  it("un «X (foto)» que l'usuari encara té (v7 el va conservar) no es reanomena", () => {
    const names = new Set(["Terratzo", "Terratzo (foto)", "Fusta fosca", "Roure massís / xapat"])
    expect(resolveMaterialAlias("Terratzo (foto)", names)).toBe("Terratzo (foto)")
    expect(resolveMaterialAlias("Fusta fosca (foto)", names)).toBe("Fusta fosca")
    expect(resolveMaterialAlias("Roure (foto)", names)).toBe("Roure massís / xapat")
    // Sense el nom nou, tampoc.
    expect(resolveMaterialAlias("Noguera (foto)", names)).toBe("Noguera (foto)")
    // Registre (el posa settingsStore): normalizeComposition i parseAmbient el fan servir.
    setKnownMaterialNames(names)
    const a = parseAmbient({ walls: [], items: [], floorMaterial: "Terratzo (foto)", wallMaterial: "Fusta fosca (foto)" })
    expect(a).toMatchObject({ floorMaterial: "Terratzo (foto)", wallMaterial: "Fusta fosca" })
    setKnownMaterialNames(null)
    expect(resolveMaterialAlias("Terratzo (foto)")).toBe("Terratzo")
  })

  it("preferències: el material per defecte i els taulers segons els materials desats", () => {
    const user: MaterialPref = { id: "u1", name: "Terratzo", thicknesses: [10], hasGrain: false, finish: { kind: "color", color: "#777777" }, edge: "" }
    const res = parseSettings({ ...V6, materials: [...V6.materials, user], defaults: { ...V6.defaults, material: "Terratzo (foto)" }, boards: { ...DEFAULT_SETTINGS.boards, sheets: [{ material: "Terratzo (foto)", w: 2800, h: 2070 }] } })
    expect(res.settings.materials.some((m) => m.name === "Terratzo (foto)")).toBe(true)
    expect(res.settings.defaults.material).toBe("Terratzo (foto)")
    expect(res.settings.boards.sheets[0]!.material).toBe("Terratzo (foto)")
  })

  it("obertures de les parets: el material dels perfils (`frame`)", () => {
    const a = parseAmbient({ walls: [{ id: "w1", a: [0, 0], b: [3000, 0], thickness: 100, height: 2500, openings: [{ kind: "window", at: 1500, w: 1000, h: 1200, sill: 900, frame: "Fusta fosca (foto)" }] }], items: [] })
    expect(a.walls[0]!.openings![0]!.frame).toBe("Fusta fosca")
  })
})

describe("materials de les plantilles", () => {
  const isRefKey = (k: string) => k === "material" || k === "material2" || k === "frame" || /Material$/.test(k)
  const collect = (v: unknown, out: Set<string>, scene = false): void => {
    if (Array.isArray(v)) return v.forEach((x) => collect(x, out))
    if (typeof v !== "object" || v === null) return
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === "string") {
        if (x && (isRefKey(k) || (scene && (k === "floor" || k === "wall")))) out.add(x)
      } else collect(x, out, k === "scene")
    }
  }

  it("tots els noms que fan servir les plantilles i els ambients del catàleg són a les preferències inicials", () => {
    const used = new Set<string>()
    for (const t of [...BUILTIN_TEMPLATES, ...STORE_TEMPLATES, ...INSPIRED_TEMPLATES, ...MAG_FURNITURE, ...MAG_OBJECTS, ...COLLECTION_PIECES, ...OBJECT_TEMPLATES]) collect(t.make(), used)
    collect(AMBIENT_TEMPLATES, used)
    const names = new Set(DEFAULT_SETTINGS.materials.map((m) => m.name))
    expect([...used].filter((n) => !names.has(resolveMaterialAlias(n, names)))).toEqual([])
  })
})
