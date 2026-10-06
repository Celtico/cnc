import { Box3, DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3, type Material, type Object3D } from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"
import { modelAsset, type ModelObject } from "../../core/model"
import { getHardwareAsset, isHardwareAssetSrc } from "../../db/hardwareAssets"
import { getUserModel, isUserModelSrc } from "../../db/userModels"
import { disposeMaterial } from "./textures"

/**
 * Models 3D (`.glb`) dels objectes: es carreguen un cop (memòria compartida) i cada element en fa una còpia que
 * comparteix la geometria i els materials. La càrrega és asíncrona: qui els dibuixa escolta `onModelsLoaded` (o
 * espera `preloadModels`) i torna a construir l'escena quan arriben. Les fulles tenen la silueta a l'alfa de la
 * textura: material amb `alphaTest` (retall net, amb ombres) i de doble cara; `userData.alphaCut` perquè el render per
 * CPU també les retalli.
 */
interface Loaded {
  root: Object3D
  /** Mida del model (m), per escalar-lo a la caixa de l'element. */
  size: Vector3
  /** Desplaçament perquè la cantonada mínima quedi a l'origen. */
  offset: Vector3
}

const cache = new Map<string, Loaded>()
const pending = new Map<string, Promise<Loaded | null>>()
/** Càrregues fallides (src → quan): no es tornen a provar fins passat `RETRY_MS`. */
const failed = new Map<string, number>()
const RETRY_MS = 60_000
/** Models de l'usuari que no hi són (esborrats): no es dibuixen, però no impedeixen les miniatures. */
const missing = new Set<string>()
const listeners = new Set<() => void>()
let loader: GLTFLoader | null = null

function urlOf(src: string): string | null {
  const a = modelAsset(src)
  return a ? `${import.meta.env.BASE_URL}${a.url}` : null
}

function prepare(root: Object3D): Loaded {
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    m.userData.sharedModel = true
    m.castShadow = true
    m.receiveShadow = true
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as Material[]
    for (const mat of mats) {
      const s = mat as MeshStandardMaterial
      if (!s.isMeshStandardMaterial) continue
      // Retall de les fulles (alfa de la textura): net i amb ombres, sense ordenar transparències. Només els
      // materials que ja eren amb alfa (l'escorça, opaca, queda normal).
      if (s.transparent || s.alphaTest > 0) {
        s.alphaTest = Math.max(s.alphaTest, 0.5)
        s.transparent = false
        s.depthWrite = true
        s.userData.alphaCut = s.alphaTest
      }
      s.side = DoubleSide
    }
  })
  const box = new Box3().setFromObject(root)
  const size = box.getSize(new Vector3())
  return { root, size, offset: box.min.clone().negate() }
}

/** Carrega (un cop) el model; `null` si no existeix o falla. */
export function loadModel(src: string): Promise<Loaded | null> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)
  const p = pending.get(src)
  if (p) return p
  // Ferratges importats (`hwa-…`, `db.hardwareAssets`): com els de l'usuari, el `.glb` és a Dexie.
  const hw = isHardwareAssetSrc(src)
  const user = isUserModelSrc(src) || hw
  const url = user ? null : urlOf(src)
  if (!user && !url) return Promise.resolve(null)
  const at = failed.get(src)
  if (at !== undefined && Date.now() - at < RETRY_MS) return Promise.resolve(null)
  // Els arbres van comprimits amb meshopt (`gltfpack -c`): el descompressor és JS de three, sense fitxers a part.
  const gl = (loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder))
  // Els de l'usuari: el `.glb` és a Dexie (`db.models`).
  const read = user
    ? (hw ? getHardwareAsset(src).then((a) => a?.glb) : getUserModel(src).then((row) => row?.blob)).then(async (blob) => {
        if (!blob) {
          missing.add(src)
          throw new Error("missing")
        }
        missing.delete(src)
        return gl.parseAsync(await blob.arrayBuffer(), "")
      })
    : gl.loadAsync(url!)
  const job = read
    .then((gltf) => {
      const l = prepare(gltf.scene)
      cache.set(src, l)
      failed.delete(src)
      for (const f of listeners) f()
      return l
    })
    .catch(() => {
      failed.set(src, Date.now())
      return null
    })
    .finally(() => pending.delete(src))
  pending.set(src, job)
  return job
}

/** El model ja carregat (sense còpia): els ferratges importats el posen al seu lloc amb el seu marc (`Hardware.tsx`). */
export function loadedModel(src: string): Loaded | null {
  return cache.get(src) ?? null
}

/** Espera que estiguin carregats tots els models de la llista (miniatures, exportacions). `true` si hi són tots. */
export async function preloadModels(models: ModelObject[] | undefined): Promise<boolean> {
  const srcs = [...new Set((models ?? []).map((m) => m.src))]
  const got = await Promise.all(srcs.map(loadModel))
  return got.every((l, i) => l !== null || missing.has(srcs[i]!))
}

/** Oblida un model de la memòria cau (pujat de nou o esborrat): el pròxim cop es torna a llegir. */
export function forgetModel(src: string): void {
  cache.delete(src)
  failed.delete(src)
  missing.delete(src)
  for (const f of listeners) f()
}

/**
 * Allibera de la GPU la geometria, els materials i les textures compartits dels models. Cada renderer que els ha
 * dibuixat hi deixa escoltadors de `dispose`: si no, un renderer mort quedaria viu a través de la memòria cau. És
 * segur cridar-ho amb altres renderers vius: els tornen a pujar quan els dibuixen.
 */
export function releaseModelGpu(): void {
  for (const l of cache.values()) {
    l.root.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      m.geometry.dispose()
      // Totes les textures del material (color, normals, rugositat, emissiva…), no només `map`.
      for (const mat of new Set((Array.isArray(m.material) ? m.material : [m.material]) as Material[])) disposeMaterial(mat)
    })
  }
}

/** Avisa quan s'acaba de carregar un model (per tornar a dibuixar). Torna la funció per deixar d'escoltar. */
export function onModelsLoaded(f: () => void): () => void {
  listeners.add(f)
  return () => listeners.delete(f)
}

/**
 * Còpia d'un model col·locada a la seva caixa (m, coordenades de la composició): cantonada (x, y, z), mida (w, h, d)
 * i gir al voltant del centre. Si encara no s'ha carregat, comença la càrrega i torna `null`.
 */
export function modelInstance(m: ModelObject): Group | null {
  const l = cache.get(m.src)
  if (!l) {
    void loadModel(m.src)
    return null
  }
  const inner = l.root.clone(true)
  inner.position.copy(l.offset)
  const fit = new Group()
  fit.add(inner)
  // Escalat a la caixa (cada eix pel seu compte: es pot fer més alta o més ampla).
  fit.scale.set(m.w / 1000 / Math.max(l.size.x, 1e-6), m.h / 1000 / Math.max(l.size.y, 1e-6), m.d / 1000 / Math.max(l.size.z, 1e-6))
  fit.position.set(-m.w / 2000, 0, -m.d / 2000)
  const g = new Group()
  g.name = m.name
  g.userData.model = m.id
  g.position.set((m.x + m.w / 2) / 1000, m.y / 1000, (m.z + m.d / 2) / 1000)
  g.rotation.y = -((m.rot ?? 0) * Math.PI) / 180
  g.add(fit)
  return g
}
