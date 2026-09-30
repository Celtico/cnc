/**
 * Filtre de soroll del render (À-Trous guiat per l'albedo i la normal, com els «denoisers» dels
 * programes de render): es treu el color de la superfície (albedo) per filtrar només la llum,
 * es fan 5 passades amb forats cada cop més amples respectant les vores (normal i albedo
 * diferents) i es torna a multiplicar per l'albedo. Així les textures i les arestes queden nítides.
 *
 * `color` i `albedo`: RGB lineal (3 per píxel, mitjanes); `normal`: 3 per píxel. `strength`
 * (≈ soroll esperat) baixa amb les passades acumulades.
 */
export function denoise(w: number, h: number, color: Float32Array, albedo: Float32Array, normal: Float32Array, strength: number): Float32Array {
  const n = w * h
  let cur = new Float32Array(n * 3)
  const eps = 0.02
  for (let i = 0; i < n * 3; i++) cur[i] = color[i]! / (albedo[i]! + eps)
  let next = new Float32Array(n * 3)
  const K = [1 / 16, 1 / 4, 3 / 8, 1 / 4, 1 / 16]
  for (let it = 0; it < 5; it++) {
    const step = 1 << it
    const sc = strength / (1 << it) + 0.02
    const inv2c = 1 / (2 * sc * sc)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        const r0 = cur[p * 3]!, g0 = cur[p * 3 + 1]!, b0 = cur[p * 3 + 2]!
        const l0 = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0
        const nx0 = normal[p * 3]!, ny0 = normal[p * 3 + 1]!, nz0 = normal[p * 3 + 2]!
        const a0 = albedo[p * 3]!, a1 = albedo[p * 3 + 1]!, a2 = albedo[p * 3 + 2]!
        let sr = 0, sg = 0, sb = 0, sw = 0
        for (let j = -2; j <= 2; j++) {
          const yy = y + j * step
          if (yy < 0 || yy >= h) continue
          for (let i = -2; i <= 2; i++) {
            const xx = x + i * step
            if (xx < 0 || xx >= w) continue
            const q = yy * w + xx
            const r = cur[q * 3]!, g = cur[q * 3 + 1]!, b = cur[q * 3 + 2]!
            const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
            // Diferència relativa de llum (la llum forta i la feble es filtren igual).
            const dl = (l - l0) / (Math.max(l, l0) + 0.05)
            const wl = Math.exp(-dl * dl * inv2c)
            const dn = nx0 * normal[q * 3]! + ny0 * normal[q * 3 + 1]! + nz0 * normal[q * 3 + 2]!
            const wn = Math.pow(Math.max(0, dn), 32)
            const da = Math.abs(a0 - albedo[q * 3]!) + Math.abs(a1 - albedo[q * 3 + 1]!) + Math.abs(a2 - albedo[q * 3 + 2]!)
            const wa = Math.exp(-da * 8)
            const wt = K[i + 2]! * K[j + 2]! * wl * (nx0 === 0 && ny0 === 0 && nz0 === 0 ? 1 : wn) * wa
            sr += r * wt; sg += g * wt; sb += b * wt; sw += wt
          }
        }
        next[p * 3] = sr / sw
        next[p * 3 + 1] = sg / sw
        next[p * 3 + 2] = sb / sw
      }
    const t = cur
    cur = next
    next = t
  }
  for (let i = 0; i < n * 3; i++) cur[i] = cur[i]! * (albedo[i]! + eps)
  return cur
}
