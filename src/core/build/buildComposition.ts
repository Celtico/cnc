import { compositionKind, modulePlacements, partCutters, type Composition, type Panel, type RefObject, type Vec3 } from "../model"
import { applyRefCuts, migrateCableHoles, refTouchesBox } from "./refCuts"
import { buildModule, type BuildWarning, type ModuleBuild } from "./buildModule"
import { buildPlinthRun, buildWorktop, type RunWarning } from "./runs"
import { buildFreeParts, type PartJoint } from "./freeParts"

export interface CompositionWarning extends BuildWarning {
  moduleId?: string
  /** Objecte de referència implicat (avisos de xoc). */
  refId?: string
  /** Peça lliure implicada. */
  partId?: string
}

export interface CompositionBuild {
  panels: Panel[]
  warnings: CompositionWarning[]
  modules: { id: string; index: number; x: number; y: number; z: number; build: ModuleBuild }[]
  /** Encaixos entre peces lliures. */
  joints: PartJoint[]
  /** Elements sense nesting (peces lliures de ferro, pedra, vidre…): 3D i llista, no taller. */
  extras: Panel[]
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

export function refBox(o: RefObject): { min: Vec3; max: Vec3 } {
  return { min: [o.x, o.y, o.z], max: [o.x + o.w, o.y + o.h, o.z + o.d] }
}

/**
 * Construeix tota la composició: cada mòdul al seu lloc (`modulePlacements`: fila,
 * potes, penjats i apilats), ids prefixats amb l'id del mòdul i el número de
 * mòdul a cada peça per a les refs del taller.
 */
export function buildComposition(input: Composition): CompositionBuild {
  // Passacables de la versió anterior → objectes que tallen.
  const comp = migrateCableHoles(input, panelBox)
  const places = modulePlacements(comp)
  const panels: Panel[] = []
  const warnings: CompositionWarning[] = []
  const modules: CompositionBuild["modules"] = []
  const moduleExtras: Panel[] = []

  // Tipus «Lliure» (flat-pack): només peces lliures; els mòduls es guarden però no es fan.
  const onlyParts = compositionKind(comp) === "lliure"
  ;(onlyParts ? [] : comp.modules).forEach((m, i) => {
    const { x, y } = places[i]!
    const z = places[i]!.z ?? 0
    const build = buildModule(m)
    for (const p of build.panels) {
      const o = p.placement.origin
      panels.push({
        ...p,
        id: `${m.id}:${p.id}`,
        module: i + 1,
        placement: { ...p.placement, origin: [o[0] + x, o[1] + y, o[2] + z] },
      })
    }
    for (const p of build.extras) {
      const o = p.placement.origin
      moduleExtras.push({ ...p, id: `${m.id}:${p.id}`, module: i + 1, placement: { ...p.placement, origin: [o[0] + x, o[1] + y, o[2] + z] } })
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
    modules.push({ id: m.id, index: i + 1, x, y, z, build })
  })

  // Peces corregudes (taulell, sòcol): numerades com un «mòdul» més per a les refs del taller.
  const runWarnings: RunWarning[] = []
  // Només a la cuina: si es canvia de tipus, es conserven però no es fan (es recuperen en tornar-hi).
  const runs = compositionKind(comp) === "cuina" ? (comp.runs ?? []) : []
  for (const run of runs) {
    const n = comp.modules.length + 1
    const p = run.kind === "worktop" ? buildWorktop(comp, run, places, n, runWarnings) : buildPlinthRun(comp, run, places, n, runWarnings)
    if (p) panels.push(p)
  }
  for (const w of runWarnings) warnings.push({ code: "layout", message: w.message })

  // Peces lliures, amb els encaixos entre elles: un «mòdul» més per a les refs del taller.
  const free = buildFreeParts(comp, onlyParts ? 1 : comp.modules.length + (runs.length ? 1 : 0) + 1)
  panels.push(...free.panels)
  for (const w of free.warnings) warnings.push({ code: "layout", message: w.message, partId: w.partId })

  // Objectes que tallen: forat a cada peça que travessen.
  // Peces lliures en mode «Talla»: fan forats com els objectes que tallen.
  for (const pr of applyRefCuts(panels, [...comp.references, ...partCutters(comp)], panelBox)) {
    const moduleId = modules.find((m) => m.index === pr.panel.module)?.id
    const owner = pr.refId.startsWith("part:") ? { partId: pr.refId.slice(5) } : { refId: pr.refId }
    warnings.push({ code: "ref-cut", message: pr.message, panelId: pr.panel.id, ...owner, ...(moduleId ? { moduleId } : {}) })
  }

  // Obstacles que xoquen amb alguna peça.
  for (const ref of comp.references) {
    if (ref.effect === "cut") continue
    const hit = panels.find((p) => refTouchesBox(ref, panelBox(p)))
    if (hit) {
      const moduleId = modules.find((m) => m.index === hit.module)?.id
      warnings.push({ code: "collision", message: `«${ref.name}» xoca amb ${hit.label}.`, panelId: hit.id, refId: ref.id, ...(moduleId ? { moduleId } : {}) })
    }
  }

  return { panels, warnings, modules, joints: free.joints, extras: [...moduleExtras, ...free.extras] }
}
