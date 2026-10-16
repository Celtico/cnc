import type { Pt } from "../../core/export/xcsPreview"

/**
 * Simulació 3D de la Vista CAM: la cara de dalt del tauler com a **mapa d'alçades** (una cel·la quadrada cada `cell` mm).
 * Cada cel·la guarda l'alçada que queda (de 0, la cara de sota, a `T`, la de dalt) en un byte, ja a punt per pujar-lo a
 * una textura RGBA (R = alçada, G = peça acabada). 0 = passant (s'hi veu el martiri). Pur: el 3D només el pinta.
 */

export type P3 = [number, number, number]

export interface Heightfield {
  L: number
  W: number
  T: number
  cell: number
  nx: number
  ny: number
  /** RGBA per cel·la, fila 0 = la de baix (y petita). */
  data: Uint8Array
  /** Cel·les canviades des de l'últim `takeDirty` (inclusives), o `null`. */
  dirty: { i0: number; j0: number; i1: number; j1: number } | null
}

interface HeightfieldLimits {
  /** Cel·les màximes (memòria i temps de pujar-la). */
  maxCells: number
  /** Cel·la mínima (mm). */
  minCell: number
  /** Cel·les al costat llarg (si no passa de `maxCells`). */
  div: number
}

export const DEFAULT_LIMITS: HeightfieldLimits = { maxCells: 1_500_000, minCell: 1, div: 1200 }
/** iPhone i tauletes: la meitat de cel·les (memòria de Safari). */
export const LOW_LIMITS: HeightfieldLimits = { maxCells: 600_000, minCell: 1, div: 800 }

/** Codi del byte: 0 = passant; 1…255 = de 0 a `T`. */
const FULL = 255
const encode = (z: number, T: number) => (z <= 1e-3 ? 0 : z >= T ? FULL : 1 + Math.round((z / T) * 254))

export function createHeightfield(L: number, W: number, T: number, lim: HeightfieldLimits = DEFAULT_LIMITS): Heightfield {
  const Ls = Math.max(1, L)
  const Ws = Math.max(1, W)
  let cell = Math.max(lim.minCell, Math.max(Ls, Ws) / lim.div)
  if ((Ls / cell) * (Ws / cell) > lim.maxCells) cell = Math.sqrt((Ls * Ws) / lim.maxCells)
  const nx = Math.max(1, Math.ceil(Ls / cell))
  const ny = Math.max(1, Math.ceil(Ws / cell))
  const hf: Heightfield = { L: Ls, W: Ws, T: Math.max(0.1, T), cell, nx, ny, data: new Uint8Array(nx * ny * 4), dirty: null }
  resetHeightfield(hf)
  return hf
}

/** El tauler sencer, sense cap mecanitzat. */
export function resetHeightfield(hf: Heightfield): void {
  const d = hf.data
  for (let k = 0; k < d.length; k += 4) {
    d[k] = FULL
    d[k + 1] = 0
    d[k + 2] = 0
    d[k + 3] = FULL
  }
  hf.dirty = { i0: 0, j0: 0, i1: hf.nx - 1, j1: hf.ny - 1 }
}

/** Alçada que queda en un punt (mm des de la cara de sota; 0 = passant). */
export function heightAt(hf: Heightfield, x: number, y: number): number {
  const i = Math.min(hf.nx - 1, Math.max(0, Math.floor(x / hf.cell)))
  const j = Math.min(hf.ny - 1, Math.max(0, Math.floor(y / hf.cell)))
  const c = hf.data[(j * hf.nx + i) * 4]!
  return c === 0 ? 0 : c === FULL ? hf.T : ((c - 1) / 254) * hf.T
}

/** Peça marcada com a acabada (canal G) en aquest punt. */
export const tintedAt = (hf: Heightfield, x: number, y: number): boolean => hf.data[(Math.floor(y / hf.cell) * hf.nx + Math.floor(x / hf.cell)) * 4 + 1]! > 0

function markDirty(hf: Heightfield, i0: number, j0: number, i1: number, j1: number) {
  const d = hf.dirty
  if (!d) hf.dirty = { i0, j0, i1, j1 }
  else {
    d.i0 = Math.min(d.i0, i0)
    d.j0 = Math.min(d.j0, j0)
    d.i1 = Math.max(d.i1, i1)
    d.j1 = Math.max(d.j1, j1)
  }
}

/** Les cel·les canviades des de l'última vegada (i es buida). */
export function takeDirty(hf: Heightfield): Heightfield["dirty"] {
  const d = hf.dirty
  hf.dirty = null
  return d
}

/**
 * Escombrada d'una fresa de punta plana de radi `r` d'`a` a `b` (la punta, Z des de la cara de sota): cada cel·la que toca
 * el disc en algun moment baixa fins a la Z més baixa que hi passa (exacte per a rectes i rampes). Els trams llargs es
 * parteixen perquè la caixa que es recorre sigui estreta.
 */
export function stampSegment(hf: Heightfield, a: P3, b: P3, rIn: number): void {
  if (Math.min(a[2], b[2]) >= hf.T) return
  // Una broca més petita que la cel·la marca almenys la cel·la del centre.
  const r = Math.max(rIn, hf.cell * 0.51)
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const maxLen = Math.max(8 * r, 64 * hf.cell)
  const n = Math.max(1, Math.ceil(len / maxLen))
  for (let k = 0; k < n; k++) {
    const s0 = k / n
    const s1 = (k + 1) / n
    const p = (s: number): P3 => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]
    stampPiece(hf, p(s0), p(s1), r)
  }
}

function stampPiece(hf: Heightfield, a: P3, b: P3, r: number): void {
  const { cell, nx, ny, T, data } = hf
  const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - r) / cell))
  const i1 = Math.min(nx - 1, Math.floor((Math.max(a[0], b[0]) + r) / cell))
  const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - r) / cell))
  const j1 = Math.min(ny - 1, Math.floor((Math.max(a[1], b[1]) + r) / cell))
  if (i0 > i1 || j0 > j1) return
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len2 = dx * dx + dy * dy
  const r2 = r * r
  let changed = false
  let ci0 = i1
  let ci1 = i0
  let cj0 = j1
  let cj1 = j0
  for (let j = j0; j <= j1; j++) {
    const cy = (j + 0.5) * cell
    for (let i = i0; i <= i1; i++) {
      const cx = (i + 0.5) * cell
      let z: number
      if (len2 < 1e-12) {
        if ((cx - a[0]) ** 2 + (cy - a[1]) ** 2 > r2) continue
        z = Math.min(a[2], b[2])
      } else {
        const s = ((cx - a[0]) * dx + (cy - a[1]) * dy) / len2
        const px = a[0] + s * dx - cx
        const py = a[1] + s * dy - cy
        const perp2 = px * px + py * py
        if (perp2 > r2) continue
        // Tros del tram on el disc cobreix la cel·la: [s − Δ, s + Δ] ∩ [0, 1].
        const half = Math.sqrt((r2 - perp2) / len2)
        const lo = Math.max(0, s - half)
        const hi = Math.min(1, s + half)
        if (lo > hi) continue
        z = Math.min(a[2] + dz * lo, a[2] + dz * hi)
      }
      const code = encode(z, T)
      const k = (j * nx + i) * 4
      if (code < data[k]!) {
        data[k] = code
        changed = true
        if (i < ci0) ci0 = i
        if (i > ci1) ci1 = i
        if (j < cj0) cj0 = j
        if (j > cj1) cj1 = j
      }
    }
  }
  if (changed) markDirty(hf, ci0, cj0, ci1, cj1)
}

/** Marca (canal G) les cel·les de dins d'un polígon: la peça que ja ha quedat solta. Regla parell-senar per files. */
export function tintPolygon(hf: Heightfield, poly: Pt[]): void {
  if (poly.length < 3) return
  const { cell, nx, ny, data } = hf
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of poly) {
    y0 = Math.min(y0, p[1])
    y1 = Math.max(y1, p[1])
  }
  const j0 = Math.max(0, Math.floor(y0 / cell))
  const j1 = Math.min(ny - 1, Math.floor(y1 / cell))
  let ci0 = nx
  let ci1 = -1
  const xs: number[] = []
  for (let j = j0; j <= j1; j++) {
    const cy = (j + 0.5) * cell
    xs.length = 0
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k]!
      const q = poly[(k + 1) % poly.length]!
      if (p[1] <= cy !== q[1] <= cy) xs.push(p[0] + ((cy - p[1]) / (q[1] - p[1])) * (q[0] - p[0]))
    }
    xs.sort((u, v) => u - v)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k]! / cell - 0.5))
      const b = Math.min(nx - 1, Math.floor(xs[k + 1]! / cell - 0.5))
      for (let i = a; i <= b; i++) data[(j * nx + i) * 4 + 1] = FULL
      if (a <= b) {
        ci0 = Math.min(ci0, a)
        ci1 = Math.max(ci1, b)
      }
    }
  }
  if (ci1 >= ci0) markDirty(hf, ci0, j0, ci1, j1)
}
