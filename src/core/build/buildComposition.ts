import type { KitOrderLine } from "./drawerKit"
import { activeRuns, compositionKind, freeX, withSupport, withNeighbourSides, withWallBacks, isSolidMaterial, moduleFrontFace, moduleRot, rotXZ, unrot, type ModuleRot, modelFootprint, modulePlacements, NO_EDGES, partsOnlyKind, partCutters, resolveParts, type Composition, type ModelObject, type Module, type Panel, type Vec3 } from "../model"
import { applyRefCuts, migrateCableHoles, refTouchesBox } from "./refCuts"
import { columnRearLimits, columnWalls, isPillar, relayLegs } from "./columnWalls"
import { clipHangingToRefs } from "./hangingCuts"
import { buildModule, type BuildWarning, type KitOrder, type ModuleBuild, type Wiring } from "./buildModule"
import type { LightOrder } from "./lightOrders"
import { normalizePanel } from "./buildCabinet"
import { panelBox } from "./geometry"
import { buildWorktop, type RunWarning } from "./runs"
import { buildTramPlinths } from "./tramPlinth"
import { buildLinearOrders, type LinearOrder, type LinearPiece } from "./linearOrders"
import { buildFreeParts, type PartJoint } from "./freeParts"
import { resolveHoleClashes } from "./holeClash"
import { applyHardwarePlacements } from "./hardwarePlace"
import { activeIslands, islandEndPanels } from "./islands"
import { joinInLinePanels } from "./joinPanels"
import { fmtNum } from "../../lib/format"

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
   * `turn`: mòdul girat (`moduleRot`): les coordenades del mòdul es giren `rot` graus al voltant de (`cx`, `cz`) (el centre
   * de la caixa de les seves peces) abans de sumar-hi `x`, `z` (`moduleToWorld`, `moduleFromWorld`). Sense: només es sumen.
   */
  modules: { id: string; index: number; x: number; y: number; z: number; build: ModuleBuild; turn?: ModuleTurn }[]
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
  /** La comanda dels ferratges col·locats per mòdul (`ModuleBuild.fittingOrders`; Peces › «Ferratges»). */
  fittingOrders: (KitOrderLine & { module: number; moduleId: string })[]
  /**
   * Ferratges per metres (la regleta dels penjadors, els sòcols d'alumini): un per item, amb els trossos per tallar, les
   * barres, els clips i les cantonades (Peces › «Ferratges per metres», CSV de la llista de tall; `linearOrders.ts`).
   */
  linearOrders: LinearOrder[]
  /** La instal·lació dels llums de cada mòdul que en porta (Peces › plànol de la instal·lació elèctrica). */
  wirings: { module: number; moduleId: string; name: string; width: number; height: number; wiring: Wiring }[]
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

/** El gir d'un mòdul a la composició: graus i centre (coordenades del mòdul). */
interface ModuleTurn {
  rot: Exclude<ModuleRot, 0>
  cx: number
  cz: number
}

/** El gir d'un mòdul al voltant del centre (en X i Z) de la caixa de les seves peces, en coordenades del mòdul. */
function turnFrame(panels: Panel[], rot: Exclude<ModuleRot, 0>): ModuleTurn {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const p of panels) {
    const b = panelBox(p)
    x0 = Math.min(x0, b.min[0]); x1 = Math.max(x1, b.max[0]); z0 = Math.min(z0, b.min[2]); z1 = Math.max(z1, b.max[2])
  }
  return Number.isFinite(x0) ? { rot, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 } : { rot, cx: 0, cz: 0 }
}

/** Un punt del mòdul (X i Z del mòdul) a la composició, també si està girat (`turn`). */
export function moduleToWorld(mb: { x: number; z: number; turn?: ModuleTurn }, xl: number, zl: number): [number, number] {
  const [x, z] = mb.turn ? rotXZ(xl, zl, mb.turn.rot, mb.turn.cx, mb.turn.cz) : [xl, zl]
  return [x + mb.x, z + mb.z]
}

/** Un punt de la composició (X i Z) al mòdul: el contrari de `moduleToWorld`. */
export function moduleFromWorld(mb: { x: number; z: number; turn?: ModuleTurn }, xw: number, zw: number): [number, number] {
  const x = xw - mb.x, z = zw - mb.z
  return mb.turn ? rotXZ(x, z, unrot(mb.turn.rot), mb.turn.cx, mb.turn.cz) : [x, z]
}

/** La caixa a la composició d'una caixa del mòdul (x, y i z del mòdul), també si està girat. */
export function moduleBoxToWorld(mb: { x: number; y: number; z: number; turn?: ModuleTurn }, b: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } {
  const pts = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].map(([x, z]) => moduleToWorld(mb, x!, z!))
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: b.y0 + mb.y, y1: b.y1 + mb.y, z0: Math.min(...zs), z1: Math.max(...zs) }
}

/**
 * Columnes de la casa que travessen la base d'un mòdul (qualsevol, no només les del darrere; un mòdul girat, en mirall):
 * on no hi va l'alimentador dels llums ni hi ha potes al costat (trams en X del mòdul).
 */
function pillarKeepOut(comp: Composition, m: Module, pl: { x: number; z?: number }): [number, number][] {
  const mz = pl.z ?? 0
  const W = m.carcass.width, D = m.carcass.depth + m.carcass.thickness
  const rot = moduleRot(m)
  const out: [number, number][] = []
  for (const o of comp.references) {
    if (o.effect !== "cut" || !isPillar(o) || o.y > 1) continue
    // La petjada de la columna al mòdul (desfent el gir al voltant del centre de la caixa).
    const pts = [[o.x, o.z], [o.x + o.w, o.z], [o.x, o.z + o.d], [o.x + o.w, o.z + o.d]].map(([x, z]) => rotXZ(x! - pl.x, z! - mz, unrot(rot), W / 2, D / 2))
    const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]))
    const z0 = Math.min(...pts.map((p) => p[1])), z1 = Math.max(...pts.map((p) => p[1]))
    if (x1 <= 0 || x0 >= W || z0 >= D || z1 <= 0) continue
    out.push([x0, x1])
  }
  return out
}

/**
 * La col·locació d'una peça del mòdul a la composició: girada (`turn`, gir i no mirall: les peces són les mateixes) i
 * desplaçada a `x`, `y`, `z`.
 */
function placeIn(turn: ModuleTurn | undefined, x: number, y: number, z: number): (pl: Panel["placement"]) => Panel["placement"] {
  return (pl) => {
    const o = pl.origin
    if (!turn) return { ...pl, origin: [o[0] + x, o[1] + y, o[2] + z] }
    if (turn.rot === 180) {
      const v = (a: Vec3): Vec3 => [-a[0], a[1], -a[2]]
      return { origin: [2 * turn.cx - o[0] + x, o[1] + y, 2 * turn.cz - o[2] + z], xAxis: v(pl.xAxis), yAxis: v(pl.yAxis), zAxis: v(pl.zAxis), explodeDir: v(pl.explodeDir) }
    }
    const v = (a: Vec3): Vec3 => {
      const [vx, vz] = rotXZ(a[0], a[2], turn.rot)
      return [vx, a[1], vz]
    }
    const [ox, oz] = rotXZ(o[0], o[2], turn.rot, turn.cx, turn.cz)
    return { origin: [ox + x, o[1] + y, oz + z], xAxis: v(pl.xAxis), yAxis: v(pl.yAxis), zAxis: v(pl.zAxis), explodeDir: v(pl.explodeDir) }
  }
}

/**
 * Mòduls que es trepitgen (una columna i un penjat a la mateixa X, una illa sobre la fila, el voladís d'un tauler de
 * taula dins del veí…): la caixa de les peces de cada mòdul no pot entrar dins d'una altra més de 0,5 mm en les tres
 * direccions. Un mòdul sense peces compta amb la seva caixa nominal.
 */
function overlapWarnings(comp: Composition, places: { x: number; y: number; z?: number }[], panels: Panel[]): CompositionWarning[] {
  const boxes = comp.modules.map((m, i) => {
    const own = panels.filter((q) => q.module === i + 1)
    if (own.length) {
      const b = localBox(own)
      return { m, lo: b.min, hi: b.max }
    }
    const p = places[i]!
    const z = p.z ?? 0
    return { m, lo: [p.x, p.y, z], hi: [p.x + m.carcass.width, p.y + m.carcass.height, z + m.carcass.depth] }
  })
  const out: CompositionWarning[] = []
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1)) {
      const ov = [0, 1, 2].map((k) => Math.min(a.hi[k]!, b.hi[k]!) - Math.max(a.lo[k]!, b.lo[k]!))
      if (!ov.every((o) => o > 0.5)) continue
      out.push({
        code: "overlap",
        moduleId: b.m.id,
        message: `Els mòduls «${a.m.name}» i «${b.m.name}» es trepitgen (${ov.map((o) => fmtNum(o, 1)).join(" × ")} mm): mou-ne un o canvia'n les mides.`,
      })
    }
  return out
}

/** Treu les peces sense mida (llarg, ample o gruix ≤ 0) de la llista i del seu mòdul, i n'avisa. */
function dropUnmakeable(panels: Panel[], modules: CompositionBuild["modules"], warnings: CompositionWarning[]): void {
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
}

/** L'id del mòdul amb aquest número (el de les peces, des d'1). */
function moduleIdAt(modules: CompositionBuild["modules"], index: number | undefined): string | undefined {
  return modules.find((m) => m.index === index)?.id
}

/**
 * Construeix tota la composició: cada mòdul al seu lloc (`modulePlacements`: fila,
 * potes, penjats i apilats), ids prefixats amb l'id del mòdul i el número de
 * mòdul a cada peça per a les refs del taller.
 */
export function buildComposition(input: Composition): CompositionBuild {
  // Passacables de la versió anterior → objectes que tallen. Un sol suport per als mòduls de terra (`withSupport`: els
  // mobles d'abans el prenen dels seus mòduls) i el sòcol de cada tram.
  // Un mòdul sense un lateral on en toca un altre: el lateral del veí l'aguanta (`withNeighbourSides`, lateral compartit).
  // Primer la posició: cada mòdul de la fila, girat cap a la paret que té al darrere (`withWallBacks`).
  const migrated = withNeighbourSides(withSupport(migrateCableHoles(withWallBacks(input), panelBox)))
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
  const fittingOrders: CompositionBuild["fittingOrders"] = []
  const linear: LinearPiece[] = []
  const wirings: CompositionBuild["wirings"] = []

  // Tipus «Lliure» (flat-pack): només peces lliures; els mòduls es guarden però no es fan.
  const onlyParts = partsOnlyKind(compositionKind(comp))
  // Columnes de la casa que entren pel darrere: els calaixos del seu tram, més curts (`columnRearLimits`).
  // I les columnes que travessen la base: on no hi va l'alimentador dels llums ni hi ha potes (`pillarKeepOut`).
  // El sòcol per defecte dels electrodomèstics de terra: l'alçada de les potes del moble (el sòcol del tram passa per davant).
  const appliancePlinth = comp.support && comp.support.kind !== "floor" ? comp.support.height : undefined
  // Amb sòcol (el del moble o el de les potes del mòdul), la llum a sota dels mòduls de terra quedaria amagada: no es fa (es guarda, per si es
  // canvia a potes vistes).
  const lit = (m: Module): Module => ((comp.support?.kind === "plinth" || (m.carcass.base.kind === "legs" && m.carcass.base.plinth)) && m.carcass.base.kind === "legs" && m.carcass.underLight ? { ...m, carcass: (({ underLight: _u, ...c }) => c)(m.carcass) } : m)
  const builds = onlyParts ? [] : comp.modules.map(lit).map((m, i) => buildModule(m, { ...(moduleRot(m) ? {} : { rearLimits: columnRearLimits(m, comp.references, places[i]!) }), keepOut: pillarKeepOut(comp, m, places[i]!), ...(appliancePlinth !== undefined ? { appliancePlinth } : {}), ...(compositionKind(comp) === "taula" ? { freestanding: true } : {}) }))
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
    // Girat al voltant del vertical pel centre de la caixa de les peces (`moduleRot`; el de darrere d'una illa, 180°):
    // l'origen i els eixos de cada peça es giren (gir, no mirall: les peces són les mateixes).
    const rot = backOf.has(m.id) ? 180 : moduleRot(m)
    // A la fila (arrambat, penjat o al terra sense X pròpia), al voltant del centre de la petjada (`modulePlacements`): el
    // lateral toca la paret i el mòdul ocupa la seva fondària a la fila.
    const inRow = !backOf.has(m.id) && !freeX(m)
    const turn = !rot ? undefined : inRow ? { rot, cx: m.carcass.width / 2, cz: moduleFrontFace(m) / 2 } : turnFrame(build.panels, rot)
    const place = placeIn(turn, x, y, z)
    for (const p of build.panels) panels.push({ ...p, id: `${m.id}:${p.id}`, module: i + 1, placement: place(p.placement) })
    for (const p of build.extras) moduleExtras.push({ ...p, id: `${m.id}:${p.id}`, module: i + 1, placement: place(p.placement) })
    for (const k of build.hardwareKits) hardwareKits.push({ ...k, module: i + 1, moduleId: m.id })
    for (const k of build.lightKits) lightKits.push({ ...k, module: i + 1, moduleId: m.id })
    for (const k of build.fittingOrders) fittingOrders.push({ ...k, module: i + 1, moduleId: m.id })
    for (const k of build.linear) linear.push({ ...k, module: i + 1, ...(k.run ? { run: { x0: k.run.x0 + x, x1: k.run.x1 + x, y: k.run.y + y, z: k.run.z + z } } : {}) })
    if (build.wiring) wirings.push({ module: i + 1, moduleId: m.id, name: m.name, width: m.carcass.width, height: m.carcass.height, wiring: build.wiring })
    // L'avís del push és de tot el moble: una sola vegada, no un per mòdul.
    for (const w of build.warnings) if (w.code !== "push" || !warnings.some((x) => x.code === "push")) warnings.push({ ...w, moduleId: m.id })
    // Mòdul penjat sense penjadors («Cap», o sense laterals on posar-los): el pes el porta el darrere. Cal fons cargolat o en ranura prou gruixut
    // i penjadors de moble; amb un fons prim o sense fons no s'aguanta. Amb els penjadors (v45), el pes va pels laterals.
    // Si els penjadors no hi caben pel fons, ja ho diu el seu avís (`hanging`, un per mòdul).
    const hangers = build.extras.some((p) => /^hanger-(left|right)$/.test(p.id)) || build.warnings.some((w) => w.code === "hanging")
    if (m.carcass.base.kind === "wall" && !hangers && (m.carcass.back === "none" || m.carcass.backThickness < 8))
      warnings.push({
        code: "hanging",
        moduleId: m.id,
        message: "Mòdul penjat: posa-hi penjadors de moble (regulables) i un fons d'almenys 8 mm o un travesser de penjar al darrere.",
      })
    modules.push({ id: m.id, index: i + 1, x, y, z, build, ...(turn ? { turn } : {}) })
  })

  if (!onlyParts) warnings.push(...overlapWarnings(comp, places, panels))

  // Dos mòduls que es toquen sense cap lateral entre ells: la base, la tapa i els prestatges en línia, d'una sola peça.
  if (!onlyParts) {
    const joined = joinInLinePanels(panels)
    if (joined.joined.length) panels.splice(0, panels.length, ...joined.panels)
  }

  // Peces corregudes (el taulell; el sòcol és el de cada tram) i el sòcol de cada tram: numerats com un «mòdul» més per
  // a les refs del taller.
  const runWarnings: RunWarning[] = []
  // A qualsevol moble amb mòduls; els apagats (`off`, els d'un moble que no era cuina) es conserven però no es fan.
  const runs = activeRuns(comp)
  const n = comp.modules.length + 1
  for (const run of runs) {
    // Com totes les peces: llarg ≥ ample (un taulell sobre un sol mòdul estret sortia girat).
    if (run.kind !== "worktop") continue
    const p = buildWorktop(comp, run, places, n, runWarnings)
    if (p) panels.push(normalizePanel(p))
  }
  for (const w of runWarnings) warnings.push({ code: "layout", message: w.message })
  const vents = builds.flatMap((b, i) => b.ventInlets.map((v) => ({ ...v, module: i })))
  const trams = onlyParts ? undefined : buildTramPlinths(comp, places, n, vents, (i) => (backOf.has(comp.modules[i]!.id) ? 180 : moduleRot(comp.modules[i]!)))
  if (trams) {
    for (const p of trams.panels) panels.push(normalizePanel(p))
    moduleExtras.push(...trams.extras)
    linear.push(...trams.linear)
    warnings.push(...trams.warnings)
  }
  const runPieces = runs.length > 0 || !!trams?.panels.length || !!trams?.extras.length

  // Panells de remat de les illes: un «mòdul» més per a les refs del taller (després del taulell i el sòcol).
  const islandN = comp.modules.length + (runPieces ? 1 : 0) + 1
  for (const isl of islands) {
    const own = panels.filter((p) => p.module === comp.modules.findIndex((m) => m.id === isl.front) + 1 || p.module === comp.modules.findIndex((m) => m.id === isl.back) + 1)
    for (const p of islandEndPanels(isl, comp, localBox(own), islandN)) panels.push(normalizePanel(p))
  }
  if (islands.length && !warnings.some((w) => w.code === "island"))
    warnings.push({ code: "island", message: "Illa: les dues files de mòduls es cargolen entre elles pel darrere (sense forats automàtics), amb els fronts enrasats; els panells de remat es fixen als laterals." })

  // Peces lliures, amb els encaixos entre elles: un «mòdul» més per a les refs del taller.
  const free = buildFreeParts(comp, onlyParts ? 1 : comp.modules.length + (runPieces ? 1 : 0) + (islands.some((i) => i.left || i.right) ? 1 : 0) + 1)
  panels.push(...free.panels)
  for (const w of free.warnings) warnings.push({ code: w.code ?? "layout", message: w.message, partId: w.partId })

  // Peces sense mida (llarg, ample o gruix ≤ 0, p. ex. un calaix sense lloc): no es poden fabricar. Es treuen i s'avisa.
  dropUnmakeable(panels, modules, warnings)

  // Ferratges col·locats a mà (generador de mecanitzats): tot o res per ferratge, avís `hardware` si no.
  if (comp.hardwarePlacements?.length)
    for (const w of applyHardwarePlacements(comp.hardwarePlacements, panels, [...moduleExtras, ...free.extras]).warnings) warnings.push(w)

  // Objectes que tallen: forat a cada peça que travessen.
  // Peces lliures en mode «Talla»: fan forats com els objectes que tallen.
  // També a les peces que no són de CNC (ferro, pedra, vidre): el forat es veu al 3D.
  // Una peça partida per un tall (una columna al mig del fons): els altres trossos, peces noves.
  const pieces: Panel[] = []
  const cutting = new Set<string>()
  // Un tros de fons (o el llistó del darrere d'una peça gruixuda) que queda tot darrere d'una columna de terra: no hi és
  // (els fons nous al voltant de la columna el substitueixen, `columnWalls`).
  const behindPillar = new Set<Panel>()
  const pillarIds = new Set(comp.references.filter((o) => o.effect === "cut" && isPillar(o) && o.y <= 1).map((o) => o.id))
  for (const pr of applyRefCuts([...panels, ...free.extras], [...comp.references, ...partCutters(comp)], panelBox, (p) => free.extras.includes(p), pieces, cutting)) {
    if (pr.eaten && pillarIds.has(pr.refId) && (pr.panel.role === "back" || pr.panel.role === "spacer")) {
      behindPillar.add(pr.panel)
      continue
    }
    const moduleId = moduleIdAt(modules, pr.panel.module)
    const owner = pr.refId.startsWith("part:") ? { partId: pr.refId.slice(5) } : { refId: pr.refId }
    warnings.push({ code: "ref-cut", message: pr.message, panelId: pr.panel.id, ...owner, ...(moduleId ? { moduleId } : {}), ...(pr.options ? { options: pr.options } : {}) })
  }
  for (const piece of pieces) (free.extras.some((x) => piece.id.startsWith(`${x.id}-`)) ? free.extras : panels).push(piece)
  // La regleta i els penjadors dels penjats: la columna també els talla (`hangingCuts.ts`).
  const hanging = clipHangingToRefs(moduleExtras, linear, comp.references, panelBox)
  for (const { moduleIndex, ...w } of hanging.warnings) {
    const moduleId = moduleIdAt(modules, moduleIndex)
    warnings.push({ ...w, ...(moduleId ? { moduleId } : {}) })
  }
  for (const h of hanging.removed) {
    const k = fittingOrders.findIndex((l) => l.module === h.module && l.name === h.name)
    if (k < 0) continue
    const line = fittingOrders[k]!
    const { note: _note, ...rest } = line
    if (line.qty <= 1) fittingOrders.splice(k, 1)
    else fittingOrders[k] = { ...rest, qty: line.qty - 1 }
  }
  // Columnes de la casa que entren pel darrere: els fons que falten a les seves cares, amb les ranures (`columnWalls`).
  if (comp.references.some((o) => o.effect === "cut")) {
    const cw = columnWalls(panels, comp.references, modules.flatMap((m) => {
      const module = comp.modules.find((x) => x.id === m.id)
      return module ? [{ id: m.id, index: m.index, module, backKinds: m.build.backKinds }] : []
    }), panelBox)
    panels.push(...cw.added)
    for (const gone of [...behindPillar, ...cw.removed]) {
      const i = panels.indexOf(gone)
      if (i >= 0) panels.splice(i, 1)
    }
    for (const pr of cw.problems) {
      const moduleId = moduleIdAt(modules, pr.panel.module)
      warnings.push({ code: "ref-cut", message: pr.message, panelId: pr.panel.id, refId: pr.refId, ...(moduleId ? { moduleId } : {}) })
    }
    // Les potes de l'app (AXILO 78) a les cantonades de la base retallada, com les genèriques.
    const legModules = modules.flatMap((m) => {
      const module = comp.modules.find((x) => x.id === m.id)
      return module && !moduleRot(module) ? [{ index: m.index, module }] : []
    })
    for (const pr of relayLegs(panels, legModules)) {
      const moduleId = moduleIdAt(modules, pr.panel.module)
      warnings.push({ code: "hardware", message: pr.message, panelId: pr.panel.id, ...(moduleId ? { moduleId } : {}) })
    }
  }

  // Forats que es troben per dins (System 32 a banda i banda d'un divisor, espiga contra guia):
  // s'escurcen com ho faria un tècnic; els que no es poden resoldre, s'avisen.
  for (const p of panels)
    for (const message of resolveHoleClashes(p)) {
      const moduleId = moduleIdAt(modules, p.module)
      warnings.push({ code: "hole-clash", message, panelId: p.id, ...(moduleId ? { moduleId } : {}) })
    }

  // Obstacles que xoquen amb alguna peça. Les peces lliures del seu mateix grup no hi xoquen: són la mateixa cosa (la
  // forma dels llistons, `slices.ts`, i els llistons que n'han sortit).
  const partGroup = new Map(resolveParts(comp).map((p) => [`part:${p.id}`, p.group]))
  for (const ref of comp.references) {
    if (ref.effect === "cut") continue
    const hit = panels.find((p) => !(ref.group && partGroup.get(p.id) === ref.group) && refTouchesBox(ref, panelBox(p)))
    if (hit) {
      const moduleId = moduleIdAt(modules, hit.module)
      warnings.push({ code: "collision", message: `«${ref.name}» xoca amb ${hit.label}.`, panelId: hit.id, refId: ref.id, ...(moduleId ? { moduleId } : {}) })
    }
  }

  // Sense l'avís de peces de la mateixa mida amb mecanitzats diferents (per decisió de l'usuari, 2026-10-13: el taller
  // identifica cada peça per l'etiqueta, A.1.L.1 ≠ A.1.L.2, no per la mida). `sameSizeConflicts` es queda sense ús.

  // Materials massissos (`MaterialPref.solid`): cap cantell. Es fa al final, per a totes les peces (mòduls, taulell i
  // sòcol, peces lliures), així el llistat, el CSV, el LLEGEIX-ME i el 3D en diuen el mateix.
  for (const [i, p] of panels.entries()) if (isSolidMaterial(p.material)) panels[i] = { ...p, edges: { ...NO_EDGES } }

  return { panels, warnings, modules, joints: free.joints, extras: [...moduleExtras, ...free.extras], models: input.models ?? [], hardwareKits, lightKits, fittingOrders, linearOrders: buildLinearOrders(linear), wirings, cutting: [...cutting] }
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
