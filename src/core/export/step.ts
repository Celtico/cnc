import { arcOf, bulgeOf, ccwB, flatten, type EdgeSide, type Hole, type Panel, type Vec3 } from "../model"
import * as pcNs from "polygon-clipping"
import { pointInRing, rectsOverlap, signedArea, subtractRects, type Poly2, type Pt2, type Rect2 } from "./region2d"
import { workshopName } from "./text"

// El paquet només té export per defecte (el .d.ts declara els noms): acceptem les dues formes.
const pc = ((pcNs as unknown as { default?: typeof pcNs }).default ?? pcNs) as typeof pcNs

/**
 * Escriptor STEP AP214 (text, sense motor CAD) amb el format que llegeixen els parsers
 * de `taller-cnc-nest` (`step-solids.ts`, `step-names.ts`):
 *
 *  - Eixos del taller: X = amplada, Y = fondària, Z = amunt. El nostre model és Y-amunt
 *    (Z = 0 al darrere): es converteix amb (x, y, z) → (x, −z, y), que és una rotació.
 *  - Un `MANIFOLD_SOLID_BREP` per peça dins d'un
 *    `ADVANCED_BREP_SHAPE_REPRESENTATION('<nom de peça>', ...)`, d'on el taller llegeix
 *    el nom, i un `PRODUCT` per peça perquè FreeCAD hi vegi l'arbre.
 *  - Forats cecs de cara i de cantell: bucle circular a la cara d'entrada, dues
 *    semicares cilíndriques i un fons pla. El taller en treu `mach` i `edges`.
 *  - Ranures: cara plana al fons (el taller la llegeix com a `pocket`), parets i, si
 *    la ranura arriba al cantell, osca a la cara lateral.
 *  - Talls passants (passacables, ranures de reixeta, trapa): geometria real, que el
 *    taller descarta a propòsit (només surten al DXF).
 *
 * Topologia: vèrtexs i arestes compartides entre cares (cada aresta la fan servir
 * exactament dues cares en sentit oposat), de manera que el `CLOSED_SHELL` és tancat.
 */

interface StepOptions {
  /** Nom del moble (FILE_NAME i PRODUCT arrel). */
  name: string
  /** Data ISO per a la capçalera. Per defecte, ara. */
  date?: string
}

interface StepResult {
  text: string
  /** Mecanitzats que no s'han pogut modelar (se solapen amb un altre o surten de la peça). */
  warnings: string[]
  solids: number
}

// --- Àlgebra mínima -------------------------------------------------------------

type V3 = Vec3
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1))
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]]
const X: V3 = [1, 0, 0]
const Y: V3 = [0, 1, 0]
const Z: V3 = [0, 0, 1]

/** Rotació de `v` al voltant de l'eix unitari `k` (Rodrigues). */
function rotate(v: V3, k: V3, angle: number): V3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)))
}

// --- Marc del taller ------------------------------------------------------------

/** Direcció del nostre 3D (Y amunt, Z cap al davant) → eixos del taller (Z amunt, Y fondària). */
const toTallerDir = (v: V3): V3 => [v[0], -v[2], v[1]]

interface TallerFrame {
  origin: V3
  xAxis: V3
  yAxis: V3
  zAxis: V3
  point: (local: V3) => V3
  dir: (local: V3) => V3
}

/** Transformació local de la peça → coordenades del taller (rotació + translació). */
function tallerFrame(p: Panel): TallerFrame {
  const { origin, xAxis, yAxis, zAxis } = p.placement
  const o = toTallerDir(origin)
  const ax = toTallerDir(xAxis)
  const ay = toTallerDir(yAxis)
  const az = toTallerDir(zAxis)
  const dir = (l: V3): V3 => add(add(mul(ax, l[0]), mul(ay, l[1])), mul(az, l[2]))
  return { origin: o, xAxis: ax, yAxis: ay, zAxis: az, dir, point: (l) => add(o, dir(l)) }
}

/**
 * Numeració dels cantells tal com els veurà el taller, que deriva u (costat llarg) i v
 * (curt) de la caixa de cada sòlid: 4 = u mínim · 2 = u màxim · 1 = v mínim · 3 = v màxim.
 * Així els cantells del CSV i les espigues del STEP queden al mateix lloc al seu visor.
 */
export function tallerEdgeNumbers(p: Panel): Record<EdgeSide, 1 | 2 | 3 | 4> {
  const f = tallerFrame(p)
  const axisIndex = (v: V3): number => v.findIndex((c) => Math.abs(c) > 0.5)
  const ix = axisIndex(f.xAxis)
  const iy = axisIndex(f.yAxis)
  // El parser tria u = eix del pla amb més extensió; en cas d'empat, el d'índex més baix.
  const xIsU = p.length > p.width || (p.length === p.width && ix < iy)
  const xPos = f.xAxis[ix]! > 0
  const yPos = f.yAxis[iy]! > 0
  const onU = (atMin: boolean): 2 | 4 => (atMin ? 4 : 2)
  const onV = (atMin: boolean): 1 | 3 => (atMin ? 1 : 3)
  return xIsU
    ? { left: onU(xPos), right: onU(!xPos), bottom: onV(yPos), top: onV(!yPos) }
    : { left: onV(xPos), right: onV(!xPos), bottom: onU(yPos), top: onU(!yPos) }
}

// --- Model de cares en coordenades locals de la peça -----------------------------

interface Arc {
  center: V3
  /** L'arc va del punt actual al següent en sentit antihorari al voltant d'aquest eix. */
  axis: V3
}
interface LoopPt {
  p: V3
  arc?: Arc
}
type Loop = LoopPt[]

interface PlaneFace {
  kind: "plane"
  loc: V3
  normal: V3
  loops: Loop[]
}
interface CylFace {
  kind: "cyl"
  loc: V3
  axis: V3
  ref: V3
  radius: number
  loop: Loop
  /** El material és a dins del cilindre (arc que entra al forat): la cara mira enfora. */
  outward?: boolean
}
type Face = PlaneFace | CylFace

/** Marc 2D d'una cara plana amb normal axial: a × b = n. */
interface Frame {
  o: V3
  a: V3
  b: V3
  n: V3
}

function frameFor(n: V3, o: V3): Frame {
  if (n[2] > 0.5) return { o, a: X, b: Y, n }
  if (n[2] < -0.5) return { o, a: Y, b: X, n }
  if (n[0] < -0.5) return { o, a: Z, b: Y, n }
  if (n[0] > 0.5) return { o, a: Y, b: Z, n }
  if (n[1] < -0.5) return { o, a: X, b: Z, n }
  return { o, a: Z, b: X, n }
}

const to3D = (f: Frame, q: Pt2): V3 => add(add(f.o, mul(f.a, q[0])), mul(f.b, q[1]))
const to2D = (f: Frame, p: V3): Pt2 => [dot(sub(p, f.o), f.a), dot(sub(p, f.o), f.b)]

/** Cara plana rectangular (bucle antihorari respecte a la normal). */
function rectFace(n: V3, o: V3, a0: number, a1: number, b0: number, b1: number): PlaneFace {
  const f = frameFor(n, o)
  const ring: Pt2[] = [
    [a0, b0],
    [a1, b0],
    [a1, b1],
    [a0, b1],
  ]
  return { kind: "plane", loc: to3D(f, [a0, b0]), normal: n, loops: [ring.map((q) => ({ p: to3D(f, q) }))] }
}

interface RoundFeature {
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

type BoxFace = "A" | "B" | "xmin" | "xmax" | "ymin" | "ymax"
const EDGE_TO_FACE: Record<EdgeSide, BoxFace> = { left: "xmin", right: "xmax", bottom: "ymin", top: "ymax" }
const EPS = 0.02

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
function cylPocket(c: V3, n: V3, u: V3, r: number, depth: number, through: boolean): { loop: Loop; exit: Loop; faces: Face[] } {
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
function featureBox(rf: RoundFeature): { min: V3; max: V3 } {
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

/** Normal de Newell d'un polígon 3D (no normalitzada): segueix el sentit del recorregut. */
function newell(ring: V3[]): V3 {
  const n: V3 = [0, 0, 0]
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    n[0] += (a[1] - b[1]) * (a[2] + b[2])
    n[1] += (a[2] - b[2]) * (a[0] + b[0])
    n[2] += (a[0] - b[0]) * (a[1] + b[1])
  }
  return n
}

/** Polígon (antihorari) menys rectangles: anells exteriors antihoraris i forats horaris. */
function regionMinusRects(poly: Pt2[], rects: Rect2[]): Poly2[] {
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
function cutoutFeature(c: Exclude<NonNullable<Panel["cutouts"]>[number], { kind: "rect" }>, T: number): RoundFeature {
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

// --- Sòlid d'una peça -------------------------------------------------------------

interface PanelSolid {
  faces: Face[]
  warnings: string[]
}

/**
 * Peça amb contorn (tauler de taula oval, arrodonit…): prisma del contorn (rectes i arcs,
 * cares planes i cilíndriques cap enfora). Els mecanitzats d'aquestes peces no es modelen
 * al STEP (surten al DXF i al CSV): s'avisa.
 */
function outlineSolid(p: Panel, cad = false): PanelSolid {
  const T = p.thickness
  const pts = ccwB(p.outline!)
  const n = pts.length
  const at = (i: number, z: number): V3 => [pts[i]![0], pts[i]![1], z]
  const arcs = pts.map((q, i) => {
    const b = bulgeOf(q)
    if (Math.abs(b) < 1e-9) return null
    const a = arcOf(q, pts[(i + 1) % n]!, b)
    return { b, r: a.r, top: [a.cx, a.cy, T] as V3, bot: [a.cx, a.cy, 0] as V3, ax: b > 0 ? Z : neg(Z) }
  })
  const faces: Face[] = pts.map((_, i) => {
    const j = (i + 1) % n
    const arc = arcs[i]
    if (arc)
      return {
        kind: "cyl",
        loc: arc.bot,
        axis: Z,
        ref: unit(sub(at(i, 0), arc.bot)),
        radius: arc.r,
        // Arc convex (bulge +, contorn antihorari): el material és a dins, la cara mira enfora.
        outward: arc.b > 0,
        loop: [{ p: at(i, 0), arc: { center: arc.bot, axis: arc.ax } }, { p: at(j, 0) }, { p: at(j, T), arc: { center: arc.top, axis: neg(arc.ax) } }, { p: at(i, T) }],
      } satisfies CylFace
    const normal = unit(cross(sub(at(j, 0), at(i, 0)), Z))
    return { kind: "plane", loc: at(i, 0), normal, loops: [[{ p: at(i, 0) }, { p: at(j, 0) }, { p: at(j, T) }, { p: at(i, T) }]] } satisfies PlaneFace
  })
  // Cara A (dalt, +Z): el contorn en sentit antihorari; cara B (baix, −Z): al revés.
  const loopA: Loop = pts.map((_, i) => {
    const arc = arcs[i]
    return arc ? { p: at(i, T), arc: { center: arc.top, axis: arc.ax } } : { p: at(i, T) }
  })
  const loopB: Loop = []
  for (let k = 0; k < n; k++) {
    const j = (n - k) % n
    const i = (j - 1 + n) % n
    const arc = arcs[i]
    loopB.push(arc ? { p: at(j, 0), arc: { center: arc.bot, axis: neg(arc.ax) } } : { p: at(j, 0) })
  }
  const warnings: string[] = []
  const loopsA: Loop[] = [loopA]
  const loopsB: Loop[] = [loopB]
  if (cad) {
    // STEP per a TopSolid: talls passants (encaixos, mortalles) i forats de cara dins del contorn.
    const ring = flatten(pts)
    const taken: Rect2[] = []
    let skipped = p.grooves.length + p.holes.filter((h) => h.face === "edge").length
    const place = (bbox: Rect2, probe: Pt2[]): boolean => {
      if (!probe.every((q) => pointInRing(q, ring))) return false
      if (taken.some((r) => rectsOverlap(r, bbox, 0.01))) return false
      taken.push(bbox)
      return true
    }
    for (const c of p.cutouts ?? []) {
      const cc = c.kind === "rect" ? { kind: "polygon" as const, points: [[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h]] as [number, number][], tag: c.tag } : c
      const rf = cutoutFeature(cc, T)
      const probe: Pt2[] =
        cc.kind === "polygon" ? flatten(cc.points) : cc.kind === "circle" ? Array.from({ length: 8 }, (_, i) => [cc.x + (cc.diameter / 2) * Math.cos((i * Math.PI) / 4), cc.y + (cc.diameter / 2) * Math.sin((i * Math.PI) / 4)] as Pt2) : [[cc.x, cc.y], [cc.x + cc.w, cc.y], [cc.x + cc.w, cc.y + cc.h], [cc.x, cc.y + cc.h]]
      if (!place(rf.bbox, probe)) {
        skipped += 1
        continue
      }
      loopsA.push(rf.loop)
      if (rf.exit) loopsB.push(rf.exit.loop)
      faces.push(...rf.faces)
    }
    for (const h of p.holes) {
      if (h.face === "edge") continue
      const r = h.diameter / 2
      const top = h.face === "A"
      const bbox: Rect2 = { a0: h.x - r, a1: h.x + r, b0: h.y - r, b1: h.y + r }
      if (!place(bbox, [[h.x - r, h.y - r], [h.x + r, h.y - r], [h.x + r, h.y + r], [h.x - r, h.y + r]])) {
        skipped += 1
        continue
      }
      const pocket = cylPocket([h.x, h.y, top ? T : 0], top ? Z : neg(Z), X, r, blindDepth(p, h, warnings), false)
      ;(top ? loopsA : loopsB).push(pocket.loop)
      faces.push(...pocket.faces)
    }
    if (skipped) warnings.push(`${p.name} (${p.id}): peça amb forma; ${skipped} mecanitzats (ranures, forats de cantell o que surten del contorn) no es modelen al STEP.`)
  } else {
    const features = p.holes.length + p.grooves.length + (p.cutouts?.length ?? 0)
    if (features) warnings.push(`${p.name} (${p.id}): peça amb forma; els seus ${features} mecanitzats no es modelen al STEP (surten al DXF i al CSV).`)
  }
  faces.push({ kind: "plane", loc: at(0, T), normal: Z, loops: loopsA })
  faces.push({ kind: "plane", loc: at(0, 0), normal: neg(Z), loops: loopsB })
  return { faces, warnings }
}

/**
 * Fondària màxima d'un forat cec de cara: el taller descarta els cilindres amb fondària
 * ≥ gruix − 0,5 (els pren per radis de cantonada), així que en deixem 1 mm.
 */
const FACE_HOLE_FLOOR = 1

/** Fondària d'un forat cec de cara al STEP, amb avís si s'ha d'escurçar. */
function blindDepth(p: Panel, h: Hole, warnings: string[]): number {
  const max = p.thickness - FACE_HOLE_FLOOR
  if (h.depth <= max) return h.depth
  warnings.push(`${p.name} (${p.id}): forat Ø${h.diameter} × ${h.depth} a (${h.x}, ${h.y}) cara ${h.face} massa fondo per a ${p.thickness} mm; al STEP fa ${stepReal(max)} mm.`)
  return max
}

/**
 * Sòlid d'una peça rectangular amb els seus mecanitzats. `cad` (STEP per a TopSolid) afegeix el
 * que el taller no necessita: els ingletes de debò (cares a 45°) i els booleans 3D
 * (`solidCuts`).
 */
function panelSolid(p: Panel, cad = false): PanelSolid {
  const L = p.length
  const W = p.width
  const T = p.thickness
  const warnings: string[] = []
  // Ingletes: la cara B (z = 0, la de fora) sencera i la A (z = T) retallada T a cada cantell a
  // 45°, com `mitreGeometry` al 3D. Els buidats no poden entrar a la falca que es treu.
  const mit = new Set(cad ? (p.mitres ?? []) : [])
  const il = mit.has("left") ? T : 0
  const ir = mit.has("right") ? T : 0
  const ib = mit.has("bottom") ? T : 0
  const itp = mit.has("top") ? T : 0
  let clamped = false

  const frames: Record<BoxFace, Frame> = {
    A: frameFor(Z, [0, 0, T]),
    B: frameFor(neg(Z), [0, 0, 0]),
    xmin: frameFor(neg(X), [0, 0, 0]),
    xmax: frameFor(X, [L, 0, 0]),
    ymin: frameFor(neg(Y), [0, 0, 0]),
    ymax: frameFor(Y, [0, W, 0]),
  }
  const extent: Record<BoxFace, [number, number]> = {
    A: [L, W],
    B: [W, L],
    xmin: [T, W],
    xmax: [W, T],
    ymin: [L, T],
    ymax: [T, L],
  }
  const rects: Record<BoxFace, Rect2[]> = { A: [], B: [], xmin: [], xmax: [], ymin: [], ymax: [] }
  // Volums dels forats i talls rodons ja acceptats (caixes locals): dos que es creuen per dins
  // (un forat de cara que toca una espiga) farien un sòlid que s'autointerseca.
  const volumes: { min: V3; max: V3 }[] = []
  const rounds: Record<BoxFace, RoundFeature[]> = { A: [], B: [], xmin: [], xmax: [], ymin: [], ymax: [] }
  const extra: Face[] = []

  // Buidat rectangular: ranura (cec) o tall rectangular (passant), en Z local [zlo, zhi].
  const rectPocket = (x0: number, x1: number, y0: number, y1: number, zlo: number, zhi: number, entry: "A" | "B" | "through") => {
    if (mit.size) {
      const c = [il && x0 < il + 0.5 ? il + 0.5 : x0, ir && x1 > L - ir - 0.5 ? L - ir - 0.5 : x1, ib && y0 < ib + 0.5 ? ib + 0.5 : y0, itp && y1 > W - itp - 0.5 ? W - itp - 0.5 : y1]
      if (c[0] !== x0 || c[1] !== x1 || c[2] !== y0 || c[3] !== y1) clamped = true
      ;[x0, x1, y0, y1] = c as [number, number, number, number]
      if (x1 - x0 <= EPS || y1 - y0 <= EPS) return
    }
    if (cad) volumes.push({ min: [x0, y0, zlo], max: [x1, y1, zhi] })
    if (zhi >= T - EPS) rects.A.push({ a0: x0, a1: x1, b0: y0, b1: y1 })
    if (zlo <= EPS) rects.B.push({ a0: y0, a1: y1, b0: x0, b1: x1 })
    if (x0 <= EPS) rects.xmin.push({ a0: zlo, a1: zhi, b0: y0, b1: y1 })
    else extra.push(rectFace(X, [x0, 0, 0], y0, y1, zlo, zhi))
    if (x1 >= L - EPS) rects.xmax.push({ a0: y0, a1: y1, b0: zlo, b1: zhi })
    else extra.push(rectFace(neg(X), [x1, 0, 0], zlo, zhi, y0, y1))
    if (y0 <= EPS) rects.ymin.push({ a0: x0, a1: x1, b0: zlo, b1: zhi })
    else extra.push(rectFace(Y, [0, y0, 0], zlo, zhi, x0, x1))
    if (y1 >= W - EPS) rects.ymax.push({ a0: zlo, a1: zhi, b0: x0, b1: x1 })
    else extra.push(rectFace(neg(Y), [0, y1, 0], x0, x1, zlo, zhi))
    if (entry === "A") extra.push(rectFace(Z, [0, 0, zlo], x0, x1, y0, y1))
    if (entry === "B") extra.push(rectFace(neg(Z), [0, 0, zhi], y0, y1, x0, x1))
  }

  for (const g of p.grooves) {
    const x0 = Math.max(0, g.x)
    const x1 = Math.min(L, g.x + g.w)
    const y0 = Math.max(0, g.y)
    const y1 = Math.min(W, g.y + g.h)
    const d = Math.min(g.depth, T - 0.5)
    if (x1 - x0 <= EPS || y1 - y0 <= EPS || d <= 0) continue
    if (g.face === "A") rectPocket(x0, x1, y0, y1, T - d, T, "A")
    else rectPocket(x0, x1, y0, y1, 0, d, "B")
  }

  // Forats de cara i de cantell. Al STEP per a TopSolid, dos forats iguals a la mateixa posició
  // per les dues cares que es troben (System 32 a les dues cares d'un divisor) són un forat passant.
  const through = new Set<number>()
  const skip = new Set<number>()
  if (cad)
    p.holes.forEach((h, i) => {
      if (h.face !== "A" || skip.has(i)) return
      const j = p.holes.findIndex((o, k) => k !== i && !skip.has(k) && o.face === "B" && Math.abs(o.x - h.x) < 0.01 && Math.abs(o.y - h.y) < 0.01 && o.diameter === h.diameter)
      if (j >= 0 && h.depth + p.holes[j]!.depth >= T) {
        through.add(i)
        skip.add(j)
      }
    })
  for (const [hi, h] of p.holes.entries()) {
    if (skip.has(hi)) continue
    const r = h.diameter / 2
    const thru = through.has(hi)
    const depth = h.face === "edge" ? Math.min(h.depth, Math.max(L, W)) : thru ? T : blindDepth(p, h, warnings)
    if (h.face === "edge") {
      if (!h.edge) continue
      const face = EDGE_TO_FACE[h.edge]
      const f = frames[face]
      const c: V3 = face === "xmin" ? [0, h.y, T / 2] : face === "xmax" ? [L, h.y, T / 2] : face === "ymin" ? [h.x, 0, T / 2] : [h.x, W, T / 2]
      const n = f.n
      const u: V3 = Z
      const pocket = cylPocket(c, n, u, r, depth, false)
      const center = to2D(f, c)
      rounds[face].push({
        bbox: { a0: center[0] - r, a1: center[0] + r, b0: center[1] - r, b1: center[1] + r },
        center,
        loop: pocket.loop,
        faces: pocket.faces,
        what: `forat de cantell Ø${h.diameter} a (${h.x}, ${h.y})`,
      })
      continue
    }
    const face: BoxFace = h.face === "A" ? "A" : "B"
    const f = frames[face]
    const c: V3 = [h.x, h.y, face === "A" ? T : 0]
    const pocket = cylPocket(c, f.n, X, r, depth, thru)
    const center = to2D(f, c)
    const cB = to2D(frames.B, [h.x, h.y, 0])
    rounds[face].push({
      bbox: { a0: center[0] - r, a1: center[0] + r, b0: center[1] - r, b1: center[1] + r },
      center,
      loop: pocket.loop,
      faces: pocket.faces,
      ...(thru ? { exit: { face: "B" as const, loop: pocket.exit, center: cB, bbox: { a0: cB[0] - r, a1: cB[0] + r, b0: cB[1] - r, b1: cB[1] + r } } } : {}),
      what: `forat Ø${h.diameter} a (${h.x}, ${h.y}) cara ${h.face}`,
    })
  }

  // Talls passants.
  for (const c of p.cutouts ?? []) {
    if (c.kind === "rect") {
      const x0 = Math.max(0, c.x)
      const x1 = Math.min(L, c.x + c.w)
      const y0 = Math.max(0, c.y)
      const y1 = Math.min(W, c.y + c.h)
      if (x1 - x0 > EPS && y1 - y0 > EPS) rectPocket(x0, x1, y0, y1, 0, T, "through")
      continue
    }
    rounds.A.push(cutoutFeature(c, T))
  }

  // Booleans 3D (STEP per a TopSolid): prisma de secció poligonal que entra per una cara i
  // en surt per l'oposada (passant) o s'atura a dins (cec). Alineat als eixos de la peça.
  if (cad)
    for (const sc of p.solidCuts ?? []) {
      let pts = sc.points
      let d = sc.dir
      const k = [0, 1, 2].reduce((best, i) => (Math.abs(d[i]!) > Math.abs(d[best]!) ? i : best), 0)
      if (d[k]! < 0) {
        pts = pts.map((q) => add(q, d))
        d = neg(d)
      }
      const E = [L, W, T][k]!
      const s0 = pts[0]![k]!
      const s1 = s0 + d[k]!
      const minFace: BoxFace = k === 0 ? "xmin" : k === 1 ? "ymin" : "B"
      const maxFace: BoxFace = k === 0 ? "xmax" : k === 1 ? "ymax" : "A"
      const fromMin = s0 <= EPS
      const toMax = s1 >= E - EPS
      if ((!fromMin && !toMax) || s1 <= EPS || s0 >= E - EPS) {
        warnings.push(`${p.name} (${p.id}): booleà 3D que no arriba a cap cara; no s'ha modelat al STEP.`)
        continue
      }
      const at = (q: V3, c: number): V3 => {
        const r: V3 = [q[0], q[1], q[2]]
        r[k] = c
        return r
      }
      const entry: BoxFace = fromMin ? minFace : maxFace
      const cEntry = fromMin ? 0 : E
      const cOther = fromMin ? (toMax ? E : s1) : s0
      const nE = frames[entry].n
      let P = pts.map((q) => at(q, cEntry))
      if (dot(newell(P), nE) > 0) P = [...P].reverse()
      const Q = P.map((q) => at(q, cOther))
      const n = P.length
      const C = mul(P.reduce((acc, q) => add(acc, q), [0, 0, 0] as V3), 1 / n)
      const sides: Face[] = []
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        let quad = [P[i]!, P[j]!, Q[j]!, Q[i]!]
        const mid = mul(add(P[i]!, P[j]!), 0.5)
        if (dot(newell(quad), sub(C, mid)) < 0) quad = [...quad].reverse()
        sides.push({ kind: "plane", loc: quad[0]!, normal: unit(newell(quad)), loops: [quad.map((q) => ({ p: q }))] })
      }
      const fE = frames[entry]
      const q2 = P.map((q) => to2D(fE, q))
      const bbox: Rect2 = { a0: Math.min(...q2.map((v) => v[0])), a1: Math.max(...q2.map((v) => v[0])), b0: Math.min(...q2.map((v) => v[1])), b1: Math.max(...q2.map((v) => v[1])) }
      const center = to2D(fE, C)
      const through = fromMin ? toMax : true
      if (through && cOther === (fromMin ? E : 0)) {
        const exitFace: BoxFace = fromMin ? maxFace : minFace
        const fX = frames[exitFace]
        let X2 = Q
        if (dot(newell(X2), fX.n) > 0) X2 = [...X2].reverse()
        const x2 = X2.map((q) => to2D(fX, q))
        rounds[entry].push({
          bbox,
          center,
          loop: P.map((q) => ({ p: q })),
          faces: sides,
          exit: { face: exitFace, loop: X2.map((q) => ({ p: q })), center: to2D(fX, at(C, cOther)), bbox: { a0: Math.min(...x2.map((v) => v[0])), a1: Math.max(...x2.map((v) => v[0])), b0: Math.min(...x2.map((v) => v[1])), b1: Math.max(...x2.map((v) => v[1])) } },
          what: "booleà 3D passant",
        })
      } else {
        // Cec: fons pla mirant cap a l'entrada.
        let bottom = Q
        if (dot(newell(bottom), nE) < 0) bottom = [...bottom].reverse()
        sides.push({ kind: "plane", loc: bottom[0]!, normal: nE, loops: [bottom.map((q) => ({ p: q }))] })
        rounds[entry].push({ bbox, center, loop: P.map((q) => ({ p: q })), faces: sides, what: "booleà 3D cec" })
      }
    }

  // Contorn de cada cara de la caixa, amb els ingletes: la A retallada i les laterals en trapezi
  // (o a 45° si el seu cantell és a inglet). Coordenades 2D del marc de la cara.
  const o3: V3[] = [[0, 0, 0], [L, 0, 0], [L, W, 0], [0, W, 0]]
  const i3: V3[] = [[il, ib, T], [L - ir, ib, T], [L - ir, W - itp, T], [il, W - itp, T]]
  const sideOf: Record<"ymin" | "xmax" | "ymax" | "xmin", [number, number, EdgeSide]> = { ymin: [0, 1, "bottom"], xmax: [1, 2, "right"], ymax: [2, 3, "top"], xmin: [3, 0, "left"] }
  const facePoly = (face: BoxFace): Pt2[] | null => {
    if (!mit.size || face === "B") return null
    const f = frames[face]
    const ring =
      face === "A"
        ? i3.map((q) => to2D(f, q))
        : (() => {
            const [a, b] = sideOf[face as keyof typeof sideOf]
            return [o3[a]!, o3[b]!, i3[b]!, i3[a]!].map((q) => to2D(f, q))
          })()
    return signedArea(ring) < 0 ? [...ring].reverse() : ring
  }
  const slanted = (face: BoxFace): boolean => face !== "A" && face !== "B" && mit.has(sideOf[face as keyof typeof sideOf][2])
  if (clamped) warnings.push(`${p.name} (${p.id}): ranura o tall escurçat fins a l'inglet (al STEP no entra a la falca de 45°).`)

  // Valida els mecanitzats rodons: dins de la cara i sense tocar cap altre mecanitzat.
  const accepted: Record<BoxFace, RoundFeature[]> = { A: [], B: [], xmin: [], xmax: [], ymin: [], ymax: [] }
  const occupied: Record<BoxFace, Rect2[]> = { A: [], B: [], xmin: [], xmax: [], ymin: [], ymax: [] }
  const fits = (face: BoxFace, bbox: Rect2): boolean => {
    const [A, B] = extent[face]
    if (bbox.a0 <= EPS || bbox.b0 <= EPS || bbox.a1 >= A - EPS || bbox.b1 >= B - EPS) return false
    if (slanted(face)) return false
    const poly = facePoly(face)
    if (poly) {
      const corners: Pt2[] = [[bbox.a0, bbox.b0], [bbox.a1, bbox.b0], [bbox.a1, bbox.b1], [bbox.a0, bbox.b1]]
      if (!corners.every((c) => pointInRing(c, poly))) return false
    }
    if (rects[face].some((r) => rectsOverlap(r, bbox, 0.01))) return false
    if (occupied[face].some((r) => rectsOverlap(r, bbox, 0.01))) return false
    return true
  }
  for (const face of Object.keys(rounds) as BoxFace[]) {
    for (const rf of rounds[face]) {
      const vol = featureBox(rf)
      const clash = cad && volumes.some((v) => [0, 1, 2].every((k) => vol.min[k]! < v.max[k]! - 0.01 && v.min[k]! < vol.max[k]! - 0.01))
      const ok = !clash && fits(face, rf.bbox) && (!rf.exit || fits(rf.exit.face, rf.exit.bbox))
      if (ok) volumes.push(vol)
      if (!ok) {
        warnings.push(`${p.name} (${p.id}): ${rf.what} no s'ha modelat al STEP (surt de la peça o toca un altre mecanitzat).`)
        continue
      }
      accepted[face].push(rf)
      occupied[face].push(rf.bbox)
      if (rf.exit) occupied[rf.exit.face].push(rf.exit.bbox)
    }
  }

  // Cares de la caixa: polígons de la resta rectilínia + bucles rodons interiors.
  const faces: Face[] = []
  const inner: Record<BoxFace, { center: Pt2; loop: Loop }[]> = { A: [], B: [], xmin: [], xmax: [], ymin: [], ymax: [] }
  for (const face of Object.keys(accepted) as BoxFace[]) {
    for (const rf of accepted[face]) {
      inner[face].push({ center: rf.center, loop: rf.loop })
      if (rf.exit) inner[rf.exit.face].push({ center: rf.exit.center, loop: rf.exit.loop })
      faces.push(...rf.faces)
    }
  }
  for (const face of Object.keys(frames) as BoxFace[]) {
    const f = frames[face]
    const [A, B] = extent[face]
    if (slanted(face)) {
      // Cara a 45°: el quadrilàter entre el cantell de fora (z = 0) i el de dins (z = T).
      const [a, b] = sideOf[face as keyof typeof sideOf]
      let quad = [o3[a]!, o3[b]!, i3[b]!, i3[a]!]
      const mid = mul(quad.reduce((acc, q) => add(acc, q), [0, 0, 0] as V3), 0.25)
      if (dot(newell(quad), sub(mid, [L / 2, W / 2, T / 2])) < 0) quad = [...quad].reverse()
      faces.push({ kind: "plane", loc: quad[0]!, normal: unit(newell(quad)), loops: [quad.map((q) => ({ p: q }))] })
      continue
    }
    const poly0 = facePoly(face)
    const polys: Poly2[] = poly0 ? regionMinusRects(poly0, rects[face]) : subtractRects(A, B, rects[face])
    for (const poly of polys) {
      const loops: Loop[] = [poly.outer.map((q) => ({ p: to3D(f, q) }))]
      for (const ring of poly.inners) loops.push(ring.map((q) => ({ p: to3D(f, q) })))
      for (const it of inner[face]) {
        const host = polys.find((pp) => pointInRing(it.center, pp.outer) && !pp.inners.some((ir) => pointInRing(it.center, ir))) ?? polys[0]
        if (host === poly) loops.push(it.loop)
      }
      faces.push({ kind: "plane", loc: to3D(f, poly.outer[0]!), normal: f.n, loops })
    }
  }
  faces.push(...extra)
  return { faces, warnings }
}

// --- Escriptura STEP -------------------------------------------------------------

/** Real STEP: fins a 4 decimals, sempre amb punt (`19.` / `22.5`), sense exponent. */
export function stepReal(n: number): string {
  let v = Math.round(n * 10000) / 10000
  if (Object.is(v, -0) || Math.abs(v) < 1e-9) v = 0
  return v.toFixed(4).replace(/0+$/, "")
}

/**
 * Cadena STEP: cometa doblada, barra invertida doblada i no-ASCII com a \X2\....\X0\. Els
 * parsers del taller parteixen per `;` sense mirar cadenes: `;` → `,`. Els salts de línia
 * passen a espai; els caràcters fora del BMP (emojis), que \X2\ no admet, a `?`.
 */
export function stepString(s: string): string {
  let out = ""
  let hex = ""
  const flush = () => {
    if (hex) out += `\\X2\\${hex}\\X0\\`
    hex = ""
  }
  for (const ch of s.replace(/[\r\n\t]+/g, " ").replace(/;/g, ",")) {
    const code = ch.codePointAt(0)!
    if (code >= 128 && code <= 0xffff) {
      hex += code.toString(16).toUpperCase().padStart(4, "0")
      continue
    }
    flush()
    if (code > 0xffff) out += "?"
    else if (code === 39) out += "''"
    else if (code === 92) out += "\\\\"
    else if (code >= 32) out += ch
  }
  flush()
  return out
}

class Writer {
  readonly lines: string[] = []
  private n = 0
  add(text: string): number {
    this.n += 1
    this.lines.push(`#${this.n}=${text};`)
    return this.n
  }
}

const k3 = (p: V3): string => p.map((v) => Math.round(v * 1000)).join(",")

class SolidWriter {
  private readonly points = new Map<string, number>()
  private readonly vertices = new Map<string, number>()
  private readonly edges = new Map<string, { id: number; start: number }>()
  private readonly w: Writer
  private readonly frame: TallerFrame
  /** Base local de la peça de mà esquerra (mirall): cal girar els bucles i el sentit dels arcs. */
  private readonly mirrored: boolean
  constructor(w: Writer, frame: TallerFrame) {
    this.w = w
    this.frame = frame
    this.mirrored = dot(cross(frame.xAxis, frame.yAxis), frame.zAxis) < 0
  }

  /** Bucle recorregut al revés: cada arc passa al punt on ara comença el tram, amb l'eix girat. */
  private reversed(loop: Loop): Loop {
    const n = loop.length
    const out: Loop = []
    for (let k = 0; k < n; k++) {
      const j = (n - k) % n
      const prev = loop[(j - 1 + n) % n]!
      out.push(prev.arc ? { p: loop[j]!.p, arc: { center: prev.arc.center, axis: neg(prev.arc.axis) } } : { p: loop[j]!.p })
    }
    return out
  }

  point(local: V3): number {
    const p = this.frame.point(local)
    const k = k3(p)
    const hit = this.points.get(k)
    if (hit !== undefined) return hit
    const id = this.w.add(`CARTESIAN_POINT('',(${p.map(stepReal).join(",")}))`)
    this.points.set(k, id)
    return id
  }
  direction(local: V3): number {
    const d = unit(this.frame.dir(local))
    return this.w.add(`DIRECTION('',(${d.map(stepReal).join(",")}))`)
  }
  vertex(local: V3): number {
    const k = k3(this.frame.point(local))
    const hit = this.vertices.get(k)
    if (hit !== undefined) return hit
    const id = this.w.add(`VERTEX_POINT('',#${this.point(local)})`)
    this.vertices.set(k, id)
    return id
  }
  axis2(loc: V3, axis: V3, ref: V3): number {
    return this.w.add(`AXIS2_PLACEMENT_3D('',#${this.point(loc)},#${this.direction(axis)},#${this.direction(ref)})`)
  }

  /** Aresta orientada de `a` a `b` (línia o arc), compartint-la si ja existeix. */
  orientedEdge(a: LoopPt, b: LoopPt): number {
    const va = this.vertex(a.p)
    const vb = this.vertex(b.p)
    let key: string
    let mid: V3 | null = null
    if (a.arc) {
      const ra = sub(a.p, a.arc.center)
      const rb = sub(b.p, a.arc.center)
      let theta = Math.atan2(dot(cross(ra, rb), a.arc.axis), dot(ra, rb))
      if (theta <= 1e-9) theta += Math.PI * 2
      mid = add(a.arc.center, rotate(ra, a.arc.axis, theta / 2))
      key = `A:${Math.min(va, vb)}:${Math.max(va, vb)}:${k3(this.frame.point(mid))}`
    } else {
      key = `L:${Math.min(va, vb)}:${Math.max(va, vb)}`
    }
    let edge = this.edges.get(key)
    if (!edge) {
      let curve: number
      if (a.arc) {
        const ra = sub(a.p, a.arc.center)
        // En una base mirall, el sentit antihorari local és horari al món: s'inverteix l'eix.
        const placement = this.axis2(a.arc.center, this.mirrored ? neg(a.arc.axis) : a.arc.axis, unit(ra))
        curve = this.w.add(`CIRCLE('',#${placement},${stepReal(len(ra))})`)
      } else {
        const vec = this.w.add(`VECTOR('',#${this.direction(unit(sub(b.p, a.p)))},1.)`)
        curve = this.w.add(`LINE('',#${this.point(a.p)},#${vec})`)
      }
      const id = this.w.add(`EDGE_CURVE('',#${va},#${vb},#${curve},.T.)`)
      edge = { id, start: va }
      this.edges.set(key, edge)
    }
    const same = edge.start === va
    return this.w.add(`ORIENTED_EDGE('',*,*,#${edge.id},${same ? ".T." : ".F."})`)
  }

  loop(loop0: Loop): number {
    const loop = this.mirrored ? this.reversed(loop0) : loop0
    const ids: number[] = []
    for (let i = 0; i < loop.length; i++) ids.push(this.orientedEdge(loop[i]!, loop[(i + 1) % loop.length]!))
    return this.w.add(`EDGE_LOOP('',(${ids.map((i) => `#${i}`).join(",")}))`)
  }

  face(face: Face): number {
    if (face.kind === "cyl") {
      const surf = this.w.add(`CYLINDRICAL_SURFACE('',#${this.axis2(face.loc, face.axis, face.ref)},${stepReal(face.radius)})`)
      const bound = this.w.add(`FACE_OUTER_BOUND('',#${this.loop(face.loop)},.T.)`)
      return this.w.add(`ADVANCED_FACE('',(#${bound}),#${surf},${face.outward ? ".T." : ".F."})`)
    }
    const axisAligned = Math.max(...face.normal.map(Math.abs)) > 0.999
    const l0 = face.loops[0]!
    const ref = axisAligned ? (Math.abs(face.normal[2]) > 0.5 ? X : Z) : unit(sub(l0[1]!.p, l0[0]!.p))
    const surf = this.w.add(`PLANE('',#${this.axis2(face.loc, face.normal, ref)})`)
    const bounds = face.loops.map((l, i) => this.w.add(`${i === 0 ? "FACE_OUTER_BOUND" : "FACE_BOUND"}('',#${this.loop(l)},.T.)`))
    return this.w.add(`ADVANCED_FACE('',(${bounds.map((b) => `#${b}`).join(",")}),#${surf},.T.)`)
  }
}

interface StepContext {
  w: Writer
  ctx: number
  prodCtx: number
  defCtx: number
}

function stepContext(): StepContext {
  const w = new Writer()
  const appCtx = w.add(`APPLICATION_CONTEXT('automotive design')`)
  w.add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2010,#${appCtx})`)
  const prodCtx = w.add(`PRODUCT_CONTEXT('',#${appCtx},'mechanical')`)
  const defCtx = w.add(`PRODUCT_DEFINITION_CONTEXT('part definition',#${appCtx},'design')`)
  const lengthUnit = w.add(`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`)
  const angleUnit = w.add(`(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))`)
  const solidAngleUnit = w.add(`(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())`)
  const uncertainty = w.add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(0.001),#${lengthUnit},'distance_accuracy_value','')`)
  const ctx = w.add(
    `(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${uncertainty}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lengthUnit},#${angleUnit},#${solidAngleUnit}))REPRESENTATION_CONTEXT('','3D'))`,
  )
  return { w, ctx, prodCtx, defCtx }
}

function identityAxis(w: Writer): number {
  const origin = w.add(`CARTESIAN_POINT('',(0.,0.,0.))`)
  const dz = w.add(`DIRECTION('',(0.,0.,1.))`)
  const dx = w.add(`DIRECTION('',(1.,0.,0.))`)
  return w.add(`AXIS2_PLACEMENT_3D('',#${origin},#${dz},#${dx})`)
}

/** Producte amb la seva definició: PRODUCT → FORMATION → DEFINITION → DEFINITION_SHAPE. */
function product(c: StepContext, id: string, name: string, description: string): { product: number; pd: number; pds: number } {
  const product = c.w.add(`PRODUCT('${stepString(id)}','${stepString(name)}','${stepString(description)}',(#${c.prodCtx}))`)
  const formation = c.w.add(`PRODUCT_DEFINITION_FORMATION('','',#${product})`)
  const pd = c.w.add(`PRODUCT_DEFINITION('design','',#${formation},#${c.defCtx})`)
  const pds = c.w.add(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`)
  return { product, pd, pds }
}

function stepText(c: StepContext, name: string, date: string): string {
  const header = [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('STEP AP214'),'2;1');",
    `FILE_NAME('${stepString(name)}.step','${date}',('Mobles CNC'),(''),'Mobles CNC configurador','','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
  ]
  return [...header, ...c.w.lines, "ENDSEC;", "END-ISO-10303-21;", ""].join("\r\n")
}

/** Sòlid B-rep d'una peça (coordenades del moble muntat, marc del taller). */
function writeBrep(c: StepContext, p: Panel, cad: boolean): { brep: number; warnings: string[] } {
  const sw = new SolidWriter(c.w, tallerFrame(p))
  const solid = p.outline ? outlineSolid(p, cad) : panelSolid(p, cad)
  const faceIds = solid.faces.map((f) => sw.face(f))
  const shell = c.w.add(`CLOSED_SHELL('',(${faceIds.map((f) => `#${f}`).join(",")}))`)
  const brep = c.w.add(`MANIFOLD_SOLID_BREP('${stepString(workshopName(p.name))}',#${shell})`)
  return { brep, warnings: solid.warnings }
}

/** Genera el STEP de totes les peces (coordenades del moble muntat, marc del taller). */
export function toStep(panels: Panel[], options: StepOptions): StepResult {
  const c = stepContext()
  const { w, ctx } = c
  const warnings: string[] = []
  const date = options.date ?? new Date().toISOString().slice(0, 19)
  const products: number[] = []

  panels.forEach((p, i) => {
    // El taller llegeix el nom d'aquí, en text pla: el mateix que la columna Nombre_pieza del CSV.
    const name = stepString(workshopName(p.name))
    const { brep, warnings: ws } = writeBrep(c, p, false)
    warnings.push(...ws)
    const axis = identityAxis(w)
    const rep = w.add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${name}',(#${brep},#${axis}),#${ctx})`)
    const pr = product(c, p.name, p.name, `${p.id} (${i + 1})`)
    products.push(pr.product)
    w.add(`SHAPE_DEFINITION_REPRESENTATION(#${pr.pds},#${rep})`)
  })
  if (products.length) w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part','',(${products.map((p) => `#${p}`).join(",")}))`)
  return { text: stepText(c, options.name, date), warnings, solids: panels.length }
}

export interface StepCadGroup {
  /** Nom del conjunt (mòdul, peces lliures…). */
  name: string
  panels: Panel[]
}

interface StepCadOptions extends StepOptions {
  /** Color RGB (0–1) de cada peça: el del seu material. */
  color?: (p: Panel) => [number, number, number]
}

/**
 * STEP per obrir el moble a TopSolid (o qualsevol CAD) i continuar-lo treballant: un conjunt
 * (el moble) amb un subconjunt per mòdul i una peça per tauler, amb el nom i el material, el
 * color del material, els ingletes de debò i els booleans 3D. Les peces van ja col·locades
 * (transformacions identitat), en mm, amb Z amunt com el STEP del taller.
 */
export function toStepCad(groups: StepCadGroup[], options: StepCadOptions): StepResult {
  const c = stepContext()
  const { w, ctx } = c
  const warnings: string[] = []
  const date = options.date ?? new Date().toISOString().slice(0, 19)
  const styled: number[] = []
  const colours = new Map<string, number>()
  const colourStyle = (rgb: [number, number, number]): number => {
    const key = rgb.map((v) => v.toFixed(3)).join(",")
    const hit = colours.get(key)
    if (hit) return hit
    const col = w.add(`COLOUR_RGB('',${rgb.map(stepReal).join(",")})`)
    const fasc = w.add(`FILL_AREA_STYLE_COLOUR('',#${col})`)
    const fas = w.add(`FILL_AREA_STYLE('',(#${fasc}))`)
    const ssfa = w.add(`SURFACE_STYLE_FILL_AREA(#${fas})`)
    const sss = w.add(`SURFACE_SIDE_STYLE('',(#${ssfa}))`)
    const ssu = w.add(`SURFACE_STYLE_USAGE(.BOTH.,#${sss})`)
    const psa = w.add(`PRESENTATION_STYLE_ASSIGNMENT((#${ssu}))`)
    colours.set(key, psa)
    return psa
  }

  // Arrel: el moble.
  const root = product(c, options.name, options.name, "Moble")
  const rootAxis = identityAxis(w)
  const rootRep = w.add(`SHAPE_REPRESENTATION('${stepString(options.name)}',(#${rootAxis}),#${ctx})`)
  w.add(`SHAPE_DEFINITION_REPRESENTATION(#${root.pds},#${rootRep})`)
  const assemblies = [root.product]
  const parts: number[] = []
  let solids = 0
  let occ = 0

  /** Posa `child` dins de `parent` (transformació identitat entre els seus eixos). */
  const place = (parentPd: number, parentRep: number, parentAxis: number, childPd: number, childRep: number, childAxis: number, name: string) => {
    occ += 1
    const nauo = w.add(`NEXT_ASSEMBLY_USAGE_OCCURRENCE('${occ}','${stepString(name)}','',#${parentPd},#${childPd},$)`)
    const pds = w.add(`PRODUCT_DEFINITION_SHAPE('','',#${nauo})`)
    const idt = w.add(`ITEM_DEFINED_TRANSFORMATION('','',#${parentAxis},#${childAxis})`)
    const rel = w.add(`(REPRESENTATION_RELATIONSHIP('','',#${childRep},#${parentRep})REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#${idt})SHAPE_REPRESENTATION_RELATIONSHIP())`)
    w.add(`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#${rel},#${pds})`)
  }

  for (const g of groups) {
    if (!g.panels.length) continue
    const sub = product(c, g.name, g.name, "Conjunt")
    assemblies.push(sub.product)
    const subAxis = identityAxis(w)
    const subRep = w.add(`SHAPE_REPRESENTATION('${stepString(g.name)}',(#${subAxis}),#${ctx})`)
    w.add(`SHAPE_DEFINITION_REPRESENTATION(#${sub.pds},#${subRep})`)
    place(root.pd, rootRep, rootAxis, sub.pd, subRep, subAxis, g.name)
    for (const p of g.panels) {
      const { brep, warnings: ws } = writeBrep(c, p, true)
      warnings.push(...ws)
      solids += 1
      const axis = identityAxis(w)
      // El taller llegeix el nom de la representació (sense descodificar \X2\): el de taller en
      // ASCII, igual que al CSV. El PRODUCT porta el nom llegible per a l'arbre del CAD.
      const label = p.label || p.name
      const rep = w.add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${stepString(workshopName(p.name))}',(#${brep},#${axis}),#${ctx})`)
      const pr = product(c, label, label, `${p.material} · ${p.length} × ${p.width} × ${p.thickness} mm`)
      parts.push(pr.product)
      w.add(`SHAPE_DEFINITION_REPRESENTATION(#${pr.pds},#${rep})`)
      place(sub.pd, subRep, subAxis, pr.pd, rep, axis, label)
      if (options.color) styled.push(w.add(`STYLED_ITEM('color',(#${colourStyle(options.color(p))}),#${brep})`))
    }
  }
  if (styled.length) w.add(`MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(${styled.map((s) => `#${s}`).join(",")}),#${ctx})`)
  w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('assembly','',(${assemblies.map((a) => `#${a}`).join(",")}))`)
  if (parts.length) w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part','',(${parts.map((p) => `#${p}`).join(",")}))`)
  return { text: stepText(c, options.name, date), warnings, solids }
}
