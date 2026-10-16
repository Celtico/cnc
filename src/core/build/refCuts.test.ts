import { describe, expect, it } from "vitest"
import { defaultModule, pointInPolygon, type Composition, type RefObject } from "../model"
import { buildModule } from "./buildModule"
import { buildComposition } from "./buildComposition"
import { panelBox } from "./geometry"
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

  it("una caixa fa un forat rectangular; si toca la vora, la peça es retalla (osca), sense avís", () => {
    const ok = back(comp({ id: "e", name: "Endoll", w: 80, h: 80, d: 40, x: 300, y: 300, z: -10, effect: "cut" }))
    expect(ok.cutouts?.[0]?.kind).toBe("rect")
    const edge = comp({ id: "e", name: "Endoll", w: 80, h: 80, d: 40, x: -20, y: 300, z: -10, effect: "cut" })
    const b = buildComposition(edge)
    expect(b.warnings.some((w) => w.code === "ref-cut" && w.refId === "e")).toBe(false)
    const bk = b.panels.find((p) => p.role === "back")!
    expect(bk.cutouts ?? []).toHaveLength(0)
    expect(bk.outline!.length).toBeGreaterThan(4)
  })

  it("una columna quadrada a la cantonada de darrere: base, tapa, fons i lateral es retallen al seu voltant", () => {
    // Columna de 200 × 200 de terra a sostre que entra 150 mm a la cantonada de darrere a l'esquerra.
    const col: RefObject = { id: "c", name: "Columna", w: 200, h: 2500, d: 200, x: -50, y: 0, z: -50, effect: "cut", axis: "y" }
    const b = buildComposition(comp(col))
    expect(b.warnings.filter((w) => w.code === "ref-cut")).toEqual([])
    for (const id of ["bottom", "top"]) {
      const p = b.panels.find((q) => q.role === id)!
      expect(p.outline, id).toBeDefined()
      expect(p.outline!.length, id).toBeGreaterThan(4)
    }
    // El fons, de dalt a baix: la columna se'n menja la franja de l'esquerra (queda un rectangle més estret).
    const bk = b.panels.find((q) => q.role === "back")!
    // Es fa a la seva mida (el nesting no reserva la franja que s'ha menjat la columna).
    expect(panelBox(bk).min[0]).toBeGreaterThan(100)
    const left = b.panels.find((q) => q.id.endsWith("side-left"))!
    expect(left.outline).toBeDefined()
    // Res surt de les peces: cap forat ni ranura a la part que s'ha tret.
    const ring = (q: (typeof b.panels)[number]) => q.outline!.map((v) => [v[0], v[1]] as [number, number])
    for (const q of b.panels.filter((x) => x.outline)) {
      for (const h of q.holes.filter((h) => h.face !== "edge")) expect(pointInPolygon([h.x, h.y], ring(q)), `${q.label} ${h.tag}`).toBe(true)
      for (const g of q.grooves) expect(pointInPolygon([g.x + g.w / 2, g.y + g.h / 2], ring(q)), `${q.label} ranura`).toBe(true)
    }
    // El STEP surt net amb les peces retallades.
    const step = toStep(b.panels, { name: "c" })
    for (const sol of stepSolids(step.text)) expect(sol.badEdges).toBe(0)
  })

  it("una columna rodona a la vora: la base i la tapa segueixen el cercle", () => {
    const col: RefObject = { id: "c", name: "Pilar", w: 300, h: 2500, d: 300, x: -150, y: 0, z: 100, effect: "cut", shape: "cylinder", axis: "y" }
    const b = buildComposition(comp(col))
    const base = b.panels.find((q) => q.role === "bottom")!
    expect(base.outline!.length).toBeGreaterThan(20)
    expect(b.warnings.filter((w) => w.code === "ref-cut")).toEqual([])
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

  it("perfil en L: talla amb la seva forma i el STEP és net", () => {
    const L: [number, number][] = [[0, 0], [200, 0], [200, 60], [60, 60], [60, 200], [0, 200]]
    const b = buildComposition(comp({ id: "l", name: "L", w: 200, h: 200, d: 40, x: 300, y: 250, z: -10, effect: "cut", shape: "profile", profile: L }))
    const bk = b.panels.find((p) => p.role === "back")!
    const c = bk.cutouts![0]!
    expect(c.kind).toBe("polygon")
    if (c.kind === "polygon") expect(c.points).toHaveLength(6)
    const step = toStep(b.panels, { name: "l" })
    expect(step.warnings).toEqual([])
    for (const s of stepSolids(step.text)) expect(s.badEdges).toBe(0)
  })

  it("obstacle en L: no xoca pel buit de la L", () => {
    // Columna en L vista des de dalt (u = x, v = z): braç a l'esquerra del mòdul i braç per
    // davant del mòdul; el buit de la L abraça la cantonada del mòdul.
    const L: [number, number][] = [[0, 0], [100, 0], [100, 300], [400, 300], [400, 400], [0, 400]]
    const col: RefObject = { id: "c", name: "Columna", w: 400, h: 2500, d: 400, x: -120, y: 0, z: 150, shape: "profile", axis: "y", profile: L }
    expect(buildComposition(comp(col)).warnings.some((w) => w.code === "collision")).toBe(false)
    expect(buildComposition(comp({ ...col, shape: undefined, profile: undefined })).warnings.some((w) => w.code === "collision")).toBe(true)
  })

  it("perfil de Bézier (el·lipse): talla amb arcs i el STEP és net", () => {
    const k = 0.5522847498, a = 100, b = 60
    const ellipse = [
      { x: 2 * a, y: b, in: [0, -k * b] as [number, number], out: [0, k * b] as [number, number] },
      { x: a, y: 2 * b, in: [k * a, 0] as [number, number], out: [-k * a, 0] as [number, number] },
      { x: 0, y: b, in: [0, k * b] as [number, number], out: [0, -k * b] as [number, number] },
      { x: a, y: 0, in: [-k * a, 0] as [number, number], out: [k * a, 0] as [number, number] },
    ]
    const bb = buildComposition(comp({ id: "e", name: "El·lipse", w: 200, h: 120, d: 40, x: 300, y: 300, z: -10, effect: "cut", shape: "profile", profile: ellipse }))
    const c = bb.panels.find((p) => p.role === "back")!.cutouts![0]!
    expect(c.kind).toBe("polygon")
    if (c.kind === "polygon") expect(c.points.every((p) => p.length === 3)).toBe(true)
    const step = toStep(bb.panels, { name: "e" })
    expect(step.warnings).toEqual([])
    for (const s of stepSolids(step.text)) expect(s.badEdges).toBe(0)
  })

  it("diu quins dels que tallen toquen alguna peça (el 3D: verd) i quins no (vermell)", () => {
    const hits = { id: "t", name: "Tub", w: 60, h: 60, d: 40, x: 370, y: 320, z: -10, effect: "cut" as const, shape: "cylinder" as const, axis: "z" as const }
    const far = { ...hits, id: "f", x: 3000 }
    expect(buildComposition(comp(hits, far)).cutting).toEqual(["t"])
  })
})
