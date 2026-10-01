import { compositionKind } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import type { Project } from "../../db/db"
import { KINDS } from "../composition/kinds"

/**
 * Què busca el cercador de les galeries en un moble o objecte teu (com a les plantilles, no només el nom): el nom, el
 * tipus, el grup, els noms dels mòduls i els materials.
 */
export function projectSearchText(p: Project): string {
  // Memòria per moble: llegir la composició de tots a cada tecla és car. Es refà si el moble ha canviat (`updatedAt`, el nom o el grup).
  const key = `${p.id}`
  const hit = memo.get(key)
  if (hit && hit.at === p.updatedAt && hit.name === p.name && hit.folder === p.folder) return hit.text
  const text = searchTextOf(p)
  memo.set(key, { at: p.updatedAt, name: p.name, folder: p.folder, text })
  return text
}

/** Una entrada per moble (la d'un moble que canvia es substitueix): no creix més que la llista. */
const memo = new Map<string, { at: number; name: string; folder: string | undefined; text: string }>()

function searchTextOf(p: Project): string {
  const comp = compositionOf(p)
  const kind = KINDS.find((k) => k.value === compositionKind(comp))?.label ?? ""
  const mats = new Set<string>()
  for (const m of comp.modules) {
    mats.add(m.carcass.material)
    if (m.carcass.frontMaterial) mats.add(m.carcass.frontMaterial)
  }
  for (const part of comp.parts ?? []) mats.add(part.material)
  return [p.name, kind, p.folder ?? "", ...comp.modules.map((m) => m.name), ...mats].join(" ")
}
