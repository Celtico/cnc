import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape } from "three"
import { ccw, flatten, type Panel } from "../../core/model"

const S = 0.001

/**
 * Geometria d'una peça amb talls passants: el contorn extruït amb els forats (ranures amb
 * els extrems rodons, rectangles i cercles). Coordenades en m, origen a la cantonada.
 */
export function cutoutGeometry(p: Panel): ExtrudeGeometry {
  const L = p.length * S
  const W = p.width * S
  const shape = new Shape()
  if (p.outline) {
    // Contorn amb forma (tauler oval, arrodonit…): rectes i arcs aplanats.
    const pts = ccw(flatten(p.outline))
    shape.moveTo(pts[0]![0] * S, pts[0]![1] * S)
    for (const [x, y] of pts.slice(1)) shape.lineTo(x * S, y * S)
  } else {
    shape.moveTo(0, 0)
    shape.lineTo(L, 0)
    shape.lineTo(L, W)
    shape.lineTo(0, W)
  }
  shape.closePath()
  for (const c of p.cutouts ?? []) {
    const hole = new Path()
    if (c.kind === "circle") {
      hole.absarc(c.x * S, c.y * S, (c.diameter / 2) * S, 0, Math.PI * 2, true)
    } else if (c.kind === "polygon") {
      // Els forats de three van en sentit horari.
      const pts = ccw(flatten(c.points)).slice().reverse()
      hole.moveTo(pts[0]![0] * S, pts[0]![1] * S)
      for (const [x, y] of pts.slice(1)) hole.lineTo(x * S, y * S)
      hole.closePath()
    } else if (c.kind === "rect") {
      const x0 = c.x * S, y0 = c.y * S, x1 = (c.x + c.w) * S, y1 = (c.y + c.h) * S
      hole.moveTo(x0, y0)
      hole.lineTo(x0, y1)
      hole.lineTo(x1, y1)
      hole.lineTo(x1, y0)
      hole.closePath()
    } else {
      // Ranura: dos semicercles units per rectes.
      const rad = (Math.min(c.w, c.h) / 2) * S
      const x0 = c.x * S, y0 = c.y * S, x1 = (c.x + c.w) * S, y1 = (c.y + c.h) * S
      if (c.w >= c.h) {
        hole.absarc(x0 + rad, y0 + rad, rad, Math.PI / 2, (Math.PI * 3) / 2, false)
        hole.absarc(x1 - rad, y0 + rad, rad, -Math.PI / 2, Math.PI / 2, false)
      } else {
        hole.absarc(x0 + rad, y0 + rad, rad, Math.PI, Math.PI * 2, false)
        hole.absarc(x0 + rad, y1 - rad, rad, 0, Math.PI, false)
      }
      hole.closePath()
    }
    shape.holes.push(hole)
  }
  return new ExtrudeGeometry(shape, { depth: p.thickness * S, bevelEnabled: false, curveSegments: 10 })
}

/**
 * Peça amb els extrems (cantells esquerre/dret) a inglet: la secció (llarg × gruix) és un
 * trapezi, amb la cara de fora (z = 0) llarga, extruït al llarg de l'amplada. Materials:
 * [0] les dues puntes (cantells de l'amplada), [1] les cares i els bisells.
 */
export function mitreGeometry(p: Panel): BufferGeometry {
  // Prisma amb la cara de fora (z = 0) sencera i la de dins (z = T) retallada T a cada costat
  // a inglet: els 4 cantells poden anar a 45° (tapa, base i front dels laterals alhora).
  const L = p.length * S
  const W = p.width * S
  const T = p.thickness * S
  const m = new Set(p.mitres ?? [])
  const il = m.has("left") ? T : 0
  const ir = m.has("right") ? T : 0
  const ib = m.has("bottom") ? T : 0
  const it = m.has("top") ? T : 0
  const o = [[0, 0, 0], [L, 0, 0], [L, W, 0], [0, W, 0]] as const
  const i = [[il, ib, T], [L - ir, ib, T], [L - ir, W - it, T], [il, W - it, T]] as const
  const pos: number[] = []
  const uv: number[] = []
  const cx = L / 2, cy = W / 2, cz = T / 2
  // Orienta cada cara cap enfora (normal en el sentit del centre de la cara menys el del prisma).
  const quad = (a0: readonly number[], b0: readonly number[], c0: readonly number[], d0: readonly number[], uv0: number[][]) => {
    let [a, b, c, d, uvq] = [a0, b0, c0, d0, uv0]
    const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
    const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!]
    const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!]
    const f = [(a[0]! + c[0]!) / 2 - cx, (a[1]! + c[1]!) / 2 - cy, (a[2]! + c[2]!) / 2 - cz]
    if (n[0]! * f[0]! + n[1]! * f[1]! + n[2]! * f[2]! < 0) {
      ;[a, b, c, d] = [a, d, c, b]
      uvq = [uv0[0]!, uv0[3]!, uv0[2]!, uv0[1]!]
    }
    for (const [v, t] of [[a, uvq[0]], [b, uvq[1]], [c, uvq[2]], [a, uvq[0]], [c, uvq[2]], [d, uvq[3]]] as const) {
      pos.push(v[0]!, v[1]!, v[2]!)
      uv.push(t![0]!, t![1]!)
    }
  }
  const fuv = (v: readonly number[]) => [v[0]! / L, v[1]! / W]
  // Grup 0: cantells (també els de 45°). Grup 1: cares.
  quad(o[0], o[3], i[3], i[0], [[0, 0], [1, 0], [1, 1], [0, 1]])
  quad(o[1], o[0], i[0], i[1], [[0, 0], [1, 0], [1, 1], [0, 1]])
  quad(o[2], o[1], i[1], i[2], [[0, 0], [1, 0], [1, 1], [0, 1]])
  quad(o[3], o[2], i[2], i[3], [[0, 0], [1, 0], [1, 1], [0, 1]])
  const edges = pos.length / 3
  quad(o[0], o[1], o[2], o[3], [fuv(o[0]), fuv(o[1]), fuv(o[2]), fuv(o[3])].map((q) => [q[0]!, q[1]!]))
  quad(i[1], i[0], i[3], i[2], [fuv(i[1]), fuv(i[0]), fuv(i[3]), fuv(i[2])].map((q) => [q[0]!, q[1]!]))
  const g = new BufferGeometry()
  g.setAttribute("position", new Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2))
  g.addGroup(0, edges, 0)
  g.addGroup(edges, pos.length / 3 - edges, 1)
  g.computeVertexNormals()
  return g
}
