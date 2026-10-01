import { describe, expect, it } from "vitest"
import { base64ToBlob, blobToBase64 } from "./mobleIo"

describe("Blob ↔ base64 (fotos i models 3D del .moble)", () => {
  it("anada i tornada amb bytes binaris", async () => {
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 0, 255, 128, 7])
    const data = await blobToBase64(new Blob([bytes], { type: "model/gltf-binary" }))
    const back = base64ToBlob(data, "model/gltf-binary")
    expect(back.type).toBe("model/gltf-binary")
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes)
  })
})
