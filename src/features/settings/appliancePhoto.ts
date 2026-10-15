import { clearWhiteBackground } from "../../core/photo/whiteBackground"
import { shrinkImage } from "../../lib/imageShrink"

/** Costat llarg de la foto d'un electrodomèstic (px): la cara de l'aparell al 3D, a la miniatura i al selector. */
const MAX_PX = 768

/**
 * La foto que puja l'usuari per a un electrodomèstic (Preferències › Ferratges › «Aspecte»; per petició de l'usuari,
 * 2026-10-15: «que es pugui canviar la foto»): reduïda (`shrinkImage`, la de tota l'app; les transparències, sobre
 * blanc), **sense el fons blanc** (`clearWhiteBackground`, la mateixa regla que les fotos de l'app) i retallada a
 * l'aparell. Torna una data URL (WebP amb transparència; on el navegador no en sap fer, PNG) que es desa a l'item com la
 * foto d'un material: viatja amb les còpies dels mòduls i amb els `.moble`, i funciona sense connexió.
 */
export async function encodeAppliancePhoto(file: Blob): Promise<string> {
  const { blob } = await shrinkImage(file, MAX_PX, { jpeg: true, quality: 0.95 })
  const bitmap = await createImageBitmap(blob)
  try {
    const w = bitmap.width
    const h = bitmap.height
    if (!w || !h) throw new Error("La imatge és buida.")
    const c = document.createElement("canvas")
    c.width = w
    c.height = h
    const g = c.getContext("2d", { willReadFrequently: true })
    if (!g) throw new Error("El navegador no deixa dibuixar la imatge.")
    g.drawImage(bitmap, 0, 0)
    const data = g.getImageData(0, 0, w, h)
    const box = clearWhiteBackground(data.data, w, h)
    if (!box) throw new Error("La foto és tota blanca: no s'hi veu cap aparell.")
    g.putImageData(data, 0, 0)
    const out = document.createElement("canvas")
    out.width = box.w
    out.height = box.h
    out.getContext("2d")!.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
    c.width = c.height = 0
    const src = out.toDataURL("image/webp", 0.85)
    out.width = out.height = 0
    return src
  } finally {
    bitmap.close()
  }
}
