import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type Module } from "../../core/model"
import { buildComposition } from "../../core/build/buildComposition"
import { panelBox } from "../../core/build/geometry"
import { movedBox, movingGroups, transformAt } from "./opening"

const withFront = (turned: boolean, front: NonNullable<Module["root"]["front"]>): Composition => {
  const m: Module = defaultModule("m1", "M")
  return { kind: "moble", modules: [{ ...m, wallGap: 0, ...(turned ? { turned: true } : {}), root: { ...m.root, front } }], references: [] }
}

describe("obertura d'un mòdul girat 180°", () => {
  it("els calaixos surten cap enrere", () => {
    const g = movingGroups(buildComposition(withFront(true, { kind: "drawers", n: 2, heights: ["auto", "auto"] })).panels).filter((x) => x.motion.kind === "slide")
    expect(g.length).toBe(2)
    for (const x of g) if (x.motion.kind === "slide") expect(x.motion.dir[2]).toBe(-1)
  })
  it("la porta gira pel darrere i a l'altre costat en X", () => {
    const front = { kind: "door" as const, mode: "single" as const, hinge: "left" as const }
    const a = movingGroups(buildComposition(withFront(false, front)).panels).find((x) => x.motion.kind === "hinge")!
    const b = movingGroups(buildComposition(withFront(true, front)).panels).find((x) => x.motion.kind === "hinge")!
    if (a.motion.kind !== "hinge" || b.motion.kind !== "hinge") throw new Error("hinge")
    expect(b.motion.pivot[0]).not.toBeCloseTo(a.motion.pivot[0])
    expect(b.motion.pivot[2]).toBeLessThan(a.motion.pivot[2])
    expect(b.motion.sign).toBe(a.motion.sign)
  })
})

const turnedTo = (rot: 90 | 270, front: NonNullable<Module["root"]["front"]>): Composition => {
  const m: Module = defaultModule("m1", "M")
  return { kind: "moble", modules: [{ ...m, wallGap: 0, rot, root: { ...m.root, front } }], references: [] }
}

describe("obertura d'un mòdul girat 90° o 270°", () => {
  for (const rot of [90, 270] as const) {
    it(`${rot}°: els calaixos surten cap on miren els fronts (en X)`, () => {
      const panels = buildComposition(turnedTo(rot, { kind: "drawers", n: 2, heights: ["auto", "auto"] })).panels
      const g = movingGroups(panels).filter((x) => x.motion.kind === "slide")
      expect(g.length).toBe(2)
      const front = panels.find((p) => p.role === "drawerFront")!
      for (const x of g) if (x.motion.kind === "slide") expect(x.motion.dir).toEqual([Math.sign(front.placement.explodeDir[0]), 0, 0])
    })
    it(`${rot}°: la porta gira sobre un cantell vertical a la cara de dins i surt cap a fora`, () => {
      const front = { kind: "door" as const, mode: "single" as const, hinge: "left" as const }
      const panels = buildComposition(turnedTo(rot, front)).panels
      const g = movingGroups(panels).find((x) => x.motion.kind === "hinge")!
      const m = g.motion
      if (m.kind !== "hinge") throw new Error("hinge")
      const door = panels.find((p) => p.id === g.id)!
      const b = panelBox(door)
      const out = Math.sign(door.placement.explodeDir[0])
      expect(m.axis).toBe("y")
      // Pivot a la cara de dins (en X) i a un extrem en Z.
      expect(m.pivot[0]).toBeCloseTo(out > 0 ? b.min[0] : b.max[0])
      expect([b.min[2], b.max[2]].some((z) => Math.abs(z - m.pivot[2]) < 1e-6)).toBe(true)
      // Oberta, la porta surt cap a fora del mòdul.
      const mb = movedBox(door, transformAt(m, 1))
      if (out > 0) expect(mb.max[0]).toBeGreaterThan(b.max[0] + 100)
      else expect(mb.min[0]).toBeLessThan(b.min[0] - 100)
      // La mateixa frontissa (esquerra) que sense girar: el mateix sentit de gir.
      const flat = movingGroups(buildComposition(withFront(false, front)).panels).find((x) => x.motion.kind === "hinge")!
      if (flat.motion.kind !== "hinge") throw new Error("hinge")
      expect(m.sign).toBe(flat.motion.sign)
    })
  }
})
