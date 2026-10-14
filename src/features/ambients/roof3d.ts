import { BoxGeometry, DoubleSide, ExtrudeGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Path, Shape, Vector3 } from "three"
import { surfaceMaterial } from "../../components/viewer/surfaceMaterial"
import { roofBox, type Ambient, type MaterialPref } from "../../core/model"

/** Un pla de la teulada (mm): origen a l'aiguafons, `u` horitzontal al llarg, `v` pujant pel pendent, i les seves mides. */
interface RoofPlane {
  o: Vector3
  u: Vector3
  v: Vector3
  lu: number
  lv: number
}

/**
 * La teulada d'un ambient al 3D (m): els plans amb el gruix i els forats de les claraboies (cadascuna amb el seu vidre,
 * que al render fa de portal de llum), i a dues aigües i a una aigua, els tancaments de les puntes (el material de les
 * parets). Les peces compten com a parets al render (`userData.room = "wall"`). Sense teulada o sense parets, `null`.
 */
export function roofGroup(a: Ambient, materials: MaterialPref[]): Group | null {
  const roof = a.roof
  const box = roofBox(a)
  if (!roof || !box) return null
  const { x0, y0, x1, y1, base } = box
  const p = (roof.kind === "flat" ? 0 : roof.pitch) * (Math.PI / 180)
  const s = Math.sin(p), c = Math.cos(p), tn = Math.tan(p)
  const alongX = roof.ridge === "x"
  // «a» al llarg del carener (X o Z del 3D) i «b» de través; mides en mm del plànol (X = x, Z = y).
  const [a0, a1, b0, b1] = alongX ? [x0, x1, y0, y1] : [y0, y1, x0, x1]
  const P = (av: number, y: number, bv: number) => (alongX ? new Vector3(av, y, bv) : new Vector3(bv, y, av))
  const dir = (da: number, dy: number, db: number) => (alongX ? new Vector3(da, dy, db) : new Vector3(db, dy, da)).normalize()
  const planes: RoofPlane[] = []
  const La = a1 - a0, Lb = b1 - b0
  if (roof.kind === "flat") planes.push({ o: P(a0, base, b0), u: dir(1, 0, 0), v: dir(0, 0, 1), lu: La, lv: Lb })
  else if (roof.kind === "shed") planes.push({ o: P(a0, base, b0), u: dir(1, 0, 0), v: dir(0, s, c), lu: La, lv: Lb / c })
  else {
    const half = Lb / 2
    planes.push({ o: P(a0, base, b0), u: dir(1, 0, 0), v: dir(0, s, c), lu: La, lv: half / c })
    planes.push({ o: P(a0, base, b1), u: dir(1, 0, 0), v: dir(0, s, -c), lu: La, lv: half / c })
  }
  const mat = surfaceMaterial(materials, roof.material ?? "Formigó", La, Lb)
  mat.side = DoubleSide
  const g = new Group()
  g.userData.roof = true
  for (const pl of planes) {
    // Que el gruix vagi cap amunt: la normal (u × v) amb y positiva; si no, s'inverteix u des de l'altre extrem.
    let { o, u } = pl
    if (new Vector3().crossVectors(u, pl.v).y < 0) {
      o = o.clone().addScaledVector(u, pl.lu)
      u = u.clone().negate()
    }
    const n = new Vector3().crossVectors(u, pl.v).normalize()
    // Les claraboies d'aquest pla: el centre del plànol passat a (u, v) del pla (v, al llarg del pendent).
    const vh = new Vector3(pl.v.x, 0, pl.v.z)
    const cosv = vh.length() || 1
    vh.normalize()
    const shape = new Shape()
    shape.moveTo(0, 0).lineTo(pl.lu, 0).lineTo(pl.lu, pl.lv).lineTo(0, pl.lv).closePath()
    const holes: { u: number; v: number; hu: number; hv: number }[] = []
    for (const k of roof.skylights ?? []) {
      const q = new Vector3(k.x, 0, k.y).sub(new Vector3(o.x, 0, o.z))
      const cu = q.dot(u), cv = q.dot(vh) / cosv
      // Mida: l'«ample» va al llarg del carener i la «fondària» de través (al pendent, més llarga).
      const hu = (alongX ? k.w : k.d) / 2, hv = (alongX ? k.d : k.w) / 2 / cosv
      if (cu - hu < 50 || cu + hu > pl.lu - 50 || cv - hv < 50 || cv + hv > pl.lv - 50) continue
      holes.push({ u: cu, v: cv, hu, hv })
      const h = new Path()
      h.moveTo(cu - hu, cv - hv).lineTo(cu - hu, cv + hv).lineTo(cu + hu, cv + hv).lineTo(cu + hu, cv - hv).closePath()
      shape.holes.push(h)
    }
    const geo = new ExtrudeGeometry(shape, { depth: roof.thickness, bevelEnabled: false })
    // mm del pla → m del món: base (u, v, n) i l'origen.
    const m = new Matrix4().makeBasis(u, pl.v, n).setPosition(o)
    geo.applyMatrix4(m)
    geo.scale(0.001, 0.001, 0.001)
    const mesh = new Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    // Al render compta com una paret (l'escena «Només terra» o «Cap» la treu).
    mesh.userData.room = "wall"
    mesh.userData.roof = true
    g.add(mesh)
    // El vidre de cada claraboia, al mig del gruix (al render, la llum del cel entra per aquí).
    for (const h of holes) {
      const glass = new MeshStandardMaterial({ color: "#dbe7e8", roughness: 0.03, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false })
      glass.userData.glass = true
      glass.userData.baseOpacity = 0.18
      const pane = new Mesh(new BoxGeometry(2 * h.hu, 2 * h.hv, 8), glass)
      const at = o.clone().addScaledVector(u, h.u).addScaledVector(pl.v, h.v).addScaledVector(n, roof.thickness / 2)
      pane.applyMatrix4(new Matrix4().makeBasis(u, pl.v, n).setPosition(at))
      pane.position.multiplyScalar(0.001)
      pane.scale.multiplyScalar(0.001)
      pane.userData.portal = true
      pane.userData.room = "wall"
      g.add(pane)
    }
  }
  // Les puntes (a dues aigües, el triangle de sobre les parets; a una aigua, el de la banda alta), a la línia de les parets.
  if (roof.kind !== "flat" && p > 0.01) {
    const wallMat = surfaceMaterial(materials, a.wallMaterial ?? "Pintura blanca", Lb, Lb * tn)
    wallMat.side = DoubleSide
    const o = roof.overhang
    const tb0 = b0 + o, tb1 = b1 - o
    // L'altura de la cara de sota de la teulada a cada punt de través (des de l'aiguafons, a l'alçada de les parets).
    const under = (b: number) => (roof.kind === "gable" ? Math.min(b - b0, b1 - b) : b - b0) * tn
    for (const av of [a0 + o, a1 - o]) {
      const tri = new Shape()
      tri.moveTo(tb0, 0).lineTo(tb1, 0).lineTo(tb1, under(tb1))
      if (roof.kind === "gable") tri.lineTo((b0 + b1) / 2, under((b0 + b1) / 2))
      tri.lineTo(tb0, under(tb0)).closePath()
      const geo = new ExtrudeGeometry(tri, { depth: 150, bevelEnabled: false })
      // Pla de la punta: x = b (de través), y = amunt, gruix al llarg del carener.
      const bx = alongX ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0)
      const ax = alongX ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
      const origin = (alongX ? new Vector3(av - 75, base, 0) : new Vector3(0, base, av - 75)).sub(new Vector3(0, 0, 0))
      geo.applyMatrix4(new Matrix4().makeBasis(bx, new Vector3(0, 1, 0), ax).setPosition(origin))
      geo.scale(0.001, 0.001, 0.001)
      const mesh = new Mesh(geo, wallMat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.room = "wall"
      g.add(mesh)
    }
    // A una aigua, la paret alta també puja fins a la teulada (un rectangle al llarg del carener).
    if (roof.kind === "shed") {
      const hh = under(tb1), len = a1 - a0 - 2 * o
      if (hh > 1 && len > 1) {
        const geo = new BoxGeometry(alongX ? len : 150, hh, alongX ? 150 : len)
        geo.translate(alongX ? (a0 + a1) / 2 : tb1, base + hh / 2, alongX ? tb1 : (a0 + a1) / 2)
        geo.scale(0.001, 0.001, 0.001)
        const mesh = new Mesh(geo, wallMat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.room = "wall"
        g.add(mesh)
      }
    }
  }
  return g
}
