import { useEffect, useRef, useState, type RefObject } from "react"
import { useLatest } from "../../../lib/useLatest"
import { LOW_MEMORY } from "../deviceLimits"
import { aimBackdrop, type BackdropKind, type Panorama } from "./backdrops"
import { CpuEngine } from "./cpuEngine"
import type { EngineKind, RenderEngine, RenderJob, RenderProgress } from "./engine"
import { GpuLimitError } from "./gpuScene"
import { GpuEngine } from "./gpuTracer"
import { FORMATS, LOW_MEMORY_MAX, RESOLUTIONS, saveEngine, savedEngine, type Format, type Job, type RenderSource, type Resolution, type SceneGetter } from "./renderConfig"
import { extractScene, photoCamera, type RenderOpts, type RenderRoom } from "./sceneData"
import type { RenderOutput } from "./useRenderOutput"
import type { RenderSettings } from "./useRenderSettings"

/**
 * El motor del Render (GPU o CPU): començar, tornar a començar, aturar i continuar, i el pas a CPU si la GPU falla.
 * `job` i `source` són de qui crida (també els llegeix el dibuix, `useRenderOutput`).
 */
export function useRenderEngine({ getScene, settings, pano, job, source, output, setNotice }: { getScene: SceneGetter; settings: RenderSettings; pano: { kind: BackdropKind; p: Panorama } | null; job: RefObject<Job | null>; source: RefObject<RenderSource | null>; output: RenderOutput; setNotice: (n: string | null) => void }) {
  const { opts, res, room, format } = settings
  const [passes, setPasses] = useState(0)
  const [running, setRunning] = useState(false)
  /** S'ha començat el render (fins llavors no es calcula res). */
  const [begun, setBegun] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [engineKind, setEngineKind] = useState<EngineKind>(() => savedEngine() ?? "gpu")
  /** Motiu pel qual no hi ha GPU (`undefined` mentre es mira). */
  const [gpuWhy, setGpuWhy] = useState<string | null | undefined>(undefined)
  /** La GPU ha fallat en aquest diàleg (motiu; si era per la mida, només a aquesta resolució). */
  const [gpuFailed, setGpuFailed] = useState<{ why: string; res: Resolution | null } | null>(null)
  const [engineLabel, setEngineLabel] = useState("")
  const envRef = useLatest(settings.env)
  const panoRef = useLatest(pano)
  const limitRef = useLatest(settings.limit)
  const engineRef = useRef<RenderEngine | null>(null)
  /** Cada render nou: els avisos dels motors d'abans s'ignoren. */
  const token = useRef(0)
  /** Què s'ha començat a calcular l'últim cop (per no tornar a començar el mateix). */
  const lastRun = useRef<{ o: RenderOpts; r: Resolution; kind: EngineKind; env: unknown; pano: unknown; room?: RenderRoom; format?: Format } | null>(null)
  const gpuFailedNow = gpuFailed && (!gpuFailed.res || gpuFailed.res === res) ? gpuFailed.why : null
  const effectiveKind: EngineKind = engineKind === "gpu" && gpuWhy === null && !gpuFailedNow ? "gpu" : "cpu"

  const disposeEngine = () => {
    token.current++
    engineRef.current?.dispose()
    engineRef.current = null
    setRunning(false)
    setPreparing(false)
  }

  /** Torna a començar el càlcul (en començar o en canviar el motor, la qualitat o la llum). */
  const restart = (o: RenderOpts, r: Resolution, kind: EngineKind) => {
    const src = source.current
    if (!src) return
    disposeEngine()
    const my = token.current
    const R = RESOLUTIONS[r]
    // El costat llarg segons la resolució; l'altre, segons el format.
    const L = Math.min(LOW_MEMORY ? LOW_MEMORY_MAX : R.max, R.max, Math.round(src.long * R.k))
    const w = src.aspect >= 1 ? L : Math.round(L * src.aspect)
    const h = src.aspect >= 1 ? Math.round(L / src.aspect) : L
    // Les sumes són les del motor: s'hi assignen amb el primer progrés (no es reserva res aquí).
    const j: Job = { w, h, accum: new Float32Array(0), aux: new Float32Array(0), count: 0, auxCount: 0 }
    job.current = j
    lastRun.current = { o, r, kind, env: envRef.current?.env ?? null, pano: panoRef.current, room: src.room, format: src.format }
    output.resetDenoise()
    setPasses(0)
    // eslint-disable-next-line react/purity -- dins de `restart`, no durant el render (fals positiu per la crida recursiva)
    setStartedAt(Date.now())
    setElapsed(0)
    setError(null)
    // La càmera de fotògraf (verticals rectes, focal) es fa aquí: l'escena extreta és la del visor.
    // Vista per les finestres (ambients): el panorama com una textura més (`backdrops.ts`).
    const camera = photoCamera(src.scene.camera, o)
    const P = panoRef.current
    const view = src.scene.daylight && P && P.kind === (o.view ?? "garden") ? aimBackdrop(P.p, camera, o.envRotation) : null
    const scene = { ...src.scene, camera, ...(view ? { textures: [...src.scene.textures, view], backdrop: src.scene.textures.length } : {}) }
    const data: RenderJob = { scene, env: envRef.current?.env ?? null, opts: o, w, h }
    // La GPU ha fallat: es fa per CPU i no s'hi torna (fins que es torni a obrir el diàleg, o
    // en canviar de resolució si el problema era la mida).
    const gpuFallback = (message: string, sizeLimit: boolean) => {
      setGpuFailed({ why: message, res: sizeLimit ? r : null })
      setNotice(`${message} Es fa per CPU.`)
      restart(o, r, "cpu")
    }
    const events = {
      onProgress: (p: RenderProgress) => {
        if (token.current !== my || job.current !== j) return
        j.accum = p.color
        j.aux = p.aux
        j.count = p.count
        j.auxCount = p.auxCount
        setPasses(p.count)
        output.scheduleDenoise()
        output.requestDraw()
      },
      onError: (message: string) => {
        if (token.current !== my) return
        // La GPU ha fallat (memòria, s'ha perdut…): es fa per CPU.
        if (engineRef.current?.kind === "gpu") {
          gpuFallback(message, false)
        } else {
          disposeEngine()
          setError(message)
        }
      },
      limit: () => limitRef.current,
      onStop: () => {
        if (token.current !== my) return
        setRunning(false)
        output.scheduleDenoise(true)
      },
    }
    const run = (e: RenderEngine) => {
      engineRef.current = e
      setEngineLabel(e.label)
      setPreparing(false)
      setRunning(true)
      e.resume()
    }
    if (kind === "gpu") {
      setPreparing(true)
      setEngineLabel("GPU")
      GpuEngine.create(data, events).then(
        (e) => (token.current === my ? run(e) : e.dispose()),
        (err: unknown) => {
          if (token.current !== my) return
          gpuFallback(err instanceof Error ? err.message : String(err), err instanceof GpuLimitError)
        },
      )
    } else run(new CpuEngine(data, events))
  }

  /** Passa l'escena del visor a dades per als motors. */
  const extract = (r: RenderRoom, f: Format = format): boolean => {
    const got = getScene()
    if (!got) {
      setNotice("El visor 3D encara no està a punt: torna-ho a provar d'aquí a un moment.")
      return false
    }
    try {
      const aspect = FORMATS[f].r || got.width / got.height
      const scene = extractScene(got.scene, got.camera, aspect, r)
      source.current = { scene, aspect, long: Math.max(got.width, got.height), room: r, format: f }
      return true
    } catch (e) {
      setNotice(`No s'ha pogut preparar l'escena: ${String(e)}`)
      return false
    }
  }

  /** «Començar»: ara sí, es prepara l'escena i es calcula. */
  const begin = () => {
    setNotice(null)
    setError(null)
    if (!source.current && !extract(room)) return
    setBegun(true)
    restart(opts, res, effectiveKind)
  }

  /** «De nou»: es torna a llegir l'escena (el moble pot haver canviat mentre era tancat) i es comença. */
  const startOver = () => {
    disposeEngine()
    source.current = null
    job.current = null
    setPasses(0)
    begin()
  }

  const toggle = () => {
    const e = engineRef.current
    // Sense motor (després d'un error): es torna a començar.
    if (!e) {
      begin()
      return
    }
    if (running) {
      e.pause()
      setRunning(false)
      // En aturar-se, el filtre de soroll amb totes les passades (els motors en poden enviar una més).
      window.setTimeout(() => output.scheduleDenoise(true), 300)
    } else {
      setStartedAt(Date.now() - elapsed * 1000)
      setRunning(true)
      e.resume()
    }
  }

  /** Motor triat a «Qualitat» (es recorda entre sessions). */
  const chooseEngine = (k: EngineKind) => {
    setEngineKind(k)
    saveEngine(k)
  }

  /** En obrir el diàleg (sense un render a mig fer): no es calcula res fins a «Començar». */
  const resetForOpen = () => {
    setError(null)
    setPasses(0)
    setBegun(false)
    setGpuFailed(null)
    lastRun.current = null
  }

  return { passes, running, begun, preparing, error, startedAt, elapsed, setElapsed, engineLabel, gpuWhy, setGpuWhy, gpuFailedNow, effectiveKind, engineRef, lastRun, disposeEngine, restart, extract, begin, startOver, toggle, chooseEngine, resetForOpen }
}

export type RenderEngineState = ReturnType<typeof useRenderEngine>

/** Motor, qualitat i llum: un cop començat, es torna a començar (esperant una mica mentre s'arrossega). */
export function useAutoRestart(open: boolean, engine: RenderEngineState, { opts, res, room, format, env }: RenderSettings, pano: unknown, source: RefObject<RenderSource | null>) {
  const { begun, effectiveKind, extract, lastRun, engineRef, restart } = engine
  useEffect(() => {
    if (!open || !begun || !source.current) return
    const id = window.setTimeout(() => {
      if ((source.current?.room !== room || source.current?.format !== format) && !extract(room, format)) return
      // El mateix que ja s'ha començat (p. ex. en passar sol a CPU perquè la GPU ha fallat): res.
      const L = lastRun.current
      if (L && engineRef.current && L.o === opts && L.r === res && L.kind === effectiveKind && L.env === (env?.env ?? null) && L.pano === pano && L.room === room && L.format === format) return
      restart(opts, res, effectiveKind)
    }, 300)
    return () => window.clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- torna a començar quan canvien el motor, la qualitat o la llum; no en obrir
  }, [opts, res, room, format, env, pano, effectiveKind])
}

/** Els segons de càlcul (mentre calcula). */
export function useElapsedClock({ running, startedAt, setElapsed }: RenderEngineState) {
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [running, startedAt, setElapsed])
}
