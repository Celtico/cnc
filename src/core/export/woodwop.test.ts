import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { DEFAULT_CABINET, cabinetToComposition } from "../model"
import { listZip } from "../file/zip"
import { toWoodwop, woodwopZip } from "./woodwop"

const panels = buildComposition(cabinetToComposition({ ...DEFAULT_CABINET, doors: 2 })).panels
const made = panels.filter((p) => p.role !== "hardware")

describe("toWoodwop (.mpr)", () => {
  const x = toWoodwop(panels, "mpr", { project: "Prova" })
  it("un programa per peça (+ cara B si cal) i el LLEGEIX-ME", () => {
    expect(x.files.filter((f) => f.name.endsWith(".mpr")).length).toBe(made.length + x.faceB.length)
    expect(x.files.at(-1)!.name).toBe("LLEGEIX-ME.txt")
  })
  it("capçalera, peça, forats, perfilat i final", () => {
    const side = x.files.find((f) => f.name === "A.1.L.1.mpr")!.text
    expect(side.startsWith("[H\r\n")).toBe(true)
    expect(side).toContain("<100 \\WerkStck\\")
    expect(side).toContain("<102 \\BohrVert\\")
    expect(side).toContain("<105 \\Konturfraesen\\")
    expect(side.trimEnd().endsWith("!")).toBe(true)
    // X pel costat llarg.
    const p = made.find((q) => q.label === "Lateral esquerre")!
    expect(side).toContain(`_BSX=${Math.max(p.length, p.width).toFixed(6)}`)
  })
  it("els forats queden dins de la peça", () => {
    for (const f of x.files.filter((q) => q.name.endsWith(".mpr"))) {
      const L = Number(/_BSX=([\d.]+)/.exec(f.text)![1]), W = Number(/_BSY=([\d.]+)/.exec(f.text)![1])
      for (const m of f.text.matchAll(/<102 \\BohrVert\\\r\nXA="([-\d.]+)"\r\nYA="([-\d.]+)"/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(0)
        expect(Number(m[1])).toBeLessThanOrEqual(L)
        expect(Number(m[2])).toBeGreaterThanOrEqual(0)
        expect(Number(m[2])).toBeLessThanOrEqual(W)
      }
    }
  })
  it("el ZIP porta tots els fitxers", () => {
    expect(listZip(woodwopZip(x)).map((e) => e.name)).toEqual(x.files.map((f) => f.name))
  })
})

describe("toWoodwop (.hop)", () => {
  it("Fertigteil, broques i perfilat", () => {
    const x = toWoodwop(panels, "hop", { project: "Prova" })
    const t = x.files.find((f) => f.name.endsWith(".hop"))!.text
    expect(t).toContain("Fertigteil (DX,DY,DZ")
    expect(t).toContain(";$F$Perfilat")
    expect(t).toContain("CALL HH_Park")
  })
})
