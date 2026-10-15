/**
 * **Fons blanc fora** de les fotos de producte (electrodomèstics: per petició de l'usuari, 2026-10-15, la foto del
 * catàleg sortia amb el marc blanc a la cara de l'aparell). Els píxels quasi blancs (els tres canals ≥ `white`)
 * **connectats amb la vora** de la foto passen a transparents; el blanc de dins de l'aparell (la porta d'un rentaplats
 * blanc) no toca la vora per un camí de blancs i es queda. Les fotos de l'app ja ho porten fet
 * (`scripts/appliance-photos.py`, la mateixa regla); les que puja l'usuari, en pujar-les (`settings/appliancePhoto.ts`).
 */

/** Llindar de «quasi blanc» (0–255): el de `scripts/appliance-photos.py`. */
const WHITE_BACKGROUND = 252

/**
 * Treu el fons blanc de `data` (RGBA, `w` × `h`, es modifica: alfa 0 al fons) i torna el rectangle del que queda
 * (`null` si no queda res). Si no hi ha fons, el rectangle és tota la foto.
 */
export function clearWhiteBackground(data: Uint8ClampedArray | Uint8Array, w: number, h: number, white = WHITE_BACKGROUND): { x: number; y: number; w: number; h: number } | null {
  const bg = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (i: number) => {
    if (bg[i]) return
    const o = i * 4
    // Ja transparent (una foto que ja no té fons) o quasi blanc: és fons.
    if (data[o + 3] !== 0 && (data[o]! < white || data[o + 1]! < white || data[o + 2]! < white)) return
    bg[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  while (stack.length) {
    const i = stack.pop()!
    data[i * 4 + 3] = 0
    const x = i % w
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (i >= w) push(i - w)
    if (i < w * (h - 1)) push(i + w)
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bg[y * w + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Rectangle on cap una foto de proporció `aspect` (ample ÷ alt) dins d'una cara `w` × `h`, sencera i centrada (`contain`). */
export function containRect(aspect: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  if (!(aspect > 0)) return { x: 0, y: 0, w, h }
  const fw = Math.min(w, h * aspect)
  const fh = fw / aspect
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh }
}
