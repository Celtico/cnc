import { CanvasTexture, MirroredRepeatWrapping, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three"
import type { Finish, MaterialPref } from "../../core/model"

/**
 * Acabats visuals dels materials: color llis, lacat o fusta amb veta. Les textures de
 * fusta són procedurals (soroll de veta, 512 px, repetibles), generades una vegada per
 * espècie: sense imatges de procedència dubtosa.
 */

export type WoodSpecies = Extract<Finish, { kind: "wood" }>["species"]

export type FinishSpec = { kind: "color"; color: string; roughness: number; metalness?: number; opacity?: number } | { kind: "wood"; species: WoodSpecies } | { kind: "image"; src: string; tileMm: number; aspect?: number; seamless?: boolean }

interface WoodParams {
  base: [number, number, number]
  dark: [number, number, number]
  /** Nombre de vetes per tile. */
  lines: number
  /** Amplitud de l'ondulació de la veta (0..1 del tile). */
  wobble: number
}

const WOOD: Record<WoodSpecies, WoodParams> = {
  oak: { base: [214, 182, 132], dark: [168, 131, 84], lines: 26, wobble: 0.06 },
  walnut: { base: [110, 78, 52], dark: [66, 42, 26], lines: 22, wobble: 0.05 },
  ash: { base: [228, 214, 184], dark: [186, 164, 126], lines: 18, wobble: 0.09 },
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

const cache = new Map<WoodSpecies, Texture>()

/**
 * Textura de xapa de fusta amb la veta en horitzontal (eix u), repetible en u i en v.
 * Es pinta com un xapat real: franges amples de to, centenars de fibres fines de gruix i
 * contrast variables, alguna veta «de catedral» més ondulada i porus curts.
 */
export function woodTexture(species: WoodSpecies): Texture {
  const hit = cache.get(species)
  if (hit) return hit
  const size = 1024
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext("2d")!
  const p = WOOD[species]
  const rnd = rng(species === "oak" ? 101 : species === "walnut" ? 202 : 303)

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
  for (let i = 0; i < 26; i++) {
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
    const a = strong ? 0.25 + rnd() * 0.3 : 0.06 + rnd() * 0.14
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
  const arches = species === "ash" ? 3 : 2
  for (let i = 0; i < arches; i++) {
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
  const pores = species === "walnut" ? 1400 : 2200
  for (let i = 0; i < pores; i++) {
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
    const n = (rnd() - 0.5) * 8
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
  cache.set(species, tex)
  return tex
}

/** Acabat d'una preferència de material. */
export function finishOfPref(m: MaterialPref): FinishSpec {
  if (m.finish.kind === "wood") return { kind: "wood", species: m.finish.species }
  if (m.finish.kind === "image") return { kind: "image", src: m.finish.src, tileMm: m.finish.tileMm, aspect: m.finish.aspect, seamless: m.finish.seamless }
  if (m.finish.kind === "metal") return { kind: "color", color: m.finish.color, roughness: 0.35, metalness: 0.85 }
  if (m.finish.kind === "glass") return { kind: "color", color: m.finish.color, roughness: 0.05, opacity: 0.35 }
  return { kind: "color", color: m.finish.color, roughness: m.finish.kind === "lacquer" ? 0.35 : 0.8 }
}

const KEYWORDS: [RegExp, FinishSpec][] = [
  [/roure|oak/i, { kind: "wood", species: "oak" }],
  [/noguer|walnut/i, { kind: "wood", species: "walnut" }],
  [/freixe|ash/i, { kind: "wood", species: "ash" }],
  [/ferro|acer|inox|metall/i, { kind: "color", color: "#5b5d60", roughness: 0.35, metalness: 0.85 }],
  [/vidre|glass/i, { kind: "color", color: "#cfe6e3", roughness: 0.05, opacity: 0.35 }],
  [/pedra|marbre|granit/i, { kind: "color", color: "#d9d4ca", roughness: 0.6 }],
  [/negr/i, { kind: "color", color: "#2b2b2b", roughness: 0.8 }],
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
