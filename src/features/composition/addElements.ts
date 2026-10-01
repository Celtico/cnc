import { compositionKind, materialByName, newFreePart, newId, partsOnlyKind, type Composition, type FreePart, type PartOrient, type RefObject, type Settings } from "../../core/model"

/** Què es pot afegir des de l'arbre (un + per a cada tipus). */
export type AddKind = "module" | "part" | "ref"

export const ADD_KINDS: { id: AddKind; label: string; noun: string }[] = [
  { id: "module", label: "Mòdul", noun: "Mòdul" },
  { id: "part", label: "Peça", noun: "Peça" },
  { id: "ref", label: "Objecte", noun: "Objecte" },
]

/** Nom per defecte del següent element d'aquest tipus («Mòdul 3», «Peça 2», «Objecte 1»). */
export function defaultElementName(comp: Composition, kind: AddKind): string {
  const n = kind === "module" ? comp.modules.length : kind === "part" ? (comp.parts ?? []).length : comp.references.length
  return `${ADD_KINDS.find((k) => k.id === kind)!.noun} ${n + 1}`
}

/**
 * Peça lliure nova: el material i el gruix de l'última peça (o del primer mòdul); als objectes, microciment i fora del
 * nesting; si el material no és a Preferències, el primer tauler de la llista.
 */
export function freePartFor(comp: Composition, settings: Settings, orient: PartOrient, center: { x: number; y: number; z: number }, name: string): FreePart {
  const base = comp.modules[0]?.carcass
  const last = comp.parts?.at(-1)
  const object = compositionKind(comp) === "objecte"
  const loose = partsOnlyKind(compositionKind(comp))
  const p = { ...newFreePart(orient, center, last?.material ?? (loose ? (object ? "Microciment gris" : undefined) : base?.material), last?.thickness ?? (loose ? undefined : base?.thickness)), name }
  const known = materialByName(settings, p.material)
  return known
    ? { ...p, ...(known.cnc === false || object ? { nest: false } : {}) }
    : { ...p, material: settings.materials.find((m) => !m.forBacks && m.cnc !== false)?.name ?? p.material, ...(object ? { nest: false } : {}) }
}

/** Objecte de referència nou (una caixa de 600 × 600 × 100, o les mides d'un de Preferències). */
export function refFor(o: Omit<RefObject, "id" | "x" | "y" | "z"> & Partial<Pick<RefObject, "x" | "y" | "z">>): RefObject {
  return { id: newId("r"), x: 0, y: 0, z: 0, ...o }
}
