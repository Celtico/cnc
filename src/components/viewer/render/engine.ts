import type { RenderEnv, RenderOpts, RenderScene } from "./sceneData"

/** Motor del render: per CPU (workers) o per GPU (WebGPU). */
export type EngineKind = "cpu" | "gpu"

/** Una feina de render: l'escena, el cel HDRI, les opcions i la mida (px). */
export interface RenderJob {
  scene: RenderScene
  env: RenderEnv | null
  opts: RenderOpts
  w: number
  h: number
}

/**
 * Progrés: sumes de totes les mostres (el diàleg les divideix per `count`): color RGBA (4 per
 * píxel; A = cobertura) i AOV de la primera superfície (albedo i normal, 6 per píxel).
 */
export interface RenderProgress {
  color: Float32Array
  aux: Float32Array
  count: number
}

export interface EngineEvents {
  onProgress: (p: RenderProgress) => void
  onError: (message: string) => void
  /** Límit de passades (0 = sense): el motor s'atura en arribar-hi. */
  limit: () => number
  /** El motor s'ha aturat sol (límit). */
  onStop?: () => void
}

export interface RenderEngine {
  readonly kind: EngineKind
  /** Text per a l'estat («3 fils», «GPU»). */
  readonly label: string
  /** Comença o continua (les mostres ja fetes es conserven). */
  resume(): void
  pause(): void
  dispose(): void
}
