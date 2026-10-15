import type { Group, Material, Mesh, Object3D, Texture } from "three"
import { exrToPngBlob, isExrBlob } from "../../components/viewer/exrImage"
import type { PickedFile } from "../../components/pickedFiles"
import {
  baseNameOf,
  dirOf,
  findFile,
  modelDisplayName,
  pickMainModel,
  planPolyHavenDownload,
  polyHavenRefOf,
  polyHavenTitle,
  resolveUri,
  type DownloadPlan,
  type ModelFormat,
  type PolyHavenInfo,
  type PolyHavenRef,
} from "../../core/assets"
import { groupTextureSets, isTextureFile } from "../../core/photo/pbrMaps"
import { downloadPolyHaven, fetchPolyHavenFiles, fetchPolyHavenInfo, isOffline, OfflineError } from "../file/polyHavenApi"
import { expandPicked } from "../settings/textureImport"

/**
 * Importar un model 3D (Objectes › Models 3D) des del que es baixa de les webs: un `.glb`, un `.gltf` amb el `.bin` i les
 * textures (fitxers, carpeta o `.zip`), un `.fbx` (FBXLoader de three) o un `.zip` de Poly Haven amb el `.blend` (el
 * navegador no pot llegir el `.blend`: es baixa el mateix model en glTF de l'API de Poly Haven, reaprofitant les textures
 * del zip). Tot acaba en un sol `.glb` amb les textures a dins, que després passa per `addUserModelBuffer` (validar,
 * optimitzar, mesurar i desar). Les parts pures són a `core/import/modelFiles.ts` i `core/import/polyHaven.ts`.
 */

export type ImportStage = "read" | "download" | "convert" | "optimize"

export interface ImportProgress {
  stage: ImportStage
  /** Text per a la UI. */
  label: string
  /** 0–1 si se sap. */
  frac?: number
}

export interface ConvertedModel {
  name: string
  glb: ArrayBuffer
  /** D'on ve: el format del fitxer o `polyhaven` (baixat en glTF). */
  source: ModelFormat | "polyhaven"
  /** Textures del conjunt (les del zip i les baixades) per fer-ne materials. */
  textures: Map<string, Blob>
  /** Jocs de textures (un per material del model). */
  textureSets: { key: string; paths: string[] }[]
  polyHaven?: PolyHavenRef
  info?: PolyHavenInfo | null
  /** Fitxers que el model demanava i no hi eren. */
  missing: string[]
  /** Bytes baixats de Poly Haven. */
  downloaded?: number
}

/** Per què no s'ha pogut importar (la UI hi posa l'explicació i les alternatives). */
export type ImportFailure =
  | "blend-offline"
  | "blend-not-polyhaven"
  | "blend-no-gltf"
  | "texture-only"
  | "unsupported"
  | "no-model"
  | "broken"

interface ModelImportError extends Error {
  reason: ImportFailure
  /** Els fitxers del conjunt (per oferir les textures a Materials encara que no hi hagi model). */
  textures?: Map<string, Blob>
  polyHaven?: PolyHavenRef
  info?: PolyHavenInfo | null
}

function importError(reason: ImportFailure, message: string, textures?: Map<string, Blob>, polyHaven?: PolyHavenRef, info?: PolyHavenInfo | null): ModelImportError {
  return Object.assign(new Error(message), { name: "ModelImportError", reason, ...(textures ? { textures } : {}), ...(polyHaven ? { polyHaven } : {}), ...(info !== undefined ? { info } : {}) })
}

export const isModelImportError = (e: unknown): e is ModelImportError => e instanceof Error && e.name === "ModelImportError"

const formatLabel: Record<ModelFormat, string> = { glb: ".glb", gltf: ".gltf", fbx: ".fbx", blend: ".blend", usd: ".usd", other: "" }

/** Llegeix els fitxers triats i en fa un `.glb` (sense desar-lo). */
export async function convertModelFiles(picked: PickedFile[], onProgress: (p: ImportProgress) => void): Promise<ConvertedModel> {
  onProgress({ stage: "read", label: "Llegint els fitxers…" })
  const { files, zipNames } = await expandPicked(picked, () => true)
  const paths = [...files.keys()]
  const main = pickMainModel(paths)
  const texturesOf = () => new Map([...files].filter(([p]) => isTextureFile(p)))
  const ref = polyHavenRefOf(paths, zipNames[0]) ?? undefined
  if (!main) {
    const tex = texturesOf()
    if (tex.size) throw importError("texture-only", "Aquests fitxers són un joc de textures, no un model 3D.", tex, ref)
    throw importError("no-model", "No hi ha cap model 3D (.glb, .gltf, .fbx o el .blend de Poly Haven).")
  }
  const name = modelDisplayName(main.path)
  const done = (glb: ArrayBuffer, source: ConvertedModel["source"], textures: Map<string, Blob>, missing: string[], extra: Partial<ConvertedModel> = {}): ConvertedModel => ({
    name,
    glb,
    source,
    textures,
    textureSets: groupTextureSets([...textures.keys()]),
    missing,
    ...(ref ? { polyHaven: ref } : {}),
    ...extra,
  })

  if (main.format === "glb") {
    return done(await files.get(main.path)!.arrayBuffer(), "glb", texturesOf(), [])
  }
  if (main.format === "gltf") {
    onProgress({ stage: "convert", label: "Passant el glTF a .glb…" })
    const r = await gltfToGlb(main.path, files)
    // Un glTF de Poly Haven: el nom de l'API (si hi ha connexió) i la mida real de les textures.
    const info = ref ? await fetchPolyHavenInfo(ref.id) : null
    return { ...done(r.glb, "gltf", texturesOf(), r.missing, { info }), name: info?.type === 2 ? info.name : name }
  }
  if (main.format === "fbx") {
    onProgress({ stage: "convert", label: "Passant l'FBX a .glb…" })
    try {
      const r = await fbxToGlb(main.path, files)
      return done(r.glb, "fbx", texturesOf(), r.missing)
    } catch (e) {
      // Un FBX que three no llegeix: si és de Poly Haven i hi ha connexió, com un .blend.
      if (!ref || isOffline()) throw isModelImportError(e) ? e : importError("broken", `No s'ha pogut llegir l'FBX: ${errText(e)}`)
    }
  }
  if (main.format === "other") {
    throw importError("unsupported", `El format ${baseNameOf(main.path).split(".").pop()?.toUpperCase()} no es pot llegir al navegador.`, texturesOf())
  }

  // .blend / .usd (i l'FBX que no es pot llegir): el mateix model de Poly Haven en glTF.
  const what = formatLabel[main.format] || "fitxer"
  if (!ref) throw importError("blend-not-polyhaven", `El navegador no pot llegir un ${what} i el nom no és el d'un model de Poly Haven.`, texturesOf())
  if (isOffline()) throw importError("blend-offline", `El navegador no pot llegir un ${what} i ara no hi ha connexió per baixar el mateix model en glTF de Poly Haven.`, texturesOf(), ref)
  onProgress({ stage: "download", label: "Preguntant a Poly Haven…" })
  let plan: DownloadPlan | null
  let info: PolyHavenInfo | null
  try {
    const [list, inf] = await Promise.all([fetchPolyHavenFiles(ref.id), fetchPolyHavenInfo(ref.id)])
    info = inf
    plan = planPolyHavenDownload(list, ref.res, paths.filter(isTextureFile))
  } catch (e) {
    if (e instanceof OfflineError) throw importError("blend-offline", `El navegador no pot llegir un ${what} i no s'ha pogut connectar amb Poly Haven.`, texturesOf(), ref)
    throw importError("blend-no-gltf", `No s'ha trobat «${ref.id}» a Poly Haven (${errText(e)}).`, texturesOf(), ref)
  }
  if (info?.type === 1) throw importError("texture-only", `«${info.name}» és una textura de Poly Haven, no un model 3D.`, texturesOf(), ref, info)
  if (!plan) throw importError("blend-no-gltf", `Poly Haven no té «${ref.id}» en glTF.`, texturesOf(), ref, info)
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1).replace(".", ",")
  const label = `Baixant «${info?.name ?? polyHavenTitle(ref.id)}» en glTF (${plan.res}) de Poly Haven…`
  onProgress({ stage: "download", label, frac: 0 })
  let got: Map<string, Blob>
  try {
    got = await downloadPolyHaven([plan.main, ...plan.fetch], (d, t) => onProgress({ stage: "download", label: `${label} ${mb(d)} de ${mb(t)} MB`, frac: t ? d / t : undefined }))
  } catch (e) {
    if (e instanceof OfflineError) throw importError("blend-offline", "S'ha perdut la connexió mentre es baixava el model de Poly Haven.", texturesOf(), ref, info)
    throw importError("blend-no-gltf", `No s'ha pogut baixar el model de Poly Haven (${errText(e)}).`, texturesOf(), ref, info)
  }
  // El conjunt del glTF: el baixat i les textures del zip (un EXR es passa a PNG perquè el GLTFLoader el llegeixi).
  onProgress({ stage: "convert", label: "Passant el glTF a .glb…" })
  const set = new Map(got)
  for (const r of plan.reuse) {
    const local = files.get(r.local)!
    set.set(r.path, (await isExrBlob(local)) ? await exrToPngBlob(local) : local)
  }
  // Per als materials, totes les del zip (EXR inclòs: `encodeMap` el sap llegir; la rugositat pròpia guanya a l'ARM) i
  // les baixades que no hi eren.
  const textures = texturesOf()
  for (const [p, b] of got) if (isTextureFile(p)) textures.set(p, b)
  const r = await gltfToGlb(plan.main.path, set)
  return { ...done(r.glb, "polyhaven", textures, r.missing, { info, downloaded: plan.bytes }), name: info?.name ?? name }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * `LoadingManager` que serveix els fitxers del conjunt amb URL de blob (les URI relatives respecte de la carpeta del
 * model). Els que no hi són van a `missing` i no es demanen a la xarxa.
 */
async function fileManager(mainPath: string, files: Map<string, Blob>) {
  const { LoadingManager } = await import("three")
  const paths = [...files.keys()]
  const urls = new Map<string, string>()
  const missing: string[] = []
  const manager = new LoadingManager()
  manager.setURLModifier((url) => {
    const wanted = resolveUri(dirOf(mainPath), url)
    if (wanted === null) return url
    const path = findFile(paths, wanted)
    if (!path) {
      const name = baseNameOf(wanted)
      if (!missing.includes(name)) missing.push(name)
      return "data:,"
    }
    let u = urls.get(path)
    if (!u) urls.set(path, (u = URL.createObjectURL(files.get(path)!)))
    return u
  })
  const release = () => {
    for (const u of urls.values()) URL.revokeObjectURL(u)
    urls.clear()
  }
  // Quan acaba el que s'ha començat a carregar (les textures de l'FBX arriben després de `parse`).
  let started = false
  let loaded = false
  let wake: (() => void) | null = null
  manager.onStart = () => {
    started = true
    loaded = false
  }
  manager.onLoad = () => {
    loaded = true
    wake?.()
  }
  const idle = (timeoutMs = 60000) =>
    new Promise<void>((res) => {
      if (!started || loaded) return res()
      const t = setTimeout(res, timeoutMs)
      wake = () => {
        clearTimeout(t)
        res()
      }
    })
  return { manager, missing, release, idle }
}

/** `.gltf` + `.bin` + textures → `.glb` (GLTFLoader → GLTFExporter, amb les textures a dins). */
async function gltfToGlb(mainPath: string, files: Map<string, Blob>): Promise<{ glb: ArrayBuffer; missing: string[] }> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("three/examples/jsm/libs/meshopt_decoder.module.js")])
  const { manager, missing, release } = await fileManager(mainPath, files)
  try {
    const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder)
    let gltf
    try {
      gltf = await loader.parseAsync(await files.get(mainPath)!.arrayBuffer(), "")
    } catch (e) {
      const bin = missing.find((m) => /\.bin$/i.test(m))
      throw importError("broken", bin ? `Falta el fitxer «${bin}» del model (tria'l amb el .gltf, o el .zip sencer).` : `No s'ha pogut llegir el .gltf: ${errText(e)}`)
    }
    return { glb: await exportGlb(gltf.scene, gltf.animations), missing }
  } finally {
    release()
  }
}

/** `.fbx` (+ textures, també EXR) → `.glb`. Materials Phong/Lambert → estàndard; unitats de l'FBX → metres. */
async function fbxToGlb(mainPath: string, files: Map<string, Blob>): Promise<{ glb: ArrayBuffer; missing: string[] }> {
  const [{ FBXLoader }, three] = await Promise.all([import("three/examples/jsm/loaders/FBXLoader.js"), import("three")])
  const { manager, missing, release, idle } = await fileManager(mainPath, files)
  // Les textures EXR (els FBX de Poly Haven les porten): descodificades a 8 bits.
  class ExrTextureLoader extends three.Loader<Texture> {
    load(url: string, onLoad?: (t: Texture) => void, _p?: unknown, onError?: (e: unknown) => void): Texture {
      const tex = new three.Texture()
      const resolved = this.manager.resolveURL(this.path ? this.path + url : url)
      this.manager.itemStart(resolved)
      void fetch(resolved)
        .then((r) => r.blob())
        .then((b) => import("../../components/viewer/exrImage").then((m) => m.exrToCanvas(b)))
        .then((c) => {
          tex.image = c
          tex.needsUpdate = true
          onLoad?.(tex)
        })
        .catch((e) => {
          onError?.(e)
          this.manager.itemError(resolved)
        })
        .finally(() => this.manager.itemEnd(resolved))
      return tex
    }
  }
  manager.addHandler(/\.exr$/i, new ExrTextureLoader(manager))
  try {
    let root: Group
    try {
      root = new FBXLoader(manager).parse(await files.get(mainPath)!.arrayBuffer(), "")
    } catch (e) {
      throw importError("broken", `No s'ha pogut llegir l'FBX: ${errText(e)}`)
    }
    await idle()
    // Unitats: `UnitScaleFactor` = centímetres per unitat (1 = cm, 100 = m).
    const unit = Number(root.userData.unitScaleFactor)
    root.scale.multiplyScalar((Number.isFinite(unit) && unit > 0 ? unit : 1) / 100)
    root.traverse((o: Object3D) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => toStandard(three, m)) : toStandard(three, mesh.material)
    })
    return { glb: await exportGlb(root, root.animations), missing }
  } finally {
    release()
  }
}

/** Un material Phong/Lambert de l'FBX → `MeshStandardMaterial` (el que el glTF sap desar). */
function toStandard(three: typeof import("three"), m: Material): Material {
  if ((m as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial || (m as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) return m
  const p = m as Material & { color?: import("three").Color; map?: Texture | null; normalMap?: Texture | null; alphaMap?: Texture | null; emissive?: import("three").Color; emissiveMap?: Texture | null; shininess?: number }
  const s = new three.MeshStandardMaterial({
    name: m.name,
    color: p.color ?? 0xffffff,
    map: p.map ?? null,
    normalMap: p.normalMap ?? null,
    alphaMap: p.alphaMap ?? null,
    emissive: p.emissive ?? 0x000000,
    emissiveMap: p.emissiveMap ?? null,
    roughness: p.shininess !== undefined ? Math.min(1, Math.max(0.3, 1 - p.shininess / 100)) : 0.8,
    metalness: 0,
    transparent: m.transparent,
    opacity: m.opacity,
    alphaTest: m.alphaTest,
    side: m.side,
  })
  if (s.map) s.map.colorSpace = three.SRGBColorSpace
  return s
}

async function exportGlb(root: Object3D, animations: import("three").AnimationClip[]): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js")
  root.updateMatrixWorld(true)
  const out = await new GLTFExporter().parseAsync(root, { binary: true, animations })
  if (!(out instanceof ArrayBuffer)) throw new Error("L'exportador no ha tornat un .glb.")
  return out
}
