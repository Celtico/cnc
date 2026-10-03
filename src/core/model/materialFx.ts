import type { MaterialPref } from "./settings"

/**
 * Vernís i vellut del render (`MaterialPref.coat` / `sheen`, 0–1). Sense valor propi, el de l'app: els materials inicials
 * per id i, la resta, segons l'acabat (pedra polida → vernís). Així les preferències desades abans també en tenen, sense
 * cap migració, i un valor posat a mà (també 0) mana.
 */
const BUILTIN_FX: Record<string, { coat?: number; sheen?: number }> = {
  // Vellut i teles: s'aclareixen a les vores.
  "sim-velvet-green": { sheen: 0.9 },
  "sim-velvet-olive": { sheen: 0.9 },
  "sim-fabric-grey": { sheen: 0.3 },
  "sim-fabric-beige": { sheen: 0.3 },
  "sim-fabric-blue": { sheen: 0.3 },
  "sim-fabric-navy": { sheen: 0.35 },
  "sim-fabric-sand": { sheen: 0.3 },
  "sim-fabric-red": { sheen: 0.35 },
  "sim-fabric-ochre": { sheen: 0.35 },
  "sim-linen-white": { sheen: 0.2 },
  "sim-boucle": { sheen: 0.25 },
  // Cuir, parquet envernissat, rajola i porcellànic, ceràmica, pantalla.
  "sim-leather": { coat: 0.3 },
  "sim-leather-green": { coat: 0.3 },
  "sim-leather-black": { coat: 0.35 },
  "sim-parquet-oak": { coat: 0.3 },
  "sim-parquet-walnut": { coat: 0.35 },
  "sim-tile-white": { coat: 0.5 },
  "sim-tile-grey": { coat: 0.5 },
  "sim-porcelain-black": { coat: 0.7 },
  "sim-ceramic-white": { coat: 0.8 },
  "sim-ceramic-black": { coat: 0.8 },
  "sim-screen": { coat: 0.9 },
}

export function materialCoat(m: MaterialPref): number {
  if (m.coat !== undefined) return m.coat
  const b = BUILTIN_FX[m.id]?.coat
  if (b !== undefined) return b
  // Pedra polida (marbre, granit): el polit és el vernís.
  if (m.finish.kind === "stone" && (m.finish.polish ?? 0.6) > 0.5) return Math.min(1, (m.finish.polish ?? 0.6) * 0.9)
  return 0
}

export function materialSheen(m: MaterialPref): number {
  if (m.sheen !== undefined) return m.sheen
  return BUILTIN_FX[m.id]?.sheen ?? 0
}
