import type { RenderEnv } from "./sceneData"

/**
 * Lector de fitxers `.hdr` (Radiance RGBE, el format dels cels HDRI de Poly Haven): torna la
 * imatge equirectangular en RGB lineal, reduïda a `maxW` d'amplada (per als workers del render).
 */
export function parseHdr(buf: ArrayBuffer, maxW = 1024): RenderEnv {
  const b = new Uint8Array(buf)
  let p = 0
  const line = () => {
    let s = ""
    while (p < b.length && b[p] !== 10) s += String.fromCharCode(b[p++]!)
    p++
    return s
  }
  if (!line().startsWith("#?")) throw new Error("No és un fitxer HDR (Radiance)")
  let l: string
  while ((l = line()) !== "") if (l.startsWith("FORMAT") && !l.includes("32-bit_rle_rgbe")) throw new Error("Format HDR no suportat")
  const m = /-Y (\d+) \+X (\d+)/.exec(line())
  if (!m) throw new Error("Capçalera HDR no suportada")
  const H = Number(m[1]), W = Number(m[2])
  const rgbe = new Uint8Array(W * H * 4)
  const row = new Uint8Array(W * 4)
  for (let y = 0; y < H; y++) {
    if (b[p] === 2 && b[p + 1] === 2 && ((b[p + 2]! << 8) | b[p + 3]!) === W) {
      // RLE nou: cada canal per separat.
      p += 4
      for (let c = 0; c < 4; c++) {
        let x = 0
        while (x < W) {
          let n = b[p++]!
          if (n > 128) {
            n -= 128
            const v = b[p++]!
            while (n--) row[(x++) * 4 + c] = v
          } else while (n--) row[(x++) * 4 + c] = b[p++]!
        }
      }
    } else {
      for (let x = 0; x < W * 4; x++) row[x] = b[p++]!
    }
    rgbe.set(row, y * W * 4)
  }
  const k = Math.max(1, Math.ceil(W / maxW))
  const w = Math.floor(W / k), h = Math.floor(H / k)
  const data = new Float32Array(w * h * 3)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, bb = 0
      for (let j = 0; j < k; j++)
        for (let i = 0; i < k; i++) {
          const q = ((y * k + j) * W + x * k + i) * 4
          const e = rgbe[q + 3]!
          if (!e) continue
          const f = Math.pow(2, e - 136)
          r += rgbe[q]! * f; g += rgbe[q + 1]! * f; bb += rgbe[q + 2]! * f
        }
      const o = (y * w + x) * 3
      data[o] = r / (k * k); data[o + 1] = g / (k * k); data[o + 2] = bb / (k * k)
    }
  return { w, h, data }
}
