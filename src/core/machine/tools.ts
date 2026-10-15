import { isPlaceholderTool, type Machine, type MachineTool } from "../model/machine"

/**
 * Tria d'eines per a l'export a Maestro. Només eines «automàtiques» (`auto`: no els exemples de
 * SCM ni els palpadors) i muntades a la màquina (`mounted`, de l'.atrx).
 *  - Broques: diàmetre exacte (± 0,1 mm), orientació (vertical a la cara, horitzontal als
 *    cantells) i fondària ≤ la útil (SinkingLength). Diverses iguals (esquerra/dreta): la de codi
 *    més baix.
 *  - Freses: Ø ≤ el màxim que admet el mecanitzat; la més grossa que hi càpiga i arribi a la fondària
 *    (`pickRouter`) o, per als contorns amb cantonades vives, la més petita (`pickSmallRouter`).
 *  - Discs: fondària ≤ la útil; el més prim.
 */

const DIAMETER_TOL = 0.1
const EPS = 1e-6

export const usableTool = (t: MachineTool): boolean => t.auto && t.mounted && !isPlaceholderTool(t)

const reaches = (t: MachineTool, depth: number) => t.maxDepth <= 0 || t.maxDepth + EPS >= depth

export function pickDrill(m: Machine, diameter: number, depth: number, orientation: "vertical" | "horizontal"): MachineTool | undefined {
  return m.tools
    .filter((t) => usableTool(t) && t.kind === "drill" && (t.orientation ?? "vertical") === orientation && Math.abs(t.diameter - diameter) <= DIAMETER_TOL && reaches(t, depth))
    .sort((a, b) => a.code.localeCompare(b.code))[0]
}

/** Broques de la mida, encara que no arribin a la fondària (per explicar l'avís). */
export function drillsOfDiameter(m: Machine, diameter: number, orientation: "vertical" | "horizontal"): MachineTool[] {
  return m.tools.filter((t) => usableTool(t) && t.kind === "drill" && (t.orientation ?? "vertical") === orientation && Math.abs(t.diameter - diameter) <= DIAMETER_TOL)
}

export function pickRouter(m: Machine, maxDiameter: number, depth: number): MachineTool | undefined {
  return m.tools
    .filter((t) => usableTool(t) && t.kind === "router" && t.diameter > 0 && t.diameter <= maxDiameter + EPS && reaches(t, depth))
    .sort((a, b) => b.diameter - a.diameter || a.code.localeCompare(b.code))[0]
}

/** La fresa més petita (Ø > 0, ≤ `maxDiameter`) que arriba a la fondària: deixa el radi més petit a les cantonades vives. */
export function pickSmallRouter(m: Machine, maxDiameter: number, depth: number): MachineTool | undefined {
  return m.tools
    .filter((t) => usableTool(t) && t.kind === "router" && t.diameter > 0 && t.diameter <= maxDiameter + EPS && reaches(t, depth))
    .sort((a, b) => a.diameter - b.diameter || a.code.localeCompare(b.code))[0]
}

export function pickBlade(m: Machine, depth: number, maxThickness: number): MachineTool | undefined {
  return m.tools
    .filter((t) => usableTool(t) && t.kind === "blade" && (t.bladeThickness ?? 0) > 0 && (t.bladeThickness ?? 0) <= maxThickness + EPS && reaches(t, depth) && t.diameter / 2 > depth)
    .sort((a, b) => (a.bladeThickness ?? 0) - (b.bladeThickness ?? 0) || a.code.localeCompare(b.code))[0]
}
