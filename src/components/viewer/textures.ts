import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three"
import type { Finish, MaterialPref } from "../../core/model"

/**
 * Acabats visuals dels materials: color llis, lacat o fusta amb veta. Les textures de
 * fusta són procedurals (soroll de veta, 512 px, repetibles), generades una vegada per
 * espècie: sense imatges de procedència dubtosa.
 */

export type WoodSpecies = Extract<Finish, { kind: "wood" }>["species"]

export type FinishSpec = { kind: "color"; color: string; roughness: number } | { kind: "wood"; species: WoodSpecies }

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

/** Soroll periòdic 1D (suma de sinus) perquè la textura sigui repetible. */
function periodic(t: number, seed: number): number {
  return (
    0.5 * Math.sin(2 * Math.PI * t + seed) +
    0.3 * Math.sin(2 * Math.PI * 3 * t + seed * 1.7) +
    0.2 * Math.sin(2 * Math.PI * 7 * t + seed * 2.3)
  )
}

const cache = new Map<WoodSpecies, Texture>()

/** Textura de fusta amb la veta en horitzontal (eix u). */
export function woodTexture(species: WoodSpecies): Texture {
  const hit = cache.get(species)
  if (hit) return hit
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const img = ctx.createImageData(size, size)
  const p = WOOD[species]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      // Vetes: bandes en v, ondulades segons u; línies fines a sobre.
      const w = v + p.wobble * periodic(u, 3) * (0.6 + 0.4 * periodic(v, 9))
      const band = 0.5 + 0.5 * Math.sin(2 * Math.PI * p.lines * w)
      const fine = 0.5 + 0.5 * Math.sin(2 * Math.PI * p.lines * 4.3 * w + periodic(u, 5))
      const shade = Math.pow(band, 3) * 0.75 + fine * 0.12 + 0.06 * periodic(u * 2 + v, 11)
      const k = Math.max(0, Math.min(1, shade))
      const i = (y * size + x) * 4
      img.data[i] = p.base[0] + (p.dark[0] - p.base[0]) * k
      img.data[i + 1] = p.base[1] + (p.dark[1] - p.base[1]) * k
      img.data[i + 2] = p.base[2] + (p.dark[2] - p.base[2]) * k
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  cache.set(species, tex)
  return tex
}

/** Acabat d'una preferència de material. */
export function finishOfPref(m: MaterialPref): FinishSpec {
  if (m.finish.kind === "wood") return { kind: "wood", species: m.finish.species }
  return { kind: "color", color: m.finish.color, roughness: m.finish.kind === "lacquer" ? 0.35 : 0.8 }
}

const KEYWORDS: [RegExp, FinishSpec][] = [
  [/roure|oak/i, { kind: "wood", species: "oak" }],
  [/noguer|walnut/i, { kind: "wood", species: "walnut" }],
  [/freixe|ash/i, { kind: "wood", species: "ash" }],
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
