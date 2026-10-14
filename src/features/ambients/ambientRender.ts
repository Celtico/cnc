import { Box3, Group, Mesh, PerspectiveCamera, PlaneGeometry, BoxGeometry, Scene, Vector3 } from "three"
import { exportablePanel } from "../../components/viewer/exportablePanel"
import { buildScene } from "../../components/viewer/exportGlb"
import { surfaceMaterial } from "../../components/viewer/surfaceMaterial"
import { aimSaved, snapshot, THUMB_ASPECT, thumbLights } from "../../components/viewer/thumbRenderer"
import { preloadModels } from "../../components/viewer/models3d"
import { blockComposition, layoutTemplate, parseAmbient, parseCameraPose, rad, resolveTemplateRef, templateWalls, wallLength, wallSegments, type Ambient, type AmbientTemplate, type Composition, type MaterialPref } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import { db, type AmbientRow } from "../../db/db"
import { drawWhenReady } from "../projects/thumbJobs"
import { curvedWallPieces } from "./curvedWall"
import { itemGeometry, type ItemGeometry } from "./ambientData"
import { genericLegsGroup } from "../../components/viewer/genericLegs"

/** El dibuix de les miniatures dels ambients (three.js): `ambientThumbs` el carrega amb `import()`. */
function renderAmbient(a: Ambient, geoOf: (i: number) => ItemGeometry | null, materials: MaterialPref[], pose?: unknown): string | null {
  if (!a.walls.length && !a.items.length) return null
  const scene = new Scene()
  // Sense fons: transparent (PNG), al voltant de l'habitació es veu la targeta.
  // Caixa de les parets (o dels elements, sense parets).
  const xs = a.walls.flatMap((w) => [w.a[0], w.b[0]]), ys = a.walls.flatMap((w) => [w.a[1], w.b[1]])
  for (const it of a.items) {
    xs.push(it.x)
    ys.push(it.y)
  }
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const cx = (x0 + x1) / 2000, cz = (y0 + y1) / 2000
  const span = Math.max(x1 - x0, y1 - y0, 2000) / 1000

  const fw = (x1 - x0) + 1200, fd = (y1 - y0) + 1200
  const floor = new Mesh(new PlaneGeometry(fw / 1000, fd / 1000), surfaceMaterial(materials, a.floorMaterial ?? "Parquet de roure", fw, fd))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(cx, 0, cz)
  floor.receiveShadow = true
  scene.add(floor)

  // Càmera de dalt i de davant (el davant del plànol és la y gran), una mica de costat.
  const dir = new Vector3(0.45, 1.05, 1).normalize()
  // La càmera desada (`Ambient.camera`, mateixes coordenades que el 3D; també la d'«Interior») passa per davant.
  const saved = parseCameraPose(pose)
  const camPos = saved ? new Vector3(...saved.position) : new Vector3(cx, 0.9, cz).addScaledVector(dir, span * 1.55 + 1)

  for (const w of a.walls) {
    // Corba: la làmina llisa (`curvedWallPieces`), sense els trossos que tapen la càmera.
    if (w.curve) {
      for (const piece of curvedWallPieces(w, w.material ?? a.wallMaterial ?? "Pintura blanca", materials, [cx * 1000, cz * 1000])) {
        const n = piece.userData.normal as Vector3, c = piece.userData.center as Vector3
        if (a.walls.length >= 3 && (camPos.x - c.x) * n.x + (camPos.z - c.z) * n.z > 0) continue
        scene.add(piece)
      }
      continue
    }
    const L = wallLength(w)
    if (L < 1) continue
    // Les parets entre la càmera i l'habitació no es posen (com la casa de nines del visor).
    const nx = -(w.b[1] - w.a[1]) / L, nz = (w.b[0] - w.a[0]) / L
    const mx = (w.a[0] + w.b[0]) / 2000, mz = (w.a[1] + w.b[1]) / 2000
    const out = nx * (mx - cx) + nz * (mz - cz) >= 0 ? 1 : -1
    const toCam = (camPos.x - mx) * nx * out + (camPos.z - mz) * nz * out
    if (toCam > 0 && a.walls.length >= 3) continue
    const g = new Group()
    g.position.set(w.a[0] / 1000, 0, w.a[1] / 1000)
    g.rotation.y = -Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0])
    const matName = w.material ?? a.wallMaterial ?? "Pintura blanca"
    for (const sg of wallSegments(w)) {
      const len = sg.u1 - sg.u0, hh = sg.v1 - sg.v0
      if (len < 1 || hh < 1) continue
      const m = new Mesh(new BoxGeometry(len / 1000, hh / 1000, w.thickness / 1000), surfaceMaterial(materials, matName, len, hh))
      m.position.set((sg.u0 + sg.u1) / 2000, (sg.v0 + sg.v1) / 2000, 0)
      m.castShadow = m.receiveShadow = true
      g.add(m)
    }
    scene.add(g)
  }

  a.items.forEach((it, i) => {
    const geo = geoOf(i)
    if (!geo) return
    const inner = buildScene([...geo.build.panels, ...geo.build.extras], it.id, { materials, make: exportablePanel, hardware: true }, geo.build.models)
    const legs = genericLegsGroup(geo.comp, geo.build)
    if (legs) inner.add(legs)
    inner.position.set(-(geo.min[0] + geo.max[0]) / 2000, 0, -(geo.min[2] + geo.max[2]) / 2000)
    inner.traverse((o) => {
      if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true
    })
    const outer = new Group()
    outer.add(inner)
    outer.position.set(it.x / 1000, (it.elevation ?? 0) / 1000, it.y / 1000)
    outer.rotation.y = -rad(it.rot)
    scene.add(outer)
  })

  scene.updateMatrixWorld(true)
  const center = new Box3().setFromObject(scene).getCenter(new Vector3())
  thumbLights(scene, new Vector3(cx, 1, cz), span)
  const camera = new PerspectiveCamera(32, THUMB_ASPECT, 0.05, 200)
  if (!aimSaved(camera, saved)) {
    camera.position.copy(camPos)
    camera.lookAt(cx, Math.min(center.y, 0.8), cz)
  }
  return snapshot(scene, camera)
}

const compOfItem = async (it: Ambient["items"][number]): Promise<Composition | null> => {
  if (it.kind === "block") return blockComposition(it)
  const p = await db.projects.get(it.projectId)
  return p ? compositionOf(p) : null
}

const cameraOf = (r: AmbientRow): unknown => (r.data && typeof r.data === "object" ? (r.data as { camera?: unknown }).camera : undefined)

/** Miniatura d'un ambient de l'usuari, amb la seva càmera. `null` si un model 3D no carrega o una foto falla. */
export async function renderUserAmbient(fresh: AmbientRow, materials: MaterialPref[]): Promise<string | null> {
    const a = parseAmbient(fresh.data)
    const cache = new Map<string, ItemGeometry | null>()
    const geos: (ItemGeometry | null)[] = []
    for (const it of a.items) {
      const key = it.kind === "moble" ? `m${it.projectId}` : JSON.stringify([it.shape, it.w, it.h, it.d, it.material, it.material2])
      if (!cache.has(key)) {
        const c = await compOfItem(it)
        cache.set(key, c ? itemGeometry(c) : null)
      }
      geos.push(cache.get(key)!)
    }
    // Si un model 3D no s'ha pogut carregar, no es fa (ni es desa): sortiria sense la planta per sempre.
    if (!(await preloadModels(geos.flatMap((g) => g?.build.models ?? [])))) return null
    // Quan hi són les textures de foto (si alguna falla, no es desa: sortiria negra).
    return drawWhenReady(() => renderAmbient(a, (i) => geos[i] ?? null, materials, cameraOf(fresh)))
}

/** Miniatura d'una escena del catàleg, amb els mobles i objectes de les seves plantilles. */
export async function renderCatalogScene(t: AmbientTemplate, materials: MaterialPref[]): Promise<string | null> {
    const geos = new Map<string, ItemGeometry | null>()
    const geoOf = (ref: string) => {
      if (!geos.has(ref)) {
        const tpl = resolveTemplateRef(ref)
        geos.set(ref, tpl ? itemGeometry({ ...tpl.make(), kind: tpl.kind }) : null)
      }
      return geos.get(ref)!
    }
    const placed = layoutTemplate(t, (ref) => {
      const g = geoOf(ref)
      return g ? { w: g.w, d: g.d } : { w: 500, d: 500 }
    })
    const a: Ambient = {
      walls: templateWalls(t),
      items: placed.map((p, i) => ({ id: `c${i}`, kind: "block", name: p.ref, shape: "box", w: 1, h: 1, d: 1, material: "", x: p.x, y: p.y, rot: p.rot, ...(p.elevation ? { elevation: p.elevation } : {}) })),
      floorMaterial: t.floor,
      wallMaterial: t.wall,
    } as Ambient
    if (!(await preloadModels(placed.flatMap((p) => geoOf(p.ref)?.build.models ?? [])))) return null
    return drawWhenReady(() => renderAmbient(a, (i) => geoOf(placed[i]!.ref), materials))
}
