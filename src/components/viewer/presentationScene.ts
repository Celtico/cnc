import { useEffect, useState } from "react"

/**
 * Escena del mode «Presentació» (terra, paret i llum). És una preferència del dispositiu,
 * com la qualitat: es desa al navegador i no viatja amb el moble ni amb les preferències.
 */
export type FloorId = "oak" | "walnut" | "concrete" | "plain"
export type LightId = "studio" | "warm" | "daylight"
export type SkirtingId = "white" | "wall" | "floor" | "none"

export interface PresentationScene {
  floor: FloorId
  wall: string
  light: LightId
  skirting: SkirtingId
  /** Material de la biblioteca (Preferències › Materials) per al terra; si no, la mostra `floor`. */
  floorMaterial?: string
  /** Material de la biblioteca per a la paret; si no, el color `wall`. */
  wallMaterial?: string
}

export const FLOORS: { id: FloorId; label: string; swatch: string }[] = [
  { id: "oak", label: "Roure", swatch: "#c9a67a" },
  { id: "walnut", label: "Noguera", swatch: "#6e4a30" },
  { id: "concrete", label: "Microciment", swatch: "#a9a59f" },
  { id: "plain", label: "Blanc", swatch: "#eeeeec" },
]

export const WALLS: { color: string; label: string }[] = [
  { color: "#ebe6de", label: "Os" },
  { color: "#f6f5f2", label: "Blanc" },
  { color: "#cfcac2", label: "Gris pedra" },
  { color: "#b9c2b3", label: "Verd sàlvia" },
  { color: "#d9c3ad", label: "Terracota suau" },
  { color: "#3d4046", label: "Antracita" },
]

export const SKIRTINGS: { id: SkirtingId; label: string }[] = [
  { id: "white", label: "Blanc" },
  { id: "wall", label: "Com la paret" },
  { id: "floor", label: "Com el terra" },
  { id: "none", label: "Sense" },
]

export const LIGHTS: { id: LightId; label: string; help: string }[] = [
  { id: "studio", label: "Estudi", help: "Neutra i suau, com una foto de catàleg." },
  { id: "warm", label: "Càlida", help: "Llum de tarda, tons més acollidors." },
  { id: "daylight", label: "Dia", help: "Llum freda i intensa, ombres més marcades." },
]

/** Paràmetres de cada llum: color i intensitats de la llum principal, l'ambient i els reflexos. */
export const LIGHT_SPEC: Record<LightId, { key: string; keyIntensity: number; ambient: number; env: number; sky: string }> = {
  studio: { key: "#ffffff", keyIntensity: 1.4, ambient: 0.25, env: 1, sky: "#ffffff" },
  warm: { key: "#ffd9b0", keyIntensity: 1.5, ambient: 0.22, env: 0.85, sky: "#ffe6c8" },
  daylight: { key: "#eef4ff", keyIntensity: 2, ambient: 0.3, env: 1.1, sky: "#dfeaff" },
}

export const DEFAULT_SCENE: PresentationScene = { floor: "oak", wall: WALLS[0]!.color, light: "studio", skirting: "white" }

const KEY = "mobles:presentation-scene"
const EVENT = "mobles:presentation-scene-change"

function read(): PresentationScene {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<PresentationScene> | null
    if (!v) return DEFAULT_SCENE
    return {
      floor: FLOORS.some((f) => f.id === v.floor) ? v.floor! : DEFAULT_SCENE.floor,
      wall: typeof v.wall === "string" && /^#[0-9a-f]{6}$/i.test(v.wall) ? v.wall : DEFAULT_SCENE.wall,
      light: LIGHTS.some((l) => l.id === v.light) ? v.light! : DEFAULT_SCENE.light,
      skirting: SKIRTINGS.some((k) => k.id === v.skirting) ? v.skirting! : DEFAULT_SCENE.skirting,
      ...(typeof v.floorMaterial === "string" && v.floorMaterial ? { floorMaterial: v.floorMaterial } : {}),
      ...(typeof v.wallMaterial === "string" && v.wallMaterial ? { wallMaterial: v.wallMaterial } : {}),
    }
  } catch {
    return DEFAULT_SCENE
  }
}

export function usePresentationScene(): [PresentationScene, (patch: Partial<PresentationScene>) => void] {
  const [s, setS] = useState<PresentationScene>(read)
  useEffect(() => {
    const on = () => setS(read())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  const set = (patch: Partial<PresentationScene>) => {
    const next = { ...read(), ...patch }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* només aquesta sessió */
    }
    setS(next)
    window.dispatchEvent(new Event(EVENT))
  }
  return [s, set]
}
