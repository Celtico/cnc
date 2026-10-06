import { describe, expect, it } from "vitest"
import { hasMachiningLayers, machiningFromDxf, machiningLayer, partFromFileName } from "./dxfMachining"
import { readDxf } from "./dxf"
import { machiningProblems, type GenOp } from "../model"

/** DXF sintètic (ASCII, mm): cercles i polilínies (LWPOLYLINE) a les capes que es diguin. */
function dxf(ents: ({ circle: [number, number, number]; layer: string } | { poly: [number, number][]; closed?: boolean; layer: string })[]): string {
  const out: (string | number)[] = [0, "SECTION", 2, "HEADER", 9, "$INSUNITS", 70, 4, 0, "ENDSEC", 0, "SECTION", 2, "ENTITIES"]
  for (const e of ents) {
    if ("circle" in e) out.push(0, "CIRCLE", 8, e.layer, 10, e.circle[0], 20, e.circle[1], 30, 0, 40, e.circle[2])
    else {
      out.push(0, "LWPOLYLINE", 8, e.layer, 90, e.poly.length, 70, e.closed ? 1 : 0)
      for (const [x, y] of e.poly) out.push(10, x, 20, y)
    }
  }
  out.push(0, "ENDSEC", 0, "EOF")
  return out.join("\n")
}
const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

describe("capes de mecanitzat del DXF", () => {
  it("noms de capa de la convenció (decimals amb _)", () => {
    expect(machiningLayer("DRILL_D5_P12")).toEqual({ kind: "drill", face: "A", d: 5, depth: 12 })
    expect(machiningLayer("drill_b_d8_p17_5")).toEqual({ kind: "drill", face: "B", d: 8, depth: 17.5 })
    expect(machiningLayer("GROOVE_W8_P10")).toEqual({ kind: "groove", face: "A", w: 8, depth: 10 })
    expect(machiningLayer("GROOVE_B_W3_5_P6")).toEqual({ kind: "groove", face: "B", w: 3.5, depth: 6 })
    expect(machiningLayer("POCKET_P12_5")).toEqual({ kind: "pocket", face: "A", depth: 12.5 })
    expect(machiningLayer("CUT_THROUGH")).toEqual({ kind: "through" })
    expect(machiningLayer("CONTOUR")).toEqual({ kind: "contour" })
    expect(machiningLayer("DRILL_H_D8_P30")).toEqual({ kind: "edge" })
    expect(machiningLayer("0")).toBeNull()
    expect(machiningLayer("CONNECTIONPOINTS")).toBeNull()
  })

  it("la peça pel sufix del nom", () => {
    expect(partFromFileName("SL100_porta.dxf")).toBe("front")
    expect(partFromFileName("dir/SL100_lateral.DXF")).toBe("side")
    expect(partFromFileName("SL100_tapa.dxf")).toBe("top")
    expect(partFromFileName("SL100_base.dxf")).toBe("bottom")
    expect(partFromFileName("SL100_prestatge.dxf")).toBe("shelf")
    expect(partFromFileName("SL100_fons.dxf")).toBe("back")
    expect(partFromFileName("9071205_2D_front_view.dxf")).toBe("front")
    expect(partFromFileName("SL100.dxf")).toBeNull()
  })

  it("forats, ranura (rectangle i línia central), caixera i talls passants", () => {
    const text = dxf([
      { circle: [10, 20, 2.5], layer: "DRILL_D5_P12" },
      { circle: [-10, 20, 4], layer: "DRILL_B_D8_P10" },
      { poly: rect(-200, 16, 200, 24), closed: true, layer: "GROOVE_W8_P10" },
      { poly: [[0, 100], [0, 300]], layer: "GROOVE_W6_P8" },
      { poly: rect(-30, -50, 30, -10), closed: true, layer: "POCKET_P12_5" },
      { circle: [0, 0, 17.5], layer: "CUT_THROUGH" },
      { poly: [[50, 50], [80, 50], [65, 80]], closed: true, layer: "CUT_THROUGH" },
    ])
    expect(hasMachiningLayers(readDxf(text))).toBe(true)
    const { ops, notes } = machiningFromDxf(text, "top")
    expect(notes).toEqual([])
    const by = (k: GenOp["kind"]) => ops.filter((o) => o.kind === k)
    expect(by("drill").map((o) => [o.face, o.p.at, o.q.at, o.d, o.through ?? false, o.through ? undefined : o.depth])).toEqual([
      ["A", 10, 20, 5, false, 12],
      ["B", -10, 20, 8, false, 10],
      ["A", 0, 0, 35, true, undefined],
    ])
    expect(by("groove").map((o) => ({ p: o.p.at, q: o.q.at, w: o.w, len: o.len, along: o.along, depth: o.depth }))).toEqual([
      { p: 0, q: 20, w: 8, len: 400, along: "p", depth: 10 },
      // Línia central: la llargada + l'amplada (els extrems de la fresa).
      { p: 0, q: 200, w: 6, len: 206, along: "q", depth: 8 },
    ])
    expect(by("pocket")[0]).toMatchObject({ p: { from: "ref", at: 0 }, q: { from: "ref", at: -30 }, w: 60, h: 40, depth: 12.5, face: "A" })
    expect(by("contour")[0]).toMatchObject({ through: true, points: [[50, 50], [80, 50], [65, 80]] })
    expect(ops.every((o) => o.part === "top" && o.p.from === "ref" && o.q.from === "ref")).toBe(true)
    expect(machiningProblems(ops)).toEqual([])
  })

  it("el contorn de la peça (CONTOUR que ho envolta tot) no es talla; un CONTOUR petit, sí", () => {
    const text = dxf([
      { poly: rect(-100, -100, 500, 300), closed: true, layer: "CONTOUR" },
      { poly: rect(0, 0, 40, 40), closed: true, layer: "CONTOUR" },
      { circle: [100, 100, 2.5], layer: "DRILL_D5_P12" },
    ])
    const { ops, notes } = machiningFromDxf(text, "side")
    expect(ops.map((o) => o.kind)).toEqual(["drill", "contour"])
    expect(notes.join(" ")).toMatch(/contorn de la peça/)
    // Només el contorn: és la peça, no es talla.
    const alone = machiningFromDxf(dxf([{ poly: rect(0, 0, 500, 300), closed: true, layer: "CONTOUR" }]), "side")
    expect(alone.ops).toEqual([])
  })

  it("el que no és de la convenció es diu a les notes", () => {
    const text = dxf([
      { poly: [[0, 0], [100, 50]], layer: "GROOVE_W8_P10" },
      { poly: [[0, 0], [100, 0], [50, 80]], closed: true, layer: "POCKET_P5" },
      { circle: [0, 0, 4], layer: "DRILL_H_D8_P30" },
      { circle: [0, 0, 4], layer: "VISTA" },
    ])
    const { ops, notes } = machiningFromDxf(text, "front")
    expect(ops).toEqual([])
    expect(notes.join(" ")).toMatch(/diagonal/)
    expect(notes.join(" ")).toMatch(/no són un rectangle/)
    expect(notes.join(" ")).toMatch(/cantell/)
    expect(hasMachiningLayers(readDxf(dxf([{ circle: [0, 0, 4], layer: "VISTA" }])))).toBe(false)
  })
})

describe("validació del generador", () => {
  const base: GenOp = { id: "a", part: "top", kind: "drill", face: "A", d: 5, depth: 12, p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 } }
  const tools = [
    { code: "B5", kind: "drill", diameter: 5, maxDepth: 30 },
    { code: "F8", kind: "router", diameter: 8, maxDepth: 25 },
    { code: "F12", kind: "router", diameter: 12, maxDepth: 40 },
  ]
  it("operacions bones", () => {
    expect(machiningProblems([base, { ...base, id: "b", kind: "groove", w: 8, full: true, along: "p", tool: "F8", d: undefined }], tools)).toEqual([])
  })
  it("problemes: mides, cantell, contorn cec que no és rectangle, ids repetits", () => {
    const msgs = (ops: GenOp[]) => machiningProblems(ops, tools).map((p) => p.message)
    expect(msgs([{ ...base, d: undefined }])).toEqual(["Falta el Ø."])
    expect(msgs([{ ...base, depth: 150 }])[0]).toMatch(/Fondària/)
    expect(msgs([{ ...base, kind: "groove", face: "edge", edge: "pmin", w: 8, len: 10, along: "p" }])[0]).toMatch(/cantell només/)
    expect(msgs([{ ...base, face: "edge" }])).toEqual(["Falta el cantell."])
    expect(msgs([{ ...base, kind: "groove", w: 8 }])).toEqual(["Falta la llargada.", "Falta cap on va la ranura."])
    expect(msgs([{ ...base, kind: "pocket", w: 20, h: 10, r: 6 }])[0]).toMatch(/mitja caixera/)
    expect(msgs([{ ...base, kind: "contour", points: [[0, 0], [10, 0], [5, 8]] }])[0]).toMatch(/rectangle/)
    expect(msgs([{ ...base, kind: "contour", through: true, points: [[0, 0], [10, 0], [5, 8]] }])).toEqual([])
    expect(msgs([{ ...base, kind: "contour", points: [[0, 0], [10, 0], [10, 5], [0, 5]] }])).toEqual([])
    expect(msgs([base, base])).toEqual(["Id repetit."])
  })
  it("eines: tipus, Ø, amplada i fondària útil", () => {
    const msgs = (op: Partial<GenOp>) => machiningProblems([{ ...base, ...op } as GenOp], tools).map((p) => p.message)
    expect(msgs({ tool: "B5" })).toEqual([])
    expect(msgs({ tool: "X" })[0]).toMatch(/no és a la màquina/)
    expect(msgs({ tool: "F8" })[0]).toMatch(/no és una broca/)
    expect(msgs({ tool: "B5", d: 8 })[0]).toMatch(/fa Ø5/)
    expect(msgs({ tool: "B5", depth: 35 })[0]).toMatch(/només arriba a 30/)
    expect(msgs({ kind: "groove", w: 8, full: true, along: "p", tool: "F12", d: undefined })[0]).toMatch(/no hi cap/)
    expect(msgs({ kind: "pocket", w: 40, h: 30, r: 3, tool: "F12", d: undefined })[0]).toMatch(/radi 6/)
    // Una passant no compta la fondària.
    expect(msgs({ kind: "groove", w: 8, full: true, along: "p", tool: "F8", through: true, depth: 50, d: undefined })).toEqual([])
  })
})
