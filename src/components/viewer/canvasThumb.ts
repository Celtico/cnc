/** Còpia petita (JPEG, data URL) del que es veu en un canvas WebGL (cal `preserveDrawingBuffer`). */
export function canvasThumb(src: HTMLCanvasElement, maxW = 480): string | null {
  if (!src.width || !src.height) return null
  const k = Math.min(1, maxW / src.width)
  const out = document.createElement("canvas")
  out.width = Math.round(src.width * k)
  out.height = Math.round(src.height * k)
  const ctx = out.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(src, 0, 0, out.width, out.height)
  return out.toDataURL("image/jpeg", 0.8)
}
