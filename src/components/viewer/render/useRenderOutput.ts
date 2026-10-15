import { useRef, useState, type RefObject } from "react"
import type { UNet } from "oidn-web"
import { useLatest } from "../../../lib/useLatest"
import { oidnDenoise, oidnFailed } from "./oidn"
import { paintRender } from "./paintRender"
import type { Job, Look, RenderSource } from "./renderConfig"
import { createDrawScheduler } from "./tonemap"

/**
 * La imatge del Render: el llenç, el dibuix (com a molt un per fotograma) i el filtre de soroll de les passades acumulades.
 * Llegeix la feina d'ara (`job`), l'escena (`source`, pel color del fons) i l'aspecte (`lookRef`).
 */
export function useRenderOutput(job: RefObject<Job | null>, source: RefObject<RenderSource | null>, lookRef: RefObject<Look>) {
  const canvas = useRef<HTMLCanvasElement>(null)
  // Filtre de soroll: un fil a part; el resultat val per a les passades amb què s'ha calculat.
  // `busy`: l'identificador de la petició en curs (0 = cap).
  // `oidn`: la xarxa d'Open Image Denoise si hi és (WebGPU + pesos); si no, l'À-Trous del worker.
  const dn = useRef<{ worker: Worker | null; busy: number; id: number; data: Float32Array | null; count: number; oidn: UNet | null; oidnNext: number }>({ worker: null, busy: 0, id: 0, data: null, count: 0, oidn: null, oidnNext: 4 })
  const [denoiser, setDenoiser] = useState<"oidn" | "atrous">("atrous")
  const img = useRef<ImageData | null>(null)

  const draw = () => {
    const j = job.current
    const c = canvas.current
    if (!j || !c || !j.count) return
    paintRender(c, j, lookRef.current, dn.current.data, source.current?.scene.background, img)
  }
  const drawRef = useLatest(draw)
  // Com a molt un dibuix per fotograma, i més espaiats si costen (imatges grans).
  const drawer = useRef<ReturnType<typeof createDrawScheduler> | null>(null)
  const requestDraw = () => {
    drawer.current ??= createDrawScheduler(() => drawRef.current())
    drawer.current.request()
  }

  /**
   * Filtra el soroll de les passades acumulades: À-Trous cada cop menys sovint (4, 8, 16…
   * passades) o, amb OIDN, a les 4, 16, 64, 256… passades i en aturar-se (`force`).
   */
  const scheduleDenoise = (force = false) => {
    const j = job.current
    const D = dn.current
    if (!j || !lookRef.current.denoise || D.busy || j.count < 2 || !j.auxCount) return
    const oidn = D.oidn
    if (oidn ? !force && j.count < D.oidnNext : !force && j.count < D.count * 1.5 + 2) return
    if (oidn && D.count === j.count && D.data) return
    if (!oidn) D.worker ??= new Worker(new URL("./denoiseWorker.ts", import.meta.url), { type: "module" })
    const n = j.w * j.h
    const color = new Float32Array(n * 3), albedo = new Float32Array(n * 3), normal = new Float32Array(n * 3)
    const k = 1 / j.count, ka = 1 / j.auxCount
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        color[i * 3 + c] = j.accum[i * 4 + c]! * k
        albedo[i * 3 + c] = j.aux[i * 6 + c]! * ka
      }
      const nx = j.aux[i * 6 + 3]!, ny = j.aux[i * 6 + 4]!, nz = j.aux[i * 6 + 5]!
      const l = Math.hypot(nx, ny, nz)
      if (l > 1e-6) {
        normal[i * 3] = nx / l; normal[i * 3 + 1] = ny / l; normal[i * 3 + 2] = nz / l
      }
    }
    const id = ++D.id
    D.busy = id
    const count = j.count
    if (oidn) {
      D.oidnNext = Math.max(4, count * 4)
      oidnDenoise(oidn, j.w, j.h, color, albedo, normal).then(
        (data) => {
          if (D.busy === id) D.busy = 0
          if (id !== D.id || job.current !== j) return scheduleDenoise()
          D.data = data
          D.count = count
          requestDraw()
        },
        (err: unknown) => {
          // La xarxa ha fallat: l'À-Trous de sempre.
          if (D.busy === id) D.busy = 0
          oidnFailed(err)
          D.oidn = null
          setDenoiser("atrous")
          scheduleDenoise(true)
        },
      )
      return
    }
    const worker = D.worker!
    worker.onmessage = (e: MessageEvent<{ id: number; data: Float32Array }>) => {
      // Només la resposta de la petició en curs l'allibera (les d'abans d'un reinici, també).
      if (e.data.id === D.busy) D.busy = 0
      if (e.data.id !== D.id || job.current !== j) {
        // D'un render d'abans: es demana la del d'ara (si n'hi ha prou passades).
        scheduleDenoise()
        return
      }
      D.data = e.data.data
      D.count = count
      requestDraw()
    }
    worker.postMessage({ id, w: j.w, h: j.h, color, albedo, normal, strength: Math.min(1, 1.6 / Math.sqrt(count)) }, [color.buffer, albedo.buffer, normal.buffer])
  }

  /** Un render nou: les respostes del filtre d'abans s'ignoren (la petició en curs, si n'hi ha, segueix ocupant-lo). */
  const resetDenoise = () => {
    dn.current.id++
    dn.current.data = null
    dn.current.count = 0
    dn.current.oidnNext = 4
  }

  return { canvas, dn, denoiser, setDenoiser, draw, requestDraw, scheduleDenoise, resetDenoise }
}

export type RenderOutput = ReturnType<typeof useRenderOutput>
