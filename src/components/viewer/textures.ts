import { CanvasTexture, MirroredRepeatWrapping, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three"
import { WOOD_PRESETS, type Finish, type MaterialPref, type WoodGen } from "../../core/model"

/**
 * Acabats visuals dels materials: color llis, lacat o fusta amb veta. Les textures de
 * fusta són procedurals (soroll de veta, 512 px, repetibles), generades una vegada per
 * espècie: sense imatges de procedència dubtosa.
 */

export type WoodSpecies = Extract<Finish, { kind: "wood" }>["species"]

export type FinishSpec = { kind: "color"; color: string; roughness: number; metalness?: number; opacity?: number } | { kind: "wood"; species: WoodSpecies; gen?: WoodGen } | { kind: "image"; src: string; tileMm: number; aspect?: number; seamless?: boolean }
  /** Textura procedural: teixit (trama), rajola (peces i junta) o pedra (marbre amb vetes). */
  | { kind: "pattern"; pattern: PatternKind; color: string; grout?: string; tileMm: number; roughness: number; opts?: PatternOpts }

export type PatternKind = "fabric" | "tiles" | "stone"
/** Opcions dels patrons: fils i irregularitat del teixit; junta, variació i col·locació de la rajola; vetes de la pedra. */
export interface PatternOpts {
  threads?: number
  slub?: number
  /** Junta en fracció de la peça. */
  joint?: number
  variation?: number
  layout?: "grid" | "brick"
  veins?: number
  seed?: number
}

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", "").padEnd(6, "0").slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const SPECIES_LABEL: Record<WoodSpecies, string> = { oak: "Roure", walnut: "Noguera", ash: "Freixe" }

/** Mida real d'un tile de textura (mm). */
export const TILE_MM = 600

/** Aleatori determinista (cada espècie surt sempre igual). */
function rng(seed: number): () => number {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const rgb = (c: [number, number, number], a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]

/** Memòria de textures generades (les últimes; en moure un control se'n fan moltes). */
const cache = new Map<string, Texture>()
function remember<T>(map: Map<string, T>, key: string, v: T, max = 48): T {
  map.set(key, v)
  if (map.size > max) {
    const first = map.keys().next().value
    if (first !== undefined) map.delete(first)
  }
  return v
}

/** Paràmetres efectius de la fusta: els del generador o els de l'espècie. */
export function woodGenOf(species: WoodSpecies, gen?: WoodGen): WoodGen {
  return gen ?? WOOD_PRESETS[species]
}

/**
 * Textura de xapa de fusta amb la veta en horitzontal (eix u), repetible en u i en v.
 * Es pinta com un xapat real: franges amples de to, centenars de fibres fines de gruix i
 * contrast variables, alguna veta «de catedral» més ondulada i porus curts.
 */
export function woodTexture(species: WoodSpecies, gen?: WoodGen): Texture {
  const W = woodGenOf(species, gen)
  const key = JSON.stringify(W)
  const hit = cache.get(key)
  if (hit) return hit
  const size = 1024
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext("2d")!
  const p = { base: hexToRgb(W.base), dark: hexToRgb(W.dark), lines: W.lines, wobble: W.wobble }
  const rnd = rng(W.seed)
  const ck = 0.3 + W.contrast * 1.4

  g.fillStyle = rgb(p.base)
  g.fillRect(0, 0, size, size)

  // Dibuixa a y, y - size i y + size perquè la textura no tingui costura vertical.
  const wrapY = (draw: (dy: number) => void) => {
    for (const dy of [-size, 0, size]) draw(dy)
  }
  // Ondulació periòdica en u (freqüències enteres: sense costura horitzontal).
  const wave = (u: number, amp: number, ph: number, f1: number, f2: number) =>
    amp * (Math.sin(2 * Math.PI * f1 * u + ph) * 0.7 + Math.sin(2 * Math.PI * f2 * u + ph * 1.9) * 0.3)

  // 1. Franges amples de to (clar/fosc) al llarg de la veta.
  for (let i = 0; i < W.bands; i++) {
    const y = rnd() * size
    const h = 8 + rnd() * 60
    const light = rnd() > 0.5
    const a = 0.05 + rnd() * 0.1
    const ph = rnd() * 10
    wrapY((dy) => {
      g.fillStyle = light ? `rgba(255, 245, 225, ${a})` : rgb(p.dark, a)
      g.beginPath()
      g.moveTo(0, y + dy + wave(0, 12, ph, 1, 2))
      for (let x = 0; x <= size; x += 16) g.lineTo(x, y + dy + wave(x / size, 12, ph, 1, 2))
      for (let x = size; x >= 0; x -= 16) g.lineTo(x, y + dy + h + wave(x / size, 12, ph + 0.4, 1, 2))
      g.closePath()
      g.fill()
    })
  }

  // 2. Fibres fines.
  const fibres = Math.round(p.lines * 9)
  for (let i = 0; i < fibres; i++) {
    const y = rnd() * size
    const amp = 2 + rnd() * p.wobble * 120
    const ph = rnd() * 10
    const f1 = 1 + Math.floor(rnd() * 2)
    const f2 = 2 + Math.floor(rnd() * 3)
    const strong = rnd() < 0.18
    const col = mix(p.dark, [0, 0, 0], strong ? 0.25 : 0)
    const a = Math.min(1, (strong ? 0.25 + rnd() * 0.3 : 0.06 + rnd() * 0.14) * ck)
    const w = strong ? 1 + rnd() * 2.2 : 0.5 + rnd() * 1.1
    wrapY((dy) => {
      g.strokeStyle = rgb(col, a)
      g.lineWidth = w
      g.beginPath()
      for (let x = 0; x <= size; x += 8) {
        const yy = y + dy + wave(x / size, amp, ph, f1, f2)
        if (x === 0) g.moveTo(x, yy)
        else g.lineTo(x, yy)
      }
      g.stroke()
    })
  }

  // 3. Vetes de catedral: arcs amples i foscos (poques, com en un xapat pla).
  for (let i = 0; i < W.figure; i++) {
    const cy = rnd() * size
    const ph = rnd() * 10
    for (let k = 0; k < 7; k++) {
      const off = k * (6 + rnd() * 5)
      const amp = 40 + k * 9
      wrapY((dy) => {
        g.strokeStyle = rgb(p.dark, 0.1 + rnd() * 0.12)
        g.lineWidth = 1 + rnd() * 2
        g.beginPath()
        for (let x = 0; x <= size; x += 8) {
          const u = x / size
          const yy = cy + dy + off + amp * Math.pow(Math.sin(Math.PI * u * 2 + ph), 2) * -1
          if (x === 0) g.moveTo(x, yy)
          else g.lineTo(x, yy)
        }
        g.stroke()
      })
    }
  }

  // 4. Porus: traços curts i foscos al llarg de la veta.
  for (let i = 0; i < W.pores; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const len = 3 + rnd() * 12
    g.fillStyle = rgb(mix(p.dark, [0, 0, 0], 0.3), 0.12 + rnd() * 0.25)
    g.fillRect(x, y, len, 0.8 + rnd() * 0.7)
    if (x + len > size) g.fillRect(x - size, y, len, 1)
  }

  // 5. Gra fi.
  const img = g.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * W.grain
    img.data[i]! += n
    img.data[i + 1]! += n
    img.data[i + 2]! += n
  }
  g.putImageData(img, 0, 0)

  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return remember(cache, key, tex)
}

/** Color RGB (0–1) representatiu d'un acabat: per als colors del STEP de TopSolid. */
export function finishRgb(f: FinishSpec): [number, number, number] {
  if (f.kind === "wood") return hexToRgb(woodGenOf(f.species, f.gen).base).map((v) => v / 255) as [number, number, number]
  if (f.kind === "image") return [0.72, 0.6, 0.45]
  return hexRgb(f.color)
}

function hexRgb(color: string): [number, number, number] {
  const hex = color.replace("#", "")
  const n = parseInt(hex.length === 3 ? hex.split("").map((c: string) => c + c).join("") : hex, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const patternCache = new Map<string, Texture>()

/**
 * Textures procedurals dels materials de simulació (sense imatges): el teixit és una trama
 * d'ordit i trama amb soroll; la rajola, una peça per tile amb la junta i una mica de variació.
 * Un tile = `tileMm` del material (200 mm de teixit, la mida de la rajola).
 */
export function patternTexture(pattern: PatternKind, color: string, grout = "#cccccc", o: PatternOpts = {}): Texture {
  const key = `${pattern}:${color}:${grout}:${JSON.stringify(o)}`
  const hit = patternCache.get(key)
  if (hit) return hit
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext("2d")!
  const [r, gg, b] = hexRgb(color).map((v) => v * 255) as [number, number, number]
  const rand = rng(o.seed ?? (pattern === "fabric" ? 7 : pattern === "tiles" ? 11 : 13))
  if (pattern === "fabric") {
    const img = g.createImageData(size, size)
    const threads = Math.max(8, Math.round((o.threads ?? 96) / 2) * 2)
    const slub = o.slub ?? 0
    // Irregularitat dels fils: cada fil (fila i columna) amb el seu gruix de to.
    const rowK = Array.from({ length: threads }, () => 1 + (rand() - 0.5) * slub * 0.35)
    const colK = Array.from({ length: threads }, () => 1 + (rand() - 0.5) * slub * 0.35)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const tx = Math.floor((x / size) * threads), ty = Math.floor((y / size) * threads)
        const fx = ((x / size) * threads) % 1, fy = ((y / size) * threads) % 1
        // Ordit i trama alterns: un fil passa per sobre de l'altre.
        const over = (tx + ty) % 2 === 0
        const shade = over ? 0.55 + 0.45 * Math.sin(fy * Math.PI) : 0.55 + 0.45 * Math.sin(fx * Math.PI)
        const k = (0.82 + 0.18 * shade + (rand() - 0.5) * 0.06) * (over ? colK[tx]! : rowK[ty]!)
        const i = (y * size + x) * 4
        img.data[i] = Math.min(255, r * k)
        img.data[i + 1] = Math.min(255, gg * k)
        img.data[i + 2] = Math.min(255, b * k)
        img.data[i + 3] = 255
      }
    g.putImageData(img, 0, 0)
  } else if (pattern === "tiles") {
    // Una repetició = 2 × 2 peces (per poder fer trencajunts).
    g.fillStyle = grout
    g.fillRect(0, 0, size, size)
    const t = size / 2
    const j = Math.max(1, (o.joint ?? 0.01) * t)
    const vari = o.variation ?? 0.05
    const piece = (x: number, y: number) => {
      const k = 1 - vari / 2 + rand() * vari
      g.fillStyle = `rgb(${r * k}, ${gg * k}, ${b * k})`
      g.fillRect(x + j / 2, y + j / 2, t - j, t - j)
      // Una mica de variació (esmalt) perquè no sigui pla.
      for (let n = 0; n < 220; n++) {
        g.fillStyle = `rgba(255,255,255,${rand() * 0.035})`
        g.fillRect(x + j / 2 + rand() * (t - j - 30), y + j / 2 + rand() * (t - j - 30), 2 + rand() * 28, 2 + rand() * 28)
      }
    }
    for (let row = 0; row < 2; row++) {
      const off = o.layout === "brick" && row === 1 ? t / 2 : 0
      for (let c = -1; c < 2; c++) {
        g.save()
        g.beginPath()
        g.rect(0, row * t, size, t)
        g.clip()
        piece(c * t + off, row * t)
        g.restore()
      }
    }
  } else {
    // Pedra / marbre: soroll periòdic (sense costures) amb vetes fines on el soroll «gira».
    const [vr, vg, vb] = hexRgb(grout).map((v) => v * 255) as [number, number, number]
    const N = 16
    const grid = Array.from({ length: N * N }, () => rand())
    const val = (x: number, y: number, f: number) => {
      const fx = x * f, fy = y * f
      const x0 = Math.floor(fx), y0 = Math.floor(fy)
      const sx = fx - x0, sy = fy - y0
      const at = (i: number, k: number) => grid[(((i % N) + N) % N) + (((k % N) + N) % N) * N]!
      const u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy)
      return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v
    }
    const fbm = (x: number, y: number) => val(x, y, 2) * 0.5 + val(x, y, 4) * 0.25 + val(x, y, 8) * 0.15 + val(x, y, 16) * 0.1
    const veins = o.veins ?? 0.5
    const img = g.createImageData(size, size)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = (x / size) * N / 2, v = (y / size) * N / 2
        const n = fbm(u, v)
        const line = Math.abs(Math.sin((u / (N / 2) + n * 2.2) * Math.PI * 3))
        const vein = Math.pow(1 - line, 10 + (1 - veins) * 40) * veins * 1.6
        const cloud = 0.93 + (fbm(u * 2 + 5, v * 2 + 5) - 0.5) * 0.14
        const t = Math.min(1, vein)
        const i = (y * size + x) * 4
        img.data[i] = (r * cloud) * (1 - t) + vr * t
        img.data[i + 1] = (gg * cloud) * (1 - t) + vg * t
        img.data[i + 2] = (b * cloud) * (1 - t) + vb * t
        img.data[i + 3] = 255
      }
    g.putImageData(img, 0, 0)
  }
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return remember(patternCache, key, tex)
}

/** Acabat d'una preferència de material. */
export function finishOfPref(m: MaterialPref): FinishSpec {
  if (m.finish.kind === "wood") return { kind: "wood", species: m.finish.species, gen: m.finish.gen }
  if (m.finish.kind === "stone") return { kind: "pattern", pattern: "stone", color: m.finish.color, grout: m.finish.vein, tileMm: m.finish.size, roughness: 0.35, opts: { veins: m.finish.veins, seed: m.finish.seed } }
  if (m.finish.kind === "image") return { kind: "image", src: m.finish.src, tileMm: m.finish.tileMm, aspect: m.finish.aspect, seamless: m.finish.seamless }
  if (m.finish.kind === "metal") return { kind: "color", color: m.finish.color, roughness: 0.35, metalness: 0.85 }
  if (m.finish.kind === "glass") return { kind: "color", color: m.finish.color, roughness: 0.05, opacity: 0.35 }
  if (m.finish.kind === "fabric") return { kind: "pattern", pattern: "fabric", color: m.finish.color, tileMm: m.finish.tileMm ?? 200, roughness: 0.95, opts: { threads: m.finish.threads, slub: m.finish.slub } }
  if (m.finish.kind === "tiles") {
    const f = m.finish
    // La textura és de 2 × 2 peces: la repetició fa el doble de la peça.
    return { kind: "pattern", pattern: "tiles", color: f.color, grout: f.grout, tileMm: f.size * 2, roughness: 0.3, opts: { joint: (f.joint ?? 3) / f.size, variation: f.variation, layout: f.layout } }
  }
  return { kind: "color", color: m.finish.color, roughness: m.finish.kind === "lacquer" ? 0.35 : 0.8 }
}

const KEYWORDS: [RegExp, FinishSpec][] = [
  [/roure|oak/i, { kind: "wood", species: "oak" }],
  [/noguer|walnut/i, { kind: "wood", species: "walnut" }],
  [/freixe|ash/i, { kind: "wood", species: "ash" }],
  [/ferro|acer|inox|metall/i, { kind: "color", color: "#5b5d60", roughness: 0.35, metalness: 0.85 }],
  [/vidre|glass/i, { kind: "color", color: "#cfe6e3", roughness: 0.05, opacity: 0.35 }],
  [/pedra|marbre|granit/i, { kind: "color", color: "#d9d4ca", roughness: 0.6 }],
  [/antracita/i, { kind: "color", color: "#3d3f42", roughness: 0.75 }],
  [/verd fosc/i, { kind: "color", color: "#2f3b36", roughness: 0.75 }],
  [/verd oliva|oliva/i, { kind: "color", color: "#6f7550", roughness: 0.75 }],
  [/terracota/i, { kind: "color", color: "#b8664a", roughness: 0.75 }],
  [/blau fosc|marí|navy/i, { kind: "color", color: "#2c3a52", roughness: 0.75 }],
  [/greige/i, { kind: "color", color: "#c8bfb2", roughness: 0.8 }],
  [/beix/i, { kind: "color", color: "#cbbca2", roughness: 0.9 }],
  [/negr/i, { kind: "color", color: "#2b2b2b", roughness: 0.8 }],
  [/gris clar/i, { kind: "color", color: "#cbcac6", roughness: 0.75 }],
  [/gris|grey|gray/i, { kind: "color", color: "#9a9a96", roughness: 0.8 }],
  [/blanc|white|lacat/i, { kind: "color", color: "#f2f0eb", roughness: 0.8 }],
  [/dm|mdf|contraxap/i, { kind: "color", color: "#c9b79a", roughness: 0.9 }],
]

/** Acabat d'un material pel nom: primer les preferències, després paraules clau. */
export function resolveFinish(materials: MaterialPref[], name: string): FinishSpec {
  const pref = materials.find((m) => m.name === name)
  if (pref) return finishOfPref(pref)
  for (const [rx, f] of KEYWORDS) if (rx.test(name)) return f
  return { kind: "color", color: "#e6cfa6", roughness: 0.85 }
}

/** Acabat del cantell d'un material: el que digui el nom del cantell (p. ex. "xapa de roure"), o el del material. */
export function resolveEdgeFinish(materials: MaterialPref[], name: string): FinishSpec {
  const pref = materials.find((m) => m.name === name)
  const edge = pref?.edge ?? ""
  if (edge) {
    const byMaterial = materials.find((m) => m.name !== name && edge.toLowerCase().includes(m.name.toLowerCase().split(" ")[0] ?? "\u0000"))
    if (byMaterial) return finishOfPref(byMaterial)
    for (const [rx, f] of KEYWORDS) if (rx.test(edge)) return f
  }
  return resolveFinish(materials, name)
}

/** Color del cantell sense folrar (tauler vist). */
export const RAW_EDGE_COLOR = "#cdb48c"

const photoCache = new Map<string, Texture>()

/**
 * Textura d'una foto real (data URL), en repetició. Es carrega una sola vegada per imatge.
 * Seamless (feta per repetir): repetició normal. Si no, en mirall: una foto qualsevol no deixa
 * costures a cada tile (però el dibuix surt simètric).
 */
export function photoTexture(src: string, seamless = false): Texture {
  const key = `${seamless ? "r" : "m"}:${src}`
  const hit = photoCache.get(key)
  if (hit) return hit
  const tex = new TextureLoader().load(src)
  tex.wrapS = seamless ? RepeatWrapping : MirroredRepeatWrapping
  tex.wrapT = seamless ? RepeatWrapping : MirroredRepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  photoCache.set(key, tex)
  return tex
}
