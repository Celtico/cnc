import { BufferAttribute, BufferGeometry, type Material, type Mesh, type Object3D, type Texture, type TypedArray } from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"
import { MeshoptSimplifier } from "three/examples/jsm/libs/meshopt_simplifier.module.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { deinterleaveGeometry, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { keepMask, keptGroupScale, MAX_TEXTURE_SIZE, planTriangles, SMALL_GLB_BYTES, TRIANGLE_BUDGET, type OptimizeReport } from "./optimizeGlbPlan"

export type { OptimizeReport }

export interface OptimizeOptions {
  /** Triangles màxims (per defecte 100.000). */
  budget?: number
  /** Costat màxim de les textures en px (per defecte 1024). */
  maxTextureSize?: number
}

/** Una geometria (pot ser compartida per diverses malles) amb els seus triangles totals a l'escena. */
interface GeoEntry {
  geo: BufferGeometry
  meshes: Mesh[]
  tris: number
  alpha: boolean
  /** Amb grups de materials (multimaterial): no es toca. */
  locked: boolean
}

const isAlphaMaterial = (m: Material) => m.alphaTest > 0 || m.transparent
const materialsOf = (mesh: Mesh): Material[] => (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
const geoTris = (g: BufferGeometry) => Math.floor((g.index ? g.index.count : (g.getAttribute("position")?.count ?? 0)) / 3)
const instancesOf = (mesh: Mesh) => ((mesh as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh ? (mesh as unknown as { count: number }).count : 1)

function collectMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = []
  root.traverse((o) => {
    const m = o as Mesh
    if (m.isMesh && m.geometry?.getAttribute("position")) out.push(m)
  })
  return out
}

function collectGeometries(meshes: Mesh[]): GeoEntry[] {
  const map = new Map<BufferGeometry, GeoEntry>()
  for (const mesh of meshes) {
    const geo = mesh.geometry
    let e = map.get(geo)
    if (!e) {
      e = { geo, meshes: [], tris: 0, alpha: false, locked: geo.groups.length > 0 || !!geo.morphAttributes.position }
      map.set(geo, e)
    }
    e.meshes.push(mesh)
    e.tris += geoTris(geo) * instancesOf(mesh)
    if (materialsOf(mesh).some(isAlphaMaterial)) e.alpha = true
  }
  return [...map.values()]
}

const countTris = (meshes: Mesh[]) => meshes.reduce((a, m) => a + geoTris(m.geometry) * instancesOf(m), 0)

/** Geometria indexada, sense atributs entrellaçats i amb els vèrtexs iguals fusionats (uv i normals es mantenen). */
function indexed(geo: BufferGeometry): BufferGeometry {
  let g = geo
  if (Object.values(g.attributes).some((a) => (a as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute)) {
    g = g.clone()
    deinterleaveGeometry(g)
  }
  return mergeVertices(g)
}

function positionsF32(g: BufferGeometry): Float32Array {
  const pos = g.getAttribute("position")
  const p = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    p[i * 3] = pos.getX(i)
    p[i * 3 + 1] = pos.getY(i)
    p[i * 3 + 2] = pos.getZ(i)
  }
  return p
}

/** Nova geometria només amb els vèrtexs que fan servir `indices` (si no, el fitxer no s'aprima). */
function compact(g: BufferGeometry, indices: Uint32Array): BufferGeometry {
  const count = g.getAttribute("position").count
  const remap = new Int32Array(count).fill(-1)
  const order: number[] = []
  const idx = new Uint32Array(indices.length)
  for (let k = 0; k < indices.length; k++) {
    const v = indices[k]!
    if (remap[v]! < 0) {
      remap[v] = order.length
      order.push(v)
    }
    idx[k] = remap[v]!
  }
  const pick = (a: BufferAttribute) => {
    const Ctor = a.array.constructor as new (n: number) => TypedArray
    const out = new BufferAttribute(new Ctor(order.length * a.itemSize), a.itemSize, a.normalized)
    for (let i = 0; i < order.length; i++) for (let c = 0; c < a.itemSize; c++) out.setComponent(i, c, a.getComponent(order[i]!, c))
    return out
  }
  const out = new BufferGeometry()
  out.name = g.name
  out.userData = g.userData
  for (const [name, a] of Object.entries(g.attributes)) out.setAttribute(name, pick(a as BufferAttribute))
  const morph = out.morphAttributes as Record<string, BufferAttribute[]>
  for (const [name, list] of Object.entries(g.morphAttributes)) morph[name] = (list ?? []).map((a) => pick(a as BufferAttribute))
  out.morphTargetsRelative = g.morphTargetsRelative
  out.setIndex(new BufferAttribute(order.length > 65535 ? idx : new Uint16Array(idx), 1))
  return out
}

/** Delma una malla opaca fins a ~`ratio` dels triangles (meshoptimizer; primer sense moure les vores). */
function simplifyGeometry(geo: BufferGeometry, ratio: number): BufferGeometry {
  const g = indexed(geo)
  const src = new Uint32Array(g.index!.array)
  const pos = positionsF32(g)
  const target = Math.max(1, Math.floor((src.length / 3) * ratio)) * 3
  if (target >= src.length) return g
  let [out] = MeshoptSimplifier.simplify(src, pos, 3, target, 0.02, ["LockBorder"])
  // Si les vores no deixen arribar-hi, es torna a provar sense bloquejar-les i amb més error.
  if (out.length > target * 1.5) [out] = MeshoptSimplifier.simplify(src, pos, 3, target, 0.1)
  return compact(g, out)
}

/**
 * Malles amb alfa (targetes de fulles): delmar-les les desfà, així que se'n treu una part dels grups (peces
 * soltes) i els que es queden es fan una mica més grans al voltant del seu centre (≤ 1,5×), com l'script de Blender.
 */
function dropGroups(geo: BufferGeometry, keep: number): BufferGeometry | null {
  const g = indexed(geo)
  const index = g.index!.array
  const pos = positionsF32(g)
  const n = pos.length / 3
  // Grups connexos: vèrtexs units pels triangles i pels que comparteixen posició (costures d'uv).
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!
      a = parent[a]!
    }
    return a
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  const byPos = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos[i * 3]! * 1e5)},${Math.round(pos[i * 3 + 1]! * 1e5)},${Math.round(pos[i * 3 + 2]! * 1e5)}`
    const j = byPos.get(key)
    if (j === undefined) byPos.set(key, i)
    else union(i, j)
  }
  for (let t = 0; t < index.length; t += 3) {
    union(index[t]!, index[t + 1]!)
    union(index[t]!, index[t + 2]!)
  }
  const compOf = new Map<number, number>()
  const vComp = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const r = find(i)
    let c = compOf.get(r)
    if (c === undefined) compOf.set(r, (c = compOf.size))
    vComp[i] = c
  }
  const comps = compOf.size
  // Amb pocs grups no es pot triar: es deixa com està.
  if (comps < 8) return null
  const mask = keepMask(comps, keep)
  const scale = keptGroupScale(keep)
  // Centre (caixa) de cada grup que es queda.
  const box = new Float32Array(comps * 6)
  for (let c = 0; c < comps; c++) box.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], c * 6)
  for (let i = 0; i < n; i++) {
    const c = vComp[i]!
    for (let k = 0; k < 3; k++) {
      const v = pos[i * 3 + k]!
      if (v < box[c * 6 + k]!) box[c * 6 + k] = v
      if (v > box[c * 6 + 3 + k]!) box[c * 6 + 3 + k] = v
    }
  }
  const p = new Float32Array(pos)
  for (let i = 0; i < n; i++) {
    const c = vComp[i]!
    if (!mask[c]) continue
    for (let k = 0; k < 3; k++) {
      const mid = (box[c * 6 + k]! + box[c * 6 + 3 + k]!) / 2
      p[i * 3 + k] = mid + (pos[i * 3 + k]! - mid) * scale
    }
  }
  g.setAttribute("position", new BufferAttribute(p, 3))
  const kept: number[] = []
  for (let t = 0; t < index.length; t += 3) if (mask[vComp[index[t]!]!]) kept.push(index[t]!, index[t + 1]!, index[t + 2]!)
  return compact(g, new Uint32Array(kept))
}

type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas

const isDrawable = (img: unknown): img is Drawable =>
  (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) ||
  (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) ||
  (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) ||
  (typeof OffscreenCanvas !== "undefined" && img instanceof OffscreenCanvas)

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h)
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return c
}

/** Còpia reduïda (costat màxim `max`), amb l'alfa. */
function downscale(img: Drawable, max: number): HTMLCanvasElement | OffscreenCanvas {
  const k = max / Math.max(img.width, img.height)
  const c = makeCanvas(Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)))
  const ctx = c.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c
}

let webp: boolean | undefined
/** El navegador sap codificar WebP? (Safari antic no: torna PNG.) L'exportador fa servir un canvas del document. */
function canEncodeWebp(): boolean {
  if (webp !== undefined) return webp
  try {
    const c = document.createElement("canvas")
    c.width = c.height = 1
    webp = c.toDataURL("image/webp").startsWith("data:image/webp")
  } catch {
    webp = false
  }
  return webp
}

/** Textures dels materials, amb si en fan servir l'alfa (mapa de color d'un material amb alfa). */
function collectTextures(meshes: Mesh[]): Map<Texture, boolean> {
  const out = new Map<Texture, boolean>()
  for (const mesh of meshes)
    for (const m of materialsOf(mesh)) {
      const alpha = isAlphaMaterial(m)
      for (const [key, v] of Object.entries(m)) {
        const t = v as Texture | null
        if (!t || !t.isTexture) continue
        const usesAlpha = alpha && (key === "map" || key === "alphaMap")
        out.set(t, (out.get(t) ?? false) || usesAlpha)
      }
    }
  return out
}

/**
 * Prepara un `.glb` pujat per al mòbil: si passa del pressupost de triangles, delma les malles opaques (i treu grups de
 * fulles a les d'alfa), redueix les textures de més de 1024 px i el torna a exportar (WebP si el navegador en sap, si
 * no JPEG/PNG). Si no cal res, o si alguna cosa falla, torna el fitxer original (`changed: false`).
 */
export async function optimizeGlb(buffer: ArrayBuffer, opts: OptimizeOptions = {}): Promise<{ buffer: ArrayBuffer; report: OptimizeReport }> {
  const budget = opts.budget ?? TRIANGLE_BUDGET
  const maxTex = opts.maxTextureSize ?? MAX_TEXTURE_SIZE
  const bytesBefore = buffer.byteLength
  const unchanged = (tris: number) => ({
    buffer,
    report: { trisBefore: tris, trisAfter: tris, bytesBefore, bytesAfter: bytesBefore, texturesResized: 0, changed: false },
  })
  let trisBefore = 0
  try {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, "")
    const meshes = collectMeshes(gltf.scene)
    trisBefore = countTris(meshes)
    const textures = collectTextures(meshes)
    const bigTexture = [...textures.keys()].some((t) => isDrawable(t.image) && Math.max(t.image.width, t.image.height) > maxTex)
    if (trisBefore <= budget && !bigTexture && bytesBefore < SMALL_GLB_BYTES) return unchanged(trisBefore)

    // Triangles.
    if (trisBefore > budget) {
      await MeshoptSimplifier.ready
      const geos = collectGeometries(meshes)
      const sum = (alpha: boolean) => geos.filter((e) => e.alpha === alpha && !e.locked).reduce((a, e) => a + e.tris, 0)
      const lockedTris = geos.filter((e) => e.locked).reduce((a, e) => a + e.tris, 0)
      const plan = planTriangles(sum(false), sum(true), Math.max(budget - lockedTris, budget * 0.25))
      for (const e of geos) {
        if (e.locked) continue
        let next: BufferGeometry | null = null
        if (!e.alpha && plan.opaqueRatio < 1) next = simplifyGeometry(e.geo, plan.opaqueRatio)
        else if (e.alpha && plan.alphaKeep < 1) next = dropGroups(e.geo, plan.alphaKeep)
        if (!next) continue
        if (!next.getAttribute("normal")) next.computeVertexNormals()
        next.computeBoundingBox()
        next.computeBoundingSphere()
        for (const m of e.meshes) m.geometry = next
        e.geo.dispose()
      }
    }

    // Textures: reduïdes a `maxTex` i el format de sortida (l'exportador mira `userData.mimeType`).
    const resized = new Map<unknown, HTMLCanvasElement | OffscreenCanvas>()
    const useWebp = canEncodeWebp()
    for (const [t, alpha] of textures) {
      const img: unknown = t.image
      if (isDrawable(img) && Math.max(img.width, img.height) > maxTex) {
        let small = resized.get(img)
        if (!small) resized.set(img, (small = downscale(img, maxTex)))
        t.image = small
        t.needsUpdate = true
      }
      t.userData.mimeType = useWebp ? "image/webp" : alpha ? "image/png" : "image/jpeg"
    }

    const trisAfter = countTris(collectMeshes(gltf.scene))
    const out = (await new GLTFExporter().parseAsync(gltf.scene, { binary: true, maxTextureSize: maxTex, animations: gltf.animations })) as ArrayBuffer
    // Només val la pena si té menys triangles o pesa menys (un .glb ja comprimit amb meshopt pot créixer).
    if (trisAfter >= trisBefore && out.byteLength >= bytesBefore) return unchanged(trisBefore)
    return {
      buffer: out,
      report: { trisBefore, trisAfter, bytesBefore, bytesAfter: out.byteLength, texturesResized: resized.size, changed: true },
    }
  } catch (e) {
    console.warn("optimizeGlb: no s'ha pogut optimitzar el model, es desa tal com ve", e)
    return unchanged(trisBefore)
  }
}
