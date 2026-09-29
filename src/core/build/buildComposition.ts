import { modulePlacements, refOnPanel, type Composition, type Module, type Panel, type RefObject, type Vec3 } from "../model"
import { buildModule, type BuildWarning, type ModuleBuild } from "./buildModule"
import { buildPlinthRun, buildWorktop, type RunWarning } from "./runs"

export interface CompositionWarning extends BuildWarning {
  moduleId?: string
  /** Objecte de referència implicat (avisos de xoc). */
  refId?: string
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
 * Passacables que segueixen un objecte de referència: el centre surt de l'objecte
 * (projectat sobre la peça). Si l'objecte ja no hi és, es queda on era.
 */
export function withRefHoles(m: Module, refs: RefObject[], at: { x: number; y: number }): Module {
  if (!m.extras.cableHoles.some((h) => h.ref)) return m
  return {
    ...m,
    extras: {
      ...m.extras,
      cableHoles: m.extras.cableHoles.map((h) => {
        const r = h.ref ? refs.find((o) => o.id === h.ref) : undefined
        if (!r) return h
        const c = refOnPanel(r, h.panel, at)
        return { ...h, x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 }
      }),
    },
  }
}

/**
 * Construeix tota la composició: cada mòdul al seu lloc (`modulePlacements`: fila,
 * potes, penjats i apilats), ids prefixats amb l'id del mòdul i el número de
 * mòdul a cada peça per a les refs del taller.
 */
export function buildComposition(comp: Composition): CompositionBuild {
  const places = modulePlacements(comp)
  const panels: Panel[] = []
  const warnings: CompositionWarning[] = []
  const modules: CompositionBuild["modules"] = []

  comp.modules.forEach((mod, i) => {
    const { x, y } = places[i]!
    const m = withRefHoles(mod, comp.references, { x, y })
    const build = buildModule(m)
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
    // Mòdul penjat: el pes el porta el darrere. Cal fons cargolat o en ranura prou gruixut
    // i penjadors de moble; amb un fons prim o sense fons no s'aguanta.
    if (m.carcass.base.kind === "wall" && (m.carcass.back === "none" || m.carcass.backThickness < 8))
      warnings.push({
        code: "hanging",
        moduleId: m.id,
        message: "Mòdul penjat: posa-hi penjadors de moble (regulables) i un fons d'almenys 8 mm o un travesser de penjar al darrere.",
      })
    modules.push({ id: m.id, index: i + 1, x, y, build })
  })

  // Peces corregudes (taulell, sòcol): numerades com un «mòdul» més per a les refs del taller.
  const runWarnings: RunWarning[] = []
  for (const run of comp.runs ?? []) {
    const n = comp.modules.length + 1
    const p = run.kind === "worktop" ? buildWorktop(comp, run, places, n, runWarnings) : buildPlinthRun(comp, run, places, n, runWarnings)
    if (p) panels.push(p)
  }
  for (const w of runWarnings) warnings.push({ code: "layout", message: w.message })

  // Objectes fantasma que xoquen amb alguna peça.
  for (const ref of comp.references) {
    const rb = refBox(ref)
    const hit = panels.find((p) => boxesOverlap(panelBox(p), rb))
    if (hit) {
      const moduleId = modules.find((m) => m.index === hit.module)?.id
      warnings.push({ code: "collision", message: `«${ref.name}» xoca amb ${hit.label}.`, panelId: hit.id, refId: ref.id, ...(moduleId ? { moduleId } : {}) })
    }
  }

  return { panels, warnings, modules }
}
