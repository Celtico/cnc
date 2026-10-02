import { machineRules, toolMslName, type Machine, type MachineRules, type MachineTool } from "../model/machine"
import { usableTool } from "./tools"

/**
 * Regles de mecanitzat del taller (`Machine.rules`) a l'export: l'eina de cada regla va pel nom (el de l'MSL, el
 * nom o el codi, sense majúscules ni espais de més). Si la màquina no la té (o no arriba a la fondària), l'export
 * tria l'eina com sempre i avisa un sol cop per export; si no hi cap (Ø massa gros per a la geometria), també tria
 * com sempre, sense avís (és la geometria, no falta res).
 */

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase()

/** Fresa de la màquina amb aquest nom (MSL, nom o codi), de qualsevol estat. */
function namedRouter(m: Pick<Machine, "tools">, name: string, ok: (t: MachineTool) => boolean): MachineTool | undefined {
  const n = norm(name)
  if (!n) return undefined
  return (
    m.tools.find((t) => ok(t) && t.mslName !== undefined && norm(t.mslName) === n) ??
    m.tools.find((t) => ok(t) && norm(t.name) === n) ??
    m.tools.find((t) => ok(t) && norm(t.code) === n)
  )
}

/**
 * Eina de la màquina amb aquest nom (MSL, nom o codi). Només freses que es poden fer servir (`usableTool`: muntades,
 * per a la tria automàtica i que no són una «Eina nova»), les mateixes que ofereix el selector de les regles.
 */
export const findRuleTool = (m: Pick<Machine, "tools">, name: string): MachineTool | undefined => namedRouter(m, name, (t) => t.kind === "router" && usableTool(t))

/** Regla de perfilar per al gruix (interval tancat). */
export const profileRuleFor = (r: MachineRules, thickness: number) => r.profile.find((x) => thickness >= x.min - 1e-6 && thickness <= x.max + 1e-6)

export type RuleKind = "groove" | "pocket" | "profile"
const KIND_LABEL: Record<RuleKind, string> = { groove: "Ranures", pocket: "Caixeres", profile: "Perfilar" }

/** Tria d'eines per regla dins d'un export: recull els avisos (un per regla i eina) i quantes eines falten. */
export class RulePicker {
  readonly rules: MachineRules
  readonly notes: string[] = []
  missing = 0
  private seen = new Set<string>()
  readonly m: Machine
  constructor(m: Machine) {
    this.m = m
    this.rules = machineRules(m)
  }
  private note(key: string, text: string) {
    if (this.seen.has(key)) return
    this.seen.add(key)
    this.notes.push(text)
    this.missing++
  }
  /**
   * L'eina de la regla si la màquina la té, hi cap (Ø ≤ `maxDiameter`) i arriba a `depth`; si no, `undefined` (l'export
   * tria com sempre). `name` buit = sense regla.
   */
  tool(kind: RuleKind, name: string, maxDiameter: number, depth: number, extra = ""): MachineTool | undefined {
    if (!name.trim()) return undefined
    const t = findRuleTool(this.m, name)
    const label = `regla «${KIND_LABEL[kind]}${extra}»`
    // Un sol avís (i una sola eina que falta) per regla i eina, encara que la faltin moltes peces o gruixos.
    const key = `${kind}|${norm(name)}`
    if (!t) {
      const off = namedRouter(this.m, name, (x) => x.kind === "router")
      this.note(
        key,
        off
          ? `${label}: l'eina «${name}» és a la màquina però no es pot fer servir (no muntada, no automàtica o sense codi de Maestro); es tria l'eina automàticament`
          : `${label}: l'eina «${name}» no és a la màquina (afegeix-la o importa un .pgmx amb el nom); es tria l'eina automàticament`,
      )
      return undefined
    }
    if (t.maxDepth > 0 && t.maxDepth + 1e-6 < depth) {
      this.note(key, `${label}: l'eina «${toolMslName(t)}» no arriba a ${Math.round(depth * 1000) / 1000} mm (fondària útil ${t.maxDepth}); es tria l'eina automàticament`)
      return undefined
    }
    if (t.diameter <= 0 || t.diameter > maxDiameter + 1e-6) return undefined
    return t
  }
  /** Eina de perfilar per al gruix del tauler. */
  profileTool(thickness: number, maxDiameter: number, depth: number): MachineTool | undefined {
    const r = profileRuleFor(this.rules, thickness)
    if (!r) return undefined
    return this.tool("profile", r.tool, maxDiameter, depth, ` ${r.min}–${r.max} mm`)
  }
}
