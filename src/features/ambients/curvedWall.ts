import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three"
import { surfaceMaterial } from "../../components/viewer/surfaceMaterial"
import { wallLength, wallPoints, type MaterialPref, type PlanPt, type Wall } from "../../core/model"

/** Mostres de tota la corba (prou perquè es vegi llisa) i trossos (cadascun es fa transparent pel seu compte a la casa de nines). */
const SAMPLES = 128
const PIECES = 16

/**
 * Una paret corba (`Wall.curve`) al 3D: una làmina amb el gruix de la paret que segueix la Bézier, llisa (normals de tota la
 * corba, no trams), partida en `PIECES` trossos. Cada tros és un `Group` en coordenades del món (m) amb el seu material i
 * `userData.normal`/`center` (cap a fora de `room`, el centre de l'habitació en mm), com les parets rectes.
 */
export function curvedWallPieces(w: Wall, matName: string, materials: MaterialPref[], room: PlanPt): Group[] {
  const pts = wallPoints(w, SAMPLES)
  const L = wallLength(w)
  const H = w.height
  const t = w.thickness / 2
  // Llargada acumulada (u de la textura) i la normal de la corba a cada mostra.
  const acc = [0]
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]))
  const normal = pts.map((_, i) => {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[Math.min(pts.length - 1, i + 1)]!
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1]
    const len = Math.hypot(dx, dy) || 1
    return [-dy / len, dx / len] as PlanPt
  })
  const side = (i: number, s: 1 | -1): PlanPt => [pts[i]![0] + normal[i]![0] * t * s, pts[i]![1] + normal[i]![1] * t * s]
  const per = SAMPLES / PIECES
  const out: Group[] = []
  for (let k = 0; k < PIECES; k++) {
    const i0 = k * per, i1 = (k + 1) * per
    const pos: number[] = [], uv: number[] = [], idx: number[] = []
    // Una cara: una tira de quads entre dues files de punts (a sota i a dalt, o de fora a dins a la tapa).
    const strip = (row: (i: number) => [number, number, number][], u: (i: number) => number) => {
      const base = pos.length / 3
      for (let i = i0; i <= i1; i++) {
        const [p, q] = row(i)
        pos.push(p![0], p![1], p![2], q![0], q![1], q![2])
        uv.push(u(i), 0, u(i), 1)
      }
      for (let j = 0; j < i1 - i0; j++) {
        const a = base + j * 2
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    }
    const m = (p: PlanPt, y: number): [number, number, number] => [p[0] / 1000, y / 1000, p[1] / 1000]
    const uAt = (i: number) => acc[i]! / Math.max(L, 1)
    // Cara de fora i de dins (amb l'ordre girat perquè la normal vagi cap enfora), i la tapa.
    strip((i) => [m(side(i, 1), 0), m(side(i, 1), H)], uAt)
    strip((i) => [m(side(i, -1), H), m(side(i, -1), 0)], uAt)
    strip((i) => [m(side(i, 1), H), m(side(i, -1), H)], uAt)
    // Els caps de l'inici i del final de la paret.
    const cap = (i: number, flip: boolean) => {
      const base = pos.length / 3
      for (const v of [m(side(i, 1), 0), m(side(i, -1), 0), m(side(i, 1), H), m(side(i, -1), H)]) pos.push(...v)
      uv.push(0, 0, 1, 0, 0, 1, 1, 1)
      idx.push(...(flip ? [base, base + 2, base + 1, base + 1, base + 2, base + 3] : [base, base + 1, base + 2, base + 1, base + 3, base + 2]))
    }
    if (k === 0) cap(0, true)
    if (k === PIECES - 1) cap(SAMPLES, false)
    const geo = new BufferGeometry()
    geo.setAttribute("position", new Float32BufferAttribute(pos, 3))
    geo.setAttribute("uv", new Float32BufferAttribute(uv, 2))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const mesh = new Mesh(geo, surfaceMaterial(materials, matName, L, H))
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.room = "wall"
    const g = new Group()
    g.add(mesh)
    // Normal i centre del tros (la casa de nines el fa transparent si tapa la vista).
    const mid = Math.round((i0 + i1) / 2)
    const n = normal[mid]!
    const c = pts[mid]!
    const outward = n[0] * (c[0] - room[0]) + n[1] * (c[1] - room[1]) >= 0 ? 1 : -1
    g.userData.normal = new Vector3(n[0] * outward, 0, n[1] * outward)
    g.userData.center = new Vector3(c[0] / 1000, H / 2000, c[1] / 1000)
    out.push(g)
  }
  return out
}
