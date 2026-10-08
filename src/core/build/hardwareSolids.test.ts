import { describe, expect, it } from "vitest"
import { DEFAULT_HARDWARE_LIBRARY, type HardwareEngine, type Panel, type Vec3 } from "../model"
import { toWorld } from "./geometry"
import { hardwareMount } from "./hardwareMount"
import { builtinSolids, shelfPins, solidBox, type HwSolid } from "./hardwareSolids"

/**
 * El dibuix 3D dels ferratges de sèrie (`builtinSolids`) a «Com va muntat»: cada ferratge de l'app hi dibuixa alguna
 * cosa, al seu lloc (als seus forats o al seu accessori) i dins de la regió que enquadra la càmera.
 */
type Box = { min: Vec3; max: Vec3 }
const item = (engine: HardwareEngine) => DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === engine)!

function solidsOf(engine: HardwareEngine): { p: Panel; s: HwSolid; b: Box }[] {
  const m = hardwareMount(item(engine))
  const pins = shelfPins(m.panels)
  return m.panels.flatMap((p) => builtinSolids(p, pins.get(p.id)).map((s) => ({ p, s, b: solidBox(p, s) })))
}

/** La caixa d'una peça al mòdul (mm). */
function panelBox(p: Panel): Box {
  const cs = [0, p.length].flatMap((x) => [0, p.width].flatMap((y) => [0, p.thickness].map((z) => toWorld(p, [x, y, z]))))
  return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
}

const inside = (b: Box, r: Box) => [0, 1, 2].every((k) => b.min[k]! >= r.min[k]! - 0.5 && b.max[k]! <= r.max[k]! + 0.5)

describe("ferratges de sèrie en 3D", () => {
  it("cada ferratge de l'app (menys el tirador i el joc, que ja es veuen) dibuixa alguna cosa", () => {
    for (const e of ["cup", "system32", "dowel", "slide", "flapArm", "magnet", "rail", "ledProfile"] as const) expect(solidsOf(e).length, e).toBeGreaterThan(0)
  })

  it("frontissa: cassoleta al forat, braç i placa cap a dins del moble, metàl·lics", () => {
    const m = hardwareMount(item("cup"))
    const door = m.panels.find((p) => p.role === "door")!
    const ss = builtinSolids(door)
    const cups = door.holes.filter((h) => h.tag === "hinge")
    expect(ss.length).toBe(cups.length * 5)
    const cup = ss[0]!
    expect(cup.kind).toBe("cyl")
    expect(Math.hypot(cup.c[0] - cups[0]!.x, cup.c[1] - cups[0]!.y)).toBeLessThan(0.01)
    expect(ss.every((s) => s.mat === "nickel" || s.mat === "dark")).toBe(true)
    // La placa, cap a dins del moble (Z més petita que la cara de dins de la porta) i tocant el lateral.
    const plate = solidBox(door, ss[4]!)
    const back = panelBox(door).min[2]
    expect(plate.min[2]).toBeLessThan(back - 40)
    const side = panelBox(m.panels.find((p) => p.id === "side-left")!)
    // (Aproximat: el lateral es pren del gruix de la porta, sense el joc del cantell.)
    expect(Math.abs(plate.min[0] - side.max[0])).toBeLessThan(3)
  })

  it("System 32: un suport just sota el prestatge, a cada filera", () => {
    const m = hardwareMount(item("system32"))
    const side = m.panels.find((p) => p.id === "side-left")!
    expect(shelfPins(m.panels).get(side.id)?.length).toBe(2)
    const shelfBottom = panelBox(m.panels.find((p) => p.role === "shelf")!).min[1]
    // (El lateral també porta les espigues de la base i la tapa: aquí només els suports.)
    for (const { b } of solidsOf("system32").filter(({ s }) => s.mat === "nickel")) {
      expect(b.max[1]).toBeLessThanOrEqual(shelfBottom + 0.01)
      expect(shelfBottom - b.max[1]).toBeLessThan(32)
    }
  })

  it("guia: el cos al lateral, al llarg de la filera, de la llargada d'una guia", () => {
    const m = hardwareMount(item("slide"))
    const side = m.panels.find((p) => p.id === "side-left")!
    const ss = solidsOf("slide").filter(({ p, s }) => p.id === side.id && s.mat === "steel")
    expect(ss.length).toBe(1)
    const b = ss[0]!.b
    expect(b.max[2] - b.min[2]).toBeGreaterThanOrEqual(250)
    // Comença a prop del davant del lateral (el davant del moble és Z gran).
    expect(panelBox(side).max[2] - b.max[2]).toBeLessThan(10)
  })

  it("espiga: de faig, la resta fora de la cara", () => {
    const ss = solidsOf("dowel")
    expect(ss.length).toBeGreaterThan(0)
    expect(ss.every(({ s }) => s.mat === "beech" && s.kind === "cyl" && s.h >= 30)).toBe(true)
  })

  it("els d'un sol tros (guia, braç, barra, LED) són sencers dins de la regió que enquadra la càmera", () => {
    for (const e of ["slide", "flapArm", "rail", "ledProfile"] as const) {
      const m = hardwareMount(item(e))
      // (Les espigues de la caixa que porten les peces del muntatge no són del ferratge.)
      for (const { p, s, b } of solidsOf(e)) if (s.mat !== "beech") expect(inside(b, m.region), `${e} ${p.id}`).toBe(true)
    }
  })

  it("els que es repeteixen (frontissa, suport, imant): el del forat principal, dins de la regió", () => {
    for (const e of ["cup", "system32", "magnet"] as const) {
      const m = hardwareMount(item(e))
      const at = m.focus!.at
      const mid = (b: Box): Vec3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
      const near = solidsOf(e).filter(({ b }) => Math.hypot(...mid(b).map((v, k) => v - at[k]!)) < 80)
      expect(near.length, e).toBeGreaterThan(0)
      for (const { p, b } of near) expect(inside(b, m.region), `${e} ${p.id}`).toBe(true)
    }
  })

  it("res a les peces que no en porten (el prestatge)", () => {
    const m = hardwareMount(item("system32"))
    expect(builtinSolids(m.panels.find((p) => p.role === "shelf")!)).toEqual([])
  })

  it("push: el Tip-On darrere d'un front sense tirador", () => {
    const door = hardwareMount(item("cup")).panels.find((p) => p.role === "door")!
    expect(builtinSolids({ ...door, push: true }).filter((s) => s.mat === "plastic").length).toBe(1)
  })
})
