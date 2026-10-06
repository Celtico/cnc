import { Color, MeshPhysicalMaterial, MeshStandardMaterial } from "three"
import { materialCoat, materialSheen, type MaterialPref } from "../../core/model"
import { finishMaterial } from "./exportablePanel"
import { COAT_ROUGHNESS } from "./render/shading"
import { finishOfPref, woodGenOf, type FinishFx, type FinishSpec } from "./textures"

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

/**
 * Material de la bola (el mateix camí que les peces del visor: `finishMaterial`), a escala real, i amb el que al visor
 * només llegeix el render (`userData`) fet visible perquè la bola digui la veritat: vegeu `physicalBall`.
 */
export function ballMaterial(m: MaterialPref): MeshPhysicalMaterial {
  const f = finishOfPref(m)
  return physicalBall(finishMaterial(f, ballSpanU(f), (Math.PI * BALL_MM) / 2), f)
}

/**
 * Còpia física del material de la peça (les mateixes textures, sense copiar-les) amb els efectes «Al render»
 * aproximats com el path tracer: **Reflex** (`coat`) = vernís (`clearcoat`, la rugositat del render
 * `COAT_ROUGHNESS`); **Vellut** (`sheen`) = el brill rasant de la tela, del color de la tela cap al blanc; **Llum que
 * passa** (`translucent`) = una mica de llum pròpia del mateix color (al render, part del difús passa a l'altra cara:
 * la cara a l'ombra no queda negra). La llum que fa (`glow`) ja la porta `applyFinishFx` (encesa).
 */
export function physicalBall(std: MeshStandardMaterial, f: FinishFx): MeshPhysicalMaterial {
  const p = new MeshPhysicalMaterial()
  // Només les propietats de l'estàndard (la còpia de la física llegiria camps que l'estàndard no té).
  MeshStandardMaterial.prototype.copy.call(p, std)
  p.defines = { STANDARD: "", PHYSICAL: "" }
  std.dispose()
  if (f.coat) {
    p.clearcoat = f.coat
    p.clearcoatRoughness = COAT_ROUGHNESS
  }
  if (f.sheen) {
    p.sheen = f.sheen
    p.sheenColor.copy(p.color).lerp(new Color(1, 1, 1), 0.5)
    p.sheenRoughness = 0.35
  }
  if (f.translucent && !f.glow) {
    p.emissive.copy(p.color)
    p.emissiveMap = p.map
    p.emissiveIntensity = 0.3 * f.translucent
  }
  return p
}

/** Tot el que canvia l'aspecte de la bola (si no canvia, no es refà el material): també Reflex i Vellut. */
export function ballKey(m: MaterialPref): string {
  return JSON.stringify([m.finish, m.glow ?? 0, m.translucent ?? 0, materialCoat(m), materialSheen(m)])
}
