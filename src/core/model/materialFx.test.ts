import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, LAMPSHADE_GLOW, parseSettings, type MaterialPref } from "./settings"
import { materialCoat, materialSheen } from "./materialFx"

const byName = (n: string) => DEFAULT_SETTINGS.materials.find((m) => m.name === n)!

describe("vernís i vellut del render", () => {
  it("els de l'app per defecte, i el valor propi (també 0) mana", () => {
    expect(materialSheen(byName("Vellut verd"))).toBeGreaterThan(0.5)
    expect(materialCoat(byName("Parquet de noguera"))).toBeGreaterThan(0)
    expect(materialCoat(byName("Lacat negre brillant"))).toBe(1)
    expect(materialCoat(byName("Melamina blanca"))).toBe(0)
    expect(materialCoat({ ...byName("Parquet de noguera"), coat: 0 })).toBe(0)
    expect(materialSheen({ ...byName("Vellut verd"), sheen: 0.2 })).toBe(0.2)
  })
  it("la pedra polida té vernís; la mat, no", () => {
    const stone = (polish: number): MaterialPref => ({ id: "x", name: "Marbre", thicknesses: [20], hasGrain: false, edge: "", finish: { kind: "stone", color: "#eee", vein: "#888", veins: 0.5, size: 1200, seed: 1, polish } })
    expect(materialCoat(stone(1))).toBeGreaterThan(0.8)
    expect(materialCoat(stone(0.2))).toBe(0)
  })
  it("v15: els lacats brillants s'afegeixen a les preferències antigues", () => {
    const old = { ...DEFAULT_SETTINGS, version: 14, materials: DEFAULT_SETTINGS.materials.filter((m) => !/brillant/.test(m.name)) }
    const names = parseSettings(JSON.parse(JSON.stringify(old))).settings.materials.map((m) => m.name)
    expect(names).toContain("Lacat negre brillant")
    expect(names).toContain("Lacat blanc brillant")
  })
})

describe("v16: fusta de fil", () => {
  it("«Roure de fil» i «Noguera de fil» s'afegeixen (veta recta, sense arcs)", () => {
    const old = { ...DEFAULT_SETTINGS, version: 15, materials: DEFAULT_SETTINGS.materials.filter((m) => !/de fil/.test(m.name)) }
    const ms = parseSettings(JSON.parse(JSON.stringify(old))).settings.materials
    const rift = ms.find((m) => m.name === "Roure de fil")!
    expect(rift.finish.kind === "wood" && rift.finish.gen?.figure).toBe(0)
    expect(ms.some((m) => m.name === "Noguera de fil")).toBe(true)
  })
})

describe("v17: revestiment de fil i pantalles", () => {
  it("afegeix «Revestiment de roure de fil» i baixa la llum de les pantalles que encara tenien la d'abans", () => {
    const old = { ...DEFAULT_SETTINGS, version: 16, materials: DEFAULT_SETTINGS.materials.filter((m) => m.id !== "sim-oak-cladding-rift").map((m) => (m.id === "sim-lampshade" ? { ...m, glow: 4 } : m)) }
    const ms = parseSettings(JSON.parse(JSON.stringify(old))).settings.materials
    expect(ms.some((m) => m.name === "Revestiment de roure de fil")).toBe(true)
    expect(ms.find((m) => m.id === "sim-lampshade")!.glow).toBe(LAMPSHADE_GLOW)
  })
  it("una llum triada per l'usuari no es toca", () => {
    const old = { ...DEFAULT_SETTINGS, version: 16, materials: DEFAULT_SETTINGS.materials.map((m) => (m.id === "sim-lampshade" ? { ...m, glow: 7 } : m)) }
    expect(parseSettings(JSON.parse(JSON.stringify(old))).settings.materials.find((m) => m.id === "sim-lampshade")!.glow).toBe(7)
  })
})
