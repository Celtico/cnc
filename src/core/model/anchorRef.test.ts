import { describe, expect, it } from "vitest"
import { RefObjectSchema, anchorRef, type RefObject } from "./composition"

const base: RefObject = { id: "r", name: "Endoll", w: 80, h: 80, d: 40, x: 100, y: 300, z: 50 }

describe("anchorRef", () => {
  it("lliure: no toca res", () => expect(anchorRef(base)).toEqual(base))
  it("al terra: y = 0", () => expect(anchorRef({ ...base, onFloor: true })).toMatchObject({ x: 100, y: 0, z: 50 }))
  it("a la paret: z = 0", () => expect(anchorRef({ ...base, onWall: true })).toMatchObject({ x: 100, y: 300, z: 0 }))
  it("tots dos", () => expect(anchorRef({ ...base, onFloor: true, onWall: true })).toMatchObject({ y: 0, z: 0 }))
  it("l'esquema accepta els camps", () => expect(RefObjectSchema.parse({ ...base, onFloor: true, onWall: true }).onWall).toBe(true))
})
