import { materialCategory, type MaterialCategory, type MaterialPref } from "./settingsSchema"

/**
 * Subfamílies dels materials (per decisió de l'usuari, 2026-10-20: «a material ficar subfamílies, ara surt una llista
 * molt gran»): dins de cada categoria, un segon nivell perquè sigui fàcil trobar-los (Preferències › Materials i el
 * `MaterialSelect`). Es dedueixen del nom i de l'acabat (`autoMaterialFamily`); un material en pot portar una de triada
 * (`MaterialPref.family`, Preferències › Materials › Subfamília). Els Fons no en tenen (són pocs). Dades pures.
 */
interface MaterialFamily {
  id: string
  label: string
}

/** La subfamília que fa de calaix de sastre: el que no encaixa enlloc (un conjunt de textures amb un nom estrany…). */
const OTHER = "other"

export const MATERIAL_FAMILIES: Record<MaterialCategory, MaterialFamily[]> = {
  board: [
    { id: "melamine", label: "Melamines" },
    { id: "lacquer", label: "Lacats" },
    { id: "wood", label: "Fustes i xapes" },
    { id: OTHER, label: "Altres" },
  ],
  back: [],
  // Per to: la carta en té 93 i es busca pel color («un blanc», «un gris fosc»).
  corian: [
    { id: "white", label: "Blancs" },
    { id: "beige", label: "Crema i beix" },
    { id: "gray", label: "Grisos" },
    { id: "brown", label: "Marrons" },
    { id: "dark", label: "Foscos i negres" },
    { id: "color", label: "Colors" },
  ],
  sim: [
    { id: "metal", label: "Metalls" },
    { id: "glass", label: "Vidres i miralls" },
    { id: "stone", label: "Pedra i marbre" },
    { id: "floor", label: "Parquets i rajoles" },
    { id: "wall", label: "Parets i revestiments" },
    { id: "fabric", label: "Teixits, cuir i catifes" },
    { id: "plant", label: "Plantes i jardí" },
    { id: "appliance", label: "Electrodomèstics" },
    { id: "light", label: "Llums" },
    { id: "object", label: "Objectes i ceràmica" },
    { id: OTHER, label: "Altres" },
  ],
}

/** Regles per nom (la primera que hi encaixa mana), abans que l'acabat: «Pedra de paret» és pedra, no paret. */
const SIM_RULES: [RegExp, string][] = [
  [/electrodom/i, "appliance"],
  [/bombeta|tira led|pantalla de lli|làmpada|llum/i, "light"],
  [/mirall|vidre/i, "glass"],
  [/ferro|acer|inox|llautó|alumini|coure|metall|crom/i, "metal"],
  [/parquet|rajola|porcellànic|tarima/i, "floor"],
  [/pedra|marbre|travertí|granit|terratzo|mur /i, "stone"],
  [/pintura|estuc|formigó|microciment|revestiment|fusta rentada|guix/i, "wall"],
  [/teixit|vellut|lli |^lli$|bouclé|tul|cuir|jute|catifa|llana|vaquer/i, "fabric"],
  [/fulles|escorça|terra de test|gespa|planta/i, "plant"],
  [/ceràmica|llibres|llenç|pantalla/i, "object"],
]

/** Si l'acabat ja ho diu (un conjunt de textures nou, un material retocat amb un nom propi). */
const SIM_BY_FINISH: Partial<Record<MaterialPref["finish"]["kind"], string>> = { metal: "metal", glass: "glass", stone: "stone", tiles: "floor", fabric: "fabric", wood: "floor" }

function hexRgb(hex: string | undefined): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "")
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** To d'un color (els Corian): clar, crema, gris, marró, fosc o de color. */
export function colorTone(hex: string | undefined): string {
  const rgb = hexRgb(hex)
  if (!rgb) return OTHER
  const [r, g, b] = rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const light = (max + min) / 2
  let hue = 0
  if (chroma > 0) hue = max === r ? (((g - b) / chroma) % 6) * 60 : max === g ? ((b - r) / chroma + 2) * 60 : ((r - g) / chroma + 4) * 60
  if (hue < 0) hue += 360
  // Els tons de terra (vermellosos i groguencs) són beixos i marrons; la resta amb prou color, colors.
  const earthy = hue < 60 || hue >= 345
  if (chroma > 0.3 || (chroma > 0.1 && !earthy)) return "color"
  if (light < 0.3) return "dark"
  if (light > 0.88) return "white"
  if (chroma <= 0.07) return "gray"
  return light >= 0.6 ? "beige" : "brown"
}

/** El color que es veu (per al to): el de l'acabat o, la fusta, cap. */
function finishColor(f: MaterialPref["finish"]): string | undefined {
  return "color" in f && typeof f.color === "string" ? f.color : undefined
}

/** La subfamília deduïda (sense la triada); `null` a les categories que no en tenen. */
export function autoMaterialFamily(m: MaterialPref): string | null {
  const cat = materialCategory(m)
  const name = m.name
  switch (cat) {
    case "back":
      return null
    case "board":
      if (/melamina/i.test(name)) return "melamine"
      if (/lacat/i.test(name) || m.finish.kind === "lacquer") return "lacquer"
      if (/roure|noguera|freixe|fusta|xapa|pi\b|faig|cirerer|wengué|teca|contraxapat/i.test(name) || m.finish.kind === "wood" || m.hasGrain) return "wood"
      return OTHER
    case "corian":
      return colorTone(finishColor(m.finish))
    case "sim": {
      if (m.glow) return "light"
      const rule = SIM_RULES.find(([re]) => re.test(name))
      return rule?.[1] ?? SIM_BY_FINISH[m.finish.kind] ?? OTHER
    }
  }
}

/** La subfamília del material: la triada (si encara és de la seva categoria) o la deduïda. */
export function materialFamily(m: MaterialPref): string | null {
  const list = MATERIAL_FAMILIES[materialCategory(m)]
  if (!list.length) return null
  if (m.family && list.some((f) => f.id === m.family)) return m.family
  return autoMaterialFamily(m)
}

/**
 * Els materials d'una categoria per subfamília, en l'ordre de `MATERIAL_FAMILIES` i només les que en tenen. Sense
 * subfamílies (els Fons) o si totes cauen en una sola, una llista buida: es mostren plans.
 */
export function familyGroups<T extends MaterialPref>(category: MaterialCategory, list: T[]): { id: string; label: string; items: T[] }[] {
  const groups = MATERIAL_FAMILIES[category].map((f) => ({ ...f, items: list.filter((m) => materialFamily(m) === f.id) })).filter((g) => g.items.length)
  return groups.length > 1 ? groups : []
}
