import { describe, expect, it } from "vitest"
// Només per als tests: les mostres reals (import dinàmic: el tsc de l'app no té els tipus de Node).
const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }
import { camSheetView } from "./camDrawing"
import { createHeightfield, heightAt, LOW_LIMITS, stampSegment, tintedAt } from "./camHeightfield"
import { advanceSim, buildSimProgram, DEFAULT_TOOL_D, opAt, pocketStrokes, SIM_FEED, stepOp, toolAt, type SimCursor } from "./camSim"

const sample = (f: string) => new TextDecoder().decode(new Uint8Array(readFileSync(`docs/maestro/samples/${f}`)))

/** Tauler de 600 × 400 × 19: un forat, una caixera i el contorn passant d'una peça de 200 × 100 a (100, 100). */
const MSL = [
  `CreateFinishedWorkpieceBox("T", 600, 400, 19);`,
  `SelectWorkplane("Top");`,
  `CreateDrill("A.1_Forat_1", 150, 150, 12, 8, "", TypeOfProcess.Drilling, "-1", "-1", 0, -1, -1, "P", 0, 2);`,
  `CreatePolyline("k", 220, 130);`,
  `AddSegmentToPolyline(270, 130);`,
  `AddSegmentToPolyline(270, 170);`,
  `AddSegmentToPolyline(220, 170);`,
  `ClosePolyline();`,
  `CreateContourPocket("A.1_Caixera_1", 6, "", TypeOfProcess.GeneralRouting, "E1", "-1", 0);`,
  `CreatePolyline("c", 100, 100);`,
  `AddSegmentToPolyline(300, 100);`,
  `AddSegmentToPolyline(300, 200);`,
  `AddSegmentToPolyline(100, 200);`,
  `ClosePolyline();`,
  `CreateContour("A.1_Contorn_1", 19.2, 1, 1, "contorn", TypeOfProcess.GeneralRouting, "E2", "-1", 0, -1, -1, -1, 1);`,
  `SelectWorkplane("Left");`,
  `CreateDrill("A.1_Forat_2", 50, 9.5, 20, 8, "", TypeOfProcess.Drilling, "-1", "-1", 0, -1, -1, "P", 0, 2);`,
].join("\n")

/** Comparar els bytes a mà (el `toEqual` d'un milió d'elements triga segons). */
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i])

const prog = () => buildSimProgram(camSheetView(MSL, undefined))

describe("programa de la simulació", () => {
  it("moviments seguits en el temps, en l'ordre del fitxer, i les operacions de cantell a part", () => {
    const p = prog()
    expect(p.ops.map((o) => o.n)).toEqual([1, 2, 3, 4])
    expect(p.ops.map((o) => o.shown)).toEqual([true, true, true, false])
    expect(p.side).toBe(1)
    for (let k = 1; k < p.moves.length; k++) {
      expect(p.moves[k]!.t0).toBeCloseTo(p.moves[k - 1]!.t1, 9)
      expect(p.moves[k]!.a).toEqual(p.moves[k - 1]!.b)
    }
    expect(p.total).toBeCloseTo(p.moves[p.moves.length - 1]!.t1, 9)
    // El forat: baixa 12 mm (de 5 sobre el tauler) a la velocitat de baixada.
    const plunge = p.moves.find((m) => m.op === 0 && m.kind === "cut")!
    expect(plunge.b).toEqual([150, 150, 7])
    expect(plunge.t1 - plunge.t0).toBeCloseTo(17 / SIM_FEED.plunge, 6)
    expect(plunge.r).toBe(4)
    // Sense la màquina, l'Ø de l'eina per defecte; el contorn passant deixa la peça solta.
    expect(p.ops[2]!.r).toBe(DEFAULT_TOOL_D / 2)
    expect(p.finished.map((f) => f.ref)).toEqual(["A.1"])
    expect(p.finished[0]!.t).toBeCloseTo(p.ops[2]!.t1, 6)
  })

  it("eina, operació en curs i salts d'operació", () => {
    const p = prog()
    expect(toolAt(p, 0).p).toEqual([0, 0, 49])
    const mid = (p.ops[1]!.t0 + p.ops[1]!.t1) / 2
    expect(opAt(p, mid)).toBe(1)
    expect(opAt(p, p.total + 1)).toBe(-1)
    expect(stepOp(p, mid, 1)).toBeCloseTo(p.ops[2]!.t0, 9)
    expect(stepOp(p, mid, -1)).toBeCloseTo(p.ops[1]!.t0, 9)
    expect(stepOp(p, p.ops[1]!.t0, -1)).toBeCloseTo(p.ops[0]!.t0, 9)
    expect(stepOp(p, p.ops[2]!.t0 + 1e-3, 1)).toBe(p.total)
  })

  it("caixera: zig-zag dins del polígon i el contorn al final", () => {
    const sq: [number, number][] = [
      [0, 0],
      [40, 0],
      [40, 20],
      [0, 20],
    ]
    const s = pocketStrokes(sq, 6)
    // Un sol tram en zig-zag (rectangle: no cal aixecar) i el contorn tancat.
    expect(s).toHaveLength(2)
    expect(s[0]!.length).toBeGreaterThanOrEqual(8)
    for (const q of s[0]!) {
      expect(q[0]).toBeGreaterThanOrEqual(-1e-9)
      expect(q[0]).toBeLessThanOrEqual(40 + 1e-9)
    }
    expect(s[1]![0]).toEqual(s[1]![s[1]!.length - 1])
  })

  it("fresats en diverses passades: d'anada i tornada fins a la fondària", () => {
    const text = [`CreateFinishedWorkpieceBox("T", 300, 200, 19);`, `CreateSegment("s", 50, 100, 250, 100);`, `CreateBidirectionalMillingStrategy(true, 4, 0);`, `CreateSlot("A.1_Ranura_1", 10, "", TypeOfProcess.GeneralRouting, "E1", "-1", 0);`].join("\n")
    const p = buildSimProgram(camSheetView(text, undefined))
    const cuts = p.moves.filter((m) => m.kind === "cut" && Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) > 1)
    expect(cuts.map((m) => +(19 - m.b[2]).toFixed(3))).toEqual([3.333, 6.667, 10])
    expect(cuts.map((m) => m.b[0])).toEqual([250, 50, 250])
  })
})

describe("mapa d'alçades", () => {
  it("mida de cel·la adaptada i limitada", () => {
    const big = createHeightfield(2800, 2070, 19)
    // Ordinador: cel·les d'1 mm en un tauler de 2800 (abans 2,3: els forats sortien pixelats).
    expect(big.nx * big.ny).toBeLessThanOrEqual(6_000_000)
    expect(big.cell).toBe(1)
    expect(createHeightfield(5600, 2070, 19).nx * createHeightfield(5600, 2070, 19).ny).toBeLessThanOrEqual(6_000_000)
    const low = createHeightfield(2800, 2070, 19, LOW_LIMITS)
    expect(low.nx * low.ny).toBeLessThanOrEqual(600_000)
    const small = createHeightfield(300, 100, 19)
    expect(small.cell).toBe(1)
    expect([small.nx, small.ny]).toEqual([300, 100])
  })

  it("escombrada d'una fresa: a la fondària dins del radi, intacte fora; rampa exacta", () => {
    const hf = createHeightfield(200, 100, 19)
    stampSegment(hf, [20, 50, 10], [180, 50, 10], 6)
    expect(heightAt(hf, 100, 50)).toBeCloseTo(10, 1)
    expect(heightAt(hf, 100, 55)).toBeCloseTo(10, 1)
    expect(heightAt(hf, 100, 57)).toBe(19)
    expect(heightAt(hf, 15, 50)).toBeCloseTo(10, 1)
    expect(heightAt(hf, 10, 50)).toBe(19)
    // Rampa de 19 a 0: a mig camí, 9,5; al final, passant.
    const r = createHeightfield(200, 100, 19)
    stampSegment(r, [0, 50.5, 19], [200, 50.5, 0], 0.4)
    expect(heightAt(r, 100.5, 50.5)).toBeCloseTo(9.5, 0)
    expect(heightAt(r, 199.5, 50.5)).toBe(0)
  })

  it("programa sencer: forat, caixera, contorn passant i peça acabada", () => {
    const p = prog()
    const hf = createHeightfield(p.L, p.W, p.T)
    const cur: SimCursor = { t: 0, fin: 0 }
    advanceSim(hf, p, cur, p.total)
    expect(heightAt(hf, 150, 150)).toBeCloseTo(7, 0)
    expect(heightAt(hf, 245, 150)).toBeCloseTo(13, 0)
    // El contorn per fora: el centre de l'eina a 5 mm de la peça, passant.
    expect(heightAt(hf, 200, 95)).toBe(0)
    expect(heightAt(hf, 200, 120)).toBe(19)
    expect(heightAt(hf, 500, 300)).toBe(19)
    expect(tintedAt(hf, 200, 120)).toBe(true)
    expect(tintedAt(hf, 500, 300)).toBe(false)
  })

  it("a trossos fa el mateix que d'un cop; tornar enrere ho refà de zero", () => {
    const p = prog()
    const once = createHeightfield(p.L, p.W, p.T)
    advanceSim(once, p, { t: 0, fin: 0 }, p.total)
    const steps = createHeightfield(p.L, p.W, p.T)
    const cur: SimCursor = { t: 0, fin: 0 }
    for (let k = 1; k <= 37; k++) expect(advanceSim(steps, p, cur, (p.total * k) / 37)).toBe(false)
    expect(sameBytes(steps.data, once.data)).toBe(true)
    // Enrere fins a mig contorn i endavant fins al final.
    const half = (p.ops[2]!.t0 + p.ops[2]!.t1) / 2
    expect(advanceSim(steps, p, cur, half)).toBe(true)
    expect(tintedAt(steps, 200, 120)).toBe(false)
    advanceSim(steps, p, cur, p.total)
    expect(sameBytes(steps.data, once.data)).toBe(true)
  })

  it("el programa real del nesting es simula sencer (totes les peces acabades)", () => {
    const p = buildSimProgram(camSheetView(sample("nesting_T01.xcs"), undefined))
    expect(p.total).toBeGreaterThan(60)
    expect(p.finished.length).toBeGreaterThan(0)
    const hf = createHeightfield(p.L, p.W, p.T, LOW_LIMITS)
    advanceSim(hf, p, { t: 0, fin: 0 }, p.total)
    let through = 0
    for (let k = 0; k < hf.data.length; k += 4) if (hf.data[k] === 0) through++
    expect(through).toBeGreaterThan(1000)
  })
})
