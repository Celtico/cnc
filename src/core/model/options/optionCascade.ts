import { z } from "zod"
import { CARCASS } from "./carcassOptions"
import { MODULE_GROUP } from "./moduleOptions"
import type { OptionNode, OptionValue } from "./optionTypes"
import { MOBLE, MULTI, PART, REF, STRUCTURE } from "./otherOptions"
import { ZONE } from "./zoneOptions"

export type { OptionIcon, OptionNode, OptionValue } from "./optionTypes"

/**
 * Tota la cascada d'opcions de l'Editor, com es veu a Preferències › Opcions en cascada: l'Estructura i els inspectors del
 * moble, el mòdul, el compartiment, la peça lliure, l'objecte de referència i la selecció múltiple.
 */
export const OPTION_CASCADE: readonly OptionNode[] = [STRUCTURE, MOBLE, MODULE_GROUP(CARCASS), ZONE, PART, REF, MULTI]

const NODES = new Map<string, OptionNode>()
const PARENT = new Map<string, string>()
const index = (n: OptionNode, parent?: string) => {
  if (NODES.has(n.id)) throw new Error(`Opció repetida al registre: ${n.id}`)
  NODES.set(n.id, n)
  if (parent) PARENT.set(n.id, parent)
  for (const c of n.children ?? []) index(c, n.id)
}
for (const n of OPTION_CASCADE) index(n)

/** Totes les opcions, per id (en l'ordre de l'arbre). */
export const OPTION_NODES: ReadonlyMap<string, OptionNode> = NODES

export function optionNode(id: string): OptionNode | undefined {
  return NODES.get(id)
}

/** Els de sobre d'una opció, del pare cap amunt. */
function optionAncestors(id: string): string[] {
  const out: string[] = []
  for (let p = PARENT.get(id); p; p = PARENT.get(p)) out.push(p)
  return out
}

/** El que l'usuari ha triat d'una opció (Preferències › Opcions en cascada). */
const OptionPrefSchema = z.object({
  hidden: z.literal(true).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
})
export type OptionPref = z.infer<typeof OptionPrefSchema>
export const OptionPrefsSchema = z.record(z.string(), OptionPrefSchema)
export type OptionPrefs = Record<string, OptionPref>

/**
 * L'opció (o una de sobre) que l'amaga, si n'hi ha cap. Només compten les que es poden amagar (`hideable`): una
 * preferència desada d'una opció que ja no es pot amagar (o que ja no hi és) no amaga res.
 */
export function hiddenBy(prefs: OptionPrefs | undefined, id: string): string | undefined {
  if (!prefs) return undefined
  for (const k of [id, ...optionAncestors(id)]) if (prefs[k]?.hidden && NODES.get(k)?.hideable) return k
  return undefined
}

/** L'opció no surt a l'inspector (ella o una de sobre és amagada). */
export function isOptionHidden(prefs: OptionPrefs | undefined, id: string): boolean {
  return hiddenBy(prefs, id) !== undefined
}

/** Un valor que l'opció pot prendre: una de les tries, un número dins dels límits o un interruptor. */
export function validOptionValue(node: OptionNode, v: unknown): v is OptionValue {
  if (node.control === "switch") return typeof v === "boolean"
  if (node.control === "number") return typeof v === "number" && Number.isFinite(v) && (!node.range || (v >= node.range.min && v <= node.range.max))
  if (node.control === "choice") return typeof v === "string" && !!node.choices?.some((c) => c.value === v)
  return false
}

/**
 * El valor per defecte d'una opció per als elements nous: el de l'usuari (si és vàlid i l'opció en deixa triar) o el del
 * codi (`node.default`).
 */
export function optionDefault(prefs: OptionPrefs | undefined, id: string): OptionValue | undefined {
  const node = NODES.get(id)
  if (!node) return undefined
  const own = prefs?.[id]?.default
  return node.defaultEditable && own !== undefined && validOptionValue(node, own) ? own : node.default
}

/** El valor per defecte que ha triat l'usuari (diferent del del codi), o `undefined`. */
export function userOptionDefault(prefs: OptionPrefs | undefined, id: string): OptionValue | undefined {
  const node = NODES.get(id)
  const own = prefs?.[id]?.default
  return node?.defaultEditable && own !== undefined && validOptionValue(node, own) && own !== node.default ? own : undefined
}

/** Canvia la preferència d'una opció; una que queda buida (o amb el valor del codi) es treu. */
export function setOptionPref(prefs: OptionPrefs, id: string, patch: { hidden?: boolean; default?: OptionValue | null }): OptionPrefs {
  const cur = prefs[id] ?? {}
  const node = NODES.get(id)
  const hidden = patch.hidden === undefined ? cur.hidden : patch.hidden ? (true as const) : undefined
  const def = patch.default === undefined ? cur.default : patch.default === null || patch.default === node?.default ? undefined : patch.default
  const next: OptionPref = { ...(hidden ? { hidden } : {}), ...(def !== undefined ? { default: def } : {}) }
  const { [id]: _old, ...rest } = prefs
  return Object.keys(next).length ? { ...rest, [id]: next } : rest
}

/** Llegeix les preferències desades entrada a entrada: una de dolenta només treu aquella (`problems` ho diu). */
export function parseOptionPrefs(raw: unknown, problems: string[]): OptionPrefs {
  if (raw === undefined) return {}
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    problems.push("Opcions en cascada: valor invàlid; es tornen als inicials.")
    return {}
  }
  const out: OptionPrefs = {}
  for (const [id, v] of Object.entries(raw)) {
    const res = OptionPrefSchema.safeParse(v)
    if (res.success) out[id] = res.data
    else problems.push(`Opcions en cascada: s'ha descartat «${id}».`)
  }
  return out
}
