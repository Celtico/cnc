import { LOW_MEMORY } from "../deviceLimits"
import type { EngineEvents, RenderEngine, RenderJob } from "./engine"

/**
 * Motor per CPU: un `pathWorker` per nucli (cadascun amb la seva còpia de l'escena i el seu
 * BVH); cada passada (una mostra per píxel) se suma aquí.
 */
export class CpuEngine implements RenderEngine {
  readonly kind = "cpu" as const
  private workers: Worker[] = []
  private color: Float32Array
  private aux: Float32Array
  private count = 0
  private readonly threads: number
  private job: RenderJob
  private ev: EngineEvents

  constructor(job: RenderJob, ev: EngineEvents) {
    this.job = job
    this.ev = ev
    this.color = new Float32Array(job.w * job.h * 4)
    this.aux = new Float32Array(job.w * job.h * 6)
    // Cada procés porta una còpia de l'escena: a l'iPhone, com a molt 2 (si no, iOS tanca la pàgina).
    this.threads = Math.max(1, Math.min(LOW_MEMORY ? 2 : 8, (navigator.hardwareConcurrency || 4) - 1))
  }

  get label() {
    return `CPU · ${this.threads} ${this.threads === 1 ? "fil" : "fils"}`
  }

  resume() {
    if (this.workers.length) return
    const { job } = this
    for (let i = 0; i < this.threads; i++) {
      const w = new Worker(new URL("./pathWorker.ts", import.meta.url), { type: "module" })
      w.onmessage = (e: MessageEvent<{ type: string; data: Float32Array; aux: Float32Array }>) => {
        if (e.data.type !== "pass" || !this.workers.includes(w) || e.data.data.length !== this.color.length) return
        const d = e.data.data, acc = this.color
        for (let q = 0; q < d.length; q++) acc[q]! += d[q]!
        const a = e.data.aux, ax = this.aux
        if (a && a.length === ax.length) for (let q = 0; q < a.length; q++) ax[q]! += a[q]!
        this.count++
        this.ev.onProgress({ color: this.color, aux: this.aux, count: this.count })
        const lim = this.ev.limit()
        if (lim && this.count >= lim) {
          this.pause()
          this.ev.onStop?.()
        }
      }
      w.onerror = (ev) => this.ev.onError(ev.message || "Error en el render")
      w.postMessage({ type: "scene", scene: job.scene, width: job.w, height: job.h, seed: (Math.random() * 2 ** 31) | 0, opts: job.opts, env: job.env })
      this.workers.push(w)
    }
  }

  pause() {
    for (const w of this.workers) w.terminate()
    this.workers = []
  }

  dispose() {
    this.pause()
  }
}
