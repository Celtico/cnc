import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type Module } from "../../core/model"
import { buildComposition } from "../../core/build/buildComposition"
import { movingGroups } from "./opening"

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
