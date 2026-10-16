import { useCallback, useRef } from "react"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"

/** Accés al visor 3D des de fora: l'escena per al Render. */
export function useViewerHandles() {
  // Render (GPU o CPU): accés a l'escena del visor.
  const sceneGetter = useRef<SceneGetter | null>(null)
  const registerScene = useCallback((g: SceneGetter) => {
    sceneGetter.current = g
  }, [])
  return { sceneGetter, registerScene }
}
