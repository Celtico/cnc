import { describe, expect, it } from "vitest"
import { defaultModule } from "./composition"
import { aliasMaterialRefs, materialRefNames, renameMaterialRefs } from "./photoUpgrade"
import { backChoices, boardChoices, fixMaterialRefs, materialNameError, materialSettingsUsage, partChoices, removeMaterialFromSettings, renameMaterialInSettings, renameNestingSheets, restoredFinish, switchFinish, tidyMaterialName } from "./materialOps"
import { DEFAULT_SETTINGS, materialCategory, type Settings } from "./settings"

const comp = () => {
  const m = defaultModule("m", "M", { material: "Melamina blanca", frontMaterial: "MDF lacat", backMaterial: "DM (fons)", backThickness: 10 })
  return {
    modules: [m],
    references: [{ id: "r", name: "Sofà", shape: "box", x: 0, y: 0, z: 0, w: 10, h: 10, d: 10, effect: "obstacle", material: "Melamina blanca" }],
    scene: { floor: "Parquet de roure", wall: "Melamina blanca" },
    parts: [{ id: "p", name: "Taulell", material: "Pedra" }],
  }
}

describe("canviar el nom d'un material a les dades (`renameMaterialRefs`)", () => {
  it("canvia totes les claus de material (també l'escena) i només el nom exacte", () => {
    const c = comp()
    const out = renameMaterialRefs(c, "Melamina blanca", "Blanc de casa")
    expect(out.modules[0]!.carcass.material).toBe("Blanc de casa")
    expect(out.references[0]!.material).toBe("Blanc de casa")
    expect(out.scene).toEqual({ floor: "Parquet de roure", wall: "Blanc de casa" })
    expect(out.modules[0]!.carcass.frontMaterial).toBe("MDF lacat")
    expect(out.parts[0]!.material).toBe("Pedra")
    // El nom del mòdul o de l'objecte no és un material.
    expect(out.references[0]!.name).toBe("Sofà")
    expect(materialRefNames(out)).not.toContain("Melamina blanca")
    // L'original no es toca.
    expect(c.modules[0]!.carcass.material).toBe("Melamina blanca")
  })

  it("sense res a canviar, el mateix objecte (no es reescriu el moble)", () => {
    const c = comp()
    expect(renameMaterialRefs(c, "Noguera xapada", "Noguera")).toBe(c)
    expect(renameMaterialRefs(c, "Melamina blanca", "Melamina blanca")).toBe(c)
  })

  it("els noms retirats a la v12 es llegeixen amb el nom nou (àlies) si l'usuari ja no els té", () => {
    const names = new Set(DEFAULT_SETTINGS.materials.map((m) => m.name))
    const old = { modules: [{ carcass: { material: "Melamina 19", backMaterial: "DM 10" } }], parts: [{ material: "Pi" }] }
    expect(aliasMaterialRefs(old, names)).toEqual({ modules: [{ carcass: { material: "Melamina blanca", backMaterial: "DM (fons)" } }], parts: [{ material: "Pi" }] })
    // «Pi» no és un àlies general: un moble de fusta de pi es queda «Pi» (només la migració reanomena les fulles).
    // Si encara té «Melamina 19» (retocada), es queda.
    expect(aliasMaterialRefs(old, new Set([...names, "Melamina 19"])).modules[0]!.carcass.material).toBe("Melamina 19")
  })
})

describe("llistes dels selectors", () => {
  const ms = DEFAULT_SETTINGS.materials
  it("cos, fronts, taulell i tauler per defecte: només taulers de CNC", () => {
    const b = boardChoices(ms)
    expect(b.length).toBeGreaterThan(5)
    expect(b.every((m) => materialCategory(m) === "board")).toBe(true)
    expect(b.some((m) => m.name === "Vidre" || m.name === "Pedra" || m.name === "DM (fons)" || m.name === "Teixit gris")).toBe(false)
  })
  it("fons i mides de tauler: taulers i fons", () => {
    const b = backChoices(ms)
    expect(b.some((m) => m.name === "DM (fons)")).toBe(true)
    expect(b.some((m) => m.name === "Melamina blanca")).toBe(true)
    expect(b.some((m) => m.name === "Vidre" || m.name === "Teixit gris")).toBe(false)
  })
  it("peces lliures: tot menys els fons (ferro, pedra, vidre i simulació hi són)", () => {
    const p = partChoices(ms)
    for (const n of ["Vidre", "Pedra", "Teixit gris", "Melamina blanca"]) expect(p.some((m) => m.name === n), n).toBe(true)
    expect(p.some((m) => m.name === "DM (fons)")).toBe(false)
  })
})

describe("noms únics", () => {
  const ms = DEFAULT_SETTINGS.materials
  const self = ms.find((m) => m.name === "Melamina gris")!.id
  it("rebutja un nom d'un altre material sense mirar majúscules ni espais, i el buit", () => {
    expect(materialNameError(ms, self, "  melamina   BLANCA ")).toMatch(/Melamina blanca/)
    expect(materialNameError(ms, self, "   ")).toMatch(/nom/)
    expect(materialNameError(ms, self, "Melamina Gris")).toBeNull()
    expect(materialNameError(ms, self, "Gris de casa")).toBeNull()
    expect(tidyMaterialName("  Gris   de casa ")).toBe("Gris de casa")
  })
})

describe("preferències que segueixen el material", () => {
  const s: Settings = { ...DEFAULT_SETTINGS, boards: { ...DEFAULT_SETTINGS.boards, sheets: [{ material: "Melamina blanca", w: 2440, h: 1220 }, { material: "", w: 2800, h: 2070 }] } }

  it("canviar el nom: material, per defecte i mides de tauler", () => {
    const out = renameMaterialInSettings(s, "Melamina blanca", "Blanc")
    expect(out.materials.some((m) => m.name === "Melamina blanca")).toBe(false)
    expect(out.materials.find((m) => m.id === "mel-white")!.name).toBe("Blanc")
    expect(out.defaults.material).toBe("Blanc")
    expect(out.boards.sheets[0]!.material).toBe("Blanc")
    expect(renameMaterialInSettings(s, "Melamina blanca", "Melamina blanca")).toBe(s)
  })

  it("on el fan servir les preferències", () => {
    expect(materialSettingsUsage(s, "Melamina blanca")).toEqual({ defaultBody: true, defaultBack: false, sheets: 1 })
    expect(materialSettingsUsage(s, "DM (fons)")).toEqual({ defaultBody: false, defaultBack: true, sheets: 0 })
  })

  it("eliminar amb substitut: les referències hi passen", () => {
    const out = removeMaterialFromSettings(s, "Melamina blanca", "Melamina gris")
    expect(out.materials.some((m) => m.name === "Melamina blanca")).toBe(false)
    expect(out.defaults.material).toBe("Melamina gris")
    expect(out.boards.sheets[0]!.material).toBe("Melamina gris")
  })

  it("eliminar sense substitut: mides de tauler fora i per defecte als inicials o al primer que hi hagi", () => {
    const noWhite = removeMaterialFromSettings(s, "Melamina blanca", null)
    expect(noWhite.boards.sheets).toEqual([{ material: "", w: 2800, h: 2070 }])
    // El tauler per defecte no pot quedar penjat: el primer tauler que hi hagi.
    expect(noWhite.materials.some((m) => m.name === noWhite.defaults.material)).toBe(true)
    expect(materialCategory(noWhite.materials.find((m) => m.name === noWhite.defaults.material)!)).toBe("board")
  })

  it("restaurar: referències a materials que ja no hi són, corregides (i les que hi són, iguals)", () => {
    const mine: Settings = { ...s, defaults: { material: "El meu blanc", thickness: 18, backMaterial: "El meu fons", backThickness: 8 }, boards: { ...s.boards, sheets: [{ material: "El meu blanc", w: 2440, h: 1220 }] } }
    const out = fixMaterialRefs(mine)
    expect(out.defaults).toEqual({ material: "Melamina blanca", thickness: 19, backMaterial: "DM (fons)", backThickness: 10 })
    expect(out.boards.sheets).toEqual([{ material: "", w: 2440, h: 1220 }])
    expect(fixMaterialRefs(DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS)
  })
})

describe("tornar a un acabat d'abans", () => {
  const volc = DEFAULT_SETTINGS.materials.find((m) => m.finish.kind === "image" && /volcànica/i.test(m.name))!
  it("la foto i els mapes tornen en tornar a «Foto»", () => {
    const toColor = { ...volc, ...switchFinish(volc, { kind: "color", color: "#777777" }) }
    expect(toColor.finish.kind).toBe("color")
    expect(restoredFinish(toColor, "image")).toEqual(volc.finish)
    const back = { ...toColor, ...switchFinish(toColor, restoredFinish(toColor, "image")!) }
    expect(back.finish).toEqual(volc.finish)
    expect(restoredFinish(back, "color")).toEqual({ kind: "color", color: "#777777" })
  })
  it("un material de l'app que ja havia perdut la foto la recupera pel seu id", () => {
    const lost = { ...volc, finish: { kind: "color" as const, color: "#555555" }, previousFinishes: undefined }
    expect(restoredFinish(lost, "image")).toEqual(volc.finish)
  })
  it("un material propi sense foto d'abans no en té", () => {
    const mine = { ...volc, id: "mine", name: "Pedra meva", finish: { kind: "color" as const, color: "#555555" }, previousFinishes: undefined }
    expect(restoredFinish(mine, "image")).toBeUndefined()
  })
})

describe("mides de tauler del projecte en canviar el nom", () => {
  it("la clau segueix el nom nou", () => {
    const n = { sheetsByMaterial: { A: { w: 2800, h: 2070 }, B: { w: 2440, h: 1220 } } }
    expect(renameNestingSheets(n, "A", "C")).toEqual({ sheetsByMaterial: { B: { w: 2440, h: 1220 }, C: { w: 2800, h: 2070 } } })
    expect(renameNestingSheets(n, "A", "B")).toEqual({ sheetsByMaterial: { B: { w: 2440, h: 1220 } } })
    expect(renameNestingSheets(n, "X", "Y")).toBe(n)
    expect(renameNestingSheets(undefined, "A", "B")).toBeUndefined()
  })
})
