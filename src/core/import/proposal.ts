import { add, cross, dot, mul, norm, sub, type StepCylinder, type StepFeatures, type V3 } from "./stepGeometry"

/**
 * Mecanitzats proposats a partir dels cilindres d'un STEP de ferratge (`stepFeatures`): la cassoleta i els cargols d'una
 * frontissa (a la porta) o els forats d'una placa de muntatge (al lateral). Tot en un **marc local** del ferratge:
 * - frontissa: origen = centre de la cassoleta a la cara de la porta; `v` = cap a dins de la porta (lluny del cantell de
 *   la frontissa); `n` = fora de la cara (cap al cos de la frontissa); `u` = `v × n` (al llarg del cantell).
 * - placa: origen = el punt de referència de la placa a la cara del lateral (l'origen del fitxer, si hi és: els models
 *   de Hettich el posen a la filera); `n` = fora del lateral (cap a la placa); `v` = fondària; `u` = `v × n` (amunt o avall).
 * Diàmetres arrodonits a les broques habituals (`snapDrill`); fondària del tram que ocupa el cilindre dins de la peça o,
 * si no s'hi fica (forats de l'ala per a cargols), la de la categoria. Pur.
 */

export const STANDARD_DRILLS = [35, 26, 20, 15, 10, 8, 5, 4, 3, 2.5] as const

/** La broca habitual més propera (per sota de 2,5 mm o molt lluny de totes, el mateix valor a la desena). */
export function snapDrill(d: number): number {
  let best: number = STANDARD_DRILLS[0]
  for (const s of STANDARD_DRILLS) if (Math.abs(s - d) < Math.abs(best - d)) best = s
  if (Math.abs(best - d) <= Math.max(0.6, d * 0.12)) return best
  // Forats de pas d'un ferratge (més amples que el cargol): la broca de sota si és a menys d'un 20 %.
  const lower = STANDARD_DRILLS.filter((s) => s < d).sort((a, b) => b - a)[0]
  return lower !== undefined && d <= lower * 1.2 ? lower : Math.round(d * 10) / 10
}

/** Arrodonida amunt al mig mil·límetre (una cassoleta de 12,8 → 13). */
const upHalf = (x: number) => Math.ceil(x * 2 - 1e-6) / 2

export type HoleRole = "cup" | "screw" | "dowel" | "hole"

export interface ProposedHole {
  role: HoleRole
  /** Posició al marc local (mm). */
  u: number
  v: number
  /** Diàmetre proposat (broca) i el del fitxer. */
  d: number
  measured: number
  depth: number
  /** La fondària surt del fitxer (tram del cilindre dins de la peça) o és la de la categoria. */
  depthFrom: "file" | "default"
}

export interface LocalFrame {
  origin: V3
  u: V3
  v: V3
  n: V3
}

export interface HardwareProposal {
  kind: "hinge" | "plate" | "handle" | "leg" | "model"
  frame: LocalFrame
  holes: ProposedHole[]
  /** Caixa del ferratge al marc local (mm). */
  bbox: { min: V3; max: V3 }
  /** Què s'ha trobat i què cal revisar (en català). */
  notes: string[]
}

/** Fondàries per defecte quan el fitxer no les diu (cargols d'ala: no entren a la peça al model). */
export const DEFAULT_DEPTHS = { cup: 13, screw: 10, plateScrew: 12, dowel: 11 } as const

export const toLocal = (f: LocalFrame, p: V3): V3 => {
  const d = sub(p, f.origin)
  return [dot(d, f.u), dot(d, f.v), dot(d, f.n)]
}

const r2 = (x: number) => Math.round(x * 100) / 100 || 0
const parallel = (a: V3, b: V3, tol = 0.02) => Math.abs(Math.abs(dot(a, b)) - 1) < tol

/** Cilindres sencers (o grups de trossos d'un forat allargat) d'un radi entre `rMin` i `rMax`. */
function holeCandidates(cyls: StepCylinder[], rMin: number, rMax: number, strict = false): StepCylinder[] {
  const small = cyls.filter((c) => c.radius >= rMin && c.radius <= rMax)
  const full = small.filter((c) => c.coverage >= 300)
  // Forats allargats (traus) fets de trossos paral·lels i propers: el centre del grup, el radi més petit.
  const parts = small.filter((c) => c.coverage < 300 && !c.boss && c.coverage > 20)
  const used = new Set<StepCylinder>()
  const merged: StepCylinder[] = []
  for (const c of parts) {
    if (used.has(c)) continue
    const group = [c]
    used.add(c)
    for (let k = 0; k < group.length; k++) {
      const g = group[k]!
      for (const o of parts) {
        if (used.has(o) || !parallel(o.axis, g.axis, 1e-3)) continue
        const off = sub(o.origin, g.origin)
        const lateral = Math.hypot(...sub(off, mul(g.axis, dot(off, g.axis))))
        if (lateral <= g.radius + o.radius + 1) {
          group.push(o)
          used.add(o)
        }
      }
    }
    const cov = group.reduce((s, x) => s + x.coverage, 0)
    if (group.length < 2 || cov < 300) continue
    // Placa: un trau és d'un sol radi i els seus trossos van en línia; si no (un forat en forma de clau, un rectangle
    // arrodonit), no és un forat de broca.
    if (strict && !slotLike(group)) continue
    const axis = group[0]!.axis
    const base = group[0]!.origin
    const centre = mul(group.reduce((s, x) => add(s, x.origin), [0, 0, 0] as V3), 1 / group.length)
    const shift = dot(sub(centre, base), axis)
    merged.push({ origin: centre, axis, radius: Math.min(...group.map((x) => x.radius)), t0: Math.min(...group.map((x) => x.t0)) - shift, t1: Math.max(...group.map((x) => x.t1)) - shift, coverage: 360, boss: false })
  }
  return [...full, ...merged]
}

/** Trossos d'un trau: el mateix radi (±0,3) i els centres en línia (±0,3 mm). */
function slotLike(group: StepCylinder[]): boolean {
  const rs = group.map((x) => x.radius)
  if (Math.max(...rs) - Math.min(...rs) > 0.3) return false
  const axis = group[0]!.axis
  const flat = group.map((x) => sub(x.origin, mul(axis, dot(x.origin, axis))))
  let a = flat[0]!
  let b = flat[0]!
  for (const p of flat) for (const q of flat) if (Math.hypot(...sub(p, q)) > Math.hypot(...sub(a, b))) [a, b] = [p, q]
  const len = Math.hypot(...sub(a, b))
  if (len < 1e-6) return true
  const dir = mul(sub(b, a), 1 / len)
  return flat.every((p) => {
    const d = sub(p, a)
    return Math.hypot(...sub(d, mul(dir, dot(d, dir)))) <= 0.3
  })
}

/** Tram del cilindre a l'eix normal `n` des del pla de la cara (`h` = 0 a la cara, positiu cap a fora). */
function heights(c: StepCylinder, f: LocalFrame): [number, number] {
  const s = dot(c.axis, f.n)
  const base = dot(sub(c.origin, f.origin), f.n)
  const a = base + c.t0 * s
  const b = base + c.t1 * s
  return [Math.min(a, b), Math.max(a, b)]
}

function bboxOf(points: V3[], f: LocalFrame) {
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of points) {
    const l = toLocal(f, p)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, l[k]!)
      max[k] = Math.max(max[k]!, l[k]!)
    }
  }
  return { min: min.map(r2) as V3, max: max.map(r2) as V3 }
}

const mean = (pts: V3[]): V3 => (pts.length ? mul(pts.reduce((s, p) => add(s, p), [0, 0, 0] as V3), 1 / pts.length) : [0, 0, 0])

/** Direcció «al llarg» per defecte (sense parell de forats): l'eix Z del fitxer (els models de Hettich hi tenen el cantell), si no, X. */
function fallbackAlong(n: V3): V3 {
  for (const a of [[0, 0, 1], [1, 0, 0], [0, 1, 0]] as V3[]) {
    const p = sub(a, mul(n, dot(a, n)))
    if (Math.hypot(...p) > 0.5) return norm(p)
  }
  return [1, 0, 0]
}

/** Parell de forats simètric (els cargols de l'ala, els de la placa): la seva línia és la direcció «al llarg». */
function pairAxis(pts: { u: V3 }[], centre: V3, n: V3): V3 | null {
  let best: { d: V3; len: number } | null = null
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const a = sub(pts[i]!.u, centre)
      const b = sub(pts[j]!.u, centre)
      const mid = mul(add(a, b), 0.5)
      const d = sub(b, a)
      const inPlane = sub(d, mul(n, dot(d, n)))
      const len = Math.hypot(...inPlane)
      // Simètrics respecte a l'eix que passa pel centre, perpendicular a la seva línia.
      if (len < 10 || Math.abs(dot(sub(mid, mul(n, dot(mid, n))), norm(inPlane))) > 0.5) continue
      if (!best || len > best.len) best = { d: norm(inPlane), len }
    }
  return best?.d ?? null
}

/** Frontissa de cassoleta: la cassoleta (el cilindre sencer més gros de Ø20–40) i els forats de l'ala o les espigues. */
export function proposeHinge(f: StepFeatures): HardwareProposal | { error: string } {
  const notes: string[] = []
  const cups = f.cylinders.filter((c) => c.coverage >= 300 && c.radius >= 9.5 && c.radius <= 20.5).sort((a, b) => b.radius - a.radius)
  const cup = cups.find((c) => c.boss) ?? cups[0]
  if (!cup) return { error: "No s'hi troba cap cassoleta (cilindre sencer de Ø20 a Ø40)." }
  const ax = cup.axis
  const lo = add(cup.origin, mul(ax, cup.t0))
  const hi = add(cup.origin, mul(ax, cup.t1))
  // La cara de la porta és l'extrem de la cassoleta del costat del cos de la frontissa.
  const centroid = mean(f.points)
  const mid = mul(add(lo, hi), 0.5)
  const towardBody = dot(sub(centroid, mid), ax) >= 0 ? 1 : -1
  const n = mul(ax, towardBody)
  let face = towardBody > 0 ? hi : lo
  // L'origen del fitxer (si és al centre de la cassoleta, a la cara) és la referència dels models de Hettich.
  const atOrigin = Math.hypot(...face) < 1
  if (atOrigin) face = [0, 0, 0]
  const depth = upHalf(cup.t1 - cup.t0)
  // Forats a la cara: paral·lels a la cassoleta, a prop (≤ 45 mm) i a l'altura de la cara (ala) o a dins (espigues).
  const pre: LocalFrame = { origin: face, u: [0, 0, 0], v: [0, 0, 0], n }
  const others = holeCandidates(f.cylinders, 0.9, 6).filter((c) => parallel(c.axis, ax))
  const near: { c: StepCylinder; at: V3; h: [number, number] }[] = []
  for (const c of others) {
    const off = sub(c.origin, face)
    const at = sub(off, mul(n, dot(off, n)))
    const dist = Math.hypot(...at)
    if (dist < cup.radius + 1 || dist > 45) continue
    const h = heights(c, pre)
    if (h[0] > 8 || h[1] < -20) continue
    near.push({ c, at, h })
  }
  // Concèntrics (avellanat i forat): un per centre; el que entra més a la peça o, a l'ala, el més estret.
  const holes: typeof near = []
  for (const x of near) {
    const same = holes.findIndex((y) => Math.hypot(...sub(x.at, y.at)) < 0.5)
    if (same < 0) holes.push(x)
    else {
      const y = holes[same]!
      const better = x.h[0] < y.h[0] - 0.5 || (Math.abs(x.h[0] - y.h[0]) <= 0.5 && x.c.radius < y.c.radius)
      if (better) holes[same] = x
    }
  }
  const along = pairAxis(holes.map((x) => ({ u: x.at })), [0, 0, 0], n) ?? fallbackAlong(n)
  let v = norm(cross(n, along))
  // Els cargols de l'ala de les cassoletes van més lluny del cantell que el centre: `v` hi apunta.
  const offset = holes.length ? holes.reduce((s, x) => s + dot(x.at, v), 0) / holes.length : 0
  if (offset < -0.5) v = mul(v, -1)
  else if (Math.abs(offset) <= 0.5) notes.push("Els forats de l'ala estan alineats amb el centre de la cassoleta: comprova de quin costat és el cantell.")
  const u = cross(v, n)
  const frame: LocalFrame = { origin: face, u, v, n }
  const out: ProposedHole[] = [{ role: "cup", u: 0, v: 0, d: snapDrill(cup.radius * 2), measured: r2(cup.radius * 2), depth, depthFrom: "file" }]
  for (const x of holes.sort((a, b) => dot(a.at, u) - dot(b.at, u))) {
    const inside = -x.h[0]
    const dowel = inside > 0.5
    out.push({
      role: dowel ? "dowel" : "screw",
      u: r2(dot(x.at, u)),
      v: r2(dot(x.at, v)),
      d: snapDrill(x.c.radius * 2),
      measured: r2(x.c.radius * 2),
      depth: dowel ? upHalf(inside) : DEFAULT_DEPTHS.screw,
      depthFrom: dowel ? "file" : "default",
    })
  }
  notes.push(`Cassoleta Ø${fmt(out[0]!.measured)} → broca Ø${fmt(out[0]!.d)}, fondària ${fmt(depth)} mm (del model).`)
  const screws = out.filter((h) => h.role !== "cup")
  if (screws.length)
    notes.push(
      `${screws.length} forat${screws.length === 1 ? "" : "s"} ${screws[0]!.role === "dowel" ? "d'espiga" : "de cargol"}: ${screws.map((h) => `Ø${fmt(h.d)} a ${fmt(h.u)} / ${fmt(h.v)}`).join(" · ")} mm (al llarg / cap a dins)${screws.some((h) => h.depthFrom === "default") ? `; fondària per defecte ${DEFAULT_DEPTHS.screw} mm` : ""}.`,
    )
  else notes.push("Sense forats de cargol a l'ala (frontissa per encolar o per pressió?): només la cassoleta.")
  if (!atOrigin) notes.push("L'origen del fitxer no és al centre de la cassoleta: s'ha calculat.")
  if (Math.abs(Math.abs(dot(n, [0, 1, 0])) - 1) > 0.02) notes.push("La cassoleta del model és inclinada (frontissa d'angle): s'ha girat al pla de la porta.")
  return { kind: "hinge", frame, holes: out, bbox: bboxOf(f.points, frame), notes }
}

/** Un extrem del tram toca el pla de la cara (±0,3 mm). */
const ON_FACE = 0.3

/**
 * Placa de muntatge: **només els forats de muntatge de la cara que toca el lateral** (el pla per l'origen del fitxer, la
 * referència de Hettich): espigues (tetons) que surten d'aquest pla cap al lateral (fondària = el que hi entren) i forats
 * de cargol que travessen el cos de la placa des d'aquest pla (fondària del cargol euro). Els altres cilindres (traus
 * d'ajust, el clip del braç, rebaixos, tetons de l'altra cara) no són forats del lateral. Els forats van per parells
 * simètrics respecte a la referència (±16 a les 8099); si en queda algun sense parell, la placa és **ambigua**: cap
 * proposta (es poden entrar a mà) millor que un forat dolent.
 */
export function proposePlate(f: StepFeatures): HardwareProposal | { error: string } {
  const notes: string[] = []
  const cands = holeCandidates(f.cylinders, 0.9, 6, true)
  if (!cands.length) return { error: "No s'hi troben forats (cilindres sencers de Ø2 a Ø12)." }
  // Eix dels forats: el que tenen més candidats a prop de l'origen.
  const groups: { axis: V3; list: StepCylinder[] }[] = []
  for (const c of cands) {
    const g = groups.find((x) => parallel(x.axis, c.axis))
    if (g) g.list.push(c)
    else groups.push({ axis: c.axis, list: [c] })
  }
  const nearOrigin = (c: StepCylinder) => Math.hypot(...sub(c.origin, mul(c.axis, dot(c.origin, c.axis)))) <= 60
  groups.sort((a, b) => b.list.filter(nearOrigin).length - a.list.filter(nearOrigin).length || b.list.length - a.list.length)
  const g = groups[0]!
  const list = g.list.filter(nearOrigin)
  if (!list.length) return { error: "Els forats de la placa són lluny de l'origen del fitxer." }
  const origin: V3 = [0, 0, 0]
  // Cara del lateral: el pla per l'origen. De quin costat és el cos de la placa: els forats de cargol que neixen al pla
  // hi van (travessen el cos); les espigues que neixen al pla van a l'altre costat (entren al lateral). Sense cap pista,
  // el centre dels vèrtexs.
  let n = norm(g.axis)
  const at0 = (c: StepCylinder) => heights(c, { origin, u: [0, 0, 0], v: [0, 0, 0], n })
  let vote = 0
  for (const c of list) {
    const h = at0(c)
    const from = Math.abs(h[0]) < ON_FACE ? 1 : Math.abs(h[1]) < ON_FACE ? -1 : 0
    if (!from) continue
    vote += c.boss ? -from : from
  }
  const side = vote || Math.sign(dot(mean(f.points), n))
  if (side < 0) n = mul(n, -1)
  const pre: LocalFrame = { origin, u: [0, 0, 0], v: [0, 0, 0], n }
  const pts: { c: StepCylinder; at: V3; h: [number, number]; dowel: boolean }[] = []
  let skipped = 0
  for (const c of list) {
    const h = heights(c, pre)
    const at = sub(c.origin, mul(n, dot(c.origin, n)))
    const d = c.radius * 2
    // Espiga: tetó del pla cap al lateral; cargol: forat del pla cap al cos de la placa. Broques de Ø2,5 a Ø12.
    const dowel = c.boss && Math.abs(h[1]) < ON_FACE && h[0] < -1
    const screw = !c.boss && Math.abs(h[0]) < ON_FACE && h[1] > 0.5
    if ((!dowel && !screw) || d < 2.4 || d > 12.5) {
      skipped++
      continue
    }
    pts.push({ c, at, h, dowel })
  }
  // Un per centre (el que entra més al lateral o, si no, el més estret).
  const holes: typeof pts = []
  for (const x of pts) {
    const same = holes.findIndex((y) => Math.hypot(...sub(x.at, y.at)) < 0.5)
    if (same < 0) holes.push(x)
    else if (x.h[0] < holes[same]!.h[0] - 0.5 || (Math.abs(x.h[0] - holes[same]!.h[0]) <= 0.5 && x.c.radius < holes[same]!.c.radius)) holes[same] = x
  }
  const along = pairAxis(holes.map((x) => ({ u: x.at })), origin, n) ?? fallbackAlong(n)
  let v = norm(cross(n, along))
  // Sense més pistes: la placa s'allarga més cap al darrere (on s'enganxa el braç) que cap al davant.
  const ext = f.points.map((p) => dot(p, v))
  if (ext.length && Math.max(...ext) < -Math.min(...ext)) v = mul(v, -1)
  const u = cross(v, n)
  const frame: LocalFrame = { origin, u, v, n }
  const bbox = bboxOf(f.points, frame)
  const out: ProposedHole[] = holes
    .sort((a, b) => dot(a.at, u) - dot(b.at, u))
    .map((x) => {
      const inside = -x.h[0]
      return {
        role: x.dowel ? "dowel" : "screw",
        u: r2(dot(x.at, u)),
        v: r2(dot(x.at, v)),
        d: snapDrill(x.c.radius * 2),
        measured: r2(x.c.radius * 2),
        depth: x.dowel ? upHalf(inside) : DEFAULT_DEPTHS.plateScrew,
        depthFrom: x.dowel ? "file" : "default",
      } satisfies ProposedHole
    })
  if (skipped) notes.push(`${skipped} cilindre${skipped === 1 ? "" : "s"} de la placa no ${skipped === 1 ? "és" : "són"} de muntatge (no neixen a la cara del lateral): no es proposen.`)
  // Parells simètrics respecte a la referència (u ↔ −u, la mateixa v i la mateixa broca).
  const lone = out.filter((h) => !out.some((o) => o !== h && Math.abs(o.u + h.u) < 1 && Math.abs(o.v - h.v) < 1 && o.d === h.d))
  const list2 = (hs: ProposedHole[]) => hs.map((h) => `Ø${fmt(h.d)}${h.d !== h.measured ? ` (model Ø${fmt(h.measured)})` : ""} a ${fmt(h.u)} / ${fmt(h.v)}`).join(" · ")
  if (!out.length || lone.length) {
    notes.push(
      out.length
        ? `Placa ambigua: ${lone.length === 1 ? "un forat" : `${lone.length} forats`} de muntatge sense parell (${list2(lone)} mm). No es proposa cap forat: entra'ls a mà.`
        : "No s'hi troba cap forat de muntatge a la cara del lateral. No es proposa cap forat: entra'ls a mà.",
    )
    return { kind: "plate", frame, holes: [], bbox, notes }
  }
  notes.push(
    `${out.length} forat${out.length === 1 ? "" : "s"} al lateral: ${list2(out)} mm (al llarg / fondària)${out.some((h) => h.depthFrom === "default") ? `; fondària per defecte ${DEFAULT_DEPTHS.plateScrew} mm (cargol euro)` : ""}.`,
  )
  if (out.some((h) => Math.abs(h.v) > 0.5)) notes.push("Hi ha forats fora de la línia de la referència: comprova cap a on és el davant.")
  return { kind: "plate", frame, holes: out, bbox, notes }
}

const fmt = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",")

/** Distància entre forats d'un tirador: a la de catàleg més propera (múltiples de 32: 64, 96, 128, 160…) si és a ≤ 0,5 mm. */
export function snapHandleDistance(d: number): number {
  const k = Math.round(d / 32) * 32
  return k > 0 && Math.abs(k - d) <= 0.5 ? k : Math.round(d * 10) / 10
}

/** Forat passant del front per a un cargol de tirador de Ø `screw`: el Ø del tirador de l'app (5) si hi passa, si no 1 mm més ample. */
export function handleThroughDiameter(screw: number, base = 5): number {
  return screw + 0.5 <= base ? base : Math.ceil(screw + 1)
}

/**
 * Forats que neixen en un pla per l'origen del fitxer (la referència dels models de Hettich: la cara de muntatge del
 * tirador o la placa de la pota): cilindres sencers (forats, no tetons) de radi `rMin`–`rMax` amb un extrem al pla.
 * Torna la normal del pla cap al cos del ferratge (on van els forats) i els centres al pla, sense repetits (concèntrics).
 */
function faceHoles(f: StepFeatures, rMin: number, rMax: number, tol = ON_FACE): { n: V3; holes: { at: V3; d: number }[] } | null {
  const cands = f.cylinders.filter((c) => !c.boss && c.coverage >= 300 && c.radius >= rMin && c.radius <= rMax)
  const groups: { axis: V3; list: { c: StepCylinder; side: number }[] }[] = []
  for (const c of cands) {
    const ax = norm(c.axis)
    // Extrems del tram a l'eix des del pla per l'origen perpendicular a l'eix.
    const base = dot(c.origin, ax)
    const a = base + c.t0
    const b = base + c.t1
    // Un extrem al pla (o just a sota, `tol`: forats que comencen una mica endins) i l'altre més enllà, cap al cos.
    const side = Math.abs(a) < tol && Math.abs(b) >= Math.abs(a) + 1 ? Math.sign(b) : Math.abs(b) < tol && Math.abs(a) >= Math.abs(b) + 1 ? Math.sign(a) : 0
    if (!side) continue
    const g = groups.find((x) => parallel(x.axis, ax))
    // El sentit cap al cos, a l'eix del grup.
    if (g) g.list.push({ c, side: side * Math.sign(dot(ax, g.axis)) })
    else groups.push({ axis: ax, list: [{ c, side }] })
  }
  if (!groups.length) return null
  groups.sort((a, b) => b.list.length - a.list.length)
  const g = groups[0]!
  const vote = g.list.reduce((s, x) => s + x.side, 0)
  const sideSign = vote ? Math.sign(vote) : Math.sign(dot(mean(f.points), g.axis)) || 1
  const n = mul(g.axis, sideSign)
  const holes: { at: V3; d: number }[] = []
  for (const { c, side } of g.list) {
    if (side !== sideSign) continue
    const at = sub(c.origin, mul(n, dot(c.origin, n)))
    const same = holes.find((h) => Math.hypot(...sub(h.at, at)) < 0.5)
    // Concèntrics (un avellanat i el forat): el més estret és el del cargol.
    if (same) same.d = Math.min(same.d, c.radius * 2)
    else holes.push({ at, d: c.radius * 2 })
  }
  return holes.length ? { n, holes } : null
}

/**
 * Tirador (descàrregues `Griffe` de Hettich): els forats roscats de la cara de muntatge (el pla per l'origen del fitxer,
 * on hi ha el primer forat) → la **distància entre centres** (a la de catàleg si és a ≤ 0,5 mm) i un forat passant al
 * front per a cada cargol (Ø del tirador de l'app, `throughDiameter`, o 1 mm més que el cargol). Un sol forat = pom
 * (un forat al centre). Amb 3 o 4 forats (tiradors amb dues distàncies), el parell simètric que passa per l'origen; amb
 * més (perfils), cap proposta: només 3D. Marc: origen al mig dels forats a la cara del front, `u` al llarg dels forats,
 * `n` cap al tirador (fora del front), `v` = `n × u`.
 */
export function proposeHandle(f: StepFeatures, opts: { throughDiameter?: number } = {}): HardwareProposal | { error: string } {
  const found = faceHoles(f, 1.4, 4.5, 3.5)
  if (!found) return { error: "No s'hi troben els forats dels cargols a la cara de muntatge (cilindres de Ø3 a Ø9 que neixen al pla de l'origen)." }
  const { n } = found
  const notes: string[] = []
  let holes = found.holes
  if (holes.length > 4) return { error: `${holes.length} forats a la cara de muntatge (perfil?): no és un tirador de dos forats.` }
  if (holes.length > 2) {
    // Tiradors amb més d'una distància (3 o 4 forats): el parell centrat al tirador (el mig del parell al mig de la caixa
    // del model, a ±1 mm) que passa per l'origen (la referència de Hettich); si no, el centrat més llarg.
    const box = bboxOf(f.points, { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] })
    const mid = mul(add(box.min, box.max), 0.5)
    const pairs: [typeof holes[number], typeof holes[number]][] = []
    for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) pairs.push([holes[i]!, holes[j]!])
    const atOrigin = (p: (typeof pairs)[number]) => p.some((h) => Math.hypot(...h.at) < 0.5)
    const len = (p: (typeof pairs)[number]) => Math.hypot(...sub(p[0].at, p[1].at))
    // Distància del mig del parell al mig del model, al llarg del parell (de costat no compta: el tirador sobresurt).
    const offCentre = (p: (typeof pairs)[number]) => {
      const m = mul(add(p[0].at, p[1].at), 0.5)
      const dir = norm(sub(p[1].at, p[0].at))
      return Math.abs(dot(sub(mid, m), dir))
    }
    const centred = pairs.filter((p) => offCentre(p) <= 1)
    if (!centred.length) return { error: `${holes.length} forats a la cara de muntatge sense cap parell centrat al tirador: no se sap quins fa servir.` }
    centred.sort((a, b) => Number(atOrigin(b)) - Number(atOrigin(a)) || len(b) - len(a))
    const best = centred[0]!
    const others = pairs.filter((p) => p !== best && (atOrigin(p) || offCentre(p) <= 1)).map((p) => `${fmt(snapHandleDistance(len(p)))} mm`)
    holes = best
    notes.push(`El tirador té ${found.holes.length} forats: es proposa el parell centrat de ${fmt(snapHandleDistance(len(best)))} mm${others.length ? ` (també es pot muntar a ${[...new Set(others)].join(", ")}: canvia la distància a mà)` : ""}.`)
  }
  const screw = Math.min(...holes.map((h) => h.d))
  const through = handleThroughDiameter(Math.round(screw * 10) / 10, opts.throughDiameter ?? 5)
  const centre = holes.length === 2 ? mul(add(holes[0]!.at, holes[1]!.at), 0.5) : holes[0]!.at
  let u: V3
  if (holes.length === 2) {
    u = norm(sub(holes[1]!.at, holes[0]!.at))
    // Sentit estable: cap a +X (o +Z, +Y) del fitxer.
    const ref = [u[0], u[2], u[1]].find((x) => Math.abs(x) > 1e-6) ?? 1
    if (ref < 0) u = mul(u, -1)
  } else u = fallbackAlong(n)
  const v = norm(cross(n, u))
  const frame: LocalFrame = { origin: centre, u, v, n }
  const bbox = bboxOf(f.points, frame)
  const measured = holes.length === 2 ? Math.hypot(...sub(holes[0]!.at, holes[1]!.at)) : 0
  const dist = holes.length === 2 ? snapHandleDistance(measured) : 0
  const out: ProposedHole[] = (holes.length === 2 ? [-dist / 2, dist / 2] : [0]).map((x) => ({ role: "hole", u: r2(x), v: 0, d: through, measured: r2(screw), depth: 0, depthFrom: "default" }))
  if (holes.length === 2)
    notes.push(
      `Tirador de dos forats a ${fmt(dist)} mm entre centres${Math.abs(dist - measured) > 0.005 ? ` (al model ${fmt(r2(measured))})` : ""}: cargols de Ø${fmt(r2(screw))} → forats passants Ø${fmt(through)} al front.`,
    )
  else notes.push(`Pom d'un sol forat: cargol de Ø${fmt(r2(screw))} → un forat passant Ø${fmt(through)} al centre.`)
  if (Math.abs(dot(n, [0, 1, 0])) < 0.98 && Math.abs(dot(n, [0, 0, 1])) < 0.98 && Math.abs(dot(n, [1, 0, 0])) < 0.98) notes.push("Els forats del model són inclinats: s'han girat al pla del front.")
  return { kind: "handle", frame, holes: out, bbox, notes }
}

/** Broca de pilot per a un cargol de fusta que passa per un forat de Ø `d` de la placa (Ø4 → 2,5; Ø6,5 → 4). */
export const legPilot = (d: number): number => snapDrill(d * 0.65)

/**
 * Pota (descàrregues `Moebelfuesse` de Hettich): els forats de la placa de muntatge (el pla per l'origen del fitxer, la
 * cara que toca la base del moble; l'eix de la pota és a l'origen). Es proposen forats de pilot per als cargols (Ø de
 * `legPilot`, 12 mm de fondària) a la cara de sota de la base, en el marc de la pota: `n` cap a la pota (fora de la
 * base), `u` = X del fitxer, `v` = `n × u`.
 */
export function proposeLeg(f: StepFeatures): HardwareProposal | { error: string } {
  const found = faceHoles(f, 1, 5)
  if (!found) return { error: "No s'hi troben els forats de la placa de muntatge (cilindres de Ø2 a Ø10 que neixen al pla de l'origen)." }
  const { n, holes } = found
  const reach = Math.max(...holes.map((h) => Math.hypot(...h.at)))
  if (holes.length > 12 || reach > 200) return { error: `${holes.length} forats fins a ${fmt(r2(reach))} mm de l'eix: no és la placa d'una pota (una estructura?).` }
  // `u` = X del fitxer al pla de la placa (si la pota no mira cap a X).
  const xIn = sub([1, 0, 0], mul(n, n[0]))
  const along = Math.hypot(...xIn) > 0.5 ? norm(xIn) : fallbackAlong(n)
  const v = norm(cross(n, along))
  const frame: LocalFrame = { origin: [0, 0, 0], u: along, v, n }
  const bbox = bboxOf(f.points, frame)
  const out: ProposedHole[] = holes
    .map((h) => ({ role: "screw" as const, u: r2(dot(h.at, along)), v: r2(dot(h.at, v)), d: legPilot(h.d), measured: r2(h.d), depth: DEFAULT_DEPTHS.plateScrew, depthFrom: "default" as const }))
    .sort((a, b) => a.u - b.u || a.v - b.v)
  const c = out.reduce<[number, number]>((s, h) => [s[0] + h.u / out.length, s[1] + h.v / out.length], [0, 0])
  const notes = [
    `${out.length} forat${out.length === 1 ? "" : "s"} de cargol a la placa (Ø${[...new Set(out.map((h) => fmt(h.measured)))].join(", Ø")} al model) → forats de pilot Ø${[...new Set(out.map((h) => fmt(h.d)))].join(", Ø")} × ${DEFAULT_DEPTHS.plateScrew} a la cara de sota de la base, al voltant de l'eix de la pota.`,
  ]
  if (Math.hypot(c[0], c[1]) > 1) notes.push("Els forats no són centrats a l'eix de la pota: totes les potes es posen girades igual (comprova que la placa hi cap a cada cantonada).")
  return { kind: "leg", frame, holes: out, bbox, notes }
}

/** Marc d'un model «només 3D»: el del fitxer (mm), sense forats. */
export function modelProposal(f: StepFeatures | null, notes: string[]): HardwareProposal {
  const frame: LocalFrame = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] }
  return { kind: "model", frame, holes: [], bbox: f?.points.length ? bboxOf(f.points, frame) : { min: [0, 0, 0], max: [0, 0, 0] }, notes }
}
