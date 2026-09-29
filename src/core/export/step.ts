import { arcOf, bulgeOf, ccwB, flatten, type EdgeSide, type Panel, type Vec3 } from "../model"
import { pointInRing, rectsOverlap, subtractRects, type Poly2, type Pt2, type Rect2 } from "./region2d"

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

export interface StepOptions {
  /** Nom del moble (FILE_NAME i PRODUCT arrel). */
  name: string
  /** Data ISO per a la capçalera. Per defecte, ara. */
  date?: string
}

export interface StepResult {
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
export const toTallerDir = (v: V3): V3 => [v[0], -v[2], v[1]]

export interface TallerFrame {
  origin: V3
  xAxis: V3
  yAxis: V3
  zAxis: V3
  point: (local: V3) => V3
  dir: (local: V3) => V3
}

/** Transformació local de la peça → coordenades del taller (rotació + translació). */
export function tallerFrame(p: Panel): TallerFrame {
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
function outlineSolid(p: Panel): PanelSolid {
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
  faces.push({ kind: "plane", loc: at(0, T), normal: Z, loops: [loopA] })
  faces.push({ kind: "plane", loc: at(0, 0), normal: neg(Z), loops: [loopB] })
  const warnings: string[] = []
  const features = p.holes.length + p.grooves.length + (p.cutouts?.length ?? 0)
  if (features) warnings.push(`${p.name} (${p.id}): peça amb forma; els seus ${features} mecanitzats no es modelen al STEP (surten al DXF i al CSV).`)
  return { faces, warnings }
}

function panelSolid(p: Panel): PanelSolid {
  const L = p.length
  const W = p.width
  const T = p.thickness
  const warnings: string[] = []

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
  const rounds: Record<BoxFace, RoundFeature[]> = { A: [], B: [], xmin: [], xmax: [], ymin: [], ymax: [] }
  const extra: Face[] = []

  // Buidat rectangular: ranura (cec) o tall rectangular (passant), en Z local [zlo, zhi].
  const rectPocket = (x0: number, x1: number, y0: number, y1: number, zlo: number, zhi: number, entry: "A" | "B" | "through") => {
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

  // Forats de cara i de cantell.
  for (const h of p.holes) {
    const r = h.diameter / 2
    const depth = Math.min(h.depth, h.face === "edge" ? Math.max(L, W) : T - 0.5)
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
    const pocket = cylPocket(c, f.n, X, r, depth, false)
    const center = to2D(f, c)
    rounds[face].push({
      bbox: { a0: center[0] - r, a1: center[0] + r, b0: center[1] - r, b1: center[1] + r },
      center,
      loop: pocket.loop,
      faces: pocket.faces,
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
    const fA = frames.A
    const fB = frames.B
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
      rounds.A.push({
        bbox: bb(fA, T),
        center: cA,
        loop: loopA,
        faces: sides,
        exit: { face: "B", loop: loopB, center: cB, bbox: bb(fB, 0) },
        what: `tall de ${n} costats`,
      })
      continue
    }
    if (c.kind === "circle") {
      const r = c.diameter / 2
      const centre: V3 = [c.x, c.y, T]
      const pocket = cylPocket(centre, Z, X, r, T, true)
      const cA = to2D(fA, centre)
      const cB = to2D(fB, [c.x, c.y, 0])
      rounds.A.push({
        bbox: { a0: cA[0] - r, a1: cA[0] + r, b0: cA[1] - r, b1: cA[1] + r },
        center: cA,
        loop: pocket.loop,
        faces: pocket.faces,
        exit: { face: "B", loop: pocket.exit, center: cB, bbox: { a0: cB[0] - r, a1: cB[0] + r, b0: cB[1] - r, b1: cB[1] + r } },
        what: `passacables Ø${c.diameter} a (${c.x}, ${c.y})`,
      })
      continue
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
      rounds.A.push({
        bbox: { a0: cA[0] - r, a1: cA[0] + r, b0: cA[1] - r, b1: cA[1] + r },
        center: cA,
        loop: pocket.loop,
        faces: pocket.faces,
        exit: { face: "B", loop: pocket.exit, center: cB, bbox: { a0: cB[0] - r, a1: cB[0] + r, b0: cB[1] - r, b1: cB[1] + r } },
        what: `ranura a (${c.x}, ${c.y})`,
      })
      continue
    }
    const slot = slotThrough(c1, c2, r, Z, T)
    const cA: Pt2 = [c.x + c.w / 2, c.y + c.h / 2]
    const cB = to2D(fB, [cA[0], cA[1], 0])
    rounds.A.push({
      bbox: { a0: c.x, a1: c.x + c.w, b0: c.y, b1: c.y + c.h },
      center: cA,
      loop: slot.loop,
      faces: slot.faces,
      exit: { face: "B", loop: slot.exit, center: cB, bbox: { a0: c.y, a1: c.y + c.h, b0: c.x, b1: c.x + c.w } },
      what: `ranura ${c.w}×${c.h} a (${c.x}, ${c.y})`,
    })
  }

  // Valida els mecanitzats rodons: dins de la cara i sense tocar cap altre mecanitzat.
  const accepted: Record<BoxFace, RoundFeature[]> = { A: [], B: [], xmin: [], xmax: [], ymin: [], ymax: [] }
  const occupied: Record<BoxFace, Rect2[]> = { A: [], B: [], xmin: [], xmax: [], ymin: [], ymax: [] }
  const fits = (face: BoxFace, bbox: Rect2): boolean => {
    const [A, B] = extent[face]
    if (bbox.a0 <= EPS || bbox.b0 <= EPS || bbox.a1 >= A - EPS || bbox.b1 >= B - EPS) return false
    if (rects[face].some((r) => rectsOverlap(r, bbox, 0.01))) return false
    if (occupied[face].some((r) => rectsOverlap(r, bbox, 0.01))) return false
    return true
  }
  for (const face of Object.keys(rounds) as BoxFace[]) {
    for (const rf of rounds[face]) {
      const ok = fits(face, rf.bbox) && (!rf.exit || fits(rf.exit.face, rf.exit.bbox))
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
    const polys: Poly2[] = subtractRects(A, B, rects[face])
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

/** Cadena STEP: cometes dobles i caràcters fora d'ASCII com a \X2\....\X0\. */
export function stepString(s: string): string {
  let out = ""
  let i = 0
  while (i < s.length) {
    const code = s.codePointAt(i)!
    if (code < 128) {
      out += code === 39 ? "''" : String.fromCodePoint(code)
      i += 1
      continue
    }
    let hex = ""
    while (i < s.length) {
      const c = s.codePointAt(i)!
      if (c < 128) break
      hex += c > 0xffff ? "\\X4\\" : c.toString(16).toUpperCase().padStart(4, "0")
      i += c > 0xffff ? 2 : 1
    }
    out += `\\X2\\${hex}\\X0\\`
  }
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
  constructor(w: Writer, frame: TallerFrame) {
    this.w = w
    this.frame = frame
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
        const placement = this.axis2(a.arc.center, a.arc.axis, unit(ra))
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

  loop(loop: Loop): number {
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
    const ref = Math.abs(face.normal[2]) > 0.5 ? X : Z
    const surf = this.w.add(`PLANE('',#${this.axis2(face.loc, face.normal, ref)})`)
    const bounds = face.loops.map((l, i) => this.w.add(`${i === 0 ? "FACE_OUTER_BOUND" : "FACE_BOUND"}('',#${this.loop(l)},.T.)`))
    return this.w.add(`ADVANCED_FACE('',(${bounds.map((b) => `#${b}`).join(",")}),#${surf},.T.)`)
  }
}

/** Genera el STEP de totes les peces (coordenades del moble muntat, marc del taller). */
export function toStep(panels: Panel[], options: StepOptions): StepResult {
  const w = new Writer()
  const warnings: string[] = []
  const date = options.date ?? new Date().toISOString().slice(0, 19)

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
  const products: number[] = []

  panels.forEach((p, i) => {
    const name = stepString(p.name)
    const frame = tallerFrame(p)
    const sw = new SolidWriter(w, frame)
    const solid = p.outline ? outlineSolid(p) : panelSolid(p)
    warnings.push(...solid.warnings)
    const faceIds = solid.faces.map((f) => sw.face(f))
    const shell = w.add(`CLOSED_SHELL('',(${faceIds.map((f) => `#${f}`).join(",")}))`)
    const brep = w.add(`MANIFOLD_SOLID_BREP('${name}',#${shell})`)
    const origin = w.add(`CARTESIAN_POINT('',(0.,0.,0.))`)
    const dz = w.add(`DIRECTION('',(0.,0.,1.))`)
    const dx = w.add(`DIRECTION('',(1.,0.,0.))`)
    const axis = w.add(`AXIS2_PLACEMENT_3D('',#${origin},#${dz},#${dx})`)
    const rep = w.add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${name}',(#${brep},#${axis}),#${ctx})`)
    const productId = stepString(`${p.id}`)
    const product = w.add(`PRODUCT('${name}','${name}','${productId} (${i + 1})',(#${prodCtx}))`)
    products.push(product)
    const formation = w.add(`PRODUCT_DEFINITION_FORMATION('','',#${product})`)
    const definition = w.add(`PRODUCT_DEFINITION('design','',#${formation},#${defCtx})`)
    const shape = w.add(`PRODUCT_DEFINITION_SHAPE('','',#${definition})`)
    w.add(`SHAPE_DEFINITION_REPRESENTATION(#${shape},#${rep})`)
  })
  if (products.length) w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part','',(${products.map((p) => `#${p}`).join(",")}))`)

  const header = [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('STEP AP214'),'2;1');",
    `FILE_NAME('${stepString(options.name)}.step','${date}',('Mobles CNC'),(''),'Mobles CNC configurador','','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
  ]
  const text = [...header, ...w.lines, "ENDSEC;", "END-ISO-10303-21;", ""].join("\r\n")
  return { text, warnings, solids: panels.length }
}
