import { describe, expect, it } from "vitest"
import { cameraSignature, thumbIsStale, type CameraPose } from "./camera"
import { viewerSize } from "./viewerSize"
import { defaultModule, type Composition } from "./composition"

const cam: CameraPose = { position: [1.4, 1.1, 1.9], target: [0, 0.4, 0], fov: 38 }

describe("signatura de la càmera", () => {
  it("sense càmera o no vàlida, cap signatura", () => {
    expect(cameraSignature(undefined)).toBeUndefined()
    expect(cameraSignature({ position: [Number.NaN, 0, 0], target: [0, 0, 0] })).toBeUndefined()
  })
  it("estable amb soroll per sota del mm, diferent si la càmera es mou", () => {
    const s = cameraSignature(cam)
    expect(s).toBeTypeOf("string")
    expect(cameraSignature({ ...cam, position: [1.40001, 1.1, 1.9] })).toBe(s)
    expect(cameraSignature({ ...cam, position: [1.5, 1.1, 1.9] })).not.toBe(s)
    expect(cameraSignature({ ...cam, fov: 50 })).not.toBe(s)
    // «Enquadrar» o «Interior» no canvia el que es veu.
    expect(cameraSignature({ ...cam, pose: "eye" })).toBe(s)
  })
})

describe("miniatura caducada", () => {
  const fresh = { thumb: "data:x", thumbAt: 10, thumbV: 6, thumbCam: cameraSignature(cam) }
  it("al dia si res no ha canviat", () => {
    expect(thumbIsStale(fresh, 10, 6, cam)).toBe(false)
  })
  it("es refà si canvia el document, la versió o no n'hi ha", () => {
    expect(thumbIsStale(fresh, 11, 6, cam)).toBe(true)
    expect(thumbIsStale(fresh, 10, 7, cam)).toBe(true)
    expect(thumbIsStale({ ...fresh, thumb: undefined }, 10, 6, cam)).toBe(true)
  })
  it("es refà si es mou la càmera encara que `updatedAt` no canviï", () => {
    expect(thumbIsStale(fresh, 10, 6, { ...cam, target: [0.2, 0.4, 0] })).toBe(true)
  })
  it("les antigues (sense `thumbCam`): es refan només si el document té càmera", () => {
    const old = { thumb: "data:x", thumbAt: 10, thumbV: 6 }
    expect(thumbIsStale(old, 10, 6, undefined)).toBe(false)
    expect(thumbIsStale(old, 10, 6, cam)).toBe(true)
  })
})

describe("mida del visor", () => {
  it("la del moble, per passar la càmera del visor (centrat) a la miniatura", () => {
    const m = defaultModule("m1", "Mòdul")
    const comp: Composition = { modules: [m], references: [] }
    const s = viewerSize(comp)
    expect(s.width).toBe(m.carcass.width)
    expect(s.depth).toBe(m.carcass.depth + m.carcass.thickness)
  })
})
