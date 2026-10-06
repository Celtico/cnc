import { describe, expect, it } from "vitest"
import { readDxf, simplify } from "./dxf"
import { registerView, viewFromDxf } from "./views"

/** DXF de text mínim a partir de parells (codi, valor). */
const dxf = (header: (string | number)[], blocks: (string | number)[], ents: (string | number)[]) =>
  [0, "SECTION", 2, "HEADER", ...header, 0, "ENDSEC", 0, "SECTION", 2, "BLOCKS", ...blocks, 0, "ENDSEC", 0, "SECTION", 2, "ENTITIES", ...ents, 0, "ENDSEC", 0, "EOF"].join("\n")

const near = (a: number, b: number, tol = 0.03) => Math.abs(a - b) <= tol
const bbox = (pts: [number, number][]) => ({
  x0: Math.min(...pts.map((p) => p[0])),
  x1: Math.max(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  y1: Math.max(...pts.map((p) => p[1])),
})

describe("lector DXF de les vistes 2D", () => {
  it("línies, cercles, arcs, polilínies amb bulge, punts i unitats", () => {
    const d = readDxf(
      dxf(
        [9, "$INSUNITS", 70, 4],
        [],
        [
          0, "LINE", 8, "0", 10, 0, 20, 0, 30, 0, 11, 10, 21, 0, 31, 0,
          0, "CIRCLE", 8, "0", 10, 5, 20, 26, 30, 0, 40, 2.6,
          0, "ARC", 8, "0", 10, 0, 20, 0, 30, 0, 40, 10, 50, 0, 51, 90,
          // Quadrat de 10 amb el costat de dalt en semicercle (bulge 1 de (10,10) a (0,10)).
          0, "LWPOLYLINE", 8, "A", 90, 4, 70, 1, 10, 0, 20, 0, 10, 10, 20, 0, 10, 10, 20, 10, 42, 1, 10, 0, 20, 10,
          0, "POINT", 8, "CONNECTIONPOINTS", 10, 0, 20, 6, 30, -17.54,
          0, "TEXT", 8, "0", 10, 0, 20, 0, 1, "hola",
        ],
      ),
    )
    expect(d.unit).toBe(1)
    expect(d.polylines).toHaveLength(4)
    expect(d.circles).toEqual([{ layer: "0", x: 5, y: 26, r: 2.6 }])
    const arc = d.polylines[2]!.pts
    expect(near(arc[0]![0], 10) && near(arc[0]![1], 0)).toBe(true)
    expect(near(arc.at(-1)![0], 0) && near(arc.at(-1)![1], 10)).toBe(true)
    // El semicercle surt per dalt fins a y = 15 (centre (5, 10), radi 5).
    const b = bbox(d.polylines[3]!.pts)
    expect(near(b.y1, 15, 0.05) && near(b.x0, 0) && near(b.x1, 10)).toBe(true)
    expect(d.polylines[3]!.closed).toBe(true)
    expect(d.points).toEqual([{ layer: "CONNECTIONPOINTS", x: 0, y: 6, z: -17.54 }])
    expect(d.skipped).toEqual({ TEXT: 1 })
  })

  it("polzades, POLYLINE amb VERTEX i bulge negatiu (horari), el·lipse i spline", () => {
    const d = readDxf(
      dxf(
        [9, "$INSUNITS", 70, 1],
        [],
        [
          0, "POLYLINE", 8, "0", 66, 1, 70, 0,
          0, "VERTEX", 8, "0", 10, 0, 20, 0, 42, -1,
          0, "VERTEX", 8, "0", 10, 2, 20, 0,
          0, "SEQEND",
          0, "ELLIPSE", 8, "0", 10, 0, 20, 0, 30, 0, 11, 2, 21, 0, 31, 0, 40, 0.5, 41, 0, 42, 6.283185307,
          // Spline quadràtica de 3 punts de control (nusos 0 0 0 1 1 1): una paràbola de (0,0) a (2,0) que passa per (1,0,5).
          0, "SPLINE", 8, "0", 70, 8, 71, 2, 72, 6, 73, 3, 40, 0, 40, 0, 40, 0, 40, 1, 40, 1, 40, 1, 10, 0, 20, 0, 30, 0, 10, 1, 20, 1, 30, 0, 10, 2, 20, 0, 30, 0,
        ],
      ),
    )
    expect(d.unit).toBe(25.4)
    // Semicercle horari de (0,0) a (2,0) polzades: per sobre (y fins a 25,4; l'antihorari aniria per sota).
    const arc = bbox(d.polylines[0]!.pts)
    expect(near(arc.y1, 25.4, 0.1) && near(arc.y0, 0) && near(arc.x1, 50.8)).toBe(true)
    const el = bbox(d.polylines[1]!.pts)
    expect(near(el.x1, 50.8, 0.1) && near(el.y1, 25.4, 0.1)).toBe(true)
    expect(d.polylines[1]!.closed).toBe(true)
    const sp = d.polylines[2]!.pts
    expect(near(sp[0]![0], 0) && near(sp.at(-1)![0], 50.8)).toBe(true)
    expect(near(Math.max(...sp.map((p) => p[1])), 12.7, 0.05)).toBe(true)
  })

  it("blocs inserits amb escala, gir i la capa de l'INSERT", () => {
    const d = readDxf(
      dxf(
        [],
        [0, "BLOCK", 8, "0", 2, "B1", 10, 1, 20, 0, 30, 0, 0, "LINE", 8, "0", 10, 1, 20, 0, 11, 2, 21, 0, 0, "CIRCLE", 8, "0", 10, 2, 20, 0, 40, 1, 0, "ENDBLK"],
        [0, "INSERT", 8, "PECES", 2, "B1", 10, 100, 20, 50, 30, 0, 41, 2, 42, 2, 50, 90],
      ),
    )
    // Base (1,0) a (100,50); la línia de (1,0)–(2,0) a escala 2 i girada 90°: de (100,50) a (100,52).
    const l = d.polylines[0]!
    expect(l.layer).toBe("PECES")
    expect(near(l.pts[0]![0], 100) && near(l.pts[0]![1], 50)).toBe(true)
    expect(near(l.pts[1]![0], 100) && near(l.pts[1]![1], 52)).toBe(true)
    expect(d.circles[0]!.r).toBeCloseTo(2)
    expect(d.circles[0]!.x).toBeCloseTo(100)
    expect(d.circles[0]!.y).toBeCloseTo(52)
  })

  it("extrusió (0, 0, −1): la x es gira", () => {
    const d = readDxf(dxf([], [], [0, "CIRCLE", 8, "0", 10, 5, 20, 3, 30, 0, 40, 1, 210, 0, 220, 0, 230, -1]))
    expect(d.circles[0]).toMatchObject({ x: -5, y: 3 })
  })

  it("no és un DXF", () => {
    expect(() => readDxf("hola")).toThrow(/DXF/)
  })

  it("simplificar treu els punts alineats", () => {
    expect(simplify([[0, 0], [1, 0.001], [2, 0], [2, 5]], 0.02)).toEqual([[0, 0], [2, 0], [2, 5]])
  })

  it("la vista frontal es registra al marc dels forats (8 orientacions)", () => {
    // Com la frontal de Hettich: cassoleta a l'origen, cargols a (5,5, ±26) — x = cap a dins, y = al llarg.
    const d = readDxf(dxf([], [], [0, "CIRCLE", 8, "0", 10, 0, 20, 0, 40, 17.5, 0, "CIRCLE", 8, "0", 10, 5.5, 20, 26, 40, 2.6, 0, "CIRCLE", 8, "0", 10, 5.5, 20, -26, 40, 2.6, 0, "LINE", 8, "0", 10, 0, 20, 0, 11, 5.5, 21, 26]))
    const holes = [
      { u: 0, v: 0, d: 35 },
      { u: -26, v: 5.5, d: 5 },
      { u: 26, v: 5.5, d: 5 },
    ]
    const f = registerView(d, holes)!
    expect(f).not.toBeNull()
    const [u, v] = f([5.5, 26])
    expect(Math.abs(u)).toBeCloseTo(26)
    expect(v).toBeCloseTo(5.5)
    const view = viewFromDxf("front", d, holes)
    expect(view.registered).toBe(true)
    expect(registerView(d, [{ u: 0, v: 0, d: 35 }, { u: 0, v: 40, d: 5 }])).toBeNull()
  })
})
