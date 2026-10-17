import { useCallback, useEffect, useRef, useState } from "react"
import type { CameraPose, Composition } from "../../core/model"
import type { ViewName } from "../../components/viewer/viewNames"
import { saveProjectCamera } from "../../db/compositionStore"
import type { useEditorDoc } from "./useEditorDoc"

/** La càmera del 3D: on és (es desa a part i és un pas de desfer), enquadrar i des de quin costat. */
export function useEditorCamera({ projectId, initial, setDoc, histCam }: { projectId: number; initial: Composition; setDoc: ReturnType<typeof useEditorDoc>["setDoc"]; histCam: CameraPose | undefined }) {
  // Tornar a enquadrar la càmera (editar ja no la mou).
  const [fitKey, setFitKey] = useState(0)
  // Última càmera del 3D: es desa a part (sense «Modificat» ni desfer) i el visor hi torna en obrir-se.
  const cameraRef = useRef(initial.camera)
  const saveCamera = useCallback(
    (c: CameraPose) => {
      cameraRef.current = c
      void saveProjectCamera(projectId, c)
      // Un pas de desfer (sense ajuntar-lo amb un canvi del moble).
      setDoc((h) => ({ ...h, cam: c }), { group: `cam-${Date.now()}` })
    },
    [projectId, setDoc],
  )
  // Desfer/refer que torna una càmera d'abans: el visor hi va i es desa.
  const [cameraGoto, setCameraGoto] = useState<{ pose: CameraPose; n: number } | null>(null)
  useEffect(() => {
    if (!histCam || histCam === cameraRef.current) return
    cameraRef.current = histCam
    void saveProjectCamera(projectId, histCam)
    setCameraGoto((g) => ({ pose: histCam, n: (g?.n ?? 0) + 1 }))
  }, [histCam, projectId])
  // El botó d'enquadrar surt marcat mentre la càmera és a l'enquadrament.
  const [framed, setFramed] = useState(true)
  // Costat des d'on enquadra la càmera (null = el 3/4 d'«Enquadrar»). Triar una vista compta com «Enquadrar»: la càmera
  // hi va (perspectiva, es pot girar després) i es desa com qualsevol altra.
  const [viewDir, setViewDir] = useState<ViewName | null>(null)
  const frameFrom = (dir: ViewName | null) => {
    setViewDir(dir)
    setFitKey((k) => k + 1)
  }
  // Anar a un avís (per decisió de l'usuari, 2026-10-17): la càmera hi vola i les peces de l'avís es marquen (la resta,
  // translúcida) fins que es tria una altra cosa. `sel`: la selecció que s'hi ha fet (si canvia, el marcatge es treu).
  const [cameraFly, setCameraFly] = useState<{ pose: CameraPose; n: number } | null>(null)
  const [alert, setAlert] = useState<{ panels: ReadonlySet<string>; sel: string } | null>(null)
  const focusAlert = (panels: ReadonlySet<string>, pose: CameraPose | null, sel: string) => {
    setAlert({ panels, sel })
    if (pose) {
      setViewDir(null)
      setCameraFly((f) => ({ pose, n: (f?.n ?? 0) + 1 }))
    }
  }
  return { fitKey, cameraRef, saveCamera, cameraGoto, framed, setFramed, viewDir, frameFrom, cameraFly, alert, focusAlert, clearAlert: () => setAlert(null) }
}

export type EditorCamera = ReturnType<typeof useEditorCamera>
