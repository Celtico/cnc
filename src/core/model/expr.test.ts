import { describe, expect, it } from "vitest"
import { evalExpr, exprError, tryExpr } from "./expr"

describe("avaluador d'expressions dels ferratges (sense eval)", () => {
  const v = { T: 19, L: 720, W: 400, H: 720, cupOffset: 22.5, pitch: 128 }

  it("números i variables", () => {
    expect(evalExpr(35, v)).toBe(35)
    expect(evalExpr("12.5", v)).toBe(12.5)
    expect(evalExpr(".5", v)).toBe(0.5)
    expect(evalExpr("cupOffset", v)).toBe(22.5)
  })

  it("precedència, parèntesis i menys unari", () => {
    expect(evalExpr("T/2", v)).toBe(9.5)
    expect(evalExpr("H-100", v)).toBe(620)
    expect(evalExpr("1+2*3", v)).toBe(7)
    expect(evalExpr("(1+2)*3", v)).toBe(9)
    expect(evalExpr("-pitch/2", v)).toBe(-64)
    expect(evalExpr("pitch/2", v)).toBe(64)
    expect(evalExpr("--3", v)).toBe(3)
    expect(evalExpr(" L - 2 * 37 ", v)).toBe(646)
  })

  it("funcions permeses", () => {
    expect(evalExpr("min(22.5, W/4)", v)).toBe(22.5)
    expect(evalExpr("max(1, 2, 3)", v)).toBe(3)
    expect(evalExpr("abs(-4)", v)).toBe(4)
    expect(evalExpr("floor(2.7)+ceil(2.1)+round(2.5)", v)).toBe(8)
  })

  it("errors: variable o funció desconeguda, sintaxi, res d'objectes", () => {
    expect(() => evalExpr("X", v)).toThrow(/desconeguda/)
    expect(() => evalExpr("constructor", v)).toThrow(/desconeguda/)
    expect(() => evalExpr("__proto__", v)).toThrow(/desconeguda/)
    expect(() => evalExpr("alert(1)", v)).toThrow(/Funció desconeguda/)
    expect(() => evalExpr("toString(1)", v)).toThrow(/Funció desconeguda/)
    expect(() => evalExpr("1+", v)).toThrow()
    expect(() => evalExpr("(1", v)).toThrow(/Falta/)
    expect(() => evalExpr("1 2", v)).toThrow(/Sobra/)
    expect(() => evalExpr("a.b", { a: 1 })).toThrow()
    expect(() => evalExpr("1;2", v)).toThrow(/Caràcter/)
    expect(() => evalExpr("1/0", v)).toThrow(/número/)
    expect(() => evalExpr("abs(1, 2)", v)).toThrow(/arguments/)
    expect(tryExpr("nope", v)).toBeNaN()
    expect(exprError("T/2", v)).toBeNull()
    expect(exprError("T/", v)).not.toBeNull()
  })
})
