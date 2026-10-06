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
  kind: "hinge" | "plate"
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
function holeCandidates(cyls: StepCylinder[], rMin: number, rMax: number): StepCylinder[] {
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
    const axis = group[0]!.axis
    const base = group[0]!.origin
    const centre = mul(group.reduce((s, x) => add(s, x.origin), [0, 0, 0] as V3), 1 / group.length)
    const shift = dot(sub(centre, base), axis)
    merged.push({ origin: centre, axis, radius: Math.min(...group.map((x) => x.radius)), t0: Math.min(...group.map((x) => x.t0)) - shift, t1: Math.max(...group.map((x) => x.t1)) - shift, coverage: 360, boss: false })
  }
  return [...full, ...merged]
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

/** Placa de muntatge: els forats de cargol (o les espigues) que van al lateral, al voltant de la referència. */
export function proposePlate(f: StepFeatures): HardwareProposal | { error: string } {
  const notes: string[] = []
  const cands = holeCandidates(f.cylinders, 0.9, 6)
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
  // Cara del lateral: el pla per l'origen; la placa (el gruix del cos) cap a fora.
  // Les espigues (tetons) entren al lateral: el cos de la placa és a l'altre costat. Sense, el centre dels vèrtexs.
  let n = norm(g.axis)
  const bosses = list.filter((c) => c.boss)
  const side = bosses.length
    ? -bosses.reduce((s, c) => s + dot(add(c.origin, mul(c.axis, (c.t0 + c.t1) / 2)), n), 0)
    : dot(mean(f.points), n)
  if (side < 0) n = mul(n, -1)
  const origin: V3 = [0, 0, 0]
  const pre: LocalFrame = { origin, u: [0, 0, 0], v: [0, 0, 0], n }
  const pts = list.map((c) => {
    const at = sub(c.origin, mul(n, dot(c.origin, n)))
    return { c, at, h: heights(c, pre) }
  })
  // Un per centre.
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
  const out: ProposedHole[] = holes
    .sort((a, b) => dot(a.at, u) - dot(b.at, u))
    .map((x) => {
      const inside = -x.h[0]
      const dowel = inside > 0.5
      return {
        role: dowel ? "dowel" : "screw",
        u: r2(dot(x.at, u)),
        v: r2(dot(x.at, v)),
        d: snapDrill(x.c.radius * 2),
        measured: r2(x.c.radius * 2),
        depth: dowel ? upHalf(inside) : DEFAULT_DEPTHS.plateScrew,
        depthFrom: dowel ? "file" : "default",
      } satisfies ProposedHole
    })
  notes.push(
    `${out.length} forat${out.length === 1 ? "" : "s"} al lateral: ${out.map((h) => `Ø${fmt(h.d)}${h.d !== h.measured ? ` (model Ø${fmt(h.measured)})` : ""} a ${fmt(h.u)} / ${fmt(h.v)}`).join(" · ")} mm (al llarg / fondària)${out.some((h) => h.depthFrom === "default") ? `; fondària per defecte ${DEFAULT_DEPTHS.plateScrew} mm (cargol euro)` : ""}.`,
  )
  if (out.some((h) => Math.abs(h.v) > 0.5)) notes.push("Hi ha forats fora de la línia de la referència: comprova cap a on és el davant.")
  return { kind: "plate", frame, holes: out, bbox: bboxOf(f.points, frame), notes }
}

const fmt = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",")
