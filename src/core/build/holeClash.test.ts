import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, TV_LIVING_ROOM } from "../model"
import { buildComposition } from "./buildComposition"

describe("forats que es troben per dins", () => {
  it("System 32 a banda i banda d'un divisor: queda 1 mm de matèria entre els dos", () => {
    const b = buildComposition(TV_LIVING_ROOM.make())
    let pairs = 0
    for (const p of b.panels) {
      for (const a of p.holes.filter((h) => h.face === "A"))
        for (const c of p.holes.filter((h) => h.face === "B" && Math.hypot(h.x - a.x, h.y - a.y) < (h.diameter + a.diameter) / 2)) {
          pairs += 1
          expect(a.depth + c.depth).toBeLessThanOrEqual(p.thickness - 1)
        }
    }
    expect(pairs).toBeGreaterThan(0)
  })

  it("cap plantilla deixa forats que xoquen", () => {
    for (const t of BUILTIN_TEMPLATES) expect(buildComposition(t.make()).warnings.filter((w) => w.code === "hole-clash"), t.id).toEqual([])
  })

  it("l'espiga del divisor s'atura abans del forat de guia", () => {
    // Un divisor amb forats de guia a la cara i espigues escurçades (les plantilles de cuina en tenen).
    const div = BUILTIN_TEMPLATES.flatMap((t) => buildComposition(t.make()).panels).find(
      (p) => p.role === "divider" && p.holes.some((h) => h.tag === "slide") && p.holes.some((h) => h.face === "edge" && h.depth < 20),
    )!
    expect(div).toBeTruthy()
    const dowels = div.holes.filter((h) => h.face === "edge")
    expect(dowels.some((h) => h.depth < 20)).toBe(true)
    expect(dowels.every((h) => h.depth >= 10)).toBe(true)
  })
})
