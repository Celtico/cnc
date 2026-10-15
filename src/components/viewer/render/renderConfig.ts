import type { Camera, Scene } from "three"
import { LOW_MEMORY } from "../deviceLimits"
import type { EngineKind } from "./engine"
import type { RenderOpts, RenderRoom, RenderScene } from "./sceneData"
import type { ToneCurve } from "./tonemap"

export type SceneGetter = () => { scene: Scene; camera: Camera; width: number; height: number; snapshot?: () => string } | null

/** Objectius (mm, equivalent de 35 mm); 0 = l'angle del visor. */
export const FOCALS = [0, 24, 35, 50] as const
/** Motor triat (es recorda entre sessions). */
const ENGINE_KEY = "mobles:render-engine"
export function savedEngine(): EngineKind | null {
  try {
    const v = localStorage.getItem(ENGINE_KEY)
    return v === "cpu" || v === "gpu" ? v : null
  } catch {
    return null
  }
}
export function saveEngine(k: EngineKind) {
  try {
    localStorage.setItem(ENGINE_KEY, k)
  } catch {
    // Sense emmagatzematge (navegació privada): no es recorda.
  }
}

/** Resolució: multiplicador de la mida del visor i amplada màxima (px). */
export const RESOLUTIONS = {
  draft: { label: "Esborrany", k: 1, max: 1000 },
  normal: { label: "Normal", k: 1.5, max: 1600 },
  high: { label: "Alta", k: 2, max: 2400 },
  max: { label: "Màxima", k: 3, max: 3600 },
} as const
export type Resolution = keyof typeof RESOLUTIONS
/** A l'iPhone i l'iPad (poca memòria per pàgina): com a molt 1600 px de costat llarg. */
export const LOW_MEMORY_MAX = 1600
export const resolutionAllowed = (r: Resolution) => !LOW_MEMORY || RESOLUTIONS[r].max <= LOW_MEMORY_MAX

/** Una feina de render al diàleg: les sumes són les del motor (s'hi assignen en arribar). */
export interface Job {
  w: number
  h: number
  accum: Float32Array<ArrayBufferLike>
  aux: Float32Array<ArrayBufferLike>
  count: number
  auxCount: number
}

/** Format de la imatge (com les càmeres): el del visor o una proporció fixa (amplada ÷ alçada). */
export const FORMATS = { view: { label: "El del visor", r: 0 }, "3:2": { label: "3:2 (foto)", r: 3 / 2 }, "4:5": { label: "4:5 (revista, vertical)", r: 4 / 5 }, "16:9": { label: "16:9 (web)", r: 16 / 9 }, "1:1": { label: "1:1", r: 1 } } as const
export type Format = keyof typeof FORMATS

/** L'escena del visor passada a dades per als motors (es llegeix en començar). */
export interface RenderSource {
  scene: RenderScene
  aspect: number
  long: number
  room?: RenderRoom
  format?: Format
}

/**
 * Ambients de llum (com les fotos de catàleg): canvien la llum (tornen a començar el render) i l'exposició (a l'instant).
 * Al capvespre i al vespre l'exposició automàtica deixa la imatge més fosca (`key`) i amb més contrast: manen els llums i
 * les tires LED, no tot igual d'il·luminat.
 */
export const MOODS = {
  day: { label: "Dia", help: "Llum natural: sol i cel.", opts: { sunElevation: 45, sunIntensity: 1, skyIntensity: 1, lamps: true, lampIntensity: 1 }, look: { key: 0.18, contrast: 1 } },
  dusk: { label: "Capvespre", help: "Sol baix i càlid, poc cel i els llums encesos.", opts: { sunElevation: 8, sunIntensity: 1.3, skyIntensity: 0.35, lamps: true, lampIntensity: 1.5 }, look: { auto: true, key: 0.1, contrast: 1.15, warmth: 0.45 } },
  night: { label: "Vespre", help: "Només els llums i les tires LED: ambient fosc, com les fotos de catàleg.", opts: { sunIntensity: 0, skyIntensity: 0.05, lamps: true, lampIntensity: 2.5 }, look: { auto: true, key: 0.06, contrast: 1.2, warmth: 0.3 } },
} satisfies Record<string, { label: string; help: string; opts: Partial<RenderOpts>; look: Partial<Look> }>
export type Mood = keyof typeof MOODS

export type Background = "scene" | "white" | "transparent"
export interface Look {
  exposure: number
  contrast: number
  saturation: number
  background: Background
  /** Exposició automàtica (com una càmera): la llum mitjana de la imatge queda a un gris mitjà. */
  auto: boolean
  /** El gris on l'exposició automàtica deixa la llum mitjana: 0,18 de dia; menys, ambient fosc (capvespre, vespre). */
  key: number
  /** Temperatura: − fred, + càlid. */
  warmth: number
  /** Filtre de soroll (guiat per l'albedo i les normals). */
  denoise: boolean
  /** Corba de color (AgX natural o ACES), vinyeta (0–1) i resplendor dels punts molt brillants. */
  curve: ToneCurve
  vignette: number
  bloom: number
  bloomThreshold: number
}
export const DEFAULT_LOOK: Look = { exposure: 0, contrast: 1, saturation: 1, background: "scene", auto: false, key: 0.18, warmth: 0, denoise: true, curve: "agx", vignette: 0.2, bloom: 0, bloomThreshold: 3 }
