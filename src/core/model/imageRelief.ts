import { z } from "zod"
import type { ObjectBox } from "./meshShape"

/**
 * Relleu d'una imatge en blanc i negre (per decisió de l'usuari, 2026-10-17: «importar imatges en blanc i negre perquè
 * s'adapti al relleu»): la imatge en grisos (`data`, un byte per píxel en base64, fila 0 = la de dalt de la imatge) és una
 * superfície d'alçades dins de la caixa de l'objecte: el negre a baix de la caixa (el més fons) i el blanc a dalt (sense
 * `invert`; amb, al revés). La imatge va al pla X–Z (vista des de dalt: amunt de la imatge = cap a la paret). La peça que
 * hi toca es buida per sobre de la superfície, des de la cara per on entra (com una forma lliure). Pur.
 */
export const ImageReliefSchema = z.object({
  w: z.number().int().min(2).max(512),
  h: z.number().int().min(2).max(512),
  /** Grisos (0 negre … 255 blanc), `w × h` bytes en base64. */
  data: z.string().min(4),
  /** Blanc = el més fons (sense: negre = el més fons). */
  invert: z.boolean().optional(),
  /** Nom del fitxer (per saber d'on ve). */
  name: z.string().optional(),
})
export type ImageRelief = z.infer<typeof ImageReliefSchema>

type V3 = [number, number, number]

/** Els grisos d'una imatge (de 0 a 1). */
export function reliefLevels(img: ImageRelief): Float32Array {
  const bin = atob(img.data)
  const out = new Float32Array(img.w * img.h)
  for (let k = 0; k < out.length; k++) out[k] = (k < bin.length ? bin.charCodeAt(k) : 0) / 255
  return out
}

/** Grisos (0–255) a base64. */
export function encodeLevels(levels: Uint8Array): string {
  let s = ""
  for (let k = 0; k < levels.length; k += 0x8000) s += String.fromCharCode(...levels.subarray(k, k + 0x8000))
  return btoa(s)
}

/**
 * La superfície d'alçades dins de la caixa (0 a 1 a cada eix): punts i triangles (antihoraris vistos de dalt). x = columna
 * de la imatge, z = de la paret (fila 0, dalt de la imatge) cap a davant, y = l'alçada. Amb `maxSide`, se'n pren un píxel
 * de cada `k` (com a molt `maxSide` punts per costat; el visor en fa servir 160).
 */
export function reliefSurface(img: ImageRelief, maxSide?: number): { positions: V3[]; triangles: [number, number, number][] } {
  const lv = reliefLevels(img)
  const k = maxSide ? Math.max(1, Math.ceil(Math.max(img.w, img.h) / maxSide)) : 1
  const nx = Math.ceil(img.w / k), nz = Math.ceil(img.h / k)
  const positions: V3[] = []
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const si = Math.min(img.w - 1, i * k), sj = Math.min(img.h - 1, j * k)
      const g = lv[sj * img.w + si]!
      positions.push([si / (img.w - 1), img.invert ? 1 - g : g, sj / (img.h - 1)])
    }
  const triangles: [number, number, number][] = []
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
      // Vist des de dalt (+y), antihorari: x cap a la dreta, z cap a davant.
      triangles.push([a, c, b], [b, c, d])
    }
  return { positions, triangles }
}

/** Els triangles de la superfície en coordenades de la composició (mm). */
export function reliefWorldTriangles(o: ObjectBox & { image?: ImageRelief }): [V3, V3, V3][] {
  if (!o.image) return []
  const s = reliefSurface(o.image)
  const pts = s.positions.map((p): V3 => [o.x + p[0] * o.w, o.y + p[1] * o.h, o.z + p[2] * o.d])
  return s.triangles.map((t): [V3, V3, V3] => [pts[t[0]]!, pts[t[1]]!, pts[t[2]]!])
}
