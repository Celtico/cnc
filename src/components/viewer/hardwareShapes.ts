import { BoxGeometry, type BufferGeometry, CylinderGeometry, ExtrudeGeometry, Group, LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, Object3D, Shape, Vector2, Vector3 } from "three"
import { basisFor, builtinSolids, type HwMaterial, type HwSolid } from "../../core/build/hardwareSolids"
import type { Hole, Panel, PanelFitting, Vec3 } from "../../core/model"

/**
 * Formes dels ferratges que comparteixen el visor (`Hardware.tsx`), «Com va muntat» i les miniatures de Preferències ›
 * Ferratges (`hardwareThumb.ts`): el marc d'un ferratge importat, el dibuix 3D dels ferratges de sèrie (els sòlids de
 * `core/build/hardwareSolids.ts`) i les marques dels forats. Coordenades locals de la peça, en metres.
 */
const S = 0.001

/** Matriu del marc d'un ferratge importat a la peça (m): u = v × n, v al pla de la peça, n fora de la cara. */
export function fittingMatrix(f: Pick<PanelFitting, "x" | "y" | "face" | "v">, thickness: number): Matrix4 {
  const nz = f.face === "A" ? 1 : -1
  const V = new Vector3(f.v[0], f.v[1], 0)
  const N = new Vector3(0, 0, nz)
  const U = new Vector3().crossVectors(V, N)
  return new Matrix4().makeBasis(U, V, N).setPosition(f.x * S, f.y * S, (f.face === "A" ? thickness : 0) * S)
}

/**
 * Materials dels ferratges de sèrie (`HwMaterial`): niquelat, acer zincat, gris fosc, plàstic fosc, faig (espigues) i
 * alumini. Compartits per tots els visors i les miniatures (`userData.shared`: `disposeMaterial` no els allibera).
 */
const HW_MATERIALS: Record<HwMaterial, MeshStandardMaterial> = {
  nickel: new MeshStandardMaterial({ color: "#c9cdd2", metalness: 0.9, roughness: 0.28, name: "Niquelat" }),
  steel: new MeshStandardMaterial({ color: "#a7abb1", metalness: 0.8, roughness: 0.38, name: "Acer" }),
  dark: new MeshStandardMaterial({ color: "#3a3c40", metalness: 0.55, roughness: 0.42, name: "Gris fosc" }),
  plastic: new MeshStandardMaterial({ color: "#4b4d52", metalness: 0, roughness: 0.6, name: "Plàstic" }),
  beech: new MeshStandardMaterial({ color: "#d9ba8c", metalness: 0, roughness: 0.8, name: "Faig" }),
  alu: new MeshStandardMaterial({ color: "#b9bdc2", metalness: 0.7, roughness: 0.35, name: "Alumini" }),
}
for (const m of Object.values(HW_MATERIALS)) m.userData.shared = true

/** Geometries unitàries compartides (cada sòlid és una malla escalada): mai s'alliberen (`userData.sharedModel`). */
const UNIT_BOX = new BoxGeometry(1, 1, 1)
const UNIT_CYL = new CylinderGeometry(1, 1, 1, 20)

/**
 * Geometries amb corbes (la AXILO 78, `round` / `fillet`): no es poden escalar com les unitàries (el radi es deformaria),
 * es fan a mida (m) i es guarden per mides (poques: les mateixes a totes les potes); mai s'alliberen.
 */
const CURVED = new Map<string, BufferGeometry>()
function roundedBox(size: Vec3, round: number): BufferGeometry {
  const key = `b${size.map((x) => x.toFixed(2)).join(",")}r${round}`
  const hit = CURVED.get(key)
  if (hit) return hit
  const [w, h, d] = size
  const bev = Math.min(1.5, d / 4, round / 2)
  const r = Math.max(0, Math.min(round, w / 2 - bev, h / 2 - bev))
  const x0 = -w / 2 + bev, y0 = -h / 2 + bev, x1 = w / 2 - bev, y1 = h / 2 - bev
  const shape = new Shape()
  shape.moveTo(x0 + r, y0)
  shape.lineTo(x1 - r, y0)
  shape.quadraticCurveTo(x1, y0, x1, y0 + r)
  shape.lineTo(x1, y1 - r)
  shape.quadraticCurveTo(x1, y1, x1 - r, y1)
  shape.lineTo(x0 + r, y1)
  shape.quadraticCurveTo(x0, y1, x0, y1 - r)
  shape.lineTo(x0, y0 + r)
  shape.quadraticCurveTo(x0, y0, x0 + r, y0)
  const g = new ExtrudeGeometry(shape, { depth: Math.max(0.1, d - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: 8 })
  g.translate(0, 0, -d / 2 + bev)
  g.scale(S, S, S)
  g.computeVertexNormals()
  CURVED.set(key, g)
  return g
}
/** Cilindre amb les arestes arrodonides (perfil girat al voltant de y, com el de three). */
function filletCylinder(r: number, h: number, fillet: number): BufferGeometry {
  const key = `c${r.toFixed(2)},${h.toFixed(2)}f${fillet}`
  const hit = CURVED.get(key)
  if (hit) return hit
  const f = Math.max(0, Math.min(fillet, r / 2, h / 2))
  const pts: Vector2[] = [new Vector2(0, -h / 2)]
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6
      pts.push(new Vector2(cx + f * Math.cos(a), cy + f * Math.sin(a)))
    }
  }
  arc(r - f, -h / 2 + f, -Math.PI / 2, 0)
  arc(r - f, h / 2 - f, 0, Math.PI / 2)
  pts.push(new Vector2(0, h / 2))
  const g = new LatheGeometry(pts.map((p) => new Vector2(p.x * S, p.y * S)), 48)
  g.computeVertexNormals()
  CURVED.set(key, g)
  return g
}

/**
 * Els ferratges de sèrie d'una peça (`builtinSolids`: frontisses, suports de prestatge, espigues, guies, braços,
 * imants, push, suports de la barra i perfil LED) com a malles three, en coordenades locals de la peça (m). El mateix al
 * visor (`PanelHardware`), al 3D de «Com va muntat» i a les miniatures de Ferratges. El grup porta
 * `userData.editorOnly`: **només es veuen**, no surten al render (`sceneData`), ni a la imatge del visor per al Render,
 * ni a l'AR ni a les exportacions (aquests fan l'escena amb `buildScene`, sense ells). Les malles no s'han d'alliberar
 * (geometries i materials compartits: `userData.sharedModel` perquè `disposeTree` se les salti).
 */
export function builtinHardwareGroup(panel: Panel, pins?: readonly Hole[], fixed?: readonly HwSolid[]): Group | null {
  const solids = builtinSolids(panel, pins, fixed)
  if (!solids.length) return null
  const g = new Group()
  g.name = "ferratges"
  g.userData.editorOnly = true
  for (const s of solids) {
    const curved = s.kind === "box" ? (s.round ? roundedBox(s.size, s.round) : null) : s.fillet ? filletCylinder(s.r, s.h, s.fillet) : null
    const mesh = new Mesh(curved ?? (s.kind === "box" ? UNIT_BOX : UNIT_CYL), HW_MATERIALS[s.mat])
    mesh.userData.sharedModel = true
    mesh.castShadow = true
    mesh.matrixAutoUpdate = false
    if (curved && s.kind === "box") {
      const [u, v, w] = s.axes
      mesh.matrix.makeBasis(new Vector3(...u), new Vector3(...v), new Vector3(...w))
    } else if (curved && s.kind === "cyl") {
      const [u, v, w] = basisFor(s.axis)
      mesh.matrix.makeBasis(new Vector3(...u), new Vector3(...w), new Vector3(...v).negate())
    } else if (s.kind === "box") {
      const [u, v, w] = s.axes
      mesh.matrix.makeBasis(new Vector3(...u).multiplyScalar(s.size[0] * S), new Vector3(...v).multiplyScalar(s.size[1] * S), new Vector3(...w).multiplyScalar(s.size[2] * S))
    } else {
      // El cilindre de three va al llarg de y: (u, eix, v) amb el radi a u i v i el llarg a l'eix.
      const [u, v, w] = basisFor(s.axis)
      mesh.matrix.makeBasis(new Vector3(...u).multiplyScalar(s.r * S), new Vector3(...w).multiplyScalar(s.h * S), new Vector3(...v).multiplyScalar(-s.r * S))
    }
    mesh.matrix.setPosition(s.c[0] * S, s.c[1] * S, s.c[2] * S)
    g.add(mesh)
  }
  return g
}

/** Color de les marques dels forats i dels forats proposats (importat sense confirmar: taronja, com la insígnia). */
export const HOLE_COLOR = "#3b2f1f"
export const PROPOSED_HOLE_COLOR = "#e8590c"

const EPS = 0.0004
/** Gir de la marca d'un forat de cantell: disc perpendicular al cantell, al mig del gruix. */
const EDGE_MARK: Record<string, { d: [number, number, number]; r: [number, number, number] }> = {
  left: { d: [-EPS, 0, 0], r: [0, -Math.PI / 2, 0] },
  right: { d: [EPS, 0, 0], r: [0, Math.PI / 2, 0] },
  bottom: { d: [0, -EPS, 0], r: [Math.PI / 2, 0, 0] },
  top: { d: [0, EPS, 0], r: [-Math.PI / 2, 0, 0] },
}

/**
 * Matrius de les marques dels forats d'una peça (un disc de radi 1 per forat, escalat al seu radi) a la cara A, a la B
 * o al cantell, en coordenades locals (m; `thicknessM`, el gruix, també en m): el visor (`HoleMarks`) i les miniatures de Ferratges.
 */
export function holeMarkMatrices(holes: readonly Hole[], thicknessM: number): Matrix4[] {
  const o = new Object3D()
  const out: Matrix4[] = []
  for (const h of holes) {
    const x = h.x * S
    const y = h.y * S
    if (h.face === "A") {
      o.position.set(x, y, thicknessM + EPS)
      o.rotation.set(0, 0, 0)
    } else if (h.face === "B") {
      o.position.set(x, y, -EPS)
      o.rotation.set(Math.PI, 0, 0)
    } else {
      const e = h.edge ? EDGE_MARK[h.edge] : undefined
      if (!e) continue
      o.position.set(x + e.d[0], y + e.d[1], thicknessM / 2 + e.d[2])
      o.rotation.set(...e.r)
    }
    o.scale.setScalar((h.diameter / 2) * S)
    o.updateMatrix()
    out.push(o.matrix.clone())
  }
  return out
}
