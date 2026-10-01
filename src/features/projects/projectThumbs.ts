import { buildComposition } from "../../core/build/buildComposition"
import type { Composition, MaterialPref } from "../../core/model"
import { releaseThumbRenderer, renderThumb, THUMB_VERSION } from "../../components/viewer/thumbRenderer"
import { preloadModels } from "../../components/viewer/models3d"
import { compositionOf } from "../../db/compositionStore"
import { db, type Project } from "../../db/db"

/**
 * Cua de miniatures 3D dels mobles i objectes: es fan d'una en una quan el navegador està lliure i es desen
 * al projecte (`thumb`, amb `thumbAt` = l'`updatedAt` que retraten). Si el moble canvia, es torna a fer.
 */
const queue: { id: number | string; run: () => Promise<void> }[] = []
const pending = new Set<number | string>()
let running = false

export function needsThumb(p: Project): boolean {
  return !p.thumb || p.thumbAt !== p.updatedAt || p.thumbV !== THUMB_VERSION
}

export function requestProjectThumb(p: Project, materials: MaterialPref[]): void {
  if (!needsThumb(p) || pending.has(p.id)) return
  pending.add(p.id)
  queue.push({
    id: p.id,
    run: async () => {
      const fresh = await db.projects.get(p.id)
      if (!fresh || !needsThumb(fresh)) return
      const comp = compositionOf(fresh)
      const build = buildComposition(comp)
      await preloadModels(build.models)
      const url = renderThumb([...build.panels, ...build.extras], materials, comp.scene, comp.references, build.models)
      if (url) await db.projects.update(p.id, { thumb: url, thumbAt: fresh.updatedAt, thumbV: THUMB_VERSION })
    },
  })
  void drain()
}

/**
 * Plantilles (catàleg de botiga, objectes): la miniatura es fa igual però només es guarda en memòria mentre
 * l'app és oberta (no són dades de l'usuari). `onDone` rep la imatge quan és feta.
 */
const templateThumbs = new Map<string, string>()
export function templateThumb(id: string): string | undefined {
  return templateThumbs.get(id)
}
export function requestTemplateThumb(id: string, make: () => Composition, materials: MaterialPref[], onDone: (url: string) => void): void {
  const hit = templateThumbs.get(id)
  if (hit) return onDone(hit)
  const key = `t:${id}`
  if (pending.has(key)) return
  pending.add(key)
  queue.push({
    id: key,
    run: async () => {
      const build = buildComposition(make())
      await preloadModels(build.models)
      const url = renderThumb([...build.panels, ...build.extras], materials, undefined, [], build.models)
      if (url) {
        templateThumbs.set(id, url)
        onDone(url)
      }
    },
  })
  void drain()
}

/** Afegeix una feina a la cua comuna de miniatures (una cada cop; `key` evita repetir-la). */
export function enqueueThumb(key: string, run: () => Promise<void>): void {
  if (pending.has(key)) return
  pending.add(key)
  queue.push({ id: key, run })
  void drain()
}

const idle = () =>
  new Promise<void>((resolve) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 500 })
    else setTimeout(resolve, 60)
  })

async function drain() {
  if (running) return
  running = true
  try {
    while (queue.length) {
      const job = queue.shift()!
      await idle()
      try {
        await job.run()
      } catch {
        /* una miniatura que no surt no ha d'aturar les altres */
      }
      pending.delete(job.id)
    }
  } finally {
    running = false
    releaseThumbRenderer()
  }
}
