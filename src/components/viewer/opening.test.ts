import { describe, expect, it } from "vitest"
import { buildComposition } from "../../core/build/buildComposition"
import { BUILTIN_TEMPLATES, DEFAULT_CABINET, cabinetToComposition, defaultModule } from "../../core/model"
import { movedBox, movingGroups, openingCollisions, transformAt } from "./opening"

describe("obertura de portes i calaixos", () => {
  it("una porta amb frontissa a l'esquerra gira sobre el seu cantell esquerre cap endavant", () => {
    const panels = buildComposition(cabinetToComposition(DEFAULT_CABINET)).panels
    const groups = movingGroups(panels)
    expect(groups).toHaveLength(1)
    const g = groups[0]!
    expect(g.motion.kind).toBe("hinge")
    if (g.motion.kind !== "hinge") return
    expect(g.motion.pivot[0]).toBeCloseTo(2) // joc porta–cos
    const door = panels.find((p) => p.id === g.panelIds[0])!
    const closed = movedBox(door, transformAt(g.motion, 0))
    const open = movedBox(door, transformAt(g.motion, 1))
    // Tancada: gruix en Z. Oberta ~95°: el cantell lliure ha anat cap endavant (+Z) i
    // la porta ja no ocupa l'amplada del cos.
    expect(closed.max[2] - closed.min[2]).toBeCloseTo(19)
    expect(open.max[2]).toBeGreaterThan(closed.max[2] + 500)
    expect(open.max[0] - open.min[0]).toBeLessThan(80)
    expect(open.min[0]).toBeLessThan(closed.min[0]) // 5° més enllà de la perpendicular
  })

  it("un calaix sencer surt fins a la llargada de la guia", () => {
    const m = defaultModule("m", "Calaixera", { width: 600, height: 800, depth: 500 })
    m.root = { id: "root", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } }
    const panels = buildComposition({ modules: [m], references: [] }).panels
    const groups = movingGroups(panels)
    expect(groups).toHaveLength(2)
    for (const g of groups) {
      expect(g.motion.kind).toBe("slide")
      expect(g.panelIds).toHaveLength(5)
      if (g.motion.kind === "slide") expect([250, 300, 350, 400, 450, 500, 550]).toContain(g.motion.distance)
    }
  })

  it("tancat no hi ha col·lisions; el moble de TV obert avisa que la porta toca el cobreradiador", () => {
    const comp = BUILTIN_TEMPLATES.find((t) => t.id === "tv-living-room")!.make()
    const panels = buildComposition(comp).panels
    const groups = movingGroups(panels)
    expect(openingCollisions(panels, groups, 0, comp.references)).toEqual([])
    const open = openingCollisions(panels, groups, 1, comp.references)
    // La porta dreta del moble de TV (frontissa a l'esquerra) obre cap al cobreradiador, a 50 mm.
    expect(open.some((c) => /mòdul 2/.test(c.message))).toBe(true)
  })

  it("amb `only`, només es miren els grups triats", () => {
    const comp = BUILTIN_TEMPLATES.find((t) => t.id === "tv-living-room")!.make()
    const panels = buildComposition(comp).panels
    const groups = movingGroups(panels)
    const first = groups[0]!
    const only = openingCollisions(panels, groups, 1, comp.references, new Set([first.id]))
    expect(only.every((c) => c.groupId === first.id)).toBe(true)
  })
})
