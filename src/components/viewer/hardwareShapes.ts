import { Matrix4, Object3D, Vector3 } from "three"
import type { Hole, Panel, PanelFitting } from "../../core/model"

/**
 * Formes dels ferratges que comparteixen el visor (`Hardware.tsx`) i les miniatures de Preferències › Ferratges
 * (`hardwareThumb.ts`): el marc d'un ferratge importat i el volum simplificat de les frontisses de l'app. Coordenades
 * locals de la peça, en metres.
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

/** Volum d'una frontissa de l'app: la tapa de la cassoleta (disc) i el braç cap a dins (caixa). */
export interface HingeVolume {
  disc: { position: [number, number, number]; radius: number; height: number }
  arm: { position: [number, number, number]; size: [number, number, number] }
}

/**
 * Les frontisses de l'app d'un front (a cada cassoleta, a la cara de dins). Cap si la peça porta el model d'una
 * frontissa importada (`fittings`, llevat del tirador i la pota, que no són a les cassoletes).
 */
export function hingeVolumes(panel: Panel): HingeVolume[] {
  if (panel.role !== "door" && panel.role !== "drawerFront" && panel.role !== "flap") return []
  if ((panel.fittings ?? []).some((f) => f.kind !== "handle" && f.kind !== "leg")) return []
  const T = panel.thickness
  const cups = panel.holes.filter((h) => h.tag === "hinge")
  // Cara de dins: la de les cassoletes (A, z = T).
  const inner = cups[0]?.face === "B" ? 0 : T
  const inDir = inner === T ? 1 : -1
  return cups.map((h) => ({
    disc: { position: [h.x * S, h.y * S, (inner + inDir * 1) * S], radius: (h.diameter / 2 + 3) * S, height: 2 * S },
    arm: { position: [h.x * S, h.y * S, (inner + inDir * 7) * S], size: [20 * S, Math.max(20, h.diameter) * S, 12 * S] },
  }))
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
