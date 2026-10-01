import type { Module } from "../../core/model"

/**
 * Opcions (ChoiceChips) per triar un mòdul: el nom i, si n'hi ha d'iguals, el número (com a l'arbre: «Baix (2)»). Si
 * el triat ja no hi és (esborrat o passat a la fila dels penjats), una opció més que ho diu, perquè no quedi res marcat
 * sense saber per què.
 */
export function moduleChips(modules: Module[], value: string | undefined): { id: string; label: string }[] {
  const count = new Map<string, number>()
  for (const m of modules) count.set(m.name, (count.get(m.name) ?? 0) + 1)
  const out = modules.map((m, i) => ({ id: m.id, label: (count.get(m.name) ?? 0) > 1 ? `${m.name} (${i + 1})` : m.name }))
  if (value && !modules.some((m) => m.id === value)) out.push({ id: value, label: "⚠ Ja no hi és" })
  return out
}
