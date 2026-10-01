import { useMemo } from "react"
import { toaster } from "../../components/ui/toaster"
import { forgetModel } from "../../components/viewer/models3d"
import { MODEL_ASSETS } from "../../core/model"
import { useLiveQuery } from "../../db/useLiveQuery"
import { addUserModel, deleteUserModel, HEAVY_MODEL_BYTES, listUserModels, type UserModel } from "../../db/userModels"

/** Un model que es pot triar: els de l'app (`MODEL_ASSETS`) i els pujats per l'usuari (`user`). Mida real en mm. */
export interface ModelChoice {
  id: string
  name: string
  size: [number, number, number]
  user?: true
  /** Bytes del `.glb` (només els de l'usuari). */
  bytes?: number
}

export const MODEL_UPLOAD_HELP = "Un fitxer .glb (glTF binari). De Blender: Fitxer › Exportar › glTF 2.0 (.glb). Les textures van a dins."

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

/** Puja un `.glb` amb els avisos (toaster): torna el model o `null` si no s'ha pogut. */
export async function uploadUserModel(file: File): Promise<ModelChoice | null> {
  try {
    const m = await addUserModel(file)
    forgetModel(m.id)
    if (file.size > HEAVY_MODEL_BYTES) {
      toaster.create({
        title: "Model pesat",
        description: `Fa ${formatBytes(file.size)}: a l'iPhone pot anar lent o no carregar-se. Redueix-lo (textures més petites, menys polígons).`,
        type: "warning",
        duration: 8000,
      })
    } else toaster.create({ title: `Model «${m.name}» afegit`, type: "success" })
    return modelChoiceOf(m)
  } catch (e) {
    toaster.create({ title: "No s'ha pogut pujar el model", description: e instanceof Error ? e.message : String(e), type: "error" })
    return null
  }
}

export async function removeUserModel(id: string): Promise<void> {
  await deleteUserModel(id)
  forgetModel(id)
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} kB`
}
