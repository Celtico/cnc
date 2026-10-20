import { describe, expect, it } from "vitest"
import { defaultModule, drawersBehindDoors, drawersWithoutDoors, setFront, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"

// L'armari de cel (2026-10-20): dues piles de calaixos a baix i el penjador a dalt; després, dues portes de dalt a baix.
const wardrobe = (): Module => {
  const m = defaultModule("a", "Armari", { width: 1550, height: 1720, depth: 560 })
  const drawers = { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } as never
  const root: Zone = {
    id: "r",
    split: {
      dir: "h",
      sizes: [500, "auto"],
      children: [
        { id: "b", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "b1", front: drawers }, { id: "b2", front: drawers }] } },
        { id: "t", rail: {} },
      ],
    },
  }
  return { ...m, root }
}
const doors = (root: Zone) => setFront(root, "r", { kind: "door", mode: "double", hinge: "left" } as never)

describe("calaixos i portes de tot el mòdul", () => {
  it("en posar les portes, els calaixos passen a interiors (no desapareixen) amb les alçades reals", () => {
    const m = wardrobe()
    const before = buildModule(m)
    const real = before.drawerHeights["b1"]!
    expect(real).toHaveLength(3)
    const root = drawersBehindDoors(doors(m.root), before.drawerHeights)
    const b = buildModule({ ...m, root })
    expect(b.panels.filter((p) => p.role === "door")).toHaveLength(2)
    expect(b.panels.filter((p) => p.label.startsWith("Front interior"))).toHaveLength(6)
    const leaf = root.split!.children[0]!.split!.children[0]!
    expect(leaf.front).toBeUndefined()
    expect(leaf.innerDrawers?.n).toBe(3)
    expect(leaf.innerDrawers?.height).toBe(Math.round(real[0]!))
  })
  it("en treure les portes, tornen els calaixos de sempre", () => {
    const m = wardrobe()
    const covered = drawersBehindDoors(doors(m.root))
    const back = drawersWithoutDoors(setFront(covered, "r", null))
    const leaf = back.split!.children[0]!.split!.children[1]!
    expect(leaf.front?.kind).toBe("drawers")
    expect(leaf.innerDrawers).toBeUndefined()
    expect(buildModule({ ...m, root: back }).panels.some((p) => p.label.startsWith("Front interior"))).toBe(false)
  })
})
