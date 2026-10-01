import { compositionKind } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import type { Project } from "../../db/db"
import { KINDS } from "../composition/kinds"

/**
 * Què busca el cercador de les galeries en un moble o objecte teu (com a les plantilles, no només el nom): el nom, el
 * tipus, el grup, els noms dels mòduls i els materials.
 */
export function projectSearchText(p: Project): string {
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
