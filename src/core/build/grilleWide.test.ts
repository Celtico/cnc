import { describe, expect, it } from "vitest"
import { defaultModule, type Composition } from "../model"
import { toStep } from "../export/step"
import { buildComposition } from "./buildComposition"

/** Reixeta més ampla que alta: el front es gira (costat llarg a x) i els talls hi han de girar amb ell. */
const wide = (margin: number, slotWidth: number): Composition => {
  const m = defaultModule("r", "Radiador", { width: 1050, height: 2590, depth: 170, base: { kind: "legs", height: 20 }, back: "none", top: { kind: "none" } })
  m.root = {
    id: "root",
    split: {
      dir: "h",
      sizes: [800, "auto"],
      children: [
        { id: "g", front: { kind: "grille", pattern: { kind: "slotsH", slotWidth, slotGap: slotWidth, margin, holeDiameter: 10, holePitch: 16 }, mount: "removable", hinge: "left" } },
        { id: "o" },
      ],
    },
  }
  return { modules: [m], references: [] }
}

describe("reixeta ampla (front girat)", () => {
  for (const [margin, sw] of [
    [39, 39],
    [10, 10],
  ] as const) {
    it(`els talls queden dins de la peça i el STEP no avisa (marge ${margin}, ranura ${sw})`, () => {
      const b = buildComposition(wide(margin, sw))
      const g = b.panels.find((p) => p.role === "grille")!
      expect(g.length).toBeGreaterThanOrEqual(g.width)
      for (const c of g.cutouts ?? []) {
        if (c.kind === "circle" || c.kind === "polygon") continue
        expect(c.x).toBeGreaterThan(0)
        expect(c.y).toBeGreaterThan(0)
        expect(c.x + c.w).toBeLessThan(g.length)
        expect(c.y + c.h).toBeLessThan(g.width)
      }
      expect(toStep(b.panels, { name: "t" }).warnings).toEqual([])
    })
  }
})
