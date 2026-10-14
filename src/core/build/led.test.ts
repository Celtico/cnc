import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, defaultModule, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { materialIssues } from "./materialIssues"

const mod = (root: Omit<Zone, "id">) => ({ ...defaultModule("m", "Vitrina", { width: 800, height: 1200, depth: 400 }), root: { id: "z", ...root } })

describe("llum LED (`Zone.led`)", () => {
  it("una tira sota el sostre del compartiment i una sota cada prestatge, fora del nesting", () => {
    const b = buildModule(mod({ shelves: { n: 2, adjustable: false }, led: {} }))
    const leds = b.extras.filter((p) => p.label === "Tira LED")
    expect(leds).toHaveLength(3)
    expect(b.panels.some((p) => p.label === "Tira LED")).toBe(false)
    // Llarg: la llum del compartiment menys 10 mm a cada costat.
    expect(leds.every((p) => p.length === 800 - 2 * 19 - 20 && p.material === "Tira LED")).toBe(true)
    // Cada una just a sota d'un prestatge o del sostre: les y són diferents.
    expect(new Set(leds.map((p) => p.placement.origin[1])).size).toBe(3)
    // «Tira LED» és a les preferències: cap avís de material.
    expect(materialIssues({ panels: b.panels, extras: b.extras }, { references: [] }, DEFAULT_SETTINGS.materials)).toEqual([])
  })
  it("res amagat compta: amb calaixos o dividit, cap tira", () => {
    expect(buildModule(mod({ led: {}, front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } })).extras.filter((p) => p.label === "Tira LED")).toHaveLength(0)
    expect(buildModule(mod({ led: {}, split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b" }] } })).extras.filter((p) => p.label === "Tira LED")).toHaveLength(0)
  })
})

describe("porta de vidre amb marc (`glass`)", () => {
  it("cap porta de tauler: quatre perfils d'alumini i un vidre, fora del nesting", () => {
    const b = buildModule(mod({ shelves: { n: 2, adjustable: true }, front: { kind: "door", mode: "double", hinge: "left", glass: true } }))
    expect(b.panels.some((p) => p.role === "door")).toBe(false)
    const glass = b.extras.filter((p) => p.material === "Vidre")
    const frame = b.extras.filter((p) => p.material === "Alumini negre")
    expect(glass).toHaveLength(2)
    expect(frame).toHaveLength(8)
    expect(materialIssues({ panels: b.panels, extras: b.extras }, { references: [] }, DEFAULT_SETTINGS.materials)).toEqual([])
  })
  it("sense vidre, les portes de sempre", () => {
    const b = buildModule(mod({ front: { kind: "door", mode: "single", hinge: "left", glass: false } }))
    expect(b.panels.filter((p) => p.role === "door")).toHaveLength(1)
  })
})

describe("abatible de vidre amb marc (`glass`)", () => {
  it("cap abatible de tauler ni forats del braç: el marc i el vidre fora del nesting; res amagat compta", () => {
    const b = buildModule(mod({ front: { kind: "flap", dir: "up", glass: true } }))
    expect(b.panels.some((p) => p.role === "flap")).toBe(false)
    expect(b.extras.filter((p) => p.name === "perfil vitrina")).toHaveLength(4)
    expect(b.extras.some((p) => p.name === "vidre vitrina")).toBe(true)
    expect(b.panels.flatMap((p) => p.holes).some((h) => h.tag === "flap")).toBe(false)
    // Sense vidre, el marc triat no compta (el mateix abatible de sempre).
    const plain = buildModule(mod({ front: { kind: "flap", dir: "up" } }))
    const withFrame = buildModule(mod({ front: { kind: "flap", dir: "up", frame: { ...DEFAULT_SETTINGS.hardwareLibrary.find((x) => x.engine === "glassFrame")!, params: { frame: 40, glass: 6 } } } }))
    expect(withFrame.panels).toEqual(plain.panels)
    expect(plain.panels.some((p) => p.role === "flap")).toBe(true)
  })
})

