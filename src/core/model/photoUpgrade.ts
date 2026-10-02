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

/**
 * Noms dels materials de l'usuari (els posa `settingsStore` en carregar les preferències). Sense (encara no
 * carregades, tests): els àlies de sempre.
 */
let knownNames: ReadonlySet<string> | null = null

/** Registra els noms de materials vigents de l'usuari (o `null` per tornar als àlies de sempre). */
export function setKnownMaterialNames(names: Iterable<string> | null): void {
  knownNames = names ? new Set(names) : null
}

/**
 * Nom vigent d'un material: un «X (foto)» (v6) passa a «X» si l'usuari no té cap material «X (foto)» (la v7 el
 * conserva si «X» ja era d'un altre material) i sí que té «X». Sense noms coneguts, el mapa de sempre.
 */
export function resolveMaterialAlias(name: string, names: ReadonlySet<string> | null = knownNames): string {
  const target = ALIASES.get(name)
  if (target === undefined) return name
  if (!names) return target
  return !names.has(name) && names.has(target) ? target : name
}

/** Acabat de foto (amb els mapes PBR) d'un joc. */
export function photoFinish(setId: string): MaterialPref["finish"] | undefined {
  const t = setById(setId)
  return t ? textureSetMaterial(t).finish : undefined
}

const usesSet = (m: MaterialPref, setId: string) => m.finish.kind === "image" && m.finish.src === textureSetFile(setId, "diff")

/**
 * Acabats per defecte d'abans de la v7 dels materials de `PHOTO_UPGRADES`: només es passen a la foto si encara
 * tenen aquest (un acabat retocat per l'usuari es queda, i el «(foto)» també, al costat).
 */
const OLD_FINISHES: Record<string, MaterialPref["finish"]> = {
  "Roure massís / xapat": { kind: "wood", species: "oak" },
  "Melamina roure": { kind: "wood", species: "oak" },
  "Revestiment de roure": { kind: "wood", species: "oak" },
  "Noguera xapada": { kind: "wood", species: "walnut" },
  "Parquet de roure": { kind: "wood", species: "oak" },
  "Microciment gris": { kind: "color", color: "#a7a39b" },
  Formigó: { kind: "color", color: "#9c9a95" },
  "Pedra calcària": { kind: "tiles", color: "#d9d2c4", grout: "#c9c1b2", size: 800 },
  "Pedra de paret": { kind: "tiles", color: "#b9a888", grout: "#8f8068", size: 350 },
  Jute: { kind: "fabric", color: "#b8a58a" },
  "Teixit gris": { kind: "fabric", color: "#8e8e8a" },
}

/** Igualtat estructural de dades JSON (ordre de claus indiferent). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/** Unió ordenada de gruixos. */
const mergeThicknesses = (a: number[], b: number[]) => [...new Set([...a, ...b])].sort((x, y) => x - y)

/**
 * v7: els materials de sempre agafen l'acabat de foto (només si encara tenen l'acabat per defecte d'abans) i els
 * «(foto)» desapareixen (si el seu joc ja el fa servir el de sempre, que n'hereta els gruixos) o es reanomenen.
 * Idempotent.
 */
export function upgradeToPhoto(list: MaterialPref[]): MaterialPref[] {
  const upgraded = list.map((m) => {
    const u = upgradeOf(m.name)
    const t = u && setById(u.set)
    if (!t || m.finish.kind === "image") return m
    const old = OLD_FINISHES[m.name]
    if (old && !deepEqual(m.finish, old)) return m
    const photo = textureSetMaterial(t)
    return { ...m, finish: photo.finish, ...(m.translucent === undefined && photo.translucent !== undefined ? { translucent: photo.translucent } : {}) }
  })
  const names = new Set(upgraded.map((m) => m.name))
  const out: MaterialPref[] = []
  const merged = new Map<string, number[]>()
  for (const m of upgraded) {
    const t = TEXTURE_SETS.find((x) => x.label === m.name)
    if (!t) {
      out.push(m)
      continue
    }
    const target = photoMaterialName(t)
    const owner = upgraded.find((x) => x.name === target)
    // El de sempre ja fa servir aquesta foto: el duplicat sobra (els seus gruixos passen al de sempre).
    if (owner && usesSet(owner, t.id)) {
      merged.set(target, mergeThicknesses(merged.get(target) ?? owner.thicknesses, m.thicknesses))
      continue
    }
    // Nom lliure: es reanomena; si un altre material (de l'usuari) ja el té, es queda amb «(foto)».
    if (!owner && !names.has(target)) {
      names.delete(m.name)
      names.add(target)
      out.push({ ...m, name: target })
    } else out.push(m)
  }
  if (!merged.size) return out
  return out.map((m) => {
    const th = merged.get(m.name)
    return th && th.length !== m.thicknesses.length ? { ...m, thicknesses: th } : m
  })
}

/**
 * v9: gruixos que la v7 va perdre en treure els «(foto)» de xapa (16 · 19 · 30) sense passar-los al de sempre.
 * Només als materials principals dels jocs de tauler que encara fan servir la seva foto. Idempotent.
 */
export function restorePhotoThicknesses(list: MaterialPref[]): MaterialPref[] {
  let changed = false
  const out = list.map((m) => {
    const u = PHOTO_UPGRADES.find((x) => x.names[0] === m.name)
    const t = u && setById(u.set)
    if (!t || t.use !== "board" || !usesSet(m, t.id)) return m
    const th = mergeThicknesses(m.thicknesses, textureSetMaterial(t).thicknesses)
    if (th.length === m.thicknesses.length) return m
    changed = true
    return { ...m, thicknesses: th }
  })
  return changed ? out : list
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

// `frame`: perfils de les obertures de les parets (`Opening.frame`).
const isRefKey = (k: string) => k === "material" || k === "material2" || k === "frame" || /Material$/.test(k)

/**
 * Canvia els noms antics de material («… (foto)») pels vigents a qualsevol dada (composició, ambient):
 * claus `material`, `material2`, `frame`, `…Material` i `scene.floor` / `scene.wall`. Torna el mateix objecte si
 * no hi ha res a canviar. `names`: materials de l'usuari (sense, els registrats; vegeu `resolveMaterialAlias`).
 */
export function aliasMaterialRefs<T>(value: T, names: ReadonlySet<string> | null = knownNames): T {
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
      const y = typeof x === "string" ? (isRefKey(k) || (scene && (k === "floor" || k === "wall")) ? resolveMaterialAlias(x, names) : x) : walk(x, k === "scene")
      if (y !== x) (out ??= { ...(v as Record<string, unknown>) })[k] = y
    }
    return out ?? v
  }
  return walk(value, false) as T
}
