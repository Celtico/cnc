import { Box3, Color, DirectionalLight, HemisphereLight, Mesh, Scene, MeshStandardMaterial, NeutralToneMapping, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, SRGBColorSpace, Vector3, WebGLRenderer, type Material, type Object3D, type Texture } from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import type { MaterialPref, Panel, RefObject } from "../../core/model"
import { refGeometry } from "./refGeometry"
import { exportablePanel } from "./CabinetViewer"
import { buildScene } from "./exportGlb"
import { makeFloor, ROOM } from "./floorTextures"
import { readPresentationScene } from "./presentationScene"
import { surfaceMaterial } from "./surfaceMaterial"

/**
 * Miniatures 3D de les targetes (Mobles i Objectes) sense cap visor obert: un sol renderitzador fora de
 * pantalla que pinta les peces amb els materials reals i en treu un JPEG petit. Un cada cop i, quan s'acaba
 * la cua, s'allibera (a l'iPhone, cada context WebGL compta: un 3D viu per targeta faria tancar la pàgina).
 */
/** 2:1, com les targetes (a l'ordinador, una mica més amples; al mòbil, una mica menys: es retalla poc). */
const W = 480
const H = 240
/** Versió de les miniatures: si canvia la manera de fer-les, es tornen a fer totes. */
export const THUMB_VERSION = 4

let renderer: WebGLRenderer | null = null
let env: Texture | null = null

function ensure(): WebGLRenderer {
  if (renderer) return renderer
  const r = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1)
  r.setSize(W, H, false)
  r.toneMapping = NeutralToneMapping
  r.outputColorSpace = SRGBColorSpace
  r.shadowMap.enabled = true
  r.shadowMap.type = PCFSoftShadowMap
  const pmrem = new PMREMGenerator(r)
  env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  renderer = r
  return r
}

/** Allibera el renderitzador (quan la cua de miniatures queda buida). */
export function releaseThumbRenderer(): void {
  env?.dispose()
  env = null
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = null
}

/** Llums i entorn d'estudi comuns de les miniatures, apuntant a `center`. */
export function thumbLights(scene: Scene, center: Vector3, ext: number): void {
  ensure()
  scene.environment = env
  scene.environmentIntensity = 0.6
  scene.add(new HemisphereLight("#ffffff", "#8a7a60", 0.45))
  const sun = new DirectionalLight("#ffffff", 1.7)
  sun.position.set(center.x + 2, center.y + 4, center.z + 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.1, far: 60 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  sun.target.position.copy(center)
  scene.add(sun, sun.target)
}

/** Pinta l'escena amb la càmera, en treu el JPEG i allibera l'escena. */
export function snapshot(scene: Scene, camera: PerspectiveCamera): string {
  const r = ensure()
  r.render(scene, camera)
  const url = r.domElement.toDataURL("image/jpeg", 0.82)
  disposeTree(scene)
  return url
}

export const THUMB_ASPECT = W / H

/** JPEG (data URL) de les peces vistes des de davant, una mica de costat i de dalt. */
export function renderThumb(panels: Panel[], materials: MaterialPref[], finish?: { floor?: string; wall?: string }, refs: RefObject[] = []): string | null {
  if (!panels.length) return null
  const scene = buildScene(panels, "thumb", { materials, make: exportablePanel })
  // Objectes de referència amb material (una tele, un radiador): com al visor i al render. Els fantasmes, no.
  for (const g of refs) {
    if (!g.material || g.effect === "cut") continue
    const m = new Mesh(refGeometry(g), surfaceMaterial(materials, g.material, Math.max(g.w, g.d), g.h))
    m.position.set((g.x + g.w / 2) / 1000, (g.y + g.h / 2) / 1000, (g.z + g.d / 2) / 1000)
    scene.add(m)
  }
  scene.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true
  })
  // Les peces porten la matriu feta (`matrixAutoUpdate = false`): cal posar al dia les del món abans de
  // mesurar la caixa, si no surt la de les peces sense col·locar (tallades i fora de lloc).
  scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())

  // Terra i paret de l'escena de Presentació (Preferències › Visor 3D): el moble no queda flotant.
  // Els acabats propis del moble (`Composition.scene`) passen per davant dels de Preferències.
  const pref = readPresentationScene()
  const look = { ...pref, ...(finish?.floor ? { floorMaterial: finish.floor } : {}), ...(finish?.wall ? { wallMaterial: finish.wall } : {}) }
  const F = Math.max(6, size.x * 3, size.z * 6)
  const floorMat = look.floorMaterial ? surfaceMaterial(materials, look.floorMaterial, F * 1000, F * 1000) : (() => {
    const f = makeFloor(look.floor)
    if (f.map) f.map.repeat.set((f.repeat * F) / ROOM, (f.repeat * F) / ROOM)
    return new MeshStandardMaterial({ map: f.map, color: f.map ? "#ffffff" : "#eeeeec", roughness: f.roughness })
  })()
  const wallZ = box.min.z - 0.002
  const floor = new Mesh(new PlaneGeometry(F, F), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(center.x, 0, wallZ + F / 2)
  floor.receiveShadow = true
  const wallMat = look.wallMaterial ? surfaceMaterial(materials, look.wallMaterial, F * 1000, 4000) : new MeshStandardMaterial({ color: look.wall, roughness: 0.95 })
  const wall = new Mesh(new PlaneGeometry(F, Math.max(4, size.y * 2)), wallMat)
  wall.position.set(center.x, Math.max(2, size.y), wallZ)
  wall.receiveShadow = true
  scene.add(floor, wall)
  scene.background = new Color(look.wall)
  thumbLights(scene, center, Math.max(size.x, size.y, size.z) * 1.5 + 0.5)

  const camera = new PerspectiveCamera(30, W / H, 0.01, 200)
  // Distància perquè hi càpiga sencer amb marge (la targeta en retalla una mica), des de davant a la dreta i de dalt.
  const dir = new Vector3(0.5, 0.3, 1).normalize()
  const radius = size.length() / 2
  const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.15
  camera.position.copy(center).addScaledVector(dir, dist)
  camera.lookAt(center)

  return snapshot(scene, camera)
}

export function disposeTree(root: Object3D) {
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    m.geometry?.dispose()
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as Material[]
    for (const mat of new Set(mats)) {
      ;(mat as Material & { map?: Texture | null }).map?.dispose()
      mat.dispose()
    }
  })
}
