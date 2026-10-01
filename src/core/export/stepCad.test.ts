import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { BUILTIN_TEMPLATES, defaultModule, type Composition, type FreePart } from "../model"
import { toStep, toStepCad } from "./step"
import { readStepEntities, stepSolids } from "./stepRead"

const template = (id: string) => BUILTIN_TEMPLATES.find((t) => t.id === id)!.make()

describe("STEP per a TopSolid", () => {
  it("ingletes de debò: sòlids tancats amb cares a 45°", () => {
    const b = buildComposition(template("walnut-floating"))
    const mitred = b.panels.filter((p) => p.mitres?.length)
    expect(mitred.length).toBeGreaterThan(3)
    const step = toStepCad([{ name: "Moble", panels: b.panels }], { name: "m", date: "2026-01-01T00:00:00" })
    const solids = stepSolids(step.text)
    expect(solids).toHaveLength(b.panels.length)
    for (const s of solids) expect(s.badEdges, s.name).toBe(0)
    // Cares planes amb normal a 45° (0.7071 en dues components).
    const ents = [...readStepEntities(step.text).values()]
    const diag = ents.filter((e) => e.type === "DIRECTION" && e.nums.filter((n) => Math.abs(Math.abs(n) - 0.7071) < 1e-3).length === 2)
    expect(diag.length).toBeGreaterThan(0)
    // El STEP del taller no canvia: sense cares a 45°.
    const plain = [...readStepEntities(toStep(b.panels, { name: "m" }).text).values()]
    expect(plain.some((e) => e.type === "DIRECTION" && e.nums.filter((n) => Math.abs(Math.abs(n) - 0.7071) < 1e-3).length === 2)).toBe(false)
  })

  it("els mobles de la galeria surten tancats (també els que tenen inglet i ranures)", () => {
    for (const t of BUILTIN_TEMPLATES) {
      const b = buildComposition(t.make())
      const step = toStepCad([{ name: "Moble", panels: [...b.panels, ...b.extras] }], { name: t.id })
      for (const s of stepSolids(step.text)) expect(s.badEdges, `${t.id} · ${s.name}`).toBe(0)
    }
  })

  it("booleà 3D: el tub que travessa el bloc pel cantell és un forat de debò", () => {
    const block: FreePart = { id: "block", name: "Bloc", orient: "front", w: 600, h: 100, thickness: 600, material: "Pedra", nest: false, x: 0, y: 0, z: 0 }
    const tube: FreePart = { id: "tube", name: "Tub", orient: "flat", w: 50, h: 50, thickness: 400, material: "Blanc", x: 200, y: -100, z: 200, effect: "cut" }
    const comp: Composition = { kind: "lliure", modules: [defaultModule("m1", "M")], references: [], parts: [block, tube] }
    const b = buildComposition(comp)
    const bl = b.extras[0]!
    expect(bl.solidCuts).toHaveLength(1)
    const step = toStepCad([{ name: "Peces", panels: [bl] }], { name: "b" })
    expect(step.warnings).toEqual([])
    const [s] = stepSolids(step.text)
    expect(s!.badEdges).toBe(0)
    expect(s!.faces).toBe(6 + 4)
  })

  it("conjunt: moble › mòduls › peces, amb colors", () => {
    const b = buildComposition(template("bookcase-black"))
    const groups = [1, 2, 3].map((n) => ({ name: `Mòdul ${n}`, panels: b.panels.filter((p) => p.module === n) }))
    const step = toStepCad(groups, { name: "Llibreria", color: () => [0.4, 0.3, 0.2] })
    const ents = [...readStepEntities(step.text).values()]
    expect(ents.filter((e) => e.type === "NEXT_ASSEMBLY_USAGE_OCCURRENCE")).toHaveLength(3 + b.panels.length)
    expect(ents.filter((e) => e.type === "STYLED_ITEM")).toHaveLength(b.panels.length)
    expect(ents.filter((e) => e.type === "COLOUR_RGB")).toHaveLength(1)
    expect(step.text).toContain("PRODUCT('Llibreria'")
  })

  it("el nom que llegeix el taller és el de taller en ASCII (com al CSV); el PRODUCT, l'etiqueta de l'app", () => {
    const b = buildComposition(template("bookcase-black"))
    const p = { ...b.panels[0]!, name: "Prestatge: dalt", label: "Prestatge de dalt (façana)" }
    const step = toStepCad([{ name: "M", panels: [p] }], { name: "L" })
    expect(step.text).toContain("ADVANCED_BREP_SHAPE_REPRESENTATION('Prestatge- dalt'")
    expect(step.text).toContain("PRODUCT('Prestatge de dalt (fa\\X2\\00E7\\X0\\ana)'")
  })
})

describe("conjunts del STEP per a TopSolid", async () => {
  const { stepCadGroups } = await import("./stepGroups")
  it("per al taller, només les peces amb nesting (sense ferro, pedra ni vidre)", () => {
    const comp = template("oak-kitchen")
    const b = buildComposition(comp)
    expect(b.extras.length).toBeGreaterThan(0)
    const groups = stepCadGroups(comp, b)
    const ids = groups.flatMap((g) => g.panels.map((p) => p.id))
    expect(ids).toHaveLength(b.panels.length)
    expect(ids.some((id) => b.extras.some((e) => e.id === id))).toBe(false)
  })
  it("amb `extras` (CAD): un per mòdul, el taulell i les peces lliures (també les de pedra)", () => {
    const comp = template("oak-kitchen")
    const b = buildComposition(comp)
    const groups = stepCadGroups(comp, b, { extras: true })
    expect(groups.map((g) => g.name)).toEqual(["1. Calaixos", "2. Fregadera", "3. Fogons", "4. Rebost", "5. Illa", "Taulell i sòcol", "Prestatges de paret", "Peces lliures"])
    expect(groups.reduce((n, g) => n + g.panels.length, 0)).toBe(b.panels.length + b.extras.length)
  })
})

describe("forats de guia del calaix", () => {
  it("no arriben a la ranura del fons (per l'altra cara)", () => {
    const b = buildComposition(template("drawers-4"))
    for (const side of b.panels.filter((p) => p.role === "drawerSide")) {
      const g = side.grooves.find((x) => x.tag === "drawer-bottom")!
      for (const h of side.holes.filter((x) => x.tag === "slide")) {
        const overlapsBand = h.y + h.diameter / 2 > g.y && h.y - h.diameter / 2 < g.y + g.h
        if (overlapsBand) expect(h.depth + g.depth).toBeLessThan(side.thickness)
      }
    }
  })
})
