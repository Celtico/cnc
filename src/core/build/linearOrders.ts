import type { HardwareItem } from "../model"
import type { KitOrderLine } from "./drawerKit"
import type { KitGroup } from "./kitOrders"

/**
 * **Ferratges per metres** (v45; `docs/funcional/model.md` › Ferratges per metres): la regleta dels penjadors i el sòcol
 * d'alumini es compren en barres (o per metres) i es tallen a mida. Cada regla que en posa un (`buildHangers`,
 * `plinthPieces`) en deixa un **tros** (`LinearPiece`); aquí se sumen per item: els trossos que cal tallar (els de la
 * regleta de mòduls penjats seguits, ajuntats en un de sol), les barres (`stock`, repartits del més llarg al més curt),
 * els metres, els clips i les cantonades. Pur.
 */
export interface LinearPiece {
  /** L'item (còpia) del moble: id, nom, referència i el que es compra amb el perfil. */
  item: Pick<HardwareItem, "id" | "name" | "ref" | "maker" | "linear">
  /** Llargada del tros (mm). */
  length: number
  /** Barra que es compra (mm; 0 = per metres). */
  stock: number
  /** Un clip cada `clipSpacing` mm (0 = cap) a `clipEnd` dels extrems, dos per tros com a mínim. */
  clipSpacing: number
  clipEnd: number
  /** Clips comptats per la regla (el sòcol: un a cada pota del tram); mana sobre `clipSpacing`. */
  clips?: number
  /** Cantonades entre trams (sòcol tot el voltant: 4). */
  corners: number
  /** Número de mòdul (1..n; 0 = del moble, com el sòcol corregut). */
  module?: number
  /**
   * La regleta d'un mòdul penjat (coordenades de la composició: de `x0` a `x1`, a l'alçada `y` i a `z`): dues de seguides
   * amb el mateix item, a la mateixa línia i que es toquen fan un sol tros.
   */
  run?: { x0: number; x1: number; y: number; z: number }
}

/** La comanda d'un ferratge per metres. */
export interface LinearOrder {
  item: LinearPiece["item"]
  stock: number
  /** Trossos per tallar (mm), del més llarg al més curt. */
  cuts: number[]
  /** Metres en total (sense el que sobra de les barres). */
  total: number
  /** Barres de `stock` que cal comprar (0 si es ven per metres). */
  bars: number
  clips: number
  corners: number
  /** Unions lineals: els empalmaments dels trossos més llargs que la barra. */
  joints: number
  modules: number[]
}

/** Clips d'un tros: un cada `spacing` entre els dos dels extrems (a `end`), com a mínim dos. */
export function clipCount(length: number, spacing: number, end: number): number {
  if (!(spacing > 0)) return 0
  const span = Math.max(0, length - 2 * end)
  return Math.max(2, Math.ceil(span / spacing) + 1)
}

/** Barres de `stock` per tallar `cuts` (del més llarg al més curt, al primer que hi cap; amb `kerf` de serra per tall). */
export function barsFor(cuts: readonly number[], stock: number, kerf = 3): number {
  if (!(stock > 0)) return 0
  const free: number[] = []
  for (const c0 of [...cuts].sort((a, b) => b - a)) {
    // Un tros més llarg que la barra: barres senceres empalmades i la resta com un tros més.
    let c = c0
    while (c > stock + 0.5) {
      free.push(0)
      c -= stock
    }
    const i = free.findIndex((f) => f + 0.5 >= c)
    if (i >= 0) free[i] = free[i]! - c - kerf
    else free.push(stock - c - kerf)
  }
  return free.length
}

/** Ajunta les regletes de mòduls penjats seguits (mateix item, mateixa línia, que es toquen) en un sol tros. */
function mergeRuns(pieces: readonly LinearPiece[]): LinearPiece[] {
  const out: LinearPiece[] = []
  const runs = pieces.filter((p) => p.run).sort((a, b) => a.run!.x0 - b.run!.x0)
  for (const p of runs) {
    const prev = out.find((q) => q.item.id === p.item.id && q.run && Math.abs(q.run.y - p.run!.y) < 0.5 && Math.abs(q.run.z - p.run!.z) < 0.5 && Math.abs(q.run.x1 - p.run!.x0) < 1)
    if (prev) {
      prev.run = { ...prev.run!, x1: p.run!.x1 }
      prev.length = Math.round((prev.run.x1 - prev.run.x0) * 10) / 10
    } else out.push({ ...p, run: { ...p.run! } })
  }
  return [...out, ...pieces.filter((p) => !p.run)]
}

/** La comanda de tots els ferratges per metres d'un moble, un per item (en l'ordre en què surten). */
export function buildLinearOrders(pieces: readonly LinearPiece[]): LinearOrder[] {
  const byItem = new Map<string, LinearOrder>()
  const keyOf = (p: LinearPiece) => `${p.item.id}|${p.item.name}|${p.stock}`
  for (const p of mergeRuns(pieces)) {
    const key = keyOf(p)
    const o = byItem.get(key) ?? { item: p.item, stock: p.stock, cuts: [], total: 0, bars: 0, clips: 0, corners: 0, joints: 0, modules: [] }
    o.cuts.push(p.length)
    o.total += p.length
    o.clips += p.clips ?? clipCount(p.length, p.clipSpacing, p.clipEnd)
    o.corners += p.corners
    if (p.stock > 0) o.joints += Math.max(0, Math.ceil(p.length / p.stock - 0.0005) - 1)
    byItem.set(key, o)
  }
  // Els mòduls de cada item (també els dels trossos ajuntats).
  for (const p of pieces) {
    const o = byItem.get(keyOf(p))
    if (o && p.module !== undefined && !o.modules.includes(p.module)) o.modules.push(p.module)
  }
  return [...byItem.values()].map((o) => ({ ...o, cuts: o.cuts.sort((a, b) => b - a), total: Math.round(o.total * 10) / 10, bars: barsFor(o.cuts, o.stock), modules: o.modules.sort((a, b) => a - b) }))
}

const m2 = (mm: number) => (mm / 1000).toFixed(2).replace(".", ",")
const n1 = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")

/** Els trossos per tallar en una línia («2 × 1800 + 600»). */
export function cutsText(cuts: readonly number[]): string {
  const groups: [number, number][] = []
  for (const c of cuts) {
    const g = groups.find(([len]) => Math.abs(len - c) < 0.05)
    if (g) g[1]++
    else groups.push([c, 1])
  }
  return groups.map(([len, k]) => (k > 1 ? `${k} × ${n1(len)}` : n1(len))).join(" + ")
}

/** Les línies de la comanda d'un ferratge per metres: el perfil (barres o metres), els clips i les cantonades. */
function orderLines(o: LinearOrder): KitOrderLine[] {
  const ref = o.item.ref ? { item: o.item.ref } : {}
  const cut = `tallar ${cutsText(o.cuts)} mm · ${m2(o.total)} m`
  const lines: KitOrderLine[] = [
    o.stock > 0
      ? { component: o.item.id, name: `${o.item.name} (barra de ${n1(o.stock)} mm)`, qty: o.bars, ...ref, note: cut }
      : { component: o.item.id, name: `${o.item.name} (per metres)`, qty: o.cuts.length, ...ref, note: cut },
  ]
  const clip = o.item.linear?.clip
  if (clip && o.clips > 0) lines.push({ component: `${o.item.id}:clip`, name: clip.name, qty: o.clips, ...(clip.ref ? { item: clip.ref } : {}) })
  const corner = o.item.linear?.corner
  if (corner && o.corners > 0) lines.push({ component: `${o.item.id}:corner`, name: corner.name, qty: o.corners, ...(corner.ref ? { item: corner.ref } : {}) })
  const joint = o.item.linear?.joint
  if (joint && o.joints > 0) lines.push({ component: `${o.item.id}:joint`, name: joint.name, qty: o.joints, ...(joint.ref ? { item: joint.ref } : {}) })
  return lines
}

/** Per a Peces › «Ferratges per metres»: un grup per item (la mateixa taula que les altres comandes). */
export function linearGroups(orders: readonly LinearOrder[]): KitGroup[] {
  return orders.map((o) => ({
    key: `lin:${o.item.id}:${o.stock}`,
    title: o.modules.length ? `${o.item.name} · ${o.modules.some((n) => n === 0) ? "moble" : `mòduls ${o.modules.join(", ")}`}` : o.item.name,
    drawers: 0,
    lines: orderLines(o),
    wood: "",
  }))
}

/** Les files del CSV de la llista de tall (Exportar › Llista de tall): ferratge, quantitat, referència i notes. */
export function linearCsvRows(orders: readonly LinearOrder[]): [string, number, string, string][] {
  return orders.flatMap((o) => orderLines(o).map((l): [string, number, string, string] => [l.name, l.qty, l.item ?? "", l.note ?? ""]))
}
