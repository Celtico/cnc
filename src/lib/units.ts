import { createContext, useContext } from "react"
import { roundTo } from "./format"

/**
 * Unitat de les mides a la pantalla (mm o cm). Internament tot és en mm: els camps
 * numèrics converteixen en mostrar i en escriure.
 */
type Unit = "mm" | "cm"

export const UnitContext = createContext<Unit>("mm")

export function useUnit(): Unit {
  return useContext(UnitContext)
}

/** Text d'una mida en mm segons la unitat triada: "1.850 mm" o "185 cm". */
export function formatLength(mm: number, unit: Unit): string {
  if (unit === "cm") return `${trim(mm / 10)} cm`
  return `${trim(mm)} mm`
}

const trim = (v: number): string => roundTo(v, 2).toLocaleString("ca-ES", { maximumFractionDigits: 2 })
