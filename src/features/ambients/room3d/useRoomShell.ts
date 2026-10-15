import { useEffect, useMemo } from "react"
import { BoxGeometry, Group, Mesh, PlaneGeometry, Vector3, type MeshStandardMaterial } from "three"
import { surfaceMaterial } from "../../../components/viewer/surfaceMaterial"
import { disposeTree } from "../../../components/viewer/textures"
import { footprintBox, wallLength, wallOpenings, wallSegments, type Ambient, type MaterialPref } from "../../../core/model"
import type { ItemGeometry } from "../ambientData"
import { curvedWallPieces } from "../curvedWall"
import { roofGroup } from "../roof3d"
import { addOpening } from "./opening3d"

/** Terra de fora per defecte (`Ambient.outsideFloorMaterial`). */
const OUTSIDE_FLOOR = "Gespa"

/** Parets que tanquen una habitació (cada extrem compartit) i altes: les terrasses i els patis no tenen sostre. */
function closedRoom(walls: Ambient["walls"]): boolean {
  if (walls.length < 3 || walls.some((w) => w.height < 2000)) return false
  const key = (p: readonly number[]) => `${Math.round(p[0]!)},${Math.round(p[1]!)}`
  const n = new Map<string, number>()
  for (const w of walls) for (const p of [w.a, w.b]) n.set(key(p), (n.get(key(p)) ?? 0) + 1)
  return [...n.values()].every((c) => c >= 2)
}

/** L'obra de l'ambient (three, m): el terra (i el de fora), les parets amb les obertures, la teulada i el sostre. */
export function useRoomShell({ ambient, geos, materials, box, showCeiling, showRoof }: { ambient: Ambient; geos: Map<string, ItemGeometry | null>; materials: MaterialPref[]; box: { x0: number; y0: number; x1: number; y1: number }; showCeiling: boolean; showRoof: boolean }) {
  // Terra: la caixa de tot amb un marge, arrodonida al metre (arrossegar un element no el refà a cada pas).
  const fx0 = Math.floor((box.x0 - 600) / 1000) * 1000, fx1 = Math.ceil((box.x1 + 600) / 1000) * 1000
  const fy0 = Math.floor((box.y0 - 600) / 1000) * 1000, fy1 = Math.ceil((box.y1 + 600) / 1000) * 1000
  // Les parets només depenen de les parets (el centre de l'habitació per saber cap on és «fora»).
  const wx = ambient.walls.flatMap((w) => [w.a[0], w.b[0]]), wy = ambient.walls.flatMap((w) => [w.a[1], w.b[1]])
  // Amb una o dues parets soltes, el centre de tot (amb els elements) diu millor on és l'habitació.
  const closed = ambient.walls.length >= 3
  const rcx = closed ? (Math.min(...wx) + Math.max(...wx)) / 2 : (box.x0 + box.x1) / 2
  const rcy = closed ? (Math.min(...wy) + Math.max(...wy)) / 2 : (box.y0 + box.y1) / 2
  // Habitació tancada amb coses fora (arbres davant d'una finestra): el terra de dins, fins a l'eix de les parets (on
  // hi ha el vidre de les finestres: el parquet no surt a fora; sota la paret no es veu),
  // i fora el «Terra de fora» (`outsideFloorMaterial`, gespa si no se n'ha triat), una mica més avall.
  const rx0 = closed ? Math.min(...wx) : fx0, rx1 = closed ? Math.max(...wx) : fx1
  const ry0 = closed ? Math.min(...wy) : fy0, ry1 = closed ? Math.max(...wy) : fy1
  // «Fora»: algun element que surt més de 300 mm de les parets (no un que hi és arrambat).
  const outside = closed && ambient.items.some((it) => {
    const g = geos.get(it.id)
    if (!g) return false
    const b = footprintBox(it.x, it.y, g.w, g.d, it.rot)
    return b.x0 < rx0 - 300 || b.x1 > rx1 + 300 || b.y0 < ry0 - 300 || b.y1 > ry1 + 300
  })
  const floor = useMemo(() => {
    const [x0, x1, y0, y1] = outside ? [rx0, rx1, ry0, ry1] : [fx0, fx1, fy0, fy1]
    const w = x1 - x0, d = y1 - y0
    const mesh = new Mesh(new PlaneGeometry(w / 1000, d / 1000), surfaceMaterial(materials, ambient.floorMaterial ?? "Parquet de roure", w, d))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set((x0 + x1) / 2000, 0, (y0 + y1) / 2000)
    mesh.receiveShadow = true
    mesh.userData.room = "floor"
    if (!outside) return mesh
    const g = new Group()
    const gw = fx1 - fx0 + 4000, gd = fy1 - fy0 + 4000
    const lawn = new Mesh(new PlaneGeometry(gw / 1000, gd / 1000), surfaceMaterial(materials, ambient.outsideFloorMaterial ?? OUTSIDE_FLOOR, gw, gd))
    lawn.rotation.x = -Math.PI / 2
    lawn.position.set((fx0 + fx1) / 2000, -0.004, (fy0 + fy1) / 2000)
    lawn.receiveShadow = true
    lawn.userData.room = "floor"
    g.add(mesh, lawn)
    return g
  }, [fx0, fx1, fy0, fy1, rx0, rx1, ry0, ry1, outside, materials, ambient.floorMaterial, ambient.outsideFloorMaterial])
  useEffect(() => () => disposeTree(floor), [floor])

  const walls = useMemo(() => {
    const g = new Group()
    for (const w of ambient.walls) {
      // Corba: una làmina llisa que segueix la Bézier (`curvedWallPieces`), en trossos per a la casa de nines.
      if (w.curve) {
        for (const piece of curvedWallPieces(w, w.material ?? ambient.wallMaterial ?? "Pintura blanca", materials, [rcx, rcy])) g.add(piece)
        continue
      }
      const L = wallLength(w)
      if (L < 1) continue
      const wg = new Group()
      wg.position.set(w.a[0] / 1000, 0, w.a[1] / 1000)
      wg.rotation.y = -Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0])
      const matName = w.material ?? ambient.wallMaterial ?? "Pintura blanca"
      // Trossos massissos (la paret sencera o el que queda al voltant de finestres i portes).
      for (const sg of wallSegments(w)) {
        const len = sg.u1 - sg.u0, hh = sg.v1 - sg.v0
        if (len < 1 || hh < 1) continue
        const mesh = new Mesh(new BoxGeometry(len / 1000, hh / 1000, w.thickness / 1000), surfaceMaterial(materials, matName, len, hh))
        mesh.position.set((sg.u0 + sg.u1) / 2000, (sg.v0 + sg.v1) / 2000, 0)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.room = "wall"
        wg.add(mesh)
      }
      for (const o of wallOpenings(w)) addOpening(wg, o, w.thickness, materials)
      // Normal cap a fora de l'habitació (per fer-la transparent si tapa la vista).
      const nx = -(w.b[1] - w.a[1]) / L, nz = (w.b[0] - w.a[0]) / L
      const mx = (w.a[0] + w.b[0]) / 2 - rcx, mz = (w.a[1] + w.b[1]) / 2 - rcy
      const out = nx * mx + nz * mz >= 0 ? 1 : -1
      wg.userData.normal = new Vector3(nx * out, 0, nz * out)
      wg.userData.center = new Vector3((w.a[0] + w.b[0]) / 2000, w.height / 2000, (w.a[1] + w.b[1]) / 2000)
      g.add(wg)
    }
    return g
  }, [ambient.walls, ambient.wallMaterial, materials, rcx, rcy])

  // Sostre de les habitacions tancades: només quan la càmera és a dins (al visor i al render; des de
  // dalt no es veu). Al render tanca la llum: entra per les finestres, com a les fotos.
  // La teulada (el sostre de dins es queda, amb el seu material, just sota la teulada).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- només les parts de l'ambient que canvien la teulada
  const roof = useMemo(() => (showRoof ? roofGroup(ambient, materials) : null), [showRoof, ambient.roof, ambient.walls, ambient.wallMaterial, materials])
  useEffect(() => () => (roof ? disposeTree(roof) : undefined), [roof])
  const ceiling = useMemo(() => {
    if (!showCeiling || !closedRoom(ambient.walls)) return null
    const xs = ambient.walls.flatMap((w) => [w.a[0], w.b[0]]), ys = ambient.walls.flatMap((w) => [w.a[1], w.b[1]])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const H = Math.min(...ambient.walls.map((w) => w.height))
    const mesh = new Mesh(new BoxGeometry((x1 - x0) / 1000, 0.05, (y1 - y0) / 1000), surfaceMaterial(materials, ambient.ceilingMaterial ?? "Pintura blanca", x1 - x0, y1 - y0))
    // Amb teulada, el sostre queda just sota la paret més baixa (la cara de sota de la teulada plana és a l'alçada de les
    // parets: sense, es trepitjarien); sense, just a sobre, com sempre.
    const under = showRoof && !!ambient.roof
    mesh.position.set((x0 + x1) / 2000, H / 1000 + (under ? -0.026 : 0.025), (y0 + y1) / 2000)
    // Al visor la llum ve de dalt i la cara de sota quedaria fosca: una mica de llum pròpia (el
    // render per CPU no la fa servir, hi arriba la de les finestres).
    const mat = mesh.material as MeshStandardMaterial
    mat.emissive.copy(mat.color)
    mat.emissiveMap = mat.map
    mat.emissiveIntensity = 0.55
    mesh.visible = false
    mesh.userData.renderOnly = "ceiling"
    return mesh
  }, [ambient.walls, ambient.ceilingMaterial, ambient.roof, materials, showCeiling, showRoof])
  useEffect(() => () => disposeTree(walls), [walls])
  useEffect(() => () => (ceiling ? disposeTree(ceiling) : undefined), [ceiling])
  return { floor, walls, roof, ceiling }
}
