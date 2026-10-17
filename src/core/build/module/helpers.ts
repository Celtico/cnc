import {
  type BPt,
  NO_EDGES,
  profileToOutline,
  sampleProfile,
  type PNode,
  type EdgeBanding,
  type EdgeSide,
  type HardwareItem,
  type Panel,
  type Vec3,
} from "../../model"
import { toWorld } from "../geometry"
import { applyHardware, type SlotSpec } from "../hardware"

/** Perfil del tauler (mm, amb la seva mida) escalat a llarg × ample i passat a rectes i arcs. */
export function shapeOutline(shape: PNode[], length: number, width: number): BPt[] {
  // Extensió real de la corba (les cúbiques poden sortir dels nodes): si no, la peça
  // quedaria més gran que el rectangle que ocupa al nesting.
  const pts = sampleProfile(shape, 64)
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const sx = length / Math.max(1, Math.max(...xs) - x0)
  const sy = width / Math.max(1, Math.max(...ys) - y0)
  const scaled: PNode[] = shape.map((n) => ({
    ...n,
    x: (n.x - x0) * sx,
    y: (n.y - y0) * sy,
    ...(n.in ? { in: [n.in[0] * sx, n.in[1] * sy] as [number, number] } : {}),
    ...(n.out ? { out: [n.out[0] * sx, n.out[1] * sy] as [number, number] } : {}),
  }))
  return profileToOutline(scaled)
}

export function edges(...sides: EdgeSide[]): EdgeBanding {
  const e = { ...NO_EDGES }
  for (const s of sides) e[s] = true
  return e
}

export const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.51

/** La caixa d'una peça al mòdul (mm). */
export function worldBoxOf(p: Panel): { min: Vec3; max: Vec3 } {
  const cs = [0, p.length].flatMap((u) => [0, p.width].flatMap((v) => [0, p.thickness].map((w) => toWorld(p, [u, v, w]))))
  return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
}

/** Material dels fronts (portes, calaixos, abatibles, reixetes, fixos): el propi o, si no n'hi ha, el del cos. */
export function frontMaterialOf(m: { carcass: { material: string; frontMaterial?: string } }): string {
  return m.carcass.frontMaterial?.trim() || m.carcass.material
}

/**
 * Material del fons dels calaixos (gruix `bottomThickness` dels ferratges). Les peces es
 * classifiquen per material + gruix (nesting, CSV): si el fons del moble té el mateix gruix,
 * el mateix material (comparteixen tauler); si el nom porta el gruix («DM 10»), el nom amb el
 * gruix del fons del calaix («DM 8»); si no, el mateix nom (un altre tauler del mateix
 * material) i s'avisa perquè es comprovi que existeix en aquest gruix.
 */
export function drawerBottomMaterial(backMaterial: string, backThickness: number, bottomThickness: number): { name: string; warn: boolean } {
  if (backThickness === bottomThickness) return { name: backMaterial, warn: false }
  const re = new RegExp(`(^|[^\\d.,])${String(backThickness).replace(".", "[.,]")}(\\s*mm)?(?![\\d.,]*\\d)`)
  if (re.test(backMaterial)) return { name: backMaterial.replace(re, (_, pre: string, unit?: string) => `${pre}${bottomThickness}${unit ?? ""}`), warn: false }
  return { name: backMaterial, warn: true }
}

/**
 * Forats d'un tirador de barra: dos forats passants Ø5 a la distància estàndard (128 o, si no
 * hi cap, 96 / 64) al voltant de (cx, cy), al llarg de l'eix local `along`. Van com a talls
 * passants (com els passacables): així els llegeix el taller i es fan al nesting.
 */
export function addHandle(p: Panel, cx: number, cy: number, along: "x" | "y", item: HardwareItem, spec: SlotSpec<"handle">): boolean {
  const room = along === "x" ? p.length : p.width
  // La distància entre forats segons l'espai (128 o, si no hi cap, 96 / 64: la regla del tirador).
  const pitch = spec.pitch(room)
  const m = spec.margin
  const { cutouts } = applyHardware(item, "front", { pitch }, { at: { x: cx, y: cy }, axis: along, round: true })
  // Cada forat sencer dins de la peça amb `margin` (3 mm) de matèria al voltant i sense tocar cap altre forat de cara (les
  // cassoletes de les frontisses d'una porta estreta): si no, no es fa cap dels dos.
  const fits = cutouts.every((c) => {
    if (c.kind !== "circle") return false
    const R = c.diameter / 2
    const { x, y } = c
    return x - R >= m && x + R <= p.length - m && y - R >= m && y + R <= p.width - m && p.holes.every((h) => h.face === "edge" || Math.hypot(h.x - x, h.y - y) >= h.diameter / 2 + R + m)
  })
  if (!fits) return false
  ;(p.cutouts ??= []).push(...cutouts)
  return true
}

/**
 * Alçades «auto» dels fronts de calaix a mig mil·límetre cap avall (253,5 i no 253,33): fronts iguals surten amb la
 * mateixa mida al taller (no 253,34 i 253,33, dues peces diferents a la llista) i amb els mateixos mecanitzats. El que
 * sobra (menys de 0,5 mm per calaix) queda al joc de dalt de la pila: no es nota.
 */
export function snapAutoHeights(heights: number[], sizes: (number | "auto")[]): number[] {
  if (sizes.filter((x) => x === "auto").length < 2) return heights
  return heights.map((h, i) => (sizes[i] === "auto" ? Math.floor(h * 2 + 1e-6) / 2 : h))
}
