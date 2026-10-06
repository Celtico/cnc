import { Box3, BoxGeometry, CircleGeometry, CylinderGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Vector3, type Object3D } from "three"
import { mountCamera, type HardwareMount } from "../../core/build/hardwareMount"
import type { MaterialPref, Panel, PanelFitting } from "../../core/model"
import { buildScene } from "./exportGlb"
import { exportablePanel } from "./exportablePanel"
import { fittingMatrix, hingeVolumes, holeMarkMatrices, HOLE_COLOR, PROPOSED_HOLE_COLOR } from "./hardwareShapes"
import { snapshot, THUMB_ASPECT, thumbLights, thumbStudio } from "./thumbRenderer"

const S = 0.001

/**
 * Miniatura d'un ferratge (Preferències › Ferratges): el muntatge de «Com va muntat» (`hardwareMount`: les peces del
 * mòdul d'exemple fetes pel motor, amb els materials de debò i els forats; els proposats d'un importat sense confirmar
 * en taronja), el ferratge (el GLB importat, `models`, o la seva caixa si no hi és; les frontisses i els tiradors de
 * l'app, el volum simplificat del visor) i la mateixa càmera que el 3D de l'editor en obrir-lo (`mountCamera`), a
 * l'estudi de les altres miniatures (terra i paret de Presentació, `thumbStudio`, i `thumbLights`). Un «només 3D», el
 * model sol a terra. Pel renderitzador comú (`snapshot`): `null` si encara es baixen fotos de textura.
 *
 * `models`: els GLB llegits per a aquesta miniatura (`readHardwareModel`); se'n fan còpies i qui els ha llegit els
 * allibera (`disposeTree`) en acabar.
 */
export function renderHardwareThumb(mount: HardwareMount, materials: MaterialPref[], models: ReadonlyMap<string, Object3D | null>): string | null {
  const scene = buildScene(mount.panels, "thumb", { materials, make: exportablePanel, fitted: true })
  const root = scene.children[0]!
  // Comuns a la miniatura (`snapshot` → `disposeTree` els allibera amb l'escena).
  const metal = new MeshStandardMaterial({ color: 0xb9bdc2, metalness: 0.85, roughness: 0.3 })
  const ghost = new MeshStandardMaterial({ color: 0xb9bdc2, metalness: 0.5, roughness: 0.45 })
  const disc = new CircleGeometry(1, 20)
  const holeMat = new MeshBasicMaterial({ color: HOLE_COLOR })
  const proposedMat = new MeshBasicMaterial({ color: PROPOSED_HOLE_COLOR })
  const proposed = new Set(mount.proposedTags)

  const fitting = (f: PanelFitting, thickness: number): Object3D | null => {
    const src = f.asset ? models.get(f.asset) : null
    const g = new Group()
    g.matrixAutoUpdate = false
    g.matrix.copy(fittingMatrix(f, thickness))
    const b = f.bbox
    if (src) g.add(src.clone(true))
    else if (b) {
      // Sense el model (no hi és o no es llegeix): la caixa que ocupa, com al visor.
      const box = new Mesh(new BoxGeometry((b.max[0] - b.min[0]) * S, (b.max[1] - b.min[1]) * S, (b.max[2] - b.min[2]) * S), ghost)
      box.position.set(((b.min[0] + b.max[0]) / 2) * S, ((b.min[1] + b.max[1]) / 2) * S, ((b.min[2] + b.max[2]) / 2) * S)
      g.add(box)
    } else return null
    return g
  }

  // Les peces surten a `root` en el mateix ordre (`buildScene`): forats, frontisses de l'app i ferratges importats.
  mount.panels.forEach((p: Panel, i) => {
    const holder = root.children[i]
    if (!holder) return
    const T = p.thickness * S
    for (const [holes, mat] of [
      [p.holes.filter((h) => !h.tag || !proposed.has(h.tag)), holeMat],
      [p.holes.filter((h) => !!h.tag && proposed.has(h.tag)), proposedMat],
    ] as const) {
      const marks = holeMarkMatrices(holes, T)
      if (!marks.length) continue
      const im = new InstancedMesh(disc, mat, marks.length)
      marks.forEach((m, k) => im.setMatrixAt(k, m))
      im.computeBoundingSphere()
      holder.add(im)
    }
    for (const h of hingeVolumes(p)) {
      const cap = new Mesh(new CylinderGeometry(h.disc.radius, h.disc.radius, h.disc.height, 20), metal)
      cap.position.set(...h.disc.position)
      cap.rotation.x = Math.PI / 2
      const arm = new Mesh(new BoxGeometry(...h.arm.size), metal)
      arm.position.set(...h.arm.position)
      holder.add(cap, arm)
    }
    for (const f of p.fittings ?? []) {
      const o = fitting(f, p.thickness)
      if (o) holder.add(o)
    }
  })

  // Només 3D: el model sol (al marc d'una «peça» buida a l'origen, com a l'editor).
  if (mount.model) {
    const o = fitting({ ...(mount.model.asset ? { asset: mount.model.asset } : {}), x: 0, y: 0, face: "A", v: [0, 1], ...(mount.model.bbox ? { bbox: mount.model.bbox } : {}) }, 0)
    if (o) root.add(o)
  }
  scene.traverse((o) => {
    if ((o as Mesh).isMesh && !(o as InstancedMesh).isInstancedMesh) o.castShadow = o.receiveShadow = true
  })
  // A terra: el més baix a y = 0 (el model sol; les potes, que van cap avall des de la base del mòdul d'exemple).
  scene.updateMatrixWorld(true)
  const lift = -new Box3().setFromObject(root).min.y
  if (!Number.isFinite(lift)) return null
  root.position.y += lift
  scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene)

  const cam = mountCamera(mount)
  const target = new Vector3(cam.target[0] * S, cam.target[1] * S + lift, cam.target[2] * S)
  const dir = new Vector3(...cam.dir)
  const camera = new PerspectiveCamera(32, THUMB_ASPECT, 0.005, 60)
  camera.position.copy(target).addScaledVector(dir, cam.dist * S)
  camera.lookAt(target)

  // L'estudi de les miniatures: el terra només si la càmera és a sobre (no si es mira de sota) i la paret només si
  // és al davant (des de dins d'un moble, la paret és darrere la càmera).
  thumbStudio(scene, box, materials, undefined, { floor: camera.position.y > 0.01, wall: camera.position.z > box.min.z + 0.01, reach: cam.dist * S })
  const ext = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) * 0.75 + 0.1
  // El sol des del costat de la càmera, de dalt (o de sota, si es mira de sota): la cara que es mira (la de dins de la
  // porta, la de sota de la base d'una pota) no queda a l'ombra.
  const sun = new Vector3(dir.x, dir.y + (dir.y < -0.3 ? -0.8 : 0.8), dir.z).normalize().multiplyScalar(4)
  thumbLights(scene, target, ext, { sun, normalBias: 0.002 })
  return snapshot(scene, camera)
}
