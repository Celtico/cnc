import { floatToRgba8 } from "../../core/photo/pbrMaps"

/**
 * OpenEXR → imatge de 8 bits (canvas), per als mapes dels zips «Blend» de Poly Haven (normal i rugositat en EXR). Amb
 * l'`EXRLoader` de three (a demanda). Els mapes de dades passen tal qual (0–1 → 0–255: el normal es queda OpenGL); el
 * color (`srgb`), de lineal a sRGB.
 */

/** Capçalera d'un OpenEXR (`v/1\x01`). */
function isExrBytes(head: Uint8Array): boolean {
  return head.length >= 4 && head[0] === 0x76 && head[1] === 0x2f && head[2] === 0x31 && head[3] === 0x01
}

export async function isExrBlob(blob: Blob): Promise<boolean> {
  return isExrBytes(new Uint8Array(await blob.slice(0, 4).arrayBuffer()))
}

/** Descodifica un EXR en un canvas RGBA de 8 bits (de dalt a baix). Errors en català. */
export async function exrToCanvas(data: Blob | ArrayBuffer, opts: { srgb?: boolean } = {}): Promise<HTMLCanvasElement> {
  const [{ FloatType }, { EXRLoader }] = await Promise.all([import("three"), import("three/examples/jsm/loaders/EXRLoader.js")])
  const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer()
  let r: { width: number; height: number; data: ArrayLike<number> }
  try {
    r = new EXRLoader().setDataType(FloatType).parse(buffer) as unknown as typeof r
  } catch {
    throw new Error("No s'ha pogut llegir el fitxer EXR.")
  }
  const { width: w, height: h } = r
  if (!w || !h) throw new Error("El fitxer EXR és buit.")
  const px = floatToRgba8(r.data, w, h, { srgb: !!opts.srgb })
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d")
  if (!ctx) throw new Error("El navegador no deixa dibuixar la imatge.")
  ctx.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)
  return c
}

/** EXR → PNG (per servir-lo a un carregador que espera una imatge: les textures reaprofitades d'un zip «Blend»). */
export async function exrToPngBlob(data: Blob, opts: { srgb?: boolean } = {}): Promise<Blob> {
  const c = await exrToCanvas(data, opts)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"))
  c.width = c.height = 0
  if (!blob) throw new Error("No s'ha pogut convertir el fitxer EXR.")
  return blob
}
