import { simplify, type DxfDrawing, type P2 } from "./dxf"

/**
 * Vistes 2D d'un ferratge importat (les `_2D_front/side/top_view.dxf` de Hettich), simplificades per desar-les (Dexie,
 * amb el model 3D) i dibuixar-les a l'editor. La **frontal** (la que mira la cara de la peça) es mira de **registrar** al
 * marc del ferratge (u, v: el dels mecanitzats proposats): de les 8 orientacions d'eixos, la que fa caure els cercles del
 * dibuix sobre els forats; així es pot posar de fons sota els forats. Pur.
 */

export type ViewName = "front" | "side" | "top"

export interface HardwareView {
  name: ViewName
  /** Polilínies com a llistes planes [x0, y0, x1, y1, …] (mm, centèsimes). */
  lines: number[][]
  /** Punts de connexió (capa CONNECTIONPOINTS), x y z tal com venen. */
  points: [number, number, number][]
  /** Al marc del ferratge (u, v) o tal com ve el fitxer. */
  registered: boolean
}

const r2 = (x: number) => Math.round(x * 100) / 100

/** Les 8 orientacions d'eixos (girs de 90° i miralls). */
const ORIENT: ((p: P2) => P2)[] = [
  ([x, y]) => [x, y],
  ([x, y]) => [-x, y],
  ([x, y]) => [x, -y],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, x],
  ([x, y]) => [-y, x],
  ([x, y]) => [y, -x],
  ([x, y]) => [-y, -x],
]

/**
 * Transformació del dibuix al marc (u, v) que fa coincidir els cercles amb els forats `holes` (error mitjà < 0,5 mm),
 * o `null`. El primer forat (la cassoleta, o el primer de la placa) fixa la translació.
 */
export function registerView(d: DxfDrawing, holes: { u: number; v: number; d: number }[]): ((p: P2) => P2) | null {
  if (!holes.length || !d.circles.length) return null
  let best: { f: (p: P2) => P2; err: number } | null = null
  const anchor = holes[0]!
  for (const o of ORIENT) {
    // Candidats per a l'ancoratge: els cercles d'un diàmetre semblant.
    for (const c of d.circles) {
      if (Math.abs(2 * c.r - anchor.d) > Math.max(1.5, anchor.d * 0.15)) continue
      const [cx, cy] = o([c.x, c.y])
      const f = (p: P2): P2 => {
        const [x, y] = o(p)
        return [x - cx + anchor.u, y - cy + anchor.v]
      }
      let err = 0
      for (const h of holes) {
        let near = Infinity
        for (const k of d.circles) {
          const [x, y] = f([k.x, k.y])
          near = Math.min(near, Math.hypot(x - h.u, y - h.v))
        }
        err += near
      }
      err /= holes.length
      if (!best || err < best.err - 1e-6) best = { f, err }
    }
  }
  return best && best.err < 0.5 ? best.f : null
}

/** Vista per desar: polilínies simplificades (0,02 mm) i, si es pot, al marc del ferratge. */
export function viewFromDxf(name: ViewName, d: DxfDrawing, holes?: { u: number; v: number; d: number }[]): HardwareView {
  const reg = holes ? registerView(d, holes) : null
  const lines = d.polylines
    .filter((p) => !/^CONNECTIONPOINTS$/i.test(p.layer))
    .map((p) => simplify(reg ? p.pts.map(reg) : p.pts, 0.02).flatMap(([x, y]) => [r2(x), r2(y)]))
    .filter((l) => l.length >= 4)
  const points = d.points.filter((p) => /CONNECTION/i.test(p.layer)).map((p) => [r2(p.x), r2(p.y), r2(p.z)] as [number, number, number])
  return { name, lines, points, registered: !!reg }
}

/** Caixa d'unes línies (per encaixar el dibuix). */
export function viewBounds(lines: number[][]): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const l of lines)
    for (let i = 0; i + 1 < l.length; i += 2) {
      x0 = Math.min(x0, l[i]!)
      x1 = Math.max(x1, l[i]!)
      y0 = Math.min(y0, l[i + 1]!)
      y1 = Math.max(y1, l[i + 1]!)
    }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null
}
