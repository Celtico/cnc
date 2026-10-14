import { activeRuns, compositionKind, isSolidMaterial, isTurned, modelFootprint, modulePlacements, NO_EDGES, partsOnlyKind, partCutters, type Composition, type ModelObject, type Panel, type Vec3 } from "../model"
import { applyRefCuts, migrateCableHoles, refTouchesBox } from "./refCuts"
import { columnRearLimits, columnWalls } from "./columnWalls"
import { buildModule, type BuildWarning, type KitOrder, type ModuleBuild } from "./buildModule"
import type { LightOrder } from "./lightOrders"
import { normalizePanel } from "./buildCabinet"
import { buildPlinthRun, buildWorktop, type RunWarning } from "./runs"
import { buildFreeParts, type PartJoint } from "./freeParts"
import { resolveHoleClashes } from "./holeClash"
import { applyHardwarePlacements } from "./hardwarePlace"
import { activeIslands, islandEndPanels } from "./islands"

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
  /**
   * `mirrorX`: mòdul girat 180° (`isTurned`): la X local `xl` va a `x + mirrorX − xl` (`moduleWorldX`). Sense: `x + xl`.
   */
  modules: { id: string; index: number; x: number; y: number; z: number; build: ModuleBuild; mirrorX?: number }[]
  /** Encaixos entre peces lliures. */
  joints: PartJoint[]
  /** Elements sense nesting (peces lliures de ferro, pedra, vidre…): 3D i llista, no taller. */
  extras: Panel[]
  /** Models 3D (`.glb`) que només es veuen: el visor i els ambients els dibuixen; no surten a les peces. */
  models: ModelObject[]
  /** Calaixos amb joc paramètric de tots els mòduls: la comanda per al taller (amb el número de mòdul). */
  hardwareKits: (KitOrder & { module: number; moduleId: string })[]
  /** Compartiments amb joc de llum de tots els mòduls: làmpades i sistema elèctric (amb el número de mòdul). */
  lightKits: (LightOrder & { module: number; moduleId: string })[]
  /**
   * Objectes de referència i peces lliures que tallen (`part:<id>`) que toquen alguna peça: el 3D els pinta en verd i els
   * que no en toquen cap, en vermell (mal col·locats; per decisió de l'usuari, 2026-10-14).
   */
  cutting: string[]
}

/** Caixa de les peces (coordenades on són). */
function localBox(panels: Panel[]): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const p of panels) {
    const b = panelBox(p)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, b.min[k]!)
      max[k] = Math.max(max[k]!, b.max[k]!)
    }
  }
  for (let k = 0; k < 3; k++) if (!Number.isFinite(min[k]!)) min[k] = max[k] = 0
  return { min, max }
}

/** Centre (×2) en X i Z de la caixa de les peces d'un mòdul, en coordenades del mòdul: l'eix del gir de 180°. */
function turnFrame(panels: Panel[]): { mx: number; mz: number } {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const p of panels) {
    const b = panelBox(p)
    x0 = Math.min(x0, b.min[0]); x1 = Math.max(x1, b.max[0]); z0 = Math.min(z0, b.min[2]); z1 = Math.max(z1, b.max[2])
  }
  return Number.isFinite(x0) ? { mx: x0 + x1, mz: z0 + z1 } : { mx: 0, mz: 0 }
}

/** X de la composició d'una X del mòdul (`xl`), també si està girat 180° (`mirrorX`). */
export function moduleWorldX(mb: { x: number; mirrorX?: number }, xl: number): number {
  return mb.mirrorX !== undefined ? mb.x + mb.mirrorX - xl : mb.x + xl
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
  const comp = compositionKind(migrated) === "objecte" ? { ...migrated, parts: migrated.parts?.map((p) => ({ ...p, nest: false, joinery: false })) } : migrated
  // Còpia: el mòdul de darrere de cada illa es recol·loca (`islands.ts`).
  const places = modulePlacements(comp).map((p) => ({ ...p }))
  const panels: Panel[] = []
  const warnings: CompositionWarning[] = []
  const modules: CompositionBuild["modules"] = []
  const moduleExtras: Panel[] = []
  const hardwareKits: CompositionBuild["hardwareKits"] = []
  const lightKits: CompositionBuild["lightKits"] = []

  // Tipus «Lliure» (flat-pack): només peces lliures; els mòduls es guarden però no es fan.
  const onlyParts = partsOnlyKind(compositionKind(comp))
  // Columnes de la casa que entren pel darrere: els calaixos del seu tram, més curts (`columnRearLimits`).
  const builds = onlyParts ? [] : comp.modules.map((m, i) => buildModule(m, { ...(isTurned(m) ? {} : { rearLimits: columnRearLimits(m, comp.references, places[i]!) }), kitchen: compositionKind(comp) === "cuina" }))
  // Illes: el mòdul de darrere es gira 180° i es posa enganxat al darrere del de davant (mateixa X, a `gap` mm), sigui
  // quina sigui la seva posició pròpia.
  const islands = onlyParts ? [] : activeIslands(comp)
  const backOf = new Map(islands.map((isl) => [isl.back, isl]))
  for (const isl of islands) {
    const fi = comp.modules.findIndex((m) => m.id === isl.front)
    const bi = comp.modules.findIndex((m) => m.id === isl.back)
    const fz0 = localBox(builds[fi]!.panels).min[2]
    const bz1 = localBox(builds[bi]!.panels).max[2]
    // Girat, el darrere de la caixa del de darrere (Z local petita) queda a `z + bz1`: el posem al darrere del de davant
    // (`z + fz0`) menys el pas de cables.
    places[bi] = { ...places[bi]!, x: places[fi]!.x, z: (places[fi]!.z ?? 0) + fz0 - isl.gap - bz1 }
    if ((places[bi]!.z ?? 0) < -0.5)
      warnings.push({ code: "layout", moduleId: isl.back, message: `Illa: «${comp.modules[bi]!.name}» passa per darrere de la paret. Augmenta la «Separació de la paret» de «${comp.modules[fi]!.name}».` })
  }
  ;(onlyParts ? [] : comp.modules).forEach((m, i) => {
    const { x, y } = places[i]!
    const z = places[i]!.z ?? 0
    const build = builds[i]!
    // Girat 180° al voltant del vertical pel centre de la caixa de les peces (ocupa el mateix lloc): x → 2·cx − x,
    // z → 2·cz − z i els eixos de cada peça amb la X i la Z canviades de signe (gir, no mirall: les peces són les mateixes).
    const turn = isTurned(m) || backOf.has(m.id) ? turnFrame(build.panels) : undefined
    const place = (pl: Panel["placement"]): Panel["placement"] => {
      const o = pl.origin
      if (!turn) return { ...pl, origin: [o[0] + x, o[1] + y, o[2] + z] }
      const v = (a: Vec3): Vec3 => [-a[0], a[1], -a[2]]
      return { origin: [turn.mx - o[0] + x, o[1] + y, turn.mz - o[2] + z], xAxis: v(pl.xAxis), yAxis: v(pl.yAxis), zAxis: v(pl.zAxis), explodeDir: v(pl.explodeDir) }
    }
    for (const p of build.panels) panels.push({ ...p, id: `${m.id}:${p.id}`, module: i + 1, placement: place(p.placement) })
    for (const p of build.extras) moduleExtras.push({ ...p, id: `${m.id}:${p.id}`, module: i + 1, placement: place(p.placement) })
    for (const k of build.hardwareKits) hardwareKits.push({ ...k, module: i + 1, moduleId: m.id })
    for (const k of build.lightKits) lightKits.push({ ...k, module: i + 1, moduleId: m.id })
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
    modules.push({ id: m.id, index: i + 1, x, y, z, build, ...(turn ? { mirrorX: turn.mx } : {}) })
  })

  // Mòduls que es trepitgen (una columna i un penjat a la mateixa X, una illa sobre la fila, el voladís d'un tauler de
  // taula dins del veí…): la caixa de les peces de cada mòdul no pot entrar dins d'una altra més de 0,5 mm en les tres
  // direccions.
  if (!onlyParts) {
    const boxes = comp.modules.map((m, i) => {
      const p = places[i]!
      const z = p.z ?? 0
      const lo = [p.x, p.y, z], hi = [p.x + m.carcass.width, p.y + m.carcass.height, z + m.carcass.depth]
      const own = panels.filter((q) => q.module === i + 1)
      if (own.length) {
        lo.fill(Infinity)
        hi.fill(-Infinity)
        for (const q of own) {
          const b = panelBox(q)
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k]!, b.min[k]!)
            hi[k] = Math.max(hi[k]!, b.max[k]!)
          }
        }
      }
      return { m, lo, hi }
    })
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!
        const ov = [0, 1, 2].map((k) => Math.min(a.hi[k]!, b.hi[k]!) - Math.max(a.lo[k]!, b.lo[k]!))
        if (!ov.every((o) => o > 0.5)) continue
        warnings.push({
          code: "overlap",
          moduleId: b.m.id,
          message: `Els mòduls «${a.m.name}» i «${b.m.name}» es trepitgen (${ov.map((o) => String(Math.round(o * 10) / 10).replace(".", ",")).join(" × ")} mm): mou-ne un o canvia'n les mides.`,
        })
      }
  }

  // Peces corregudes (taulell, sòcol): numerades com un «mòdul» més per a les refs del taller.
  const runWarnings: RunWarning[] = []
  // A qualsevol moble amb mòduls; els apagats (`off`, els d'un moble que no era cuina) es conserven però no es fan.
  const runs = activeRuns(comp)
  for (const run of runs) {
    const n = comp.modules.length + 1
    const p = run.kind === "worktop" ? buildWorktop(comp, run, places, n, runWarnings) : buildPlinthRun(comp, run, places, n, runWarnings)
    // Com totes les peces: llarg ≥ ample (un taulell sobre un sol mòdul estret sortia girat).
    if (p) panels.push(normalizePanel(p))
  }
  for (const w of runWarnings) warnings.push({ code: "layout", message: w.message })

  // Panells de remat de les illes: un «mòdul» més per a les refs del taller (després del taulell i el sòcol).
  const islandN = comp.modules.length + (runs.length ? 1 : 0) + 1
  for (const isl of islands) {
    const own = panels.filter((p) => p.module === comp.modules.findIndex((m) => m.id === isl.front) + 1 || p.module === comp.modules.findIndex((m) => m.id === isl.back) + 1)
    for (const p of islandEndPanels(isl, comp, localBox(own), islandN)) panels.push(normalizePanel(p))
  }
  if (islands.length && !warnings.some((w) => w.code === "island"))
    warnings.push({ code: "island", message: "Illa: les dues files de mòduls es cargolen entre elles pel darrere (sense forats automàtics), amb els fronts enrasats; els panells de remat es fixen als laterals." })

  // Peces lliures, amb els encaixos entre elles: un «mòdul» més per a les refs del taller.
  const free = buildFreeParts(comp, onlyParts ? 1 : comp.modules.length + (runs.length ? 1 : 0) + (islands.some((i) => i.left || i.right) ? 1 : 0) + 1)
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

  // Ferratges col·locats a mà (generador de mecanitzats): tot o res per ferratge, avís `hardware` si no.
  if (comp.hardwarePlacements?.length)
    for (const w of applyHardwarePlacements(comp.hardwarePlacements, panels, [...moduleExtras, ...free.extras]).warnings) warnings.push(w)

  // Objectes que tallen: forat a cada peça que travessen.
  // Peces lliures en mode «Talla»: fan forats com els objectes que tallen.
  // També a les peces que no són de CNC (ferro, pedra, vidre): el forat es veu al 3D.
  // Una peça partida per un tall (una columna al mig del fons): els altres trossos, peces noves.
  const pieces: Panel[] = []
  const cutting = new Set<string>()
  for (const pr of applyRefCuts([...panels, ...free.extras], [...comp.references, ...partCutters(comp)], panelBox, (p) => free.extras.includes(p), pieces, cutting)) {
    const moduleId = modules.find((m) => m.index === pr.panel.module)?.id
    const owner = pr.refId.startsWith("part:") ? { partId: pr.refId.slice(5) } : { refId: pr.refId }
    warnings.push({ code: "ref-cut", message: pr.message, panelId: pr.panel.id, ...owner, ...(moduleId ? { moduleId } : {}) })
  }
  for (const piece of pieces) (free.extras.some((x) => piece.id.startsWith(`${x.id}-`)) ? free.extras : panels).push(piece)
  // Columnes de la casa que entren pel darrere: els fons que falten a les seves cares, amb les ranures (`columnWalls`).
  if (comp.references.some((o) => o.effect === "cut")) {
    const cw = columnWalls(panels, comp.references, modules.flatMap((m) => {
      const module = comp.modules.find((x) => x.id === m.id)
      return module ? [{ id: m.id, index: m.index, module }] : []
    }), panelBox)
    panels.push(...cw.added)
    for (const pr of cw.problems) {
      const moduleId = modules.find((m) => m.index === pr.panel.module)?.id
      warnings.push({ code: "ref-cut", message: pr.message, panelId: pr.panel.id, refId: pr.refId, ...(moduleId ? { moduleId } : {}) })
    }
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

  // Sense l'avís de peces de la mateixa mida amb mecanitzats diferents (per decisió de l'usuari, 2026-10-13: el taller
  // identifica cada peça per l'etiqueta, A.1.L.1 ≠ A.1.L.2, no per la mida). `sameSizeConflicts` es queda sense ús.

  // Materials massissos (`MaterialPref.solid`): cap cantell. Es fa al final, per a totes les peces (mòduls, taulell i
  // sòcol, peces lliures), així el llistat, el CSV, el LLEGEIX-ME i el 3D en diuen el mateix.
  for (const [i, p] of panels.entries()) if (isSolidMaterial(p.material)) panels[i] = { ...p, edges: { ...NO_EDGES } }

  return { panels, warnings, modules, joints: free.joints, extras: [...moduleExtras, ...free.extras], models: input.models ?? [], hardwareKits, lightKits, cutting: [...cutting] }
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
