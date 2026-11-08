import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import type { Panel } from "../../core/model"
import { carvedPanel, machiningCuts, shapedGeometry } from "./cutoutGeometry"

const S = 0.001
const base: Panel = {
  id: "p", label: "Base", role: "bottom", length: 600, width: 400, thickness: 19, material: "m", grain: "x",
  edges: { top: null, bottom: null, left: null, right: null },
  holes: [
    { x: 100, y: 100, diameter: 15, depth: 11, face: "A" },
    { x: 111.2, y: 100, diameter: 15, depth: 11, face: "A" },
    { x: 0, y: 200, diameter: 8, depth: 30, face: "edge", edge: "left" } as Panel["holes"][number],
  ],
  grooves: [{ x: 0, y: 380, w: 600, h: 4, depth: 8, face: "B" }],
  placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 0] },
} as unknown as Panel

/** La primera z on toca un raig que baixa (de +z) pel punt (x, y) de la peça, en mm. */
function hitZ(p: Panel, x: number, y: number, from: "A" | "B" = "A"): number | null {
  const mesh = new Mesh(shapedGeometry(p), new MeshBasicMaterial())
  const z0 = from === "A" ? 100 : -100
  const rc = new Raycaster(new Vector3(x * S, y * S, z0 * S), new Vector3(0, 0, from === "A" ? -1 : 1))
  const h = rc.intersectObject(mesh)[0]
  return h ? h.point.z / S : null
}

describe("mecanitzats buidats al 3D (Modelatge)", () => {
  it("fa un tall per forat i per ranura", () => {
    expect(machiningCuts(base)).toHaveLength(4)
  })
  it("els forats de cara i la ranura es veuen buidats", () => {
    const p = carvedPanel(base)
    expect(hitZ(p, 50, 50)).toBeCloseTo(19, 1)
    expect(hitZ(p, 100, 100)).toBeCloseTo(8, 1)
    expect(hitZ(p, 111.2, 100)).toBeCloseTo(8, 1)
    expect(hitZ(p, 300, 382, "B")).toBeCloseTo(8, 1)
  })
  it("el forat de cantell entra des del cantell", () => {
    const p = carvedPanel(base)
    const mesh = new Mesh(shapedGeometry(p), new MeshBasicMaterial())
    const rc = new Raycaster(new Vector3(-0.1, 200 * S, 9.5 * S), new Vector3(1, 0, 0))
    expect(rc.intersectObject(mesh)[0]!.point.x / S).toBeCloseTo(30, 1)
  })
})
