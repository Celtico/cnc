import { useEffect, useRef, useState, type RefObject } from "react"
import { gpuSupport } from "./gpuTracer"
import { oidnReady } from "./oidn"
import type { Job, RenderSource, SceneGetter } from "./renderConfig"
import type { RenderEngineState } from "./useRenderEngine"
import type { RenderOutput } from "./useRenderOutput"
import type { RenderSettings } from "./useRenderSettings"

/**
 * Obrir i tancar el diàleg: què es prepara en obrir-lo (la imatge del visor, si hi ha GPU i OIDN, la configuració) i què
 * s'allibera en tancar-lo o en sortir de la pàgina. Torna la imatge del visor de fons (abans de «Començar»).
 */
export function useRenderLifecycle({ open, getScene, saveKey, engine, output, settings, job, source, setNotice }: { open: boolean; getScene: SceneGetter; saveKey: string | undefined; engine: RenderEngineState; output: RenderOutput; settings: RenderSettings; job: RefObject<Job | null>; source: RefObject<RenderSource | null>; setNotice: (n: string | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null)
  const { engineRef, disposeEngine } = engine
  const { dn, draw } = output

  // Tancar-lo no el perd (per decisió de l'usuari, 2026-10-14: «fas un render, continues treballant, obres el render i el
  // desas, i fas un render nou»): el motor continua calculant amb el diàleg tancat (si estava aturat, es queda aturat) i,
  // en tornar-lo a obrir, hi és; «De nou» torna a començar amb el moble d'ara. Només s'allibera en sortir de la pàgina.
  const kept = useRef(false)
  useEffect(
    () => () => {
      disposeEngine()
      dn.current.worker?.terminate()
      dn.current.worker = null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- només en sortir de la pàgina (desmuntar): el motor i el filtre es llegeixen per refs
    [],
  )
  useEffect(() => {
    if (!open) return
    if (kept.current && engineRef.current) {
      kept.current = false
      // El llenç és nou (el diàleg s'ha tornat a muntar): s'hi torna a pintar el que hi havia.
      window.setTimeout(() => draw(), 0)
      return () => {
        // eslint-disable-next-line react-hooks/exhaustive-deps -- es vol el motor del moment de tancar (no el d'obrir)
        if (engineRef.current) kept.current = true
      }
    }
    kept.current = false
    // En obrir no es calcula res: només la imatge del visor de fons i si hi ha GPU.
    engine.resetForOpen()
    setNotice(null)
    try {
      setPreview(getScene()?.snapshot?.() ?? null)
    } catch {
      setPreview(null)
    }
    let alive = true
    void gpuSupport().then((why) => alive && engine.setGpuWhy(why))
    // Open Image Denoise si hi ha WebGPU i els pesos; si no, en silenci, l'À-Trous.
    const d = dn.current
    void oidnReady().then((u) => {
      if (!alive) return
      d.oidn = u
      output.setDenoiser(u ? "oidn" : "atrous")
    })
    settings.applyOpening(getScene, saveKey)
    return () => {
      alive = false
      // Començat: continua calculant amb el diàleg tancat (l'escena és la que es va llegir en començar: es pot continuar
      // treballant al moble) i, en tornar-lo a obrir, hi és. Sense començar, es buida.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- es vol el motor del moment de tancar (no el d'obrir)
      if (engineRef.current) {
        kept.current = true
        return
      }
      disposeEngine()
      d.worker?.terminate()
      d.worker = null
      d.busy = 0
      job.current = null
      source.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- es prepara en obrir el diàleg; l'escena i la configuració es llegeixen en aquell moment
  }, [open])

  return preview
}
