import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector3 } from "three"
import type { Panel } from "../../core/model"
import { S } from "./cabinet/constants"
import { isShaped, mitreGeometry, shapedGeometry } from "./cutoutGeometry"
import { visualPanel } from "./exportablePanel"
import { machiningOutlines } from "./machiningOutlines"

/**
 * Arestes netes, com el `cleanEdges` del Taulell: només on dues cares es troben amb un angle de debò (`deg`). Les juntes
 * internes que deixa el tall (CSG, vèrtexs en T) no surten, a diferència d'`EdgesGeometry`, que hi dibuixa tots els costats
 * sense parella i omple el Filferro de triangles (cel, 2026-11-08).
 */
export function cleanEdges(geo: BufferGeometry, deg = 20): BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo
  const pos = src.getAttribute("position").array as ArrayLike<number>
  if (src !== geo) src.dispose()
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  // Tolerància relativa a la mida (les peces van en metres, els ferratges poden anar en mm).
  const q = 1 / Math.max(bb.max.clone().sub(bb.min).length() * 1e-5, 1e-9)
  const th = Math.cos((deg * Math.PI) / 180)
  const key = (i: number) => `${Math.round(pos[i]! * q)},${Math.round(pos[i + 1]! * q)},${Math.round(pos[i + 2]! * q)}`
  const E = new Map<string, { n: Vector3; i: number; j: number; c: number }>()
  const out: number[] = []
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  for (let t = 0; t + 8 < pos.length; t += 9) {
    a.set(pos[t]!, pos[t + 1]!, pos[t + 2]!)
    b.set(pos[t + 3]!, pos[t + 4]!, pos[t + 5]!)
    c.set(pos[t + 6]!, pos[t + 7]!, pos[t + 8]!)
    const n = b.clone().sub(a).cross(c.clone().sub(a))
    if (n.lengthSq() < 1e-20) continue
    n.normalize()
    for (const [i, j] of [[0, 3], [3, 6], [6, 0]] as const) {
      const ki = key(t + i), kj = key(t + j)
      if (ki === kj) continue
      const k = ki < kj ? ki + "|" + kj : kj + "|" + ki
      const e = E.get(k)
      if (!e) E.set(k, { n, i: t + i, j: t + j, c: 1 })
      else if (++e.c === 2 && e.n.dot(n) < th) out.push(pos[e.i]!, pos[e.i + 1]!, pos[e.i + 2]!, pos[e.j]!, pos[e.j + 1]!, pos[e.j + 2]!)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute("position", new Float32BufferAttribute(out, 3))
  return g
}

/**
 * Les línies d'una peça al Filferro sol: el contorn sencer de la peça sense buidar i els mecanitzats dibuixats
 * (`machiningOutlines`). El tall parteix les arestes llargues amb vèrtexs en T i `cleanEdges` sol en perdria la
 * meitat (cel, 2026-11-08: «se deja la mitad del canto»). Mateixa posició que la malla: amb `cut`, origen a la cantonada.
 */
export function panelLines(p: Panel, cut: BufferGeometry | null): BufferGeometry {
  const plain = visualPanel(p)
  const [L, W, T] = [p.length * S, p.width * S, p.thickness * S]
  const base = isShaped(plain) ? shapedGeometry(plain) : plain.mitres?.length ? mitreGeometry(plain) : new BoxGeometry(L, W, T)
  if (cut && base instanceof BoxGeometry) base.translate(L / 2, W / 2, T / 2)
  const out = cleanEdges(base, 25)
  base.dispose()
  // Els mecanitzats, dibuixats (`machiningOutlines`), a la posició de la malla (amb `cut`, origen a la cantonada).
  const mm = machiningOutlines(p)
  if (!mm.length) return out
  const shift = cut ? [0, 0, 0] : [L / 2, W / 2, T / 2]
  const a = out.getAttribute("position").array
  const all = new Float32Array(a.length + mm.length)
  all.set(a)
  mm.forEach((v, i) => (all[a.length + i] = v * S - shift[i % 3]!))
  out.setAttribute("position", new Float32BufferAttribute(all, 3))
  return out
}
