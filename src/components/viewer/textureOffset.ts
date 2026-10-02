/**
 * Desplaçament de la textura de cada peça: sense, totes les portes d'un armari tenen la mateixa
 * veta (comencen al mateix origen UV). Determinista (hash de l'id de la peça): no canvia en
 * recarregar ni entre el visor, el render i l'export.
 */
export interface TextureOffset {
  /** Desplaçament en repeticions de la textura, [0, 1) en cada eix. */
  u: number
  v: number
  /** Girada 180° (la veta segueix en la mateixa direcció). */
  flip: boolean
}

/** FNV-1a de 32 bits amb una barreja final (murmur3 fmix) perquè ids semblants s'allunyin. */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Desplaçament de la textura per a una clau (l'id de la peça, amb la cara si cal). */
export function textureOffset(key: string): TextureOffset {
  const a = hash32(key)
  const b = hash32(`${key}#v`)
  return { u: (a >>> 8) / 0x1000000, v: (b >>> 8) / 0x1000000, flip: (a & 1) === 1 }
}
