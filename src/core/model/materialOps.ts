import { DEFAULT_SETTINGS, isCncBoard, materialCategory, materialNameKey, type MaterialPref, type Settings } from "./settings"

/**
 * Operacions sobre els materials de Preferències que han de deixar les referències bé: canviar el nom, eliminar-ne un
 * (amb substitut) i restaurar. Els mobles i ambients desats es reescriuen a part (`renameMaterialRefs`, a Dexie amb
 * `renameMaterialEverywhere`); aquí, les preferències (materials per defecte i mides de tauler).
 */

// --- Llistes dels selectors -----------------------------------------------------------------

/** Cos, fronts, taulell i sòcol, tauler per defecte: només taulers de CNC i Corian (ni fons, ni metall/pedra/vidre, ni simulació). */
export function boardChoices(materials: readonly MaterialPref[]): MaterialPref[] {
  return materials.filter(isCncBoard)
}

/** Fons (del mòdul i per defecte) i mides de tauler: els que es tallen a la CNC (taulers i fons). */
export function backChoices(materials: readonly MaterialPref[]): MaterialPref[] {
  return materials.filter((m) => {
    return isCncBoard(m) || materialCategory(m) === "back"
  })
}

/**
 * Peces lliures: tot menys els fons. Els que no són de CNC (ferro, pedra, vidre) hi van a propòsit (surten a «Elements
 * sense nesting») i els de simulació serveixen per als objectes (coixins, fulles…).
 */
export function partChoices(materials: readonly MaterialPref[]): MaterialPref[] {
  return materials.filter((m) => materialCategory(m) !== "back")
}

// --- Noms -------------------------------------------------------------------------------------

/**
 * Error del nom nou d'un material (o `null` si va bé): buit o repetit (sense majúscules ni espais, `materialNameKey`)
 * amb un altre material. `self`: l'id del que es canvia.
 */
export function materialNameError(materials: readonly MaterialPref[], self: string, name: string): string | null {
  if (!name.trim()) return "Cal un nom."
  const k = materialNameKey(name)
  const other = materials.find((m) => m.id !== self && materialNameKey(m.name) === k)
  return other ? `Ja hi ha un material que es diu «${other.name}».` : null
}

/** Un nom que no tingui cap altre material: `base`, si no «base 2», «base 3»… (com l'esquema, `materialNameKey`). */
export function uniqueMaterialName(materials: readonly MaterialPref[], base: string): string {
  const taken = (n: string) => materialNameError(materials, "", n) !== null
  const b = tidyMaterialName(base) || "Material nou"
  if (!taken(b)) return b
  let n = 2
  while (taken(`${b} ${n}`)) n++
  return `${b} ${n}`
}

/**
 * Material de simulació fet amb un joc de textures (foto de color amb relleu i brillantor, p. ex. les d'un model de Poly
 * Haven): només es veu, no es talla. `finish` és l'acabat de foto ja fet (`withTextureSet`).
 */
export function pbrSetMaterial(id: string, name: string, finish: MaterialPref["finish"]): MaterialPref {
  return { id, name, thicknesses: [10], hasGrain: false, finish, edge: "", cnc: false, category: "sim" }
}

/** Nom net (sense espais als extrems ni repetits) per desar. */
export const tidyMaterialName = (name: string) => name.trim().replace(/\s+/g, " ")

/** Canvia el nom d'un material a les preferències i a les seves referències (per defecte, mides de tauler). */
export function renameMaterialInSettings(s: Settings, from: string, to: string): Settings {
  if (from === to) return s
  const r = (n: string) => (n === from ? to : n)
  return {
    ...s,
    materials: s.materials.map((m) => (m.name === from ? { ...m, name: to } : m)),
    defaults: { ...s.defaults, material: r(s.defaults.material), backMaterial: r(s.defaults.backMaterial) },
    boards: { ...s.boards, sheets: s.boards.sheets.map((x) => (x.material === from ? { ...x, material: to } : x)) },
  }
}

// --- Eliminar ---------------------------------------------------------------------------------

/** On el fan servir les preferències (en català, per al diàleg d'eliminar). */
export function materialSettingsUsage(s: Settings, name: string): { defaultBody: boolean; defaultBack: boolean; sheets: number } {
  return { defaultBody: s.defaults.material === name, defaultBack: s.defaults.backMaterial === name, sheets: s.boards.sheets.filter((x) => x.material === name).length }
}

/**
 * Treu el material `from`. Amb `to`, les referències de les preferències hi passen (com un canvi de nom); sense, les
 * mides de tauler d'aquest material es treuen (en queda almenys una, «Tots els altres») i els materials per defecte que
 * hi apuntaven tornen a un que existeixi (`fixMaterialRefs`).
 */
export function removeMaterialFromSettings(s: Settings, from: string, to: string | null): Settings {
  const materials = s.materials.filter((m) => m.name !== from)
  if (!materials.length) return s
  if (to && to !== from && materials.some((m) => m.name === to)) {
    const r = (n: string) => (n === from ? to : n)
    // Dues mides del mateix material: la primera mana (`sheetFor`), es deixen igual.
    return { ...s, materials, defaults: { ...s.defaults, material: r(s.defaults.material), backMaterial: r(s.defaults.backMaterial) }, boards: { ...s.boards, sheets: s.boards.sheets.map((x) => (x.material === from ? { ...x, material: to } : x)) } }
  }
  return fixMaterialRefs({ ...s, materials })
}

/**
 * Referències de les preferències a materials que ja no hi són (després d'eliminar o de «Restaurar valors inicials»):
 * el tauler i el fons per defecte passen als inicials (o al primer tauler / fons que hi hagi) i les mides de tauler
 * d'un material que no hi és es treuen (si no en queda cap, una de «Tots els altres» amb la mida de la primera).
 */
export function fixMaterialRefs(s: Settings): Settings {
  const names = new Set(s.materials.map((m) => m.name))
  const pick = (cur: string, initial: string, list: MaterialPref[]) => (names.has(cur) ? cur : names.has(initial) ? initial : (list[0]?.name ?? s.materials[0]!.name))
  const material = pick(s.defaults.material, DEFAULT_SETTINGS.defaults.material, boardChoices(s.materials))
  const backMaterial = pick(s.defaults.backMaterial, DEFAULT_SETTINGS.defaults.backMaterial, backChoices(s.materials).filter((m) => materialCategory(m) === "back"))
  const thicknessOf = (name: string, t: number) => {
    const list = s.materials.find((m) => m.name === name)?.thicknesses ?? []
    return !list.length || list.includes(t) ? t : list.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a))
  }
  const kept = s.boards.sheets.filter((x) => x.material === "" || names.has(x.material))
  const sheets = kept.length ? kept : [{ ...s.boards.sheets[0]!, material: "" }]
  const defaults = {
    material,
    thickness: material === s.defaults.material ? s.defaults.thickness : thicknessOf(material, s.defaults.thickness),
    backMaterial,
    backThickness: backMaterial === s.defaults.backMaterial ? s.defaults.backThickness : thicknessOf(backMaterial, s.defaults.backThickness),
  }
  const same = kept.length === s.boards.sheets.length && material === s.defaults.material && backMaterial === s.defaults.backMaterial
  return same ? s : { ...s, defaults, boards: { ...s.boards, sheets } }
}

/**
 * L'acabat a recuperar en tornar al tipus `kind`: el que el material tenia abans d'aquest tipus
 * (`previousFinishes`) o, per a una foto, la del material inicial de l'app amb el mateix id o nom
 * (els de Poly Haven: així es recuperen encara que s'haguessin perdut). `undefined` si no n'hi ha.
 */
export function restoredFinish(m: MaterialPref, kind: MaterialPref["finish"]["kind"]): MaterialPref["finish"] | undefined {
  const prev = m.previousFinishes?.[kind]
  if (prev && prev.kind === kind) return prev
  if (kind !== "image") return undefined
  const key = materialNameKey(m.name)
  const builtin = DEFAULT_SETTINGS.materials.find((x) => x.id === m.id) ?? DEFAULT_SETTINGS.materials.find((x) => materialNameKey(x.name) === key)
  return builtin?.finish.kind === "image" ? builtin.finish : undefined
}

/** Canvi d'acabat que guarda l'actual a `previousFinishes` (per poder-hi tornar). */
export function switchFinish(m: MaterialPref, next: MaterialPref["finish"]): Pick<MaterialPref, "finish" | "previousFinishes"> {
  // El que torna a ser l'actual surt de `previousFinishes`: si no, una foto (data URL) quedaria desada dues vegades.
  const prev: Record<string, MaterialPref["finish"]> = { ...(m.previousFinishes ?? {}) }
  if (next.kind !== m.finish.kind) prev[m.finish.kind] = m.finish
  delete prev[next.kind]
  return { finish: next, previousFinishes: Object.keys(prev).length ? prev : undefined }
}

/**
 * Les mides de tauler per material desades al projecte (`nesting.sheetsByMaterial`, clau = nom del material) quan un
 * material canvia de nom: la clau segueix el nom nou (si el nom nou ja en tenia, es queda la seva). Mateix objecte si
 * no canvia res.
 */
export function renameNestingSheets<T extends { sheetsByMaterial?: Record<string, unknown> } | undefined | null>(nesting: T, from: string, to: string): T {
  const by = nesting?.sheetsByMaterial
  if (!nesting || !by || !(from in by) || from === to) return nesting
  const { [from]: moved, ...rest } = by
  return { ...nesting, sheetsByMaterial: to in rest ? rest : { ...rest, [to]: moved } }
}
