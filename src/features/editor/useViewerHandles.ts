import { useCallback, useRef } from "react"
import { toaster } from "../../components/ui/toaster"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { downloadBlob, slugify } from "../../lib/download"

/** Accés al visor 3D des de fora: la imatge PNG (captura) i l'escena per al Render. */
export function useViewerHandles(name: string) {
  const capture = useRef<(() => Promise<Blob>) | null>(null)
  // Render (GPU o CPU): accés a l'escena del visor.
  const sceneGetter = useRef<SceneGetter | null>(null)
  const registerScene = useCallback((g: SceneGetter) => {
    sceneGetter.current = g
  }, [])
  const registerCapture = useCallback((fn: () => Promise<Blob>) => {
    capture.current = fn
  }, [])
  const downloadImage = async () => {
    if (!capture.current) return
    try {
      downloadBlob(await capture.current(), `${slugify(name)}.png`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar la imatge", description: String(e), type: "error" })
    }
  }
  return { sceneGetter, registerScene, registerCapture, downloadImage }
}
