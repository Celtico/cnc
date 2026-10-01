import { LOW_MEMORY } from "../deviceLimits"
import { AUX_SAMPLES, type EngineEvents, type RenderEngine, type RenderJob } from "./engine"

/** Memòria màxima per als buffers de tots els workers junts (bytes). */
const WORKER_BUFFER_BUDGET = LOW_MEMORY ? 256 * 2 ** 20 : 1536 * 2 ** 20

/**
 * Quants workers: un per nucli (menys un), com a molt 8 (2 a l'iPhone, on cada procés amb una
 * còpia de l'escena fa que iOS tanqui la pàgina) i els que hi càpiguen a `budget` amb els seus
 * buffers (color i AOV: 40 bytes per píxel). Les imatges grans van amb menys fils.
 */
export function cpuThreads(w: number, h: number, cores: number, lowMemory: boolean, budget = WORKER_BUFFER_BUDGET): number {
  const byCores = Math.min(lowMemory ? 2 : 8, (cores || 4) - 1)
  const byMemory = Math.floor(budget / Math.max(1, w * h * 40))
  return Math.max(1, Math.min(byCores, byMemory))
}

type PassMsg = { type: string; data: Float32Array; aux: Float32Array | null; auxMore: boolean }

/**
 * Motor per CPU: un `pathWorker` per nucli (cadascun amb la seva còpia de l'escena i el seu
 * BVH); cada passada (una mostra per píxel) se suma aquí i se'n tornen els buffers al worker.
 * Aturar no tanca els workers (continuar no torna a fer l'escena ni el BVH).
 */
export class CpuEngine implements RenderEngine {
  readonly kind = "cpu" as const
  private workers: Worker[] = []
  private color: Float32Array
  private aux: Float32Array
  private count = 0
  private auxCount = 0
  private running = false
  private readonly threads: number
  private job: RenderJob
  private ev: EngineEvents

  constructor(job: RenderJob, ev: EngineEvents) {
    this.job = job
    this.ev = ev
    this.color = new Float32Array(job.w * job.h * 4)
    this.aux = new Float32Array(job.w * job.h * 6)
    this.threads = cpuThreads(job.w, job.h, navigator.hardwareConcurrency, LOW_MEMORY)
  }

  get label() {
    return `CPU · ${this.threads} ${this.threads === 1 ? "fil" : "fils"}`
  }

  private reachedLimit() {
    const lim = this.ev.limit()
    return !!lim && this.count >= lim
  }

  private onPass(w: Worker, m: PassMsg) {
    const d = m.data
    if (m.type !== "pass" || !this.workers.includes(w) || d.length !== this.color.length) return
    // Les passades que arriben després del límit (dels altres workers) no es compten.
    if (!this.reachedLimit()) {
      const acc = this.color
      for (let q = 0; q < d.length; q++) acc[q]! += d[q]!
      const a = m.aux, ax = this.aux
      if (a && a.length === ax.length) {
        for (let q = 0; q < a.length; q++) ax[q]! += a[q]!
        this.auxCount++
      }
      this.count++
      this.ev.onProgress({ color: this.color, aux: this.aux, count: this.count, auxCount: this.auxCount })
      if (this.reachedLimit()) {
        this.pause()
        this.ev.onStop?.()
      }
    }
    const back = m.auxMore && m.aux ? m.aux : undefined
    w.postMessage({ type: "buffers", data: d, aux: back }, back ? [d.buffer, back.buffer] : [d.buffer])
  }

  resume() {
    if (this.running) return
    if (this.reachedLimit()) {
      this.ev.onStop?.()
      return
    }
    this.running = true
    if (this.workers.length) {
      for (const w of this.workers) w.postMessage({ type: "resume" })
      return
    }
    const { job } = this
    const auxPasses = Math.ceil(AUX_SAMPLES / this.threads)
    for (let i = 0; i < this.threads; i++) {
      const w = new Worker(new URL("./pathWorker.ts", import.meta.url), { type: "module" })
      w.onmessage = (e: MessageEvent<PassMsg>) => this.onPass(w, e.data)
      w.onerror = (ev) => this.ev.onError(ev.message || "Error en el render")
      w.postMessage({ type: "scene", scene: job.scene, width: job.w, height: job.h, seed: (Math.random() * 2 ** 31) | 0, opts: job.opts, env: job.env, auxPasses })
      this.workers.push(w)
    }
  }

  pause() {
    this.running = false
    for (const w of this.workers) w.postMessage({ type: "stop" })
  }

  dispose() {
    this.running = false
    for (const w of this.workers) w.terminate()
    this.workers = []
  }
}
