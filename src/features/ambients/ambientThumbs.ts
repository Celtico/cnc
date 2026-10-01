import { Box3, Group, Mesh, PerspectiveCamera, PlaneGeometry, BoxGeometry, Scene, Vector3 } from "three"
import { exportablePanel } from "../../components/viewer/exportablePanel"
import { buildScene } from "../../components/viewer/exportGlb"
import { surfaceMaterial } from "../../components/viewer/surfaceMaterial"
import { snapshot, THUMB_ASPECT, THUMB_VERSION, thumbLights } from "../../components/viewer/thumbRenderer"
import { preloadModels } from "../../components/viewer/models3d"
import { blockComposition, layoutTemplate, parseAmbient, rad, resolveTemplateRef, templateWalls, wallLength, wallSegments, type Ambient, type AmbientTemplate, type Composition, type MaterialPref } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import { db, type AmbientRow } from "../../db/db"
import { enqueueThumb } from "../projects/projectThumbs"
import { itemGeometry, type ItemGeometry } from "./ambientData"

/**
 * Miniatures 3D dels ambients (Historial, Projectes i Catàleg), fetes fora de pantalla com les dels mobles:
 * terra, parets (sense les de davant, com la casa de nines) i els mobles i objectes de debò, vist de dalt i
 * de davant. Les dels ambients de l'usuari es desen (`AmbientRow.thumb`); les del catàleg, en memòria.
 */
function renderAmbient(a: Ambient, geoOf: (i: number) => ItemGeometry | null, materials: MaterialPref[]): string | null {
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
  const camPos = new Vector3(cx, 0.9, cz).addScaledVector(dir, span * 1.55 + 1)

  for (const w of a.walls) {
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
    const inner = buildScene([...geo.build.panels, ...geo.build.extras], it.id, { materials, make: exportablePanel }, geo.build.models)
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
  camera.position.copy(camPos)
  camera.lookAt(cx, Math.min(center.y, 0.8), cz)
  return snapshot(scene, camera)
}

const compOfItem = async (it: Ambient["items"][number]): Promise<Composition | null> => {
  if (it.kind === "block") return blockComposition(it)
  const p = await db.projects.get(it.projectId)
  return p ? compositionOf(p) : null
}

export function needsAmbientThumb(r: AmbientRow): boolean {
  return !r.thumb || r.thumbAt !== r.updatedAt || r.thumbV !== THUMB_VERSION
}

/** Miniatura d'un ambient de l'usuari (es desa a la fila; es refà si l'ambient ha canviat). */
export function requestAmbientThumb(r: AmbientRow, materials: MaterialPref[]): void {
  if (!needsAmbientThumb(r)) return
  enqueueThumb(`a:${r.id}`, async () => {
    const fresh = await db.ambients.get(r.id)
    if (!fresh || !needsAmbientThumb(fresh)) return
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
    await preloadModels(geos.flatMap((g) => g?.build.models ?? []))
    const url = renderAmbient(a, (i) => geos[i] ?? null, materials)
    if (url) await db.ambients.update(r.id, { thumb: url, thumbAt: fresh.updatedAt, thumbV: THUMB_VERSION })
  })
}

const catalogThumbs = new Map<string, string>()
export function catalogThumb(id: string): string | undefined {
  return catalogThumbs.get(id)
}

/** Miniatura d'una escena del catàleg, amb els mobles i objectes de les seves plantilles (en memòria). */
export function requestCatalogThumb(t: AmbientTemplate, materials: MaterialPref[], onDone: (url: string) => void): void {
  const hit = catalogThumbs.get(t.id)
  if (hit) return onDone(hit)
  enqueueThumb(`c:${t.id}`, async () => {
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
    await preloadModels(placed.flatMap((p) => geoOf(p.ref)?.build.models ?? []))
    const url = renderAmbient(a, (i) => geoOf(placed[i]!.ref), materials)
    if (url) {
      catalogThumbs.set(t.id, url)
      onDone(url)
    }
  })
}
