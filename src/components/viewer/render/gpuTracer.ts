import { AUX_SAMPLES, type EngineEvents, type RenderEngine, type RenderJob } from "./engine"
import { GpuLimitError, packGpuScene, type GpuScene } from "./gpuScene"
import { TRACER_WGSL } from "./gpuTracer.wgsl"
import { lightSetup } from "./lights"
import { estimateSceneKey } from "./estimate"
import { DIRECT_CLAMP, BUMP_STRENGTH, GLASS_SHADOW, INDIRECT_CLAMP, PATH_ROUGHNESS } from "./shading"

/**
 * Path tracer per GPU (WebGPU, compute shaders): el mateix algorisme que el de CPU, amb
 * l'escena en buffers d'emmagatzematge (`gpuScene`). Acumula a la GPU per tandes de files
 * (cadascuna de menys de ~30 ms, perquè la pàgina no s'encalli; se'n deixen dues a la cua perquè
 * la GPU no s'esperi) i, de tant en tant, en acabar una passada sencera, torna les sumes al diàleg
 * (el mateix contracte que la CPU) sense aturar el càlcul.
 */

/** Tandes enviades a la GPU abans d'esperar-ne la primera. */
const IN_FLIGHT = 2
const PARAMS_BYTES = 18 * 16
/** Constants de WebGPU (els tipus del DOM de TypeScript no les porten). */
const U = { MAP_READ: 0x1, COPY_SRC: 0x4, COPY_DST: 0x8, UNIFORM: 0x40, STORAGE: 0x80 } as const
const MAP_MODE_READ = 0x1

let support: Promise<string | null> | null = null

/** `null` si hi ha WebGPU; si no, el motiu (en català). */
export function gpuSupport(): Promise<string | null> {
  support ??= (async () => {
    try {
      if (!("gpu" in navigator) || !navigator.gpu) return "Aquest navegador no té WebGPU."
      const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" })
      return a ? null : "No s'ha trobat cap GPU compatible amb WebGPU."
    } catch (e) {
      return `WebGPU no funciona: ${String(e)}`
    }
  })()
  return support
}

export class GpuEngine implements RenderEngine {
  readonly kind = "gpu" as const
  label = "GPU"
  private device: GPUDevice
  private pipeline: GPUComputePipeline
  private bind: GPUBindGroup
  private params: GPUBuffer
  private accum: GPUBuffer
  private auxBuf: GPUBuffer
  private buffers: GPUBuffer[]
  private job: RenderJob
  private ev: EngineEvents
  private gs: GpuScene
  private focus = 0
  /** Llum típica de l'escena (màxims de les ateses). */
  key = 0.3
  private running = false
  private disposed = false
  private loopPromise: Promise<void> | null = null
  /** Cada `resume` comença un bucle nou (encadenat a l'anterior); els d'abans en surten. */
  private gen = 0
  // Progrés.
  private count = 0
  private cursor = 0
  private rows = 16
  private spp = 1
  private sppNext = 1
  private prevRows = 0
  private prevDt = 0
  /** Cada tanda té un cost fix gran (GPU per programari): passades senceres. */
  private fixedCost = false
  private auxSamples = 0
  private auxRaw: Float32Array | null = null
  private auxRawSamples = 0
  private color: Float32Array
  private lastRead = 0
  private readMs = 0
  /** Buffers de lectura (es reaprofiten; el de les AOV es treu quan ja no canvien). */
  private colorStage: GPUBuffer | null = null
  private auxStage: GPUBuffer | null = null
  private reading: Promise<void> | null = null
  /** Passades de l'última lectura enviada al diàleg. */
  private readCount = 0
  private seed = (Math.random() * 2 ** 31) >>> 0

  private constructor(device: GPUDevice, pipeline: GPUComputePipeline, job: RenderJob, ev: EngineEvents, gs: GpuScene) {
    this.device = device
    this.pipeline = pipeline
    this.job = job
    this.ev = ev
    this.gs = gs
    const { w, h } = job
    const mk = (data: ArrayBufferView & { byteLength: number }) => {
      const b = device.createBuffer({ size: Math.max(16, Math.ceil(data.byteLength / 16) * 16), usage: U.STORAGE | U.COPY_DST })
      device.queue.writeBuffer(b, 0, data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)
      return b
    }
    const tris = mk(gs.tris), nodes = mk(gs.nodes), info = mk(gs.info), texels = mk(gs.texels), env = mk(gs.env)
    this.accum = device.createBuffer({ size: w * h * 16, usage: U.STORAGE | U.COPY_SRC | U.COPY_DST })
    this.auxBuf = device.createBuffer({ size: w * h * 24, usage: U.STORAGE | U.COPY_SRC | U.COPY_DST })
    this.params = device.createBuffer({ size: PARAMS_BYTES, usage: U.UNIFORM | U.COPY_DST })
    this.buffers = [tris, nodes, info, texels, env, this.accum, this.auxBuf, this.params]
    this.bind = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [this.params, tris, nodes, info, texels, env, this.accum, this.auxBuf].map((buffer, binding) => ({ binding, resource: { buffer } })),
    })
    this.color = new Float32Array(w * h * 4)
    this.rows = Math.min(h, 16)
  }

  /** Prepara la GPU i l'escena; llança un error (en català) si no es pot. */
  static async create(job: RenderJob, ev: EngineEvents): Promise<GpuEngine> {
    const why = await gpuSupport()
    if (why) throw new Error(why)
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" })
    if (!adapter) throw new Error("No s'ha trobat cap GPU compatible amb WebGPU.")
    const lim = adapter.limits
    const device = await adapter.requestDevice({
      requiredLimits: { maxStorageBufferBindingSize: lim.maxStorageBufferBindingSize, maxBufferSize: lim.maxBufferSize },
    })
    const fail = (e: unknown): never => {
      device.destroy()
      throw e
    }
    const maxBinding = Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize)
    let gs: GpuScene
    try {
      gs = packGpuScene(job.scene, job.env, maxBinding)
    } catch (e) {
      return fail(e)
    }
    if (job.w * job.h * 24 > maxBinding) fail(new GpuLimitError(`La imatge és massa gran per a aquesta GPU (${job.w} × ${job.h} px).`))
    device.pushErrorScope("validation")
    device.pushErrorScope("out-of-memory")
    const module = device.createShaderModule({ code: TRACER_WGSL, label: "path tracer" })
    const info = await module.getCompilationInfo()
    const errs = info.messages.filter((m) => m.type === "error")
    if (errs.length) fail(new Error(`Error del shader: ${errs.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join("; ")}`))
    let pipeline: GPUComputePipeline
    try {
      pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } })
    } catch (e) {
      return fail(new Error(`No s'ha pogut preparar la GPU: ${String(e)}`))
    }
    let est: { key: number; focus: number }
    try {
      est = await estimateSceneKey(job)
    } catch (e) {
      return fail(e)
    }
    const engine = new GpuEngine(device, pipeline, job, ev, gs)
    engine.key = est.key
    // L'enfocament, del worker (com a la CPU: salta els retalls de les fulles).
    engine.focus = est.focus
    const oom = await device.popErrorScope()
    const val = await device.popErrorScope()
    if (oom || val) {
      engine.dispose()
      throw new Error(oom ? "La GPU no té prou memòria per a aquest render." : `Error de la GPU: ${val!.message}`)
    }
    if (gs.texHalvings) console.info(`[gpu] textures reduïdes ${2 ** gs.texHalvings}× per cabre a la GPU`)
    const ai = adapter.info
    engine.label = `GPU${ai?.description || ai?.vendor ? ` · ${ai.description || ai.vendor}` : ""}`
    device.lost.then((l) => {
      if (engine.disposed) return
      engine.running = false
      ev.onError(`S'ha perdut la GPU (${l.message || l.reason}).`)
    })
    device.onuncapturederror = (e) => {
      if (engine.disposed) return
      engine.running = false
      ev.onError(`Error de la GPU: ${e.error.message}`)
    }
    return engine
  }

  resume() {
    if (this.running || this.disposed) return
    this.running = true
    const g = ++this.gen
    // El bucle d'abans (si encara no ha sortit) acaba primer: mai n'hi ha dos alhora.
    const prev = this.loopPromise ?? Promise.resolve()
    this.loopPromise = prev.then(() => this.loop(g)).catch((e: unknown) => {
      if (!this.disposed && this.gen === g) {
        this.running = false
        this.ev.onError(`Error de la GPU: ${String(e)}`)
      }
    })
  }

  pause() {
    this.running = false
    this.gen++
  }

  dispose() {
    this.running = false
    this.disposed = true
    this.gen++
    void Promise.allSettled([this.loopPromise, this.reading]).finally(() => {
      for (const b of this.buffers) b.destroy()
      this.colorStage?.destroy()
      this.auxStage?.destroy()
      this.device.destroy()
    })
  }

  private writeParams(y0: number, rows: number) {
    const { job, gs } = this
    const s = job.scene, o = job.opts, c = s.camera, m = c.matrix
    const L = lightSetup(s, o, job.env)
    const buf = new ArrayBuffer(PARAMS_BYTES)
    const f = new Float32Array(buf), u = new Uint32Array(buf)
    f.set(m.slice(0, 16), 0)
    f.set([c.scale, c.aspect, c.ortho ? 1 : 0, (o.aperture ?? 0) / 1000], 16)
    f.set([this.focus, job.w, job.h, y0], 20)
    f.set([...L.sunDir, L.sunCosMax], 24)
    f.set([...L.sunCol, L.sunA2], 28)
    f.set([...s.background, s.daylight ? 1 : 0], 32)
    f.set([o.skyIntensity, (o.envRotation ?? 0) / 360, gs.envTotal, BUMP_STRENGTH], 36)
    f.set([INDIRECT_CLAMP * this.key, DIRECT_CLAMP * this.key, PATH_ROUGHNESS, GLASS_SHADOW], 40)
    u.set([this.spp, this.count, o.bounces, this.count < AUX_SAMPLES ? 1 : 0], 44)
    u.set([L.neeMode, gs.portalCount, job.env ? 1 : 0, gs.triCount], 48)
    u.set([gs.matOff, gs.texOff, gs.bevelOff, gs.portalOff], 52)
    u.set([gs.envW, gs.envH, gs.envMarginal, gs.envConditional], 56)
    u.set([this.seed, rows, 2 ** gs.texHalvings, 0], 60)
    f.set([L.lampScale, gs.emitTotal || 1, 0, 0], 64)
    u.set([gs.emitOff, gs.emitCount, 0, 0], 68)
    this.device.queue.writeBuffer(this.params, 0, buf)
  }

  /** Mida de les tandes segons el que ha tardat l'última (`dt`, ms; `rows` files). */
  private adapt(rows: number, dt: number) {
    const { h } = this.job
    // Tandes de ~10–30 ms: més files (o més mostres a la passada següent) si va de pressa.
    // Si partir la tanda no la fa més curta (una GPU per programari, amb un cost fix gran per
    // tanda), es fan passades senceres: la pàgina no hi guanyaria res.
    if (this.fixedCost) {
      this.rows = h
    } else if (rows === this.prevRows >> 1 && dt > this.prevDt * 0.75 && dt > 30) {
      this.fixedCost = true
      this.rows = h
    } else if (dt < 12) {
      if (this.rows < h) this.rows = Math.min(h, this.rows * 2)
      else this.sppNext = Math.min(32, this.sppNext * 2)
    } else if (dt > 30) {
      if (this.sppNext > 1 && this.rows >= h) this.sppNext = Math.max(1, this.sppNext >> 1)
      else this.rows = Math.max(8, this.rows >> 1)
    }
    this.prevRows = rows
    this.prevDt = dt
  }

  private async loop(g: number) {
    const { w, h } = this.job
    const dev = this.device
    const live = () => this.running && this.gen === g && !this.disposed
    // Tandes a la cua de la GPU: en esperar-ne una, la següent ja s'hi calcula.
    const queue: { done: Promise<void>; t0: number; rows: number; end: number }[] = []
    let lastEnd = 0
    const settle = async () => {
      const q = queue.shift()!
      await q.done
      // Temps de GPU de la tanda: des que ha acabat l'anterior (o des que s'ha enviat).
      this.adapt(q.rows, q.end - Math.max(q.t0, lastEnd))
      lastEnd = q.end
    }
    while (live()) {
      if (this.cursor === 0) {
        const lim = this.ev.limit()
        if (lim && this.count >= lim) {
          while (queue.length) await settle()
          await this.flushRead()
          if (this.gen === g && !this.disposed) {
            this.running = false
            this.ev.onStop?.()
          }
          return
        }
        this.spp = lim ? Math.max(1, Math.min(this.sppNext, lim - this.count)) : this.sppNext
      }
      const rows = Math.min(this.rows, h - this.cursor)
      this.writeParams(this.cursor, rows)
      const enc = dev.createCommandEncoder()
      const pass = enc.beginComputePass()
      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, this.bind)
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(rows / 8))
      pass.end()
      dev.queue.submit([enc.finish()])
      const rec = { done: Promise.resolve(), t0: performance.now(), rows, end: 0 }
      rec.done = dev.queue.onSubmittedWorkDone().then(() => {
        rec.end = performance.now()
      })
      queue.push(rec)
      this.cursor += rows
      if (this.cursor >= h) {
        this.cursor = 0
        if (this.count < AUX_SAMPLES) this.auxSamples += this.spp
        this.count += this.spp
        const lim = this.ev.limit()
        const now = performance.now()
        // La còpia va a la cua darrere d'aquesta passada: no cal esperar-la.
        if (now - this.lastRead >= Math.max(250, this.readMs * 4) || (lim && this.count >= lim) || this.count <= 2) this.startRead()
      }
      // Amb una GPU per programari (passades senceres), d'una en una: si no, el navegador no
      // troba mai la GPU lliure per pintar la pàgina.
      if (queue.length >= (this.fixedCost ? 1 : IN_FLIGHT)) await settle()
      if (this.disposed) return
    }
    // En aturar-se: el que s'ha fet fins a l'última passada sencera va al diàleg.
    while (queue.length) await settle()
    if (!this.disposed) await this.flushRead()
  }

  /** Espera la lectura en curs i, si queden passades per enviar al diàleg, en fa una altra. */
  private async flushRead() {
    if (this.reading) await this.reading
    if (this.disposed || this.readCount === this.count) return
    this.startRead()
    if (this.reading) await this.reading
  }

  /** Copia les sumes a la memòria del processador (sense esperar) i, quan hi són, les envia. */
  private startRead() {
    if (this.reading || this.disposed) return
    const dev = this.device
    const t0 = performance.now()
    const count = this.count
    const auxSamples = this.auxSamples
    // Les AOV només fins que ja no canvien (`AUX_SAMPLES`).
    const needAux = this.auxRawSamples !== auxSamples
    const cs = (this.colorStage ??= dev.createBuffer({ size: this.accum.size, usage: U.MAP_READ | U.COPY_DST }))
    const as = needAux ? (this.auxStage ??= dev.createBuffer({ size: this.auxBuf.size, usage: U.MAP_READ | U.COPY_DST })) : null
    const enc = dev.createCommandEncoder()
    enc.copyBufferToBuffer(this.accum, 0, cs, 0, this.accum.size)
    if (as) enc.copyBufferToBuffer(this.auxBuf, 0, as, 0, this.auxBuf.size)
    dev.queue.submit([enc.finish()])
    this.reading = (async () => {
      try {
        await Promise.all([cs.mapAsync(MAP_MODE_READ), as?.mapAsync(MAP_MODE_READ)])
      } catch {
        return
      }
      if (this.disposed) return
      this.color.set(new Float32Array(cs.getMappedRange()))
      cs.unmap()
      if (as) {
        ;(this.auxRaw ??= new Float32Array(this.job.w * this.job.h * 6)).set(new Float32Array(as.getMappedRange()))
        as.unmap()
        this.auxRawSamples = auxSamples
        if (auxSamples >= AUX_SAMPLES) {
          as.destroy()
          this.auxStage = null
        }
      }
      const now = performance.now()
      this.readMs = now - t0
      this.lastRead = now
      this.readCount = count
      this.ev.onProgress({ color: this.color, aux: this.auxRaw!, count, auxCount: Math.max(1, this.auxRawSamples) })
    })().finally(() => {
      this.reading = null
    })
  }
}
