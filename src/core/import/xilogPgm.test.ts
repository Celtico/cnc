import { describe, expect, it } from "vitest"
import { machiningProblems } from "../model"
import { isXilog, machiningFromXilog, readXilog, xilogRecords } from "./xilogPgm"

/** Un `.pgm` com els de Blum: capçalera binària, taules i els registres ASCII acabats en NUL entre bytes de control. */
function pgm(records: string[]): Uint8Array {
  const enc = (s: string) => [...s].map((c) => c.charCodeAt(0))
  const bytes: number[] = [...enc("BMB"), 0, 0, 0, 0, 0, 0, 0, 0x3e, 0, 0, 0, 0x28, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0xce, 0x0e, 0xff, 0xff, 0, 0, ...enc("Xilog3-9.0 "), 0, 8, 0, 2, 0]
  bytes.push(0x07, 0x61, 0x02, ...enc("DZVb"), 0, 0x69, 0, 0x10, 0x21, 0, 0x07, 0x61, 0x03, ...enc("FLDVc"), 0, 0x69, 0, ...enc("HCQ"), 0, 0xc8, ...enc("AiBAi"), 0, ...enc("defi"), 0, 0x51, 0, 0)
  for (const r of records) {
    bytes.push(0x51, 0, 0, 0x80, 0xc1, ...enc("XBOQ"), 0, 0x20, 0x41, 0x61, 0x01, ...enc("PS:"), 0, ...enc(r), 0, 0x01, 0x07, 0x10, 0x8e, 0)
  }
  bytes.push(0x07, 0x61, 0x01, ...enc("NQ"), 0, ...enc("S\t"), 0, ...enc("N X=0 Y=0"))
  return new Uint8Array(bytes)
}

const H = 'H DX=200 DY=100 DZ=19 BX=0 BY=0 -AB C=0 T=0 R=1 *MM /"def.tlg"'
const xbo = (x: number, y: number, z: number, d: number, extra = "") => `XBO X=${x} Y=${y} Z=${z} x=0 y=0 D=${d} R=1# F=1 C=0 K=0 P=0 N="P"${extra}`

describe("Xilog .pgm (Blum)", () => {
  it("llegeix la capçalera i els forats d'un binari com els de Blum (dues espigues Ø10 × 6 a ±16)", () => {
    const p = readXilog(pgm([H, xbo(0, -16, -6, 10), xbo(0, 16, -6, 10)]))
    expect(p.version).toBe("Xilog3-9.0")
    expect(p.header).toEqual({ dx: 200, dy: 100, dz: 19, bx: 0, by: 0 })
    expect(p.holes).toEqual([
      { x: 0, y: -16, depth: 6, d: 10, face: 1, through: false },
      { x: 0, y: 16, depth: 6, d: 10, face: 1, through: false },
    ])
    expect(p.warnings).toEqual([])
    expect(isXilog(p)).toBe(true)
  })

  it("els registres: claus amb majúscules i minúscules diferents, cometes i el # de R", () => {
    const [h, b] = xilogRecords(`\u0000${H}\u0000\u0001${xbo(1.5, -2, -3, 2.5)}\u0000`)
    expect(h!.name).toBe("H")
    expect(h!.params.DZ).toBe("19")
    expect(b!.params.X).toBe("1.5")
    expect(b!.params.x).toBe("0")
    expect(b!.params.R).toBe("1#")
    expect(b!.params.N).toBe('"P"')
  })

  it("text pla (una línia per registre) també", () => {
    const p = readXilog(`${H}\r\n${xbo(0, 0, -12, 25)}\r\nN X=0 Y=0\r\n`)
    expect(p.holes).toHaveLength(1)
    expect(p.holes[0]!.d).toBe(25)
  })

  it("passant si Z ≤ −DZ; repetició R amb pas; cares de cantell i de sota", () => {
    const p = readXilog(pgm([H, "XBO X=10 Y=0 Z=-19 x=0 y=0 D=8 R=1 F=1", "XBO X=0 Y=0 Z=-5 x=32 y=0 D=5 R=3 F=1", "XBO X=0 Y=20 Z=-30 D=8 F=3", "XBO X=5 Y=5 Z=-4 D=3 F=6"]))
    expect(p.holes[0]!.through).toBe(true)
    expect(p.holes.slice(1, 4).map((h) => h.x)).toEqual([0, 32, 64])
    const m = machiningFromXilog(p, "side")
    expect(m.ops[0]).toMatchObject({ kind: "drill", face: "A", through: true, d: 8 })
    const edge = m.ops.find((o) => o.face === "edge")!
    expect(edge).toMatchObject({ edge: "pmin", d: 8, depth: 30, q: { from: "ref", at: 20 } })
    expect(m.ops.at(-1)).toMatchObject({ face: "B", d: 3, depth: 4 })
    expect(m.notes.join(" ")).toMatch(/cantell/)
    expect(machiningProblems(m.ops)).toEqual([])
  })

  it("els forats passen a operacions exactes de la peça: X → P, Y → Q des del punt de referència", () => {
    const m = machiningFromXilog(pgm([H, xbo(0, -16, -6, 10), xbo(0, 16, -6, 10)]), "side", "t")
    expect(m.ops).toEqual([
      { id: "t-1", part: "side", kind: "drill", face: "A", p: { from: "ref", at: 0 }, q: { from: "ref", at: -16 }, d: 10, depth: 6 },
      { id: "t-2", part: "side", kind: "drill", face: "A", p: { from: "ref", at: 0 }, q: { from: "ref", at: 16 }, d: 10, depth: 6 },
    ])
    expect(m.notes).toEqual([])
  })

  it("fresats i registres desconeguts: avisos, mai llança", () => {
    const p = readXilog(pgm([H, "XG0 X=0 Y=0 Z=-5 T=101", "XL2P X=100 Y=0", "XA2P X=0 Y=0 I=5 J=5", "QQQ A=1", xbo(0, 0, -6, 10)]))
    expect(p.holes).toHaveLength(1)
    expect(p.unknown).toEqual({ XG0: 1, XL2P: 1, XA2P: 1, QQQ: 1 })
    expect(p.warnings.join(" ")).toMatch(/fresat.*XG0/)
    expect(p.warnings.join(" ")).toMatch(/QQQ desconegut/)
  })

  it("fitxers dolents: buit, sense fondària, cara estranya, brossa", () => {
    expect(readXilog(new Uint8Array()).holes).toEqual([])
    expect(readXilog(new Uint8Array(4096).map((_, i) => (i * 7919) % 256)).holes).toEqual([])
    const p = readXilog(pgm([H, "XBO X=0 Y=0 Z=5 D=8 F=1", "XBO X=0 Y=0 Z=-5 D=8 F=9", "XBO X=a Y=0 Z=-5 D=8", "XBO X=0 Y=0 Z=-5 D=0"]))
    expect(p.holes).toEqual([])
    expect(p.warnings).toHaveLength(4)
    expect(machiningFromXilog(p, "any").notes.join(" ")).toMatch(/cap forat/)
  })
})
