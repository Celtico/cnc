import { compositionKind, modelFootprint, modulePlacements, partsOnlyKind, partCutters, type Composition, type ModelObject, type Panel, type Vec3 } from "../model"
import { applyRefCuts, migrateCableHoles, refTouchesBox } from "./refCuts"
import { buildModule, type BuildWarning, type ModuleBuild } from "./buildModule"
import { normalizePanel } from "./buildCabinet"
import { buildPlinthRun, buildWorktop, type RunWarning } from "./runs"
import { buildFreeParts, type PartJoint } from "./freeParts"
import { resolveHoleClashes } from "./holeClash"
import { sameSizeConflicts } from "./sameSize"

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
  /** Models 3D (`.glb`) que només es veuen: el visor i els ambients els dibuixen; no surten a les peces. */
  models: ModelObject[]
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

/**
 * Construeix tota la composició: cada mòdul al seu lloc (`modulePlacements`: fila,
 * potes, penjats i apilats), ids prefixats amb l'id del mòdul i el número de
 * mòdul a cada peça per a les refs del taller.
 */
export function buildComposition(input: Composition): CompositionBuild {
  // Passacables de la versió anterior → objectes que tallen.
  const migrated = migrateCableHoles(input, panelBox)
  // Objecte: les peces només es veuen (mai van al nesting ni fan encaixos).
  const comp = compositionKind(migrated) === "objecte" ? { ...migrated, parts: migrated.parts?.map((p) => ({ ...p, nest: false, joints: false })) } : migrated
  const places = modulePlacements(comp)
  const panels: Panel[] = []
  const warnings: CompositionWarning[] = []
  const modules: CompositionBuild["modules"] = []
  const moduleExtras: Panel[] = []

  // Tipus «Lliure» (flat-pack): només peces lliures; els mòduls es guarden però no es fan.
  const onlyParts = partsOnlyKind(compositionKind(comp))
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
    // L'avís del push és de tot el moble: una sola vegada, no un per mòdul.
    for (const w of build.warnings) if (w.code !== "push" || !warnings.some((x) => x.code === "push")) warnings.push({ ...w, moduleId: m.id })
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
    // Com totes les peces: llarg ≥ ample (un taulell sobre un sol mòdul estret sortia girat).
    if (p) panels.push(normalizePanel(p))
  }
  for (const w of runWarnings) warnings.push({ code: "layout", message: w.message })

  // Peces lliures, amb els encaixos entre elles: un «mòdul» més per a les refs del taller.
  const free = buildFreeParts(comp, onlyParts ? 1 : comp.modules.length + (runs.length ? 1 : 0) + 1)
  panels.push(...free.panels)
  for (const w of free.warnings) warnings.push({ code: w.code ?? "layout", message: w.message, partId: w.partId })

  // Peces sense mida (llarg, ample o gruix ≤ 0, p. ex. un calaix sense lloc): no es poden
  // fabricar. Es treuen i s'avisa.
  const valid = (v: number) => Number.isFinite(v) && v > 0
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i]!
    if (valid(p.length) && valid(p.width) && valid(p.thickness)) continue
    panels.splice(i, 1)
    const mod = modules.find((m) => m.index === p.module)
    if (mod) {
      const localId = p.id.slice(mod.id.length + 1)
      mod.build = { ...mod.build, panels: mod.build.panels.filter((q) => q.id !== localId) }
    }
    warnings.push({ code: "invalid-part", message: `${p.label} fa ${p.length} × ${p.width} × ${p.thickness} mm: no té mida i no es fabrica. Revisa les mides del mòdul.`, panelId: p.id, ...(mod ? { moduleId: mod.id } : {}) })
  }

  // Objectes que tallen: forat a cada peça que travessen.
  // Peces lliures en mode «Talla»: fan forats com els objectes que tallen.
  // També a les peces que no són de CNC (ferro, pedra, vidre): el forat es veu al 3D.
  for (const pr of applyRefCuts([...panels, ...free.extras], [...comp.references, ...partCutters(comp)], panelBox, (p) => free.extras.includes(p))) {
    const moduleId = modules.find((m) => m.index === pr.panel.module)?.id
    const owner = pr.refId.startsWith("part:") ? { partId: pr.refId.slice(5) } : { refId: pr.refId }
    warnings.push({ code: "ref-cut", message: pr.message, panelId: pr.panel.id, ...owner, ...(moduleId ? { moduleId } : {}) })
  }

  // Forats que es troben per dins (System 32 a banda i banda d'un divisor, espiga contra guia):
  // s'escurcen com ho faria un tècnic; els que no es poden resoldre, s'avisen.
  for (const p of panels)
    for (const message of resolveHoleClashes(p)) {
      const moduleId = modules.find((m) => m.index === p.module)?.id
      warnings.push({ code: "hole-clash", message, panelId: p.id, ...(moduleId ? { moduleId } : {}) })
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

  // El taller casa peça i sòlid només per la mida: dues peces iguals amb mecanitzats diferents es poden canviar.
  // Un sol avís per moble (en una cuina n'hi pot haver molts), amb la primera parella i quantes n'hi ha.
  const clash = sameSizeConflicts(panels)
  if (clash.length) {
    const [a, b] = clash[0]!
    const moduleId = modules.find((m) => m.index === a.module)?.id
    const more = clash.length > 1 ? ` (i ${clash.length - 1} ${clash.length === 2 ? "parella més" : "parelles més"})` : ""
    warnings.push({
      code: "same-size",
      message: `${a.label} i ${b.label} fan ${a.length} × ${a.width} × ${a.thickness} mm de ${a.material} però tenen mecanitzats diferents${more}: el taller casa cada peça amb el seu sòlid només per la mida i els pot intercanviar. Canvia una mica la mida d'una de les dues o avisa el taller.`,
      panelId: a.id,
      ...(moduleId ? { moduleId } : {}),
    })
  }

  return { panels, warnings, modules, joints: free.joints, extras: [...moduleExtras, ...free.extras], models: input.models ?? [] }
}

/** Caixa de tot el moble (peces i elements sense nesting), en mm de la composició. */
export function buildBounds(b: Pick<CompositionBuild, "panels" | "extras"> & { models?: ModelObject[] }): { min: Vec3; max: Vec3 } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const p of [...b.panels, ...b.extras]) {
    const bx = panelBox(p)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, bx.min[i]!)
      max[i] = Math.max(max[i]!, bx.max[i]!)
    }
  }
  // Els models 3D també compten (un objecte que només és una planta).
  for (const m of b.models ?? []) {
    const f = modelFootprint(m)
    const lo = [f.x, m.y, f.z], hi = [f.x + f.w, m.y + m.h, f.z + f.d]
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, lo[i]!)
      max[i] = Math.max(max[i]!, hi[i]!)
    }
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0] }
  return { min, max }
}
