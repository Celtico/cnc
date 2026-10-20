import { describe, expect, it } from "vitest"
import { ZoneSchema } from "../model"

describe("els calaixos interiors d'abans passen a Calaixos (model únic, regla 3)", () => {
  it("compartiment tapat sense res més: els calaixos són el seu Front", () => {
    const z = ZoneSchema.parse({ id: "a", innerDrawers: { n: 2, height: 150, heights: [120, 200] } })
    expect(z).toEqual({ id: "a", front: { kind: "drawers", n: 2, heights: [120, "auto"] } })
  })
  it("amb la seva porta i prestatges: divisió, calaixos a baix i la porta tapa les dues zones", () => {
    const z = ZoneSchema.parse({ id: "a", front: { kind: "door", mode: "single", hinge: "left" }, shelves: { n: 2, adjustable: true }, innerDrawers: { n: 2, height: 150 } })
    expect(z.front?.kind).toBe("door")
    expect(z.split?.sizes).toEqual([300, "auto"])
    expect(z.split?.children[0]?.front).toEqual({ kind: "drawers", n: 2, heights: [150, "auto"] })
    expect(z.split?.children[1]?.shelves?.n).toBe(2)
  })
})
