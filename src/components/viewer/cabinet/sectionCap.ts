import { createContext } from "react"
import { BackSide, MeshBasicMaterial } from "three"

/** «Pinta la cara tallada» (Taulell): amb la secció, l'interior de cada peça es veu d'un color pla pel tall. */
export const SectionCapContext = createContext<{ axis: 0 | 1 | 2; pos: number } | null>(null)
/** Els mecanitzats (forats, ranures, Cabineo) buidats de debò a la peça, no pintats per sobre (editor i Ferratges, cel 2026-11-08). */
export const CarveContext = createContext(false)
/** El color de la cara tallada: les cares de darrere de les peces, que només es veuen pel tall. */
export const SECTION_CAP_MAT = new MeshBasicMaterial({ color: "#d9773b", side: BackSide })
