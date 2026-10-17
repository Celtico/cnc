/**
 * Redueix una imatge a un màxim de `maxSide` px pel costat llarg (una sola funció per a tota l'app: la foto del lloc,
 * el plànol de fons dels ambients i les fotos que s'envien a l'assistent IA). Si ja és prou petita i no cal `jpeg`, es
 * torna tal qual. Amb `jpeg`, sempre JPEG (les transparències, sobre blanc): l'API de Claude no llegeix HEIC.
 */
export async function shrinkImage(file: Blob, maxSide: number, { jpeg = false, quality = 0.9 }: { jpeg?: boolean; quality?: number } = {}): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale >= 1 && (!jpeg || file.type === "image/jpeg")) {
    const out = { blob: file, width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return out
  }
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const { canvas } = drawScaled(bitmap, width, height)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No s'ha pogut reduir la imatge"))), "image/jpeg", quality))
  return { blob, width, height }
}

/**
 * Pinta la imatge a `width × height` en un canvas nou, sobre blanc (les transparències no queden negres), i tanca el
 * bitmap. Serveix per reduir-la (`shrinkImage`) o per llegir-ne els píxels (el relleu d'una imatge).
 */
export function drawScaled(bitmap: ImageBitmap, width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No es pot llegir la imatge")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return { canvas, ctx }
}
