import { describe, expect, it } from "vitest"
import { buildCabinet } from "../../core/build/buildCabinet"
import { DEFAULT_CABINET } from "../../core/model"
import { buildScene } from "./exportGlb"
import { exportUsdz } from "./exportUsdz"

describe("exportUsdz", () => {
  const panels = buildCabinet(DEFAULT_CABINET)

  it("l'escena és en metres amb la base a y = 0", () => {
    const scene = buildScene(panels, "prova")
    scene.updateMatrixWorld(true)
    let minY = Infinity
    let maxY = -Infinity
    scene.traverse((o) => {
      if (!("geometry" in o)) return
      const mesh = o as import("three").Mesh
      mesh.geometry.computeBoundingBox()
      const bb = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
      minY = Math.min(minY, bb.min.y)
      maxY = Math.max(maxY, bb.max.y)
    })
    expect(minY).toBeCloseTo(0, 6)
    expect(maxY).toBeCloseTo(0.72, 6)
  })

  it("genera un zip USDZ amb model.usda i una malla per peça", async () => {
    const blob = await exportUsdz(panels, "Mòdul prova")
    expect(blob.type).toBe("model/vnd.usdz+zip")
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(1000)
    // Signatura ZIP "PK\x03\x04".
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const text = new TextDecoder("latin1").decode(bytes)
    expect(text).toContain("model.usda")
    expect(text).toContain("metersPerUnit = 1")
    expect(text.match(/def Mesh/g)?.length).toBe(panels.length)
  })

  it("les peces amb retalls s'exporten amb els forats (reixa, taulell…)", async () => {
    const base = panels[0]!
    const holed = { ...base, id: "reixa", cutouts: [{ kind: "slot" as const, x: 50, y: 50, w: 200, h: 10 }] }
    const scene = buildScene([holed], "reixa")
    let mesh: import("three").Mesh | undefined
    scene.traverse((o) => {
      if ((o as import("three").Mesh).isMesh) mesh = o as import("three").Mesh
    })
    // Extruïda (amb els cantells repartits en grups, `shapedGeometry`), no una caixa.
    expect(mesh!.geometry.type).not.toBe("BoxGeometry")
    mesh!.geometry.computeBoundingBox()
    const bb = mesh!.geometry.boundingBox!
    expect(bb.max.x).toBeCloseTo(base.length / 1000, 6)
    expect(bb.max.z).toBeCloseTo(base.thickness / 1000, 6)
    const blob = await exportUsdz([holed], "reixa")
    expect(blob.size).toBeGreaterThan(1000)
  })
})
