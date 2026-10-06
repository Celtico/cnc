import { applySettingsToModule, defaultModule, newId, tableModule, type Composition, type CompositionKind, type Settings } from "../../core/model"

/** Tipus que es poden triar a «Nou moble» (els punts de partida; no hi ha selector de tipus després). */
export type NewMobleKind = Extract<CompositionKind, "moble" | "cuina" | "armari" | "taula">

/** Nom per defecte d'un moble nou de cada tipus. */
export const NEW_MOBLE_NAMES: Record<NewMobleKind, string> = { moble: "Moble nou", cuina: "Cuina nova", armari: "Armari nou", taula: "Taula nova" }

/**
 * Moble en blanc del tipus triat a «Nou moble»: un mòdul amb els valors de les preferències (a la Taula, el tauler amb
 * dos laterals de panell, com «Afegir mòdul» d'una taula).
 */
export function blankMoble(settings: Settings, kind: NewMobleKind = "moble"): Composition {
  const id = newId("m")
  const module = kind === "taula" ? tableModule(id, "Mòdul 1") : defaultModule(id, "Mòdul 1")
  return { kind, modules: [applySettingsToModule(settings, module)], references: [] }
}

/** Objecte en blanc: una peça de 600 × 600 × 600 de material de simulació (botó «Nou objecte»). */
export function blankObject(): Composition {
  return {
    kind: "objecte",
    modules: [defaultModule(newId("m"), "Mòdul 1")],
    references: [],
    parts: [{ id: newId("p"), name: "Peça", orient: "flat", material: "Microciment gris", w: 600, h: 600, thickness: 600, x: 0, y: 0, z: 0, nest: false }],
  }
}
