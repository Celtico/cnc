import { moduleOrigins, type Composition, type Panel, type RefObject, type Vec3 } from "../model"
import { buildModule, type BuildWarning, type ModuleBuild } from "./buildModule"

export interface CompositionWarning extends BuildWarning {
  moduleId?: string
}

export interface CompositionBuild {
  panels: Panel[]
  warnings: CompositionWarning[]
  modules: { id: string; index: number; x: number; y: number; build: ModuleBuild }[]
}

/** Caixa englobant d'una peça (coordenades de la composició). */
export function panelBox(p: Panel): { min: Vec3; max: Vec3 } {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const cx of [0, p.length])
    for (const cy of [0, p.width])
      for (const cz of [0, p.thickness])
        for (let i = 0; i < 3; i++) {
          const v = o[i]! + cx * x[i]! + cy * y[i]! + cz * z[i]!
          min[i] = Math.min(min[i]!, v)
          max[i] = Math.max(max[i]!, v)
        }
  return { min, max }
}

function boxesOverlap(a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }, tol = 0.5): boolean {
  for (let i = 0; i < 3; i++) if (a.max[i]! <= b.min[i]! + tol || b.max[i]! <= a.min[i]! + tol) return false
  return true
}

export function refBox(o: RefObject): { min: Vec3; max: Vec3 } {
  return { min: [o.x, o.y, o.z], max: [o.x + o.w, o.y + o.h, o.z + o.d] }
}

/**
 * Construeix tota la composició: cada mòdul al seu lloc (x per ordre i separacions;
 * y = alçada de les potes si en té), ids prefixats amb l'id del mòdul i el número de
 * mòdul a cada peça per a les refs del taller.
 */
export function buildComposition(comp: Composition): CompositionBuild {
  const xs = moduleOrigins(comp)
  const panels: Panel[] = []
  const warnings: CompositionWarning[] = []
  const modules: CompositionBuild["modules"] = []

  comp.modules.forEach((m, i) => {
    const build = buildModule(m)
    const x = xs[i]!
    const y = m.carcass.base.kind === "legs" ? m.carcass.base.height : 0
    for (const p of build.panels) {
      const o = p.placement.origin
      panels.push({
        ...p,
        id: `${m.id}:${p.id}`,
        module: i + 1,
        placement: { ...p.placement, origin: [o[0] + x, o[1] + y, o[2]] },
      })
    }
    for (const w of build.warnings) warnings.push({ ...w, moduleId: m.id })
    modules.push({ id: m.id, index: i + 1, x, y, build })
  })

  // Objectes fantasma que xoquen amb alguna peça.
  for (const ref of comp.references) {
    const rb = refBox(ref)
    const hit = panels.find((p) => boxesOverlap(panelBox(p), rb))
    if (hit) warnings.push({ code: "collision", message: `«${ref.name}» xoca amb ${hit.label}.`, panelId: hit.id })
  }

  return { panels, warnings, modules }
}
