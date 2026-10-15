import { activeRuns, compositionKind, freeX, isTurned, modulePlacements, partsOnlyKind, type ModulePlacement } from "./composition"
import type { Composition, PlinthRun } from "./compositionSchema"
import type { Base, Module } from "./moduleSchema"
import { isApplianceModule, moduleApplianceCarcass, visibleModule } from "./moduleVisible"
import type { FloorSupport, TramSides } from "./supportSchema"

/**
 * El **suport dels mòduls de terra** i els **trams** (per decisió de l'usuari, 2026-10-15: «és un sòcol per a tots els
 * mòduls i no un per a cada un»; «el sòcol no pot anar per cada mòdul, és una peça global»). Un sol suport per a tot el
 * moble (`Composition.support`): `withSupport` l'escriu a la base de cada mòdul de terra i la construcció fa **un sòcol per
 * tram** (`core/build/tramPlinth.ts`). I el **tipus** del mòdul (Baix · Penjat · Columna · Electrodomèstic). Pur.
 */

// --- Tipus del mòdul ---------------------------------------------------------------------------------------------------

export type ModuleType = "base" | "wall" | "tall" | "appliance"

export const MODULE_TYPE_LABELS: Record<ModuleType, string> = { base: "Baix", wall: "Penjat", tall: "Columna", appliance: "Electrodomèstic" }

/** Alçada a partir de la qual un mòdul sense tipus és una columna. */
export const TALL_FROM = 1200

/**
 * El tipus d'un mòdul: Electrodomèstic si ho és (o s'ha triat i encara no té l'aparell), Penjat si penja de la paret,
 * i Baix o Columna (el triat o, sense, per l'alçada).
 */
export function moduleType(m: Module): ModuleType {
  if (m.type === "appliance" || isApplianceModule(m)) return "appliance"
  if (m.carcass.base.kind === "wall") return "wall"
  if (m.type === "tall") return "tall"
  if (m.type === "base") return "base"
  return m.carcass.height >= TALL_FROM ? "tall" : "base"
}

// --- Trams -------------------------------------------------------------------------------------------------------------

/** Un tram: mòduls de terra que es toquen (de costat o d'esquena, com una illa). */
export interface FloorTram {
  /** L'id del primer mòdul (en l'ordre de la composició): la clau dels seus costats. */
  id: string
  /** Índexs dels mòduls a `comp.modules`, en ordre. */
  modules: number[]
  /** Cap mòdul arrambat a la paret: una illa o un moble solt. */
  free: boolean
}

/** Cara dels fronts d'un mòdul des del darrere de la caixa: recobrents, per davant (un gruix); encastats, a ras. */
export function moduleFrontFace(m: Module): number {
  return m.carcass.depth + (visibleModule(m).fronts.style === "inset" ? 0 : m.carcass.thickness)
}

/** Es toquen de costat (≤ 1 mm) o d'esquena (≤ 50 mm, el pas de cables d'una illa). */
const SIDE_GAP = 1
const BACK_GAP = 50

/**
 * Els trams del moble: els mòduls de terra (no els penjats) agrupats per contacte a la planta, de costat (la fila, una
 * columna al costat d'un baix, un rentaplats al mig) o d'esquena (les dues files d'una illa). `places`: on és cada mòdul
 * (per defecte `modulePlacements`; la construcció hi passa les de les illes).
 */
export function floorTrams(comp: Pick<Composition, "modules" | "kind" | "runs" | "parts">, places: ModulePlacement[] = modulePlacements(comp as Composition)): FloorTram[] {
  if (partsOnlyKind(compositionKind(comp as Composition))) return []
  // Amb potes, un mòdul que va directe a terra (sense base, com un cobreradiador) no és del tram: el sòcol no el tapa. Els
  // electrodomèstics de terra sí (el sòcol passa per davant, sota el seu front).
  const onLegs = (comp as Composition).support?.kind !== "floor"
  const inTram = (m: Module) => m.carcass.base.kind !== "wall" && (!onLegs || m.carcass.base.kind === "legs" || isApplianceModule(m) || !(comp as Composition).support)
  const idx = comp.modules.map((m, i) => (inTram(m) ? i : -1)).filter((i) => i >= 0)
  const box = (i: number) => {
    const m = comp.modules[i]!
    const p = places[i]!
    const z = p.z ?? 0
    return { x0: p.x, x1: p.x + m.carcass.width, z0: z, z1: z + moduleFrontFace(m) }
  }
  const parent = new Map<number, number>(idx.map((i) => [i, i]))
  const find = (i: number): number => {
    while (parent.get(i) !== i) i = parent.get(i)!
    return i
  }
  for (let a = 0; a < idx.length; a++)
    for (let b = a + 1; b < idx.length; b++) {
      const A = box(idx[a]!), B = box(idx[b]!)
      const overlapX = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)
      const overlapZ = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0)
      const gapX = Math.max(A.x0, B.x0) - Math.min(A.x1, B.x1)
      const gapZ = Math.max(A.z0, B.z0) - Math.min(A.z1, B.z1)
      const side = overlapZ > 1 && gapX <= SIDE_GAP && gapX >= -SIDE_GAP
      const back = overlapX > 1 && gapZ <= BACK_GAP && gapZ >= -SIDE_GAP
      if (side || back) parent.set(find(idx[b]!), find(idx[a]!))
    }
  const groups = new Map<number, number[]>()
  for (const i of idx) groups.set(find(i), [...(groups.get(find(i)) ?? []), i])
  return [...groups.values()]
    .map((list) => list.sort((a, b) => a - b))
    .sort((a, b) => a[0]! - b[0]!)
    .map((list) => ({ id: comp.modules[list[0]!]!.id, modules: list, free: list.every((i) => freeX(comp.modules[i]!) || (comp.modules[i]!.wallGap ?? 0) > 0) }))
}

/** Els costats d'un tram: els desats (per l'id de qualsevol dels seus mòduls) o, sense, els per defecte. */
export function tramSides(support: FloorSupport, tram: FloorTram, comp: Pick<Composition, "modules">): TramSides {
  for (const i of tram.modules) {
    const s = support.trams?.[comp.modules[i]!.id]
    if (s) return s
  }
  return tram.free ? { back: true, left: true, right: true } : {}
}

/** Desa els costats d'un tram (amb la clau del tram; treu les d'altres mòduls seus). */
export function setTramSides(support: FloorSupport, tram: FloorTram, comp: Pick<Composition, "modules">, sides: TramSides): FloorSupport {
  const ids = new Set(tram.modules.map((i) => comp.modules[i]!.id))
  const trams = Object.fromEntries(Object.entries(support.trams ?? {}).filter(([k]) => !ids.has(k)))
  return { ...support, trams: { ...trams, [tram.id]: sides } }
}

// --- El suport a cada mòdul --------------------------------------------------------------------------------------------

/** La base que el suport posa a cada mòdul de terra. */
export function supportBase(s: FloorSupport): Base {
  if (s.kind === "floor") return { kind: "none" }
  return { kind: "legs", height: s.height, ...(s.leg ? { hardware: s.leg } : {}) }
}

const baseKey = (b: Base) => JSON.stringify(b)

/** Retirada per defecte del sòcol (de la cara dels fronts): el peu de la pota del davant (Ø78) just darrere, amb 5 mm de joc. */
export function defaultPlinthSetback(s: Pick<FloorSupport, "leg">, m?: Module): number {
  const inset = Number(s.leg?.params.insetFront ?? s.leg?.params.inset ?? 50)
  const t = m?.carcass.thickness ?? 19
  const overlay = m ? moduleFrontFace(m) - m.carcass.depth : t
  return Math.max(0, Math.round(inset - 39 - 5 - t)) + overlay
}

/**
 * El suport d'un moble d'abans (sense `support`), dels seus mòduls: el més repetit dels de terra (sense comptar els
 * electrodomèstics, que fixen el seu); el sòcol, el de les potes d'algun mòdul o el sòcol corregut (`runs`); el sòcol de
 * caixa d'abans (laterals fins a terra), un sòcol amb la mateixa alçada i retirada. Els costats de cada tram, els dels
 * sòcols dels mòduls dels extrems. `undefined` si no té cap mòdul de terra.
 */
export function deriveSupport(comp: Composition): FloorSupport | undefined {
  const floor = comp.modules.filter((m) => m.carcass.base.kind !== "wall")
  if (!floor.length) return undefined
  const pool = floor.filter((m) => !isApplianceModule(m))
  const list = pool.length ? pool : floor
  const count = new Map<string, { n: number; m: Module }>()
  for (const m of list) {
    const b = m.carcass.base
    const key = b.kind === "legs" ? `legs:${b.height}:${b.hardware?.id ?? ""}` : b.kind === "plinth" ? `plinth:${b.height}:${b.setback}` : "none"
    const c = count.get(key)
    count.set(key, { n: (c?.n ?? 0) + 1, m: c?.m ?? m })
  }
  const top = [...count.values()].sort((a, b) => b.n - a.n)[0]!.m
  const b = top.carcass.base
  const legPlinth = floor.find((m) => m.carcass.base.kind === "legs" && m.carcass.base.plinth)
  const run = activeRuns(comp).find((r): r is PlinthRun => r.kind === "plinth")
  // El sòcol de caixa d'abans: els laterals baixaven fins a terra i tapaven els extrems; ara, els retorns del sòcol a ras
  // dels laterals a cada tram (i el darrere a les illes).
  if (b.kind === "plinth") {
    const trams = Object.fromEntries(floorTrams(comp).map((t) => [t.id, { left: true, right: true, ...(t.free ? { back: true } : {}) }]))
    return { kind: "plinth", height: b.height, plinth: { setback: b.setback + moduleFrontFace(top) - top.carcass.depth, sideSetback: 0 }, trams }
  }
  if (b.kind !== "legs") return { kind: "floor", height: 100, plinth: { setback: 20 } }
  const leg = b.hardware
  const base: FloorSupport = { kind: legPlinth || run ? "plinth" : "legs", height: b.height, ...(leg ? { leg } : {}), plinth: { setback: defaultPlinthSetback({ leg }, top) } }
  if (legPlinth && legPlinth.carcass.base.kind === "legs" && legPlinth.carcass.base.plinth) {
    const p = legPlinth.carcass.base.plinth
    base.plinth = {
      setback: p.setback + moduleFrontFace(legPlinth) - legPlinth.carcass.depth,
      ...(p.sideSetback !== undefined ? { sideSetback: p.sideSetback } : {}),
      ...(p.corners ? { corners: p.corners } : {}),
      ...(p.hardware ? { hardware: p.hardware } : {}),
    }
  } else if (run) {
    base.plinth = {
      setback: run.setback,
      ...(run.sideSetback !== undefined ? { sideSetback: run.sideSetback } : {}),
      ...(run.corners ? { corners: run.corners } : {}),
      ...(run.hardware ? { hardware: run.hardware } : {}),
      material: run.material,
      thickness: run.thickness,
    }
  }
  // Els costats de cada tram: els dels sòcols de les potes dels mòduls dels extrems (o el del sòcol corregut).
  const trams: Record<string, TramSides> = {}
  const xs = modulePlacements(comp)
  for (const tram of floorTrams(comp, xs)) {
    const ms = tram.modules.map((i) => comp.modules[i]!)
    const ps = ms.map((m) => (m.carcass.base.kind === "legs" ? m.carcass.base.plinth : undefined))
    const order = [...tram.modules].sort((a, c) => xs[a]!.x - xs[c]!.x)
    const pOf = (i: number) => {
      const m = comp.modules[i]!
      return m.carcass.base.kind === "legs" ? m.carcass.base.plinth : undefined
    }
    const leftMost = pOf(order[0]!), rightMost = pOf(order[order.length - 1]!)
    const runHere = run && ms.some((m) => m.id === run.from || m.id === run.to) ? run : undefined
    const sides: TramSides = {
      ...(ps.some((p) => p?.back) ? { back: true } : {}),
      ...(leftMost?.left || runHere?.left ? { left: true } : {}),
      ...(rightMost?.right || runHere?.right ? { right: true } : {}),
    }
    // Un tram lliure (una illa) que ja portava sòcol només al davant ho conserva; sense sòcol d'abans, el per defecte.
    if (Object.keys(sides).length || (tram.free && ps.some(Boolean))) trams[tram.id] = sides
  }
  return Object.keys(trams).length ? { ...base, trams } : base
}

/**
 * **El suport a tots els mòduls de terra** (idempotent: si ja hi és, torna la mateixa composició). Un moble sense `support`
 * el pren dels seus mòduls (`deriveSupport`). Cada mòdul de terra porta la base del suport (`supportBase`: sense el sòcol
 * de cada mòdul d'abans) i els sòcols correguts d'abans (`runs`) es treuen: el sòcol és el de cada tram. Els mobles només
 * de peces no en tenen.
 */
export function withSupport(comp: Composition): Composition {
  const kind = compositionKind(comp)
  if (partsOnlyKind(kind)) return comp
  const support = comp.support ?? deriveSupport(comp)
  if (!support) return comp
  const base = supportBase(support)
  const key = baseKey(base)
  let changed = support !== comp.support
  const floorKey = baseKey({ kind: "none" })
  const modules = comp.modules.map((m) => {
    const b = m.carcass.base
    // Un mòdul sense base (un cobreradiador) no pot anar sobre potes (s'hi cargolen): va directe a terra.
    const own = base.kind === "legs" && (b.kind === "open" || (b.kind !== "legs" && !!m.carcass.noBottom)) ? floorKey : key
    if (b.kind === "wall" || baseKey(b) === own) return m
    changed = true
    // El sòcol de caixa d'abans (laterals fins a terra, la base aixecada) comptava dins de l'alçada del mòdul: amb potes,
    // el mòdul comença a dalt de les potes i fa aquesta alçada menys (a dalt queda on era). El «Sense base» d'abans
    // (`open`) es conserva com a `noBottom`.
    const target: Base = own === key ? base : { kind: "none" }
    const height = b.kind === "plinth" && target.kind === "legs" ? Math.max(100, m.carcass.height - target.height) : m.carcass.height
    // El que amagava la base d'abans (la llum a sota sense potes, l'inglet sense on fer-lo) no compta tampoc ara.
    const vis = visibleModule(m).carcass
    const carcass = { ...m.carcass, base: target, height, ...(b.kind === "open" ? { noBottom: true } : {}) }
    if (!vis.underLight) delete carcass.underLight
    if (!vis.joint) delete carcass.joint
    return { ...m, carcass }
  })
  const runs = comp.runs?.some((r) => r.kind === "plinth") ? comp.runs.filter((r) => r.kind !== "plinth") : comp.runs
  if (runs !== comp.runs) changed = true
  if (!changed) return comp
  // El tipus d'un moble d'abans es deduïa dels sòcols correguts: es fixa abans de treure'ls.
  return { ...comp, kind, support, modules, ...(runs ? { runs } : {}) }
}

/** Canvia el suport i el porta a tots els mòduls de terra. */
export function setSupport(comp: Composition, support: FloorSupport): Composition {
  return withSupport({ ...comp, support })
}

/** Alçada fins on arriba un mòdul (de terra a dalt), amb el suport que porta (un electrodomèstic de terra, directe a terra). */
function moduleTop(m: Module, y: number): number {
  return (moduleApplianceCarcass(m)?.rule.support === false ? 0 : y) + m.carcass.height
}

/**
 * Els mòduls d'un tram que no arriben a la mateixa alçada que els altres baixos (el taulell no quedaria pla): `[mòdul, la
 * seva alçada de dalt, la dels altres]`. Les columnes no compten (van més amunt).
 */
export function tramHeightMismatches(comp: Composition, tram: FloorTram, places: ModulePlacement[]): { module: Module; top: number; expected: number }[] {
  const low = tram.modules.filter((i) => moduleType(comp.modules[i]!) !== "tall")
  if (low.length < 2) return []
  const tops = low.map((i) => ({ i, top: Math.round(moduleTop(comp.modules[i]!, places[i]!.y)) }))
  // L'alçada dels baixos (sense els electrodomèstics, que s'hi han d'ajustar): la més repetida.
  const ref = tops.filter((t) => !isApplianceModule(comp.modules[t.i]!))
  const pool = ref.length ? ref : tops
  const freq = new Map<number, number>()
  for (const t of pool) freq.set(t.top, (freq.get(t.top) ?? 0) + 1)
  const expected = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0]
  return tops.filter((t) => Math.abs(t.top - expected) > 1).map((t) => ({ module: comp.modules[t.i]!, top: t.top, expected }))
}

/** Tots els mòduls del tram miren enrere (girats): el davant del sòcol és el costat de la paret. */
export const tramFacesBack = (comp: Pick<Composition, "modules">, tram: FloorTram): boolean => tram.modules.every((i) => isTurned(comp.modules[i]!))
