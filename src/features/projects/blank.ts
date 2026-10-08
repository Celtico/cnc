import type { Composition, CompositionKind } from "../../core/model"

/** Tipus que es poden triar a «Nou moble» (els punts de partida; no hi ha selector de tipus després). */
export type NewMobleKind = Extract<CompositionKind, "moble" | "cuina" | "armari" | "taula">

/** Nom per defecte d'un moble nou de cada tipus. */
export const NEW_MOBLE_NAMES: Record<NewMobleKind, string> = { moble: "Moble nou", cuina: "Cuina nova", armari: "Armari nou", taula: "Taula nova" }

/**
 * Moble en blanc del tipus triat a «Nou moble» (per decisió de l'usuari: «que no fiqui res»): cap mòdul ni peça. Es
 * comença amb el + de «Mòduls» de l'arbre (a la Taula, el tauler amb dos laterals de panell, `tableModule`).
 */
export function blankMoble(kind: NewMobleKind = "moble"): Composition {
  return { kind, modules: [], references: [] }
}

/** Objecte en blanc (botó «Nou objecte»): buit, es fa amb el + de «Peces lliures». */
export function blankObject(): Composition {
  return { kind: "objecte", modules: [], references: [], parts: [] }
}
