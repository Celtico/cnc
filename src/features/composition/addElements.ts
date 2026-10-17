import { boardChoices, compositionKind, materialCategory, materialByName, newFreePart, newId, partsOnlyKind, type Composition, type FreePart, type PartOrient, type RefObject, type RefPreset, type Settings } from "../../core/model"

/** Què es pot afegir des de l'arbre (un + per a cada tipus). */
export type AddKind = "module" | "part" | "ref"

const ADD_KINDS: { id: AddKind; label: string; noun: string }[] = [
  { id: "module", label: "Mòdul", noun: "Mòdul" },
  { id: "part", label: "Peça", noun: "Peça" },
  { id: "ref", label: "Objecte", noun: "Objecte" },
]

/** Nom per defecte del següent element d'aquest tipus («Mòdul 3», «Peça 2», «Objecte 1»), sense repetir-ne cap. */
export function defaultElementName(comp: Composition, kind: AddKind): string {
  const list: { name: string }[] = kind === "module" ? comp.modules : kind === "part" ? (comp.parts ?? []) : comp.references
  const used = new Set(list.map((x) => x.name))
  const noun = ADD_KINDS.find((k) => k.id === kind)!.noun
  // El següent número lliure (amb «Mòdul 1» i «Mòdul 3», «Mòdul 4»: no en repeteix cap).
  let n = list.length + 1
  while (used.has(`${noun} ${n}`)) n++
  return `${noun} ${n}`
}

/**
 * Peça lliure nova: el material i el gruix de l'última peça (o del primer mòdul); als objectes, microciment i fora del
 * nesting; si el material no és a Preferències, el tauler per defecte dels mòduls nous (no el primer de la llista: els
 * materials nous s'hi afegeixen al davant).
 */
export function freePartFor(comp: Composition, settings: Settings, orient: PartOrient, center: { x: number; y: number; z: number }, name: string): FreePart {
  const base = comp.modules[0]?.carcass
  const last = comp.parts?.at(-1)
  const object = compositionKind(comp) === "objecte"
  const loose = partsOnlyKind(compositionKind(comp))
  const p = { ...newFreePart(orient, center, last?.material ?? (loose ? (object ? "Microciment gris" : undefined) : base?.material), last?.thickness ?? (loose ? undefined : base?.thickness)), name }
  const known = materialByName(settings, p.material)
  return known
    ? { ...p, ...(materialCategory(known) === "sim" || object ? { nest: false } : {}) }
    : { ...p, material: fallbackMaterial(settings) ?? p.material, ...(object ? { nest: false } : {}) }
}

/** Tauler per defecte de Preferències (si hi és) o, si no, el primer tauler de CNC. */
function fallbackMaterial(settings: Settings): string | undefined {
  return materialByName(settings, settings.defaults.material)?.name ?? boardChoices(settings.materials)[0]?.name
}

/** Objecte de referència nou (una caixa de 600 × 600 × 100, o les mides d'un de Preferències). */
export function refFor(o: Omit<RefObject, "id" | "x" | "y" | "z"> & Partial<Pick<RefObject, "x" | "y" | "z">>): RefObject {
  return { id: newId("r"), x: 0, y: 0, z: 0, ...o }
}

/**
 * Objecte de referència d'un de Preferències (+ d'«Objectes de referència»): les seves mides; un de paret (cara del
 * davant w × h) a la seva distància de la paret, un de terra (rajola) estirat a terra. Sense fondària (A4, rajola),
 * 5 mm. El nom, el de Preferències (amb un número si ja n'hi ha un d'igual).
 */
export function refFromPreset(comp: Composition, p: RefPreset): RefObject {
  const used = new Set(comp.references.map((r) => r.name))
  let name = p.name
  for (let n = 2; used.has(name); n++) name = `${p.name} ${n}`
  const thin = p.d ?? 5
  return p.plane === "floor"
    ? refFor({ name, w: p.w, h: thin, d: p.h, onFloor: true })
    : refFor({ name, w: p.w, h: p.h, d: thin, z: p.wallOffset, ...(p.wallOffset === 0 ? { onWall: true } : {}) })
}

/** Què cal per pujar un model 3D (+ de «Models 3D»): format, extensió, mida, unitats i on trobar-ne. */
export const MODEL_FORMAT_HELP: [string, string][] = [
  ["Format", ".glb (amb les textures a dins), .gltf amb el .bin i la carpeta de textures (tria'ls tots, la carpeta o el .zip) o .fbx. Es desa com a .glb."],
  ["Poly Haven", "el .zip tal com es baixa, en qualsevol format. El .blend no es pot llegir al navegador: l'app baixa el mateix model en glTF de Poly Haven (cal connexió) i aprofita les textures del zip."],
  ["No serveixen", ".obj, .stl, .dae, .skp ni .3ds. Obre'ls a Blender i exporta'ls amb Fitxer › Exportar › glTF 2.0, «glTF Binary (.glb)»."],
  ["Mida", "millor de menys de 15 MB. En pujar-lo, l'app el redueix per al mòbil (fins a 100.000 triangles, textures de 1024 px)."],
  ["Unitats", "metres (com tots els glTF). Després pots canviar-ne les mides a l'inspector."],
  ["Textures", "color, relleu (normal) i brillantor; la transparència (fulles) també. En acabar, les pots afegir a Materials."],
  ["On trobar-ne", "Poly Haven (gratuïts, CC0), Sketchfab (baixa'l com a «glTF Binary») o els catàlegs 3D dels fabricants."],
]

/**
 * Un objecte que talla nou (+ d'«Objectes de referència» › Forma lliure / Relleu d'imatge; per decisió de l'usuari,
 * 2026-10-17: «on és l'eina de formes»): damunt de la peça estirada triada (o de la primera), amb la part de dalt per
 * sobre de la cara perquè hi entri: la forma lliure, 20 mm de fons; el relleu, `depth` mm.
 */
export function cutterOver(comp: Composition, partId: string | undefined, extra: Pick<RefObject, "name"> & Partial<RefObject>, depth: number, boxH: number): RefObject {
  const parts = comp.parts ?? []
  const p = parts.find((x) => x.id === partId && x.orient === "flat") ?? parts.find((x) => x.orient === "flat" && x.effect !== "cut")
  const used = new Set(comp.references.map((r) => r.name))
  let name = extra.name
  for (let n = 2; used.has(name); n++) name = `${extra.name} ${n}`
  if (!p) return refFor({ w: 300, h: boxH, d: 200, effect: "cut", ...extra, name })
  const top = p.y + p.thickness
  const w = Math.round(p.w * 0.6), d = Math.round(p.h * 0.6)
  return refFor({ w, h: boxH, d, effect: "cut", ...extra, name, x: Math.round(p.x + (p.w - w) / 2), y: top - depth, z: Math.round(p.z + (p.h - d) / 2) })
}
