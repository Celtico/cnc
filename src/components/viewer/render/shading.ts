/**
 * Constants i funcions de l'ombrejat compartides pels dos motors (CPU i GPU), perquè facin el
 * mateix. El shader en porta una còpia en WGSL (`gpuTracer.wgsl.ts`).
 */

/** Radi de les arestes arrodonides dels taulers (m): les vores agafen llum com les de debò. */
export const BEVEL_RADIUS = 0.002
/**
 * Llum indirecta màxima d'una mostra, en múltiples de la llum típica de l'escena (`sceneKey`, la
 * mitjana geomètrica: l'exposició automàtica la porta al gris mitjà): treu les «ateses» (punts
 * blancs), també a les habitacions fosques.
 */
export const INDIRECT_CLAMP = 20
/** Llum directa màxima d'una mostra (molt més alta: els reflexos del sol es queden). */
export const DIRECT_CLAMP = 400
/** Relleu de la veta (inclinació de la normal per diferència de luminància entre texels). */
export const BUMP_STRENGTH = 6
/** Rugositat mínima dels reflexos vistos després d'un rebot difús (regularització del camí). */
export const PATH_ROUGHNESS = 0.45
/** Vidre: llum que deixa passar cap a les ombres (sol i finestres). */
export const GLASS_SHADOW = 0.85

/**
 * Normal de les arestes arrodonides d'una caixa (coordenades locals de la malla): a menys de
 * `r` d'una aresta de la cara, la normal s'inclina cap a fora fins a 45° just a l'aresta (on es
 * troba amb la de l'altra cara). Només els eixos paral·lels a la cara (la normal geomètrica `n`
 * no hi apunta). També val per a les cares a inglet i les extrusions (arrodoneix les tapes).
 * Torna la normal normalitzada.
 */
export function bevelNormal(p: ArrayLike<number>, n: ArrayLike<number>, min: ArrayLike<number>, max: ArrayLike<number>, r: number): [number, number, number] {
  const out: [number, number, number] = [n[0]!, n[1]!, n[2]!]
  for (let a = 0; a < 3; a++) {
    if (Math.abs(n[a]!) > 0.5) continue
    const ra = Math.min(r, (max[a]! - min[a]!) * 0.25)
    if (!(ra > 0)) continue
    const lo = p[a]! - min[a]!, hi = max[a]! - p[a]!
    if (lo < ra && lo <= hi) out[a] = out[a]! - (1 - Math.max(0, lo) / ra)
    else if (hi < ra) out[a] = out[a]! + (1 - Math.max(0, hi) / ra)
  }
  const l = Math.hypot(out[0], out[1], out[2]) || 1
  out[0] /= l
  out[1] /= l
  out[2] /= l
  return out
}

/** Luminància (Rec. 709). */
export const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Escala un color perquè la seva luminància no passi de `max` (les ateses). */
export function clampLum(c: [number, number, number], max: number): [number, number, number] {
  const l = luminance(c[0], c[1], c[2])
  if (!(l <= max)) {
    if (!Number.isFinite(l)) return [0, 0, 0]
    const k = max / l
    return [c[0] * k, c[1] * k, c[2] * k]
  }
  return c
}
