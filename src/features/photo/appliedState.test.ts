import { describe, expect, it } from "vitest"
import type { PhotoCalibration } from "../../db/db"
import { appliedWhich, estimatedApplied } from "./appliedState"

const ref: [number, number][] = [[100, 400], [397, 400], [397, 190], [100, 190]]
const rect: [number, number][] = [[500, 400], [900, 400], [900, 100], [500, 100]]
const cal = (applied: PhotoCalibration["applied"]): PhotoCalibration =>
  ({ photoId: 1, points: ref, ref: { w: 297, h: 210 }, measures: [{ id: "r", name: "R", kind: "rect", points: rect, tape: 400 }], applied, plane: "wall", focal35: 26, offset: [0, 0] }) as unknown as PhotoCalibration

describe("mesures aplicades", () => {
  it("rectangle amb cinta: l'amplada és real i l'alçada continua essent estimada", () => {
    expect(estimatedApplied(cal([{ measureId: "r", target: "module:a:width", label: "A · amplada", which: "main" }]))).toEqual([])
    expect(estimatedApplied(cal([{ measureId: "r", target: "module:a:height", label: "A · alçada (alçada)", which: "second" }]))).toEqual([{ label: "A · alçada (alçada)", state: "estimated" }])
  })
  it("les antigues sense `which`: per l'etiqueta", () => {
    expect(appliedWhich({ measureId: "r", target: "t", label: "A · alçada (alçada)" })).toBe("second")
    expect(appliedWhich({ measureId: "r", target: "t", label: "A · amplada" })).toBe("main")
    expect(estimatedApplied(cal([{ measureId: "r", target: "module:a:height", label: "A · alçada (alçada)" }]))).toHaveLength(1)
  })
})
