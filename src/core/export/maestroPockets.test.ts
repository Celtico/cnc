import { beforeAll, describe, expect, it } from "vitest"
import { machineFromContext } from "../machine/maestro"
import { bytes, read } from "../machine/testContext"
import type { Machine, Panel, Pocket } from "../model"
import { panelXcs } from "./maestroXcs"
import { parseXcsPreview } from "./xcsPreview"

/** Buidats de qualsevol forma al programa (per decisió de l'usuari, 2026-10-17). */
let M: Machine
beforeAll(async () => {
  M = (await machineFromContext({ tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" }, "m")).machine
})

const panel = (pockets: Pocket[]): Panel => ({
  id: "p1",
  name: "sobre",
  label: "Sobre",
  role: "part",
  length: 800,
  width: 500,
  thickness: 60,
  material: "Corian blanc",
  grain: "none",
  edges: { left: false, right: false, bottom: false, top: false },
  holes: [],
  grooves: [],
  pockets,
  placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 1] },
})
const oval: Pocket["points"] = [[300, 150, 1], [500, 150, 0], [500, 350, 1], [300, 350, 0]]

describe("buidats al programa de Maestro", () => {
  it("de fons pla: una caixera sobre el contorn (amb els arcs)", () => {
    const r = panelXcs(panel([{ points: oval, depth: 12, face: "A" }]), "A.1.P.1", M)
    const text = r.programs[0]!.text
    expect(text).toContain("CreateContourPocket(")
    expect(text).toMatch(/AddArc|bulge|Arc/i)
    expect(r.ops.filter((o) => o.kind === "pocket")).toHaveLength(1)
    expect(r.skipped).toBe(0)
  })

  it("amb el fons arrodonit (una pica): desbast i acabat amb recorreguts 3D que la vista CAM llegeix", () => {
    const r = panelXcs(panel([{ points: oval, depth: 25, face: "A", round: 20 }]), "A.1.P.1", M)
    const text = r.programs[0]!.text
    expect(text).toContain("CreateToolpath(")
    expect(r.skipped).toBe(0)
    // Sense fresa esfèrica a la màquina: s'avisa i l'acabat es fa amb una plana.
    expect(r.warnings.some((w) => w.includes("sense fresa esfèrica"))).toBe(true)
    const prev = parseXcsPreview(text)
    const tp = prev.ops.filter((o) => o.toolpath)
    expect(tp.length).toBeGreaterThan(1)
    expect(Math.max(...tp.map((o) => o.depth))).toBeCloseTo(25, 0)
    expect(prev.unknown).toBe(0)
  })

  it("amb una fresa esfèrica marcada, l'acabat la fa servir (comentari d'eina esfèrica)", () => {
    const tools = [...M.tools, { code: "BOLA10", name: "bola 10", kind: "router" as const, diameter: 10, maxDepth: 60, mounted: true, auto: true, ball: true }]
    const r = panelXcs(panel([{ points: oval, depth: 30, face: "A", round: 20 }]), "A.1.P.1", { ...M, tools })
    expect(r.warnings.some((w) => w.includes("sense fresa esfèrica"))).toBe(false)
    const prev = parseXcsPreview(r.programs[0]!.text)
    expect(prev.ops.some((o) => o.ball && o.tool === "BOLA10")).toBe(true)
  })

  it("a la cara B: al programa «Volt», amb la peça girada", () => {
    const r = panelXcs(panel([{ points: oval, depth: 10, face: "B" }]), "A.1.P.1", M)
    expect(r.programs.map((p) => p.face)).toEqual(["B"])
  })
})
