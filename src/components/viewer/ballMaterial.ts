import type { MeshStandardMaterial } from "three"
import type { MaterialPref } from "../../core/model"
import { finishMaterial } from "./exportablePanel"
import { finishOfPref, woodGenOf, type FinishSpec } from "./textures"

/** Diàmetre real de la bola de material (mm): la textura hi va a la mateixa escala que a les peces. */
export const BALL_MM = 300

/**
 * Mida (mm) que cobreix la u de la bola (la volta sencera, π·D; la v va de pol a pol, π·D/2: les UV de la
 * `SphereGeometry` són 2:1 i així la textura no s'estira a l'equador). Perquè no hi hagi costura on la volta es
 * tanca, el nombre de repeticions en u ha de ser enter (parell si la foto va en mirall): si n'hi ha prou amb
 * estirar-la com a molt un 12 %, s'hi ajusta; si no, es queda a escala real i la costura queda darrere.
 */
export function ballSpanU(f: FinishSpec): number {
  const u = Math.PI * BALL_MM
  if (f.kind === "color") return u
  // Període de la textura en la u de la bola (una foto amb la veta vertical es gira un quart: hi va l'alçada).
  const period = f.kind === "wood" ? woodGenOf(f.species, f.gen).tileMm : f.kind === "image" && f.grain === "y" ? f.tileMm * (f.aspect ?? 1) : f.tileMm
  if (!(period > 0)) return u
  const step = f.kind === "image" && !f.seamless ? 2 : 1
  const n = u / period
  const whole = Math.max(step, Math.round(n / step) * step)
  return Math.abs(whole / n - 1) <= 0.12 ? whole * period : u
}

/** Material de la bola (el mateix camí que les peces del visor: `finishMaterial`), a escala real. */
export function ballMaterial(m: MaterialPref): MeshStandardMaterial {
  const f = finishOfPref(m)
  return finishMaterial(f, ballSpanU(f), (Math.PI * BALL_MM) / 2)
}

/** Tot el que canvia l'aspecte de la bola (si no canvia, no es refà el material). */
export function ballKey(m: MaterialPref): string {
  return JSON.stringify([m.finish, m.glow ?? 0, m.translucent ?? 0])
}
