import {
  DEFAULT_HARDWARE_KIT,
  damagedImportMessage,
  evalExpr,
  hardwareVars,
  isDamagedImport,
  isPendingImport,
  slotOf,
  stepValue,
  type Cutout,
  type HardwareItem,
  type HardwareKit,
  type HardwareSlot,
  type Hole,
} from "../model"
import { r } from "./geometry"

/**
 * Motor dels ferratges (millores v1 F1, `docs/millores-v1/ferratges.md` §4.1): **pur**, l'única porta entre un
 * `HardwareItem` (dades) i els mecanitzats de les peces. Les regles de col·locació de cada contingut (la porta posa
 * cassoletes a la filera System 32, el calaix fa forats de guia…) es queden al constructor (`buildModule`), que en
 * demana els números (`cupSpec`, `slideSpec`…) i els mecanitzats (`applyHardware`, `drillSpec`): els exports no canvien
 * (tot acaba en `Hole` / `Cutout`).
 */

export class HardwareError extends Error {}

/** Mecanitzat avaluat (números en mm). */
export type ResolvedOp =
  | { kind: "drill"; face: "A" | "B"; u: number; v: number; d: number; depth: number; tag?: string }
  | { kind: "edgeDrill"; along: number; d: number; depth: number; tag?: string }
  | { kind: "through"; u: number; v: number; d: number; tag?: string }

function target(item: HardwareItem, key: string) {
  const t = item.targets.find((x) => x.key === key)
  if (!t) throw new HardwareError(`«${item.name}» no té mecanitzats per a «${key}»`)
  return t
}

const ev = (item: HardwareItem, e: number | string, vars: Record<string, number>, what: string): number => {
  try {
    return evalExpr(e, vars)
  } catch (err) {
    throw new HardwareError(`«${item.name}», ${what}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Els mecanitzats d'una peça del ferratge (`target`), avaluats amb els paràmetres i les mides `extra`. */
export function resolveOps(item: HardwareItem, key: string, extra: Record<string, number> = {}): ResolvedOp[] {
  const vars = hardwareVars(item, extra)
  return target(item, key).ops.map((op): ResolvedOp => {
    const tag = op.tag ? { tag: op.tag } : {}
    const d = ev(item, op.d, vars, "diàmetre")
    if (!(d > 0)) throw new HardwareError(`«${item.name}»: diàmetre ${d}`)
    if (op.kind === "edgeDrill") return { kind: "edgeDrill", along: ev(item, op.along, vars, "posició"), d, depth: ev(item, op.depth, vars, "fondària"), ...tag }
    if (op.kind === "through") return { kind: "through", u: ev(item, op.u, vars, "posició"), v: ev(item, op.v, vars, "posició"), d, ...tag }
    return { kind: "drill", face: op.face, u: ev(item, op.u, vars, "posició"), v: ev(item, op.v, vars, "posició"), d, depth: ev(item, op.depth, vars, "fondària"), ...tag }
  })
}

/** Diàmetre, fondària i tag del primer forat d'una peça del ferratge (per als forats que el constructor col·loca al moble). */
export function drillSpec(item: HardwareItem, key: string, extra: Record<string, number> = {}): { diameter: number; depth: number; tag?: string } {
  const op = resolveOps(item, key, extra)[0]
  if (!op || op.kind === "through") throw new HardwareError(`«${item.name}»: «${key}» no és un forat cec`)
  return { diameter: op.d, depth: op.depth, ...(op.tag ? { tag: op.tag } : {}) }
}

/**
 * On cau el punt d'ancoratge a la peça (coordenades locals) i com hi van els mecanitzats: `axis` = l'eix local on va u
 * (x per defecte; «y» gira un quart), `mirrorX`/`mirrorY` = la mida de la peça per mesurar des de l'altre cantell
 * (frontissa a la dreta, abatible que obre amunt), `round` = arrodonir a la centèsima (com `r`).
 */
export interface HardwareFrame {
  at: { x: number; y: number }
  axis?: "x" | "y"
  mirrorX?: number
  mirrorY?: number
  round?: boolean
}

/** Aplica els mecanitzats cecs i passants d'una peça del ferratge en un punt: els forats i talls que hi fan. */
export function applyHardware(item: HardwareItem, key: string, extra: Record<string, number>, frame: HardwareFrame): { holes: Hole[]; cutouts: Cutout[] } {
  const holes: Hole[] = []
  const cutouts: Cutout[] = []
  const place = (u: number, v: number): [number, number] => {
    const [du, dv] = frame.axis === "y" ? [v, u] : [u, v]
    let x = frame.at.x + du
    let y = frame.at.y + dv
    if (frame.mirrorX !== undefined) x = r(frame.mirrorX - x)
    else if (frame.round) x = r(x)
    if (frame.mirrorY !== undefined) y = r(frame.mirrorY - y)
    else if (frame.round) y = r(y)
    return [x, y]
  }
  for (const op of resolveOps(item, key, extra)) {
    if (op.kind === "edgeDrill") continue
    const [x, y] = place(op.u, op.v)
    if (op.kind === "through") cutouts.push({ kind: "circle", x, y, diameter: op.d, ...(op.tag ? { tag: op.tag } : {}) })
    else holes.push({ x, y, diameter: op.d, depth: op.depth, face: op.face, ...(op.tag ? { tag: op.tag } : {}) })
  }
  return { holes, cutouts }
}

const param = (item: HardwareItem, key: string): number => {
  const v = item.params[key]
  if (v === undefined || !Number.isFinite(v)) throw new HardwareError(`«${item.name}»: falta el paràmetre «${key}»`)
  return v
}

function expectEngine(item: HardwareItem, engine: HardwareItem["engine"]): void {
  if (item.engine !== engine) throw new HardwareError(`«${item.name}» no és del tipus que toca`)
}

/** Forats cecs de la placa (target `side`) a punt per al lateral: u amunt/avall, v cap al darrere, des de la referència. */
function plateHoles(item: HardwareItem): { u: number; v: number; d: number; depth: number; tag?: string }[] {
  return resolveOps(item, "side").flatMap((o) => (o.kind === "drill" ? [{ u: o.u, v: o.v, d: o.d, depth: o.depth, ...(o.tag ? { tag: o.tag } : {}) }] : []))
}

/**
 * Frontissa de cassoleta: números de la regla (`addCups`) i la quantitat per alçada (la taula de `hingeCount` com a dades).
 * Una d'importada pot portar la placa aparellada (`plate`: els seus forats al lateral, a `plateSetback` del davant i
 * `plateOffset` per sobre de la cassoleta) i, sense confirmar, `pending` (no fa cap forat).
 */
export function cupSpec(item: HardwareItem) {
  expectEngine(item, "cup")
  if (isDamagedImport(item)) throw new HardwareError(damagedImportMessage(item))
  const door = drillSpec(item, "door")
  const count = item.count
  if (!count) throw new HardwareError(`«${item.name}»: falta la quantitat per alçada`)
  const plate = item.targets.some((t) => t.key === "side")
    ? { setback: item.params.plateSetback ?? 37, offset: item.params.plateOffset ?? 0, holes: plateHoles(item) }
    : undefined
  return {
    pending: isPendingImport(item),
    /** Importat que no es pot fer servir (malmès o amb un error): cap forat i aquest avís (`inertHinge`). */
    unusable: undefined as string | undefined,
    ...(plate ? { plate } : {}),
    cupDiameter: param(item, "cupDiameter"),
    cupDepth: param(item, "cupDepth"),
    cupOffset: param(item, "cupOffset"),
    endOffset: param(item, "endOffset"),
    gap: param(item, "gap"),
    margin: param(item, "margin"),
    hole: door,
    count: (height: number) => Math.max(1, Math.round(stepValue(count, height))),
  }
}

export function system32Spec(item: HardwareItem) {
  expectEngine(item, "system32")
  return { edgeOffset: param(item, "edgeOffset"), pitch: param(item, "pitch"), diameter: param(item, "diameter"), depth: param(item, "depth"), hole: drillSpec(item, "side") }
}

export function dowelSpec(item: HardwareItem) {
  expectEngine(item, "dowel")
  const butt = drillSpec(item, "butt")
  const through = drillSpec(item, "through")
  return { diameter: through.diameter, faceDepth: through.depth, edgeDepth: butt.depth, endOffset: param(item, "endOffset"), tag: through.tag ?? "dowel" }
}

export function slideSpec(item: HardwareItem) {
  expectEngine(item, "slide")
  if (!item.lengths?.length) throw new HardwareError(`«${item.name}»: falten les llargades`)
  return {
    slideLengths: item.lengths,
    sideClearance: param(item, "sideClearance"),
    boxThickness: param(item, "boxThickness"),
    bottomThickness: param(item, "bottomThickness"),
    boxDrop: param(item, "boxDrop"),
    bottomOffset: param(item, "bottomOffset"),
    backClearance: param(item, "backClearance"),
    frontOffset: param(item, "frontOffset"),
    secondOffset: param(item, "secondOffset"),
    holeHeight: param(item, "holeHeight"),
    side: drillSpec(item, "side"),
    box: drillSpec(item, "box"),
  }
}

export function flapSpec(item: HardwareItem) {
  expectEngine(item, "flapArm")
  return { offset: param(item, "offset"), diameter: param(item, "diameter"), depth: param(item, "depth"), endOffset: param(item, "endOffset"), hole: drillSpec(item, "flap") }
}

export function magnetSpec(item: HardwareItem) {
  expectEngine(item, "magnet")
  return { diameter: param(item, "diameter"), depth: param(item, "depth"), cornerOffset: param(item, "cornerOffset"), front: drillSpec(item, "front"), side: drillSpec(item, "side") }
}

/**
 * Tirador: els números de la regla (`handle` de `buildModule`: centrat als calaixos, a `inset` del cantell que obre a les
 * portes i abatibles) i la distància entre forats segons l'espai. Un d'importat (`imported`) en porta una de fixa (la del
 * fitxer, `pitch` sense graons) i, sense confirmar, `pending`: cap forat.
 */
export function handleSpec(item: HardwareItem) {
  expectEngine(item, "barHandle")
  if (isDamagedImport(item)) throw new HardwareError(damagedImportMessage(item))
  const rule = item.pitch
  if (!rule) throw new HardwareError(`«${item.name}»: falta la distància entre forats`)
  // Comprova els talls amb la distància més gran (els de veritat es fan amb la que toca a cada front).
  const ops = resolveOps(item, "front", { pitch: rule.else })
  if (item.imported && !ops.length) throw new HardwareError(`«${item.name}»: no té cap forat`)
  return {
    pending: isPendingImport(item),
    /** Importat que no es pot fer servir (malmès o amb un error): cap forat i aquest avís (`inertHandle`). */
    unusable: undefined as string | undefined,
    diameter: param(item, "diameter"),
    margin: param(item, "margin"),
    inset: param(item, "inset"),
    pitch: (room: number) => stepValue(rule, room),
  }
}

/**
 * Pota importada (`Base.hardware` de la base «Potes»): a `inset` de les vores de fora del mòdul, una a cada cantonada;
 * els forats de la placa (target `base`, al marc de la pota: u = X del mòdul, v = cap al davant) a la cara de sota de la
 * base. Sense confirmar, `pending`: cap forat.
 */
export function legSpec(item: HardwareItem) {
  expectEngine(item, "leg")
  if (isDamagedImport(item)) throw new HardwareError(damagedImportMessage(item))
  const holes = resolveOps(item, "base").flatMap((o) => (o.kind === "drill" ? [{ u: o.u, v: o.v, d: o.d, depth: o.depth, tag: o.tag ?? "leg" }] : []))
  if (!holes.length) throw new HardwareError(`«${item.name}»: no té cap forat`)
  return { pending: isPendingImport(item), inset: param(item, "inset"), holes }
}

/** Placa de muntatge importada (no té lloc: la frontissa que s'hi aparella en copia els forats). */
export function plateSpec(item: HardwareItem) {
  expectEngine(item, "plate")
  return { setback: param(item, "setback"), offset: item.params.offset ?? 0, holes: plateHoles(item) }
}

const SPECS = { hinge: cupSpec, system32: system32Spec, dowel: dowelSpec, slide: slideSpec, flap: flapSpec, magnet: magnetSpec, handle: handleSpec } as const
export type SlotSpec<S extends HardwareSlot> = ReturnType<(typeof SPECS)[S]>

/**
 * Frontissa importada que no serveix (malmesa, o un mecanitzat o paràmetre dolent): **cap forat**, ni la del d'inici. Els
 * números (per al tirador, la reixeta…) són els de la frontissa d'inici, però `pending` i `unusable` fan que `addCups` no
 * foradi res i avisi amb el nom de l'item.
 */
function inertHinge(item: HardwareItem, error: string): SlotSpec<"hinge"> {
  const base = cupSpec(DEFAULT_HARDWARE_KIT.hinge)
  const prefix = `«${item.name}»`
  const why = error.startsWith(prefix) ? error.slice(prefix.length).replace(/^[:,]\s*/, "") : error
  const unusable = isDamagedImport(item) ? damagedImportMessage(item) : `«${item.name}» és importada i no es pot fer servir (${why}): la porta queda sense cassoletes ni forats. Revisa-la a Preferències › Ferratges.`
  return { ...base, pending: true, unusable }
}

/** Tirador importat que no serveix: cap forat (ni els del tirador d'inici), amb l'avís del nom de l'item. */
function inertHandle(item: HardwareItem, error: string): SlotSpec<"handle"> {
  const base = handleSpec(DEFAULT_HARDWARE_KIT.handle)
  const prefix = `«${item.name}»`
  const why = error.startsWith(prefix) ? error.slice(prefix.length).replace(/^[:,]\s*/, "") : error
  const unusable = isDamagedImport(item) ? damagedImportMessage(item) : `«${item.name}» és un tirador importat i no es pot fer servir (${why}): el front queda sense forats del tirador. Revisa'l a Preferències › Ferratges.`
  return { ...base, pending: true, unusable }
}

/**
 * Els números d'un lloc amb un item; si l'item no serveix (un altre tipus, un paràmetre que falta, una fórmula dolenta),
 * el d'inici de l'app i un avís (`onError`): mai es fa mig ferratge. **Un importat que no serveix no torna mai al d'inici**
 * (forataria on no s'ha revisat): queda inert (`inertHinge`, `failed`) i l'avís el fa qui el fa servir (`addCups`).
 */
export function slotSpec<S extends HardwareSlot>(slot: S, item: HardwareItem | undefined, onError?: (message: string) => void): { spec: SlotSpec<S>; item: HardwareItem; failed?: boolean } {
  const fn = SPECS[slot] as (i: HardwareItem) => SlotSpec<S>
  if (item) {
    try {
      return { spec: fn(item), item }
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      if (item.imported && slot === "hinge") return { spec: inertHinge(item, why) as SlotSpec<S>, item, failed: true }
      if (item.imported && slot === "handle") return { spec: inertHandle(item, why) as SlotSpec<S>, item, failed: true }
      onError?.(`${slotOf(slot).label}: ${why}. Es fa servir el d'inici de l'app.`)
    }
  }
  const fallback = DEFAULT_HARDWARE_KIT[slot]
  return { spec: fn(fallback), item: fallback, ...(item ? { failed: true } : {}) }
}

/** Tots els llocs d'un kit resolts (els del mòdul). */
export function resolveKit(kit: HardwareKit, onError?: (message: string) => void) {
  return {
    hinge: slotSpec("hinge", kit.hinge, onError),
    system32: slotSpec("system32", kit.system32, onError),
    dowel: slotSpec("dowel", kit.dowel, onError),
    slide: slotSpec("slide", kit.slide, onError),
    flap: slotSpec("flap", kit.flap, onError),
    magnet: slotSpec("magnet", kit.magnet, onError),
    handle: slotSpec("handle", kit.handle, onError),
  }
}
export type ResolvedKit = ReturnType<typeof resolveKit>
