import type { Composition } from "../../core/model"

/** Objectius on es pot aplicar una mesura: paràmetres dels mòduls i dels objectes de referència. */
export interface ApplyTarget {
  id: string
  label: string
}

export function applyTargets(comp: Composition | undefined): ApplyTarget[] {
  if (!comp) return []
  const out: ApplyTarget[] = []
  for (const m of comp.modules) {
    out.push({ id: `module:${m.id}:width`, label: `${m.name} · amplada` })
    out.push({ id: `module:${m.id}:height`, label: `${m.name} · alçada` })
    out.push({ id: `module:${m.id}:depth`, label: `${m.name} · fondària` })
  }
  for (const r of comp.references) {
    out.push({ id: `ref:${r.id}:w`, label: `${r.name} · amplada` })
    out.push({ id: `ref:${r.id}:h`, label: `${r.name} · alçada` })
    out.push({ id: `ref:${r.id}:d`, label: `${r.name} · fondària` })
  }
  return out
}
