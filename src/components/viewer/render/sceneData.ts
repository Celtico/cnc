import { BoxGeometry, Camera, Mesh, MeshStandardMaterial, MirroredRepeatWrapping, OrthographicCamera, PerspectiveCamera, RepeatWrapping, Vector3, type BufferGeometry, type Object3D, type Scene, type Texture } from "three"

/**
 * Escena en dades planes per al render per CPU (`pathWorker`): triangles en coordenades del
 * món, materials simplificats (color, textura, rugositat, metall, opacitat), les textures en
 * píxels i la càmera. Es fa al fil principal (té accés als canvas de les textures) i
 * s'envia als workers.
 */
export interface RenderTexture {
  w: number
  h: number
  data: Uint8ClampedArray
  /** 0 = repeteix · 1 = mirall · 2 = s'atura a la vora. */
  wrapS: number
  wrapT: number
  flipY: boolean
}
export interface RenderMaterial {
  color: [number, number, number]
  map: number
  /** Matriu 3×3 de la textura (columnes), per a repetició, gir i desplaçament. */
  uv: number[]
  roughness: number
  metalness: number
  opacity: number
}
export interface RenderCamera {
  ortho: boolean
  /** Matriu del món de la càmera (16, columnes). */
  matrix: number[]
  /** Perspectiva: tan(fov/2). Ortogràfica: mitja alçada visible. */
  scale: number
  aspect: number
}
export interface RenderScene {
  positions: Float32Array
  uvs: Float32Array
  matIndex: Uint16Array
  materials: RenderMaterial[]
  textures: RenderTexture[]
  camera: RenderCamera
  sun: [number, number, number]
  background: [number, number, number]
  /**
   * Finestres (vidres) com a «portals» de llum: centre i els dos costats (9 per finestra, m).
   * Només en interiors (amb sostre): la llum del cel es mostreja a través seu (menys soroll).
   */
  portals: Float32Array
  /** Interior tancat (s'hi ha posat el sostre): la llum entra per les finestres. */
  interior: boolean
  /** Escena d'ambient: cel de dia (blau, horitzó clar, sol amb halo) en lloc del d'estudi. */
  daylight: boolean
}

/** Cel HDRI (equirectangular, RGB lineal) reduït, per als workers. */
export interface RenderEnv {
  w: number
  h: number
  data: Float32Array
}

/** Opcions del render que canvien el càlcul (en canviar-les es torna a començar). */
export interface RenderOpts {
  /** Rebots de la llum (llum indirecta: racons, sota els prestatges). */
  bounces: number
  /** Direcció del sol: azimut (0 = de davant, + = des de la dreta) i alçada, en graus. */
  sunAzimuth: number
  sunElevation: number
  /** Multiplicadors de la llum del sol i del cel. */
  sunIntensity: number
  skyIntensity: number
  /** Mida aparent del sol: 0 = ombres dures; 1 = molt suaus. */
  softness: number
  /** Obertura de la lent (radi en mm): 0 = tot enfocat; més, fons desenfocat (enfoca al centre). */
  aperture?: number
  /** Gir del cel HDRI (graus). */
  envRotation?: number
}

export const DEFAULT_RENDER_OPTS: RenderOpts = { bounces: 6, sunAzimuth: 40, sunElevation: 45, sunIntensity: 1, skyIntensity: 1, softness: 0.15, aperture: 0, envRotation: 0 }

const MAX_TEX = 512

function visibleChain(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/** Escenari del render: l'habitació de Presentació sencera, només el terra o res (fons llis). */
export type RenderRoom = "room" | "floor" | "none"

export function extractScene(scene: Scene, camera: Camera, aspect: number, room: RenderRoom = "room"): RenderScene {
  scene.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)
  const pos: number[] = []
  const uvs: number[] = []
  const mats: number[] = []
  const materials: RenderMaterial[] = []
  const matIds = new Map<MeshStandardMaterial, number>()
  const textures: RenderTexture[] = []
  const texIds = new Map<string, number>()

  const texId = (t: Texture): number => {
    const key = t.source.uuid
    const known = texIds.get(key)
    if (known !== undefined) return known
    const img = t.image as CanvasImageSource & { width: number; height: number }
    if (!img || !img.width) return -1
    const k = Math.min(1, MAX_TEX / Math.max(img.width, img.height))
    const c = document.createElement("canvas")
    c.width = Math.max(1, Math.round(img.width * k))
    c.height = Math.max(1, Math.round(img.height * k))
    const g = c.getContext("2d", { willReadFrequently: true })!
    g.drawImage(img, 0, 0, c.width, c.height)
    const wrap = (w: number) => (w === RepeatWrapping ? 0 : w === MirroredRepeatWrapping ? 1 : 2)
    textures.push({ w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data, wrapS: wrap(t.wrapS), wrapT: wrap(t.wrapT), flipY: t.flipY })
    texIds.set(key, textures.length - 1)
    return textures.length - 1
  }
  const matId = (m: MeshStandardMaterial): number => {
    const known = matIds.get(m)
    if (known !== undefined) return known
    let uv = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    let map = -1
    if (m.map) {
      map = texId(m.map)
      m.map.updateMatrix()
      uv = Array.from(m.map.matrix.elements)
    }
    materials.push({
      // three guarda els colors ja en lineal (gestió de color activada).
      color: [m.color.r, m.color.g, m.color.b],
      map,
      uv,
      roughness: m.roughness,
      metalness: m.metalness,
      opacity: m.userData.glass ? m.opacity : 1,
    })
    matIds.set(m, materials.length - 1)
    return materials.length - 1
  }

  const v = new Vector3()
  const camPos = new Vector3().setFromMatrixPosition(camera.matrixWorld)
  const portals: number[] = []
  let interior = false
  scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    // Només per al render (el sostre dels ambients): si la càmera és a sota, és un interior.
    const renderOnly = mesh.userData.renderOnly === "ceiling"
    if (renderOnly) {
      if (room !== "room" || camPos.y >= mesh.getWorldPosition(new Vector3()).y - 0.05) return
      interior = true
    } else if (!visibleChain(mesh)) return
    if (mesh.userData.portal && visibleChain(mesh)) {
      const g = mesh.geometry as BoxGeometry
      const { width = 1, height = 1 } = g.parameters ?? {}
      const c = new Vector3().setFromMatrixPosition(mesh.matrixWorld)
      const u = new Vector3().setFromMatrixColumn(mesh.matrixWorld, 0).multiplyScalar(width)
      const w = new Vector3().setFromMatrixColumn(mesh.matrixWorld, 1).multiplyScalar(height)
      portals.push(c.x, c.y, c.z, u.x, u.y, u.z, w.x, w.y, w.z)
    }
    const part = mesh.userData.room as "floor" | "wall" | undefined
    if (part && (room === "none" || (room === "floor" && part === "wall"))) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    // Només materials PBR normals: fora graella, ombres de contacte, nanses i fantasmes.
    if (!list.every((m) => (m as MeshStandardMaterial).isMeshStandardMaterial)) return
    // Fantasmes i ressaltats (transparents sense profunditat): fora. El mòdul seleccionat
    // (translúcid al visor) es renderitza sòlid; el vidre, transparent.
    const ghost = (m: MeshStandardMaterial) => m.transparent && !m.depthWrite && !m.userData.glass
    if (list.every((m) => ghost(m as MeshStandardMaterial))) return
    const geo = mesh.geometry as BufferGeometry
    const p = geo.getAttribute("position")
    if (!p) return
    const uv = geo.getAttribute("uv")
    const index = geo.getIndex()
    const count = index ? index.count : p.count
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count, materialIndex: 0 }]
    for (const gr of groups) {
      // Un sol material val per a tots els grups (BoxGeometry en porta sis: les parets només sortien per una cara).
      const m = (Array.isArray(mesh.material) ? list[gr.materialIndex ?? 0] : list[0]) as MeshStandardMaterial | undefined
      if (!m || ghost(m)) continue
      const id = matId(m)
      const end = Math.min(count, gr.start + gr.count)
      for (let i = gr.start; i + 2 < end; i += 3) {
        for (let k = 0; k < 3; k++) {
          const vi = index ? index.getX(i + k) : i + k
          v.fromBufferAttribute(p, vi).applyMatrix4(mesh.matrixWorld)
          pos.push(v.x, v.y, v.z)
          uvs.push(uv ? uv.getX(vi) : 0, uv ? uv.getY(vi) : 0)
        }
        mats.push(id)
      }
    }
  })

  const persp = camera as PerspectiveCamera
  const ortho = camera as OrthographicCamera
  const cam: RenderCamera = persp.isPerspectiveCamera
    ? { ortho: false, matrix: Array.from(camera.matrixWorld.elements), scale: Math.tan(((persp.fov * Math.PI) / 180) / 2) / persp.zoom, aspect }
    : { ortho: true, matrix: Array.from(camera.matrixWorld.elements), scale: (ortho.top - ortho.bottom) / 2 / ortho.zoom, aspect }
  const sun = new Vector3(2.5, 4, 3).normalize()
  const bg = (scene.background as { r?: number; g?: number; b?: number } | null) ?? null
  return {
    positions: new Float32Array(pos),
    uvs: new Float32Array(uvs),
    matIndex: new Uint16Array(mats),
    materials,
    textures,
    camera: cam,
    sun: [sun.x, sun.y, sun.z],
    background: bg && bg.r !== undefined ? [bg.r!, bg.g!, bg.b!] : [0.9, 0.88, 0.85],
    portals: new Float32Array(interior ? portals : []),
    interior,
    daylight: !!scene.userData.daylight,
  }
}
