import type { CompositionBuild } from "../build/buildComposition"
import { compositionKind, type Composition, type Panel } from "../model"
import type { StepCadGroup } from "./step"

/**
 * Conjunts del STEP per a TopSolid, com l'arbre de l'editor: un per mòdul («1. Baix»), el
 * taulell i el sòcol correguts, i les peces lliures (per grup, o «Peces lliures»). Hi van
 * també les peces sense nesting (ferro, pedra, vidre, barres).
 */
export function stepCadGroups(comp: Composition, build: CompositionBuild): StepCadGroup[] {
  const groups = new Map<string, Panel[]>()
  const push = (name: string, p: Panel) => {
    const list = groups.get(name)
    if (list) list.push(p)
    else groups.set(name, [p])
  }
  const modulesBuilt = compositionKind(comp) !== "lliure"
  const parts = new Map((comp.parts ?? []).map((q) => [q.id, q]))
  for (const p of [...build.panels, ...build.extras]) {
    if (p.id.startsWith("part:")) {
      push(parts.get(p.id.slice(5))?.group ?? "Peces lliures", p)
      continue
    }
    const m = modulesBuilt && p.module ? comp.modules[p.module - 1] : undefined
    push(m ? `${p.module}. ${m.name}` : "Taulell i sòcol", p)
  }
  return [...groups].map(([name, panels]) => ({ name, panels }))
}
