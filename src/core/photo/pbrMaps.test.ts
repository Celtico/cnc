import { describe, expect, it } from "vitest"
import { averageColor, classifyTextureFile, fileTokens, fitSize, flipGreen, floatToRgba8, groupTextureSets, planTextureSet, textureSetKey, toGrayscale } from "./pbrMaps"

describe("classifyTextureFile", () => {
  it("reconeix els noms de Poly Haven", () => {
    expect(classifyTextureFile("oak_veneer_01_diff_1k.jpg")).toEqual({ slot: "color" })
    expect(classifyTextureFile("oak_veneer_01_nor_gl_1k.jpg")).toEqual({ slot: "normal", directX: false })
    expect(classifyTextureFile("oak_veneer_01_nor_dx_2k.png")).toEqual({ slot: "normal", directX: true })
    expect(classifyTextureFile("oak_veneer_01_rough_1k.jpg")).toEqual({ slot: "rough" })
    expect(classifyTextureFile("oak_veneer_01_arm_1k.jpg")).toEqual({ slot: "rough", channel: "g" })
    expect(classifyTextureFile("oak_veneer_01_disp_1k.png")).toBeNull()
    expect(classifyTextureFile("oak_veneer_01_ao_1k.jpg")).toBeNull()
  })

  it("reconeix els de l'app i d'ambientCG (majúscules, dues paraules)", () => {
    expect(classifyTextureFile("textures/oak/diff.jpg")).toEqual({ slot: "color" })
    expect(classifyTextureFile("nor.jpg")).toEqual({ slot: "normal" })
    expect(classifyTextureFile("rough.jpg")).toEqual({ slot: "rough" })
    expect(classifyTextureFile("Wood049_1K-JPG_Color.jpg")).toEqual({ slot: "color" })
    expect(classifyTextureFile("Wood049_1K-JPG_NormalGL.jpg")).toEqual({ slot: "normal", directX: false })
    expect(classifyTextureFile("Wood049_1K-JPG_NormalDX.jpg")).toEqual({ slot: "normal", directX: true })
    expect(classifyTextureFile("Wood049_1K-JPG_Roughness.jpg")).toEqual({ slot: "rough" })
    expect(classifyTextureFile("Wood049_1K-JPG_AmbientOcclusion.jpg")).toBeNull()
    expect(classifyTextureFile("Wood049_1K-JPG_Displacement.jpg")).toBeNull()
    expect(classifyTextureFile("Planks_Base_Color.png")).toEqual({ slot: "color" })
    expect(classifyTextureFile("planks_albedo.webp")).toEqual({ slot: "color" })
    expect(classifyTextureFile("planks_ORM.png")).toEqual({ slot: "rough", channel: "g" })
    expect(classifyTextureFile("planks_nrm.png")).toEqual({ slot: "normal" })
  })

  it("mana l'última paraula (el nom del material va al davant)", () => {
    expect(classifyTextureFile("rough_plaster_diff_1k.jpg")?.slot).toBe("color")
    expect(classifyTextureFile("rough_plaster_nor_gl_1k.jpg")?.slot).toBe("normal")
    expect(classifyTextureFile("metal_plate_rough_1k.jpg")?.slot).toBe("rough")
    expect(classifyTextureFile("metal_plate_metal_1k.jpg")).toBeNull()
  })

  it("no fa cas del que no és imatge o no és cap mapa", () => {
    expect(classifyTextureFile("oak_veneer_01.blend")).toBeNull()
    expect(classifyTextureFile("readme.txt")).toBeNull()
    expect(classifyTextureFile("photo.jpg")).toBeNull()
  })

  it("parteix el nom en paraules", () => {
    expect(fileTokens("a/b/Wood049_1K-JPG_NormalGL.jpg")).toEqual(["wood049", "1k", "jpg", "normal", "gl"])
    expect(fileTokens("WoodARM.png")).toEqual(["wood", "arm"])
  })
})

describe("planTextureSet", () => {
  it("reparteix un joc sencer i deixa la resta", () => {
    const p = planTextureSet(["x/oak_diff_1k.jpg", "x/oak_nor_gl_1k.jpg", "x/oak_nor_dx_1k.jpg", "x/oak_rough_1k.jpg", "x/oak_disp_1k.png", "x/oak.blend"])
    expect(p.color?.path).toBe("x/oak_diff_1k.jpg")
    expect(p.normal).toEqual({ path: "x/oak_nor_gl_1k.jpg", slot: "normal", directX: false })
    expect(p.rough?.path).toBe("x/oak_rough_1k.jpg")
    expect(p.ignored.sort()).toEqual(["x/oak.blend", "x/oak_disp_1k.png", "x/oak_nor_dx_1k.jpg"])
  })

  it("prefereix el normal OpenGL i la rugositat pròpia encara que vinguin després", () => {
    const p = planTextureSet(["a_nor_dx.jpg", "a_arm.jpg", "a_nor_gl.jpg", "a_rough.jpg"])
    expect(p.normal?.path).toBe("a_nor_gl.jpg")
    expect(p.rough).toEqual({ path: "a_rough.jpg", slot: "rough" })
    expect(p.color).toBeUndefined()
  })

  it("un ARM sol fa de rugositat (canal verd)", () => {
    expect(planTextureSet(["a_arm.jpg"]).rough).toEqual({ path: "a_arm.jpg", slot: "rough", channel: "g" })
  })
})

describe("operacions de píxels", () => {
  it("inverteix el verd (i dues vegades torna a ser igual)", () => {
    const d = new Uint8ClampedArray([128, 200, 255, 255, 10, 0, 20, 255])
    flipGreen(d)
    expect([...d]).toEqual([128, 55, 255, 255, 10, 255, 20, 255])
    flipGreen(d)
    expect([...d]).toEqual([128, 200, 255, 255, 10, 0, 20, 255])
  })

  it("passa a grisos amb la mitjana o el canal verd", () => {
    const d = new Uint8ClampedArray([30, 60, 90, 100, 7, 7, 7, 0])
    toGrayscale(d)
    expect([...d]).toEqual([60, 60, 60, 255, 7, 7, 7, 255])
    const arm = new Uint8ClampedArray([255, 77, 0, 255])
    toGrayscale(arm, "g")
    expect([...arm]).toEqual([77, 77, 77, 255])
  })

  it("color mitjà i mida reduïda", () => {
    expect(averageColor(new Uint8ClampedArray([0, 0, 0, 255, 255, 128, 2, 255]))).toBe("#804001")
    expect(fitSize(2048, 1024)).toEqual({ w: 1024, h: 512 })
    expect(fitSize(4000, 3000)).toEqual({ w: 1024, h: 768 })
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 })
  })
})

describe("EXR i jocs d'un model", () => {
  it("els EXR de Poly Haven («Blend») són mapes; la imatge guanya a l'EXR del mateix mapa", () => {
    expect(classifyTextureFile("textures/potted_plant_04_nor_gl_1k.exr")).toEqual({ slot: "normal", directX: false })
    expect(classifyTextureFile("textures/potted_plant_04_rough_1k.exr")).toEqual({ slot: "rough" })
    const plan = planTextureSet(["a_rough_1k.exr", "a_rough_1k.jpg", "a_nor_gl_1k.exr", "a_diff_1k.jpg", "a_disp_1k.png"])
    expect(plan.rough?.path).toBe("a_rough_1k.jpg")
    expect(plan.normal?.path).toBe("a_nor_gl_1k.exr")
    // Rugositat pròpia en EXR abans que l'ARM.
    expect(planTextureSet(["a_rough_1k.exr", "a_arm_1k.jpg"]).rough?.path).toBe("a_rough_1k.exr")
  })

  it("agrupa els mapes per material", () => {
    expect(textureSetKey("textures/potted_plant_04_nor_gl_1k.jpg")).toBe("potted plant 04")
    expect(textureSetKey("rough_plaster_brick_04_diff_1k.jpg")).toBe("rough plaster brick 04")
    expect(textureSetKey("Wood049_1K-JPG_NormalGL.jpg")).toBe("wood049")
    expect(textureSetKey("Planks_Base_Color.png")).toBe("planks")
    expect(textureSetKey("diff.jpg")).toBe("")
    expect(textureSetKey("photo.jpg")).toBeNull()
    expect(textureSetKey("a.bin")).toBeNull()
    const groups = groupTextureSets([
      "textures/chair_body_diff_1k.jpg",
      "textures/chair_legs_diff_1k.jpg",
      "textures/chair_body_nor_gl_1k.jpg",
      "textures/chair_legs_arm_1k.jpg",
      "chair.bin",
    ])
    expect(groups).toEqual([
      { key: "chair body", paths: ["textures/chair_body_diff_1k.jpg", "textures/chair_body_nor_gl_1k.jpg"] },
      { key: "chair legs", paths: ["textures/chair_legs_diff_1k.jpg", "textures/chair_legs_arm_1k.jpg"] },
    ])
  })

  it("passa els píxels de coma flotant a 8 bits (de baix a dalt → de dalt a baix)", () => {
    // 1 × 2: a baix (fila 0 de l'EXR) vermell 1, a dalt 0,5 gris.
    const data = [1, 0, 0, 1, 0.5, 0.5, 0.5, 1]
    expect([...floatToRgba8(data, 1, 2)]).toEqual([128, 128, 128, 255, 255, 0, 0, 255])
    expect([...floatToRgba8(data, 1, 2, { flipY: false })]).toEqual([255, 0, 0, 255, 128, 128, 128, 255])
    // Fora de 0–1 i NaN es retallen; sRGB per al color.
    expect([...floatToRgba8([2, -1, Number.NaN, 0], 1, 1)]).toEqual([255, 0, 0, 255])
    expect(floatToRgba8([0.5, 0.5, 0.5, 1], 1, 1, { srgb: true })[0]).toBe(188)
  })
})
