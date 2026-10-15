import { pickSmallRouter, usableTool } from "../../machine/tools"
import type { Panel } from "../../model"
import { boardMargin, machineNesting, type Machine, type MachineTool } from "../../model/machine"
import { RulePicker } from "../../machine/rules"
import type { NestOptions } from "../../nesting/nest"

/**
 * Fresa del contorn de les peces: la triada a la màquina (`nesting.tool`), si no la que diu «nesting» al nom
 * (la «12mm diamant nesting» del taller) i, si no, la més petita que travessa (menys separació entre peces).
 */
export function nestingRouter(m: Machine, depth: number): MachineTool | undefined {
  const ok = (t: MachineTool) => usableTool(t) && t.kind === "router" && t.diameter > 0 && (t.maxDepth <= 0 || t.maxDepth + 1e-6 >= depth)
  const want = machineNesting(m).tool
  const chosen = want ? m.tools.find((t) => t.code === want) : undefined
  if (chosen && ok(chosen)) return chosen
  const named = m.tools.filter((t) => ok(t) && /nesting/i.test(`${t.mslName ?? ""} ${t.name}`)).sort((a, b) => a.diameter - b.diameter || a.code.localeCompare(b.code))
  return named[0] ?? pickSmallRouter(m, Infinity, depth)
}

/**
 * Fresa del contorn d'un tauler de gruix `T`: la de la regla de perfilar del gruix (si la màquina la té) o la de nesting
 * (`nestingRouter`), que travessi fins a `T + overcut`. És la mateixa que fa servir `toMaestroNestXcs` per a cada tauler.
 */
export const boardRouter = (rp: RulePicker, m: Machine, T: number, overcut: number): MachineTool | undefined => rp.profileTool(T, Infinity, T + overcut) ?? nestingRouter(m, T + overcut)

/**
 * Opcions del nesting per a la CNC: les del moble (taulers, veta) amb la separació = Ø de la fresa de nesting
 * + `spacingExtra` (en lloc del gruix de la serra) i el marge del tauler de la màquina (`edgeTrim`). La separació és una
 * per a tots els taulers: la del Ø més gros de les freses de contorn de cada gruix (`boardRouter`); `tool` és aquesta.
 */
export function cncNestOptions(panels: Panel[], m: Machine, base: NestOptions): { options: NestOptions; tool?: MachineTool; spacing: number; margin: number } {
  const n = machineNesting(m)
  const rp = new RulePicker(m)
  const routerOf = (ps: Panel[]) =>
    [...new Set(ps.map((p) => p.thickness))]
      .map((t) => boardRouter(rp, m, t, n.overcut))
      .filter((t): t is MachineTool => !!t)
      .sort((a, b) => b.diameter - a.diameter || a.code.localeCompare(b.code))[0]
  // Marge per triar les peces que caben: el fix o, amb «Ø de la fresa», el de la fresa més grossa de tots els gruixos.
  const fitMargin = boardMargin(n, n.edgeTrimMode === "tool" ? routerOf(panels) : undefined)
  // Només els gruixos de les peces que caben en algun tauler: una que no hi cap (un taulell de 3500 mm) no surt a cap
  // programa i no ha de fer més ampla la separació de tots els taulers.
  const fits = (p: Panel) => {
    const sh = base.sheetsByMaterial?.[p.material] ?? base.sheet
    const W = Math.max(sh.w, sh.h) - 2 * fitMargin, H = Math.min(sh.w, sh.h) - 2 * fitMargin
    const a = Math.max(p.length, p.width), b = Math.min(p.length, p.width)
    return a <= W && b <= H
  }
  const placed = panels.filter(fits)
  const tool = routerOf(placed.length ? placed : panels)
  const spacing = (tool ? tool.diameter : base.kerf) + n.spacingExtra
  // Un sol marge per a tots els taulers: amb «Ø de la fresa», el de la fresa que fixa la separació (la més grossa).
  const margin = boardMargin(n, tool)
  return { options: { ...base, kerf: spacing, margin }, ...(tool ? { tool } : {}), spacing, margin }
}
