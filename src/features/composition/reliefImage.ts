import { encodeLevels, type ImageRelief } from "../../core/model"

/**
 * Llegeix una imatge (qualsevol format que obri el navegador) com a relleu: reduïda a `maxSide` píxels pel costat llarg i
 * en grisos (luminància). Per a `RefObject.image` (`core/model/imageRelief.ts`).
 */
export async function readReliefImage(file: File, maxSide = 240): Promise<ImageRelief> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.max(2, Math.round(bmp.width * k)), h = Math.max(2, Math.round(bmp.height * k))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No es pot llegir la imatge")
  // Fons blanc (les transparents, com un PNG amb fons transparent: el que no hi ha no es buida).
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const px = ctx.getImageData(0, 0, w, h).data
  const levels = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) levels[i] = Math.round(0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!)
  return { w, h, data: encodeLevels(levels), name: file.name }
}
