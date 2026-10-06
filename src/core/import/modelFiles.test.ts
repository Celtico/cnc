import { describe, expect, it } from "vitest"
import { findFile, modelDisplayName, modelFormatOf, pickMainModel, resolveUri } from "./modelFiles"

describe("modelFiles", () => {
  it("reconeix els formats", () => {
    expect(modelFormatOf("a.GLB")).toBe("glb")
    expect(modelFormatOf("x/potted_plant_04_1k.gltf")).toBe("gltf")
    expect(modelFormatOf("a.fbx")).toBe("fbx")
    expect(modelFormatOf("potted_plant_04_1k.blend")).toBe("blend")
    expect(modelFormatOf("a.usdc")).toBe("usd")
    expect(modelFormatOf("a.obj")).toBe("other")
    expect(modelFormatOf("potted_plant_04.bin")).toBeNull()
    expect(modelFormatOf("textures/a_diff_1k.jpg")).toBeNull()
  })

  it("tria el model del conjunt (zip de Poly Haven, carpetes, metadades del Mac)", () => {
    expect(pickMainModel(["potted_plant_04.bin", "textures/potted_plant_04_diff_1k.jpg", "potted_plant_04_1k.gltf"])).toEqual({ path: "potted_plant_04_1k.gltf", format: "gltf" })
    expect(pickMainModel(["a.blend", "textures/a_diff_1k.jpg"])).toEqual({ path: "a.blend", format: "blend" })
    expect(pickMainModel(["__MACOSX/._a.glb", "a.fbx", "b.gltf"])?.path).toBe("b.gltf")
    expect(pickMainModel(["deep/x/a.gltf", "a.gltf"])?.path).toBe("a.gltf")
    expect(pickMainModel(["textures/a_diff_1k.jpg"])).toBeNull()
  })

  it("resol les URI relatives", () => {
    expect(resolveUri("", "textures/a_diff_1k.jpg")).toBe("textures/a_diff_1k.jpg")
    expect(resolveUri("plant/", "./textures/a%20b.jpg")).toBe("plant/textures/a b.jpg")
    expect(resolveUri("plant/sub/", "..\\tex\\a.png")).toBe("plant/tex/a.png")
    expect(resolveUri("", "C:\\Users\\x\\a.png")).toBe("a.png")
    expect(resolveUri("", "data:image/png;base64,AA")).toBeNull()
    expect(resolveUri("", "https://x.org/a.png")).toBeNull()
  })

  it("troba el fitxer (exacte, majúscules, pel nom)", () => {
    const paths = ["plant/potted_plant_04.bin", "plant/textures/A_diff.jpg", "other/b.png"]
    expect(findFile(paths, "plant/potted_plant_04.bin")).toBe("plant/potted_plant_04.bin")
    expect(findFile(paths, "plant/textures/a_DIFF.jpg")).toBe("plant/textures/A_diff.jpg")
    expect(findFile(paths, "b.png")).toBe("other/b.png")
    expect(findFile(paths, "c.png")).toBeNull()
  })

  it("nom del model", () => {
    expect(modelDisplayName("x/potted_plant_04_1k.gltf")).toBe("potted_plant_04")
    expect(modelDisplayName("Cadira.glb")).toBe("Cadira")
  })
})
