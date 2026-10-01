import { describe, expect, it } from "vitest"
import { AmbientSchema, parseAmbient } from "./ambient"
import { CompositionSchema, type Composition } from "./composition"
import { parseCameraPose, sameCameraPose, type CameraPose } from "./camera"

const cam: CameraPose = { position: [1.4, 1.1, 1.9], target: [0, 0.4, 0], fov: 38 }
const comp: Composition = { modules: [], references: [] }

describe("càmera desada", () => {
  it("composició: opcional i compatible amb les antigues", () => {
    const old = CompositionSchema.parse(comp)
    expect(old.camera).toBeUndefined()
    expect("camera" in old && old.camera !== undefined).toBe(false)
    expect(CompositionSchema.parse({ ...comp, camera: cam }).camera).toEqual(cam)
  })
  it("una càmera no vàlida es descarta sense invalidar el document", () => {
    const bad = { ...comp, camera: { position: [Number.NaN, 0, 0], target: [0, 0, 0] } }
    const r = CompositionSchema.safeParse(bad)
    expect(r.success).toBe(true)
    expect(r.success && r.data.camera).toBeUndefined()
    expect(CompositionSchema.safeParse({ ...comp, camera: "x" }).success).toBe(true)
    expect(parseCameraPose({ position: [0, 0], target: [0, 0, 0] })).toBeUndefined()
    // JSON converteix NaN a null
    expect(parseCameraPose(JSON.parse(JSON.stringify({ position: [Number.NaN, 0, 0], target: [0, 0, 0] })))).toBeUndefined()
  })
  it("ambient: opcional, i el camí tolerant també la llegeix", () => {
    const a = { walls: [], items: [] }
    expect(AmbientSchema.parse(a).camera).toBeUndefined()
    expect(parseAmbient({ ...a, camera: cam }).camera).toEqual(cam)
    // Ambient amb una altra part trencada: la càmera vàlida es conserva.
    expect(parseAmbient({ walls: "x", items: [], camera: cam }).camera).toEqual(cam)
    expect(parseAmbient({ walls: "x", items: [], camera: { position: [1] } }).camera).toBeUndefined()
  })
  it("sameCameraPose amb tolerància", () => {
    expect(sameCameraPose(cam, { ...cam, position: [1.401, 1.1, 1.9] })).toBe(true)
    expect(sameCameraPose(cam, { ...cam, position: [1.5, 1.1, 1.9] })).toBe(false)
    expect(sameCameraPose(cam, { ...cam, fov: 55 })).toBe(false)
  })
})
