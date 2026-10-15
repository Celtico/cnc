import type { RenderEnv, RenderOpts, RenderScene } from "./sceneData"

/** Color del sol (lineal) amb intensitat 1. */
const SUN = [2.3, 2.15, 1.95] as const

interface LightSetup {
  sunDir: [number, number, number]
  sunCol: [number, number, number]
  /** Cosinus del radi aparent del sol (con on es mostreja). */
  sunCosMax: number
  /** Alfa² que s'afegeix al reflex quan es calcula el sol (el reflex té la mida del sol). */
  sunA2: number
  /** Llum del cel directa: 0 = cosinus (cel llis), 1 = HDRI per importància, 2 = per les finestres. */
  neeMode: number
  /** Multiplicador de la llum de les làmpades (0 = apagades). */
  lampScale: number
  /** La llum de les làmpades vista directament des de la càmera (`RenderOpts.lampView`). */
  lampView: number
}

/** Llums derivades de les opcions: les mateixes per al worker de CPU i per a la GPU. */
export function lightSetup(scene: RenderScene, o: RenderOpts, env: RenderEnv | null): LightSetup {
  const az = (o.sunAzimuth * Math.PI) / 180, el = (o.sunElevation * Math.PI) / 180
  // De dia (ambients) el sol és unes tres vegades més fort que el cel, com a fora.
  const k = o.sunIntensity * (scene.daylight ? 3 : 1)
  const angle = 0.005 + o.softness * 0.2
  return {
    sunDir: [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)],
    sunCol: [SUN[0] * k, SUN[1] * k, SUN[2] * k],
    sunCosMax: Math.cos(angle),
    sunA2: (angle / 2) ** 2,
    neeMode: scene.interior && scene.portals.length > 0 ? 2 : env ? 1 : 0,
    lampScale: o.lamps === false ? 0 : Math.max(0, o.lampIntensity ?? 1),
    lampView: Math.max(0, o.lampView ?? 1),
  }
}
