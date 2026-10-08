import { describe, expect, it } from "vitest"
import { defaultModule, setSplitSize, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./buildComposition"
import { splitChildSizes } from "./layout"

/** Les mides de la «Divisió» de l'editor: les reals (com es construeix) i l'última, el que sobra. */
describe("splitChildSizes i setSplitSize", () => {
  const withSplit = (sizes: (number | "auto")[], dir: "v" | "h" = "v"): Module => {
    const m = defaultModule("m", "x", { width: 1000, height: 720, depth: 560 })
    const root: Zone = { id: "root", split: { dir, sizes, children: sizes.map((_, i) => ({ id: `z${i}` })) } }
    return { ...m, root }
  }
  const sizesOf = (m: Module) => splitChildSizes(buildModule(m).layout, m.root)!

  it("les mides reals sumen la llum amb els gruixos dels divisors i quadren amb els divisors construïts", () => {
    const m = withSplit([300, "auto", 200])
    const b = buildModule(m)
    const sizes = splitChildSizes(b.layout, m.root)!
    expect(sizes[0]).toBe(300)
    expect(sizes[2]).toBe(200)
    const dividers = b.panels.filter((p) => p.role === "divider").map((p) => panelBox(p)).sort((a, c) => a.min[0] - c.min[0])
    expect(dividers).toHaveLength(2)
    const t = dividers[0]!.max[0] - dividers[0]!.min[0]
    const rects = [...b.layout.rects.entries()].filter(([id]) => id !== "root").map(([, r]) => r)
    // La del mig (auto) és el que hi ha entre els dos divisors.
    expect(sizes[1]).toBeCloseTo(dividers[1]!.min[0] - dividers[0]!.max[0], 2)
    expect(sizes.reduce((s, v) => s + v, 0) + 2 * t).toBeCloseTo(rects.at(-1)!.x1 - rects[0]!.x0, 2)
  })

  it("horitzontal: alçades", () => {
    const m = withSplit(["auto", 250], "h")
    const s = sizesOf(m)
    expect(s[1]).toBe(250)
    expect(s[0]).toBeGreaterThan(0)
  })

  it("amb l'última «auto», només canvia la fila; l'última no s'edita", () => {
    const m = withSplit([300, "auto"])
    expect(setSplitSize(m.root, "root", 0, 350, sizesOf(m)).split!.sizes).toEqual([350, "auto"])
    expect(setSplitSize(m.root, "root", 0, "auto", sizesOf(m)).split!.sizes).toEqual(["auto", "auto"])
    expect(setSplitSize(m.root, "root", 1, 100, sizesOf(m))).toBe(m.root)
  })

  it("dades d'abans (l'última fixa): en editar, l'última passa a «auto» sense canviar la geometria", () => {
    // L'última fixa i una altra «auto» (la que sobrava): la «auto» passa als seus mm i l'última a «auto».
    const m = withSplit(["auto", 300, 200])
    const current = sizesOf(m)
    const same = setSplitSize(m.root, "root", 1, 300, current)
    expect(same.split!.sizes).toEqual([current[0], 300, "auto"])
    expect(buildModule({ ...m, root: same }).panels).toEqual(buildModule(m).panels)
    // Totes fixes que no quadren (l'última s'ajustava, avís `layout`): l'última passa a «auto», les mateixes peces i cap avís.
    const all = withSplit([300, 300, 500])
    const fixed = setSplitSize(all.root, "root", 0, 300, sizesOf(all))
    expect(fixed.split!.sizes).toEqual([300, 300, "auto"])
    expect(buildModule({ ...all, root: fixed }).panels).toEqual(buildModule(all).panels)
    expect(buildModule({ ...all, root: fixed }).warnings.filter((w) => w.code === "layout")).toEqual([])
    // I el canvi s'aplica després: la primera a 250, l'última agafa el que sobra.
    const edited = setSplitSize(all.root, "root", 0, 250, sizesOf(all))
    expect(sizesOf({ ...all, root: edited })[2]).toBeCloseTo(sizesOf(all)[2]! + 50, 2)
  })
})
