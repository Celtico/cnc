import type { TallerFrame } from "./tallerFrame"
import { add, cross, dot, len, neg, rotate, sub, unit, X, Z, type Face, type Loop, type LoopPt, type V3 } from "./vec"

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

export class Writer {
  readonly lines: string[] = []
  private n = 0
  add(text: string): number {
    this.n += 1
    this.lines.push(`#${this.n}=${text};`)
    return this.n
  }
}

const k3 = (p: V3): string => p.map((v) => Math.round(v * 1000)).join(",")

export class SolidWriter {
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

export interface StepContext {
  w: Writer
  ctx: number
  prodCtx: number
  defCtx: number
}

export function stepContext(): StepContext {
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

export function identityAxis(w: Writer): number {
  const origin = w.add(`CARTESIAN_POINT('',(0.,0.,0.))`)
  const dz = w.add(`DIRECTION('',(0.,0.,1.))`)
  const dx = w.add(`DIRECTION('',(1.,0.,0.))`)
  return w.add(`AXIS2_PLACEMENT_3D('',#${origin},#${dz},#${dx})`)
}

/** Producte amb la seva definició: PRODUCT → FORMATION → DEFINITION → DEFINITION_SHAPE. */
export function product(c: StepContext, id: string, name: string, description: string): { product: number; pd: number; pds: number } {
  const product = c.w.add(`PRODUCT('${stepString(id)}','${stepString(name)}','${stepString(description)}',(#${c.prodCtx}))`)
  const formation = c.w.add(`PRODUCT_DEFINITION_FORMATION('','',#${product})`)
  const pd = c.w.add(`PRODUCT_DEFINITION('design','',#${formation},#${c.defCtx})`)
  const pds = c.w.add(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`)
  return { product, pd, pds }
}

export function stepText(c: StepContext, name: string, date: string): string {
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
