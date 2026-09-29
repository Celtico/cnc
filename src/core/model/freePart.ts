import { z } from "zod"
import { ProfileNodeSchema, type Vec3 } from "./panel"

/**
 * Peces lliures: taulers solts que es col·loquen i s'editen com els objectes de referència
 * (posició X/Y/Z, gizmo al 3D, forma amb l'editor de perfils) però són peces de debò: van
 * al nesting, a la llista de peces, al DXF, al STEP i al CSV. Serveixen per als mobles
 * flat-pack i d'encaix a pressió: on dues peces lliures es toquen o s'encavalquen, el
 * build hi fa l'encaix sol (pestanyes i mortalles, mitja fusta, dits o espigues).
 */

const mm = z.number().finite()

/**
 * Orientació (pla del tauler):
 *  - front: dret, de cara (pla X–Y, gruix cap endavant): un fons, una porta, un travesser.
 *  - side: dret, de costat (pla Z–Y, gruix de costat): un lateral, un divisor.
 *  - flat: estirat (pla X–Z, gruix vertical): un prestatge, una tapa, un seient.
 */
export const PartOrientSchema = z.enum(["front", "side", "flat"])
export type PartOrient = z.infer<typeof PartOrientSchema>

export const FreePartSchema = z.object({
  id: z.string(),
  name: z.string(),
  orient: PartOrientSchema,
  /** Mides dins del seu pla: `w` (u) i `h` (v). front: ample × alt · side: fons × alt · flat: ample × fons. */
  w: mm.positive(),
  h: mm.positive(),
  thickness: mm.positive(),
  material: z.string(),
  /** Cantonada mínima (esquerra, baix, darrere) de la caixa de la peça, en coordenades de la composició. */
  x: mm,
  y: mm,
  z: mm,
  /** Contorn (editor de perfils), escalat a w × h. Sense: rectangle. */
  shape: z.array(ProfileNodeSchema).min(3).optional(),
  /**
   * false: no es talla a la CNC (ferro, pedra, vidre…): es veu al 3D amb el seu material però
   * no va al nesting ni als fitxers del taller; surt a «Elements sense nesting». Es posa sol
   * en triar un material de les preferències que no és de CNC.
   */
  nest: z.boolean().optional(),
  /** Grup (nom): les peces del mateix grup es mouen juntes; a l'arbre surten plegades a sota. */
  group: z.string().optional(),
  /** false: la peça no fa encaixos amb les altres (per defecte, sí). */
  joints: z.boolean().optional(),
  /** Veta al llarg de u (per defecte), de v o sense. */
  grain: z.enum(["u", "v", "none"]).optional(),
})
export type FreePart = z.infer<typeof FreePartSchema>

/** Paràmetres dels encaixos de tot el moble. */
export const JoinerySchema = z.object({
  /**
   * Joc de l'encaix (mm): les mortalles i les ranures surten aquest tant més amples que la
   * peça que hi entra. 0 = encaix a pressió dur; 0,1–0,2 a pressió; 0,3–0,5 fluix (desmuntable).
   */
  clearance: mm.min(0).max(3),
  /** Ø de la fresa (mm): les cantonades interiors porten «dogbone» d'aquest Ø perquè hi entri la pestanya. */
  tool: mm.min(0).max(25),
  /** Ample aproximat de cada pestanya o dit (mm). */
  tabWidth: mm.min(10).max(500),
  /** Cantonades interiors amb dogbone (per defecte, sí). */
  dogbones: z.boolean().optional(),
})
export type Joinery = z.infer<typeof JoinerySchema>

export const DEFAULT_JOINERY: Joinery = { clearance: 0.2, tool: 6, tabWidth: 50 }

/** Eixos de la peça: normal (gruix), u i v (índexs 0 = x, 1 = y, 2 = z). */
export const PART_AXES: Record<PartOrient, { n: 0 | 1 | 2; u: 0 | 1 | 2; v: 0 | 1 | 2 }> = {
  front: { n: 2, u: 0, v: 1 },
  side: { n: 0, u: 2, v: 1 },
  flat: { n: 1, u: 0, v: 2 },
}

/** Mida de la caixa de la peça a la composició [x, y, z]. */
export function partSize(p: FreePart): Vec3 {
  const s: [number, number, number] = [0, 0, 0]
  const ax = PART_AXES[p.orient]
  s[ax.n] = p.thickness
  s[ax.u] = p.w
  s[ax.v] = p.h
  return s
}

/** Caixa de la peça (mm, coordenades de la composició). */
export function partBox(p: FreePart): { min: Vec3; max: Vec3 } {
  const s = partSize(p)
  return { min: [p.x, p.y, p.z], max: [p.x + s[0], p.y + s[1], p.z + s[2]] }
}

/**
 * Canvia l'orientació conservant el centre: el pla gira i les mides (w, h) es queden.
 * Amb «flat» la v passa a ser la fondària.
 */
export function reorientPart(p: FreePart, orient: PartOrient): FreePart {
  if (orient === p.orient) return p
  const a = partBox(p)
  const c = [0, 1, 2].map((i) => (a.min[i]! + a.max[i]!) / 2)
  const n: FreePart = { ...p, orient }
  const s = partSize(n)
  return { ...n, x: Math.round(c[0]! - s[0] / 2), y: Math.max(0, Math.round(c[1]! - s[1] / 2)), z: Math.round(c[2]! - s[2] / 2) }
}

/** Caixa que engloba unes quantes peces (un grup). */
export function partsBox(parts: FreePart[]): { min: Vec3; max: Vec3 } {
  const bs = parts.map(partBox)
  const min = [0, 1, 2].map((a) => Math.min(...bs.map((b) => b.min[a]!))) as unknown as Vec3
  const max = [0, 1, 2].map((a) => Math.max(...bs.map((b) => b.max[a]!))) as unknown as Vec3
  return { min, max }
}

/** Noms dels grups de peces, en l'ordre en què surten. */
export function partGroups(parts: FreePart[]): string[] {
  return [...new Set(parts.flatMap((p) => (p.group ? [p.group] : [])))]
}
