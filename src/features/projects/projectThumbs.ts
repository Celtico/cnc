import { buildComposition } from "../../core/build/buildComposition"
import { cameraSignature, thumbIsStale, viewerSize, type CameraPose, type Composition, type MaterialPref } from "../../core/model"
import { releaseThumbRenderer, renderThumb, THUMB_VERSION } from "../../components/viewer/thumbRenderer"
import { photoTexturesIdle, photoTexturesPending } from "../../components/viewer/textures"
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
  return thumbIsStale(p, p.updatedAt, THUMB_VERSION, p.composition?.camera)
}

/**
 * La càmera desada al visor (relativa al moble centrat, `viewerSize`) passada a l'escena de la miniatura, que
 * té les peces on són a la composició (mm → m, sense centrar).
 */
export function thumbPose(comp: Composition): CameraPose | undefined {
  const c = comp.camera
  if (!c) return undefined
  const s = viewerSize(comp)
  const dx = s.width / 2000, dz = s.depth / 2000
  const shift = (v: CameraPose["position"]): CameraPose["position"] => [v[0] + dx, v[1], v[2] + dz]
  return { ...c, position: shift(c.position), target: shift(c.target) }
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
      // Si un model 3D no s'ha pogut carregar, no es fa (ni es desa): sortiria sense la planta per sempre.
      if (!(await preloadModels(build.models))) return
      const pose = thumbPose(comp)
      const draw = () => renderThumb([...build.panels, ...build.extras], materials, comp.scene, comp.references, build.models, pose)
      let url = draw()
      // Textures de foto que encara es baixaven: es torna a pintar quan hi són.
      if (photoTexturesPending()) {
        await photoTexturesIdle()
        url = draw()
      }
      // Sense tocar `updatedAt` ni `edited`. `thumbCam` és la de la fila (la que mira `needsThumb`).
      const cam = cameraSignature(fresh.composition?.camera)
      if (url) await db.projects.update(p.id, { thumb: url, thumbAt: fresh.updatedAt, thumbV: THUMB_VERSION, thumbCam: cam })
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
      if (!(await preloadModels(build.models))) return
      const draw = () => renderThumb([...build.panels, ...build.extras], materials, undefined, [], build.models)
      let url = draw()
      if (photoTexturesPending()) {
        await photoTexturesIdle()
        url = draw()
      }
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
