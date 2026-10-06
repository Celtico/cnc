import { describe, expect, it } from "vitest"
import { parseStep } from "./stepText"
import { stepFeatures, type V3 } from "./stepGeometry"
import { proposeHinge, proposePlate, snapDrill } from "./proposal"

/**
 * STEP sintètic: un sòlid amb cares cilíndriques (cada una limitada per dos cercles sencers o per dos arcs), unitats i,
 * opcionalment, dins d'un conjunt amb una transformació. Prou per al lector (no és un sòlid tancat de debò).
 */
interface Cyl {
  o: V3
  d: V3
  r: number
  h: number
  /** Graus de l'arc (360 = sencer). */
  sweep?: number
  hole?: boolean
}
function makeStep(cyls: Cyl[], opts: { unit?: "mm" | "m"; extraPoints?: V3[]; assembly?: { origin: V3 } } = {}): string {
  let n = 100
  const L: string[] = []
  const e = (s: string) => {
    n++
    L.push(`#${n} = ${s};`)
    return n
  }
  const pt = (p: V3) => e(`CARTESIAN_POINT('',(${p.map((x) => x.toFixed(6)).join(",")}))`)
  const dir = (p: V3) => e(`DIRECTION('',(${p.join(",")}))`)
  const ref = (d: V3): V3 => (Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])
  const ax = (o: V3, d: V3) => e(`AXIS2_PLACEMENT_3D('',#${pt(o)},#${dir(d)},#${dir(ref(d))})`)
  const k = opts.unit === "m" ? 0.001 : 1
  const faces: number[] = []
  for (const c of cyls) {
    const o = c.o.map((x) => x * k) as V3
    const r = c.r * k
    const top = c.o.map((x, i) => (x + c.d[i]! * c.h) * k) as V3
    const sweep = c.sweep ?? 360
    // Eix x de referència del cercle (com `ref` normalitzat): punts a l'angle 0 i `sweep`.
    const rx = ref(c.d)
    const dotv = rx[0] * c.d[0] + rx[1] * c.d[1] + rx[2] * c.d[2]
    const x = rx.map((v, i) => v - c.d[i]! * dotv) as V3
    const y: V3 = [c.d[1] * x[2] - c.d[2] * x[1], c.d[2] * x[0] - c.d[0] * x[2], c.d[0] * x[1] - c.d[1] * x[0]]
    const at = (base: V3, a: number): V3 => base.map((b, i) => b + (x[i]! * Math.cos(a) + y[i]! * Math.sin(a)) * r) as V3
    const loops: number[] = []
    for (const base of [o, top]) {
      const circle = e(`CIRCLE('',#${ax(base, c.d)},${r})`)
      const v1 = e(`VERTEX_POINT('',#${pt(at(base, 0))})`)
      const v2 = sweep >= 360 ? v1 : e(`VERTEX_POINT('',#${pt(at(base, (sweep * Math.PI) / 180))})`)
      const edge = e(`EDGE_CURVE('',#${v1},#${v2},#${circle},.T.)`)
      const oe = e(`ORIENTED_EDGE('',*,*,#${edge},.T.)`)
      loops.push(e(`FACE_BOUND('',#${e(`EDGE_LOOP('',(#${oe}))`)},.T.)`))
    }
    const surf = e(`CYLINDRICAL_SURFACE('',#${ax(o, c.d)},${r})`)
    faces.push(e(`ADVANCED_FACE('',(${loops.map((l) => `#${l}`).join(",")}),#${surf},${c.hole ? ".F." : ".T."})`))
  }
  // Una cara plana amb vèrtexs (el «cos» del ferratge).
  if (opts.extraPoints?.length) {
    const vs = opts.extraPoints.map((p) => e(`VERTEX_POINT('',#${pt(p.map((x) => x * k) as V3)})`))
    const oes = vs.map((v, i) => e(`ORIENTED_EDGE('',*,*,#${e(`EDGE_CURVE('',#${v},#${vs[(i + 1) % vs.length]},#${e(`LINE('',#${pt([0, 0, 0])},#${e(`VECTOR('',#${dir([1, 0, 0])},1.)`)})`)},.T.)`)},.T.)`))
    const plane = e(`PLANE('',#${ax([0, 0, 0], [0, 0, 1])})`)
    faces.push(e(`ADVANCED_FACE('',(#${e(`FACE_OUTER_BOUND('',#${e(`EDGE_LOOP('',(${oes.map((x) => `#${x}`).join(",")}))`)},.T.)`)}),#${plane},.T.)`))
  }
  const shell = e(`CLOSED_SHELL('',(${faces.map((f) => `#${f}`).join(",")}))`)
  const brep = e(`MANIFOLD_SOLID_BREP('',#${shell})`)
  const unit = opts.unit === "m" ? "SI_UNIT($,.METRE.)" : "SI_UNIT(.MILLI.,.METRE.)"
  e(`( LENGTH_UNIT() NAMED_UNIT(*) ${unit} )`)
  const partRep = e(`ADVANCED_BREP_SHAPE_REPRESENTATION('part',(#${brep}),$)`)
  if (opts.assembly) {
    const id = e(`AXIS2_PLACEMENT_3D('',#${pt([0, 0, 0])},#${dir([0, 0, 1])},#${dir([1, 0, 0])})`)
    // Al conjunt, la peça girada 90° al voltant de z i desplaçada.
    const placed = e(`AXIS2_PLACEMENT_3D('',#${pt(opts.assembly.origin.map((x) => x * k) as V3)},#${dir([0, 0, 1])},#${dir([0, 1, 0])})`)
    const root = e(`SHAPE_REPRESENTATION('asm',(#${id},#${placed}),$)`)
    const child = e(`SHAPE_REPRESENTATION('part',(#${id}),$)`)
    e(`SHAPE_REPRESENTATION_RELATIONSHIP('','',#${child},#${partRep})`)
    const idt = e(`ITEM_DEFINED_TRANSFORMATION('','',#${id},#${placed})`)
    e(`( REPRESENTATION_RELATIONSHIP('','',#${child},#${root}) REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#${idt}) SHAPE_REPRESENTATION_RELATIONSHIP() )`)
  }
  e(`PRODUCT('9071205','9071205','',())`)
  return ["ISO-10303-21;", "HEADER;", "FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));", "ENDSEC;", "DATA;", ...L, "ENDSEC;", "END-ISO-10303-21;"].join("\n")
}

/** Frontissa com la Sensys de Hettich: cassoleta Ø35 de 12,8 a l'origen (eix y), cargols a (5,5, ±26) de l'ala i un braç. */
const sensys = (): Cyl[] => [
  { o: [0, -12.8, 0], d: [0, 1, 0], r: 17.5, h: 12.8 },
  { o: [0, -12.8, 0], d: [0, 1, 0], r: 16, h: 11.3, hole: true },
  { o: [5.5, 0, 26], d: [0, 1, 0], r: 2.6, h: 3, hole: true },
  { o: [5.5, 0, -26], d: [0, 1, 0], r: 2.6, h: 3, hole: true },
  // Contorn de l'ala (arc, no és un forat) i un cargol del braç (un altre eix).
  { o: [12.1, 0, 27.76], d: [0, 1, 0], r: 5, h: 3, sweep: 62 },
  { o: [14.7, 54.4, 0], d: [-1, 0, 0], r: 4.03, h: 1.5 },
]
const arm: V3[] = [[-4, 10, -8], [19, 10, -8], [19, 70, 8], [-4, 70, 8]]

describe("lector STEP", () => {
  it("entitats simples i complexes, textos amb cometes", () => {
    const f = parseStep("ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\n#1 = PRODUCT('l''u','x','',(#2));\n#2 = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n#3 = CARTESIAN_POINT('',(1.,-2.5E1,3));\nENDSEC;")
    expect(f.schema).toBe("AUTOMOTIVE_DESIGN")
    expect(f.entities.get(1)).toEqual({ id: 1, type: "PRODUCT", args: ["l'u", "x", "", [{ ref: 2 }]] })
    expect(f.entities.get(2)!.parts!.map((p) => p.type)).toEqual(["LENGTH_UNIT", "NAMED_UNIT", "SI_UNIT"])
    expect(f.entities.get(3)!.args[1]).toEqual([1, -25, 3])
    expect(() => parseStep("hola")).toThrow(/STEP/)
  })

  it("cilindres: eix, radi, tram, volta i forat o tetó", () => {
    const s = stepFeatures(makeStep(sensys(), { extraPoints: arm }))
    expect(s.unit).toBe(1)
    expect(s.name).toBe("9071205")
    const cup = s.cylinders.find((c) => c.radius === 17.5)!
    expect(cup).toMatchObject({ coverage: 360, boss: true })
    expect(cup.t1 - cup.t0).toBeCloseTo(12.8)
    expect(s.cylinders.find((c) => c.radius === 5)!.coverage).toBe(62)
    expect(s.cylinders.find((c) => c.radius === 2.6)!.boss).toBe(false)
  })

  it("en metres i dins d'un conjunt (transformació aplicada)", () => {
    const s = stepFeatures(makeStep([{ o: [10, 0, 0], d: [0, 0, 1], r: 2.5, h: 12 }], { unit: "m", assembly: { origin: [100, 0, 0] } }))
    expect(s.unit).toBe(1000)
    const c = s.cylinders[0]!
    expect(c.radius).toBeCloseTo(2.5)
    // Girat 90° (x → y) i desplaçat 100 en x: el centre (10, 0) passa a (100, 10).
    expect(c.origin[0]).toBeCloseTo(100)
    expect(c.origin[1]).toBeCloseTo(10)
  })
})

describe("proposta de mecanitzats", () => {
  it("broques habituals", () => {
    expect([34.8, 35.2, 5.2, 5.7, 8.06, 10, 2.5, 26.2, 7].map(snapDrill)).toEqual([35, 35, 5, 5, 8, 10, 2.5, 26, 7])
  })

  it("frontissa: cassoleta Ø35 × 13 al centre, cargols Ø5 a ±26 i 5,5 cap a dins", () => {
    const p = proposeHinge(stepFeatures(makeStep(sensys(), { extraPoints: arm })))
    if ("error" in p) throw new Error(p.error)
    expect(p.frame.origin).toEqual([0, 0, 0])
    expect(p.frame.n).toEqual([0, 1, 0])
    expect(p.holes.map((h) => [h.role, h.u, h.v, h.d, h.depth, h.depthFrom])).toEqual([
      ["cup", 0, 0, 35, 13, "file"],
      ["screw", -26, 5.5, 5, 10, "default"],
      ["screw", 26, 5.5, 5, 10, "default"],
    ])
    expect(p.bbox.min[2]).toBeCloseTo(-12.8)
  })

  it("frontissa amb espigues que entren a la porta (Ø8 × 11 del model)", () => {
    const cyls: Cyl[] = [{ o: [0, -12.8, 0], d: [0, 1, 0], r: 17.5, h: 12.8 }, { o: [9.5, -11, 22.5], d: [0, 1, 0], r: 4, h: 13 }, { o: [9.5, -11, -22.5], d: [0, 1, 0], r: 4, h: 13 }]
    const p = proposeHinge(stepFeatures(makeStep(cyls, { extraPoints: arm })))
    if ("error" in p) throw new Error(p.error)
    expect(p.holes.slice(1).map((h) => [h.role, h.v, h.d, h.depth, h.depthFrom])).toEqual([
      ["dowel", 9.5, 8, 11, "file"],
      ["dowel", 9.5, 8, 11, "file"],
    ])
  })

  it("sense cassoleta, error", () => {
    expect(proposeHinge(stepFeatures(makeStep([{ o: [0, 0, 0], d: [0, 1, 0], r: 2.5, h: 3 }])))).toHaveProperty("error")
  })

  it("placa: forats de cargol euro a ±16 de la referència (Ø5 × 12) i traus fets de trossos", () => {
    const body: V3[] = [[0, -19, -27], [6, -19, -27], [6, 31, 27], [0, 31, 27]]
    const plate: Cyl[] = [
      { o: [0, 0, 16], d: [1, 0, 0], r: 2.85, h: 6.4, hole: true },
      { o: [0, 0, -16], d: [1, 0, 0], r: 2.85, h: 6.4, hole: true },
      // Un trau de dos semicercles (Ø5,25) centrat a z = 40: un sol forat al centre.
      { o: [0, 0, 36.9], d: [1, 0, 0], r: 2.625, h: 2, hole: true, sweep: 180 },
      { o: [0, 0, 43.1], d: [1, 0, 0], r: 2.625, h: 2, hole: true, sweep: 180 },
    ]
    const p = proposePlate(stepFeatures(makeStep(plate, { extraPoints: body })))
    if ("error" in p) throw new Error(p.error)
    expect(p.frame.n).toEqual([1, 0, 0])
    const holes = p.holes.map((h) => [Math.abs(h.u), h.v, h.d, h.depth])
    expect(holes).toContainEqual([16, 0, 5, 12])
    expect(holes.filter((h) => h[0] === 16)).toHaveLength(2)
    expect(holes).toContainEqual([40, 0, 5, 12])
  })

  it("placa per pressió: espigues Ø10 que entren 11,5 al lateral", () => {
    const body: V3[] = [[0, -22, -27], [6, -22, -27], [6, 22, 27], [0, 22, 27], [3, 10, 0], [3, -10, 5]]
    const p = proposePlate(stepFeatures(makeStep([{ o: [-11.42, 0, 16], d: [1, 0, 0], r: 5, h: 11.42 }, { o: [-11.42, 0, -16], d: [1, 0, 0], r: 5, h: 11.42 }], { extraPoints: body })))
    if ("error" in p) throw new Error(p.error)
    expect(p.holes.map((h) => [h.role, Math.abs(h.u), h.d, h.depth])).toEqual([
      ["dowel", 16, 10, 11.5],
      ["dowel", 16, 10, 11.5],
    ])
  })
})
