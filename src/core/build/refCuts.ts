import { bounds, bulgeOf, ccw, ccwB, flatten, pointInPolygon, polygonArea, polygonTouchesRect, refSection, signedArea, type BPt, type Composition, type Cutout, type Panel, type RefObject, type Vec3 } from "../model"
import { buildModule } from "./buildModule"
import { toLocal } from "./geometry"
import { modulePlacements, refOnPanel } from "../model"
import * as pcNs from "polygon-clipping"

// El paquet només té export per defecte (el .d.ts declara els noms): acceptem les dues formes.
const pc = ((pcNs as unknown as { default?: typeof pcNs }).default ?? pcNs) as typeof pcNs

type Box = { min: Vec3; max: Vec3 }

/** Eix normal d'una peça (0 = x, 1 = y, 2 = z): el del gruix. */
function normalIndex(p: Panel): 0 | 1 | 2 {
  const z = p.placement.zAxis
  const a = [Math.abs(z[0]), Math.abs(z[1]), Math.abs(z[2])]
  return a[0]! >= a[1]! && a[0]! >= a[2]! ? 0 : a[1]! >= a[2]! ? 1 : 2
}

/** L'objecte i la caixa de la peça es toquen (amb la secció real: rodona o de perfil). */
export function refTouchesBox(o: RefObject, b: Box, tol = 0.5): boolean {
  const sec = refSection(o)
  if (sec.range[1] <= b.min[sec.a]! + tol || b.max[sec.a]! <= sec.range[0] + tol) return false
  const { u, v } = sec
  if (sec.circle) {
    const { cu, cv, r } = sec.circle
    const du = Math.max(b.min[u]! - cu, 0, cu - b.max[u]!)
    const dv = Math.max(b.min[v]! - cv, 0, cv - b.max[v]!)
    return du * du + dv * dv < (r - tol) * (r - tol)
  }
  return polygonTouchesRect(sec.poly, b.min[u]!, b.min[v]!, b.max[u]!, b.max[v]!, tol)
}

export interface RefCutProblem {
  refId: string
  panel: Panel
  message: string
}

/**
 * Objectes que tallen: a cada peça que travessen en la seva direcció (`axis`, per defecte cap
 * a la paret) hi fan un forat passant amb la seva secció: cercle (cilindre), rectangle (caixa)
 * o polígon (perfil). Si arribaria a la vora de la peça (seria un rebaix del contorn) no es
 * fa i es retorna com a problema. Modifica les peces (afegeix `cutouts`).
 */
export function applyRefCuts(panels: Panel[], refs: RefObject[], boxOf: (p: Panel) => Box, isExtra?: (p: Panel) => boolean): RefCutProblem[] {
  const problems: RefCutProblem[] = []
  const r1 = (v: number) => Math.round(v * 10) / 10
  for (const o of refs) {
    if (o.effect !== "cut") continue
    const sec = refSection(o)
    for (const p of panels) {
      const b = boxOf(p)
      // Només talla les peces que travessa en la seva direcció (un tub cap a la paret forada
      // el fons, no el cantell dels prestatges; un desguàs vertical, la base i els prestatges).
      if (normalIndex(p) !== sec.a) {
        // De costat: les peces lliures que tallen, sempre (booleà si cal). Els objectes de referència (una columna de
        // la casa), només si la travessen de cara a cara amb secció recta (el fons i els laterals d'un moble al voltant
        // d'una columna quadrada): un tub cap a la paret no forada el cantell dels prestatges.
        if (!refTouchesBox(o, b)) continue
        const isPart = o.id.startsWith("part:")
        const side = sidewaysCut(o, sec, p, b, isExtra?.(p) ?? false, !isPart)
        if (side) problems.push({ refId: o.id, panel: p, message: side })
        continue
      }
      if (!refTouchesBox(o, b)) continue
      const mid = (b.min[sec.a]! + b.max[sec.a]!) / 2
      const local = (pu: number, pv: number): [number, number] => {
        const q: [number, number, number] = [0, 0, 0]
        q[sec.u] = pu
        q[sec.v] = pv
        q[sec.a] = mid
        const l = toLocal(p, q)
        return [l[0], l[1]]
      }
      let cut: Cutout
      let pts: [number, number][]
      if (sec.circle) {
        const c = local(sec.circle.cu, sec.circle.cv)
        const r = sec.circle.r
        cut = { kind: "circle", x: c[0], y: c[1], diameter: r1(2 * r), tag: "ref" }
        pts = [[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]]
      } else {
        pts = sec.poly.map(([pu, pv]) => local(pu, pv))
        if (sec.outline) {
          // Contorn exacte (amb arcs) a les coordenades de la peça. Si el pas (u, v) → peça
          // fa de mirall, els arcs giren al revés.
          const mirror = Math.sign(signedArea(pts)) !== Math.sign(signedArea(sec.poly))
          const outline = sec.outline.map((q): BPt => {
            const [x, y] = local(q[0], q[1])
            const b = bulgeOf(q) * (mirror ? -1 : 1)
            return b ? [r1(x), r1(y), b] : [r1(x), r1(y)]
          })
          cut = { kind: "polygon", points: ccwB(outline), tag: "ref" }
        } else {
          const bb = bounds(pts)
          cut = { kind: "rect", x: bb.x0, y: bb.y0, w: r1(bb.x1 - bb.x0), h: r1(bb.y1 - bb.y0), tag: "ref" }
        }
      }
      const bb = bounds(pts)
      if (bb.x0 < 1 || bb.y0 < 1 || bb.x1 > p.length - 1 || bb.y1 > p.width - 1) {
        // Arriba a la vora (una columna a la cantonada): la peça es retalla amb la forma de l'objecte (per decisió de
        // l'usuari, 2026-10-14: «el moble s'ha d'adaptar a la columna»). Un cercle va com a polígon fi.
        const ring: [number, number][] = sec.circle
          ? Array.from({ length: 64 }, (_, i) => {
              const t = (i / 64) * 2 * Math.PI
              const c = local(sec.circle!.cu, sec.circle!.cv)
              return [c[0] + sec.circle!.r * Math.cos(t), c[1] + sec.circle!.r * Math.sin(t)] as [number, number]
            })
          : sec.outline
            ? flatten(cut.kind === "polygon" ? cut.points : [])
            : [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]]
        const msg = notch(p, ring)
        if (msg) problems.push({ refId: o.id, panel: p, message: `«${o.name}» ${msg}` })
        continue
      }
      p.cutouts = [...(p.cutouts ?? []), cut]
    }
  }
  return problems
}

/**
 * Els passacables dels mòduls (versió anterior) passen a ser objectes que tallen: un cilindre
 * (o una caixa, si era rectangular) al mateix lloc, que travessa només aquella peça.
 */
export function migrateCableHoles(comp: Composition, boxOf: (p: Panel) => Box): Composition {
  if (!comp.modules.some((m) => m.extras.cableHoles.length)) return comp
  const places = modulePlacements(comp)
  const refs: RefObject[] = [...comp.references]
  const modules = comp.modules.map((m, i) => {
    if (!m.extras.cableHoles.length) return m
    const at = places[i]!
    const { panels } = buildModule({ ...m, extras: { ...m.extras, cableHoles: [] } })
    m.extras.cableHoles.forEach((h0, k) => {
      // Els que seguien un objecte (només durant un dia) es queden on era l'objecte.
      const follow = h0.ref ? comp.references.find((r) => r.id === h0.ref) : undefined
      const h = follow ? { ...h0, ...refOnPanel(follow, h0.panel, at), w: h0.w, h: h0.h } : h0
      const target =
        h.panel === "left" ? panels.find((p) => p.id === "side-left")
        : h.panel === "right" ? panels.find((p) => p.id === "side-right")
        : panels.find((p) => p.role === h.panel)
      if (!target) return
      const b0 = boxOf(target)
      const b: Box = { min: [b0.min[0] + at.x, b0.min[1] + at.y, b0.min[2]], max: [b0.max[0] + at.x, b0.max[1] + at.y, b0.max[2]] }
      // Centre del forat (coordenades de la composició) i eix normal de la peça.
      const c: [number, number, number] =
        h.panel === "back" ? [at.x + h.x, at.y + h.y, 0]
        : h.panel === "top" || h.panel === "bottom" ? [at.x + h.x, 0, h.y]
        : [0, at.y + h.y, h.x]
      const n = h.panel === "back" ? 2 : h.panel === "top" || h.panel === "bottom" ? 1 : 0
      const rect = h.shape === "rect"
      // Mida en cada eix: [u, v] del passacables en les dues direccions del pla.
      const su = rect ? (h.w ?? h.diameter) : h.diameter
      const sv = rect ? (h.h ?? h.diameter) : h.diameter
      const size: [number, number, number] = [0, 0, 0]
      const axes: [number, number] = n === 2 ? [0, 1] : n === 1 ? [0, 2] : [2, 1]
      size[axes[0]] = su
      size[axes[1]] = sv
      size[n] = b.max[n]! - b.min[n]! + 2
      const lo: [number, number, number] = [c[0] - size[0] / 2, c[1] - size[1] / 2, c[2] - size[2] / 2]
      lo[n] = b.min[n]! - 1
      refs.push({
        id: `${m.id}-cable${k + 1}`,
        name: rect ? `Passacables ${su} × ${sv}` : `Passacables Ø${h.diameter}`,
        w: size[0],
        h: size[1],
        d: size[2],
        x: Math.round(lo[0] * 10) / 10,
        y: Math.round(lo[1] * 10) / 10,
        z: Math.round(lo[2] * 10) / 10,
        effect: "cut",
        // La direcció sempre (també els rectangulars: sense, anaven en z i no tallaven la tapa ni els laterals).
        axis: (["x", "y", "z"] as const)[n],
        ...(rect ? {} : { shape: "cylinder" as const }),
      })
    })
    return { ...m, extras: { ...m.extras, cableHoles: [] } }
  })
  return { ...comp, modules, references: refs }
}

type Section = ReturnType<typeof refSection>

/** Intervals (en e) on el polígon talla la recta n = `at`; `ni` = índex de n al punt (0 o 1). */
function slice(poly: [number, number][], ni: 0 | 1, at: number): [number, number][] {
  const ei = ni === 0 ? 1 : 0
  const xs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!
    if ((p[ni] <= at) === (q[ni] <= at)) continue
    const t = (at - p[ni]) / (q[ni] - p[ni])
    xs.push(p[ei] + t * (q[ei] - p[ei]))
  }
  xs.sort((a, b) => a - b)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i]!, xs[i + 1]!])
  return out
}

function intersectIntervals(a: [number, number][], b: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const [a0, a1] of a) for (const [b0, b1] of b) {
    const lo = Math.max(a0, b0), hi = Math.min(a1, b1)
    if (hi - lo > 0.01) out.push([lo, hi])
  }
  return out
}
const total = (iv: [number, number][]) => iv.reduce((s, [a, b]) => s + b - a, 0)

/**
 * Objecte que talla i travessa la peça de costat (la seva direcció és al pla de la peça):
 *  - Si la travessa de cara a cara amb una secció recta (una caixa, una barra quadrada), el
 *    tall és un rectangle al pla de la peça: forat o, a les peces lliures, osca del contorn.
 *  - Si no (un tub que passa pel cantell d'un bloc, un tall que no arriba d'una cara a l'altra),
 *    és un booleà en 3D: es resta al 3D (`solidCuts`) i, si la peça és de CNC, s'avisa que no es
 *    mecanitza. Retorna el missatge d'avís, si n'hi ha.
 */
function sidewaysCut(o: RefObject, sec: Section, p: Panel, b: Box, extra: boolean, exactOnly = false): string | undefined {
  const n = normalIndex(p)
  const ni: 0 | 1 = n === sec.u ? 0 : 1
  const e = ni === 0 ? sec.v : sec.u
  const n0 = b.min[n]!, n1 = b.max[n]!
  const a0 = Math.max(sec.range[0], b.min[sec.a]!), a1 = Math.min(sec.range[1], b.max[sec.a]!)
  if (a1 - a0 < 0.5) return
  // Llesques a les dues cares, al mig i a cada vèrtex de la secció que cau dins del gruix.
  const levels = [n0 + 0.01, (n0 + n1) / 2, n1 - 0.01, ...sec.poly.map((q) => q[ni]).filter((t) => t > n0 && t < n1)]
  const slices = levels.map((t) => slice(sec.poly, ni, t))
  const full = slices.reduce(intersectIntervals)
  const eRange: [number, number] = [b.min[e]!, b.max[e]!]
  const clip = (iv: [number, number][]) => intersectIntervals(iv, [eRange])
  const exact = full.length > 0 && slices.every((sl) => Math.abs(total(clip(sl)) - total(clip(full))) < 0.5)
  if (exact) {
    const rects = clip(full).map(([e0, e1]) => {
      const corner = (av: number, ev: number) => {
        const q: [number, number, number] = [0, 0, 0]
        q[sec.a] = av
        q[e] = ev
        q[n] = (n0 + n1) / 2
        const l = toLocal(p, q)
        return [l[0], l[1]] as [number, number]
      }
      const pts = [corner(a0, e0), corner(a1, e0), corner(a1, e1), corner(a0, e1)]
      return bounds(pts)
    })
    for (const bb of rects) {
      const r1 = (v: number) => Math.round(v * 10) / 10
      if (bb.x0 >= 1 && bb.y0 >= 1 && bb.x1 <= p.length - 1 && bb.y1 <= p.width - 1) {
        p.cutouts = [...(p.cutouts ?? []), { kind: "rect", x: r1(bb.x0), y: r1(bb.y0), w: r1(bb.x1 - bb.x0), h: r1(bb.y1 - bb.y0), tag: "ref" }]
        continue
      }
      // Arriba a la vora: osca del contorn (també a les peces dels mòduls: el moble s'adapta a la columna).
      const msg = notch(p, [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]])
      if (msg) return `«${o.name}» ${msg}`
    }
    return
  }
  // Un objecte de referència de costat sense secció recta (un tub rodó pel fons): no es fa res (com abans).
  if (exactOnly) return
  // Booleà en 3D: el prisma de l'objecte en coordenades de la peça.
  const start = sec.poly.map(([pu, pv]) => {
    const q: [number, number, number] = [0, 0, 0]
    q[sec.u] = pu
    q[sec.v] = pv
    q[sec.a] = sec.range[0]
    return toLocal(p, q)
  })
  const q0: [number, number, number] = [0, 0, 0]
  const q1: [number, number, number] = [0, 0, 0]
  q1[sec.a] = sec.range[1] - sec.range[0]
  const l0 = toLocal(p, q0), l1 = toLocal(p, q1)
  p.solidCuts = [...(p.solidCuts ?? []), { points: start, dir: [l1[0] - l0[0], l1[1] - l0[1], l1[2] - l0[2]] }]
  if (extra) return
  return `«${o.name}» travessa ${p.label} pel cantell (no de cara a cara): es veu al 3D, però a la CNC no es pot fer com a forat passant (seria un forat de cantell o un buidat).`
}

/** Resta un polígon (coordenades locals) del contorn de la peça. Retorna un avís si la parteix o se la menja. */
function notch(p: Panel, cutter: [number, number][]): string | undefined {
  const base: [number, number][] = p.outline ? flatten(p.outline) : [[0, 0], [p.length, 0], [p.length, p.width], [0, p.width]]
  const res = pc.difference([base], [cutter])
  if (!res.length) return `es menja tota la peça ${p.label}.`
  const main = res.reduce((best, poly) => (polygonArea(poly[0] as [number, number][]) > polygonArea(best[0] as [number, number][]) ? poly : best))
  const ring = (main[0] as [number, number][]).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as [number, number])
  const last = ring[ring.length - 1]!
  if (ring.length > 1 && last[0] === ring[0]![0] && last[1] === ring[0]![1]) ring.pop()
  p.outline = ccw(ring)
  // Res surt de la peça: els forats que queien a la part que s'ha tret (o hi toquen) fora; les ranures, retallades
  // (si en queda un rectangle) o fora.
  const gone = (x: number, y: number) => pointInPolygon([x, y], cutter)
  p.holes = p.holes.filter((h) => (h.face === "edge" ? !gone(h.x, h.y) : ![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => gone(h.x + dx! * h.diameter / 2, h.y + dy! * h.diameter / 2))))
  p.grooves = p.grooves.flatMap((g) => {
    const rect: [number, number][] = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.h], [g.x, g.y + g.h]]
    const left = pc.difference([rect], [cutter])
    if (left.length === 1 && left[0]!.length === 1) {
      const pts = (left[0]![0] as [number, number][]).slice(0, -1)
      const bb = bounds(pts)
      const area = (bb.x1 - bb.x0) * (bb.y1 - bb.y0)
      if (pts.length === 4 && Math.abs(area - polygonArea(pts)) < 0.5) return [{ ...g, x: bb.x0, y: bb.y0, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 }]
    }
    return []
  })
  for (const h of main.slice(1)) p.cutouts = [...(p.cutouts ?? []), { kind: "polygon", points: ccw((h as [number, number][]).slice(0, -1)), tag: "ref" }]
  return res.length > 1 ? `parteix ${p.label} en ${res.length} trossos (al 3D i al nesting només queda el més gran).` : undefined
}
