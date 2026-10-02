import type { MaterialPref } from "./settings"
import { PREVIOUS_TILE_MM, TEXTURE_SETS, textureSetFile, textureSetMaterial, type TextureSet } from "./textureSets"

/**
 * Materials de sempre amb l'acabat de foto (Poly Haven, v7). Els noms no canvien (el CSV del taller, les
 * composicions i els ambients els fan servir): només l'acabat procedural passa a ser el joc PBR.
 *
 * Només hi ha els jocs que s'hi assemblen de debò (mirats a `public/textures/<id>/diff.jpg`). Lacats, colors
 * llisos, metalls, vidres i el que no té cap foto fidel (freixe, wengué, estucs clars, teixits de color…) es
 * queden com eren. El primer nom de cada joc és el principal: el material «(foto)» que es treu hi apunta.
 */
export const PHOTO_UPGRADES: { set: string; names: string[] }[] = [
  { set: "oak_veneer_01", names: ["Roure massís / xapat", "Melamina roure", "Revestiment de roure"] },
  { set: "walnut_veneer_02", names: ["Noguera xapada"] },
  { set: "wood_floor", names: ["Parquet de roure"] },
  { set: "gravel_concrete_03", names: ["Microciment gris"] },
  { set: "concrete_layers_02", names: ["Formigó"] },
  { set: "marble_01", names: ["Pedra calcària"] },
  { set: "medieval_blocks_03", names: ["Pedra de paret"] },
  { set: "hessian_230", names: ["Jute"] },
  { set: "poly_wool_herringbone", names: ["Teixit gris"] },
]

/** El mateix per a la biblioteca de materials (Preferències › Materials › Afegir). */
export const LIBRARY_PHOTO_UPGRADES: Record<string, string> = {
  "Roure natural": "oak_veneer_01",
  Noguera: "walnut_veneer_02",
  "Parquet de roure": "wood_floor",
  Microciment: "gravel_concrete_03",
  "Llana gris": "poly_wool_herringbone",
}

const SUFFIX = " (foto)"
const setById = (id: string) => TEXTURE_SETS.find((t) => t.id === id)
const upgradeOf = (name: string) => PHOTO_UPGRADES.find((u) => u.names.includes(name))

/** Nom que pren el material «(foto)» d'un joc: el material de sempre que el fa servir o l'etiqueta sense «(foto)». */
export function photoMaterialName(t: TextureSet): string {
  return PHOTO_UPGRADES.find((u) => u.set === t.id)?.names[0] ?? (t.label.endsWith(SUFFIX) ? t.label.slice(0, -SUFFIX.length) : t.label)
}

const ALIASES = new Map(TEXTURE_SETS.filter((t) => photoMaterialName(t) !== t.label).map((t) => [t.label, photoMaterialName(t)]))

/** Nom vigent d'un material: els «… (foto)» (v6) passen al nom nou; la resta, igual. */
export function resolveMaterialAlias(name: string): string {
  return ALIASES.get(name) ?? name
}

/** Acabat de foto (amb els mapes PBR) d'un joc. */
export function photoFinish(setId: string): MaterialPref["finish"] | undefined {
  const t = setById(setId)
  return t ? textureSetMaterial(t).finish : undefined
}

const usesSet = (m: MaterialPref, setId: string) => m.finish.kind === "image" && m.finish.src === textureSetFile(setId, "diff")

/**
 * v7: els materials de sempre agafen l'acabat de foto (si no en tenen ja una d'imatge, pròpia o no) i els
 * «(foto)» desapareixen (si el seu joc ja el fa servir el de sempre) o es reanomenen. Idempotent.
 */
export function upgradeToPhoto(list: MaterialPref[]): MaterialPref[] {
  const upgraded = list.map((m) => {
    const u = upgradeOf(m.name)
    const t = u && setById(u.set)
    if (!t || m.finish.kind === "image") return m
    const photo = textureSetMaterial(t)
    return { ...m, finish: photo.finish, ...(m.translucent === undefined && photo.translucent !== undefined ? { translucent: photo.translucent } : {}) }
  })
  const names = new Set(upgraded.map((m) => m.name))
  const out: MaterialPref[] = []
  for (const m of upgraded) {
    const t = TEXTURE_SETS.find((x) => x.label === m.name)
    if (!t) {
      out.push(m)
      continue
    }
    const target = photoMaterialName(t)
    const owner = upgraded.find((x) => x.name === target)
    // El de sempre ja fa servir aquesta foto: el duplicat sobra.
    if (owner && usesSet(owner, t.id)) continue
    // Nom lliure: es reanomena; si un altre material (de l'usuari) ja el té, es queda amb «(foto)».
    if (!owner && !names.has(target)) {
      names.delete(m.name)
      names.add(target)
      out.push({ ...m, name: target })
    } else out.push(m)
  }
  return out
}

/**
 * v8: mida de repetició nova dels jocs que l'han canviada (`PREVIOUS_TILE_MM`), només als materials que encara fan
 * servir aquell joc amb la mida d'abans (una mida posada per l'usuari no es toca). Idempotent.
 */
export function rescalePhotoTiles(list: MaterialPref[]): MaterialPref[] {
  let changed = false
  const out = list.map((m) => {
    if (m.finish.kind !== "image") return m
    for (const [id, old] of Object.entries(PREVIOUS_TILE_MM)) {
      const t = setById(id)
      if (!t || m.finish.src !== textureSetFile(id, "diff") || m.finish.tileMm !== old) continue
      changed = true
      return { ...m, finish: { ...m.finish, tileMm: t.tileMm } }
    }
    return m
  })
  return changed ? out : list
}

const isRefKey = (k: string) => k === "material" || k === "material2" || /Material$/.test(k)

/**
 * Canvia els noms antics de material («… (foto)») pels vigents a qualsevol dada (composició, ambient):
 * claus `material`, `material2`, `…Material` i `scene.floor` / `scene.wall`. Torna el mateix objecte si no hi
 * ha res a canviar.
 */
export function aliasMaterialRefs<T>(value: T): T {
  const walk = (v: unknown, scene: boolean): unknown => {
    if (Array.isArray(v)) {
      let changed = false
      const out = v.map((x) => {
        const y = walk(x, false)
        if (y !== x) changed = true
        return y
      })
      return changed ? out : v
    }
    if (typeof v !== "object" || v === null) return v
    let out: Record<string, unknown> | null = null
    for (const [k, x] of Object.entries(v)) {
      const y = typeof x === "string" ? (isRefKey(k) || (scene && (k === "floor" || k === "wall")) ? resolveMaterialAlias(x) : x) : walk(x, k === "scene")
      if (y !== x) (out ??= { ...(v as Record<string, unknown>) })[k] = y
    }
    return out ?? v
  }
  return walk(value, false) as T
}
