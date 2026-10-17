import { arcOf, bulgeOf, ccwB, flatten, type EdgeSide, type Panel } from "../../model"
import { pc } from "../../build/polygonClip"
import { signedArea } from "../../model/polygon"
import type { Poly2, Pt2, Rect2 } from "../region2d"
import { add, cross, frameFor, len, mul, neg, sub, to2D, unit, X, Z, type CylFace, type Face, type Frame, type Loop, type V3 } from "./vec"

/** Mecanitzats rodons (forats, ranures i talls passants) com a bucles i cares, i retalls de regions 2D. */

export interface RoundFeature {
  /** Caixa del mecanitzat a la cara (coordenades 2D del marc de la cara). */
  bbox: Rect2
  /** Centre 2D per assignar-lo al polígon que el conté. */
  center: Pt2
  /** Bucle interior a la cara d'entrada (horari respecte a la normal). */
  loop: Loop
  /** Cares que genera (cilindres, fons). */
  faces: Face[]
  /** Bucle a la cara de sortida, si travessa. */
  exit?: { face: BoxFace; loop: Loop; bbox: Rect2; center: Pt2 }
  what: string
}

export type BoxFace = "A" | "B" | "xmin" | "xmax" | "ymin" | "ymax"
export const EDGE_TO_FACE: Record<EdgeSide, BoxFace> = { left: "xmin", right: "xmax", bottom: "ymin", top: "ymax" }
export const EPS = 0.02

/**
 * Semicara cilíndrica (la meitat +v) d'un forat: entra per la cara de normal `n` al
 * centre `c`, amb `u` perpendicular a `n` i v = n × u. Retorna també els punts.
 */
function halfCyl(c: V3, n: V3, u: V3, r: number, depth: number): CylFace {
  const A0 = add(c, mul(u, r))
  const A1 = sub(c, mul(u, r))
  const c2 = sub(c, mul(n, depth))
  const B0 = sub(A0, mul(n, depth))
  const B1 = sub(A1, mul(n, depth))
  return {
    kind: "cyl",
    loc: c2,
    axis: n,
    ref: u,
    radius: r,
    loop: [{ p: A0, arc: { center: c, axis: n } }, { p: A1 }, { p: B1, arc: { center: c2, axis: neg(n) } }, { p: B0 }],
  }
}

/** Forat cilíndric (cec o passant) que entra per la cara de normal `n` al punt `c`. */
export function cylPocket(c: V3, n: V3, u: V3, r: number, depth: number, through: boolean): { loop: Loop; exit: Loop; faces: Face[] } {
  const A0 = add(c, mul(u, r))
  const A1 = sub(c, mul(u, r))
  const c2 = sub(c, mul(n, depth))
  const B0 = sub(A0, mul(n, depth))
  const B1 = sub(A1, mul(n, depth))
  const faces: Face[] = [halfCyl(c, n, u, r, depth), halfCyl(c, n, neg(u), r, depth)]
  const bottomLoop: Loop = [{ p: B0, arc: { center: c2, axis: n } }, { p: B1, arc: { center: c2, axis: n } }]
  if (!through) faces.push({ kind: "plane", loc: c2, normal: n, loops: [bottomLoop] })
  const loop: Loop = [{ p: A0, arc: { center: c, axis: neg(n) } }, { p: A1, arc: { center: c, axis: neg(n) } }]
  return { loop, exit: bottomLoop, faces }
}

/** Ranura passant amb extrems rodons entre els centres `c1` i `c2` (a la cara de normal `n`). */
function slotThrough(c1: V3, c2: V3, r: number, n: V3, T: number): { loop: Loop; exit: Loop; faces: Face[] } {
  const e = unit(sub(c2, c1))
  const s = cross(n, e)
  const P1 = sub(c1, mul(s, r))
  const P2 = sub(c2, mul(s, r))
  const P3 = add(c2, mul(s, r))
  const P4 = add(c1, mul(s, r))
  const down = (p: V3): V3 => sub(p, mul(n, T))
  const [Q1, Q2, Q3, Q4] = [down(P1), down(P2), down(P3), down(P4)]
  const c1b = down(c1)
  const c2b = down(c2)
  const loop: Loop = [{ p: P1, arc: { center: c1, axis: neg(n) } }, { p: P4 }, { p: P3, arc: { center: c2, axis: neg(n) } }, { p: P2 }]
  const exit: Loop = [{ p: Q1 }, { p: Q2, arc: { center: c2b, axis: n } }, { p: Q3 }, { p: Q4, arc: { center: c1b, axis: n } }]
  const faces: Face[] = [
    { kind: "plane", loc: P1, normal: s, loops: [[{ p: P1 }, { p: P2 }, { p: Q2 }, { p: Q1 }]] },
    { kind: "plane", loc: P4, normal: neg(s), loops: [[{ p: P4 }, { p: Q4 }, { p: Q3 }, { p: P3 }]] },
    halfCyl(c2, n, neg(s), r, T),
    halfCyl(c1, n, s, r, T),
  ]
  return { loop, exit, faces }
}

/** Caixa local (conservadora) d'un mecanitzat: tots els punts dels seus bucles i, als arcs, el radi. */
export function featureBox(rf: RoundFeature): { min: V3; max: V3 } {
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  // Els arcs ocupen el seu radi només en el pla perpendicular al seu eix.
  const take = (q: V3, r = 0, axis?: V3) => {
    for (let k = 0; k < 3; k++) {
      const rk = axis && Math.abs(axis[k]!) > 0.5 ? 0 : r
      min[k] = Math.min(min[k]!, q[k]! - rk)
      max[k] = Math.max(max[k]!, q[k]! + rk)
    }
  }
  const loops: Loop[] = [rf.loop, ...(rf.exit ? [rf.exit.loop] : []), ...rf.faces.flatMap((f) => (f.kind === "cyl" ? [f.loop] : f.loops))]
  for (const l of loops)
    for (const q of l) {
      take(q.p)
      if (q.arc) take(q.arc.center, len(sub(q.p, q.arc.center)), q.arc.axis)
    }
  return { min, max }
}

/** Polígon (antihorari) menys rectangles: anells exteriors antihoraris i forats horaris. */
export function regionMinusRects(poly: Pt2[], rects: Rect2[]): Poly2[] {
  if (!rects.length) return [{ outer: poly, inners: [] }]
  const res = pc.difference([poly], ...rects.map((r) => [[[r.a0, r.b0], [r.a1, r.b0], [r.a1, r.b1], [r.a0, r.b1]] as Pt2[]]))
  const open = (r: Pt2[]): Pt2[] => {
    const q = r.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4] as Pt2)
    const last = q[q.length - 1]!
    if (q.length > 1 && last[0] === q[0]![0] && last[1] === q[0]![1]) q.pop()
    return q
  }
  return res.map((pg) => {
    const outer = open(pg[0] as Pt2[])
    return {
      outer: signedArea(outer) < 0 ? [...outer].reverse() : outer,
      inners: pg.slice(1).map((h) => {
        const r = open(h as Pt2[])
        return signedArea(r) > 0 ? [...r].reverse() : r
      }),
    }
  })
}

/** Tall passant que no és rectangular (polígon, cercle, ranura): bucle a A, sortida a B i parets. */
export function cutoutFeature(c: Exclude<NonNullable<Panel["cutouts"]>[number], { kind: "rect" }>, T: number): RoundFeature {
  const fA = frameFor(Z, [0, 0, T])
  const fB = frameFor(neg(Z), [0, 0, 0])
  if (c.kind === "polygon") {
    // Contorn passant (rectes i arcs): bucle a la cara A (horari respecte a +Z), sortida a
    // la B, i per cada costat una cara plana o cilíndrica, orientada cap a dins del forat.
    const pts = ccwB(c.points)
    const n = pts.length
    const at = (i: number, z: number): V3 => [pts[i]![0], pts[i]![1], z]
    const arcs = pts.map((q, i) => {
      const b = bulgeOf(q)
      if (Math.abs(b) < 1e-9) return null
      const a = arcOf(q, pts[(i + 1) % n]!, b)
      return { b, r: a.r, top: [a.cx, a.cy, T] as V3, bot: [a.cx, a.cy, 0] as V3, ax: b > 0 ? Z : neg(Z) }
    })
    const sides: Face[] = pts.map((_, i) => {
      const j = (i + 1) % n
      const arc = arcs[i]
      if (arc) {
        return {
          kind: "cyl",
          loc: arc.bot,
          axis: Z,
          ref: unit(sub(at(i, 0), arc.bot)),
          radius: arc.r,
          outward: arc.b < 0,
          loop: [{ p: at(i, T), arc: { center: arc.top, axis: arc.ax } }, { p: at(j, T) }, { p: at(j, 0), arc: { center: arc.bot, axis: neg(arc.ax) } }, { p: at(i, 0) }],
        }
      }
      const normal = unit(cross(Z, sub(at(j, T), at(i, T))))
      return { kind: "plane", loc: at(i, T), normal, loops: [[{ p: at(i, T) }, { p: at(j, T) }, { p: at(j, 0) }, { p: at(i, 0) }]] }
    })
    // Bucle d'entrada (cara A): recorregut al revés; cada arc surt del seu punt final.
    const loopA: Loop = []
    for (let k = 0; k < n; k++) {
      const j = (n - k) % n
      const i = (j - 1 + n) % n
      const arc = arcs[i]
      loopA.push(arc ? { p: at(j, T), arc: { center: arc.top, axis: neg(arc.ax) } } : { p: at(j, T) })
    }
    const loopB: Loop = pts.map((_, i) => {
      const arc = arcs[i]
      return arc ? { p: at(i, 0), arc: { center: arc.bot, axis: arc.ax } } : { p: at(i, 0) }
    })
    // Punt interior per assignar el bucle a la regió de la cara: tocant el primer costat.
    const flat = flatten(pts)
    const e0 = sub([flat[1]![0], flat[1]![1], T], [flat[0]![0], flat[0]![1], T])
    const inward = unit(cross(Z, e0))
    const mid = add([(flat[0]![0] + flat[1]![0]) / 2, (flat[0]![1] + flat[1]![1]) / 2, T], mul(inward, 0.05))
    const cA = to2D(fA, mid)
    const cB = to2D(fB, [mid[0], mid[1], 0])
    const bb = (f: Frame, zz: number): Rect2 => {
      const q = flat.map(([x, y]) => to2D(f, [x, y, zz]))
      return { a0: Math.min(...q.map((v) => v[0])), a1: Math.max(...q.map((v) => v[0])), b0: Math.min(...q.map((v) => v[1])), b1: Math.max(...q.map((v) => v[1])) }
    }
    return ({
      bbox: bb(fA, T),
      center: cA,
      loop: loopA,
      faces: sides,
      exit: { face: "B", loop: loopB, center: cB, bbox: bb(fB, 0) },
      what: `tall de ${n} costats`,
    })
  }
  if (c.kind === "circle") {
    const r = c.diameter / 2
    const centre: V3 = [c.x, c.y, T]
    const pocket = cylPocket(centre, Z, X, r, T, true)
    const cA = to2D(fA, centre)
    const cB = to2D(fB, [c.x, c.y, 0])
    return ({
      bbox: { a0: cA[0] - r, a1: cA[0] + r, b0: cA[1] - r, b1: cA[1] + r },
      center: cA,
      loop: pocket.loop,
      faces: pocket.faces,
      exit: { face: "B", loop: pocket.exit, center: cB, bbox: { a0: cB[0] - r, a1: cB[0] + r, b0: cB[1] - r, b1: cB[1] + r } },
      what: `passacables Ø${c.diameter} a (${c.x}, ${c.y})`,
    })
  }
  // Ranura passant amb extrems rodons.
  const r = Math.min(c.w, c.h) / 2
  const horizontal = c.w >= c.h
  const c1: V3 = horizontal ? [c.x + r, c.y + r, T] : [c.x + r, c.y + r, T]
  const c2: V3 = horizontal ? [c.x + c.w - r, c.y + r, T] : [c.x + r, c.y + c.h - r, T]
  if (len(sub(c2, c1)) < EPS) {
    // Degenera en un cercle.
    const pocket = cylPocket(c1, Z, X, r, T, true)
    const cA = to2D(fA, c1)
    const cB = to2D(fB, [c1[0], c1[1], 0])
    return ({
      bbox: { a0: cA[0] - r, a1: cA[0] + r, b0: cA[1] - r, b1: cA[1] + r },
      center: cA,
      loop: pocket.loop,
      faces: pocket.faces,
      exit: { face: "B", loop: pocket.exit, center: cB, bbox: { a0: cB[0] - r, a1: cB[0] + r, b0: cB[1] - r, b1: cB[1] + r } },
      what: `ranura a (${c.x}, ${c.y})`,
    })
  }
  const slot = slotThrough(c1, c2, r, Z, T)
  const cA: Pt2 = [c.x + c.w / 2, c.y + c.h / 2]
  const cB = to2D(fB, [cA[0], cA[1], 0])
  return ({
    bbox: { a0: c.x, a1: c.x + c.w, b0: c.y, b1: c.y + c.h },
    center: cA,
    loop: slot.loop,
    faces: slot.faces,
    exit: { face: "B", loop: slot.exit, center: cB, bbox: { a0: c.y, a1: c.y + c.h, b0: c.x, b1: c.x + c.w } },
    what: `ranura ${c.w}×${c.h} a (${c.x}, ${c.y})`,
  })
}
