import { useCallback, useRef, useState } from "react"
import { sameCameraPose, type CameraPose } from "../../../core/model"
import { saveAmbientCamera } from "../../../db/db"
import { usePersistentFlag } from "../../../lib/usePersistentFlag"

/** La càmera del 3D: la darrera (desada), les d'abans (per tornar-hi) i el bloqueig. */
export function useCameraHistory(ambientId: number, initialCamera: CameraPose | undefined) {
  // Última càmera del 3D: es desa a part (sense tocar la data ni el desfer) i el 3D hi torna en obrir-se.
  const cameraRef = useRef(initialCamera)
  // Càmeres d'abans (per decisió de l'usuari: buscant l'enquadrament del render, un cop de ratolí la movia i es perdia):
  // «Càmera d'abans» hi torna; i es pot bloquejar (es recorda per ambient).
  const camPast = useRef<CameraPose[]>([])
  const [camBack, setCamBack] = useState(0)
  const [camGoto, setCamGoto] = useState<{ pose: CameraPose; n: number } | undefined>(undefined)
  const going = useRef(false)
  const [camLocked, setCamLocked] = usePersistentFlag(`mobles:ambient-camera-lock:${ambientId}`, false)
  const saveCamera = useCallback(
    (c: CameraPose) => {
      const prev = cameraRef.current
      if (prev && !going.current && !sameCameraPose(prev, c)) {
        camPast.current = [...camPast.current.slice(-29), prev]
        setCamBack(camPast.current.length)
      }
      going.current = false
      cameraRef.current = c
      void saveAmbientCamera(ambientId, c)
    },
    [ambientId],
  )
  const cameraBack = () => {
    const prev = camPast.current.pop()
    setCamBack(camPast.current.length)
    if (!prev) return
    going.current = true
    setCamGoto((g) => ({ pose: prev, n: (g?.n ?? 0) + 1 }))
  }
  return { cameraRef, camBack, camGoto, camLocked, setCamLocked, saveCamera, cameraBack }
}
