import { createContext } from "react"

/**
 * Aspecte d'un acordió (`FoldGroup` / `FoldItem`):
 * - `section`: inspectors, render, foto, exportar (icona + títol + insígnia + fletxa, sense fons ni marge).
 * - `gallery`: apartats de les galeries i de Materials (tancat amb vora, `.gallery-accordion`).
 * - `nested`: acordions de dins d'una galeria i categories del calaix de materials (`.inner-accordion`).
 * - `card`: elements d'una llista dins d'un formulari, amb vora i resum quan és tancat (taulells, forats).
 * - `row`: files d'una taula que es despleguen (eines de la màquina); la capçalera la dona qui el fa servir.
 */
export type FoldVariant = "section" | "gallery" | "nested" | "card" | "row"

/** Les seccions independents recorden si són obertes amb aquesta clau (sessionStorage). */
export const sectionKey = (id: string) => `mobles:section:${id}`

export interface FoldGroupState {
  variant: FoldVariant
  size: "sm" | "md"
}

/** El grup (un `Accordion.Root` compartit) que conté l'ítem; `null` = ítem sol (es fa el seu acordió). */
export const FoldContext = createContext<FoldGroupState | null>(null)

/** Variants que obren sense animar l'alçada (el contingut que arriba tard no es queda a alçada 0) i sense retallar. */
export const STATIC_VARIANTS: ReadonlySet<FoldVariant> = new Set(["section", "card", "row"])
