/**
 * Lector de DXF (ASCII) per a les vistes 2D dels ferratges (Hettich: `<article>_2D_front_view.dxf`, `_side_view`,
 * `_top_view`): línies, arcs, cercles, polilínies (`LWPOLYLINE` i `POLYLINE` 2D/3D amb bulge), el·lipses i splines
 * aproximades, punts (els `CONNECTIONPOINTS`) i blocs inserits (`INSERT`, amb escala, gir i niats). Tot passa a
 * polilínies en el pla XY (mm, segons `$INSUNITS`). Les cotes, textos, ombrejats i sòlids 3D (ACIS) s'ignoren. Pur.
 */

export type P2 = [number, number]

export interface DxfPolyline {
  layer: string
  pts: P2[]
  closed: boolean
}

export interface DxfPoint {
  layer: string
  x: number
  y: number
  z: number
}

export interface DxfCircle {
  layer: string
  x: number
  y: number
  r: number
}

export interface DxfDrawing {
  /** mm per unitat del dibuix. */
  unit: number
  polylines: DxfPolyline[]
  /** Cercles sencers (també com a polilínia): poden ser forats. */
  circles: DxfCircle[]
  points: DxfPoint[]
  /** Tipus d'entitat que no es dibuixen (per dir-ho a l'usuari). */
  skipped: Record<string, number>
}

type Pair = [number, string]

/** mm per unitat de `$INSUNITS` (0 = sense unitat: mm, el que fan servir els fabricants). */
const INSUNITS: Record<number, number> = { 0: 1, 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 8: 0.0000254, 9: 0.0254, 10: 914.4, 13: 0.001, 14: 100 }

function pairs(text: string): Pair[] {
  const lines = text.split(/\r\n|\n|\r/)
  const out: Pair[] = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i]!.trim(), 10)
    if (!Number.isFinite(code)) {
      // Desfasat (línia buida de més): es busca el següent codi.
      i -= 1
      continue
    }
    out.push([code, lines[i + 1]!.replace(/\s+$/, "")])
  }
  return out
}

interface RawEntity {
  type: string
  codes: Pair[]
  /** Vèrtexs d'una `POLYLINE` (els `VERTEX` fins a `SEQEND`). */
  vertices?: RawEntity[]
}

const num = (e: RawEntity, code: number, def = 0): number => {
  const hit = e.codes.find((c) => c[0] === code)
  const v = hit ? Number(hit[1]) : NaN
  return Number.isFinite(v) ? v : def
}
const str = (e: RawEntity, code: number, def = ""): string => e.codes.find((c) => c[0] === code)?.[1].trim() ?? def
const all = (e: RawEntity, code: number): number[] => e.codes.filter((c) => c[0] === code).map((c) => Number(c[1]))

/** Entitats d'una llista de parells (des de `0 TIPUS` fins al següent `0`), amb les `POLYLINE` i els seus `VERTEX`. */
function entities(list: Pair[]): RawEntity[] {
  const out: RawEntity[] = []
  let cur: RawEntity | null = null
  let poly: RawEntity | null = null
  for (const p of list) {
    if (p[0] === 0) {
      const type = p[1].trim().toUpperCase()
      if (poly && type === "VERTEX") {
        cur = { type, codes: [] }
        poly.vertices!.push(cur)
        continue
      }
      if (poly && type === "SEQEND") {
        poly = null
        cur = null
        continue
      }
      cur = { type, codes: [] }
      out.push(cur)
      if (type === "POLYLINE") {
        cur.vertices = []
        poly = cur
      } else poly = null
      continue
    }
    cur?.codes.push(p)
  }
  return out
}

/** Eix arbitrari del DXF: coordenades d'objecte (OCS, entitats 2D amb extrusió) → món. */
function ocs(n: [number, number, number]): ((x: number, y: number) => P2) | null {
  const [nx, ny, nz] = n
  if (Math.abs(nx) < 1e-9 && Math.abs(ny) < 1e-9 && nz > 0) return null
  const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
  const unit = (a: number[]) => {
    const l = Math.hypot(a[0]!, a[1]!, a[2]!)
    return a.map((v) => v / l)
  }
  const N = unit([nx, ny, nz])
  const Ax = Math.abs(N[0]!) < 1 / 64 && Math.abs(N[1]!) < 1 / 64 ? unit(cross([0, 1, 0], N)) : unit(cross([0, 0, 1], N))
  const Ay = unit(cross(N, Ax))
  // Projecció al pla XY del món.
  return (x, y) => [x * Ax[0]! + y * Ay[0]!, x * Ax[1]! + y * Ay[1]!]
}

const extrusion = (e: RawEntity): [number, number, number] => [num(e, 210, 0), num(e, 220, 0), num(e, 230, 1)]

/**
 * Límits del lector (un DXF malmès o fet per fer mal no ha de penjar la pàgina): entitats dibuixades (comptant les de
 * cada INSERT i les seves files × columnes), punts en total i còpies d'un sol INSERT. Les vistes de Hettich en fan uns
 * quants milers.
 */
export const DXF_LIMITS = { entities: 200_000, points: 2_000_000, insertCopies: 10_000 } as const

/** Error del lector per un fitxer massa gran o absurd (en català). */
class DxfLimitError extends Error {}

/** Angle en graus a [0, 360); `null` si no és un número. */
const deg360 = (a: number): number | null => (Number.isFinite(a) ? ((a % 360) + 360) % 360 : null)

/** Arc (graus, antihorari) a punts amb un error de corda de ~0,02 mm (mínim 4 trams, com a molt 180). */
function arcPts(cx: number, cy: number, r: number, a0In: number, a1In: number): P2[] {
  // Angles normalitzats (amb un angle enorme, `while (sweep <= 0) sweep += 360` no acabava mai).
  const a0 = deg360(a0In)
  const a1 = deg360(a1In)
  if (a0 === null || a1 === null || !Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r)) return []
  let sweep = a1 - a0
  if (sweep <= 1e-9) sweep += 360
  const tol = 0.02
  const step = r > tol ? Math.max(2, Math.min(15, (2 * Math.acos(Math.max(-1, 1 - tol / r)) * 180) / Math.PI)) : 15
  const n = Math.max(4, Math.ceil(sweep / step))
  const out: P2[] = []
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (sweep * i) / n) * Math.PI) / 180
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return out
}

/** Tram amb bulge (tangent de ¼ de l'angle; positiu = antihorari) entre dos punts, sense el primer punt. */
function bulgePts(a: P2, b: P2, bulge: number): P2[] {
  if (Math.abs(bulge) < 1e-9) return [b]
  const theta = 4 * Math.atan(bulge)
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (chord < 1e-9) return [b]
  const r = chord / (2 * Math.sin(Math.abs(theta) / 2))
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const h = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2))
  // Centre a l'esquerra de a→b si l'arc és antihorari i curt (o horari i llarg).
  const dir = (theta > 0) === Math.abs(theta) < Math.PI ? 1 : -1
  const ux = -(b[1] - a[1]) / chord
  const uy = (b[0] - a[0]) / chord
  const cx = mx + dir * h * ux
  const cy = my + dir * h * uy
  const s = (Math.atan2(a[1] - cy, a[0] - cx) * 180) / Math.PI
  const e = (Math.atan2(b[1] - cy, b[0] - cx) * 180) / Math.PI
  const pts = theta > 0 ? arcPts(cx, cy, r, s, e) : arcPts(cx, cy, r, e, s).reverse()
  pts.shift()
  pts[pts.length - 1] = b
  return pts
}

/** Spline (de Boor) mostrejada; sense nusos vàlids, els punts de pas o de control. */
function splinePts(e: RawEntity): P2[] {
  const degree = num(e, 71, 3)
  const knots = all(e, 40)
  const weights = all(e, 41)
  const cx = all(e, 10)
  const cy = all(e, 20)
  const ctrl: P2[] = cx.map((x, i) => [x, cy[i] ?? 0])
  const fx = all(e, 11)
  const fy = all(e, 21)
  const fit: P2[] = fx.map((x, i) => [x, fy[i] ?? 0])
  const n = ctrl.length
  // Grau absurd (un fitxer malmès): els punts de pas o de control, sense l'algorisme (seria d'un cost sense límit).
  if (n < 2 || !Number.isInteger(degree) || degree < 1 || degree > 11 || knots.length !== n + degree + 1) return fit.length >= 2 ? fit : ctrl
  const w = weights.length === n ? weights : ctrl.map(() => 1)
  const lo = knots[degree]!
  const hi = knots[n]!
  const samples = Math.min(400, Math.max(16, n * 8))
  const out: P2[] = []
  for (let s = 0; s <= samples; s++) {
    const t = s === samples ? hi : lo + ((hi - lo) * s) / samples
    let k = degree
    while (k < n - 1 && t >= knots[k + 1]!) k++
    const d = Array.from({ length: degree + 1 }, (_, j) => {
      const p = ctrl[k - degree + j]!
      const ww = w[k - degree + j]!
      return [p[0] * ww, p[1] * ww, ww]
    })
    for (let r = 1; r <= degree; r++)
      for (let j = degree; j >= r; j--) {
        const i = k - degree + j
        const den = knots[i + degree - r + 1]! - knots[i]!
        const a = den > 1e-12 ? (t - knots[i]!) / den : 0
        d[j] = d[j]!.map((v, q) => (1 - a) * d[j - 1]![q]! + a * v)
      }
    const [X, Y, W] = d[degree]!
    out.push([X! / W!, Y! / W!])
  }
  return out
}

interface Xf2 {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}
const ID2: Xf2 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
const ap = (t: Xf2, p: P2): P2 => [t.a * p[0] + t.c * p[1] + t.e, t.b * p[0] + t.d * p[1] + t.f]
const comp = (t: Xf2, u: Xf2): Xf2 => ({ a: t.a * u.a + t.c * u.b, b: t.b * u.a + t.d * u.b, c: t.a * u.c + t.c * u.d, d: t.b * u.c + t.d * u.d, e: t.a * u.e + t.c * u.f + t.e, f: t.b * u.e + t.d * u.f + t.f })
const scaleOf = (t: Xf2) => Math.sqrt(Math.abs(t.a * t.d - t.b * t.c))

/** Llegeix un DXF ASCII (les vistes 2D). Llança si no és un DXF de text. */
export function readDxf(text: string): DxfDrawing {
  if (!/^\s*0\s*[\r\n]+\s*SECTION/m.test(text.slice(0, 2000))) {
    if (text.startsWith("AutoCAD Binary DXF")) throw new Error("DXF binari: no es pot llegir (desa'l com a DXF de text).")
    throw new Error("No és un fitxer DXF.")
  }
  const all0 = pairs(text)
  // Seccions.
  const sections = new Map<string, Pair[]>()
  for (let i = 0; i < all0.length; i++) {
    if (all0[i]![0] === 0 && all0[i]![1].trim() === "SECTION" && all0[i + 1]?.[0] === 2) {
      const name = all0[i + 1]![1].trim()
      let j = i + 2
      while (j < all0.length && !(all0[j]![0] === 0 && all0[j]![1].trim() === "ENDSEC")) j++
      sections.set(name, all0.slice(i + 2, j))
      i = j
    }
  }
  const header = sections.get("HEADER") ?? []
  const iu = header.findIndex((p) => p[0] === 9 && p[1].trim() === "$INSUNITS")
  const unit = iu >= 0 ? (INSUNITS[Number(header[iu + 1]?.[1])] ?? 1) : 1
  // Blocs.
  const blocks = new Map<string, { base: P2; ents: RawEntity[] }>()
  const blockEnts = entities(sections.get("BLOCKS") ?? [])
  for (let i = 0; i < blockEnts.length; i++) {
    const b = blockEnts[i]!
    if (b.type !== "BLOCK") continue
    const name = str(b, 2)
    const ents: RawEntity[] = []
    let j = i + 1
    while (j < blockEnts.length && blockEnts[j]!.type !== "ENDBLK") ents.push(blockEnts[j++]!)
    blocks.set(name, { base: [num(b, 10), num(b, 20)], ents })
    i = j
  }
  const out: DxfDrawing = { unit, polylines: [], circles: [], points: [], skipped: {} }
  const skip = (t: string) => (out.skipped[t] = (out.skipped[t] ?? 0) + 1)
  let entityCount = 0
  let pointCount = 0
  const tooBig = (what: string) => {
    throw new DxfLimitError(`El DXF és massa gran o està malmès (${what}): no es llegeix.`)
  }
  const emit = (xf: Xf2, layer: string, pts: P2[], closed: boolean) => {
    if (pts.length < 2) return
    pointCount += pts.length
    if (pointCount > DXF_LIMITS.points) tooBig(`més de ${DXF_LIMITS.points.toLocaleString("ca")} punts`)
    out.polylines.push({ layer, pts: pts.map((p) => ap(xf, p)).map(([x, y]) => [x * unit, y * unit]), closed })
  }
  const draw = (ents: RawEntity[], xf: Xf2, depth: number, inherited?: string) => {
    for (const e of ents) {
      if (++entityCount > DXF_LIMITS.entities) tooBig(`més de ${DXF_LIMITS.entities.toLocaleString("ca")} entitats`)
      const raw = str(e, 8, "0")
      // Capa «0» dins d'un bloc: la de l'INSERT.
      const layer = raw === "0" && inherited ? inherited : raw
      const o = ocs(extrusion(e))
      const w = (x: number, y: number): P2 => (o ? o(x, y) : [x, y])
      switch (e.type) {
        case "LINE":
          emit(xf, layer, [[num(e, 10), num(e, 20)], [num(e, 11), num(e, 21)]], false)
          break
        case "CIRCLE": {
          const r = num(e, 40)
          const [cx, cy] = w(num(e, 10), num(e, 20))
          if (!(r > 0)) break
          emit(xf, layer, arcPts(cx, cy, r, 0, 360), true)
          const [px, py] = ap(xf, [cx, cy])
          out.circles.push({ layer, x: px * unit, y: py * unit, r: r * scaleOf(xf) * unit })
          break
        }
        case "ARC": {
          const r = num(e, 40)
          if (!(r > 0)) break
          const pts = arcPts(num(e, 10), num(e, 20), r, num(e, 50), num(e, 51)).map(([x, y]) => w(x, y))
          emit(xf, layer, pts, false)
          break
        }
        case "LWPOLYLINE": {
          const xs: number[] = []
          const ys: number[] = []
          const bulges: number[] = []
          for (const [c, v] of e.codes) {
            if (c === 10) {
              xs.push(Number(v))
              bulges.push(0)
            } else if (c === 20) ys.push(Number(v))
            else if (c === 42 && bulges.length) bulges[bulges.length - 1] = Number(v)
          }
          const closed = (num(e, 70) & 1) === 1
          const vs: P2[] = xs.map((x, i) => [x, ys[i] ?? 0])
          emit(xf, layer, bulgePath(vs, bulges, closed).map(([x, y]) => w(x, y)), closed)
          break
        }
        case "POLYLINE": {
          const flags = num(e, 70)
          // Malles (16) i cares (64): no són dibuix.
          if (flags & (16 | 64)) {
            skip("POLYLINE (malla)")
            break
          }
          const vv = (e.vertices ?? []).filter((v) => !(num(v, 70) & 16))
          const vs: P2[] = vv.map((v) => [num(v, 10), num(v, 20)])
          const bulges = vv.map((v) => num(v, 42))
          const closed = (flags & 1) === 1
          const pts = flags & 8 ? (closed && vs.length ? [...vs, vs[0]!] : vs) : bulgePath(vs, bulges, closed).map(([x, y]) => w(x, y))
          emit(xf, layer, pts, closed)
          break
        }
        case "ELLIPSE": {
          const cx = num(e, 10)
          const cy = num(e, 20)
          const mx = num(e, 11)
          const my = num(e, 21)
          const ratio = num(e, 40, 1)
          const TAU = Math.PI * 2
          const r0 = num(e, 41, 0)
          const r1 = num(e, 42, TAU)
          if (!Number.isFinite(r0) || !Number.isFinite(r1)) break
          // Paràmetres normalitzats a una volta com a molt (amb uns de molt grans, `n` no tenia límit).
          const t0 = ((r0 % TAU) + TAU) % TAU
          let t1 = t0 + ((((r1 - r0) % TAU) + TAU) % TAU)
          if (t1 - t0 < 1e-9) t1 = t0 + TAU
          const a = Math.hypot(mx, my)
          if (!(a > 0) || !Number.isFinite(a)) break
          const ux = mx / a
          const uy = my / a
          const n = Math.max(8, Math.ceil(((t1 - t0) / (Math.PI * 2)) * 72))
          const pts: P2[] = []
          for (let i = 0; i <= n; i++) {
            const t = t0 + ((t1 - t0) * i) / n
            const x = a * Math.cos(t)
            const y = a * ratio * Math.sin(t)
            pts.push(w(cx + x * ux - y * uy, cy + x * uy + y * ux))
          }
          emit(xf, layer, pts, Math.abs(t1 - t0 - Math.PI * 2) < 1e-6)
          break
        }
        case "SPLINE":
          emit(xf, layer, splinePts(e), (num(e, 70) & 1) === 1)
          break
        case "POINT": {
          const [x, y] = ap(xf, [num(e, 10), num(e, 20)])
          out.points.push({ layer, x: x * unit, y: y * unit, z: num(e, 30) * unit })
          break
        }
        case "INSERT": {
          const b = blocks.get(str(e, 2))
          if (!b || depth > 8) break
          const sx = num(e, 41, 1)
          const sy = num(e, 42, 1)
          const rot = (num(e, 50, 0) * Math.PI) / 180
          const [ix, iy] = w(num(e, 10), num(e, 20))
          const cos = Math.cos(rot)
          const sin = Math.sin(rot)
          // Inserció · gir · escala · (−base).
          const local: Xf2 = { a: cos * sx, b: sin * sx, c: -sin * sy, d: cos * sy, e: 0, f: 0 }
          const base = ap(local, b.base)
          const t: Xf2 = { ...local, e: ix - base[0], f: iy - base[1] }
          const cols = Math.max(1, Math.floor(num(e, 70, 1)) || 1)
          const rows = Math.max(1, Math.floor(num(e, 71, 1)) || 1)
          if (cols * rows > DXF_LIMITS.insertCopies) tooBig(`un INSERT de ${cols} × ${rows} còpies`)
          for (let ci = 0; ci < cols; ci++)
            for (let ri = 0; ri < rows; ri++) {
              const off: Xf2 = { ...ID2, e: ci * num(e, 44) * cos - ri * num(e, 45) * sin, f: ci * num(e, 44) * sin + ri * num(e, 45) * cos }
              draw(b.ents, comp(xf, comp(off, t)), depth + 1, layer)
            }
          break
        }
        default:
          skip(e.type)
      }
    }
  }
  draw(entities(sections.get("ENTITIES") ?? []), ID2, 0)
  return out
}

/** Polilínia amb bulges (el del vèrtex i és el del tram i → i+1). */
function bulgePath(vs: P2[], bulges: number[], closed: boolean): P2[] {
  if (!vs.length) return []
  const out: P2[] = [vs[0]!]
  const n = closed ? vs.length : vs.length - 1
  for (let i = 0; i < n; i++) out.push(...bulgePts(vs[i]!, vs[(i + 1) % vs.length]!, bulges[i] ?? 0))
  return out
}

// --- Simplificar (per desar-ho petit) ---------------------------------------------------------------------------------

/** Douglas–Peucker amb tolerància `tol` (mm). */
export function simplify(pts: P2[], tol: number): P2[] {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = pts[a]!
    const [bx, by] = pts[b]!
    const len = Math.hypot(bx - ax, by - ay)
    let best = -1
    let far = 0
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!
      const d = len < 1e-9 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len
      if (d > far) {
        far = d
        best = i
      }
    }
    if (best >= 0 && far > tol) {
      keep[best] = 1
      stack.push([a, best], [best, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}
