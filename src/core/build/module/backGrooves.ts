import type { Carcass, Panel, Pt, Vec3 } from "../../model"
import { ccw, pointInPolygon } from "../../model"
import { panelBox, r, toLocal } from "../geometry"
import type { ZoneRect } from "../layout"
import { pc } from "../polygonClip"
import { roundTo } from "../../../lib/format"
import type { BackZone } from "./carcass"
import { near } from "./helpers"
import type { HorizontalRef, VerticalRef } from "./types"

// Fons en ranura amb zones sense fons (o amb el seu fons encastat), per decisió de l'usuari (2026-10-21): «el fons sempre
// entra en ranura» i les ranures només van on hi ha fons.

type Span = [number, number]

/**
 * On el forat del fons toca un divisor o un prestatge fix (no la caixa), el fons s'hi acaba dins d'una ranura de la cara
 * de l'altre costat (`fitGroovedBack`): el forat arriba fins a aquesta cara menys la fondària de la ranura (i mig joc).
 * Un divisor gruixut (buit) igual: la ranura és a la pell de l'altre costat.
 */
export function groovedHoles(holes: ZoneRect[], dividers: { dir: "v" | "h"; at: number; to: number }[], c: Carcass): ZoneRect[] {
  const g = c.grooveDepth - c.backClearance / 2
  const at = (dir: "v" | "h", face: number, side: "at" | "to") => dividers.find((v) => v.dir === dir && near(v[side], face))
  return holes.map((h) => ({
    x0: at("v", h.x0, "to") ? at("v", h.x0, "to")!.at + g : h.x0,
    x1: at("v", h.x1, "at") ? at("v", h.x1, "at")!.to - g : h.x1,
    y0: at("h", h.y0, "to") ? at("h", h.y0, "to")!.at + g : h.y0,
    y1: at("h", h.y1, "at") ? at("h", h.y1, "at")!.to - g : h.y1,
  }))
}

/**
 * El fons cargolat d'una zona (per decisió de l'usuari, 2026-10-21): per darrere de les peces que la tanquen, cargolat als
 * seus cantells. Cobreix la zona i les peces del voltant: un lateral, la base o la tapa fins a fora de la caixa; un
 * divisor fins a la cara de l'altre costat o, si a l'altre costat també hi ha un fons cargolat de zona, fins a la meitat.
 */
export function screwedZoneRect(b: BackZone, zones: BackZone[], dividers: { dir: "v" | "h"; at: number; to: number }[], interior: ZoneRect, outer: ZoneRect): ZoneRect {
  const q = b.rect
  const screwed = zones.filter((o) => o !== b && o.back.kind === "screwed").map((o) => o.rect)
  const edge = (dir: "v" | "h", face: number, low: boolean, inner: number, out: number) => {
    if (near(face, inner)) return out
    const v = dividers.find((k) => k.dir === dir && near(low ? k.to : k.at, face))
    if (!v) return face
    const far = low ? v.at : v.to
    const shared = screwed.some((o) => (dir === "v" ? near(low ? o.x1 : o.x0, far) && Math.min(o.y1, q.y1) > Math.max(o.y0, q.y0) : near(low ? o.y1 : o.y0, far) && Math.min(o.x1, q.x1) > Math.max(o.x0, q.x0)))
    return shared ? (v.at + v.to) / 2 : far
  }
  return {
    x0: edge("v", q.x0, true, interior.x0, outer.x0),
    x1: edge("v", q.x1, false, interior.x1, outer.x1),
    y0: edge("h", q.y0, true, interior.y0, outer.y0),
    y1: edge("h", q.y1, false, interior.y1, outer.y1),
  }
}

const axis = (v: readonly number[]) => v.findIndex((k) => Math.abs(k) > 0.5)
const minus = (from: Span[], cut: Span[]) =>
  cut.reduce((acc, [a, b]) => acc.flatMap(([u, v]): Span[] => (b <= u || a >= v ? [[u, v]] : [...(a > u ? [[u, a] as Span] : []), ...(b < v ? [[b, v] as Span] : [])])), from)
const union = (xs: Span[]) => {
  const out: Span[] = []
  for (const [a, b] of [...xs].sort((p, q) => p[0] - q[0])) {
    const last = out[out.length - 1]
    if (last && a <= last[1] + 0.01) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}
const big = (xs: Span[]) => xs.filter(([a, b]) => b - a > 1)
const box2 = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** Trams del mòdul (al llarg de la peça) → x local de la peça. */
function localRun(p: Panel, spans: Span[]): Span[] {
  const { origin: o, xAxis } = p.placement
  const run = axis(xAxis)
  const sx = xAxis[run]! > 0 ? 1 : -1
  return spans.map(([u, v]) => {
    const a = sx * (u - o[run]!), b = sx * (v - o[run]!)
    return [r(Math.min(a, b)), r(Math.max(a, b))]
  })
}

/**
 * La peça (divisor, prestatge fix o una pell d'un de gruixut) va fins a `z0` al tram `tongue` (del mòdul): més ampla pel
 * darrere i, si no és a tota la llargada, amb un contorn (una llengüeta). Torna si s'ha pogut allargar.
 */
function extendRear(p: Panel, tongue: Span[], z0: number): boolean {
  const ext = panelBox(p).min[2] - z0
  const { origin: o, xAxis, yAxis } = p.placement
  if (ext < 0.5 || axis(yAxis) !== 2 || axis(xAxis) > 1) return false
  const W0 = p.width
  const rearPositive = yAxis[2]! > 0
  if (rearPositive) {
    p.placement = { ...p.placement, origin: [o[0]!, o[1]!, r(o[2]! - ext)] }
    p.holes = p.holes.map((h) => ({ ...h, y: r(h.y + ext) }))
    p.grooves = p.grooves.map((q) => ({ ...q, y: r(q.y + ext) }))
  }
  p.width = r(W0 + ext)
  // El tram del darrere (y local de la banda que s'afegeix) on no hi ha llengüeta.
  const [b0, b1] = rearPositive ? [0, ext] : [W0, W0 + ext]
  const missing = big(minus([[0, p.length]], localRun(p, tongue)))
  if (!missing.length) return true
  const ring = pc.difference([box2(0, 0, p.length, p.width)], ...missing.map(([u, v]) => [box2(u, b0, v, b1)]))[0]?.[0]
  if (!ring) return true
  const out = ring.map(([x, y]) => [roundTo(x, 2), roundTo(y, 2)] as Pt)
  const last = out[out.length - 1]!
  if (out.length > 1 && last[0] === out[0]![0] && last[1] === out[0]![1]) out.pop()
  p.outline = ccw(out)
  return true
}

/** La ranura del fons a la cara `face` de la peça, als trams `spans` (del mòdul), al pla del fons (z de darrere `z0`). */
function addGroove(p: Panel, spans: Span[], face: "A" | "B", c: Carcass, gw: number, z0 = c.backSetback): void {
  const { origin: o, yAxis } = p.placement
  const y = yAxis[2]! > 0 ? z0 - o[2]! : o[2]! - (z0 + gw)
  for (const [u, v] of big(localRun(p, spans))) p.grooves.push({ x: r(u), y: r(y), w: r(v - u), h: gw, depth: c.grooveDepth, face, tag: "back" })
}

/** El llistó del darrere d'un divisor gruixut: als trams de la llengüeta, al darrere de la caixa (la tanca per darrere). */
function moveSpacer(panels: Panel[], sp: Panel, tongue: Span[], z0: number): void {
  const { origin: o, xAxis, zAxis } = sp.placement
  const run = axis(xAxis)
  if (zAxis[2] !== 1 || run > 1) return
  const sx = xAxis[run]! > 0 ? 1 : -1
  const tl = localRun(sp, tongue)
  const rest = big(minus([[0, sp.length]], tl))
  if (!rest.length) {
    sp.placement = { ...sp.placement, origin: [o[0]!, o[1]!, r(z0)] }
    return
  }
  const parts = [...tl.map((s) => [s, z0] as const), ...rest.map((s) => [s, o[2]!] as const)].sort((a, b) => a[0][0] - b[0][0])
  const i = panels.indexOf(sp)
  const pieces = parts.map(([[u, v], z], k): Panel => {
    const origin = [...o] as [number, number, number]
    origin[run] = r(o[run]! + sx * u)
    origin[2] = r(z)
    return { ...sp, id: k ? `${sp.id}-${k + 1}` : sp.id, length: r(v - u), holes: sp.holes.filter((h) => h.x >= u && h.x <= v).map((h) => ({ ...h, x: r(h.x - u) })), placement: { ...sp.placement, origin } }
  })
  panels.splice(i, 1, ...pieces)
}

/**
 * Amb `grooved` (fons del mòdul en ranura): les ranures dels laterals, la base i la tapa s'acaben on s'acaba el fons. Els divisors i prestatges fixos que toquen
 * una zona sense fons van fins al darrere de la caixa en aquell tram (no queden enretirats on no hi ha fons) i, si a
 * l'altre costat hi ha fons, porten la ranura on entra. Els gruixuts (buits) igual: les dues pells hi van, el llistó del
 * darrere s'hi posa i la ranura és a la pell de l'altre costat. Sense ranura (un fons de zona cargolat en un mòdul
 * d'un altre fons), només les peces fins al darrere: el fons cargolat s'hi cargola.
 */
export function fitGroovedBack({ panels, verticals, horizontals, zones: zs, expanded, holes, grooved, carcass: c, sideZ0, grooveWidth: gw }: { panels: Panel[]; verticals: VerticalRef[]; horizontals: HorizontalRef[]; zones: BackZone[]; expanded: ZoneRect[]; holes: ZoneRect[]; grooved: boolean; carcass: Carcass; sideZ0: number; grooveWidth: number }): void {
  // Ranures de la caixa: fora del tros on no hi ha fons.
  for (const p of grooved ? panels : []) {
    if (p.role === "back" || !p.grooves.some((q) => q.tag === "back")) continue
    const { origin: o, xAxis, zAxis } = p.placement
    const run = axis(xAxis), nAx = axis(zAxis)
    if (run > 1 || nAx > 1) continue
    const sx = xAxis[run]! > 0 ? 1 : -1
    const box = panelBox(p)
    const cn = (box.min[nAx]! + box.max[nAx]!) / 2
    const cuts = holes.filter((h) => (run === 0 ? cn > h.y0 && cn < h.y1 : cn > h.x0 && cn < h.x1)).map((h): Span => (run === 0 ? [h.x0, h.x1] : [h.y0, h.y1]))
    if (!cuts.length) continue
    p.grooves = p.grooves.flatMap((q) => {
      if (q.tag !== "back") return [q]
      const a = o[run]! + sx * q.x, b = o[run]! + sx * (q.x + q.w)
      return big(minus([[Math.min(a, b), Math.max(a, b)]], cuts)).map(([u, v]) => ({ ...q, x: r(sx * ((sx > 0 ? u : v) - o[run]!)), w: r(v - u) }))
    })
  }
  // Divisors i prestatges fixos que toquen una zona sense fons: la peça sola o, si és gruixuda, les dues pells i el llistó.
  const byId = (id: string) => panels.find((p) => p.id === id)
  type Piece = { low: Panel; high: Panel; spacer?: Panel; lo: number; hi: number; from: number; to: number; dir: "v" | "h" }
  const pieces: Piece[] = []
  for (const v of verticals) {
    if (v.outer || v.panel.role !== "divider") continue
    const span = { from: v.yB + (v.endGap ?? 0), to: v.yT - (v.endGap ?? 0), dir: "v" as const }
    if (!v.whole) pieces.push({ low: v.panel, high: v.panel, lo: v.xL, hi: v.xR, ...span })
    else if (near(v.xL, v.whole.from)) {
      const high = byId(`${v.panel.id}-right`)
      if (high) pieces.push({ low: v.panel, high, spacer: byId(`${v.panel.id}-spacer-back`), lo: v.whole.from, hi: v.whole.to, ...span })
    }
  }
  for (const h of horizontals) {
    if (h.outer || h.panel.role !== "fixedShelf") continue
    const span = { from: h.xL + (h.endGap ?? 0), to: h.xR - (h.endGap ?? 0), dir: "h" as const }
    if (!h.whole) pieces.push({ low: h.panel, high: h.panel, lo: h.yBottom, hi: h.yTop, ...span })
    else if (near(h.yBottom, h.whole.from)) {
      const high = byId(`${h.panel.id}-top`)
      if (high) pieces.push({ low: h.panel, high, spacer: byId(`${h.panel.id}-spacer-back`), lo: h.whole.from, hi: h.whole.to, ...span })
    }
  }
  for (const { low, high, spacer, lo, hi, from, to, dir } of pieces) {
    if ([low, high].some((p) => p.outline || p.cutouts?.length)) continue
    const side = (isLow: boolean) =>
      union(
        zs.flatMap(({ rect: q }, i): Span[] => {
          const e = expanded[i]!
          const touches = dir === "v" ? (isLow ? near(q.x1, lo) : near(q.x0, hi)) : isLow ? near(q.y1, lo) : near(q.y0, hi)
          if (!touches) return []
          const [a, b] = dir === "v" ? [e.y0, e.y1] : [e.x0, e.x1]
          return Math.min(b, to) - Math.max(a, from) > 1 ? [[Math.max(a, from), Math.min(b, to)]] : []
        }),
      )
    const L = side(true), H = side(false)
    const tongue = union([...L, ...H])
    if (!tongue.length) continue
    const done = [...new Set([low, high])].map((p) => extendRear(p, tongue, sideZ0))
    if (!done.every(Boolean)) continue
    if (spacer) moveSpacer(panels, spacer, tongue, sideZ0)
    if (!grooved) continue
    // La ranura on entra el fons, a la cara de fora de l'altre costat de la zona sense fons (cara A: la de x/y més gran).
    addGroove(high, minus(L, H), "A", c, gw)
    addGroove(low, minus(H, L), "B", c, gw)
  }
}

/**
 * El fons en ranura d'una zona (per decisió de l'usuari, 2026-10-21, «com la columna»): sigui quin sigui el fons del
 * mòdul, la zona porta el seu, a `z0`, dins de ranures a les peces que la tanquen (laterals, base, tapa, divisors i
 * prestatges fixos, també les pells dels gruixuts). Una peça de dins que no arriba fins a la ranura hi va, en aquell tram.
 * Torna el rectangle del fons (fins al fons de les ranures, menys mig joc); on no hi ha cap peça, la llum de la zona.
 */
export function groovedZoneBack({ zone: b, verticals, horizontals, carcass: c, sideZ0, z0, grooveWidth: gw }: { zone: BackZone; verticals: VerticalRef[]; horizontals: HorizontalRef[]; carcass: Carcass; sideZ0: number; z0: number; grooveWidth: number }): ZoneRect {
  const q = b.rect
  const e = c.grooveDepth - c.backClearance / 2
  const cross = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 1
  const left = verticals.filter((v) => near(v.xR, q.x0) && cross(v.yB, v.yT, q.y0, q.y1))
  const right = verticals.filter((v) => near(v.xL, q.x1) && cross(v.yB, v.yT, q.y0, q.y1))
  const below = horizontals.filter((h) => near(h.yTop, q.y0) && cross(h.xL, h.xR, q.x0, q.x1))
  const above = horizontals.filter((h) => near(h.yBottom, q.y1) && cross(h.xL, h.xR, q.x0, q.x1))
  const R: ZoneRect = { x0: left.length ? q.x0 - e : q.x0, x1: right.length ? q.x1 + e : q.x1, y0: below.length ? q.y0 - e : q.y0, y1: above.length ? q.y1 + e : q.y1 }
  const groove = (p: Panel, span: Span, face: [number, number, number], outer: boolean) => {
    if (span[1] - span[0] <= 1) return
    if (!outer && panelBox(p).min[2] > z0 + 0.5) extendRear(p, [span], sideZ0)
    const lz = toLocal(p, face)[2]
    addGroove(p, [span], Math.abs(lz - p.thickness) < 0.5 ? "A" : "B", c, gw, z0)
  }
  const zm = z0 + gw / 2
  for (const v of left) groove(v.panel, [Math.max(R.y0, panelBox(v.panel).min[1]), Math.min(R.y1, panelBox(v.panel).max[1])], [v.xR, (q.y0 + q.y1) / 2, zm], v.outer)
  for (const v of right) groove(v.panel, [Math.max(R.y0, panelBox(v.panel).min[1]), Math.min(R.y1, panelBox(v.panel).max[1])], [v.xL, (q.y0 + q.y1) / 2, zm], v.outer)
  for (const h of below) groove(h.panel, [Math.max(R.x0, panelBox(h.panel).min[0]), Math.min(R.x1, panelBox(h.panel).max[0])], [(q.x0 + q.x1) / 2, h.yTop, zm], h.outer)
  for (const h of above) groove(h.panel, [Math.max(R.x0, panelBox(h.panel).min[0]), Math.min(R.x1, panelBox(h.panel).max[0])], [(q.x0 + q.x1) / 2, h.yBottom, zm], h.outer)
  return R
}

/**
 * La espiga del punt `w` (del mòdul; al cantell o a la cara) cau dins de la peça del fons, amb `m` mm de peça a cada
 * costat al llarg del cantell (el fons va en X, Y; el d'una zona sense fons s'ha tallat).
 */
export function pieceHas(piece: Panel, w: Vec3, m: number): boolean {
  const [ox, oy] = piece.placement.origin
  const x = w[0] - ox, y = w[1] - oy
  const L = piece.length, W = piece.width
  if (x < -0.5 || y < -0.5 || x > L + 0.5 || y > W + 0.5) return false
  const cl = (v: number, max: number) => Math.min(max - 0.5, Math.max(0.5, v))
  const pts = [[x, y], [x - m, y], [x + m, y], [x, y - m], [x, y + m]].map(([a, b]) => [cl(a!, L), cl(b!, W)] as Pt)
  if (!piece.outline) return inBox(x, y, L, W, m)
  const o = piece.outline.map((q) => [q[0], q[1]] as Pt)
  return inBox(x, y, L, W, m) && pts.every((q) => pointInPolygon(q, o))
}

/** Un punt del contorn o de dins del rectangle, amb `m` mm de rectangle al llarg del cantell on és. */
function inBox(x: number, y: number, L: number, W: number, m: number): boolean {
  const onX = x < 0.5 || x > L - 0.5
  const onY = y < 0.5 || y > W - 0.5
  if (onX && !onY) return y >= m && y <= W - m
  if (onY && !onX) return x >= m && x <= L - m
  return x >= m && x <= L - m && y >= m && y <= W - m
}
