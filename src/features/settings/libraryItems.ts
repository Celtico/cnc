import { LIBRARY_PHOTO_UPGRADES, PHOTO_MATERIALS, TEXTURE_SETS, WOOD_PRESETS, photoFinish, photoMaterialName, type MaterialPref } from "../../core/model"
import { WOOD_EXTRA_PRESETS } from "./woodPresets"

/**
 * Biblioteca de materials fets (com la de SketchUp o de l'IKEA): en afegir-ne un, es tria de la
 * graella i ja està; «Editar la textura» serveix per retocar-lo. Cada un porta la categoria, els
 * gruixos i el cantell habituals.
 */
export type LibraryItem = Omit<MaterialPref, "id"> & { group: string }

const board = (name: string, finish: MaterialPref["finish"], edge: string, hasGrain = true): LibraryItem => ({ group: "Fusta i taulers", name, finish, thicknesses: [16, 19], hasGrain, edge, category: "board" })
const hard = (group: string, name: string, finish: MaterialPref["finish"], thicknesses = [10, 20, 30]): LibraryItem => ({ group, name, finish, thicknesses, hasGrain: false, edge: "", cnc: false, category: "hard" })
const sim = (group: string, name: string, finish: MaterialPref["finish"]): LibraryItem => ({ group, name, finish, thicknesses: [10], hasGrain: false, edge: "", cnc: false, category: "sim" })
const extra = (n: string) => WOOD_EXTRA_PRESETS.find((p) => p.name === n)!.gen

const CLASSIC_LIBRARY: LibraryItem[] = [
  board("Roure natural", { kind: "wood", species: "oak", gen: { ...WOOD_PRESETS.oak } }, "Xapa de roure"),
  board("Roure fumat", { kind: "wood", species: "oak", gen: extra("Roure fumat") }, "Xapa de roure fumat"),
  board("Roure blanquejat", { kind: "wood", species: "oak", gen: extra("Roure blanquejat") }, "Xapa de roure"),
  board("Noguera", { kind: "wood", species: "walnut", gen: { ...WOOD_PRESETS.walnut } }, "Xapa de noguera"),
  board("Freixe", { kind: "wood", species: "ash", gen: { ...WOOD_PRESETS.ash } }, "Xapa de freixe"),
  board("Cirerer", { kind: "wood", species: "oak", gen: extra("Cirerer") }, "Xapa de cirerer"),
  board("Wengué", { kind: "wood", species: "walnut", gen: extra("Wengué") }, "Xapa de wengué"),
  board("Pi", { kind: "wood", species: "ash", gen: extra("Pi") }, "Cantell de pi"),
  board("Faig", { kind: "wood", species: "oak", gen: extra("Faig") }, "Xapa de faig"),
  board("Lacat blanc mat", { kind: "lacquer", color: "#f1efea", roughness: 0.6 }, "Lacat (sense cantell)", false),
  board("Lacat negre brillant", { kind: "lacquer", color: "#1e1e20", roughness: 0.15 }, "Lacat (sense cantell)", false),
  board("Lacat verd sàlvia", { kind: "lacquer", color: "#a7b39c", roughness: 0.5 }, "Lacat (sense cantell)", false),
  board("Melamina antracita", { kind: "color", color: "#3d3f42" }, "PVC antracita 1 mm", false),
  hard("Pedra", "Marbre blanc", { kind: "stone", color: "#eeebe6", vein: "#9a968f", veins: 0.55, size: 1400, seed: 21, style: "marble", polish: 0.85 }, [20, 30]),
  hard("Pedra", "Marbre negre", { kind: "stone", color: "#1e1e20", vein: "#d8d4cc", veins: 0.45, size: 1400, seed: 33, style: "marble", polish: 0.9 }, [20, 30]),
  hard("Pedra", "Granit gris", { kind: "stone", color: "#9d9b98", vein: "#e2e0dc", veins: 0.5, size: 600, seed: 5, style: "granite", grain: 0.6, polish: 0.8 }, [20, 30]),
  hard("Pedra", "Travertí", { kind: "stone", color: "#d8cbb5", vein: "#bfae93", veins: 0.5, size: 1200, seed: 9, style: "travertine", grain: 0.5, polish: 0.4 }, [20, 30]),
  hard("Pedra", "Formigó polit", { kind: "stone", color: "#a9a7a2", vein: "#8f8d88", veins: 0.4, size: 2000, seed: 12, style: "concrete", grain: 0.4, polish: 0.5 }, [20, 30, 40]),
  hard("Metall", "Inox raspallat", { kind: "metal", color: "#c3c7cb", surface: "brushed", roughness: 0.35, strength: 0.5 }, [3, 5, 10]),
  hard("Metall", "Alumini anoditzat", { kind: "metal", color: "#d4d6d8", roughness: 0.45 }, [3, 5, 10]),
  hard("Metall", "Ferro negre", { kind: "metal", color: "#3b3b3d", roughness: 0.55 }, [3, 5, 10]),
  hard("Metall", "Llautó polit", { kind: "metal", color: "#b8954a", roughness: 0.2 }, [3, 5, 10]),
  hard("Metall", "Coure martellejat", { kind: "metal", color: "#b87350", surface: "hammered", roughness: 0.3, strength: 0.6 }, [3, 5]),
  hard("Vidre", "Vidre transparent", { kind: "glass", color: "#dbe7e8", opacity: 0.2 }, [4, 6, 8, 10]),
  hard("Vidre", "Vidre glaçat", { kind: "glass", color: "#eef3f3", opacity: 0.55, frost: 0.8 }, [4, 6, 8]),
  hard("Vidre", "Vidre fumat", { kind: "glass", color: "#5e5a55", opacity: 0.5 }, [4, 6, 8]),
  sim("Teixits", "Lli natural", { kind: "fabric", color: "#d9cfbf", slub: 0.6 }),
  sim("Teixits", "Vellut blau", { kind: "fabric", color: "#2c3a5a", threads: 160 }),
  sim("Teixits", "Llana gris", { kind: "fabric", color: "#8f8c87", threads: 48, slub: 0.4 }),
  sim("Terres i parets", "Rajola hidràulica blanca", { kind: "tiles", color: "#efece6", grout: "#cfcac0", size: 200, joint: 2 }),
  sim("Terres i parets", "Rajola metro", { kind: "tiles", color: "#f4f3ef", grout: "#d6d3cc", size: 150, joint: 2, layout: "brick" }),
  sim("Terres i parets", "Terracota", { kind: "tiles", color: "#b86e4b", grout: "#d8c7b3", size: 300, joint: 6, variation: 0.15 }),
  sim("Terres i parets", "Parquet de roure", { kind: "wood", species: "oak", gen: { ...WOOD_PRESETS.oak } }),
  sim("Terres i parets", "Microciment", { kind: "stone", color: "#b3aea5", vein: "#9d978d", veins: 0.3, size: 2500, seed: 4, style: "concrete", grain: 0.2, polish: 0.3 }),
  sim("Terres i parets", "Pintura blanca", { kind: "color", color: "#f3f1ec" }),
]

// Els de sempre amb la foto de Poly Haven (v7, com els materials inicials): l'acabat procedural fora.
const UPGRADED = CLASSIC_LIBRARY.map((m): LibraryItem => {
  const set = LIBRARY_PHOTO_UPGRADES[m.name]
  const finish = set ? photoFinish(set) : undefined
  return finish ? { ...m, finish } : m
})
const usedSets = new Set(Object.values(LIBRARY_PHOTO_UPGRADES))

export const MATERIAL_LIBRARY: LibraryItem[] = [
  ...UPGRADED,
  // La resta de fotos amb relleu i rugositat (Poly Haven, CC0), amb el nom dels materials inicials (sense «(foto)»).
  ...PHOTO_MATERIALS.flatMap(({ id: _id, ...m }, i): LibraryItem[] => {
    const t = TEXTURE_SETS[i]!
    if (usedSets.has(t.id)) return []
    const name = photoMaterialName(t)
    if (UPGRADED.some((x) => x.name === name)) return []
    return [{ ...m, name, group: t.use === "board" ? "Fotos · fusta" : t.translucent !== undefined || /Teixit|Llana|Jute/.test(t.label) ? "Fotos · teixits" : "Fotos · pedra, terres i parets" }]
  }),
]
