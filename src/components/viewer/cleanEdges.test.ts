import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from "three"
import { describe, expect, it } from "vitest"
import { cleanEdges } from "./cleanEdges"

describe("cleanEdges", () => {
  it("una caixa: les 12 arestes, cap diagonal", () => {
    expect(cleanEdges(new BoxGeometry(0.6, 0.019, 0.5)).getAttribute("position").count).toBe(24)
  })
  it("una cara plana partida en T (com deixa el tall) no hi dibuixa res", () => {
    // Quadrat 0..2 en tres triangles amb un vèrtex en T a (1,0): costats sense parella, cap aresta amb angle.
    const p = [0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 0, 0, 2, 0, 0, 2, 2, 0, 1, 0, 0, 2, 2, 0, 0, 2, 0]
    const g = new BufferGeometry()
    g.setAttribute("position", new Float32BufferAttribute(p, 3))
    expect(cleanEdges(g).getAttribute("position").count).toBe(0)
  })
})
