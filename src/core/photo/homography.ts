/**
 * Homografia 2D (matriu 3×3, files) que porta punts d'un pla a la imatge.
 * Tot en `number`: mm al pla, píxels a la imatge.
 */

export type Pt = readonly [number, number]
/** Matriu 3×3 per files: [h11, h12, h13, h21, h22, h23, h31, h32, h33]. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

/** Resol A·x = b (n×n) per eliminació de Gauss amb pivot parcial. Retorna null si és singular. */
export function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]!])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null
    if (pivot !== col) [m[col], m[pivot]] = [m[pivot]!, m[col]!]
    const p = m[col]![col]!
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r]![col]! / p
      if (f === 0) continue
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!
    }
  }
  return m.map((row, i) => row[n]! / row[i]!)
}

/**
 * Homografia exacta que porta `src[i]` a `dst[i]` (4 parelles, cap tres de colineals).
 * Es fixa h33 = 1 i es resolen els 8 coeficients restants.
 */
export function computeHomography(src: readonly Pt[], dst: readonly Pt[]): Mat3 | null {
  if (src.length !== 4 || dst.length !== 4) return null
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]!
    const [u, v] = dst[i]!
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solveLinear(a, b)
  if (!h) return null
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1]
}

export function applyHomography(h: Mat3, p: Pt): Pt {
  const [x, y] = p
  const w = h[6] * x + h[7] * y + h[8]
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]
}

export function invertMat3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-18) return null
  const inv = 1 / det
  return [
    A * inv,
    -(b * i - c * h) * inv,
    (b * f - c * e) * inv,
    B * inv,
    (a * i - c * g) * inv,
    -(a * f - c * d) * inv,
    C * inv,
    -(a * h - b * g) * inv,
    (a * e - b * d) * inv,
  ]
}

export function mulMat3(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = []
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!)
  return r as unknown as Mat3
}

/** Punts (mm) del rectangle de referència en l'ordre: baix-esquerra, baix-dreta, dalt-dreta, dalt-esquerra. */
export function rectanglePoints(w: number, h: number): [Pt, Pt, Pt, Pt] {
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]
}

/**
 * Homografia pla (mm) → imatge (px) a partir dels 4 punts marcats sobre un
 * rectangle de `w` × `h` mm, en el mateix ordre que `rectanglePoints`.
 */
export function planeToImage(imagePts: readonly Pt[], w: number, h: number): Mat3 | null {
  return computeHomography(rectanglePoints(w, h), imagePts)
}
