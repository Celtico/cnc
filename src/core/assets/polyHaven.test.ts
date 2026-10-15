import { describe, expect, it } from "vitest"
import { parsePolyHavenInfo, parsePolyHavenName, pickResolution, planPolyHavenDownload, polyHavenRefOf, polyHavenTitle, textureTileMm } from "./polyHaven"

// Retall de la resposta real de https://api.polyhaven.com/files/potted_plant_04 (2026-10).
const FILES = {
  gltf: {
    "1k": {
      gltf: {
        url: "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/potted_plant_04/potted_plant_04_1k.gltf",
        size: 7081,
        include: {
          "potted_plant_04.bin": { url: "https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/potted_plant_04/potted_plant_04.bin", size: 241800 },
          "textures/potted_plant_04_nor_gl_1k.jpg": { url: "https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/potted_plant_04/potted_plant_04_nor_gl_1k.jpg", size: 817786 },
          "textures/potted_plant_04_arm_1k.jpg": { url: "https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/potted_plant_04/potted_plant_04_arm_1k.jpg", size: 478413 },
          "textures/potted_plant_04_diff_1k.jpg": { url: "https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/potted_plant_04/potted_plant_04_diff_1k.jpg", size: 577545 },
        },
      },
    },
    "2k": { gltf: { url: "https://x/potted_plant_04_2k.gltf", size: 7000, include: {} } },
    "4k": { gltf: { url: "https://x/potted_plant_04_4k.gltf", size: 7000, include: {} } },
  },
}

describe("Poly Haven", () => {
  it("llegeix l'id i la resolució del nom", () => {
    expect(parsePolyHavenName("potted_plant_04_1k.blend")).toEqual({ id: "potted_plant_04", res: "1k" })
    expect(parsePolyHavenName("x/rough_plaster_brick_04_2k.gltf")).toEqual({ id: "rough_plaster_brick_04", res: "2k" })
    expect(parsePolyHavenName("potted_plant_04_1k_blend.zip")).toEqual({ id: "potted_plant_04", res: "1k" })
    expect(parsePolyHavenName("Fern_02_4K.blend.zip")).toEqual({ id: "fern_02", res: "4k" })
    expect(parsePolyHavenName("my chair.blend")).toBeNull()
    expect(parsePolyHavenName("chair.blend")).toBeNull()
    expect(polyHavenRefOf(["textures/a_diff_1k.jpg", "potted_plant_04_1k.blend"])).toEqual({ id: "potted_plant_04", res: "1k" })
    expect(polyHavenRefOf(["model.blend"], "potted_plant_04_2k.zip")).toEqual({ id: "potted_plant_04", res: "2k" })
    expect(polyHavenTitle("potted_plant_04")).toBe("Potted plant 04")
  })

  it("tria la resolució (com a molt 2k)", () => {
    expect(pickResolution("1k", ["1k", "2k", "4k"])).toBe("1k")
    expect(pickResolution("8k", ["1k", "2k", "4k", "8k"])).toBe("2k")
    expect(pickResolution("2k", ["1k", "4k"])).toBe("1k")
    expect(pickResolution("1k", ["4k", "8k"])).toBe("4k")
    expect(pickResolution("1k", [])).toBeNull()
  })

  it("planifica la baixada del glTF i no torna a baixar les textures del zip «Blend»", () => {
    const local = ["potted_plant_04_1k.blend", "textures/potted_plant_04_nor_gl_1k.exr", "textures/potted_plant_04_rough_1k.exr", "textures/potted_plant_04_diff_1k.jpg"]
    const plan = planPolyHavenDownload(FILES, "1k", local)!
    expect(plan.res).toBe("1k")
    expect(plan.main.path).toBe("potted_plant_04_1k.gltf")
    expect(plan.fetch.map((f) => f.path).sort()).toEqual(["potted_plant_04.bin", "textures/potted_plant_04_arm_1k.jpg"])
    expect(plan.reuse).toEqual([
      { path: "textures/potted_plant_04_nor_gl_1k.jpg", local: "textures/potted_plant_04_nor_gl_1k.exr" },
      { path: "textures/potted_plant_04_diff_1k.jpg", local: "textures/potted_plant_04_diff_1k.jpg" },
    ])
    expect(plan.bytes).toBe(7081 + 241800 + 478413)
    // 8k demanat → 2k (sense textures locals: tot es baixa).
    expect(planPolyHavenDownload(FILES, "8k", [])!.main.url).toContain("_2k.gltf")
    expect(planPolyHavenDownload(FILES, "1k", [], "fbx")).toBeNull()
    expect(planPolyHavenDownload({ gltf: "x" }, "1k", [])).toBeNull()
    expect(planPolyHavenDownload(null, "1k", [])).toBeNull()
  })

  it("info i mida real de les textures", () => {
    const tex = parsePolyHavenInfo({ name: "Rough Plaster Brick 04", type: 1, dimensions: [2000, 2000], scale: "2Mx2M" })
    expect(tex).toEqual({ name: "Rough Plaster Brick 04", type: 1, dimensions: [2000, 2000] })
    expect(textureTileMm(tex)).toBe(2000)
    const model = parsePolyHavenInfo({ name: "Potted Plant 04", type: 2, dimensions: [170.27, 185.9, 267.6] })
    expect(textureTileMm(model)).toBe(270)
    expect(textureTileMm(null, 800)).toBe(800)
    expect(textureTileMm({ name: "Arbre", type: 2, dimensions: [7500, 19000] })).toBe(5000)
    expect(parsePolyHavenInfo({ name: "" })).toBeNull()
    expect(parsePolyHavenInfo({ name: "X", dimensions: ["a"] })).toEqual({ name: "X" })
  })
})
