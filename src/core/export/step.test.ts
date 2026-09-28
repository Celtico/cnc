import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { buildModule } from "../build/buildModule"
import { DEFAULT_CABINET, DEFAULT_GRILLE, cabinetToComposition, cabinetToModule, defaultModule, type Panel } from "../model"
import { stepReal, stepString, tallerEdgeNumbers, toStep } from "./step"
import { readStepEntities, stepSolids } from "./stepRead"

const sortedSize = (min: number[], max: number[]) => [0, 1, 2].map((k) => Math.round((max[k]! - min[k]!) * 100) / 100).sort((a, b) => b - a)

describe("toStep · mòdul 600×720×560 amb 1 prestatge i 1 porta", () => {
  const panels = buildComposition(cabinetToComposition(DEFAULT_CABINET)).panels
  const step = toStep(panels, { name: "Prova", date: "2026-01-01T00:00:00" })
  const solids = stepSolids(step.text)

  it("capçalera AP214 en mm i un sòlid per peça amb el seu nom", () => {
    expect(step.text.startsWith("ISO-10303-21;\r\nHEADER;")).toBe(true)
    expect(step.text).toContain("AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }")
    expect(step.text).toContain("SI_UNIT(.MILLI.,.METRE.)")
    expect(step.text.trimEnd().endsWith("END-ISO-10303-21;")).toBe(true)
    expect(solids).toHaveLength(panels.length)
    expect(solids.map((s) => s.name).sort()).toEqual(panels.map((p) => p.name).sort())
    expect(step.warnings).toEqual([])
  })

  it("cada sòlid té la caixa de la peça i el shell és tancat (cada aresta en dues cares)", () => {
    for (const s of solids) {
      const p = panels.find((x) => x.name === s.name)!
      expect(sortedSize(s.min, s.max)).toEqual([p.length, p.width, p.thickness].sort((a, b) => b - a))
      expect(s.badEdges).toBe(0)
      expect(s.faces).toBeGreaterThanOrEqual(6)
    }
  })

  it("eixos del taller: X amplada, Y fondària, Z amunt", () => {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (const s of solids)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k]!, s.min[k]!)
        max[k] = Math.max(max[k]!, s.max[k]!)
      }
    expect(max[0]! - min[0]!).toBeCloseTo(600 + 2 * 2 - 2 * 2 + 0, 0) // amplada (porta dins del cos)
    expect(max[2]! - min[2]!).toBeCloseTo(720, 0) // alçada en Z
    expect(max[1]! - min[1]!).toBeCloseTo(560 + 19, 0) // fondària en Y (porta sobreposada)
  })

  it("els forats surten com a cilindres: dos semicares per forat", () => {
    for (const s of solids) {
      const p = panels.find((x) => x.name === s.name)!
      const circles = (p.cutouts ?? []).filter((c) => c.kind === "circle").length
      const slots = (p.cutouts ?? []).filter((c) => c.kind === "slot").length
      expect(s.cylinders).toBe(2 * (p.holes.length + circles + slots))
    }
  })

  it("la ranura del fons és una cara plana a fondària intermèdia", () => {
    const ents = readStepEntities(step.text)
    const side = solids.find((s) => s.name === "lat e")!
    // Plans del sòlid amb normal en Z local (gruix): X del taller per a un lateral.
    const shell = ents.get(ents.get(side.id)!.refs[0]!)!
    let intermediate = 0
    for (const f of shell.refs) {
      const face = ents.get(f)!
      const surf = ents.get(face.refs[face.refs.length - 1]!)!
      if (surf.type !== "PLANE") continue
      const ap = ents.get(surf.refs[0]!)!
      const loc = ents.get(ap.refs[0]!)!.nums
      const dir = ents.get(ap.refs[1]!)!.nums
      if (Math.abs(dir[0]!) > 0.9 && loc[0]! > side.min[0]! + 0.4 && loc[0]! < side.max[0]! - 0.4) intermediate += 1
    }
    // Fons de la ranura + fons dels forats de cara (espigues i System 32).
    const side3d = panels.find((p) => p.name === "lat e")!
    expect(intermediate).toBe(1 + side3d.holes.filter((h) => h.face !== "edge").length)
  })
})

describe("toStep · talls passants i ranures que arriben al cantell", () => {
  it("reixeta a la tapa i passacables: shell tancat i cap avís", () => {
    const m = defaultModule("m", "Reixa", { width: 790, height: 400, depth: 420, top: { kind: "grille", pattern: DEFAULT_GRILLE } })
    m.extras.cableHoles.push({ panel: "back", x: 395, y: 200, diameter: 60 })
    const { panels } = buildModule(m)
    const top = panels.find((p) => p.role === "top")!
    expect(top.cutouts?.length ?? 0).toBeGreaterThan(5)
    const step = toStep(panels, { name: "Reixa" })
    expect(step.warnings).toEqual([])
    for (const s of stepSolids(step.text)) expect(s.badEdges).toBe(0)
  })

  it("calaixera: ranures de tota la llargada als laterals del calaix", () => {
    const m = defaultModule("m", "Calaixera", { width: 600, height: 800, depth: 500 })
    m.root = { id: "root", front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } }
    const { panels } = buildModule(m)
    const step = toStep(panels, { name: "Calaixera" })
    expect(step.warnings).toEqual([])
    const solids = stepSolids(step.text)
    expect(solids).toHaveLength(panels.length)
    for (const s of solids) expect(s.badEdges).toBe(0)
  })

  it("un forat que surt de la peça no es modela i avisa", () => {
    const base: Panel = buildModule(cabinetToModule(DEFAULT_CABINET)).panels.find((p) => p.role === "shelf")!
    const bad: Panel = { ...base, holes: [{ x: 2, y: 2, diameter: 10, depth: 5, face: "A" }] }
    const step = toStep([bad], { name: "x" })
    expect(step.warnings).toHaveLength(1)
    expect(stepSolids(step.text)[0]!.badEdges).toBe(0)
  })
})

describe("format", () => {
  it("reals amb punt i sense exponent", () => {
    expect(stepReal(19)).toBe("19.")
    expect(stepReal(22.5)).toBe("22.5")
    expect(stepReal(-0.00001)).toBe("0.")
    expect(stepReal(1234.56789)).toBe("1234.5679")
  })
  it("cadenes: cometes dobles i accents en \\X2\\", () => {
    expect(stepString("l'armari")).toBe("l''armari")
    expect(stepString("Sòcol")).toBe("S\\X2\\00F2\\X0\\col")
  })
})

describe("tallerEdgeNumbers", () => {
  it("lateral esquerre: x local (alçada) és Z del taller, cap amunt", () => {
    const panels = buildModule(cabinetToModule(DEFAULT_CABINET)).panels
    const left = panels.find((p) => p.id === "side-left")!
    // x local → Z amunt (u màxim = dalt = 2), y local → Y del taller cap al darrere.
    const n = tallerEdgeNumbers(left)
    expect(n.left).toBe(4)
    expect(n.right).toBe(2)
    expect(new Set([n.top, n.bottom])).toEqual(new Set([1, 3]))
    const right = panels.find((p) => p.id === "side-right")!
    expect(tallerEdgeNumbers(right).right).toBe(2)
  })
})
