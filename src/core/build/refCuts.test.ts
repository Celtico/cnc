import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type RefObject } from "../model"
import { buildModule } from "./buildModule"
import { buildComposition, panelBox } from "./buildComposition"
import { migrateCableHoles } from "./refCuts"
import { toStep } from "../export/step"
import { stepSolids } from "../export/stepRead"
import { toWorld } from "./geometry"

const m = { ...defaultModule("m", "x", { width: 800, height: 700, depth: 400, back: "screwed" }), gapBefore: 0 }
const comp = (...refs: RefObject[]): Composition => ({ modules: [m], references: refs })
const back = (c: Composition) => buildComposition(c).panels.find((p) => p.role === "back")!

describe("objectes que tallen", () => {
  it("un cilindre cap a la paret fa un forat rodó al fons, al centre de l'objecte", () => {
    const c = comp({ id: "t", name: "Tub", w: 60, h: 60, d: 40, x: 370, y: 320, z: -10, effect: "cut", shape: "cylinder", axis: "z" })
    const b = buildComposition(c)
    const bk = b.panels.find((p) => p.role === "back")!
    expect(bk.cutouts).toHaveLength(1)
    const h = bk.cutouts![0]!
    expect(h.kind).toBe("circle")
    if (h.kind !== "circle") return
    expect(h.diameter).toBe(60)
    const w = toWorld(bk, [h.x, h.y, 0])
    expect(w[0]).toBeCloseTo(400, 0)
    expect(w[1]).toBeCloseTo(350, 0)
    // Cap altra peça tocada, cap avís, i el STEP és net.
    expect(b.panels.filter((p) => p.cutouts?.length)).toHaveLength(1)
    expect(b.warnings).toEqual([])
    const step = toStep(b.panels, { name: "t" })
    expect(step.warnings).toEqual([])
    for (const s of stepSolids(step.text)) expect(s.badEdges).toBe(0)
  })

  it("una caixa fa un forat rectangular; si toca la vora, avisa i no el fa", () => {
    const ok = back(comp({ id: "e", name: "Endoll", w: 80, h: 80, d: 40, x: 300, y: 300, z: -10, effect: "cut" }))
    expect(ok.cutouts?.[0]?.kind).toBe("rect")
    const edge = comp({ id: "e", name: "Endoll", w: 80, h: 80, d: 40, x: -20, y: 300, z: -10, effect: "cut" })
    const b = buildComposition(edge)
    expect(b.warnings.some((w) => w.code === "ref-cut" && w.refId === "e")).toBe(true)
    expect(b.panels.find((p) => p.role === "back")!.cutouts ?? []).toHaveLength(0)
  })

  it("un obstacle rodó no xoca per la cantonada de la seva caixa", () => {
    // Pilar Ø300 a tocar la cantonada davant-esquerra del mòdul: la caixa s'hi fica, el cercle no.
    const pillar: RefObject = { id: "p", name: "Pilar", w: 300, h: 2500, d: 300, x: -270, y: 0, z: 370, shape: "cylinder", axis: "y" }
    expect(buildComposition(comp(pillar)).warnings.some((w) => w.code === "collision")).toBe(false)
    expect(buildComposition(comp({ ...pillar, shape: undefined, axis: undefined })).warnings.some((w) => w.code === "collision")).toBe(true)
  })

  it("els passacables antics passen a objectes que tallen, al mateix lloc", () => {
    const old = { ...m, extras: { cableHoles: [{ panel: "back" as const, x: 400, y: 300, diameter: 60 }] } }
    const before = buildModule(old).panels.find((p) => p.role === "back")!.cutouts![0]!
    const c = migrateCableHoles({ modules: [old], references: [] }, panelBox)
    expect(c.modules[0]!.extras.cableHoles).toEqual([])
    expect(c.references).toHaveLength(1)
    expect(c.references[0]!.effect).toBe("cut")
    const after = back(c).cutouts![0]!
    expect(after.kind).toBe("circle")
    if (after.kind !== "circle" || before.kind !== "circle") return
    expect(after.x).toBeCloseTo(before.x, 0)
    expect(after.y).toBeCloseTo(before.y, 0)
    expect(after.diameter).toBe(60)
  })

  it("un desguàs vertical forada la base i els prestatges que travessa, no el fons", () => {
    const b = buildComposition(comp({ id: "d", name: "Desguàs", w: 50, h: 800, d: 50, x: 375, y: -50, z: 150, effect: "cut", shape: "cylinder", axis: "y" }))
    const cut = b.panels.filter((p) => p.cutouts?.length).map((p) => p.role)
    expect(cut).toContain("bottom")
    expect(cut).toContain("top")
    expect(cut).not.toContain("back")
  })
})
