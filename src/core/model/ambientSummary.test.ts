import { describe, expect, it } from "vitest"
import { addOpening, ambientSummary, floorArea, roomWalls, wallLoops, type Ambient, type Wall } from "./ambient"

const wall = (id: string, a: [number, number], b: [number, number]): Wall => ({ id, a, b, thickness: 100, height: 2600 })

describe("resum de l'ambient", () => {
  it("una habitació rectangular: un bucle i la superfície als eixos", () => {
    const walls = roomWalls(0, 0, 4000, 3000)
    expect(wallLoops(walls)).toHaveLength(1)
    expect(floorArea(walls)).toBeCloseTo(4000 * 3000)
  })

  it("parets en qualsevol ordre i sentit, i una de solta que no tanca res", () => {
    const walls = [wall("c", [4000, 3000], [4000, 0]), wall("a", [0, 0], [4000, 0]), wall("x", [6000, 0], [7000, 0]), wall("d", [0, 3000], [0, 0]), wall("b", [4000, 3000], [0, 3000])]
    expect(wallLoops(walls)).toHaveLength(1)
    expect(floorArea(walls)).toBeCloseTo(12e6)
  })

  it("una L oberta no té superfície; dues habitacions se sumen", () => {
    expect(floorArea([wall("a", [0, 0], [1000, 0]), wall("b", [1000, 0], [1000, 1000])])).toBe(0)
    expect(floorArea([...roomWalls(0, 0, 2000, 2000), ...roomWalls(5000, 0, 6000, 3000)])).toBeCloseTo(4e6 + 3e6)
  })

  it("compta mobles, objectes, absents, grups, parets i obertures", () => {
    const walls = roomWalls(0, 0, 4000, 3000)
    walls[0] = addOpening(walls[0]!, "window", 1000)!
    walls[1] = addOpening(walls[1]!, "door", 1000)!
    const a: Ambient = {
      walls,
      items: [
        { id: "1", kind: "moble", projectId: 1, x: 0, y: 0, rot: 0, group: "G" },
        { id: "2", kind: "moble", projectId: 2, x: 0, y: 0, rot: 0, group: "G" },
        { id: "3", kind: "moble", projectId: 3, x: 0, y: 0, rot: 0 },
        { id: "4", kind: "block", name: "Sofà", shape: "sofa", w: 2000, h: 800, d: 900, material: "Lli", x: 0, y: 0, rot: 0 },
      ],
    }
    const kindOf = (it: Ambient["items"][number]) => (it.kind === "block" || it.projectId === 2 ? "object" : it.projectId === 3 ? "missing" : "moble")
    const s = ambientSummary(a, kindOf)
    expect(s).toMatchObject({ mobles: 1, objects: 2, missing: ["3"], groups: 1, walls: 4, windows: 1, doors: 1, glazing: 0, wallLength: 14000 })
    expect(s.area).toBeCloseTo(12e6)
  })
})
