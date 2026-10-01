import { BufferGeometry, BoxGeometry, CylinderGeometry, ExtrudeGeometry, Matrix4, Shape, Vector3 } from "three"
import { AXIS_INDEX, SECTION_AXES, sampleProfile, toNodes, type RefObject } from "../../core/model"

/* Geometria dels objectes de referència (metres, centrada a la seva caixa): la fan servir el visor i les miniatures. */

const S = 0.001

/**
 * Perfil 2D extrudit en la direcció de l'objecte, centrat a la seva caixa (metres). El perfil
 * és en (u, v) del pla de la secció (`SECTION_AXES`); l'extrusió va per l'eix de la direcció.
 */
export function profileGeometry(g: RefObject): ExtrudeGeometry {
  const axis = g.axis ?? "z"
  const [u, v] = SECTION_AXES[axis]
  const a = AXIS_INDEX[axis]
  const size = [g.w, g.h, g.d]
  const su = size[u]!, sv = size[v]!, len = size[a]!
  const shape = new Shape()
  const pts = sampleProfile(toNodes(g.profile!))
  shape.moveTo((pts[0]![0] - su / 2) * S, (pts[0]![1] - sv / 2) * S)
  for (const [pu, pv] of pts.slice(1)) shape.lineTo((pu - su / 2) * S, (pv - sv / 2) * S)
  shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: len * S, bevelEnabled: false })
  geo.translate(0, 0, (-len / 2) * S)
  const e = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]
  geo.applyMatrix4(new Matrix4().makeBasis(e[u]!, e[v]!, e[a]!))
  geo.computeVertexNormals()
  return geo
}

/** Geometria sòlida de l'objecte (caixa, cilindre o perfil) centrada a la seva caixa. */
export function refGeometry(g: RefObject): BufferGeometry {
  if (g.shape === "profile" && g.profile && g.profile.length >= 3) return profileGeometry(g)
  if (g.shape === "cylinder") {
    const axis = g.axis ?? "z"
    const len = axis === "x" ? g.w : axis === "y" ? g.h : g.d
    const radius = (axis === "x" ? Math.min(g.h, g.d) : axis === "y" ? Math.min(g.w, g.d) : Math.min(g.w, g.h)) / 2
    const geo = new CylinderGeometry(radius * S, radius * S, len * S, 40)
    if (axis === "z") geo.rotateX(Math.PI / 2)
    else if (axis === "x") geo.rotateZ(Math.PI / 2)
    return geo
  }
  return new BoxGeometry(g.w * S, g.h * S, g.d * S)
}
