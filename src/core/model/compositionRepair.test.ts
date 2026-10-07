import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES } from "./templates"
import { CompositionSchema, DEFAULT_GRILLE, defaultModule, type Composition, type Front } from "./composition"
import { DEFAULT_MODULE_HARDWARE } from "./hardware"
import { repairComposition } from "./compositionRepair"

const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const sample = (): Composition => plain(BUILTIN_TEMPLATES.find((t) => t.make().references.length > 0)!.make())

describe("repairComposition", () => {
  it("una composició vàlida torna igual i sense problemes", () => {
    const c = sample()
    const r = repairComposition(c)
    expect(r.problems).toEqual([])
    expect(r.composition).toEqual(CompositionSchema.parse(c))
  })

  it("un objecte de referència, una peça o un model dolents es treuen sols", () => {
    const c = sample() as Record<string, any>
    const refs = c.references.length
    c.references.push({ id: "r1", name: "dolent", w: 0, h: 10, d: 10, x: 0, y: 0, z: 0 })
    c.parts = [{ id: "p1", name: "Bona", orient: "front", w: 100, h: 100, thickness: 19, material: "M", x: 0, y: 0, z: 0 }, { id: "p2", name: "Dolenta", orient: "front", w: -1 }]
    c.models = [{ id: "mo", name: "fern", src: "x", x: 0, y: 0, z: 0, w: 0, h: 1, d: 1 }]
    const r = repairComposition(c)
    expect(r.composition!.modules.map((m) => m.id)).toEqual(c.modules.map((m: { id: string }) => m.id))
    expect(r.composition!.references.length).toBe(refs)
    expect(r.composition!.parts!.map((p) => p.id)).toEqual(["p1"])
    expect(r.composition!.models).toEqual([])
    expect(r.problems.some((p) => p.includes("Objecte de referència «dolent»"))).toBe(true)
    expect(r.problems.some((p) => p.includes("Peça lliure «Dolenta»"))).toBe(true)
  })

  it("d'un mòdul només es canvien els camps dolents", () => {
    const c = sample() as Record<string, any>
    const m = c.modules[0]
    const before = plain(m)
    m.carcass.width = "ample"
    m.carcass.frontMaterial = 7
    m.hardware.slide.lengths = [300, 0]
    m.fronts.style = "estrany"
    const r = repairComposition(c)
    const out = r.composition!.modules[0]!
    expect(out.carcass.width).toBe(defaultModule("x", "x").carcass.width)
    expect(out.carcass.frontMaterial).toBeUndefined()
    expect(out.carcass.height).toBe(before.carcass.height)
    expect(out.carcass.material).toBe(before.carcass.material)
    // La còpia d'un lloc es llegeix sencera o res («mai mig ferratge»): una llargada dolenta torna tot el lloc a l'item d'inici.
    expect(out.hardware.slide).toEqual(DEFAULT_MODULE_HARDWARE.slide)
    expect(r.problems.some((p) => p.includes("hardware.slide"))).toBe(true)
    expect(out.hardware.hinge).toEqual(before.hardware.hinge)
    expect(out.fronts.style).toBeUndefined()
    expect(out.fronts.outerGap).toBe(before.fronts.outerGap)
    expect(out.root).toEqual(before.root)
    expect(r.problems.length).toBeGreaterThan(0)
  })

  it("arbre de zones: un front dolent d'un compartiment només treu aquell front", () => {
    const m = defaultModule("m1", "Baix")
    const root = { id: "r", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a", front: { kind: "door", mode: "single", hinge: "left" } }, { id: "b", front: { kind: "door", mode: "triple" }, shelves: { n: 2, adjustable: true } }] } }
    const r = repairComposition({ modules: [{ ...m, root }], references: [] })
    const out = r.composition!.modules[0]!.root
    expect(out.split!.children[0]!.front).toEqual({ kind: "door", mode: "single", hinge: "left" })
    expect(out.split!.children[1]!.front).toBeUndefined()
    expect(out.split!.children[1]!.shelves).toEqual({ n: 2, adjustable: true })
  })

  it("un ferratge dolent d'un front (porta, calaixos, abatible) treu només el ferratge, no el front", () => {
    const fronts: Front[] = [
      { kind: "door", mode: "double", hinge: "right", hardware: DEFAULT_MODULE_HARDWARE.hinge },
      { kind: "drawers", n: 2, heights: [200, "auto"], hardware: DEFAULT_MODULE_HARDWARE.slide },
      { kind: "flap", dir: "up", hardware: DEFAULT_MODULE_HARDWARE.flap },
    ]
    // Un paràmetre que no és un número, un motor d'una versió més nova, o un mecanitzat dolent (mai mig ferratge).
    const breakers: ((h: Record<string, any>) => void)[] = [
      (h) => (h.params = { ...h.params, cupDiameter: "x" }),
      (h) => (h.engine = "quantum"),
      (h) => h.targets[0].ops.push({ kind: "drill", face: "C" }),
    ]
    for (const front of fronts) {
      for (const breakIt of breakers) {
        const bad = plain(front) as Record<string, any>
        breakIt(bad.hardware)
        const root = { id: "r", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a", front: bad, shelves: { n: 1, adjustable: false } }, { id: "b", front: plain(front) }] } }
        const r = repairComposition({ modules: [{ ...defaultModule("m1", "Baix"), root }], references: [] })
        const out = r.composition!.modules[0]!.root.split!.children
        const { hardware: _h, ...rest } = front as Front & { hardware?: unknown }
        expect(out[0]!.front, `${front.kind}`).toEqual(rest)
        expect(out[0]!.shelves).toEqual({ n: 1, adjustable: false })
        expect(out[1]!.front).toEqual(front)
        expect(r.problems.some((p) => p.includes("hardware") && p.includes("tret")), r.problems.join(" | ")).toBe(true)
      }
    }
  })

  it("un ferratge dolent del mòdul no toca els altres llocs", () => {
    const m = plain(defaultModule("m1", "Baix")) as Record<string, any>
    m.hardware.hinge.params.cupOffset = 21
    m.hardware.slide.params.boxThickness = "x"
    const r = repairComposition({ modules: [m], references: [] })
    const kit = r.composition!.modules[0]!.hardware
    expect(kit.hinge.params.cupOffset).toBe(21)
    expect(kit.slide.params).toEqual(DEFAULT_MODULE_HARDWARE.slide.params)
  })

  it("un front es repara dins del seu tipus: una trapa dolenta de la reixeta no treu la reixeta", () => {
    const grille = { kind: "grille", pattern: DEFAULT_GRILLE, mount: "hinged", hinge: "right" }
    const root = { id: "r", front: { ...grille, hatch: { x: 0, y: 0, w: -5, h: 100 } } }
    const r = repairComposition({ modules: [{ ...defaultModule("m1", "Baix"), root }], references: [] })
    expect(r.composition!.modules[0]!.root.front).toEqual(grille)
    // Un camp obligatori dolent sense valor del mateix tipus: el front es treu, com abans.
    const r2 = repairComposition({ modules: [{ ...defaultModule("m1", "Baix"), root: { id: "r", front: { ...grille, mount: "glued" } } }], references: [] })
    expect(r2.composition!.modules[0]!.root.front).toBeUndefined()
  })

  it("un forat dolent del taulell no treu el taulell", () => {
    const m = defaultModule("m1", "Baix")
    const run = { id: "w", kind: "worktop", from: "m1", to: "m1", material: "M", thickness: 30, overhangFront: 20, overhangLeft: 0, overhangRight: 0, cutouts: [{ id: "c1", kind: "sink", module: "m1", w: 500, d: 400, dx: 0 }, { id: "c2", kind: "hob", module: "m1", w: -5, d: 400, dx: 0 }] }
    const r = repairComposition({ modules: [m], references: [], runs: [run] })
    expect(r.composition!.runs).toHaveLength(1)
    expect((r.composition!.runs![0] as { cutouts: { id: string }[] }).cutouts.map((c) => c.id)).toEqual(["c1"])
  })

  it("un mòdul que no és un objecte es treu; els altres es queden", () => {
    const a = defaultModule("a", "A")
    const r = repairComposition({ modules: [a, "?", null], references: [] })
    expect(r.composition!.modules.map((m) => m.id)).toEqual(["a"])
    expect(r.problems).toHaveLength(2)
  })

  it("sense llista de mòduls, o si no és un objecte: no es pot reparar", () => {
    expect(repairComposition({ modules: "?" }).composition).toBeNull()
    expect(repairComposition(null).composition).toBeNull()
    expect(repairComposition([1, 2]).composition).toBeNull()
  })

  it("camps opcionals dolents del moble (tipus, encaixos, escena) es treuen", () => {
    const r = repairComposition({ modules: [defaultModule("a", "A")], references: [], kind: "nau", joinery: { clearance: -1, tool: 6, tabWidth: 40 }, scene: { floor: 3, wall: "Pintura blanca" } })
    expect(r.composition!.kind).toBeUndefined()
    expect(r.composition!.joinery).toBeUndefined()
    expect(r.composition!.scene).toEqual({ wall: "Pintura blanca" })
  })
})
