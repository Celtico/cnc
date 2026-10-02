import { beforeAll, describe, expect, it } from "vitest"
import { cncNestOptions, toMaestroNestXcs } from "../export/maestroNestXcs"
import { machineFromContext } from "../machine/maestro"
import { bytes, read } from "../machine/testContext"
import type { Machine, Panel } from "../model"
import { nestPlan } from "./machineNest"
import { DEFAULT_NEST_OPTIONS, nest, type NestOptions } from "./nest"

let M: Machine
beforeAll(async () => {
  M = (
    await machineFromContext(
      { tlgx: read("Tlgx/def.tlgx"), atrx: read("Atrx/def.atrx"), cfgx: bytes("Cfgx/AA10008021.cfgx"), header: read("Settings/XilogHeaderParameters.xml"), serial: "AA10008021" },
      "m",
    )
  ).machine
})

const PLACEMENT = { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 1] } as Panel["placement"]
const panel = (i: number, thickness = 19): Panel => ({
  id: `p${i}`,
  name: "prestatge",
  label: `Peça ${i}`,
  role: "shelf",
  length: 600 + i * 37,
  width: 300 + (i % 4) * 41,
  thickness,
  material: "Melamina blanca",
  grain: "none",
  edges: { left: false, right: false, bottom: false, top: false },
  holes: [],
  grooves: [],
  module: 1,
  placement: PLACEMENT,
})

const BASE: NestOptions = { ...DEFAULT_NEST_OPTIONS, kerf: 4, margin: 25, sheetsByMaterial: { "Melamina blanca": { w: 2440, h: 1220 } } }

describe("nestPlan: el nesting de la màquina", () => {
  it("sense màquina: les opcions del projecte, tal qual", () => {
    expect(nestPlan([panel(1)], BASE, undefined)).toEqual({ options: BASE })
  })

  it("amb màquina: separació i marge dels programes per tauler; taulers i veta del projecte", () => {
    const panels = [panel(1), panel(2, 30)]
    const plan = nestPlan(panels, BASE, M)
    const cnc = cncNestOptions(panels, M, BASE)
    expect(plan.machine).toBe(M)
    expect(plan.tool).toBe(cnc.tool)
    expect(plan.options.kerf).toBe(cnc.spacing)
    expect(plan.options.margin).toBe(M.nesting?.edgeTrim ?? 10)
    expect(plan.options.sheet).toEqual(BASE.sheet)
    expect(plan.options.sheetsByMaterial).toEqual(BASE.sheetsByMaterial)
  })

  it("la pantalla Nesting, el CSV i els .xcs surten del mateix nesting", () => {
    const panels = Array.from({ length: 14 }, (_, i) => panel(i))
    const screen = nest(panels, nestPlan(panels, BASE, M).options)
    // El que fa Exportar per als .xcs.
    const xcs = toMaestroNestXcs(panels, nest(panels, cncNestOptions(panels, M, BASE).options), M, { project: "t" })
    expect(xcs.sheets.map((s) => s.parts.map((p) => [p.panelId, p.x, p.y, p.angle]))).toEqual(
      screen.boards.map((b) => b.placements.map((p) => [p.panelId, p.x, p.y, p.angle])),
    )
  })
})
