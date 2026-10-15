import { cncNestOptions } from "../export/maestroNestXcs"
import type { Machine, MachineTool, Panel } from "../model"
import type { NestOptions } from "./nest"

/** Nesting de debò: les opcions i d'on surten la separació i el marge. */
interface NestPlan {
  options: NestOptions
  /** La màquina d'on surten la separació i el marge (sense: els del projecte). */
  machine?: Machine
  /** La fresa que fixa la separació. */
  tool?: MachineTool
}

/**
 * Opcions del nesting que es fan servir de debò: amb màquina (la per defecte de Preferències › Màquines CNC), la
 * separació i el marge dels programes per tauler (`cncNestOptions`: Ø de la fresa de contorn més grossa dels gruixos
 * del moble + `spacingExtra`, marge `edgeTrim`); així la pantalla Nesting, el CSV de TopSolid i els .xcs per tauler
 * surten amb el mateix nesting. Sense màquina, el `kerf` i el `margin` del projecte (o de Preferències, els antics).
 * Taulers, taulers per material i veta són sempre els del projecte.
 */
export function nestPlan(panels: Panel[], base: NestOptions, machine: Machine | undefined): NestPlan {
  if (!machine) return { options: base }
  const plan = cncNestOptions(panels, machine, base)
  return { options: plan.options, machine, ...(plan.tool ? { tool: plan.tool } : {}) }
}
