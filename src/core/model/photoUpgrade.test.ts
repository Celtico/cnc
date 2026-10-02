import { describe, expect, it } from "vitest"
import { normalizeComposition, type Composition } from "./composition"
import { parseAmbient } from "./ambient"
import { aliasMaterialRefs, PHOTO_UPGRADES, resolveMaterialAlias, upgradeToPhoto } from "./photoUpgrade"
import { BUILTIN_MATERIALS, DEFAULT_SETTINGS, NON_CNC_MATERIALS, parseSettings, SIM_MATERIALS, type MaterialPref } from "./settings"
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
    expect(oak).toMatchObject({ id: "oak", thicknesses: [19, 30], hasGrain: true, edge: "Xapa de roure" })
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
