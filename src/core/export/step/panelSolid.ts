import { isFlatPocket, pocketPolygon, type EdgeSide, type Panel } from "../../model"
import { pointInPolygon, signedArea } from "../../model/polygon"
import { rectsOverlap, subtractRects, type Poly2, type Pt2, type Rect2 } from "../region2d"
import { cutoutFeature, cylPocket, EDGE_TO_FACE, EPS, featureBox, regionMinusRects, type BoxFace, type RoundFeature } from "./features"
import { blindDepth, type PanelSolid } from "./outlineSolid"
import { add, dot, frameFor, mul, neg, newell, rectFace, sub, to2D, to3D, unit, X, Y, Z, type Face, type Frame, type Loop, type V3 } from "./vec"

/** Estat de la caixa d'una peça rectangular mentre s'hi afegeixen els mecanitzats (passos de `panelSolid`). */
interface BoxRun {
  p: Panel
  cad: boolean
  L: number
  W: number
  T: number
  warnings: string[]
  mit: Set<EdgeSide>
  il: number
  ir: number
  ib: number
  itp: number
  /** Algun buidat s'ha escurçat fins a l'inglet. */
  clamped: boolean
  frames: Record<BoxFace, Frame>
  extent: Record<BoxFace, [number, number]>
  rects: Record<BoxFace, Rect2[]>
  volumes: { min: V3; max: V3 }[]
  rounds: Record<BoxFace, RoundFeature[]>
  extra: Face[]
}

/** Contorn de les cares amb els ingletes (la A retallada i les laterals en trapezi o a 45°). */
interface BoxShape {
  o3: V3[]
  i3: V3[]
  sideOf: Record<"ymin" | "xmax" | "ymax" | "xmin", [number, number, EdgeSide]>
  facePoly: (face: BoxFace) => Pt2[] | null
  slanted: (face: BoxFace) => boolean
}

/**
 * Sòlid d'una peça rectangular amb els seus mecanitzats. `cad` (STEP per a TopSolid) afegeix el
 * que el taller no necessita: els ingletes de debò (cares a 45°) i els booleans 3D
 * (`solidCuts`).
 */
export function panelSolid(p: Panel, cad = false): PanelSolid {
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
  const run: BoxRun = { p, cad, L, W, T, warnings, mit, il, ir, ib, itp, clamped: false, frames, extent, rects, volumes, rounds, extra }

  boxGrooves(run)
  boxHoles(run)
  boxCutouts(run)
  boxSolidCuts(run)
  const shape = boxShape(run)
  if (run.clamped) warnings.push(`${p.name} (${p.id}): ranura o tall escurçat fins a l'inglet (al STEP no entra a la falca de 45°).`)
  const accepted = acceptRounds(run, shape)
  const faces = boxFaces(run, shape, accepted)
  return { faces, warnings }
}

/** Buidat rectangular: ranura (cec) o tall rectangular (passant), en Z local [zlo, zhi]. */
function rectPocket(run: BoxRun, x0: number, x1: number, y0: number, y1: number, zlo: number, zhi: number, entry: "A" | "B" | "through"): void {
  const { L, W, T, cad, mit, il, ir, ib, itp, volumes, rects, extra } = run
  if (mit.size) {
    const c = [il && x0 < il + 0.5 ? il + 0.5 : x0, ir && x1 > L - ir - 0.5 ? L - ir - 0.5 : x1, ib && y0 < ib + 0.5 ? ib + 0.5 : y0, itp && y1 > W - itp - 0.5 ? W - itp - 0.5 : y1]
    if (c[0] !== x0 || c[1] !== x1 || c[2] !== y0 || c[3] !== y1) run.clamped = true
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

/** Ranures (buidats cecs). */
function boxGrooves(run: BoxRun): void {
  const { p, L, W, T } = run
  for (const g of p.grooves) {
    const x0 = Math.max(0, g.x)
    const x1 = Math.min(L, g.x + g.w)
    const y0 = Math.max(0, g.y)
    const y1 = Math.min(W, g.y + g.h)
    const d = Math.min(g.depth, T - 0.5)
    if (x1 - x0 <= EPS || y1 - y0 <= EPS || d <= 0) continue
    if (g.face === "A") rectPocket(run, x0, x1, y0, y1, T - d, T, "A")
    else rectPocket(run, x0, x1, y0, y1, 0, d, "B")
  }
}

/** Forats de cara i de cantell. */
function boxHoles(run: BoxRun): void {
  const { p, cad, L, W, T, warnings, frames, rounds } = run
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
}

/** Talls passants. */
function boxCutouts(run: BoxRun): void {
  const { p, L, W, T, rounds } = run
  // Talls passants.
  for (const c of p.cutouts ?? []) {
    if (c.kind === "rect") {
      const x0 = Math.max(0, c.x)
      const x1 = Math.min(L, c.x + c.w)
      const y0 = Math.max(0, c.y)
      const y1 = Math.min(W, c.y + c.h)
      if (x1 - x0 > EPS && y1 - y0 > EPS) rectPocket(run, x0, x1, y0, y1, 0, T, "through")
      continue
    }
    rounds.A.push(cutoutFeature(c, T))
  }
}

/** Booleans 3D (només al STEP per a TopSolid). */
function boxSolidCuts(run: BoxRun): void {
  const { p, cad, L, W, T, warnings, frames, rounds } = run
  // Booleans 3D (STEP per a TopSolid): prisma de secció poligonal que entra per una cara i
  // en surt per l'oposada (passant) o s'atura a dins (cec). Alineat als eixos de la peça.
  // Els buidats de qualsevol forma (`pockets`), com un prisma del contorn fins a la fondària (el fons arrodonit o de forma
  // queda pla: el STEP no el porta).
  const pockets = (p.pockets ?? []).map((k) => {
    if (cad && !isFlatPocket(k)) warnings.push(`${p.name} (${p.id}): buidat amb el fons no pla; al STEP surt de fons pla (${Math.round(k.depth * 10) / 10} mm).`)
    const z0 = k.face === "A" ? T : 0
    return { points: pocketPolygon(k).map(([x, y]) => [x, y, z0] as V3), dir: [0, 0, k.face === "A" ? -k.depth : k.depth] as V3 }
  })
  if (cad)
    for (const sc of [...(p.solidCuts ?? []), ...pockets]) {
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
}

/** Contorn de les cares amb els ingletes. */
function boxShape(run: BoxRun): BoxShape {
  const { L, W, T, mit, il, ir, ib, itp, frames } = run
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
  return { o3, i3, sideOf, facePoly, slanted }
}

/** Els mecanitzats rodons que es modelen (els altres, amb avís). */
function acceptRounds(run: BoxRun, shape: BoxShape): Record<BoxFace, RoundFeature[]> {
  const { facePoly, slanted } = shape
  const { p, cad, warnings, extent, rects, volumes, rounds } = run
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
      if (!corners.every((c) => pointInPolygon(c, poly))) return false
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
  return accepted
}

/** Les cares de la caixa. */
function boxFaces(run: BoxRun, shape: BoxShape, accepted: Record<BoxFace, RoundFeature[]>): Face[] {
  const { o3, i3, sideOf, facePoly, slanted } = shape
  const { L, W, T, frames, extent, rects, extra } = run
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
        const host = polys.find((pp) => pointInPolygon(it.center, pp.outer) && !pp.inners.some((ir) => pointInPolygon(it.center, ir))) ?? polys[0]
        if (host === poly) loops.push(it.loop)
      }
      faces.push({ kind: "plane", loc: to3D(f, poly.outer[0]!), normal: f.n, loops })
    }
  }
  faces.push(...extra)
  return faces
}
