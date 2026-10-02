import { BoxGeometry, Camera, Matrix3, Matrix4, Mesh, MeshStandardMaterial, MirroredRepeatWrapping, OrthographicCamera, PerspectiveCamera, RepeatWrapping, Vector3, type BufferGeometry, type Object3D, type Scene, type Texture } from "three"
import { BEVEL_RADIUS } from "./shading"

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
  /** Luminància lineal mitjana (per a la variació de rugositat de la veta). */
  lum: number
  /** Dades lineals (mapes de normals i de rugositat): sense la corba sRGB. */
  linear?: boolean
}
export interface RenderMaterial {
  color: [number, number, number]
  map: number
  /** Matriu 3×3 de la textura (columnes), per a repetició, gir i desplaçament. */
  uv: number[]
  roughness: number
  metalness: number
  opacity: number
  /** Retall per l'alfa de la textura (fulles dels models 3D): els punts amb alfa per sota no hi són. 0 = cap. */
  alphaCut: number
  /** Relleu i brillantor variable segons la textura (fusta i fotos de tauler): 0 = no, 1 = normal. */
  bump: number
  /** Llum que emet (radiància lineal, abans de la intensitat de «Llums enceses»): pantalles i bombetes. */
  emission: [number, number, number]
  /** Translucidesa (0–1): part de la llum difusa que passa a l'altra cara (fulles, cortines, pantalles). */
  translucent: number
  /** Mapa de normals (tangent, convenció OpenGL) i de rugositat (canal G): índex de textura o −1. */
  normalMap: number
  roughMap: number
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
  /**
   * Normals dels vèrtexs (9 per triangle, com `positions`), al món i unitàries: la normal
   * d'ombrejat és la seva interpolació (`smoothNormal`). Sense normals a la geometria, la de la cara.
   */
  normals: Float32Array
  uvs: Float32Array
  matIndex: Uint16Array
  /** Malla de cada triangle per a les arestes arrodonides (`bevel`), o −1. */
  triBevel: Int32Array
  /**
   * Malles amb arestes arrodonides (els taulers dels mobles), 20 per malla: matriu món → local
   * (3 files de 4), mínim de la caixa local i radi (local), màxim i un buit.
   */
  bevel: Float32Array
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
  /** Llums enceses (pantalles i bombetes emeten llum) i la seva intensitat (×). */
  lamps?: boolean
  lampIntensity?: number
}

export const DEFAULT_RENDER_OPTS: RenderOpts = { bounces: 6, sunAzimuth: 40, sunElevation: 45, sunIntensity: 1, skyIntensity: 1, softness: 0.15, aperture: 0, envRotation: 0, lamps: true, lampIntensity: 1 }

const MAX_TEX = 512

/** Color de la llum de les làmpades (bombeta càlida, ~2700 K, lineal i de luminància 1). */
export const LAMP_COLOR: [number, number, number] = [1.32, 0.95, 0.62]

/** Translucidesa per defecte de les fulles retallades dels models 3D (alfa). */
export const LEAF_TRANSLUCENCY = 0.4

/** sRGB (byte) → lineal. */
const LIN = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

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
  const nrm: number[] = []
  const uvs: number[] = []
  const mats: number[] = []
  const materials: RenderMaterial[] = []
  const matIds = new Map<MeshStandardMaterial, number>()
  const textures: RenderTexture[] = []
  const texIds = new Map<string, number>()
  const triBevel: number[] = []
  const bevel: number[] = []

  const texId = (t: Texture, linear = false): number => {
    const key = `${t.source.uuid}${linear ? ":lin" : ""}`
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
    const data = g.getImageData(0, 0, c.width, c.height).data
    let lum = 0
    for (let i = 0; i < data.length; i += 4) lum += 0.2126 * LIN[data[i]!]! + 0.7152 * LIN[data[i + 1]!]! + 0.0722 * LIN[data[i + 2]!]!
    textures.push({ w: c.width, h: c.height, data, wrapS: wrap(t.wrapS), wrapT: wrap(t.wrapT), flipY: t.flipY, lum: lum / Math.max(1, data.length / 4), ...(linear ? { linear: true } : {}) })
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
    // Mapes PBR (fotos amb normal i rugositat): mateixa repetició que el color (`uv`).
    const normalMap = m.map && m.normalMap ? texId(m.normalMap, true) : -1
    const roughMap = m.map && m.roughnessMap ? texId(m.roughnessMap, true) : -1
    const glow = Number(m.userData.glow) || 0
    const alphaCut = map >= 0 ? ((m.userData.alphaCut as number | undefined) ?? 0) : 0
    materials.push({
      // three guarda els colors ja en lineal (gestió de color activada).
      color: [m.color.r, m.color.g, m.color.b],
      map,
      uv,
      roughness: m.roughness,
      metalness: m.metalness,
      opacity: m.userData.glass ? m.opacity : 1,
      alphaCut,
      bump: map >= 0 && m.userData.grain && normalMap < 0 ? 1 : 0,
      emission: glow > 0 ? [LAMP_COLOR[0] * glow, LAMP_COLOR[1] * glow, LAMP_COLOR[2] * glow] : [0, 0, 0],
      translucent: Math.min(1, Math.max(0, Number(m.userData.translucent ?? (alphaCut > 0 ? LEAF_TRANSLUCENCY : 0)) || 0)),
      normalMap,
      roughMap,
    })
    matIds.set(m, materials.length - 1)
    return materials.length - 1
  }

  const v = new Vector3()
  const vn = new Vector3()
  const normalMatrix = new Matrix3()
  const camPos = new Vector3().setFromMatrixPosition(camera.matrixWorld)
  const portals: number[] = []
  let interior = false
  const ceilings: Mesh[] = []
  const addMesh = (mesh: Mesh) => {
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
    const na = geo.getAttribute("normal")
    // Normals al món: la matriu normal (inversa transposada) també val amb escales no uniformes i miralls.
    normalMatrix.getNormalMatrix(mesh.matrixWorld)
    const index = geo.getIndex()
    // Arestes arrodonides: la caixa local de la malla i la matriu per passar-hi del món.
    let bevelId = -1
    if (mesh.userData.bevel) {
      if (!geo.boundingBox) geo.computeBoundingBox()
      const bb = geo.boundingBox!
      const inv = new Matrix4().copy(mesh.matrixWorld).invert().elements
      // Radi en unitats locals (si la malla té escala).
      const k = Math.hypot(inv[0]!, inv[4]!, inv[8]!) || 1
      bevelId = bevel.length / 20
      bevel.push(inv[0]!, inv[4]!, inv[8]!, inv[12]!, inv[1]!, inv[5]!, inv[9]!, inv[13]!, inv[2]!, inv[6]!, inv[10]!, inv[14]!, bb.min.x, bb.min.y, bb.min.z, BEVEL_RADIUS * k, bb.max.x, bb.max.y, bb.max.z, 0)
    }
    const count = index ? index.count : p.count
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count, materialIndex: 0 }]
    for (const gr of groups) {
      // Un sol material val per a tots els grups (BoxGeometry en porta sis: les parets només sortien per una cara).
      const m = (Array.isArray(mesh.material) ? list[gr.materialIndex ?? 0] : list[0]) as MeshStandardMaterial | undefined
      if (!m || ghost(m)) continue
      const id = matId(m)
      const end = Math.min(count, gr.start + gr.count)
      for (let i = gr.start; i + 2 < end; i += 3) {
        const p0 = pos.length
        let ok = !!na
        for (let k = 0; k < 3; k++) {
          const vi = index ? index.getX(i + k) : i + k
          v.fromBufferAttribute(p, vi).applyMatrix4(mesh.matrixWorld)
          pos.push(v.x, v.y, v.z)
          uvs.push(uv ? uv.getX(vi) : 0, uv ? uv.getY(vi) : 0)
          if (na) {
            vn.fromBufferAttribute(na, vi).applyMatrix3(normalMatrix)
            const l = vn.length()
            if (!(l > 1e-8)) ok = false
            vn.divideScalar(l || 1)
            nrm.push(vn.x, vn.y, vn.z)
          }
        }
        if (!ok) {
          // Sense normals (o degenerades): la de la cara als tres vèrtexs.
          const e1x = pos[p0 + 3]! - pos[p0]!, e1y = pos[p0 + 4]! - pos[p0 + 1]!, e1z = pos[p0 + 5]! - pos[p0 + 2]!
          const e2x = pos[p0 + 6]! - pos[p0]!, e2y = pos[p0 + 7]! - pos[p0 + 1]!, e2z = pos[p0 + 8]! - pos[p0 + 2]!
          vn.set(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x).normalize()
          nrm.length = p0
          for (let k = 0; k < 3; k++) nrm.push(vn.x, vn.y, vn.z)
        }
        mats.push(id)
        triBevel.push(bevelId)
      }
    }
  }
  scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    // Només per al render (el sostre dels ambients): si la càmera és a sota, és un interior.
    if (mesh.userData.renderOnly === "ceiling") {
      if (room === "room" && camPos.y < mesh.getWorldPosition(new Vector3()).y - 0.05) ceilings.push(mesh)
      return
    }
    if (visibleChain(mesh)) addMesh(mesh)
  })
  // El sostre només si la llum hi pot entrar per alguna finestra: una habitació tancada sense
  // finestres sortiria negra (llavors es fa sense sostre, amb la llum del cel de dalt).
  if (ceilings.length && portals.length) {
    interior = true
    for (const m of ceilings) addMesh(m)
  }

  const persp = camera as PerspectiveCamera
  const ortho = camera as OrthographicCamera
  const cam: RenderCamera = persp.isPerspectiveCamera
    ? { ortho: false, matrix: Array.from(camera.matrixWorld.elements), scale: Math.tan(((persp.fov * Math.PI) / 180) / 2) / persp.zoom, aspect }
    : { ortho: true, matrix: Array.from(camera.matrixWorld.elements), scale: (ortho.top - ortho.bottom) / 2 / ortho.zoom, aspect }
  const sun = new Vector3(2.5, 4, 3).normalize()
  // El fons del render: el propi de l'escena si en té (els ambients: el visor és fosc però el render manté el clar).
  const bg = ((scene.userData.renderBackground ?? scene.background) as { r?: number; g?: number; b?: number } | null) ?? null
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nrm),
    uvs: new Float32Array(uvs),
    matIndex: new Uint16Array(mats),
    triBevel: new Int32Array(triBevel),
    bevel: new Float32Array(bevel),
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
