import { DEFAULT_DEPTHS, legPilot, snapDrill, type HardwareProposal, type LocalFrame, type ProposedHole } from "./proposal"
import { add, cross, dot, mul, norm, sub, type V3 } from "./stepGeometry"

/**
 * **Marc de muntatge a partir de la malla** (el GLB desat, o la malla que acaba de fer OpenCascade), quan no hi ha el STEP
 * amb els cilindres (els conjunts de Blum: la cassoleta no és cap `CYLINDRICAL_SURFACE`; un item que canvia de «què és»
 * a l'editor i només té el model desat). Tot són **cercles**: els vèrtexs d'una malla de CAD que són en un cilindre o
 * una vora rodona cauen exactament en un cercle del pla perpendicular al seu eix, i els de la mateixa alçada (`t`)
 * formen un anell. Es busquen anells per cada eix del fitxer (els models dels fabricants són alineats als eixos):
 * - frontissa: el cercle més gros de Ø25–41 (la cassoleta) dona l'eix (`n`), el centre i la fondària; els cercles de
 *   Ø3–7 al voltant (a ≤ 45 mm), els cargols o espigues de l'ala; `v` cap als cargols (o cap al cos), `u` = `v × n`.
 * - placa, tirador, pota: la cara de muntatge és el pla d'on surten els forats petits (l'extrem d'un forat o d'un tetó és
 *   al pla); `n` del pla cap al cos del ferratge; l'origen al mig dels forats (parell simètric) o al centre dels forats.
 * És una **estimació**: les notes ho diuen i el que surt es revisa i es confirma com la resta. Pur.
 */

export interface MeshLike {
  /** Posicions (mm, x y z seguides). */
  position: ArrayLike<number>
}

interface MeshCircle {
  /** Eix del fitxer (0 = X, 1 = Y, 2 = Z) perpendicular al cercle. */
  axis: 0 | 1 | 2
  /** Centre al pla (les dues altres coordenades, en l'ordre dels eixos) i radi (mm). */
  centre: [number, number]
  r: number
  /** Tram que ocupen els anells d'aquest cercle al llarg de l'eix (mm). */
  t0: number
  t1: number
  /** Quants vèrtexs hi cauen. */
  inliers: number
}

const AXES: readonly (0 | 1 | 2)[] = [0, 1, 2]
/** Les dues coordenades del pla perpendicular a un eix (en l'ordre dels eixos: Y Z, X Z, X Y). */
const PLANE: Record<0 | 1 | 2, [0 | 1 | 2, 0 | 1 | 2]> = { 0: [1, 2], 1: [0, 2], 2: [0, 1] }

/** Els vèrtexs (mm), sense repetits (a 0,02 mm). */
export function meshPoints(meshes: readonly MeshLike[], scale = 1): V3[] {
  const seen = new Set<string>()
  const out: V3[] = []
  for (const m of meshes) {
    const p = m.position
    for (let i = 0; i + 2 < p.length; i += 3) {
      const x = p[i]! * scale
      const y = p[i + 1]! * scale
      const z = p[i + 2]! * scale
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      const key = `${Math.round(x * 50)},${Math.round(y * 50)},${Math.round(z * 50)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push([x, y, z])
    }
  }
  return out
}

/** Cercle per tres punts del pla (o `null` si són alineats). */
function circumcircle(a: [number, number], b: [number, number], c: [number, number]): { c: [number, number]; r: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
  if (Math.abs(d) < 1e-9) return null
  const a2 = a[0] * a[0] + a[1] * a[1]
  const b2 = b[0] * b[0] + b[1] * b[1]
  const c2 = c[0] * c[0] + c[1] * c[1]
  const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d
  const uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d
  return { c: [ux, uy], r: Math.hypot(a[0] - ux, a[1] - uy) }
}

/** Generador determinista (els mateixos punts donen el mateix resultat). */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 1_000_000) / 1_000_000
  }
}

/**
 * Cercles (sencers) de radi entre `rMin` i `rMax` perpendiculars a l'eix `axis`: anells de vèrtexs a la mateixa alçada
 * (RANSAC dins de cada anell, perquè els tres punts triats siguin del mateix cercle), confirmats amb tots els vèrtexs de
 * la malla projectats (volta ≥ 300°). Ordenats per quants vèrtexs hi cauen.
 */
export function circlesAlong(points: readonly V3[], axis: 0 | 1 | 2, rMin: number, rMax: number): MeshCircle[] {
  const [ia, ib] = PLANE[axis]
  const flat = points.map((p): [number, number, number] => [p[ia], p[ib], p[axis]])
  // Anells: els vèrtexs a la mateixa alçada (0,02 mm).
  const rings = new Map<number, number[]>()
  flat.forEach((p, i) => {
    const k = Math.round(p[2] * 50)
    const r = rings.get(k)
    if (r) r.push(i)
    else rings.set(k, [i])
  })
  const found: (MeshCircle & { ts: number[]; hits: number })[] = []
  const random = rng(points.length * 7919 + axis)
  const TOL = 0.08
  const onCircle = (q: number, c: [number, number], r: number) => Math.abs(Math.hypot(flat[q]![0] - c[0], flat[q]![1] - c[1]) - r) <= TOL
  /** Un anell fa tota la volta: el forat més gran entre punts seguits és petit (segons quants punts té). */
  const fullTurn = (idx: readonly number[], c: [number, number]) => {
    const angles = idx.map((q) => Math.atan2(flat[q]![1] - c[1], flat[q]![0] - c[0])).sort((a, b) => a - b)
    let gap = angles[0]! + 2 * Math.PI - angles[angles.length - 1]!
    for (let i = 1; i < angles.length; i++) gap = Math.max(gap, angles[i]! - angles[i - 1]!)
    return gap <= Math.max(Math.PI / 3, (2.5 * 2 * Math.PI) / angles.length)
  }
  for (const ring of rings.values()) {
    // Dins d'un anell hi pot haver més d'un cercle (els dos tetons d'una placa): trobat un, se'n treuen els punts i es
    // continua.
    let idx = ring
    let tries = Math.min(80, idx.length * 3)
    while (idx.length >= 8 && tries-- > 0) {
      const i = idx[Math.floor(random() * idx.length)]!
      const j = idx[Math.floor(random() * idx.length)]!
      const l = idx[Math.floor(random() * idx.length)]!
      if (i === j || j === l || i === l) continue
      const cc = circumcircle([flat[i]![0], flat[i]![1]], [flat[j]![0], flat[j]![1]], [flat[l]![0], flat[l]![1]])
      if (!cc || cc.r < rMin || cc.r > rMax) continue
      const hits = idx.filter((q) => onCircle(q, cc.c, cc.r))
      // Prou punts de l'anell al cercle i tota la volta (si no, tres punts qualssevol o un arrodoniment).
      if (hits.length < 8 || !fullTurn(hits, cc.c)) continue
      const t = flat[i]![2]
      const same = found.find((f) => Math.abs(f.r - cc.r) <= 0.15 && Math.hypot(f.centre[0] - cc.c[0], f.centre[1] - cc.c[1]) <= 0.15)
      if (same) {
        same.ts.push(t)
        same.hits += hits.length
      } else found.push({ axis, centre: cc.c, r: cc.r, t0: t, t1: t, inliers: 0, ts: [t], hits: hits.length })
      const drop = new Set(hits)
      idx = idx.filter((q) => !drop.has(q))
      tries = Math.min(80, idx.length * 3)
    }
  }
  // Un cercle trobat en un anell es busca a tots els altres (els anells grans —la cara de l'ala sencera— rarament
  // donen tres punts del mateix cercle a l'atzar, però s'hi reconeix el cercle d'un altre anell): així el tram del
  // cilindre va de punta a punta i el cercle té tots els seus vèrtexs.
  const ringList = [...rings.entries()]
  for (const f of found) {
    for (const [k, idx] of ringList) {
      const t = k / 50
      if (f.ts.some((x) => Math.abs(x - t) < 0.015)) continue
      const hits = idx.filter((q) => onCircle(q, f.centre, f.r))
      if (hits.length < 8 || !fullTurn(hits, f.centre)) continue
      f.ts.push(t)
      f.hits += hits.length
    }
  }
  return found
    .map((f) => {
      const { ts, hits, ...rest } = f
      return { ...rest, t0: Math.min(...ts), t1: Math.max(...ts), inliers: hits }
    })
    .sort((a, b) => b.inliers - a.inliers)
}

/** Quants vèrtexs hi ha a l'alçada `t` de l'eix (la cara d'una placa en té molts; la punta d'un tetó, pocs). */
function ringSize(points: readonly V3[], axis: 0 | 1 | 2, t: number): number {
  let n = 0
  for (const p of points) if (Math.abs(p[axis] - t) < 0.015) n++
  return n
}

const mean = (pts: readonly V3[]): V3 => (pts.length ? mul(pts.reduce((s, p) => add(s, p), [0, 0, 0] as V3), 1 / pts.length) : [0, 0, 0])
const unit = (axis: 0 | 1 | 2, sign = 1): V3 => {
  const v: V3 = [0, 0, 0]
  v[axis] = sign
  return v
}
/** El punt 3D d'un cercle: el centre al pla i `t` a l'eix. */
const at3 = (c: MeshCircle, t: number): V3 => {
  const p: V3 = [0, 0, 0]
  const [ia, ib] = PLANE[c.axis]
  p[ia] = c.centre[0]
  p[ib] = c.centre[1]
  p[c.axis] = t
  return p
}
const r2 = (x: number) => Math.round(x * 100) / 100 || 0
const upHalf = (x: number) => Math.ceil(x * 2 - 1e-6) / 2
const fmt = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",")

/** Caixa (mm) dels punts al marc. */
function boxIn(points: readonly V3[], f: LocalFrame): { min: V3; max: V3 } {
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of points) {
    const d = sub(p, f.origin)
    const l: V3 = [dot(d, f.u), dot(d, f.v), dot(d, f.n)]
    for (let k = 0; k < 3; k++) {
      if (l[k]! < min[k]!) min[k] = l[k]!
      if (l[k]! > max[k]!) max[k] = l[k]!
    }
  }
  return Number.isFinite(min[0]) ? { min: min.map(r2) as V3, max: max.map(r2) as V3 } : { min: [0, 0, 0], max: [0, 0, 0] }
}

/** Direcció «al llarg» per defecte al pla perpendicular a `n`: Z del fitxer, si no X, si no Y. */
function fallbackAlong(n: V3): V3 {
  for (const a of [[0, 0, 1], [1, 0, 0], [0, 1, 0]] as V3[]) {
    const p = sub(a, mul(n, dot(a, n)))
    if (Math.hypot(...p) > 0.5) return norm(p)
  }
  return [1, 0, 0]
}

/** Parell de forats simètric respecte a `centre` (la seva línia és la direcció «al llarg»), o `null`. */
function pairAxis(pts: readonly V3[], centre: V3, n: V3): V3 | null {
  let best: { d: V3; len: number } | null = null
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const a = sub(pts[i]!, centre)
      const b = sub(pts[j]!, centre)
      const mid = mul(add(a, b), 0.5)
      const d = sub(b, a)
      const inPlane = sub(d, mul(n, dot(d, n)))
      const len = Math.hypot(...inPlane)
      if (len < 10 || Math.abs(dot(sub(mid, mul(n, dot(mid, n))), norm(inPlane))) > 0.5) continue
      if (!best || len > best.len) best = { d: norm(inPlane), len }
    }
  return best?.d ?? null
}

/** Un per centre: els concèntrics (avellanat i forat) es queden el més estret. */
function dedupe(circles: MeshCircle[]): MeshCircle[] {
  const out: MeshCircle[] = []
  for (const c of circles) {
    const same = out.findIndex((o) => Math.hypot(o.centre[0] - c.centre[0], o.centre[1] - c.centre[1]) < 0.6)
    if (same < 0) out.push(c)
    else if (c.r < out[same]!.r) out[same] = { ...c, t0: Math.min(c.t0, out[same]!.t0), t1: Math.max(c.t1, out[same]!.t1) }
  }
  return out
}

/**
 * Frontissa de cassoleta a partir de la malla: la cassoleta (el cercle sencer més gros de Ø25–41 d'algun eix) i els
 * cargols o espigues de l'ala. `null` si no s'hi troba cap cassoleta.
 */
export function hingeFrameFromMesh(meshes: readonly MeshLike[], scale = 1): HardwareProposal | null {
  const points = meshPoints(meshes, scale)
  if (points.length < 24) return null
  // La cassoleta és un cilindre de debò: almenys dos anells (fondària ≥ 5 mm) i força vèrtexs (un anell solt de 8 punts
  // en un arrodoniment no ho és).
  let best: MeshCircle | null = null
  for (const axis of AXES) {
    const c = circlesAlong(points, axis, 12.4, 20.6).find((x) => x.t1 - x.t0 >= 5 && x.inliers >= 24)
    if (c && (!best || c.inliers > best.inliers)) best = c
  }
  if (!best) return hingeFromFixings(points)
  const cup = best
  const ax = cup.axis
  const centroid = mean(points)
  const mid = (cup.t0 + cup.t1) / 2
  // La cara de la porta és l'extrem de la cassoleta del costat del cos de la frontissa.
  const towardBody = centroid[ax] >= mid ? 1 : -1
  const n = unit(ax, towardBody)
  const faceT = towardBody > 0 ? cup.t1 : cup.t0
  const depth = Math.min(20, upHalf(cup.t1 - cup.t0))
  const face = at3(cup, faceT)
  // Cargols i espigues: cercles petits del mateix eix, a prop, a l'alçada de la cara (ala) o a dins (espigues).
  const small = dedupe(circlesAlong(points, ax, 1.4, 3.6).filter((c) => {
    const d = Math.hypot(c.centre[0] - cup.centre[0], c.centre[1] - cup.centre[1])
    if (d < cup.r + 1 || d > 45) return false
    // `h`: alçada respecte a la cara, positiva cap al cos.
    const h0 = Math.min((c.t0 - faceT) * towardBody, (c.t1 - faceT) * towardBody)
    const h1 = Math.max((c.t0 - faceT) * towardBody, (c.t1 - faceT) * towardBody)
    return h0 <= 8 && h1 >= -20
  }))
  const flat = (c: MeshCircle): V3 => sub(at3(c, faceT), face)
  const along = pairAxis(small.map(flat), [0, 0, 0], n) ?? fallbackAlong(n)
  let v = norm(cross(n, along))
  const notes: string[] = []
  if (small.length) {
    const offset = small.reduce((s, c) => s + dot(flat(c), v), 0) / small.length
    if (offset < -0.5) v = mul(v, -1)
    else if (Math.abs(offset) <= 0.5) notes.push("Els forats de l'ala estan alineats amb el centre de la cassoleta: comprova de quin costat és el cantell.")
  } else {
    // Sense cargols: cap a on hi ha més cos (l'ala i el braç s'allarguen cap a dins de la porta).
    const off = dot(sub(centroid, face), v)
    if (off < 0) v = mul(v, -1)
    notes.push("Sense forats de cargol a l'ala al model: només la cassoleta; «cap a dins» s'ha estimat pel cos de la frontissa.")
  }
  const u = cross(v, n)
  const frame: LocalFrame = { origin: face, u, v, n }
  const holes: ProposedHole[] = [{ role: "cup", u: 0, v: 0, d: snapDrill(cup.r * 2), measured: r2(cup.r * 2), depth, depthFrom: "file" }]
  for (const c of small.sort((a, b) => dot(flat(a), u) - dot(flat(b), u))) {
    const inside = -Math.min((c.t0 - faceT) * towardBody, (c.t1 - faceT) * towardBody)
    const dowel = inside > 0.5
    holes.push({ role: dowel ? "dowel" : "screw", u: r2(dot(flat(c), u)), v: r2(dot(flat(c), v)), d: snapDrill(c.r * 2), measured: r2(c.r * 2), depth: dowel ? upHalf(inside) : DEFAULT_DEPTHS.screw, depthFrom: dowel ? "file" : "default" })
  }
  notes.unshift(`Marc estimat del model 3D: cassoleta Ø${fmt(holes[0]!.measured)} → broca Ø${fmt(holes[0]!.d)}, fondària ${fmt(depth)} mm${small.length ? `; ${small.length} forat${small.length === 1 ? "" : "s"} a l'ala` : ""}. Comprova'l al 3D.`)
  return { kind: "hinge", frame, holes, bbox: boxIn(points, frame), notes }
}

/**
 * Frontissa sense cap cassoleta rodona al model (els CLIP top de Blum: la cassoleta és cònica): el parell de fixacions
 * de l'ala (cargols o espigues, Ø3–11) dona la cara de la porta i la línia del cantell; la cassoleta es posa al mig del
 * parell amb els números per defecte (Ø35 × 13), per revisar. `null` si tampoc no hi ha cap parell.
 */
function hingeFromFixings(points: readonly V3[]): HardwareProposal | null {
  const centroid = mean(points)
  // Parells de fixacions iguals (mateix radi i mateix tram) a 28–50 mm (els patrons de 32 i de 45): el de més Ø.
  let best: { axis: 0 | 1 | 2; a: MeshCircle; b: MeshCircle } | null = null
  for (const axis of AXES) {
    // Sense ajuntar els concèntrics: el tetó Ø10 i el seu forat interior són cercles diferents (mana el més gros).
    const cs = circlesAlong(points, axis, 1.4, 5.6)
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i]!
        const b = cs[j]!
        if (Math.abs(a.r - b.r) > 0.2 || Math.abs(a.t0 - b.t0) > 0.3 || Math.abs(a.t1 - b.t1) > 0.3) continue
        const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1])
        if (d < 28 || d > 50) continue
        if (!best || a.r > best.a.r + 0.2 || (Math.abs(a.r - best.a.r) <= 0.2 && a.inliers + b.inliers > best.a.inliers + best.b.inliers)) best = { axis, a, b }
      }
  }
  if (!best) return null
  const { axis, a, b } = best
  // La cara de la porta: l'extrem del tram de les fixacions del costat del cos (les espigues surten de la cara cap a la
  // porta; els forats dels cargols neixen a la cara i travessen l'ala). El pla amb més vèrtexs decideix.
  const ends = [a.t0, a.t1]
  const t = ringSize(points, axis, ends[0]!) >= ringSize(points, axis, ends[1]!) ? ends[0]! : ends[1]!
  const sign: 1 | -1 = centroid[axis] >= t ? 1 : -1
  const n = unit(axis, sign)
  const pa = at3(a, t)
  const pb = at3(b, t)
  const origin = mul(add(pa, pb), 0.5)
  let u = norm(sub(pb, pa))
  let v = norm(cross(n, u))
  // «Cap a dins»: cap on hi ha més cos (l'ala i el braç).
  if (dot(sub(centroid, origin), v) < 0) v = mul(v, -1)
  u = cross(v, n)
  const frame: LocalFrame = { origin, u, v, n }
  const holes: ProposedHole[] = [{ role: "cup", u: 0, v: 0, d: 35, measured: 0, depth: DEFAULT_DEPTHS.cup, depthFrom: "default" }]
  for (const c of [a, b]) {
    const p = sub(at3(c, t), origin)
    const inside = Math.max(0, -Math.min((c.t0 - t) * sign, (c.t1 - t) * sign))
    const dowel = inside > 0.5
    holes.push({ role: dowel ? "dowel" : "screw", u: r2(dot(p, u)), v: r2(dot(p, v)), d: snapDrill(c.r * 2), measured: r2(c.r * 2), depth: dowel ? upHalf(inside) : DEFAULT_DEPTHS.screw, depthFrom: dowel ? "file" : "default" })
  }
  holes.sort((x, y) => (x.role === "cup" ? -1 : y.role === "cup" ? 1 : x.u - y.u))
  const notes = [
    `Marc estimat del model 3D: sense cassoleta rodona al model; la cara de la porta i el cantell surten del parell de fixacions de l'ala (Ø${fmt(r2(a.r * 2))} a ${fmt(r2(Math.hypot(...sub(pb, pa))))} mm). La cassoleta es proposa al mig del parell amb Ø35 × ${DEFAULT_DEPTHS.cup}: revisa el Ø, la fondària i la distància al cantell.`,
  ]
  return { kind: "hinge", frame, holes, bbox: boxIn(points, frame), notes }
}

/**
 * La cara de muntatge i els seus forats a partir de la malla: cercles petits (`rMin`–`rMax`) de cada eix; el pla d'on
 * neixen més forats (l'extrem del tram del cercle) és la cara. Torna l'eix, la cota del pla, la normal cap al cos
 * (`sign`) i els forats que hi neixen. `null` si no n'hi ha cap.
 */
function faceWithHoles(points: readonly V3[], rMin: number, rMax: number): { axis: 0 | 1 | 2; t: number; sign: 1 | -1; holes: MeshCircle[] } | null {
  const centroid = mean(points)
  let best: { axis: 0 | 1 | 2; t: number; sign: 1 | -1; holes: MeshCircle[]; score: number } | null = null
  for (const axis of AXES) {
    const circles = dedupe(circlesAlong(points, axis, rMin, rMax))
    if (!circles.length) continue
    // Candidats a cara: els extrems dels trams dels cercles (agrupats a 0,3 mm).
    const ends: number[] = []
    for (const c of circles) for (const t of [c.t0, c.t1]) if (!ends.some((e) => Math.abs(e - t) < 0.3)) ends.push(t)
    for (const t of ends) {
      const holes = circles.filter((c) => Math.abs(c.t0 - t) < 0.3 || Math.abs(c.t1 - t) < 0.3)
      // Més forats que hi neixen i, a igualtat, el pla amb més vèrtexs (la cara, no la punta dels tetons).
      const score = holes.length * 100_000 + ringSize(points, axis, t) * 10 + holes.reduce((s, c) => s + c.inliers, 0) / 1000
      if (!best || score > best.score) best = { axis, t, sign: centroid[axis] >= t ? 1 : -1, holes, score }
    }
  }
  if (!best) return null
  const { score: _s, ...rest } = best
  return rest
}

/**
 * Placa de muntatge a partir de la malla: els forats de la cara que toca el lateral (Ø2,4–12), per parells simètrics; el
 * marc com el de `proposePlate` (`n` fora del lateral cap a la placa, `v` cap al darrere, `u` = `v × n`). Sense cap parell,
 * la cara i cap forat.
 */
export function plateFrameFromMesh(meshes: readonly MeshLike[], scale = 1): HardwareProposal | null {
  const points = meshPoints(meshes, scale)
  if (points.length < 24) return null
  const face = faceWithHoles(points, 1.2, 6.3)
  if (!face) return null
  const n = unit(face.axis, face.sign)
  const centres = face.holes.map((c) => at3(c, face.t))
  // Parells simètrics (u ↔ −u respecte al mig del parell més llarg).
  const centre = mean(centres)
  const along = pairAxis(centres, centre, n) ?? fallbackAlong(n)
  let v = norm(cross(n, along))
  const ext = points.map((p) => dot(sub(p, centre), v))
  if (ext.length && Math.max(...ext) < -Math.min(...ext)) v = mul(v, -1)
  const u = cross(v, n)
  const frame: LocalFrame = { origin: centre, u, v, n }
  const holes: ProposedHole[] = face.holes
    .map((c) => {
      const p = sub(at3(c, face.t), centre)
      const inside = Math.max(0, -Math.min((c.t0 - face.t) * face.sign, (c.t1 - face.t) * face.sign))
      const dowel = inside > 0.5
      return { role: dowel ? "dowel" : "screw", u: r2(dot(p, u)), v: r2(dot(p, v)), d: snapDrill(c.r * 2), measured: r2(c.r * 2), depth: dowel ? upHalf(inside) : DEFAULT_DEPTHS.plateScrew, depthFrom: dowel ? "file" : "default" } satisfies ProposedHole
    })
    .sort((a, b) => a.u - b.u)
  const lone = holes.filter((h) => !holes.some((o) => o !== h && Math.abs(o.u + h.u) < 1 && Math.abs(o.v - h.v) < 1 && o.d === h.d))
  const notes = [`Marc estimat del model 3D: cara de muntatge amb ${holes.length} forat${holes.length === 1 ? "" : "s"}. Comprova'l al 3D.`]
  if (lone.length) {
    notes.push("Forats sense parell simètric: no se'n proposa cap (entra'ls a mà).")
    return { kind: "plate", frame, holes: [], bbox: boxIn(points, frame), notes }
  }
  return { kind: "plate", frame, holes, bbox: boxIn(points, frame), notes }
}

/** Tirador a partir de la malla: els forats roscats de la cara de muntatge; marc com el de `proposeHandle`. */
function handleFrameFromMesh(meshes: readonly MeshLike[], scale = 1, throughDiameter = 5): HardwareProposal | null {
  const points = meshPoints(meshes, scale)
  if (points.length < 24) return null
  const face = faceWithHoles(points, 1.4, 4.5)
  if (!face || face.holes.length > 4) return null
  const n = unit(face.axis, face.sign)
  let hs = face.holes
  if (hs.length > 2) {
    // El parell més llarg centrat al model.
    const mid = mean(points)
    let best: [MeshCircle, MeshCircle] | null = null
    let bestLen = 0
    for (let i = 0; i < hs.length; i++)
      for (let j = i + 1; j < hs.length; j++) {
        const a = at3(hs[i]!, face.t)
        const b = at3(hs[j]!, face.t)
        const m = mul(add(a, b), 0.5)
        const d = sub(b, a)
        const len = Math.hypot(...d)
        if (len < 10) continue
        const off = Math.abs(dot(sub(mid, m), norm(d)))
        if (off <= 1.5 && len > bestLen) {
          best = [hs[i]!, hs[j]!]
          bestLen = len
        }
      }
    if (!best) return null
    hs = best
  }
  const centres = hs.map((c) => at3(c, face.t))
  const centre = mean(centres)
  let u: V3
  if (centres.length === 2) {
    u = norm(sub(centres[1]!, centres[0]!))
    const ref = [u[0], u[2], u[1]].find((x) => Math.abs(x) > 1e-6) ?? 1
    if (ref < 0) u = mul(u, -1)
  } else u = fallbackAlong(n)
  const v = norm(cross(n, u))
  const frame: LocalFrame = { origin: centre, u, v, n }
  const screw = Math.min(...hs.map((c) => c.r * 2))
  const through = screw + 0.5 <= throughDiameter ? throughDiameter : Math.ceil(screw + 1)
  const dist = centres.length === 2 ? Math.hypot(...sub(centres[1]!, centres[0]!)) : 0
  const snapped = (() => {
    const k = Math.round(dist / 32) * 32
    return k > 0 && Math.abs(k - dist) <= 0.5 ? k : Math.round(dist * 10) / 10
  })()
  const holes: ProposedHole[] = (centres.length === 2 ? [-snapped / 2, snapped / 2] : [0]).map((x) => ({ role: "hole", u: r2(x), v: 0, d: through, measured: r2(screw), depth: 0, depthFrom: "default" }))
  const notes = [`Marc estimat del model 3D: ${centres.length === 2 ? `tirador de dos forats a ${fmt(snapped)} mm` : "pom d'un forat"} (cargols Ø${fmt(r2(screw))} → forats passants Ø${fmt(through)}). Comprova'l al 3D.`]
  return { kind: "handle", frame, holes, bbox: boxIn(points, frame), notes }
}

/** Pota a partir de la malla: els forats de la placa; marc com el de `proposeLeg` (`u` = X del fitxer al pla). */
function legFrameFromMesh(meshes: readonly MeshLike[], scale = 1): HardwareProposal | null {
  const points = meshPoints(meshes, scale)
  if (points.length < 24) return null
  const face = faceWithHoles(points, 1, 5)
  if (!face || face.holes.length > 12) return null
  const n = unit(face.axis, face.sign)
  const centres = face.holes.map((c) => at3(c, face.t))
  const centre = mean(centres)
  const xIn = sub([1, 0, 0], mul(n, n[0]))
  const along = Math.hypot(...xIn) > 0.5 ? norm(xIn) : fallbackAlong(n)
  const v = norm(cross(n, along))
  const frame: LocalFrame = { origin: centre, u: along, v, n }
  const holes: ProposedHole[] = face.holes
    .map((c) => {
      const p = sub(at3(c, face.t), centre)
      return { role: "screw" as const, u: r2(dot(p, along)), v: r2(dot(p, v)), d: legPilot(c.r * 2), measured: r2(c.r * 2), depth: DEFAULT_DEPTHS.plateScrew, depthFrom: "default" as const }
    })
    .sort((a, b) => a.u - b.u || a.v - b.v)
  const notes = [`Marc estimat del model 3D: placa amb ${holes.length} forat${holes.length === 1 ? "" : "s"} de cargol → pilots a la cara de sota de la base. Comprova'l al 3D.`]
  return { kind: "leg", frame, holes, bbox: boxIn(points, frame), notes }
}

/** La proposta d'un tipus a partir de la malla (`null` si no se'n treu el patró). */
export function frameFromMesh(kind: HardwareProposal["kind"], meshes: readonly MeshLike[], scale = 1, opts: { throughDiameter?: number } = {}): HardwareProposal | null {
  switch (kind) {
    case "hinge":
      return hingeFrameFromMesh(meshes, scale)
    case "plate":
      return plateFrameFromMesh(meshes, scale)
    case "handle":
      return handleFrameFromMesh(meshes, scale, opts.throughDiameter)
    case "leg":
      return legFrameFromMesh(meshes, scale)
    default:
      return null
  }
}

/**
 * Compon dos marcs: `outer` passa de les coordenades del fitxer a les del model desat (el marc amb què es va fer el GLB)
 * i `inner`, de les del model desat a les noves. Torna el marc del fitxer a les noves (per guardar-lo a l'item).
 */
export function composeFrames(outer: LocalFrame, inner: LocalFrame): LocalFrame {
  const toFile = (l: V3): V3 => add(add(mul(outer.u, l[0]), mul(outer.v, l[1])), mul(outer.n, l[2]))
  return { origin: add(outer.origin, toFile(inner.origin)), u: toFile(inner.u), v: toFile(inner.v), n: toFile(inner.n) }
}
