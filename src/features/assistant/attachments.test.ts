import { describe, expect, it } from "vitest"
import { attachKind, MAX_TEXT_CHARS, textAttachment } from "./attachments"

describe("adjunts del xat", () => {
  it("reconeix imatges, PDF i text pel tipus o per l'extensió", () => {
    expect(attachKind({ name: "planol.jpg", type: "image/jpeg" })).toBe("image")
    expect(attachKind({ name: "cataleg.pdf", type: "application/pdf" })).toBe("pdf")
    expect(attachKind({ name: "cataleg.PDF", type: "" })).toBe("pdf")
    expect(attachKind({ name: "peces.csv", type: "text/csv" })).toBe("text")
    expect(attachKind({ name: "lateral.xcs", type: "" })).toBe("text")
    expect(attachKind({ name: "dades.json", type: "application/json" })).toBe("text")
  })
  it("rebutja la resta", () => {
    expect(attachKind({ name: "model.glb", type: "model/gltf-binary" })).toBeNull()
    expect(attachKind({ name: "full.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).toBeNull()
  })
  it("posa el nom al text i talla el que és massa llarg", () => {
    expect(textAttachment("a.txt", "hola")).toBe("Fitxer adjunt «a.txt»:\n\nhola")
    const long = textAttachment("b.txt", "x".repeat(MAX_TEXT_CHARS + 10))
    expect(long).toContain("tallat")
    expect(long.endsWith("x".repeat(10))).toBe(true)
    expect(long.length).toBeLessThan(MAX_TEXT_CHARS + 100)
  })
})
