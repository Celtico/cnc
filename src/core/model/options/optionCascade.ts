import { CARCASS } from "./carcassOptions"
import { MODULE_GROUP } from "./moduleOptions"
import type { OptionNode } from "./optionTypes"
import { MOBLE, MULTI, PART, REF, STRUCTURE } from "./otherOptions"
import { ZONE } from "./zoneOptions"

/**
 * Tota la cascada d'opcions de l'Editor tal com és al codi: l'Estructura i els inspectors del moble, el mòdul, el
 * compartiment, la peça lliure, l'objecte de referència i la selecció múltiple. És el que dibuixa Preferències › Opcions
 * en cascada (`cascadeDraft.ts`), només per mirar.
 */
export const OPTION_CASCADE: readonly OptionNode[] = [STRUCTURE, MOBLE, MODULE_GROUP(CARCASS), ZONE, PART, REF, MULTI]

const NODES = new Map<string, OptionNode>()
const index = (n: OptionNode) => {
  if (NODES.has(n.id)) throw new Error(`Opció repetida al registre: ${n.id}`)
  NODES.set(n.id, n)
  for (const c of n.children ?? []) index(c)
}
for (const n of OPTION_CASCADE) index(n)

/** Totes les opcions, per id (en l'ordre de l'arbre). */
export const OPTION_NODES: ReadonlyMap<string, OptionNode> = NODES

export function optionNode(id: string): OptionNode | undefined {
  return NODES.get(id)
}
