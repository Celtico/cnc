import { describe, expect, it } from "vitest"
import { Texture } from "three"
import { bakeTextureCenter } from "./exportGlb"

describe("GLB: centre de les textures", () => {
  it("passa el centre a l'offset sense canviar la matriu UV", () => {
    for (const [rot, rx, ry, ox, oy] of [[Math.PI / 2, 2.5, 0.8, 0.3, 0.7], [Math.PI, 1.2, 3.1, 0.1, 0.9], [Math.PI * 1.5, 0.6, 0.6, 0, 0], [0, 4, 2, 0.5, 0.25]] as const) {
      const t = new Texture()
      t.center.set(0.5, 0.5)
      t.rotation = rot
      t.repeat.set(rx, ry)
      t.offset.set(ox, oy)
      t.updateMatrix()
      const before = t.matrix.elements.slice()
      bakeTextureCenter(t)
      expect(t.center.toArray()).toEqual([0, 0])
      t.matrix.elements.forEach((v, i) => expect(v).toBeCloseTo(before[i]!, 10))
    }
  })
})
