import { isEnum, isRef, parseStep, partOf, type StepArg, type StepEntity, type StepFile } from "./stepText"

/**
 * Geometria d'un STEP de ferratge per proposar-ne els mecanitzats: els **cilindres** (cares `CYLINDRICAL_SURFACE`) amb
 * l'eix, el radi, el tram que ocupen al llarg de l'eix (dels vèrtexs de les seves arestes) i quanta volta fan (dels arcs
 * de les arestes: un forat o un tetó és sencer; un arrodoniment o el contorn d'una ala, no). Amb les transformacions dels
 * conjunts (`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION`), tot en mm a les coordenades del fitxer. Pur.
 */

export type V3 = [number, number, number]

/** Cilindre (unió de les cares d'un mateix cilindre del sòlid). */
export interface StepCylinder {
  /** Un punt de l'eix (mm). */
  origin: V3
  /** Direcció de l'eix (unitari). */
  axis: V3
  radius: number
  /** Tram ocupat al llarg de l'eix, des d'`origin` (mm). */
  t0: number
  t1: number
  /** Graus de volta (360 = sencer). */
  coverage: number
  /** Tetó (material a dins: espiga, la cassoleta per fora) o forat (material a fora). */
  boss: boolean
}

export interface StepFeatures {
  schema: string
  /** mm per unitat del fitxer. */
  unit: number
  /** Nom del producte arrel (si n'hi ha). */
  name?: string
  cylinders: StepCylinder[]
  /** Vèrtexs del sòlid (mm), per a la caixa i el centre de massa aproximat. */
  points: V3[]
  solids: number
}

// --- Àlgebra -------------------------------------------------------------------------------------------------------

/** Transformació rígida: files de 3×3 i translació. */
interface Xf {
  m: [V3, V3, V3]
  t: V3
}
const ID: Xf = { m: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] }
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]
}
const apply = (x: Xf, p: V3): V3 => [dot(x.m[0], p) + x.t[0], dot(x.m[1], p) + x.t[1], dot(x.m[2], p) + x.t[2]]
const applyDir = (x: Xf, d: V3): V3 => [dot(x.m[0], d), dot(x.m[1], d), dot(x.m[2], d)]
const compose = (a: Xf, b: Xf): Xf => {
  // a ∘ b (primer b).
  const col = (k: 0 | 1 | 2): V3 => [b.m[0][k], b.m[1][k], b.m[2][k]]
  const m = [0, 1, 2].map((i) => [dot(a.m[i]!, col(0)), dot(a.m[i]!, col(1)), dot(a.m[i]!, col(2))] as V3) as [V3, V3, V3]
  return { m, t: apply(a, b.t) }
}
const invert = (x: Xf): Xf => {
  const m: [V3, V3, V3] = [[x.m[0][0], x.m[1][0], x.m[2][0]], [x.m[0][1], x.m[1][1], x.m[2][1]], [x.m[0][2], x.m[1][2], x.m[2][2]]]
  const t = mul([dot(m[0], x.t), dot(m[1], x.t), dot(m[2], x.t)], -1)
  return { m, t }
}

// --- Lectura ----------------------------------------------------------------------------------------------------------

const nums = (a: StepArg | undefined): number[] => (Array.isArray(a) ? a.filter((x): x is number => typeof x === "number") : [])

class Geo {
  readonly ents: Map<number, StepEntity>
  readonly file: StepFile
  unit = 1
  constructor(file: StepFile) {
    this.file = file
    this.ents = file.entities
    this.unit = lengthUnit(file)
  }
  get(a: StepArg | undefined): StepEntity | undefined {
    return isRef(a) ? this.ents.get(a.ref) : undefined
  }
  point(a: StepArg | undefined): V3 | null {
    const e = this.get(a)
    if (!e || e.type !== "CARTESIAN_POINT") return null
    const c = nums(e.args[1])
    return [(c[0] ?? 0) * this.unit, (c[1] ?? 0) * this.unit, (c[2] ?? 0) * this.unit]
  }
  dir(a: StepArg | undefined): V3 | null {
    const e = this.get(a)
    if (!e || e.type !== "DIRECTION") return null
    const c = nums(e.args[1])
    return norm([c[0] ?? 0, c[1] ?? 0, c[2] ?? 0])
  }
  /** `AXIS2_PLACEMENT_3D`: origen i eixos (x, y, z). */
  placement(a: StepArg | undefined): { o: V3; x: V3; y: V3; z: V3 } | null {
    const e = this.get(a)
    if (!e || e.type !== "AXIS2_PLACEMENT_3D") return null
    const o = this.point(e.args[1]) ?? [0, 0, 0]
    const z = this.dir(e.args[2]) ?? [0, 0, 1]
    let x = this.dir(e.args[3]) ?? (Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])
    x = norm(sub(x, mul(z, dot(x, z))))
    return { o, x, y: cross(z, x), z }
  }
  placementXf(a: StepArg | undefined): Xf {
    const p = this.placement(a)
    if (!p) return ID
    return { m: [[p.x[0], p.y[0], p.z[0]], [p.x[1], p.y[1], p.z[1]], [p.x[2], p.y[2], p.z[2]]], t: p.o }
  }
}

/** mm per unitat: `SI_UNIT(.MILLI., .METRE.)` = 1; metres = 1000; polzades = 25,4. Sense unitat, mm. */
function lengthUnit(f: StepFile): number {
  for (const e of f.entities.values()) {
    if (!partOf(e, "LENGTH_UNIT")) continue
    const conv = partOf(e, "CONVERSION_BASED_UNIT")
    if (conv) {
      const name = String(conv.args[0] ?? "").toUpperCase()
      if (name.includes("INCH")) return 25.4
      if (name.includes("FOOT")) return 304.8
    }
    const si = partOf(e, "SI_UNIT")
    if (si) {
      const prefix = isEnum(si.args[0]) ? si.args[0].enum : null
      return prefix === "MILLI" ? 1 : prefix === "CENTI" ? 10 : prefix === "DECI" ? 100 : prefix === "MICRO" ? 0.001 : prefix === "KILO" ? 1e6 : 1000
    }
  }
  return 1
}

/** Les transformacions de cada representació a l'arrel (una per instància). */
function repTransforms(g: Geo): Map<number, Xf[]> {
  // Fills → pares amb la transformació (fill → pare); `SHAPE_REPRESENTATION_RELATIONSHIP` sense transformació = la mateixa.
  const up = new Map<number, { parent: number; xf: Xf }[]>()
  const same = new Map<number, number[]>()
  const link = (a: number, b: number) => {
    same.set(a, [...(same.get(a) ?? []), b])
    same.set(b, [...(same.get(b) ?? []), a])
  }
  for (const e of g.ents.values()) {
    const rr = partOf(e, "REPRESENTATION_RELATIONSHIP") ?? partOf(e, "SHAPE_REPRESENTATION_RELATIONSHIP")
    if (!rr) continue
    const rel = partOf(e, "REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION")
    const a = rr.args[2]
    const b = rr.args[3]
    if (!isRef(a) || !isRef(b)) continue
    if (!rel) {
      if (e.type === "SHAPE_REPRESENTATION_RELATIONSHIP" || e.parts) link(a.ref, b.ref)
      continue
    }
    const idt = g.get(rel.args[0])
    let xf = ID
    if (idt?.type === "ITEM_DEFINED_TRANSFORMATION") xf = compose(g.placementXf(idt.args[3]), invert(g.placementXf(idt.args[2])))
    up.set(a.ref, [...(up.get(a.ref) ?? []), { parent: b.ref, xf }])
  }
  const memo = new Map<number, Xf[]>()
  const walk = (rep: number, depth: number, seen: Set<number>): Xf[] => {
    const hit = memo.get(rep)
    if (hit) return hit
    if (depth > 12) return [ID]
    // Totes les representacions iguals a aquesta (sense transformació).
    const group = new Set<number>([rep])
    const stack = [rep]
    while (stack.length)
      for (const n of same.get(stack.pop()!) ?? []) {
        if (group.has(n)) continue
        group.add(n)
        stack.push(n)
      }
    const out: Xf[] = []
    for (const r of group)
      for (const { parent, xf } of up.get(r) ?? []) {
        if (seen.has(parent)) continue
        for (const p of walk(parent, depth + 1, new Set([...seen, ...group]))) out.push(compose(p, xf))
      }
    const res = out.length ? out.slice(0, 64) : [ID]
    memo.set(rep, res)
    return res
  }
  const out = new Map<number, Xf[]>()
  for (const e of g.ents.values()) {
    if (!e.type.endsWith("SHAPE_REPRESENTATION") || !Array.isArray(e.args[1])) continue
    out.set(e.id, walk(e.id, 0, new Set()))
  }
  return out
}

interface RawCyl {
  o: V3
  x: V3
  y: V3
  z: V3
  r: number
  /** Punts per al tram al llarg de l'eix (vèrtexs i centres dels arcs). */
  pts: V3[]
  /** Només els vèrtexs (caixa del ferratge). */
  verts: V3[]
  arcs: [number, number][]
  boss: boolean
}

const TAU = Math.PI * 2
const angle = (c: RawCyl, p: V3): number => {
  const d = sub(p, c.o)
  const a = Math.atan2(dot(d, c.y), dot(d, c.x))
  return a < 0 ? a + TAU : a
}

/** El 3D d'una aresta (desembolica `SURFACE_CURVE`/`SEAM_CURVE`). */
function curveOf(g: Geo, a: StepArg | undefined): StepEntity | undefined {
  let e = g.get(a)
  for (let k = 0; e && k < 3 && (e.type === "SURFACE_CURVE" || e.type === "SEAM_CURVE" || e.type === "INTERSECTION_CURVE"); k++) e = g.get(e.args[1])
  return e
}

function faceCylinder(g: Geo, face: StepEntity): RawCyl | null {
  const surf = g.get(face.args[2])
  if (!surf || surf.type !== "CYLINDRICAL_SURFACE") return null
  const p = g.placement(surf.args[1])
  const r = (typeof surf.args[2] === "number" ? surf.args[2] : NaN) * g.unit
  if (!p || !(r > 0)) return null
  const sameSense = !(isEnum(face.args[3]) && face.args[3].enum === "F")
  const c: RawCyl = { o: p.o, x: p.x, y: p.y, z: p.z, r, pts: [], verts: [], arcs: [], boss: sameSense }
  const bounds = Array.isArray(face.args[1]) ? face.args[1] : []
  for (const b of bounds) {
    const bound = g.get(b)
    const loop = g.get(bound?.args[1])
    if (!loop) continue
    if (loop.type === "VERTEX_LOOP") {
      const v = g.point(g.get(loop.args[1])?.args[1])
      if (v) {
        c.pts.push(v)
        c.verts.push(v)
      }
      continue
    }
    const edges = Array.isArray(loop.args[1]) ? loop.args[1] : []
    for (const oe of edges) {
      const oriented = g.get(oe)
      const edge = g.get(oriented?.args[3])
      if (!edge || edge.type !== "EDGE_CURVE") continue
      const v1 = g.point(g.get(edge.args[1])?.args[1])
      const v2 = g.point(g.get(edge.args[2])?.args[1])
      if (v1) {
        c.pts.push(v1)
        c.verts.push(v1)
      }
      if (v2) {
        c.pts.push(v2)
        c.verts.push(v2)
      }
      const curve = curveOf(g, edge.args[3])
      if (curve?.type !== "CIRCLE" || !v1 || !v2) continue
      const cp = g.placement(curve.args[1])
      const cr = (typeof curve.args[2] === "number" ? curve.args[2] : NaN) * g.unit
      if (!cp || Math.abs(cr - r) > 0.01 + r * 1e-4) continue
      // El centre del cercle ha de ser a l'eix i el pla, perpendicular.
      const off = sub(cp.o, c.o)
      const radial = sub(off, mul(c.z, dot(off, c.z)))
      if (Math.hypot(...radial) > 0.01 || Math.abs(Math.abs(dot(cp.z, c.z)) - 1) > 1e-4) continue
      c.pts.push(cp.o)
      const edgeSame = !(isEnum(edge.args[4]) && edge.args[4].enum === "F")
      const [s, e] = edgeSame ? [v1, v2] : [v2, v1]
      const full = Math.hypot(...sub(v1, v2)) < 1e-6
      if (full) {
        c.arcs.push([0, TAU])
        continue
      }
      // El paràmetre del cercle gira en sentit antihorari al voltant del seu eix: si és el contrari del cilindre, al revés.
      const ccw = dot(cp.z, c.z) > 0
      const [from, to] = ccw ? [angle(c, s), angle(c, e)] : [angle(c, e), angle(c, s)]
      c.arcs.push([from, to])
    }
  }
  return c
}

/** Graus coberts per una llista d'arcs (de → a, en sentit antihorari). */
function coverage(arcs: [number, number][]): number {
  const iv: [number, number][] = []
  for (const [a, b] of arcs) {
    if (b - a >= TAU - 1e-9) return 360
    let span = b - a
    if (span <= 0) span += TAU
    if (a + span <= TAU) iv.push([a, a + span])
    else iv.push([a, TAU], [0, a + span - TAU])
  }
  iv.sort((p, q) => p[0] - q[0])
  let total = 0
  let cur: [number, number] | null = null
  for (const s of iv) {
    if (!cur || s[0] > cur[1] + 1e-6) {
      if (cur) total += cur[1] - cur[0]
      cur = [s[0], s[1]]
    } else cur[1] = Math.max(cur[1], s[1])
  }
  if (cur) total += cur[1] - cur[0]
  return (total / TAU) * 360
}

/** Llegeix un STEP i en treu els cilindres i els vèrtexs (`StepFeatures`). Llança si no és un STEP. */
export function stepFeatures(text: string): StepFeatures {
  const file = parseStep(text)
  const g = new Geo(file)
  const xfs = repTransforms(g)
  // Sòlid → representació que el conté.
  const repOf = new Map<number, number>()
  for (const e of g.ents.values()) {
    if (!e.type.endsWith("SHAPE_REPRESENTATION") || !Array.isArray(e.args[1])) continue
    for (const it of e.args[1]) if (isRef(it)) repOf.set(it.ref, e.id)
  }
  const cylinders: StepCylinder[] = []
  const points: V3[] = []
  let solids = 0
  const shellFaces = (shell: StepEntity | undefined): StepEntity[] => {
    if (!shell) return []
    const list = Array.isArray(shell.args[1]) ? shell.args[1] : []
    return list.map((f) => {
      let face = g.get(f)
      if (face?.type === "ORIENTED_FACE") face = g.get(face.args[2])
      return face
    }).filter((f): f is StepEntity => !!f && (f.type === "ADVANCED_FACE" || f.type === "FACE_SURFACE"))
  }
  for (const e of g.ents.values()) {
    let faces: StepEntity[] = []
    if (e.type === "MANIFOLD_SOLID_BREP" || e.type === "BREP_WITH_VOIDS") faces = shellFaces(g.get(e.args[1]))
    else if (e.type === "SHELL_BASED_SURFACE_MODEL") faces = (Array.isArray(e.args[1]) ? e.args[1] : []).flatMap((s) => shellFaces(g.get(s)))
    else continue
    solids++
    const rep = repOf.get(e.id)
    const instances = (rep !== undefined ? xfs.get(rep) : undefined) ?? [ID]
    // Cilindres del sòlid (les cares del mateix cilindre, juntes).
    const raw: RawCyl[] = []
    const local: V3[] = []
    for (const f of faces) {
      const c = faceCylinder(g, f)
      if (!c) {
        // Vèrtexs de la cara (caixa i centre).
        for (const b of Array.isArray(f.args[1]) ? f.args[1] : []) {
          const loop = g.get(g.get(b)?.args[1])
          for (const oe of Array.isArray(loop?.args[1]) ? loop!.args[1] : []) {
            const edge = g.get(g.get(oe)?.args[3])
            for (const k of [1, 2]) {
              const v = g.point(g.get(edge?.args[k])?.args[1])
              if (v) local.push(v)
            }
          }
        }
        continue
      }
      local.push(...c.verts)
      const same = raw.find((o) => Math.abs(o.r - c.r) < 0.005 && Math.abs(Math.abs(dot(o.z, c.z)) - 1) < 1e-4 && Math.hypot(...cross(sub(c.o, o.o), o.z)) < 0.01)
      if (same) {
        // Mateix cilindre: els arcs es passen al marc del primer.
        same.pts.push(...c.pts)
        for (const [a, b] of c.arcs) {
          if (b - a >= TAU - 1e-9) same.arcs.push([0, TAU])
          else {
            const pa: V3 = add(c.o, add(mul(c.x, Math.cos(a) * c.r), mul(c.y, Math.sin(a) * c.r)))
            const pb: V3 = add(c.o, add(mul(c.x, Math.cos(b) * c.r), mul(c.y, Math.sin(b) * c.r)))
            same.arcs.push(dot(same.z, c.z) > 0 ? [angle(same, pa), angle(same, pb)] : [angle(same, pb), angle(same, pa)])
          }
        }
        continue
      }
      raw.push(c)
    }
    for (const xf of instances) {
      for (const p of local) points.push(apply(xf, p))
      for (const c of raw) {
        const ts = c.pts.map((p) => dot(sub(p, c.o), c.z))
        const cov = c.arcs.length ? coverage(c.arcs) : 0
        cylinders.push({
          origin: apply(xf, c.o),
          axis: norm(applyDir(xf, c.z)),
          radius: c.r,
          t0: ts.length ? Math.min(...ts) : 0,
          t1: ts.length ? Math.max(...ts) : 0,
          coverage: Math.round(cov),
          boss: c.boss,
        })
      }
    }
  }
  const product = [...g.ents.values()].find((e) => e.type === "PRODUCT")
  const name = typeof product?.args[0] === "string" ? product.args[0] : undefined
  return { schema: file.schema, unit: g.unit, ...(name ? { name } : {}), cylinders, points, solids }
}
