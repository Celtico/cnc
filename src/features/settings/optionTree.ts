import { createTreeCollection } from "@chakra-ui/react"
import { optionNode, type OptionNode, type OptionPrefs, type OptionValue } from "../../core/model"
import { fold } from "../projects/galleryGrid"

/** El text on es cerca d'una opció: nom, condició, tries, notes i la possible incoherència. */
const haystack = (n: OptionNode): string => fold([n.label, n.showIf, n.note, n.issue, n.defaultText, ...(n.choices ?? []).map((c) => c.label)].filter(Boolean).join(" "))

/**
 * L'arbre filtrat per la cerca: les opcions que hi coincideixen (amb tot el que tenen a sota) i les de sobre per arribar-hi.
 * Sense cerca, tot.
 */
export function filterOptions(nodes: readonly OptionNode[], query: string): OptionNode[] {
  const q = fold(query.trim())
  if (!q) return [...nodes]
  return nodes.flatMap((n) => {
    if (haystack(n).includes(q)) return [n]
    const children = filterOptions(n.children ?? [], query)
    return children.length ? [{ ...n, children }] : []
  })
}

/** Els ids de les opcions que tenen fills (per obrir-les totes durant la cerca). */
export function branchIds(nodes: readonly OptionNode[]): string[] {
  return nodes.flatMap((n) => (n.children?.length ? [n.id, ...branchIds(n.children)] : []))
}

/** La col·lecció del `TreeView` de Chakra. */
export function optionCollection(nodes: OptionNode[]) {
  return createTreeCollection<OptionNode>({
    nodeToValue: (n) => n.id,
    nodeToString: (n) => n.label,
    rootNode: { id: "ROOT", label: "", kind: "group", hideable: false, code: "", children: nodes },
  })
}

/** Quantes n'hi ha d'amagades i amb el per defecte propi (el resum de la capçalera). */
export function prefCounts(prefs: OptionPrefs): { hidden: number; defaults: number } {
  const entries = Object.entries(prefs).filter(([id]) => optionNode(id))
  return { hidden: entries.filter(([id, p]) => p.hidden && optionNode(id)!.hideable).length, defaults: entries.filter(([id, p]) => p.default !== undefined && optionNode(id)!.defaultEditable).length }
}

/** Un valor en paraules: el nom de la tria, «Sí»/«No» o el número amb la unitat. */
export function valueText(n: OptionNode, v: OptionValue | undefined): string {
  if (v === undefined) return n.defaultText ?? "—"
  if (typeof v === "boolean") return v ? "Sí" : "No"
  if (typeof v === "number") return `${String(v).replace(".", ",")}${n.range?.suffix ? ` ${n.range.suffix}` : ""}`
  return n.choices?.find((c) => c.value === v)?.label ?? v
}
