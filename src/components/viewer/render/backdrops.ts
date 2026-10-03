import type { RenderTexture } from "./sceneData"

/**
 * Vista per les finestres dels ambients (render): un panorama equirectangular (com un HDRI, la fila de dalt és el zenit)
 * fet a mà, amb el que hi ha fora — arbres i gespa, o mar — i alfa 0 on es veu el cel (que posa el motor, amb els
 * núvols de l'HDRI). Només el veuen els raigs de la càmera que surten per un vidre (`RenderScene.backdrop`): no fa llum,
 * i el motor el multiplica per la llum del cel a l'horitzó (de dia, clar; al vespre, fosc).
 */
export type BackdropKind = "garden" | "sea"

export const BACKDROPS: { id: BackdropKind | "sky"; label: string; help: string }[] = [
  { id: "garden", label: "Jardí", help: "Arbres i gespa per les finestres." },
  { id: "sea", label: "Mar", help: "L'horitzó del mar per les finestres." },
  { id: "sky", label: "Només cel", help: "El cel del render (núvols), sense res més." },
]

const W = 2048
const H = 1024

/** Soroll de valor 1D/2D (determinista) per a les formes. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function noise2(x: number, y: number, seed: number, wrap = 0): number {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const X = (i: number) => (wrap ? ((i % wrap) + wrap) % wrap : i)
  const a = hash(X(x0), y0, seed), b = hash(X(x0 + 1), y0, seed), c = hash(X(x0), y0 + 1, seed), d = hash(X(x0 + 1), y0 + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}
function fbm(x: number, y: number, seed: number, oct: number, wrap = 0): number {
  let s = 0, amp = 0.5, f = 1, n = 0
  for (let i = 0; i < oct; i++) {
    s += amp * noise2(x * f, y * f, seed + i * 17, wrap ? wrap * f : 0)
    n += amp
    amp *= 0.5
    f *= 2
  }
  return s / n
}

const cache = new Map<BackdropKind, RenderTexture>()

/** Panorama de la vista (2048 × 1024, sRGB amb alfa), un sol cop per tipus. */
export function backdropTexture(kind: BackdropKind): RenderTexture {
  const hit = cache.get(kind)
  if (hit) return hit
  const data = new Uint8ClampedArray(W * H * 4)
  if (kind === "garden") garden(data)
  else sea(data)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += data[i + 1]! / 255
  const t: RenderTexture = { w: W, h: H, data, wrapS: 0, wrapT: 2, flipY: false, lum: sum / (W * H) }
  cache.set(kind, t)
  return t
}

/** Elevació (graus) de la fila y. */
const elev = (y: number) => 90 - ((y + 0.5) / H) * 180

function put(d: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number) {
  d[i] = r
  d[i + 1] = g
  d[i + 2] = b
  d[i + 3] = a
}

/** Alçada (graus) d'una filera de capçades a cada columna: capçades rodones amb la vora irregular. */
function crownLine(n: number, seed: number, wMin: number, wMax: number, hMin: number, hMax: number, base: number): Float32Array {
  const out = new Float32Array(W)
  const crowns = Array.from({ length: n }, (_, k) => ({ c: hash(k, 1, seed), w: wMin + (wMax - wMin) * hash(k, 2, seed), h: hMin + (hMax - hMin) * hash(k, 3, seed) }))
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W
    let h = base * (0.6 + 0.8 * fbm(u * 10, 0.5, seed + 1, 3, 10))
    for (const k of crowns) {
      let du = Math.abs(u - k.c)
      du = Math.min(du, 1 - du)
      if (du >= k.w) continue
      const e = k.h * Math.pow(1 - (du / k.w) ** 2, 0.6)
      if (e > h) h = e
    }
    // Vora de fulles: irregular a dues escales.
    out[x] = h > 0 ? h + 2.6 * (fbm(u * 180, 0.3, seed + 2, 3, 180) - 0.5) + 0.9 * (fbm(u * 1100, 0.7, seed + 3, 2, 1100) - 0.5) : 0
  }
  return out
}

/** Arbres (dues fileres: lluny, esvaïda per l'aire, i a prop, més fosca), una tanca d'arbusts i gespa. */
function garden(d: Uint8ClampedArray) {
  const far = crownLine(90, 7, 0.006, 0.018, 6, 13, 4)
  const near = crownLine(34, 19, 0.014, 0.034, 10, 26, 0)
  for (let y = 0; y < H; y++) {
    const e = elev(y)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const u = (x + 0.5) / W
      if (e >= 0) {
        const hn = near[x]!, hf = far[x]!
        const leaf = fbm(u * 1600, e * 14, 5, 3, 1600)
        const clump = fbm(u * 140, e * 1.2, 13, 3, 140)
        if (e <= hn + 0.25) {
          // A prop: fulles fosques amb clapes de llum; més clares a dalt (el sol) i fosques a sota (ombra).
          const lit = Math.min(1, Math.max(0, e / Math.max(1, hn))) ** 1.4
          const k = 0.55 * lit + 0.45 * clump
          const a = e > hn ? Math.round(255 * (1 - (e - hn) / 0.25)) : 255
          put(d, i, 30 + 52 * k + 26 * leaf, 46 + 66 * k + 30 * leaf, 24 + 28 * k + 12 * leaf, a)
        } else if (e <= hf + 0.25) {
          // Lluny: el mateix verd, més clar i blavós (l'aire).
          const k = 0.5 * clump + 0.5 * leaf
          const a = e > hf ? Math.round(255 * (1 - (e - hf) / 0.25)) : 255
          put(d, i, 104 + 26 * k, 122 + 26 * k, 110 + 18 * k, a)
        } else put(d, i, 0, 0, 0, 0)
      } else if (e > -1.4) {
        // Tanca d'arbusts a l'horitzó.
        const n = fbm(u * 900, e * 20, 27, 3, 900)
        put(d, i, 34 + 26 * n, 52 + 32 * n, 28 + 12 * n, 255)
      } else {
        // Gespa: més fosca i amb més textura a prop (cap avall).
        const k = Math.min(1, -e / 40)
        const n = fbm(u * 500, e * 10, 21, 3, 500)
        put(d, i, 78 + 26 * n - 26 * k, 102 + 30 * n - 30 * k, 50 + 12 * n - 16 * k, 255)
      }
    }
  }
}

/** Mar fins a l'horitzó, amb una mica d'onada, i una franja de terra llunyana a una banda. */
function sea(d: Uint8ClampedArray) {
  for (let y = 0; y < H; y++) {
    const e = elev(y)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const u = (x + 0.5) / W
      if (e >= 0) {
        // Terra llunyana (un cap) entre 0,15 i 0,35 de volta, molt baixa.
        const land = u > 0.15 && u < 0.35 ? 1.6 * Math.sin(((u - 0.15) / 0.2) * Math.PI) * (0.7 + 0.3 * fbm(u * 80, 0, 4, 3)) : 0
        if (e < land) put(d, i, 120, 132, 128, 255)
        else put(d, i, 0, 0, 0, 0)
        continue
      }
      // Més clar a l'horitzó (reflex del cel) i més fosc i blau a prop; onades horitzontals.
      const k = Math.min(1, -e / 25)
      const wave = fbm(u * 300, -e * 30, 31, 3)
      put(d, i, 150 - 95 * k + 18 * wave, 168 - 90 * k + 18 * wave, 178 - 70 * k + 14 * wave, 255)
    }
  }
}
