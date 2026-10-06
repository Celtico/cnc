import { useMemo } from "react"
import { forgetModel } from "../../components/viewer/models3d"
import { MODEL_ASSETS } from "../../core/model"
import { useLiveQuery } from "../../db/useLiveQuery"
import { deleteUserModel, listUserModels, type UserModel } from "../../db/userModels"

/** Un model que es pot triar: els de l'app (`MODEL_ASSETS`) i els pujats per l'usuari (`user`). Mida real en mm. */
export interface ModelChoice {
  id: string
  name: string
  size: [number, number, number]
  user?: true
  /** Bytes del `.glb` (només els de l'usuari). */
  bytes?: number
}

export const MODEL_UPLOAD_HELP = "Un .glb, un .gltf amb el .bin i les textures (fitxers, carpeta o .zip), un .fbx o el .zip tal com es baixa de Poly Haven (també el de Blender)."

const BUILTIN: ModelChoice[] = MODEL_ASSETS.map((a) => ({ id: a.id, name: a.name, size: a.size }))

/** Models disponibles (en viu: es refà en pujar-ne o esborrar-ne un) i `resolve(src)` per al nom i la mida real. */
export function useModelAssets(): { assets: ModelChoice[]; userModels: ModelChoice[]; resolve: (src: string) => ModelChoice | undefined } {
  const rows = useLiveQuery(() => listUserModels(), [])
  return useMemo(() => {
    const userModels: ModelChoice[] = (rows ?? []).map((m) => ({ id: m.id, name: m.name, size: m.size, user: true, bytes: m.blob.size }))
    const assets = [...BUILTIN, ...userModels]
    return { assets, userModels, resolve: (src: string) => assets.find((a) => a.id === src) }
  }, [rows])
}

export const modelChoiceOf = (m: UserModel): ModelChoice => ({ id: m.id, name: m.name, size: m.size, user: true, bytes: m.blob.size })

export async function removeUserModel(id: string): Promise<void> {
  await deleteUserModel(id)
  forgetModel(id)
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} kB`
}
