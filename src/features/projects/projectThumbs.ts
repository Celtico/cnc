import { buildComposition } from "../../core/build/buildComposition"
import { cameraSignature, thumbIsStale, viewerSize, type CameraPose, type Composition, type MaterialPref } from "../../core/model"
import { releaseThumbRenderer, renderThumb, THUMB_VERSION } from "../../components/viewer/thumbRenderer"
import { photoTextureFailures, photoTexturesIdle, photoTexturesPending } from "../../components/viewer/textures"
import { preloadModels } from "../../components/viewer/models3d"
import { compositionOf } from "../../db/compositionStore"
import { db, type Project } from "../../db/db"

/**
 * Cua de miniatures 3D dels mobles i objectes: es fan d'una en una quan el navegador està lliure i es desen
 * al projecte (`thumb`, amb `thumbAt` = l'`updatedAt` que retraten). Si el moble canvia, es torna a fer.
 */
const queue: { id: number | string; run: () => Promise<void> }[] = []
const pending = new Set<number | string>()
/** Targetes que esperen cada feina: si ja no n'hi ha cap (s'han desmuntat), la feina se salta. */
const wanted = new Map<number | string, number>()
let running = false
/** El renderitzador s'allibera quan la cua fa 3 s que és buida (desplaçar una graella en demana més de seguida). */
const RELEASE_MS = 3000
let releaseTimer: ReturnType<typeof setTimeout> | undefined

/** Una targeta més vol la miniatura `key`; la funció que torna diu que ja no (en desmuntar-se). */
function want(key: number | string): () => void {
  wanted.set(key, (wanted.get(key) ?? 0) + 1)
  let done = false
  return () => {
    if (done) return
    done = true
    const n = (wanted.get(key) ?? 1) - 1
    if (n > 0) wanted.set(key, n)
    else wanted.delete(key)
  }
}

/**
 * Pinta la miniatura quan les fotos de textura ja hi són: el primer intent les comença a baixar (sense pintar,
 * `snapshot`) i es torna a fer quan s'acaben. `null` si no surt o si alguna foto ha fallat mentrestant (sortiria
 * negra i es desaria així).
 */
export async function drawWhenReady(draw: () => string | null): Promise<string | null> {
  const failures = photoTextureFailures()
  for (let i = 0; i < 4; i++) {
    const url = draw()
    if (photoTextureFailures() !== failures) return null
    if (url !== null || !photoTexturesPending()) return url
    await photoTexturesIdle()
    if (photoTextureFailures() !== failures) return null
  }
  return null
}

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

/** Demana la miniatura del moble; la funció que torna la cancel·la (si cap altra targeta la vol). */
export function requestProjectThumb(p: Project, materials: MaterialPref[]): () => void {
  if (!needsThumb(p)) return () => {}
  const release = want(p.id)
  if (pending.has(p.id)) return release
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
      // Quan hi són les textures de foto (si no, sortirien negres).
      const url = await drawWhenReady(() => renderThumb([...build.panels, ...build.extras], materials, comp.scene, comp.references, build.models, pose))
      // Sense tocar `updatedAt` ni `edited`. `thumbCam` és la de la fila (la que mira `needsThumb`).
      const cam = cameraSignature(fresh.composition?.camera)
      if (url) await db.projects.update(p.id, { thumb: url, thumbAt: fresh.updatedAt, thumbV: THUMB_VERSION, thumbCam: cam })
    },
  })
  void drain()
  return release
}

/**
 * Plantilles (catàleg de botiga, objectes): la miniatura es fa igual però només es guarda en memòria mentre
 * l'app és oberta (no són dades de l'usuari). `onDone` rep la imatge quan és feta.
 */
const templateThumbs = new Map<string, string>()
const templateListeners = new Map<string, Set<(url: string) => void>>()
export function templateThumb(id: string): string | undefined {
  return templateThumbs.get(id)
}
export function requestTemplateThumb(id: string, make: () => Composition, materials: MaterialPref[], onDone: (url: string) => void): () => void {
  const hit = templateThumbs.get(id)
  if (hit) {
    onDone(hit)
    return () => {}
  }
  const key = `t:${id}`
  const release = want(key)
  // Una altra targeta de la mateixa plantilla (la mateixa a dues categories): també rep la imatge.
  const listeners = (templateListeners.get(key) ?? new Set<(url: string) => void>())
  templateListeners.set(key, listeners)
  listeners.add(onDone)
  const cancel = () => {
    listeners.delete(onDone)
    release()
  }
  if (pending.has(key)) return cancel
  pending.add(key)
  queue.push({
    id: key,
    run: async () => {
      const build = buildComposition(make())
      if (!(await preloadModels(build.models))) return
      const url = await drawWhenReady(() => renderThumb([...build.panels, ...build.extras], materials, undefined, [], build.models))
      if (url) {
        templateThumbs.set(id, url)
        for (const f of templateListeners.get(key) ?? []) f(url)
      }
      templateListeners.delete(key)
    },
  })
  void drain()
  return cancel
}

/** Afegeix una feina a la cua comuna de miniatures (una cada cop; `key` evita repetir-la). */
export function enqueueThumb(key: string, run: () => Promise<void>): () => void {
  const release = want(key)
  if (pending.has(key)) return release
  pending.add(key)
  queue.push({ id: key, run })
  void drain()
  return release
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
  clearTimeout(releaseTimer)
  try {
    while (queue.length) {
      const job = queue.shift()!
      // La targeta que la volia ja no hi és (s'ha tancat l'acordió, s'ha canviat de pàgina): se salta.
      if (!wanted.has(job.id)) {
        pending.delete(job.id)
        templateListeners.delete(String(job.id))
        continue
      }
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
    clearTimeout(releaseTimer)
    releaseTimer = setTimeout(() => {
      if (!running) releaseThumbRenderer()
    }, RELEASE_MS)
  }
}
