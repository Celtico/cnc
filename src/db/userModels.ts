import { Box3, Vector3 } from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"
import type { OptimizeReport } from "../components/viewer/optimizeGlbPlan"
import { db, type UserModel } from "./db"

export type { UserModel }

/** Prefix dels ids dels models de l'usuari (`ModelObject.src`). */
export const USER_MODEL_PREFIX = "user-"
export const isUserModelSrc = (src: string): boolean => src.startsWith(USER_MODEL_PREFIX)

/** A partir d'aquí (bytes) s'avisa que pot anar feixuc a l'iPhone (no es bloqueja). */
export const HEAVY_MODEL_BYTES = 15 * 1024 * 1024

let loader: GLTFLoader | null = null

/** Mida (mm, w · h · d) d'un `.glb`: el glTF va en metres. Llença un error en català si no es pot llegir. */
export async function measureGlb(buffer: ArrayBuffer): Promise<[number, number, number]> {
  // Capçalera binària del glTF: «glTF» als 4 primers bytes.
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))
  if (String.fromCharCode(...head) !== "glTF") throw new Error("No és un fitxer .glb (glTF binari). Exporta'l com a .glb, amb les textures a dins.")
  loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  let scene
  try {
    scene = (await loader.parseAsync(buffer, "")).scene
  } catch {
    throw new Error("No s'ha pogut llegir el model: el .glb està malmès o fa servir textures externes.")
  }
  scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene)
  if (box.isEmpty()) throw new Error("El model no té cap malla: no es veuria res.")
  const s = box.getSize(new Vector3())
  // m → mm; mínim 1 mm (un model pla no pot tenir caixa zero).
  return [s.x, s.y, s.z].map((v) => Math.max(1, Math.round(v * 1000))) as [number, number, number]
}

const randomId = () => `${USER_MODEL_PREFIX}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`

/**
 * Importa un `.glb`: el valida, l'optimitza per al mòbil (`optimizeGlb`: triangles, textures 1K; si falla, l'original),
 * en mesura la caixa i el desa. Errors en català (`Error.message`). `report` diu què s'ha reduït.
 */
export async function addUserModel(file: File): Promise<{ model: UserModel; report: OptimizeReport }> {
  if (!/\.glb$/i.test(file.name)) throw new Error("Només es poden pujar fitxers .glb (glTF binari).")
  const original = await file.arrayBuffer()
  // Primer es valida l'original (missatges d'error clars) i després s'optimitza.
  let size = await measureGlb(original)
  const { optimizeGlb } = await import("../components/viewer/optimizeGlb")
  let { buffer, report } = await optimizeGlb(original)
  if (report.changed) {
    try {
      size = await measureGlb(buffer)
    } catch (e) {
      // L'optimitzat no es llegeix: es desa l'original.
      console.warn("addUserModel: el model optimitzat no es pot llegir, es desa l'original", e)
      buffer = original
      report = { ...report, trisAfter: report.trisBefore, bytesAfter: report.bytesBefore, texturesResized: 0, changed: false }
    }
  }
  const model: UserModel = {
    id: randomId(),
    name: file.name.replace(/\.glb$/i, "").trim() || "Model",
    blob: new Blob([buffer], { type: "model/gltf-binary" }),
    size,
    createdAt: Date.now(),
  }
  await db.models.add(model)
  return { model, report }
}

/** Desa un model tal com ve (p. ex. d'un `.moble`); si l'id ja hi és, es fa servir el que hi ha. `true` si l'ha afegit. */
export async function ensureUserModel(model: UserModel): Promise<boolean> {
  if (await db.models.get(model.id)) return false
  await db.models.add(model)
  return true
}

export function listUserModels(): Promise<UserModel[]> {
  return db.models.orderBy("createdAt").toArray()
}

export function getUserModel(id: string): Promise<UserModel | undefined> {
  return db.models.get(id)
}

export async function deleteUserModel(id: string): Promise<void> {
  await db.models.delete(id)
}
